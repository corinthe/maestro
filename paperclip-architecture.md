# Paperclip Architecture - Analyse du projet

> Source: [github.com/paperclipai/paperclip](https://github.com/paperclipai/paperclip)

## Vue d'ensemble

Paperclip est une plateforme open-source d'**orchestration pour entreprises autonomes pilotées par IA**. Elle fournit un serveur Node.js et une UI React qui coordonnent plusieurs agents IA vers des objectifs business. Si les agents individuels (Claude, Codex, Cursor...) sont des employes, Paperclip est **l'entreprise elle-même** : organigrammes, budgets, gouvernance et audit.

**Ce que Paperclip n'est PAS** : un chatbot, un framework d'agent, un workflow builder, un prompt manager, ou un outil mono-agent.

---

## Stack technique

| Composant | Technologie |
|-----------|-------------|
| Runtime | Node.js 20+ |
| Package manager | pnpm 9.15+ (monorepo) |
| Langage | TypeScript |
| Base de données | PostgreSQL (embedded en local, configurable en prod) |
| ORM | Drizzle ORM |
| Frontend | React + Vite |
| Tests | Vitest + Playwright (e2e) |
| Build CLI | esbuild |

---

## Structure du monorepo

```
paperclip/
├── cli/                        # CLI (commande `paperclipai`)
│   └── src/
│       ├── commands/           # Commandes CLI (run, onboard, heartbeat-run, doctor, worktree...)
│       ├── adapters/           # Registre d'adaptateurs cote CLI
│       ├── checks/             # Verifications systeme
│       ├── client/             # Client HTTP vers le serveur
│       ├── config/             # Configuration CLI
│       ├── prompts/            # Templates de prompts
│       └── utils/
├── server/                     # Serveur backend (Express/Fastify)
│   └── src/
│       ├── adapters/           # Adaptateurs d'execution (process/, http/)
│       │   ├── process/        # Execution par spawn de processus (Claude CLI, etc.)
│       │   ├── http/           # Execution par appels HTTP (OpenClaw gateway, etc.)
│       │   ├── registry.ts     # Registre central des adaptateurs
│       │   └── types.ts
│       ├── services/           # ~66 services metier
│       │   ├── agents.ts       # CRUD agents, organigramme, budget
│       │   ├── heartbeat.ts    # Scheduler de taches autonomes
│       │   ├── companies.ts    # Multi-tenant
│       │   ├── goals.ts        # Alignement objectifs
│       │   ├── approvals.ts    # Workflow d'approbation
│       │   ├── costs.ts        # Tracking des couts
│       │   ├── plugin-*.ts     # Infrastructure plugins (~20 fichiers)
│       │   ├── workspace-*.ts  # Gestion des workspaces d'execution
│       │   └── ...
│       ├── routes/             # 25 routes API REST
│       ├── auth/               # Authentification
│       ├── middleware/
│       ├── realtime/           # Events temps reel (SSE/WebSocket)
│       ├── secrets/            # Gestion des secrets
│       └── storage/
├── packages/
│   ├── adapters/               # Adaptateurs par provider IA
│   │   ├── claude-local/       # ** Adaptateur Claude Code **
│   │   ├── codex-local/        # OpenAI Codex
│   │   ├── cursor-local/       # Cursor
│   │   ├── gemini-local/       # Google Gemini
│   │   ├── openclaw-gateway/   # OpenClaw (HTTP)
│   │   ├── opencode-local/     # OpenCode
│   │   └── pi-local/           # Pi
│   ├── adapter-utils/          # Utilitaires partages entre adaptateurs
│   ├── db/                     # Schema DB + migrations (Drizzle)
│   ├── plugins/                # Systeme de plugins
│   │   ├── sdk/                # SDK pour developper des plugins
│   │   ├── create-paperclip-plugin/  # Scaffolding
│   │   └── examples/
│   └── shared/                 # Types et utilitaires partages
├── ui/                         # Frontend React (dashboard mobile-ready)
├── docs/                       # Documentation (Mintlify)
├── evals/                      # Evaluations (promptfoo)
├── docker/                     # Configuration Docker
├── scripts/                    # Scripts utilitaires
├── tests/                      # Tests e2e
├── .claude/skills/             # Skills Claude Code
└── .agents/skills/             # Skills agents
```

---

## Architecture des adaptateurs

L'architecture repose sur un **pattern Adapter** qui abstrait chaque provider IA derrière une interface unifiée `ServerAdapterModule` :

```
interface ServerAdapterModule {
  type: string;              // ex: "claude_local"
  execute: Function;         // Execute une tache
  models: Model[];           // Modeles disponibles
  listModels?: Function;     // Decouverte dynamique
  testEnvironment: Function; // Test de l'environnement
  sessionCodec: AdapterSessionCodec; // Serialisation de session
}
```

Le **registre** (`server/src/adapters/registry.ts`) mappe chaque type d'adaptateur vers son implémentation. Les adaptateurs inconnus tombent sur l'adaptateur `process` générique.

### Deux modes d'exécution

| Mode | Dossier | Usage |
|------|---------|-------|
| **Process** | `server/src/adapters/process/` | Spawn d'un processus local (Claude CLI, Codex, Cursor...) |
| **HTTP** | `server/src/adapters/http/` | Appel à un gateway distant (OpenClaw) |

---

## Interaction avec Claude CLI - En detail

C'est le coeur de la question. Voici comment Paperclip orchestre Claude Code :

### 1. Le package `claude-local` (`packages/adapters/claude-local/`)

Structure interne :
```
claude-local/src/
├── index.ts          # Metadata: type="claude_local", label, modeles supportes
├── cli/
│   ├── index.ts      # Re-exporte printClaudeStreamEvent
│   ├── format-event.ts   # Affichage formate des events Claude en CLI
│   └── quota-probe.ts    # Sonde de quota
├── server/
│   ├── index.ts      # Barrel exports
│   ├── execute.ts    # ** EXECUTION PRINCIPALE **
│   ├── parse.ts      # Parsing du flux JSON de Claude
│   ├── quota.ts      # Gestion quotas et auth
│   ├── skills.ts     # Synchronisation des skills
│   └── test.ts       # Test d'environnement
└── ui/               # Composants UI specifiques
```

### 2. Configuration d'un agent Claude

Un agent Claude dans Paperclip est configure avec ces champs :

| Champ | Description |
|-------|-------------|
| `command` | Commande a exécuter (défaut: `"claude"`) |
| `cwd` | Répertoire de travail |
| `model` | ID du modèle (`claude-opus-4-6`, `claude-sonnet-4-6`, etc.) |
| `effort` | Effort de raisonnement (`low`, `medium`, `high`) |
| `maxTurnsPerRun` | Nombre max de tours par exécution |
| `dangerouslySkipPermissions` | Passe `--dangerously-skip-permissions` |
| `chrome` | Active le flag `--chrome` |
| `instructionsFilePath` | Fichier markdown d'instructions |
| `promptTemplate` | Template du prompt d'exécution |
| `extraArgs` | Arguments CLI supplémentaires |
| `env` | Variables d'environnement |
| `timeoutSec` | Timeout d'exécution |
| `graceSec` | Delai de grace avant SIGTERM |
| `workspaceStrategy` | Stratégie workspace (ex: `git_worktree`) |

### 3. Flux d'exécution (`execute.ts`)

```
Heartbeat/UI trigger
        │
        ▼
┌─────────────────────┐
│ buildClaudeRuntimeConfig() │  ← Construit la config d'execution
│  - command + args          │
│  - working directory       │
│  - env vars                │
│  - timeout/grace           │
│  - skills directory        │
└───────────┬─────────────────┘
            │
            ▼
┌─────────────────────┐
│ buildSkillsDir()           │  ← Cree un repertoire .claude/skills/
│  - symlinks vers skills    │     temporaire avec les skills Paperclip
│  - flag --add-dir          │
└───────────┬─────────────────┘
            │
            ▼
┌─────────────────────────────┐
│ Construction des args CLI          │
│  claude --model <model>            │
│         --effort <effort>          │
│         --max-turns <N>            │
│         --output-format stream-json│
│         --print conversation       │
│         --add-dir <skills-dir>     │
│         --dangerously-skip-perms?  │
│         --chrome?                  │
│         --resume <session-id>?     │
│         -p "<prompt>"              │
└───────────┬─────────────────────────┘
            │
            ▼
┌─────────────────────────┐
│ runChildProcess()              │  ← Spawn du processus Claude CLI
│  (server/src/adapters/process) │     via child_process
│  - capture stdout/stderr       │
│  - timeout management          │
│  - graceful shutdown           │
└───────────┬─────────────────────┘
            │
            ▼
┌──────────────────────────┐
│ parseClaudeStreamJson()         │  ← Parse le flux JSON ligne par ligne
│  - events: system/init          │
│  - events: assistant (text,     │
│    thinking, tool_use)          │
│  - events: result               │
│  → Extrait: sessionId, model,   │
│    costUsd, usage, summary      │
└───────────┬──────────────────────┘
            │
            ▼
┌──────────────────────┐
│ Gestion des erreurs         │
│  - Login requis?            │
│  - Session inconnue?        │
│  - Max turns atteint?       │
│  - Timeout?                 │
│  → Retry avec fallback      │
└─────────────────────────────┘
```

### 4. Parsing du flux JSON Claude (`parse.ts`)

Claude CLI est invoque avec `--output-format stream-json`. Chaque ligne de stdout est un objet JSON. Le parser traite 3 types d'events :

- **`system` (subtype `init`)** : Capture le `session_id` et le `model`
- **`assistant`** : Extrait les blocs `text` du contenu du message
- **`result`** : Extrait les métriques finales (`input_tokens`, `output_tokens`, `cache_read_input_tokens`, `total_cost_usd`) et le `result` textuel

### 5. Gestion des sessions (résumé)

Paperclip maintient la **continuite des sessions** Claude entre les heartbeats :

1. Le `sessionCodec` sérialise/desérialise les paramêtres de session (`sessionId`, `cwd`, `workspaceId`, `repoUrl`, `repoRef`)
2. Le heartbeat scheduler utilise `resolveSessionBeforeForWakeup()` pour retrouver la session précédente d'un agent pour une tâche donnée
3. Claude est relancé avec `--resume <session-id>` pour reprendre la conversation
4. En cas d'erreur "unknown session", Paperclip retente sans résumé (nouvelle session)

### 6. Gestion des skills

Les **skills** sont des instructions/capacités injectées dans Claude au runtime :

1. `syncClaudeSkills()` scanne les skills disponibles dans le runtime Paperclip
2. `buildSkillsDir()` crée un répertoire temporaire `.claude/skills/` avec des symlinks
3. Le flag `--add-dir <skills-dir>` permet a Claude Code de découvrir ces skills
4. Après exécution, le répertoire temporaire est nettoye

### 7. Gestion des quotas et authentification (`quota.ts`)

Deux modes d'authentification sont supportés :

| Mode | Détection | Mécanisme |
|------|-----------|-----------|
| **API Key** | `ANTHROPIC_API_KEY` present | Auth directe via clé API |
| **OAuth/Login** | Pas de clé API | `claude login` + session locale |

La surveillance des quotas suit une stratégie de fallback :

1. **OAuth** : Lecture du token dans le config dir Claude → appel `api.anthropic.com/api/oauth/usage`
2. **CLI fallback** : Injection de la commande `/usage` dans Claude CLI → parsing de la sortie terminal (avec nettoyage des codes ANSI)

### 8. Affichage CLI (`format-event.ts`)

Pour le mode CLI (`heartbeat-run`), les events JSON de Claude sont formatés avec `picocolors` :

- `system/init` → bleu : modèle et session ID
- `assistant/text` → vert : réponses de l'agent
- `assistant/thinking` → gris : raisonnement
- `assistant/tool_use` → jaune : appels d'outils
- `tool_result` → cyan (ou rouge si erreur)
- `result` → vert (texte) + bleu (tokens/cout)

---

## Système de heartbeat (scheduler autonome)

Le heartbeat est le mécanisme qui rend les agents **autonomes** :

1. **Cron/scheduler** déclenche un "wakeup" pour un agent
2. Le serveur vérifie le budget, le statut, et la concurrence (`maxConcurrentRuns` : 1-10)
3. Un "run" est crée en statut `queued` puis passé a `running`
4. Le workspace est resolu (projet, worktree git, ou home de l'agent)
5. La session Claude précédente est recherchee pour résumé
6. L'adaptateur `execute()` est appele (spawn du processus)
7. Les events (stdout, stderr, status) sont loggués en temps réel
8. Au terme, le run passé en `succeeded`, `failed`, `cancelled`, ou `timed_out`

Le CLI `heartbeat-run` permet de suivre ce processus en polling (toutes les 200ms) via l'API `/api/heartbeat-runs/{id}/events`.

---

## Gestion multi-tenant et organisationnelle

- **Multi-company** : isolation complété des données par entreprise
- **Organigramme** : hiérarchie manager/subordonné avec détection de cyclés (max 50 niveaux)
- **Budgets** : suivi mensuel des coûts par agent avec pause automatique en cas de dépassement
- **Approbations** : workflow d'approbation avant certaines actions
- **Audit** : logs d'activité immutables

---

## Workspaces d'exécution

Paperclip supporte plusieurs stratégies de workspace pour isoler les exécutions :

- **Répertoire projet** : exécution dans le repo du projet
- **Git worktree** : creation de worktrees git isolés (`workspaceStrategy: { type: "git_worktree" }`)
- **Fallback home** : répertoire home de l'agent

Des variables d'environnement `PAPERCLIP_WORKSPACE_*` et `PAPERCLIP_RUNTIME_*` sont injectées pour que l'agent puisse accéder au contexte.

---

## Système de plugins

Architecture complété avec :
- **SDK** (`packages/plugins/sdk/`) pour développer des plugins
- **Scaffolding** (`create-paperclip-plugin`) pour démarrer rapidement
- **Runtime sandbox** pour l'isolation
- **Event bus** pour la communication inter-plugins
- **Job coordinator** pour les tâches asynchrones

---

## Résumé : Comment Paperclip utilise Claude CLI

```
┌────────────┐     ┌──────────────┐     ┌─────────────────┐
│  UI / API  │────▶│  Heartbeat   │────▶│ Adapter Registry │
│  Trigger   │     │  Scheduler   │     │  (claude_local)  │
└────────────┘     └──────────────┘     └────────┬────────┘
                                                  │
                                    ┌─────────────▼──────────────┐
                                    │  claude-local/execute.ts    │
                                    │  1. Build runtime config    │
                                    │  2. Prepare skills dir      │
                                    │  3. Construct CLI args      │
                                    │  4. Set env vars            │
                                    └─────────────┬──────────────┘
                                                  │
                                    ┌─────────────▼──────────────┐
                                    │  process/execute.ts         │
                                    │  child_process.spawn(       │
                                    │    "claude",                │
                                    │    [...args],               │
                                    │    { cwd, env, timeout }    │
                                    │  )                          │
                                    └─────────────┬──────────────┘
                                                  │
                                    ┌─────────────▼──────────────┐
                                    │  Claude CLI Process         │
                                    │  --output-format stream-json│
                                    │  stdout → JSON events       │
                                    └─────────────┬──────────────┘
                                                  │
                                    ┌─────────────▼──────────────┐
                                    │  parse.ts                   │
                                    │  → sessionId, cost, usage   │
                                    │  → summary text             │
                                    │  → error detection          │
                                    └─────────────────────────────┘
```

En résumé, Paperclip interagit avec Claude Code **exclusivement via le CLI** en le spawnant comme processus fils. Il utilise le format `stream-json` pour parser la sortie en temps réel, maintient la continuite des sessions via `--resume`, injecté des skills via `--add-dir`, et surveille les quotas soit par OAuth soit par scraping de la commande `/usage`.
