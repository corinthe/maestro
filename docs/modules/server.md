# Module Server / API

## Responsabilite

Serveur Next.js qui expose l'API REST, gere les connexions WebSocket temps reel, et orchestre les services metier (agents, features, runs, skills).

## API Routes

Toutes les routes sont sous `/api/` via le App Router de Next.js.

### Features

| Methode | Route | Description |
|---------|-------|-------------|
| GET | `/api/features` | Liste des features (filtres: status, agent) |
| POST | `/api/features` | Creer une feature |
| GET | `/api/features/:id` | Detail d'une feature |
| PATCH | `/api/features/:id` | Modifier une feature (titre, description, statut, agent assigne) |
| DELETE | `/api/features/:id` | Supprimer une feature |

### Agents

| Methode | Route | Description |
|---------|-------|-------------|
| GET | `/api/agents` | Liste des agents et leur statut |
| POST | `/api/agents` | Creer un agent |
| GET | `/api/agents/:id` | Detail d'un agent (config, stats) |
| PATCH | `/api/agents/:id` | Modifier la configuration d'un agent |
| DELETE | `/api/agents/:id` | Supprimer un agent |
| POST | `/api/agents/:id/wake` | Reveiller un agent |
| POST | `/api/agents/:id/stop` | Arreter un agent |

### Runs (executions)

| Methode | Route | Description |
|---------|-------|-------------|
| GET | `/api/runs` | Liste des runs (filtres: agent, feature, status) |
| GET | `/api/runs/:id` | Detail d'un run avec events |
| GET | `/api/runs/:id/events` | Stream des events d'un run (pour polling fallback) |
| POST | `/api/runs/:id/message` | Envoyer un message a l'agent pendant son execution |
| POST | `/api/runs/:id/stop` | Arreter un run |
| POST | `/api/runs/:id/restart` | Relancer un run |

### Skills

| Methode | Route | Description |
|---------|-------|-------------|
| GET | `/api/skills` | Liste des skills locaux |
| POST | `/api/skills` | Creer un skill |
| GET | `/api/skills/:id` | Contenu d'un skill |
| PUT | `/api/skills/:id` | Modifier un skill |
| DELETE | `/api/skills/:id` | Supprimer un skill |

### Config

| Methode | Route | Description |
|---------|-------|-------------|
| GET | `/api/config` | Configuration globale |
| PATCH | `/api/config` | Modifier la configuration |

## WebSocket

Un endpoint WebSocket (`/api/ws`) fournit les events temps reel.

### Events serveur → client

```typescript
// Un agent a change de statut
{ type: "agent.status", agentId: string, status: "idle" | "running" | "stopped" }

// Un run a change de statut
{ type: "run.status", runId: string, status: "queued" | "running" | "succeeded" | "failed" | "stopped" }

// Event de stream Claude (assistant text, tool_use, thinking, tool_result)
{ type: "run.event", runId: string, event: ClaudeStreamEvent }

// Une feature a change de statut
{ type: "feature.status", featureId: string, status: string }
```

### Events client → serveur

```typescript
// Envoyer un message a un agent en cours d'execution
{ type: "run.message", runId: string, message: string }

// Stopper un run
{ type: "run.stop", runId: string }
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
│   │       ├── wake/route.ts
│   │       └── stop/route.ts
│   ├── runs/
│   │   ├── route.ts
│   │   └── [id]/
│   │       ├── route.ts
│   │       ├── events/route.ts
│   │       ├── message/route.ts
│   │       ├── stop/route.ts
│   │       └── restart/route.ts
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
    │   └── config-service.ts
    ├── claude/                    # Interaction Claude CLI
    │   ├── adapter.ts             # Spawn + gestion du process
    │   ├── parser.ts              # Parse stream-json
    │   └── worktree.ts            # Gestion des git worktrees
    ├── ws/                        # WebSocket
    │   ├── server.ts              # Gestion des connexions
    │   └── events.ts              # Dispatch des events
    └── db/                        # Acces base de donnees
        ├── index.ts
        ├── schema.ts
        └── migrations/
```

## Gestion des erreurs

Les API routes retournent des reponses standardisees :

```typescript
// Succes
{ data: T }

// Erreur
{ error: { code: string, message: string } }
```

Codes HTTP : 200 (succes), 201 (cree), 400 (validation), 404 (introuvable), 500 (interne).
