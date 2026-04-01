# Maestro

Orchestrateur de projet IA, local-first, qui pilote une equipe d'agents Claude Code depuis une UI web style Linear. Un Maestro = un repo git.

## Commandes

```bash
pnpm dev              # Lance le serveur Next.js sur :4200
pnpm build            # Build Next.js + compile CLI (tsc)
pnpm lint             # ESLint
pnpm cli              # Lance le CLI en dev (tsx src/cli/index.ts)
pnpm db:generate      # Genere les migrations Drizzle
pnpm db:migrate       # Applique les migrations
```

## Stack

- **Next.js 15** (App Router) - UI + API dans un seul process
- **Tailwind v4** + **shadcn/ui** - composants UI minimalistes
- **SQLite** via **better-sqlite3** - DB embarquee `.maestro/db.sqlite`
- **Drizzle ORM** - type-safe, schema dans `lib/db/schema.ts`
- **WebSocket** (ws) - temps reel
- **Claude CLI** - spawne via `child_process` avec `--output-format stream-json`
- **pnpm** - package manager

## Architecture

```
app/                        # Pages et API routes Next.js (App Router)
  api/                      # API REST: /api/features, /api/agents, /api/runs, /api/messages, /api/orchestrator
  features/                 # Page liste + detail features
  agents/                   # Page agents
  page.tsx                  # Dashboard
  layout.tsx                # Layout racine + sidebar

components/
  layout/sidebar.tsx        # Sidebar fixe 240px
  runs/run-event.tsx        # Rendu d'un event Claude (system, assistant, tool, result)
  ui/                       # Composants shadcn (Badge, Button, Input)

lib/
  api.ts                    # Helpers API: ok(), created(), notFound(), handler(), resourceHandler(), pickFields()
  types.ts                  # Types partages (Feature, Agent, Run, Message) + constantes statuts
  db/
    index.ts                # Init connexion SQLite, getDb(), createTables()
    schema.ts               # Schema Drizzle (10 tables)
  claude/
    args-builder.ts         # Construction des args CLI (model, effort, max-turns, skills, resume)
    parser.ts               # Parse stream-json ligne par ligne → StreamEvent
    adapter.ts              # Spawn Claude CLI process, gestion stdout/stderr/exit
    agent-runner.ts         # Orchestration d'un run complet: DB + spawn + WS broadcast + timeout
  ws/
    server.ts               # WebSocket server (port 4201), broadcast()
  mcp/
    server.ts               # Serveur MCP interne (stdio) — expose les outils Maestro a Claude
  orchestrator/
    index.ts                # Orchestrateur: wake, stop, status, config heartbeat
    heartbeat.ts            # Scheduler heartbeat (setInterval configurable)
    prompt.ts               # System prompt pour l'orchestrateur Claude
  services/
    feature-service.ts      # CRUD features (list, get, create, update, delete)
    agent-service.ts        # CRUD agents + setStatus
    run-service.ts          # CRUD runs + events
    message-service.ts      # Messages utilisateur (create, list, markAsRead)

hooks/
  use-api.ts                # Hook useApi<T>(url) + apiPost/apiPatch
  use-websocket.ts          # Hook useWebSocket avec reconnexion auto + filtrage events

instrumentation.ts          # Demarre le WS server au boot Next.js

src/
  cli/index.ts              # CLI commander (init, dev)
```

## Conventions

### API Routes
- Reponses: `{ data: T }` en succes, `{ error: { code, message } }` en erreur
- Codes HTTP: 200, 201, 400, 404, 500
- Utiliser `handler()` / `resourceHandler()` pour le boilerplate try/catch
- `pickFields()` pour filtrer les champs dans les PATCH

### Client
- `useApi<T>(url)` pour fetch-on-mount avec loading/error/refetch
- `apiPost(url, body)` / `apiPatch(url, body)` pour les mutations
- Les clients lisent `json.data`

### Types
- camelCase partout (pas de snake_case) : `agentId`, `createdAt`, `featureId`
- Agent `config` est un JSON string (parse cote client)
- Statuts features: `backlog | in_progress | done | cancelled`
- Statuts agents: `idle | running | stopped`
- Statuts runs: `queued | running | succeeded | failed | stopped | timed_out`

### UI / Design
- Palette: indigo `#6366F1` accent, fond `#FAFAFA`, cartes blanches `#FFFFFF`
- Typographie: Inter/Geist, sans-serif
- Pas de dark mode, pas de raccourcis clavier
- Badges colores par statut (backlog=gris, in_progress=bleu, done=vert, cancelled=rouge)

### Base de donnees
- 10 tables: agents, features, runs, run_events, skills, agent_skills, sessions, messages, proposals, config
- UUIDs comme PK (sauf run_events: autoincrement, config: key string)
- Dates stockees en ISO string (TEXT)
- `run_events` purges apres 24h, `runs` conserves indefiniment

## Avancement

- **Phase 1 (DONE)**: CLI init/dev, CRUD features/agents, UI dashboard/features/agents, services, API routes
- **Phase 2 (DONE)**: Spawn Claude CLI (adapter, parser, agent-runner), WebSocket server (port 4201), Live view (/runs/:id), Stop/Restart
- **Phase 3 (DONE)**: Serveur MCP interne, orchestrateur Claude, heartbeat scheduler, wakeup manuel
- **Phase 3.5 (A FAIRE)**: Stabilisation avant nouvelles features
  - Recovery au demarrage: detecter les runs orphelins "running" et les marquer `failed`
  - Mutex orchestrateur: empecher les wakeups concurrents (verrou en DB ou in-memory)
  - Validation des inputs: schema validation sur prompts, configs agents, noms/titres
  - Logging structure: logs sur runs, spawns, erreurs, actions orchestrateur (minimum)
  - Tests critiques: parser Claude, agent-runner, orchestrateur, services CRUD
  - Purge run_events: implementer la purge apres 24h (documentee mais absente)
  - Rate limiting: limiter les appels API et les spawns d'agents concurrents
- **Phase 4 (A FAIRE)**: Stop/restart agents, messages utilisateur
- **Phase 5 (A FAIRE)**: Skills, dashboard avance (stats reelles, activite recente, features actives), config, historique, stats, CLI avance
