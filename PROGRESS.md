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
- [x] Navigation : Dashboard, Features, Agents, Activity
- [x] Design system : palette indigo, fond #FAFAFA, cartes blanches
- [x] Composants UI : Badge, Button (variants + tailles)
- [x] Dashboard (/) : cartes de stats, sections activite recente et features en cours
- [x] Tailwind v4 avec theme custom (@theme)

### Infrastructure
- [x] Build Next.js reussi (zero erreurs)
- [x] TypeScript strict
- [x] Drizzle ORM configure (schema + init SQL)
- [x] pnpm comme package manager
- [x] Deps : better-sqlite3, drizzle-orm, commander, picocolors, uuid, ws

---

## Phase 2 - Execution (F05-F06) - A FAIRE

### F05 - Spawn Claude CLI
- [ ] Claude CLI adapter (spawn, stream-json parsing)
- [ ] Sauvegarde des events en DB
- [ ] Emission WebSocket temps reel
- [ ] Gestion fin de run (succes, echec, timeout)
- [ ] Persistance session ID

### F06 - Live view
- [ ] WebSocket server
- [ ] Hook useWebSocket
- [ ] Page /runs/:id avec flux en direct
- [ ] Auto-scroll, indicateur Live
- [ ] Types d'events visuellement distincts

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
