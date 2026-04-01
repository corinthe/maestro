# Module CLI

## Responsabilité

Point d'entrée en ligne de commande pour initialiser Maestro dans un repo, lancer le serveur local, et effectuer des opérations ponctuelles.

## Commandes

### `npx maestro init`

Initialise Maestro dans le repo courant.

**Actions :**
1. Vérifie qu'on est dans un repo git
2. Crée le répertoire `.maestro/`
3. Génère `config.yml` avec les defaults
4. Crée les sous-répertoires (`agents/`, `skills/`)
5. Initialise la base SQLite (`db.sqlite`)
6. Met à jour `.gitignore` (ajouté `db.sqlite`)
7. Crée les agents par défaut :
   - `developer.yml` — agent de développement généraliste
   - `qa-engineer.yml` — agent QA qui vérifie le travail des autres agents
8. Installe les dépendances si nécessaire

```
$ npx maestro init
  Maestro initialized in /Users/dev/my-project
  Created .maestro/config.yml
  Created .maestro/agents/developer.yml
  Created .maestro/agents/qa-engineer.yml
  Updated .gitignore
  Ready — run `npx maestro dev` to start
```

### `npx maestro dev`

Lance le serveur Next.js local et ouvre le navigateur.

**Actions :**
1. Vérifie que `.maestro/` existe (sinon suggère `init`)
2. Démarre le serveur Next.js sur un port disponible (défaut: 4200)
3. Démarre le heartbeat scheduler
4. Ouvre le navigateur sur `http://localhost:4200`

### `npx maestro status`

Affiche l'état courant dans le terminal.

```
$ npx maestro status
  Maestro — my-project
  Server: running on :4200
  Agents: 2 active, 1 idle
  Features: 3 in progress, 1 done
  Active runs:
    backend-dev → feat/user-auth (running 4m12s)
    frontend-dev → feat/dashboard (idle)
```

### `npx maestro wake`

Reveille l'orchestrateur immédiatement pour qu'il évalue l'état du projet et délègue du travail.

```
$ npx maestro wake
  Waking orchestrator...
  Orchestrator running.
```

### `npx maestro stop [agent]`

Arrete proprement un agent en cours d'exécution (SIGTERM + grace period).

### `npx maestro doctor`

Vérifie l'environnement (Claude CLI installé, git disponible, config valide).

## Structure technique

```
packages/cli/
├── src/
│   ├── index.ts          # Point d'entree, parsing des commandes
│   ├── commands/
│   │   ├── init.ts       # Initialisation du repo
│   │   ├── dev.ts        # Demarrage du serveur
│   │   ├── status.ts     # Affichage du statut
│   │   ├── wake.ts       # Wakeup d'agents
│   │   ├── stop.ts       # Arret d'agents
│   │   └── doctor.ts     # Diagnostic
│   └── utils/
│       ├── git.ts         # Detection et operations git
│       ├── config.ts      # Lecture/ecriture config
│       └── output.ts      # Formatage terminal
├── package.json
└── tsconfig.json
```

## Dépendances clés

- **commander** ou **citty** : parsing des commandes CLI
- **picocolors** : couleurs terminal
- **open** : ouverture du navigateur
