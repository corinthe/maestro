# Maestro

Orchestrateur de projet IA, local-first, qui pilote une equipe d'agents [Claude Code](https://docs.anthropic.com/en/docs/claude-code) depuis une interface web style Linear.

**Un Maestro = un repo git.** Vous creez des features (comme des tickets), assignez des agents IA, et Maestro orchestre leur execution en autonomie — avec suivi en temps reel via WebSocket.

## Prerequis

- **Node.js** >= 18
- **pnpm** >= 8
- **Claude CLI** installe et authentifie (`claude --version`)
- Un **repo git** initialise

## Demarrage rapide

### 1. Cloner et installer

```bash
git clone <url-du-repo>
cd maestro
pnpm install
```

### 2. Initialiser Maestro dans votre projet

```bash
pnpm cli init
```

Cela cree un dossier `.maestro/` dans votre repo contenant la base SQLite et la configuration locale.

### 3. Lancer le serveur de developpement

```bash
pnpm dev
```

L'interface est accessible sur [http://localhost:4200](http://localhost:4200). Un serveur WebSocket demarre en parallele sur le port 4201 pour les mises a jour en temps reel.

## Utilisation

### Creer des features

Les **features** sont l'equivalent de tickets ou d'issues. Depuis l'UI (`/features`) ou via l'API :

1. Cliquez sur **"New Feature"**
2. Donnez un titre et une description (le prompt pour l'agent)
3. La feature est creee en statut `backlog`

Statuts disponibles : `backlog` → `in_progress` → `done` / `cancelled`

### Configurer des agents

Les **agents** sont des instances de Claude Code. Depuis l'UI (`/agents`) :

1. Cliquez sur **"New Agent"**
2. Nommez l'agent et configurez-le (modele, effort, etc.)
3. L'agent est cree en statut `idle`, pret a recevoir du travail

Chaque agent peut etre stoppe ou reinitialise depuis sa carte dans l'interface.

### Lancer l'orchestrateur

L'**orchestrateur** est le cerveau de Maestro. Il assigne automatiquement les features `backlog` aux agents disponibles et lance les runs.

- **Demarrer** : `POST /api/orchestrator/wake` ou via le bouton dans l'UI
- **Arreter** : `POST /api/orchestrator/stop`
- **Statut** : `GET /api/orchestrator/status`

L'orchestrateur tourne avec un heartbeat configurable qui verifie periodiquement s'il y a du travail a distribuer.

### Suivre l'execution en temps reel

Quand un agent travaille sur une feature, un **run** est cree. Vous pouvez suivre son execution en direct :

1. Allez sur `/runs/<id>`
2. Les evenements Claude (messages, appels d'outils, resultats) s'affichent en streaming
3. Vous pouvez stopper un run a tout moment

### Messagerie

La page **Messages** (`/messages`) fonctionne comme une inbox :

- Envoyez des messages a l'orchestrateur ou lies a une feature
- Filtrez par statut : tous / en attente / lus
- Les messages non lus sont affiches dans le badge de la sidebar

## Commandes

| Commande | Description |
|---|---|
| `pnpm dev` | Lance le serveur Next.js sur le port 4200 |
| `pnpm build` | Build de production (Next.js + CLI) |
| `pnpm start` | Demarre le serveur de production |
| `pnpm lint` | Verifie le code avec ESLint |
| `pnpm test` | Lance les tests (Vitest) |
| `pnpm cli` | Lance le CLI en mode developpement |
| `pnpm db:generate` | Genere les migrations Drizzle |
| `pnpm db:migrate` | Applique les migrations en base |

### CLI

```bash
maestro init     # Initialise Maestro dans le repo courant
maestro dev      # Demarre le serveur de dev (--port pour changer le port)
maestro status   # Affiche le statut courant
maestro wake     # Reveille l'orchestrateur
maestro stop     # Stoppe un agent
```

## API REST

Toutes les reponses suivent le format `{ data: T }` en succes et `{ error: { code, message } }` en erreur.

| Endpoint | Methodes | Description |
|---|---|---|
| `/api/features` | GET, POST | Liste et creation de features |
| `/api/features/[id]` | GET, PATCH, DELETE | Detail, mise a jour, suppression |
| `/api/agents` | GET, POST | Liste et creation d'agents |
| `/api/agents/[id]` | GET, PATCH, DELETE | Detail, mise a jour, suppression |
| `/api/agents/[id]/stop` | POST | Stoppe un agent et ses runs actifs |
| `/api/runs` | GET, POST | Liste et creation de runs |
| `/api/runs/[id]` | GET, PATCH | Detail et mise a jour |
| `/api/messages` | GET, POST | Liste et envoi de messages |
| `/api/messages/[id]` | GET, PATCH, DELETE | Lecture, mark-as-read, suppression |
| `/api/orchestrator/wake` | POST | Reveille l'orchestrateur |
| `/api/orchestrator/stop` | POST | Stoppe l'orchestrateur |
| `/api/orchestrator/status` | GET | Statut de l'orchestrateur |

## Stack technique

- **Next.js 15** (App Router) — UI + API dans un seul process
- **Tailwind v4** + **shadcn/ui** — composants UI
- **SQLite** via **better-sqlite3** — base embarquee dans `.maestro/db.sqlite`
- **Drizzle ORM** — acces type-safe a la base
- **WebSocket** (ws) — mises a jour temps reel (port 4201)
- **Claude CLI** — spawne via `child_process` avec `--output-format stream-json`
- **MCP** — serveur interne exposant les outils Maestro aux agents Claude

## Architecture

```
app/              # Pages et routes API (Next.js App Router)
components/       # Composants React (sidebar, run events, shadcn/ui)
lib/              # Logique metier (services, DB, Claude adapter, orchestrateur, WS)
hooks/            # Hooks React (useApi, useWebSocket)
src/cli/          # CLI (commander)
```

Pour plus de details, voir les [docs d'architecture](docs/architecture.md).

## Licence

Projet prive.
