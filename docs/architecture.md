# Maestro - Architecture générale

## Vision

Maestro est un orchestrateur de projet IA, installé dans un repo git, qui pilote une équipe d'agents Claude Code pour réaliser des features. Un **orchestrateur** (lui-même un agent Claude) coordonne le travail : il planifie, délègue aux agents, et s'assure qu'ils ne se marchent pas dessus. L'interface web inspirée de Linear permet de suivre tout en temps réel.

**Un Maestro = un repo git.**

## Principes directeurs

- **UI-first** : l'interface web est le point d'entrée principal, la CLI sert à l'initialisation et aux opérations ponctuelles
- **Claude-only (MVP)** : un seul backend d'agent, Claude CLI, pour garder la complexité basse
- **Local-first** : tout tourne sur la machine du développeur, pas de serveur distant
- **Convention over configuration** : defaults intelligents, `--dangerously-skip-permissions` par défaut, configuration optionnelle
- **Observable** : le développeur voit ce que chaque agent fait en temps réel, à tout moment
- **Orchestrateur central** : les agents ne se coordonnent pas entre eux, c'est l'orchestrateur qui délègue et sérialise le travail

## Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────┐
│                        Navigateur                               │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   UI Next.js + shadcn                     │  │
│  │  Dashboard │ Agents │ Features │ Activity │ Skills/Config │  │
│  └──────────────────────────┬────────────────────────────────┘  │
└─────────────────────────────┼───────────────────────────────────┘
                              │ HTTP + WebSocket
┌─────────────────────────────┼───────────────────────────────────┐
│                    Serveur Next.js (local)                       │
│                             │                                   │
│  ┌──────────────────────────┴────────────────────────────────┐  │
│  │                    API Routes (Next.js)                    │  │
│  │  /api/agents  /api/features  /api/runs  /api/skills  ...  │  │
│  └──────┬────────────┬──────────────┬────────────────────────┘  │
│         │            │              │                            │
│  ┌──────┴──────┐ ┌───┴────┐ ┌──────┴──────┐                    │
│  │   Agent     │ │ Skills │ │  Heartbeat  │                    │
│  │   Manager   │ │ Store  │ │  Scheduler  │                    │
│  └──────┬──────┘ └────────┘ └──────┬──────┘                    │
│         │                          │                            │
│  ┌──────┴──────┐            ┌──────┴──────┐                    │
│  │  Claude CLI │            │Orchestrator │                    │
│  │  Adapter    │◄───────────│  (Claude)   │                    │
│  │             │  MCP tools │             │                    │
│  └──────┬──────┘            └─────────────┘                    │
│         │                                                       │
│  ┌──────┴──────┐                                               │
│  │   Stream    │                                               │
│  │   Parser    │                                               │
│  └─────────────┘                                               │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ MCP Server (interne)                                     │  │
│  │ Outils: list_features, get_project_context,              │  │
│  │   assign_task, get_agent_status, propose_agent...        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  SQLite (better-sqlite3)                  │  │
│  │  agents │ features │ runs │ run_events │ skills │ config  │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴──────────┐
                    │   Repo Git local    │
                    │  ├── .maestro/      │
                    │  │   ├── config.yml │
                    │  │   ├── agents/    │
                    │  │   ├── skills/    │
                    │  │   └── db.sqlite  │
                    │  ├── src/           │
                    │  └── ...            │
                    └────────────────────┘
```

## Modules

Le système est découpé en **9 modules** :

| Module | Responsabilité | Document |
|--------|---------------|----------|
| **CLI** | Initialisation (`npx maestro init`), lancement du serveur, commandes utilitaires | [cli.md](modules/cli.md) |
| **Server / API** | API Routes Next.js, MCP server interne, WebSocket temps réel | [server.md](modules/server.md) |
| **UI** | Interface web Next.js + shadcn, style Linear | [ui.md](modules/ui.md) |
| **Orchestrator** | Agent Claude qui coordonne les agents, délègue le travail, fournit le contexte | [orchestrator.md](modules/orchestrator.md) |
| **Agents** | Gestion du cycle de vie des agents worker, configuration, spawn Claude CLI | [agents.md](modules/agents.md) |
| **Skills & Prompts** | Bibliothèque de skills au format natif Claude Code, partage via registre | [skills.md](modules/skills.md) |
| **Database** | SQLite embarqué, schema, migrations | [database.md](modules/database.md) |
| **Heartbeat** | Scheduler autonome, réveille l'orchestrateur | [heartbeat.md](modules/heartbeat.md) |
| **Testing** | Stratégie de tests, mock Claude CLI | [testing.md](modules/testing.md) |

## Structure du repo (après `npx maestro init`)

```
mon-projet/
├── .maestro/                    # Repertoire Maestro (gitignore partiel)
│   ├── config.yml               # Configuration globale (versionne)
│   ├── agents/                  # Definitions d'agents (versionne)
│   │   ├── backend-dev.yml
│   │   └── frontend-dev.yml
│   ├── skills/                  # Skills au format Claude Code (versionne)
│   │   ├── code-review.md
│   │   └── testing-strategy.md
│   └── db.sqlite                # Base de donnees locale (gitignore)
├── .gitignore                   # Mis a jour par maestro init
├── src/
└── ...
```

## Flux de données principal

```
Utilisateur             UI                 API            Orchestrateur        Agent Worker
    │                   │                   │                   │                    │
    │ Cree feature      │                   │                   │                    │
    ├──────────────────>│                   │                   │                    │
    │                   │ POST /api/features│                   │                    │
    │                   ├──────────────────>│                   │                    │
    │                   │                   │ (feature creee)   │                    │
    │                   │                   │                   │                    │
    │                   │           Heartbeat tick              │                    │
    │                   │                   ├──────────────────>│                    │
    │                   │                   │  spawn orchestr.  │                    │
    │                   │                   │  avec MCP tools   │                    │
    │                   │                   │                   │                    │
    │                   │                   │  list_features()  │                    │
    │                   │                   │<──────────────────│                    │
    │                   │                   │  [feature MAE-1]  │                    │
    │                   │                   ├──────────────────>│                    │
    │                   │                   │                   │                    │
    │                   │                   │  get_context()    │                    │
    │                   │                   │<──────────────────│                    │
    │                   │                   │  {files, deps...} │                    │
    │                   │                   ├──────────────────>│                    │
    │                   │                   │                   │                    │
    │                   │                   │  assign_task(     │                    │
    │                   │                   │   agent,feature,  │                    │
    │                   │                   │   context,prompt) │                    │
    │                   │                   │<──────────────────│                    │
    │                   │                   │                   │                    │
    │                   │                   │  Spawn agent      │                    │
    │                   │                   ├─────────────────────────────────────>│
    │                   │                   │                   │  claude CLI run   │
    │                   │  WebSocket events │                   │  stream-json     │
    │                   │<──────────────────│<────────────────────────────────────│
    │ Voit l'activite   │                   │                   │                    │
    │<──────────────────│                   │                   │                    │
    │                   │                   │                   │                    │
    │ Envoie message    │                   │                   │                    │
    │ (entre deux runs) │ POST message      │                   │                    │
    ├──────────────────>├──────────────────>│ (stocke pour le   │                    │
    │                   │                   │  prochain run)    │                    │
```

## Technologies choisies

| Besoin | Choix | Raison |
|--------|-------|--------|
| Framework web | Next.js 15 (App Router) | UI + API dans un seul process, SSR, bon DX |
| Composants UI | shadcn/ui + Tailwind | Minimaliste, personnalisable, pas de runtime |
| Base de données | SQLite via better-sqlite3 | Zero config, embarqué, performant en local |
| ORM | Drizzle ORM | Type-safe, léger, supporte SQLite |
| Temps réel | WebSocket (ws) | Bidirectionnel, nécessaire pour interactions utilisateur |
| Process management | Node.js child_process | Spawn natif de Claude CLI |
| Orchestrateur ↔ Maestro | MCP Server (interne) | L'orchestrateur utilise des outils MCP pour interagir avec Maestro |
| Package manager | pnpm | Standard monorepo |

## Décisions d'architecture

### Pourquoi un orchestrateur et pas un dispatch direct ?

L'orchestrateur est lui-même un agent Claude qui comprend le projet, les agents disponibles, et le travail à faire. Avantages :
- Il peut **raisonner** sur la meilleure façon de découper le travail
- Il **sérialise** les tâches pour éviter les conflits (deux agents sur le même fichier)
- Il **fournit le contexte** nécessaire à chaque agent
- Il peut **proposer** de nouveaux archetypes d'agents à l'utilisateur
- Il est **extensible** : ses capacités évoluent avec les outils MCP qu'on lui donne

### Pourquoi pas de worktrees ?

L'orchestrateur sérialise le travail des agents. Un seul agent travaille à la fois sur le repo (ou sur des zones disjointes). Les worktrees ajoutent de la complexité (merge, conflits) sans bénéfice si la coordination est bien faite. On pourra les ajouter plus tard si le besoin de concurrence parallèle se confirme.

### Pourquoi Next.js et pas un serveur séparé + SPA ?

Un seul process simplifie énormément l'installation locale. `npx maestro init` installe tout, `npx maestro dev` lance le serveur qui sert à la fois l'UI et l'API. Pas de coordination entre deux processes.

### Pourquoi SQLite et pas PostgreSQL ?

Maestro est local-first, un par repo. SQLite est zero-config, ne nécessite aucun daemon, et les performances sont plus que suffisantes pour un usage solo. Le fichier `.maestro/db.sqlite` est simplement gitignore.

### Pourquoi WebSocket et pas SSE ?

L'utilisateur doit pouvoir interagir avec le système en temps réel (stopper un agent, envoyer un message entre deux runs). WebSocket permet la communication bidirectionnelle nécessaire.

### Pourquoi `--dangerously-skip-permissions` par défaut ?

Maestro est un outil de développement local. L'utilisateur fait confiance à ses agents pour modifier le code. La friction des permissions ralentirait significativement le travail autonome. Ce choix peut être désactivé par agent dans la configuration. Des garde-fous supplémentaires seront ajoutés post-MVP.
