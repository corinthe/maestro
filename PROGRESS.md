# Maestro - Suivi d'avancement

## Phase 1 - Squelette (F01-F04)

### F01 - Initialisation du projet (`maestro init`) - DONE
- [x] Setup projet : package.json, tsconfig, Next.js 15, Tailwind v4, Drizzle ORM
- [x] Schema base de donnees SQLite complet (10 tables : agents, features, runs, run_events, skills, agent_skills, sessions, messages, proposals, config)
- [x] CLI avec commander : commande `init` fonctionnelle
  - Verifie qu'on est dans un repo git
  - Cree `.maestro/` avec config.yml, agents/, skills/
  - Agents par defaut : developer.yml, qa-engineer.yml
  - Initialise la base SQLite
  - Met a jour .gitignore
  - Idempotent (re-executer ne casse rien)
- [x] CLI : commande `dev` (lance Next.js sur port 4200)

### F02 - Serveur dev (`maestro dev`) - DONE
- [x] Serveur Next.js demarre sur port configurable (defaut 4200)
- [x] Gestion propre de Ctrl+C (SIGTERM/SIGINT)
- [ ] Heartbeat scheduler (Phase 3)
- [ ] Synchronisation fichiers config vers DB au demarrage

### F03 - CRUD Features - DONE
- [x] Service layer : feature-service.ts (list, get, create, update, delete)
- [x] Generation auto des cles MAE-1, MAE-2...
- [x] API Routes :
  - GET/POST `/api/features`
  - GET/PATCH/DELETE `/api/features/:id`
- [x] Page UI `/features` : liste groupee par statut, formulaire de creation
- [x] Page UI `/features/:id` : detail, changement de statut
- [x] Badges de statut colores (backlog=gris, in_progress=bleu, done=vert, cancelled=rouge)

### F04 - Gestion des agents - DONE
- [x] Service layer : agent-service.ts (list, get, create, update, delete, setStatus)
- [x] API Routes :
  - GET/POST `/api/agents`
  - GET/PATCH/DELETE `/api/agents/:id`
- [x] Page UI `/agents` : grille de cartes, indicateur de statut, formulaire de creation
- [x] Indicateurs : idle=point gris, running=point vert pulsant, stopped=point rouge

### Services additionnels implementes
- [x] run-service.ts : gestion des runs (CRUD + events)
- [x] message-service.ts : messages utilisateur (create, list, markAsRead)
- [x] API Routes : runs, messages, orchestrator status/wake (placeholders)

### UI generale
- [x] Layout principal avec sidebar fixe (240px)
- [x] Navigation : Dashboard, Features, Agents
- [x] Design system : palette indigo, fond #FAFAFA, cartes blanches
- [x] Composants UI : Badge, Button, Input, Textarea (variants + tailles)
- [x] Dashboard (/) : cartes de stats, sections activite recente et features en cours
- [x] Tailwind v4 avec theme custom (@theme)

### Infrastructure
- [x] Build Next.js reussi (zero erreurs)
- [x] TypeScript strict
- [x] Drizzle ORM configure (schema + init SQL)
- [x] pnpm comme package manager
- [x] Deps : better-sqlite3, drizzle-orm, commander, picocolors, uuid, ws

---

## Refactoring effectue

### Abstractions partagees
- [x] `lib/types.ts` : types partages (Feature, Agent, Run, Message) + constantes de statut + labels + variants badge
- [x] `lib/api.ts` : helpers API (`ok`, `created`, `notFound`, `badRequest`, `serverError`, `handler`, `resourceHandler`, `pickFields`)
- [x] `hooks/use-api.ts` : hook `useApi<T>(url)` avec loading/error/refetch + `apiPost` / `apiPatch`
- [x] `components/ui/input.tsx` : composants `Input` et `Textarea` reutilisables

### Bugs corriges
- [x] Mismatch format API : les clients lisent maintenant `json.data` correctement via `useApi`
- [x] Types snake_case (`assigned_agent`, `created_at`) remplaces par camelCase (`agentId`, `createdAt`)
- [x] Type Agent : `model` remplace par `config` (JSON string) avec parsing
- [x] DB init : plus de double connexion SQLite, `createTables` appele au premier `getDb()`
- [x] Liens sidebar vers pages inexistantes retires (Activity, Settings)

### Duplication eliminee
- [x] Try/catch boilerplate dans les API routes -> `handler()` / `resourceHandler()`
- [x] Field whitelist dans PATCH routes -> `pickFields()`
- [x] Status labels/variants dupliques -> centralises dans `lib/types.ts`
- [x] Classes CSS d'input dupliquees -> composants `Input` / `Textarea`
- [x] Pattern fetch-on-mount duplique -> hook `useApi`
- [x] Pattern POST form duplique -> `apiPost`

---

## Phase 2 - Execution (F05-F06) - DONE

### F05 - Spawn Claude CLI
- [x] Claude CLI adapter (spawn, stream-json parsing) — `lib/claude/adapter.ts`
- [x] Args builder — `lib/claude/args-builder.ts`
- [x] Stream-json parser — `lib/claude/parser.ts`
- [x] Agent runner (orchestration du run complet) — `lib/claude/agent-runner.ts`
- [x] Sauvegarde des events en DB via run-service
- [x] Emission WebSocket temps reel via broadcast
- [x] Gestion fin de run (succes, echec, timeout, stopped)
- [x] Persistance session ID (capture depuis event system/init)
- [x] API Routes : POST /api/runs/start, POST /api/runs/:id/stop, POST /api/runs/:id/restart
- [x] Support MOCK_CLAUDE env var pour les tests

### F06 - Live view
- [x] WebSocket server sur port 4201 — `lib/ws/server.ts`
- [x] Instrumentation Next.js pour demarrage auto du WS — `instrumentation.ts`
- [x] Hook useWebSocket avec reconnexion auto — `hooks/use-websocket.ts`
- [x] Page /runs avec liste de tous les runs
- [x] Page /runs/:id avec flux en direct (Live View)
- [x] Composant RunEvent avec rendu par type — `components/runs/run-event.tsx`
- [x] Auto-scroll avec detection de remontee manuelle
- [x] Indicateur Live + WS connected
- [x] Types d'events visuellement distincts (system=bleu, thinking=gris, tool=jaune, assistant=vert, result=indigo, error=rouge)
- [x] Boutons Stop / Restart dans la Live View
- [x] Metriques (tokens, cout) affichees en fin de run
- [x] Page feature detail enrichie avec section Runs + formulaire Start Run
- [x] Navigation Runs ajoutee dans la sidebar

---

## Phase 3 - Orchestrateur (F07-F10) - A FAIRE

### F07 - Orchestrateur
### F08 - Serveur MCP interne
### F09 - Heartbeat scheduler
### F10 - Wakeup manuel

---

## Phase 4 - Controle (F11-F12) - A FAIRE

### F11 - Stop/restart agents
### F12 - Messages utilisateur

---

## Phase 5 - Enrichissement (F13-F19) - A FAIRE

### F13-F19 - Skills, dashboard, config, historique, stats, CLI avance
