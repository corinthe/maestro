# Module Agents

## Responsabilite

Gestion du cycle de vie complet des agents Claude Code : configuration, spawn des processus, isolation via git worktrees, suivi des sessions, et interventions utilisateur.

## Concept

Un **agent** est une identite persistante associee a une configuration Claude Code. Il peut etre reveille pour travailler sur une feature, execute dans un worktree isole, et maintient la continuite de ses sessions entre les runs.

Un agent n'est PAS un skill. Un skill est un fichier d'instructions markdown. Un agent est une entite qui utilise des skills pour accomplir du travail.

## Configuration d'un agent

Fichier YAML dans `.maestro/agents/` :

```yaml
# .maestro/agents/backend-dev.yml
name: backend-dev
description: "Backend developer specializing in API and database work"

# Claude CLI configuration
model: claude-sonnet-4-6        # Modele Claude a utiliser
effort: high                     # Effort de raisonnement (low|medium|high)
maxTurnsPerRun: 50               # Max tours par run
skipPermissions: true            # --dangerously-skip-permissions (defaut: true)

# Instructions
instructions: |
  You are a backend developer working on this project.
  Focus on clean, tested code. Always run tests before committing.
  Commit your work with clear messages.

# Skills attaches a cet agent
skills:
  - code-review
  - testing-strategy

# Timeouts
timeoutSec: 600                  # 10 minutes par run
graceSec: 30                     # Grace period avant SIGTERM

# Variables d'environnement supplementaires
env:
  NODE_ENV: development
```

## Cycle de vie d'un agent

```
                  create
                    │
                    ▼
              ┌──────────┐
              │   Idle    │◄──────────────────────┐
              └─────┬─────┘                       │
                    │ wake / heartbeat             │
                    ▼                              │
              ┌──────────┐                        │
              │ Checking  │  Verifie si du         │
              │  Queue    │  travail est disponible│
              └─────┬─────┘                       │
                    │                              │
          ┌─────────┼──────────┐                  │
          │ rien    │ feature  │                  │
          ▼         ▼          │                  │
       (idle)  ┌──────────┐   │                  │
               │ Running   │   │                  │
               │           │   │                  │
               │ spawn     │   │                  │
               │ claude    │   │                  │
               │ CLI       │   │                  │
               └─────┬─────┘   │                  │
                     │         │                  │
          ┌──────────┼─────────┘                  │
          │          │                            │
          ▼          ▼                            │
    ┌──────────┐ ┌──────────┐                    │
    │Succeeded │ │  Failed  │                    │
    └─────┬────┘ └─────┬────┘                    │
          │            │                          │
          └────────────┴──────────────────────────┘
                  retour a Idle
```

## Spawn de Claude CLI

### Construction de la commande

```typescript
function buildClaudeArgs(agent: AgentConfig, run: Run): string[] {
  const args: string[] = [
    "--output-format", "stream-json",   // Sortie parsable
    "--print", "conversation",          // Affiche tout
    "--model", agent.model,
    "--max-turns", String(agent.maxTurnsPerRun),
  ];

  if (agent.effort) {
    args.push("--effort", agent.effort);
  }

  if (agent.skipPermissions) {
    args.push("--dangerously-skip-permissions");
  }

  // Skills : ajout du repertoire de skills
  if (skillsDir) {
    args.push("--add-dir", skillsDir);
  }

  // Resume de session si disponible
  if (run.sessionId) {
    args.push("--resume", run.sessionId);
  }

  // Prompt
  args.push("-p", buildPrompt(agent, run));

  return args;
}
```

### Execution

```typescript
async function executeRun(agent: AgentConfig, run: Run): Promise<RunResult> {
  // 1. Preparer le worktree
  const worktreePath = await worktreeManager.create(run.feature.branch);

  // 2. Preparer le repertoire de skills temporaire
  const skillsDir = await prepareSkillsDir(agent.skills);

  // 3. Construire la commande
  const args = buildClaudeArgs(agent, run);

  // 4. Spawn le processus
  const child = spawn("claude", args, {
    cwd: worktreePath,
    env: { ...process.env, ...agent.env },
  });

  // 5. Parser le stream JSON ligne par ligne
  child.stdout.on("data", (chunk) => {
    for (const line of chunk.toString().split("\n")) {
      const event = parseStreamEvent(line);
      if (event) {
        // Persister en DB + emettre via WebSocket
        saveRunEvent(run.id, event);
        broadcast("run.event", { runId: run.id, event });
      }
    }
  });

  // 6. Gerer la fin du processus
  const exitCode = await waitForExit(child, agent.timeoutSec);

  // 7. Nettoyer
  await cleanupSkillsDir(skillsDir);

  return buildResult(run, exitCode);
}
```

## Gestion des git worktrees

Chaque agent travaille dans un **worktree git isole** pour permettre la concurrence sans conflits.

### Cycle de vie d'un worktree

```
Feature assignee
       │
       ▼
  git worktree add .maestro/worktrees/<branch> -b <branch>
       │
       ▼
  Agent travaille dans ce worktree
       │
       ▼
  Run termine (succes ou echec)
       │
       ▼
  Worktree conserve (pour reprise ou inspection)
       │
       ▼
  Feature terminee → merge possible
       │
       ▼
  git worktree remove .maestro/worktrees/<branch>
```

### Conventions de nommage

- Branche : `maestro/<feature-slug>` (ex: `maestro/user-auth`)
- Worktree : `.maestro/worktrees/<feature-slug>`

## Intervention utilisateur

L'utilisateur peut interagir avec un agent en cours d'execution :

### Envoyer un message

L'utilisateur tape un message dans l'UI. Ce message est injecte dans le stdin du processus Claude CLI (via `--resume` avec un nouveau prompt contenant le message de l'utilisateur).

En pratique, l'approche est :
1. Stopper le run en cours (SIGTERM)
2. Relancer Claude CLI avec `--resume <session-id>` et le message utilisateur comme nouveau prompt

### Stopper un agent

1. Envoie SIGTERM au processus Claude CLI
2. Attend la grace period (`graceSec`)
3. SIGKILL si le processus ne repond pas
4. Marque le run comme `stopped`

### Redemarrer un agent

1. Reprend la derniere session si possible (`--resume`)
2. Sinon, demarre une nouvelle session avec le contexte de la feature

## Gestion des sessions

Les sessions Claude sont persistees pour permettre la reprise :

```typescript
interface AgentSession {
  agentId: string;
  featureId: string;
  sessionId: string;       // Session Claude CLI
  worktreePath: string;
  lastRunId: string;
}
```

Quand un agent est reveille pour une feature sur laquelle il a deja travaille, Maestro utilise `--resume <sessionId>` pour maintenir la continuite de la conversation.

Si la session n'existe plus (erreur "unknown session"), Maestro relance sans resume.

## Structure technique

```
lib/
├── claude/
│   ├── adapter.ts        # Spawn et gestion du processus Claude CLI
│   ├── parser.ts         # Parse des events stream-json
│   ├── args-builder.ts   # Construction des arguments CLI
│   └── session.ts        # Gestion des sessions (resume, fallback)
├── agents/
│   ├── agent-service.ts  # CRUD + cycle de vie
│   ├── agent-config.ts   # Lecture/validation des fichiers YAML
│   └── agent-runner.ts   # Orchestration d'un run complet
└── worktree/
    ├── worktree-manager.ts  # Create/remove/list worktrees
    └── branch-naming.ts     # Conventions de nommage
```
