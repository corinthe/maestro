# Module Server / API

## Responsabilité

Serveur Next.js qui expose l'API REST, le serveur MCP interne (pour l'orchestrateur), gère les connexions WebSocket temps réel, et orchestre les services métier.

## API Routes

Toutes les routes sont sous `/api/` via le App Router de Next.js.

### Features

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/features` | Liste des features (filtres: status, agent) |
| POST | `/api/features` | Créer une feature |
| GET | `/api/features/:id` | Detail d'une feature |
| PATCH | `/api/features/:id` | Modifier une feature (titre, description, statut, priorité) |
| DELETE | `/api/features/:id` | Supprimer une feature |

### Agents

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/agents` | Liste des agents et leur statut |
| POST | `/api/agents` | Créer un agent |
| GET | `/api/agents/:id` | Detail d'un agent (config, stats) |
| PATCH | `/api/agents/:id` | Modifier la configuration d'un agent |
| DELETE | `/api/agents/:id` | Supprimer un agent |
| POST | `/api/agents/:id/stop` | Arrêter un agent en cours |

### Orchestrator

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/orchestrator/status` | Statut de l'orchestrateur (idle, running) |
| POST | `/api/orchestrator/wake` | Réveiller l'orchestrateur immédiatement |
| GET | `/api/orchestrator/runs` | Historique des runs de l'orchestrateur |

### Runs (exécutions)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/runs` | Liste des runs (filtres: agent, feature, status) |
| GET | `/api/runs/:id` | Detail d'un run avec events |
| GET | `/api/runs/:id/events` | Events d'un run (polling fallback, paginée) |
| POST | `/api/runs/:id/stop` | Arrêter un run |
| POST | `/api/runs/:id/restart` | Relancer un run |

### Messages

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/messages` | Envoyer un message (lu par l'orchestrateur au prochain réveil) |
| GET | `/api/messages` | Messages en attente |

### Agent proposals

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/proposals` | Propositions d'agents de l'orchestrateur |
| POST | `/api/proposals/:id/accept` | Accepter une proposition (crée l'agent) |
| POST | `/api/proposals/:id/reject` | Rejeter une proposition |

### Skills

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/skills` | Liste des skills locaux |
| POST | `/api/skills` | Créer un skill |
| GET | `/api/skills/:id` | Contenu d'un skill |
| PUT | `/api/skills/:id` | Modifier un skill |
| DELETE | `/api/skills/:id` | Supprimer un skill |

### Config

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/config` | Configuration globale |
| PATCH | `/api/config` | Modifier la configuration |

## MCP Server interne

Le serveur MCP est le pont entre l'orchestrateur (Claude CLI) et Maestro. Il expose les outils que l'orchestrateur utilise pour lire l'état du projet et lancer des agents.

Voir [orchestrator.md](orchestrator.md) pour la liste complété des outils MCP.

### Implementation

Le serveur MCP utilise le protocole stdio. Quand l'orchestrateur est spawne, Maestro passé un fichier de configuration MCP qui pointe vers le serveur interne :

```typescript
// Simplifie
class MaestroMcpServer {
  constructor(private services: Services) {}

  handleToolCall(name: string, args: unknown) {
    switch (name) {
      case "list_features":
        return this.services.features.list(args);
      case "assign_task":
        return this.services.agents.assignTask(args);
      case "propose_agent":
        return this.services.proposals.create(args);
      // ...
    }
  }
}
```

## WebSocket

Un endpoint WebSocket (`/api/ws`) fournit les events temps réel.

### Events serveur → client

```typescript
// L'orchestrateur a change de statut
{ type: "orchestrator.status", status: "idle" | "running" }

// Un agent a change de statut
{ type: "agent.status", agentId: string, status: "idle" | "running" | "stopped" }

// Un run a change de statut
{ type: "run.status", runId: string, status: "queued" | "running" | "succeeded" | "failed" | "stopped" }

// Event de stream Claude (assistant text, tool_use, thinking, tool_result)
{ type: "run.event", runId: string, event: ClaudeStreamEvent }

// Une feature a change de statut
{ type: "feature.status", featureId: string, status: string }

// Nouvelle proposition d'agent par l'orchestrateur
{ type: "proposal.new", proposal: AgentProposal }
```

### Events client → serveur

```typescript
// Stopper un run
{ type: "run.stop", runId: string }

// Reveiller l'orchestrateur
{ type: "orchestrator.wake" }
```

## Architecture interne

```
app/
├── api/
│   ├── features/
│   │   ├── route.ts              # GET (list), POST (create)
│   │   └── [id]/
│   │       └── route.ts          # GET, PATCH, DELETE
│   ├── agents/
│   │   ├── route.ts
│   │   └── [id]/
│   │       ├── route.ts
│   │       └── stop/route.ts
│   ├── orchestrator/
│   │   ├── status/route.ts
│   │   ├── wake/route.ts
│   │   └── runs/route.ts
│   ├── runs/
│   │   ├── route.ts
│   │   └── [id]/
│   │       ├── route.ts
│   │       ├── events/route.ts
│   │       ├── stop/route.ts
│   │       └── restart/route.ts
│   ├── messages/route.ts
│   ├── proposals/
│   │   ├── route.ts
│   │   └── [id]/
│   │       ├── accept/route.ts
│   │       └── reject/route.ts
│   ├── skills/
│   │   ├── route.ts
│   │   └── [id]/route.ts
│   ├── config/route.ts
│   └── ws/route.ts               # WebSocket upgrade
└── lib/
    ├── services/                  # Logique metier
    │   ├── agent-service.ts
    │   ├── feature-service.ts
    │   ├── run-service.ts
    │   ├── skill-service.ts
    │   ├── config-service.ts
    │   ├── message-service.ts
    │   └── proposal-service.ts
    ├── orchestrator/              # Orchestrateur
    │   ├── orchestrator-service.ts
    │   └── orchestrator-prompt.ts
    ├── mcp/                       # Serveur MCP interne
    │   ├── server.ts
    │   └── tools/
    ├── claude/                    # Interaction Claude CLI
    │   ├── adapter.ts
    │   └── parser.ts
    ├── ws/                        # WebSocket
    │   ├── server.ts
    │   └── events.ts
    └── db/                        # Acces base de donnees
        ├── index.ts
        ├── schema.ts
        └── migrations/
```

## Gestion des erreurs

Les API routes retournent des réponses standardisées :

```typescript
// Succes
{ data: T }

// Erreur
{ error: { code: string, message: string } }
```

Codes HTTP : 200 (succès), 201 (créé), 400 (validation), 404 (introuvable), 500 (interne).
