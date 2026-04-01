# Module Agents

## Responsabilité

Gestion du cycle de vie des agents worker Claude Code : configuration, spawn des processus, suivi des sessions, et contrôle (stop/restart).

Les agents sont des **exécutants**. Ils ne décident pas quoi faire — c'est l'orchestrateur qui leur assigné du travail avec un prompt et du contexte.

## Concept

Un **agent** est une identité persistante associée à une configuration Claude Code. L'orchestrateur lui assigné des tâches, et Maestro spawné Claude CLI pour les exécuter. Les agents travaillent directement sur le repo (pas de worktree), un à la fois, sérialises par l'orchestrateur.

Un agent n'est PAS un skill. Un skill est un fichier d'instructions markdown. Un agent est une entité qui utilise des skills pour accomplir du travail.

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
              │   Idle    │◄──────────────────┐
              └─────┬─────┘                   │
                    │ orchestrateur            │
                    │ assign_task()            │
                    ▼                          │
              ┌──────────┐                    │
              │ Running   │                    │
              │           │                    │
              │ spawn     │                    │
              │ claude    │                    │
              │ CLI       │                    │
              └─────┬─────┘                    │
                    │                          │
          ┌─────────┼─────────┐               │
          │         │         │               │
          ▼         ▼         ▼               │
    ┌──────────┐ ┌──────┐ ┌───────┐          │
    │Succeeded │ │Failed│ │Stopped│          │
    └─────┬────┘ └──┬───┘ └───┬───┘          │
          │         │         │               │
          └─────────┴─────────┴───────────────┘
                  retour a Idle
```

## Spawn de Claude CLI

### Construction de la commande

```typescript
function buildClaudeArgs(agent: AgentConfig, task: AssignedTask): string[] {
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
  if (task.sessionId) {
    args.push("--resume", task.sessionId);
  }

  // Prompt (construit par l'orchestrateur, enrichi avec le contexte)
  args.push("-p", task.prompt);

  return args;
}
```

### Exécution

```typescript
async function executeRun(agent: AgentConfig, task: AssignedTask): Promise<RunResult> {
  // 1. Preparer le repertoire de skills temporaire
  const skillsDir = await prepareSkillsDir(agent.skills);

  // 2. Construire la commande
  const args = buildClaudeArgs(agent, task);

  // 3. Spawn le processus (dans le repo directement, pas de worktree)
  const child = spawn("claude", args, {
    cwd: projectRoot,
    env: { ...process.env, ...agent.env },
  });

  // 4. Parser le stream JSON ligne par ligne
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

  // 5. Gerer la fin du processus
  const exitCode = await waitForExit(child, agent.timeoutSec);

  // 6. Nettoyer
  await cleanupSkillsDir(skillsDir);

  return buildResult(run, exitCode);
}
```

## Pas de worktrees (MVP)

Les agents travaillent directement sur le repo. L'orchestrateur garantit qu'un seul agent travaille à la fois (sérialisation séquentielle). Avantages :

- **Simplicité** : pas de création/merge/nettoyage de worktrees
- **Pas de conflits** : un seul agent modifié les fichiers à la fois
- **Cohérence** : chaque agent voit le travail des précédents

L'orchestrateur peut lancer un agent sur une branche dédiée si nécessaire (l'agent fait lui-même le `git checkout -b`).

## Messages utilisateur entre deux runs

L'utilisateur ne peut pas interagir avec un agent pendant qu'il tourne. Mais il peut laisser un message entre deux runs :

1. L'utilisateur écrit un message via l'UI
2. Le message est stocké en DB (`pending_messages`)
3. Au prochain réveil, l'orchestrateur lit les messages en attente (`get_pending_messages`)
4. L'orchestrateur intègre le message dans le prompt du prochain run de l'agent concerné

### Stopper un agent

1. Envoie SIGTERM au processus Claude CLI
2. Attend la grace period (`graceSec`)
3. SIGKILL si le processus ne répond pas
4. Marque le run comme `stopped`
5. L'orchestrateur est notifié au prochain tick

### Redémarrer un agent

1. Reprend la dernière session si possible (`--resume`)
2. Sinon, démarre une nouvelle session avec le contexte de la feature
3. Déclenche par l'orchestrateur ou par un wakeup manuel

## Gestion des sessions

Les sessions Claude sont persistées pour permettre la reprise :

```typescript
interface AgentSession {
  agentId: string;
  featureId: string;
  sessionId: string;       // Session Claude CLI
  lastRunId: string;
}
```

Quand l'orchestrateur assigné une tâche pour laquelle une session existe, Maestro utilise `--resume <sessionId>` pour maintenir la continuite de la conversation.

Si la session n'existe plus (erreur "unknown session"), Maestro relancé sans résumé.

## Structure technique

```
lib/
├── claude/
│   ├── adapter.ts        # Spawn et gestion du processus Claude CLI
│   ├── parser.ts         # Parse des events stream-json
│   ├── args-builder.ts   # Construction des arguments CLI
│   └── session.ts        # Gestion des sessions (resume, fallback)
└── agents/
    ├── agent-service.ts  # CRUD + cycle de vie
    ├── agent-config.ts   # Lecture/validation des fichiers YAML
    └── agent-runner.ts   # Execution d'un run complet
```
