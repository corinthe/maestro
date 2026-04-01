# Module CLI

## Responsabilite

Point d'entree en ligne de commande pour initialiser Maestro dans un repo, lancer le serveur local, et effectuer des operations ponctuelles.

## Commandes

### `npx maestro init`

Initialise Maestro dans le repo courant.

**Actions :**
1. Verifie qu'on est dans un repo git
2. Cree le repertoire `.maestro/`
3. Genere `config.yml` avec les defaults
4. Cree les sous-repertoires (`agents/`, `skills/`)
5. Initialise la base SQLite (`db.sqlite`)
6. Met a jour `.gitignore` (ajoute `db.sqlite`)
7. Cree les agents par defaut :
   - `developer.yml` — agent de developpement generaliste
   - `qa-engineer.yml` — agent QA qui verifie le travail des autres agents
8. Installe les dependances si necessaire

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
1. Verifie que `.maestro/` existe (sinon suggere `init`)
2. Demarre le serveur Next.js sur un port disponible (defaut: 4200)
3. Demarre le heartbeat scheduler
4. Ouvre le navigateur sur `http://localhost:4200`

### `npx maestro status`

Affiche l'etat courant dans le terminal.

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

Reveille l'orchestrateur immediatement pour qu'il evalue l'etat du projet et delegue du travail.

```
$ npx maestro wake
  Waking orchestrator...
  Orchestrator running.
```

### `npx maestro stop [agent]`

Arrete proprement un agent en cours d'execution (SIGTERM + grace period).

### `npx maestro doctor`

Verifie l'environnement (Claude CLI installe, git disponible, config valide).

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

## Dependances cles

- **commander** ou **citty** : parsing des commandes CLI
- **picocolors** : couleurs terminal
- **open** : ouverture du navigateur
