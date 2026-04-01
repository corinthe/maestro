# Module Database

## Responsabilite

Persistance locale de toutes les donnees de Maestro via SQLite embarque. Zero configuration, zero daemon externe.

## Choix technique

- **SQLite** via `better-sqlite3` : synchrone, rapide, fiable, un seul fichier
- **Drizzle ORM** : type-safe, leger, migrations declaratives
- **Emplacement** : `.maestro/db.sqlite` (gitignore)

## Schema

### Table `agents`

Stocke la configuration des agents (source de verite : fichiers YAML, la DB est un cache enrichi avec l'etat runtime).

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

Les features/taches a realiser.

```sql
CREATE TABLE features (
  id            TEXT PRIMARY KEY,     -- UUID
  key           TEXT NOT NULL UNIQUE, -- Cle lisible (MAE-1, MAE-2...)
  title         TEXT NOT NULL,
  description   TEXT,
  status        TEXT NOT NULL DEFAULT 'backlog',  -- backlog | in_progress | done | cancelled
  agent_id      TEXT REFERENCES agents(id),       -- Agent assigne
  branch        TEXT,                 -- Branche git
  priority      INTEGER DEFAULT 0,   -- Priorite (pour l'ordre dans la queue)
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
```

### Table `runs`

Chaque execution d'un agent sur une feature.

```sql
CREATE TABLE runs (
  id            TEXT PRIMARY KEY,     -- UUID
  agent_id      TEXT NOT NULL REFERENCES agents(id),
  feature_id    TEXT REFERENCES features(id),
  status        TEXT NOT NULL DEFAULT 'queued',  -- queued | running | succeeded | failed | stopped | timed_out
  session_id    TEXT,                 -- Session Claude CLI (pour resume)
  worktree_path TEXT,                 -- Chemin du worktree
  prompt        TEXT,                 -- Prompt envoye a Claude
  summary       TEXT,                 -- Resume du resultat
  model         TEXT,                 -- Modele utilise
  input_tokens  INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cached_tokens INTEGER DEFAULT 0,
  cost_usd      REAL DEFAULT 0,
  exit_code     INTEGER,
  started_at    TEXT,
  finished_at   TEXT,
  created_at    TEXT NOT NULL
);
```

### Table `run_events`

Tous les events d'un run (flux stream-json de Claude).

```sql
CREATE TABLE run_events (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id        TEXT NOT NULL REFERENCES runs(id),
  seq           INTEGER NOT NULL,     -- Numero de sequence dans le run
  type          TEXT NOT NULL,        -- system | assistant | user | result
  subtype       TEXT,                 -- init, text, tool_use, tool_result, thinking...
  data          TEXT NOT NULL,        -- JSON de l'event complet
  created_at    TEXT NOT NULL
);

CREATE INDEX idx_run_events_run_seq ON run_events(run_id, seq);
```

### Table `skills`

Metadonnees des skills (le contenu est dans les fichiers `.md`).

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

Relation many-to-many agents ↔ skills.

```sql
CREATE TABLE agent_skills (
  agent_id      TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  skill_id      TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  PRIMARY KEY (agent_id, skill_id)
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

### Table `sessions`

Sessions Claude pour le resume.

```sql
CREATE TABLE sessions (
  id            TEXT PRIMARY KEY,     -- UUID
  agent_id      TEXT NOT NULL REFERENCES agents(id),
  feature_id    TEXT REFERENCES features(id),
  claude_session_id TEXT NOT NULL,    -- ID de session Claude CLI
  worktree_path TEXT,
  last_run_id   TEXT REFERENCES runs(id),
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE INDEX idx_sessions_agent_feature ON sessions(agent_id, feature_id);
```

## Migrations

Drizzle gere les migrations de schema de maniere declarative :

```
lib/
└── db/
    ├── index.ts            # Initialisation de la connexion
    ├── schema.ts           # Schema Drizzle (source de verite)
    └── migrations/         # Migrations generees
        ├── 0000_init.sql
        └── ...
```

Les migrations sont executees automatiquement au demarrage du serveur.

## Synchronisation fichiers ↔ DB

Les agents et skills existent a la fois comme fichiers (`.maestro/agents/*.yml`, `.maestro/skills/*.md`) et en DB. La regle :

- **Fichiers = source de verite** pour la configuration
- **DB = source de verite** pour l'etat runtime (status, sessions, runs)
- Au demarrage, Maestro synchronise les fichiers vers la DB (ajout, mise a jour, suppression)
- Les modifications via l'UI ecrivent d'abord le fichier, puis mettent a jour la DB

## Volumetrie attendue

En usage solo, les volumes restent tres modestes :

| Table | Volume typique |
|-------|---------------|
| agents | 2-5 lignes |
| features | 10-50 lignes |
| runs | 100-500 lignes |
| run_events | 10k-100k lignes |
| skills | 5-20 lignes |

SQLite gere sans probleme ces volumes. La seule table a surveiller est `run_events` qui peut grossir rapidement. Un mecanisme de purge pourra etre ajoute si necessaire.
