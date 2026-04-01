# Maestro - Architecture generale

## Vision

Maestro est un orchestrateur de projet IA, installe dans un repo git, qui pilote une equipe d'agents Claude Code pour realiser des features. Il offre une interface web inspiree de Linear (minimaliste, accents de couleur) et une CLI pour l'initialisation et les operations courantes.

**Un Maestro = un repo git.**

## Principes directeurs

- **UI-first** : l'interface web est le point d'entree principal, la CLI sert a l'initialisation et aux operations ponctuelles
- **Claude-only (MVP)** : un seul backend d'agent, Claude CLI, pour garder la complexite basse
- **Local-first** : tout tourne sur la machine du developpeur, pas de serveur distant
- **Convention over configuration** : defaults intelligents, `--dangerously-skip-permissions` par defaut, configuration optionnelle
- **Observable** : le developpeur voit ce que chaque agent fait en temps reel, a tout moment

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
│  ┌──────┴──────────────────────────┴──────┐                    │
│  │         Claude CLI Adapter              │                    │
│  │  spawn("claude", [...args])             │                    │
│  │  --output-format stream-json            │                    │
│  │  --dangerously-skip-permissions         │                    │
│  └──────┬─────────────┬───────────────────┘                    │
│         │             │                                         │
│  ┌──────┴──────┐ ┌────┴──────┐                                 │
│  │  Worktree   │ │  Stream   │                                 │
│  │  Manager    │ │  Parser   │                                 │
│  └─────────────┘ └───────────┘                                 │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  SQLite (better-sqlite3)                 │   │
│  │  agents │ features │ runs │ run_events │ skills │ config │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴──────────┐
                    │   Repo Git local    │
                    │  ├── .maestro/      │
                    │  │   ├── config.yml │
                    │  │   ├── skills/    │
                    │  │   └── db.sqlite  │
                    │  ├── src/           │
                    │  └── ...            │
                    └────────────────────┘
```

## Modules

Le systeme est decoupe en **7 modules** :

| Module | Responsabilite | Document |
|--------|---------------|----------|
| **CLI** | Initialisation (`npx maestro init`), lancement du serveur, commandes utilitaires | [cli.md](modules/cli.md) |
| **Server / API** | API Routes Next.js, orchestration des services, WebSocket temps reel | [server.md](modules/server.md) |
| **UI** | Interface web Next.js + shadcn, style Linear | [ui.md](modules/ui.md) |
| **Agents** | Gestion du cycle de vie des agents, configuration, spawn Claude CLI, worktrees | [agents.md](modules/agents.md) |
| **Skills & Prompts** | Bibliotheque de skills au format natif Claude Code, partage via registre | [skills.md](modules/skills.md) |
| **Database** | SQLite embarque, schema, migrations | [database.md](modules/database.md) |
| **Heartbeat** | Scheduler autonome, wakeup, surveillance des runs | [heartbeat.md](modules/heartbeat.md) |

## Structure du repo (apres `npx maestro init`)

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
│   ├── db.sqlite                # Base de donnees locale (gitignore)
│   └── worktrees/               # Worktrees git actifs (gitignore)
├── .gitignore                   # Mis a jour par maestro init
├── src/
└── ...
```

## Flux de donnees principal

```
Utilisateur                UI                  API               Agent Manager
    │                      │                    │                      │
    │  Cree une feature    │                    │                      │
    ├─────────────────────>│                    │                      │
    │                      │  POST /api/features│                      │
    │                      ├───────────────────>│                      │
    │                      │                    │  Assigne a un agent  │
    │                      │                    ├─────────────────────>│
    │                      │                    │                      │
    │                      │                    │  Cree un worktree    │
    │                      │                    │  Spawn Claude CLI    │
    │                      │                    │<─────────────────────│
    │                      │                    │                      │
    │                      │   WebSocket events │   stream-json        │
    │                      │<───────────────────│<─────────────────────│
    │  Voit l'activite     │                    │                      │
    │<─────────────────────│                    │                      │
    │                      │                    │                      │
    │  Intervient / aide   │                    │                      │
    ├─────────────────────>│  POST /api/runs/:id/intervene             │
    │                      ├───────────────────>│                      │
    │                      │                    │  Envoie message      │
    │                      │                    ├─────────────────────>│
```

## Technologies choisies

| Besoin | Choix | Raison |
|--------|-------|--------|
| Framework web | Next.js 15 (App Router) | UI + API dans un seul process, SSR, bon DX |
| Composants UI | shadcn/ui + Tailwind | Minimaliste, personnalisable, pas de runtime |
| Base de donnees | SQLite via better-sqlite3 | Zero config, embarque, performant en local |
| ORM | Drizzle ORM | Type-safe, leger, supporte SQLite |
| Temps reel | WebSocket (ws) | Bidirectionnel, necessaire pour intervention utilisateur |
| Process management | Node.js child_process | Spawn natif de Claude CLI |
| Git worktrees | Simple-git ou exec direct | Isolation des agents |
| Package manager | pnpm | Standard monorepo |

## Decisions d'architecture

### Pourquoi Next.js et pas un serveur separe + SPA ?

Un seul process simplifie enormement l'installation locale. `npx maestro init` installe tout, `npx maestro dev` lance le serveur qui sert a la fois l'UI et l'API. Pas de coordination entre deux processes.

### Pourquoi SQLite et pas PostgreSQL ?

Maestro est local-first, un par repo. SQLite est zero-config, ne necessite aucun daemon, et les performances sont plus que suffisantes pour un usage solo. Le fichier `.maestro/db.sqlite` est simplement gitignore.

### Pourquoi WebSocket et pas SSE ?

L'utilisateur doit pouvoir **intervenir** sur un agent en cours d'execution (envoyer un message, stopper, redemarrer). SSE est unidirectionnel. WebSocket permet la communication bidirectionnelle necessaire pour ces interactions.

### Pourquoi `--dangerously-skip-permissions` par defaut ?

Maestro est un outil de developpement local. L'utilisateur fait confiance a ses agents pour modifier le code dans leur worktree isole. La friction des permissions ralentirait significativement le travail autonome des agents. Ce choix peut etre desactive par agent dans la configuration.
