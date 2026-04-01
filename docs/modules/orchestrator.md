# Module Orchestrator

## Responsabilité

L'orchestrateur est un **agent Claude** spécial qui coordonne les agents worker. Il ne code pas, il ne modifie pas le projet directement. Il planifie, délègue, fournit du contexte, et s'assure que les agents ne se marchent pas dessus.

## Concept

L'orchestrateur est le **manager** de l'équipe d'agents. Il est spawné périodiquement par le heartbeat (ou manuellement par l'utilisateur). À chaque réveil, il :

1. Évalue l'état du projet (features en attente, agents disponibles, travail en cours)
2. Décide quels agents doivent travailler sur quoi
3. Fournit le contexte nécessaire à chaque agent
4. Lance les agents via les outils MCP
5. Peut proposer à l'utilisateur de créer de nouveaux archétypes d'agents

L'orchestrateur ne peut PAS :
- Modifier des fichiers du projet
- Exécuter des commandes système
- Agir sans déléguer à un agent worker

## Interaction avec Maestro : MCP Server

L'orchestrateur interagit avec Maestro via un **serveur MCP interne**. Maestro expose des outils que l'orchestrateur appelle depuis sa session Claude CLI.

### Outils MCP disponibles

#### Lecture de l'état

```typescript
// Liste les features et leur statut
list_features(filters?: { status?: string })
→ Feature[]

// Detail d'une feature
get_feature(featureId: string)
→ Feature & { runs: Run[], messages: Message[] }

// Liste les agents et leur statut
list_agents()
→ Agent[]

// Statut d'un agent (idle, running, dernier run)
get_agent_status(agentId: string)
→ AgentStatus & { lastRun?: RunSummary }

// Contexte du projet (structure, fichiers cles, deps, conventions)
get_project_context()
→ ProjectContext

// Messages de l'utilisateur en attente (envoyes entre deux runs)
get_pending_messages()
→ Message[]
```

#### Actions

```typescript
// Assigner une tache a un agent avec un prompt et du contexte
assign_task(params: {
  agentId: string,
  featureId: string,
  prompt: string,           // Instructions specifiques pour ce run
  context?: string,         // Contexte additionnel (fichiers pertinents, etc.)
})
→ { runId: string }

// Proposer un nouvel archetype d'agent a l'utilisateur
propose_agent(params: {
  name: string,
  description: string,
  model: string,
  instructions: string,
  skills: string[],
  rationale: string,        // Pourquoi cet agent serait utile
})
→ { proposalId: string }

// Marquer une feature comme terminee
complete_feature(featureId: string)
→ void

// Changer la priorite d'une feature
set_feature_priority(featureId: string, priority: number)
→ void
```

### Lancement de l'orchestrateur

```typescript
function spawnOrchestrator(): ChildProcess {
  return spawn("claude", [
    "--output-format", "stream-json",
    "--print", "conversation",
    "--model", config.orchestrator.model,      // Ex: claude-sonnet-4-6
    "--max-turns", String(config.orchestrator.maxTurns),
    "--dangerously-skip-permissions",
    "--mcp-config", mcpConfigPath,              // Config du serveur MCP
    "--resume", sessionId,                      // Resume si session existante
    "-p", orchestratorPrompt,
  ], { cwd: projectRoot });
}
```

### Configuration MCP

Le fichier de configuration MCP pointe vers le serveur interne de Maestro :

```json
{
  "mcpServers": {
    "maestro": {
      "type": "stdio",
      "command": "node",
      "args": ["./mcp-server.js"],
      "env": {
        "MAESTRO_DB_PATH": ".maestro/db.sqlite",
        "MAESTRO_PROJECT_ROOT": "/path/to/project"
      }
    }
  }
}
```

> Note : le serveur MCP tourne dans le même process Node.js que Maestro. Le `mcp-server.js` est un pont stdio qui communique avec les services internes.

## Vérification du travail

L'orchestrateur ne vérifie pas lui-même le travail des agents (il n'interagit pas avec le projet). A la place, il **délègue la vérification à des agents spécialisés** :

- Un agent **QA** qui lancé les tests, vérifie les régressions, valide le code
- Un agent **review** qui relit le diff et signale les problèmes

L'orchestrateur peut proposer la création de ces agents si l'équipe n'en a pas. Le workflow typique devient :

```
Orchestrateur → assigne MAE-1 a backend-dev
                  → backend-dev termine (succeeded)
Orchestrateur → assigne la verification de MAE-1 a qa-engineer
                  → qa-engineer termine (succeeded, tests OK)
Orchestrateur → complete_feature(MAE-1)
```

Si le QA échoue, l'orchestrateur peut reassigner la feature au dev avec le retour du QA en contexte.

## Git : commits sur main (MVP)

Les agents commitent directement sur la branche courante (généralement `main`). Pas de branches par feature au MVP.

L'orchestrateur inclut dans le prompt de chaque agent l'instruction de commiter son travail avec des messages clairs. Si des problèmes apparaissent avec cette approche, l'architecture permettra d'évoluer vers des branches par feature (l'agent fait `git checkout -b maestro/MAE-X` au début de son run).

## Prompt de l'orchestrateur

Le prompt système de l'orchestrateur définit son role et ses capacités :

```markdown
You are the Maestro orchestrator. You coordinate a team of AI agents working
on a software project.

## Your role
- Evaluate the current state of the project (features, agents, pending work)
- Decide which agents should work on which features
- Provide clear, detailed context to each agent so they can work effectively
- Ensure no two agents work on the same files simultaneously
- Propose new agent archetypes when the current team lacks a needed skill
- Delegate verification to QA/review agents, never validate work yourself

## What you can do
- Use `list_features` and `list_agents` to understand the current state
- Use `get_project_context` to understand the codebase
- Use `get_pending_messages` to read user messages
- Use `assign_task` to delegate work to agents with specific instructions
- Use `propose_agent` to suggest new agent types to the user
- Use `complete_feature` when a feature is done AND verified
- Use `set_feature_priority` to reorder work

## What you cannot do
- You cannot modify project files directly
- You cannot execute shell commands
- You cannot create features (only the user can)
- You cannot verify work yourself (delegate to QA agents)

## Guidelines
- Always check agent status before assigning work
- Provide rich context in task assignments: relevant files, conventions,
  dependencies, and what other agents have done recently
- When a user message is pending, prioritize addressing it
- If a previous run failed, analyze the failure before retrying
- Serialize work on shared files: never assign two agents to files
  that overlap
- When you lack an agent archetype for a task (e.g., QA, security auditor,
  documentation writer), propose it to the user with a clear rationale
- Never mark a feature as complete without QA validation
- Tell agents to commit their work on the current branch with clear messages
```

## Cycle de vie

```
Heartbeat tick / User wake
         │
         ▼
┌─────────────────────┐
│ Spawn orchestrateur  │
│ (claude CLI + MCP)   │
│ --resume <session>   │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ list_features()      │ → Quelles features sont en attente ?
│ list_agents()        │ → Quels agents sont disponibles ?
│ get_pending_messages │ → L'utilisateur a-t-il dit quelque chose ?
│ get_agent_status()   │ → Un agent a-t-il fini ou echoue ?
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Raisonnement         │
│ - Analyse l'etat     │
│ - Decide des actions │
│ - Prepare le contexte│
└─────────┬───────────┘
          │
          ├──── assign_task(backend-dev, MAE-1, prompt, context)
          │         → Agent spawne, travaille sur la feature
          │
          ├──── propose_agent("qa-engineer", ...)
          │         → Proposition stockee, visible dans l'UI
          │
          ├──── complete_feature(MAE-5)
          │         → Feature marquee comme terminee
          │
          ▼
┌─────────────────────┐
│ Run termine          │
│ Session sauvegardee  │
│ pour resume futur    │
└─────────────────────┘
```

## Serialisation du travail

L'orchestrateur est responsable d'éviter les conflits. Deux stratégies :

### 1. Séquentiel strict (MVP)

Un seul agent worker tourne à la fois. L'orchestrateur attend que le run précédent soit terminé avant d'en lancer un nouveau.

```
Orchestrateur reveille
  → Agent A travaille sur MAE-1
  → (attend la fin)
  → Agent B travaille sur MAE-2
  → (attend la fin)
  → Orchestrateur se termine
```

### 2. Concurrence par zones (futur)

L'orchestrateur pourrait autoriser deux agents en parallèle s'ils travaillent sur des parties disjointes du projet. Il analyserait les fichiers impactés par chaque feature avant de décider.

## Configuration

Dans `.maestro/config.yml` :

```yaml
orchestrator:
  model: claude-sonnet-4-6       # Modele utilise par l'orchestrateur
  maxTurns: 20                   # Max turns par session d'orchestration
  timeoutSec: 300                # Timeout de l'orchestrateur
```

L'orchestrateur n'a pas de fichier de config dédié dans `.maestro/agents/` : il est interne a Maestro et configure globalement.

## Propositions d'agents

Quand l'orchestrateur identifie un besoin non couvert, il propose un nouvel archétype d'agent :

```typescript
interface AgentProposal {
  id: string;
  name: string;              // ex: "qa-engineer"
  description: string;       // ex: "Runs tests and validates features"
  model: string;
  instructions: string;
  skills: string[];
  rationale: string;         // Pourquoi cet agent est necessaire
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
}
```

Les propositions apparaissent dans l'UI. L'utilisateur peut accepter (crée l'agent) ou rejeter.

## Structure technique

```
lib/
├── orchestrator/
│   ├── orchestrator-service.ts   # Spawn et gestion de l'orchestrateur
│   ├── orchestrator-prompt.ts    # Construction du prompt
│   └── orchestrator-config.ts    # Configuration
├── mcp/
│   ├── server.ts                 # Serveur MCP (stdio bridge)
│   ├── tools/                    # Implementation des outils MCP
│   │   ├── list-features.ts
│   │   ├── get-feature.ts
│   │   ├── list-agents.ts
│   │   ├── get-agent-status.ts
│   │   ├── get-project-context.ts
│   │   ├── get-pending-messages.ts
│   │   ├── assign-task.ts
│   │   ├── propose-agent.ts
│   │   ├── complete-feature.ts
│   │   └── set-feature-priority.ts
│   └── types.ts
```
