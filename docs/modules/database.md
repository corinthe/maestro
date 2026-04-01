# Module Database

## Responsabilité

Persistance locale de toutes les données de Maestro via SQLite embarqué. Zero configuration, zero daemon externe.

## Choix technique

- **SQLite** via `better-sqlite3` : synchrone, rapide, fiable, un seul fichier
- **Drizzle ORM** : type-safe, léger, migrations déclaratives
- **Emplacement** : `.maestro/db.sqlite` (gitignore)

## Schema

### Table `agents`

Stocke la configuration des agents (source de verite : fichiers YAML, la DB est un cache enrichi avec l'état runtime).

```sql
CREATE TABLE agents (
  id            TEXT PRIMARY KEY,     -- UUID
  name          TEXT NOT NULL UNIQUE, -- Nom unique (slug)
  description   TEXT,
  config        TEXT NOT NULL,        -- JSON de la config complete
  status        TEXT NOT NULL DEFAULT 'idle',  -- idle | running | stopped
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
```

### Table `features`

Les features/taches à réaliser.

```sql
CREATE TABLE features (
  id            TEXT PRIMARY KEY,     -- UUID
  key           TEXT NOT NULL UNIQUE, -- Cle lisible (MAE-1, MAE-2...)
  title         TEXT NOT NULL,
  description   TEXT,
  status        TEXT NOT NULL DEFAULT 'backlog',  -- backlog | in_progress | done | cancelled
  agent_id      TEXT REFERENCES agents(id),       -- Agent assigne (par l'orchestrateur)
  branch        TEXT,                 -- Branche git
  priority      INTEGER DEFAULT 0,   -- Priorite (pour l'ordre dans la queue)
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
```

### Table `runs`

Chaque exécution d'un agent ou de l'orchestrateur.

```sql
CREATE TABLE runs (
  id            TEXT PRIMARY KEY,     -- UUID
  agent_id      TEXT REFERENCES agents(id),       -- NULL pour les runs orchestrateur
  feature_id    TEXT REFERENCES features(id),      -- NULL pour les runs orchestrateur
  run_type      TEXT NOT NULL DEFAULT 'agent',     -- 'agent' | 'orchestrator'
  status        TEXT NOT NULL DEFAULT 'queued',    -- queued | running | succeeded | failed | stopped | timed_out
  session_id    TEXT,                 -- Session Claude CLI (pour resume)
  prompt        TEXT,                 -- Prompt envoye a Claude
  summary       TEXT,                 -- Resume du resultat
  model         TEXT,                 -- Modele utilise
  input_tokens  INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cached_tokens INTEGER DEFAULT 0,
  cost_usd      REAL DEFAULT 0,
  exit_code     INTEGER,
  pid           INTEGER,             -- PID du processus (pour detection orphelins)
  started_at    TEXT,
  finished_at   TEXT,
  created_at    TEXT NOT NULL
);

CREATE INDEX idx_runs_status ON runs(status);
CREATE INDEX idx_runs_agent ON runs(agent_id);
CREATE INDEX idx_runs_type ON runs(run_type);
```

### Table `run_events`

Tous les events d'un run (flux stream-json de Claude). **Purges après 24h.**

```sql
CREATE TABLE run_events (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id        TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  seq           INTEGER NOT NULL,     -- Numero de sequence dans le run
  type          TEXT NOT NULL,        -- system | assistant | user | result
  subtype       TEXT,                 -- init, text, tool_use, tool_result, thinking...
  data          TEXT NOT NULL,        -- JSON de l'event complet
  created_at    TEXT NOT NULL
);

CREATE INDEX idx_run_events_run_seq ON run_events(run_id, seq);
CREATE INDEX idx_run_events_created ON run_events(created_at);
```

### Table `skills`

Metadonnées des skills (le contenu est dans les fichiers `.md`).

```sql
CREATE TABLE skills (
  id            TEXT PRIMARY KEY,     -- UUID
  name          TEXT NOT NULL UNIQUE, -- Nom du fichier (sans .md)
  file_path     TEXT NOT NULL,        -- Chemin relatif dans .maestro/skills/
  checksum      TEXT,                 -- Hash du contenu pour detecter les modifs externes
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
```

### Table `agent_skills`

Relation many-to-many agents <-> skills.

```sql
CREATE TABLE agent_skills (
  agent_id      TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  skill_id      TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  PRIMARY KEY (agent_id, skill_id)
);
```

### Table `sessions`

Sessions Claude pour le résumé (orchestrateur et agents).

```sql
CREATE TABLE sessions (
  id            TEXT PRIMARY KEY,     -- UUID
  owner_type    TEXT NOT NULL,        -- 'agent' | 'orchestrator'
  agent_id      TEXT REFERENCES agents(id),
  feature_id    TEXT REFERENCES features(id),
  claude_session_id TEXT NOT NULL,    -- ID de session Claude CLI
  last_run_id   TEXT REFERENCES runs(id),
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE INDEX idx_sessions_agent_feature ON sessions(agent_id, feature_id);
CREATE INDEX idx_sessions_owner ON sessions(owner_type);
```

### Table `messages`

Messages de l'utilisateur en attente (lus par l'orchestrateur au prochain réveil).

```sql
CREATE TABLE messages (
  id            TEXT PRIMARY KEY,     -- UUID
  content       TEXT NOT NULL,        -- Contenu du message
  target_agent  TEXT REFERENCES agents(id),  -- Agent cible (optionnel)
  feature_id    TEXT REFERENCES features(id), -- Feature concernee (optionnel)
  status        TEXT NOT NULL DEFAULT 'pending',  -- pending | read
  created_at    TEXT NOT NULL,
  read_at       TEXT
);
```

### Table `proposals`

Propositions d'agents par l'orchestrateur.

```sql
CREATE TABLE proposals (
  id            TEXT PRIMARY KEY,     -- UUID
  name          TEXT NOT NULL,        -- Nom propose pour l'agent
  description   TEXT NOT NULL,
  model         TEXT NOT NULL,
  instructions  TEXT NOT NULL,
  skills        TEXT,                 -- JSON array de skill names
  rationale     TEXT NOT NULL,        -- Justification de l'orchestrateur
  status        TEXT NOT NULL DEFAULT 'pending',  -- pending | accepted | rejected
  created_at    TEXT NOT NULL,
  resolved_at   TEXT
);
```

### Table `config`

Configuration globale (key-value).

```sql
CREATE TABLE config (
  key           TEXT PRIMARY KEY,
  value         TEXT NOT NULL
);
```

## Migrations

Drizzle gère les migrations de schema de manière déclarative :

```
lib/
└── db/
    ├── index.ts            # Initialisation de la connexion
    ├── schema.ts           # Schema Drizzle (source de verite)
    └── migrations/         # Migrations generees
        ├── 0000_init.sql
        └── ...
```

Les migrations sont exécutées automatiquement au démarrage du serveur.

## Synchronisation fichiers <-> DB

Les agents et skills existent à la fois comme fichiers (`.maestro/agents/*.yml`, `.maestro/skills/*.md`) et en DB. La regle :

- **Fichiers = source de verite** pour la configuration
- **DB = source de verite** pour l'état runtime (status, sessions, runs)
- Au démarrage, Maestro synchronise les fichiers vers la DB (ajout, mise à jour, suppression)
- Les modifications via l'UI ecrivent d'abord le fichier, puis mettent à jour la DB

## Rétention des données

| Table | Rétention |
|-------|-----------|
| `run_events` | **24 heures** — purge automatique par le heartbeat |
| `runs` | Indéfini — conservés pour historique et stats de coût |
| `messages` | Indéfini — marqués comme `read` après traitement |
| `proposals` | Indéfini — marqués comme `accepted` ou `rejected` |
| Toutes les autres | Indéfini |

## Volumétrie attendue

En usage solo :

| Table | Volume typique |
|-------|---------------|
| agents | 2-5 lignes |
| features | 10-50 lignes |
| runs | 100-500 lignes |
| run_events | < 50k lignes (grace à la purge 24h) |
| skills | 5-20 lignes |
| messages | < 100 lignes |
| proposals | < 20 lignes |
