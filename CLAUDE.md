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
  ui/                       # Composants shadcn (Badge, Button, Input)

lib/
  api.ts                    # Helpers API: ok(), created(), notFound(), handler(), resourceHandler(), pickFields()
  types.ts                  # Types partages (Feature, Agent, Run, Message) + constantes statuts
  db/
    index.ts                # Init connexion SQLite, getDb(), createTables()
    schema.ts               # Schema Drizzle (10 tables)
  services/
    feature-service.ts      # CRUD features (list, get, create, update, delete)
    agent-service.ts        # CRUD agents + setStatus
    run-service.ts          # CRUD runs + events
    message-service.ts      # Messages utilisateur (create, list, markAsRead)

hooks/
  use-api.ts                # Hook useApi<T>(url) + apiPost/apiPatch

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
- **Phase 2 (A FAIRE)**: Spawn Claude CLI (adapter, parser, stream-json), WebSocket server, Live view
- **Phase 3 (A FAIRE)**: Serveur MCP interne, orchestrateur Claude, heartbeat scheduler, wakeup manuel
- **Phase 4 (A FAIRE)**: Stop/restart agents, messages utilisateur
- **Phase 5 (A FAIRE)**: Skills, dashboard avance, config, historique, stats, CLI avance
