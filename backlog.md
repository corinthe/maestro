# Backlog Maestro

## Feature 1 — Gestion des taches

### Objectif

Creer le socle de gestion des taches : entite metier, machine a etats, persistance SQLite, et API REST.
A la fin de cette feature, on peut creer, lire, modifier et lister des taches via l'API, avec des transitions de statut validees.

### Contexte technique

- C'est la premiere feature : il faut aussi initialiser le projet (package.json, tsconfig, vitest, structure de dossiers, logger, classe d'erreur de base).
- Approche TDD pour toute la logique metier (entite, transitions, validation).

### Sous-taches

#### 1.1 — Initialisation du projet

Setup du monorepo ou du projet Node.js/TypeScript :

- `package.json` avec scripts (dev, build, test, lint)
- `tsconfig.json` avec `strict: true`
- Configuration Vitest
- Structure de dossiers (`src/domain/`, `src/infra/`, `src/api/`, `src/shared/`)
- Logger (pino) configure avec mode dev (texte lisible) et mode prod (JSON)
- Classe `MaestroError` de base dans `src/shared/errors/`
- Point d'entree `src/index.ts` qui demarre le serveur Express/Fastify

#### 1.2 — Domaine Task (TDD)

Logique metier pure, sans dependance infra :

- Type `TaskStatus` : union discriminee de tous les statuts (`inbox`, `analyzing`, `ready`, `approved`, `running`, `review`, `done`, `failed`)
- Type `Task` : id, title, description, status, plan, branch, prUrl, agentLogs, createdAt, updatedAt
- Fonction `createTask(title, description)` → retourne une Task en statut `inbox`
- Fonction `transitionTask(task, newStatus)` → valide la transition ou leve une `InvalidTaskTransitionError`
- Map des transitions valides (ex: `inbox → analyzing`, `ready → approved`, `ready → inbox`, etc.)
- Erreurs specifiques : `InvalidTaskTransitionError`, `TaskNotFoundError`
- Tests : chaque transition valide, chaque transition invalide, creation avec valeurs par defaut

#### 1.3 — Repository SQLite

Persistance des taches :

- Interface `TaskRepository` (dans le domaine) : `create`, `findById`, `findAll`, `update`, `findByStatus`
- Implementation `SqliteTaskRepository` (dans infra) qui implemente cette interface
- Schema SQL : table `tasks` conforme a la doc ARCHITECTURE.md
- Migration initiale (creation de la table)
- Tests : CRUD complet, filtrage par statut, tache inexistante

#### 1.4 — API REST

Couche HTTP fine :

- `POST /api/tasks` — cree une tache (valide l'input avec zod)
- `GET /api/tasks` — liste les taches (filtre optionnel `?status=inbox`)
- `GET /api/tasks/:id` — detail d'une tache
- `PUT /api/tasks/:id` — modifie une tache (titre, description, ou transition de statut)
- Middleware d'erreur global qui transforme les `MaestroError` en reponse JSON structuree
- Validation des inputs avec zod (schemas dedies)
- Tests : requetes HTTP avec supertest, cas nominaux et cas d'erreur

### Parallelisation possible

```
Etape 1 (sequentiel) :
  → 1.1 Initialisation du projet
    Doit etre fait en premier, les autres sous-taches en dependent.

Etape 2 (parallele) :
  → 1.2 Domaine Task — agent backend-domain
  → 1.3 Repository SQLite — agent backend-infra
    Ces deux sous-taches sont independantes :
    - 1.2 definit l'entite et la logique metier (types, fonctions pures, erreurs)
    - 1.3 implemente la persistance (mais peut definir l'interface du repository
      en attendant que 1.2 stabilise les types — ou utiliser les types definis dans 1.2
      si on s'accorde sur la structure Task d'abord)
    Note : 1.3 depend des types de 1.2. Pour paralleliser, definir d'abord les types
    Task et TaskStatus dans 1.2, puis lancer 1.2 (logique) et 1.3 (persistance) en parallele.

Etape 3 (sequentiel) :
  → 1.4 API REST — agent backend-api
    Depend de 1.2 (logique metier) et 1.3 (repository) pour assembler le tout.
```

---

## Feature 2 — Agent Registry + LLM Provider

### Objectif

Charger les templates d'agents depuis le filesystem et pouvoir les executer via la CLI claude.
A la fin de cette feature, on peut lister les agents disponibles, lire leur template, et envoyer un prompt a Claude Code en passant un template d'agent comme system prompt.

### Contexte technique

- Les templates d'agents sont des fichiers `.md` dans un dossier configurable (`agents/`).
- Le contexte partage (`shared/`) est injecte dans chaque prompt en plus du template.
- L'interface `LLMProvider` permet de changer de backend plus tard sans toucher a l'orchestrateur.
- Un `FakeLLMProvider` est necessaire pour tester l'orchestration sans appeler Claude.

### Sous-taches

#### 2.1 — Domaine Agent (TDD)

Logique metier des agents :

- Type `AgentTemplate` : name, content (le markdown), metadata (extraites du fichier si besoin)
- Interface `AgentRegistry` : `load(name)`, `list()`, `exists(name)`
- Validation : erreur explicite si un agent reference dans un plan n'existe pas (`AgentNotFoundError`)
- Tests : chargement d'un agent, listing, agent inexistant

#### 2.2 — Implementation AgentRegistry (filesystem)

Implementation concrete qui lit le dossier `agents/` :

- `FileSystemAgentRegistry` implemente `AgentRegistry`
- Lit les fichiers `.md` du dossier configure
- Cache optionnel en memoire (les templates ne changent pas en cours d'execution)
- Gestion du contexte partage : lit les fichiers de `shared/` et les concatene au template
- Erreurs explicites : dossier introuvable, fichier illisible, dossier vide
- Tests : avec un dossier temporaire contenant des fichiers `.md` de test

#### 2.3 — Interface LLMProvider + ClaudeCliProvider

Abstraction LLM et implementation CLI :

- Interface `LLMProvider` : methode `chat(systemPrompt, messages, workingDir, options)`
- Type de retour : `{ content: string, success: boolean, error?: string }`
- `ClaudeCliProvider` : spawn `claude` via `child_process.execFile` avec les bons flags
- Construction du prompt (template agent + contexte partage + tache)
- Gestion du timeout configurable
- Gestion des erreurs : CLI non trouvee, timeout, code de sortie non-zero
- Logging : log du debut/fin de chaque appel, duree, taille du prompt, succes/echec

#### 2.4 — FakeLLMProvider pour les tests

Provider de test qui retourne des reponses predefinies :

- `FakeLLMProvider` implemente `LLMProvider`
- Accepte un mapping `{ prompt pattern → response }` ou une fonction de reponse
- Permet de simuler des succes, des echecs, des timeouts
- Utilisable dans tous les tests d'orchestration sans appeler Claude

#### 2.5 — API agents

Endpoints pour consulter les agents :

- `GET /api/agents` — liste les agents disponibles (nom + premiere ligne du template)
- `GET /api/agents/:name` — retourne le template complet d'un agent
- Tests avec supertest

### Parallelisation possible

```
Etape 1 (sequentiel) :
  → 2.1 Domaine Agent
    Definit les types et interfaces utilises par toutes les autres sous-taches.

Etape 2 (parallele) :
  → 2.2 FileSystemAgentRegistry — agent backend-infra
  → 2.3 ClaudeCliProvider — agent backend-infra
  → 2.4 FakeLLMProvider — agent backend-test
    Ces trois sont independantes :
    - 2.2 implemente l'interface AgentRegistry definie en 2.1
    - 2.3 implemente l'interface LLMProvider definie en 2.1
    - 2.4 implemente l'interface LLMProvider avec des reponses simulees
    Elles partagent les types de 2.1 mais ne dependent pas les unes des autres.

Etape 3 (sequentiel) :
  → 2.5 API agents — agent backend-api
    Depend de 2.2 (registry) pour servir les donnees.
```

---

## Feature 3 — Worker + Orchestration (flux bout en bout)

### Objectif

Faire fonctionner Maestro de bout en bout : une tache soumise est analysee par l'orchestrateur,
un plan est genere, le dev valide, les agents executent, le code est commite et une PR est ouverte.
A la fin de cette feature, le workflow complet fonctionne via l'API (sans frontend).

### Contexte technique

- Le worker est un process qui poll la queue et execute les taches.
- L'orchestrateur est un agent LLM (pas du code procedural) — il recoit la tache et produit un plan JSON.
- Le worker parse le plan et execute les etapes en spawnant les agents concernes.
- L'integration Git (branche, commit, push, PR) est geree par le worker, pas par les agents.
- Les evenements WebSocket sont emis pour chaque changement d'etat (meme sans frontend).

### Sous-taches

#### 3.1 — Queue in-memory

File d'attente simple :

- Interface `TaskQueue` : `push(task)`, `pop()`, `length`, `peek()`
- Implementation `InMemoryTaskQueue`
- Gestion de priorite basique (FIFO pour le MVP)
- Tests : push/pop, queue vide, ordre FIFO

#### 3.2 — Domaine Orchestration (TDD)

Logique metier de l'orchestration :

- Type `ExecutionPlan` : summary, steps (order, agent, task, depends_on, parallel), files_impacted, questions
- Fonction `parsePlan(rawJson)` : parse et valide la sortie JSON de l'orchestrateur avec zod
- Fonction `getNextSteps(plan, completedSteps)` : retourne les prochaines etapes executables (en respectant les dependances et le parallelisme)
- Fonction `isPlanComplete(plan, completedSteps)` : verifie si toutes les etapes sont terminees
- Erreurs : `InvalidPlanError` (JSON invalide, champs manquants), `PlanExecutionError`
- Tests : parsing de plans valides/invalides, resolution de dependances, detection du parallelisme, plan complete

#### 3.3 — Domaine Git

Operations Git encapsulees :

- Interface `GitService` : `createBranch(name)`, `commit(message, files)`, `push(branch)`, `createPR(title, body, branch)`
- Implementation `CliGitService` qui utilise `child_process` pour appeler `git` et `gh`
- Erreurs explicites : repo pas initialise, branche existe deja, push echoue, `gh` pas installe
- Logging de chaque commande git executee
- Tests : avec un repo git temporaire cree dans le test

#### 3.4 — Worker

Le process qui orchestre tout :

- Prend une tache dans la queue
- Phase analyse : charge le template orchestrateur, appelle le LLM, parse le plan
- Met a jour la tache (statut `ready`, plan stocke)
- Attend la validation humaine (la tache passe en `approved` via l'API)
- Phase execution : pour chaque etape du plan, charge le template agent, appelle le LLM
- Phase finalisation : cree la branche, commit, push, ouvre la PR
- Met a jour la tache (statut `review`, lien PR)
- Gestion des erreurs a chaque phase avec retry configurable (max 2 tentatives)
- Logging detaille de chaque phase, chaque agent, chaque resultat

#### 3.5 — Evenements WebSocket

Notifications temps reel :

- Serveur WebSocket integre au backend
- Emission d'evenements a chaque changement : `task:status_changed`, `task:agent_started`, `task:agent_output`, `task:agent_completed`, `task:plan_ready`, `task:pr_opened`, `task:failed`
- Chaque evenement contient le contexte complet (taskId, agentName, timestamp, donnees)
- Tests : connexion WebSocket, reception des evenements lors d'un changement de statut

#### 3.6 — Endpoints d'orchestration

Endpoints API pour piloter le workflow :

- `POST /api/tasks/:id/approve` — valide le plan, declenche l'execution
- `POST /api/tasks/:id/cancel` — annule/interrompt une tache en cours
- `GET /api/tasks/:id/logs` — retourne les logs des agents pour cette tache
- Tests avec supertest, en utilisant le FakeLLMProvider

### Parallelisation possible

```
Etape 1 (parallele) :
  → 3.1 Queue in-memory — agent backend-infra
  → 3.2 Domaine Orchestration — agent backend-domain
  → 3.3 Domaine Git — agent backend-infra
    Ces trois sont completement independantes :
    - 3.1 est une structure de donnees isolee
    - 3.2 est de la logique metier pure (parsing, resolution de dependances)
    - 3.3 encapsule les commandes git

Etape 2 (sequentiel) :
  → 3.4 Worker — agent backend-core
    Depend de 3.1 (queue), 3.2 (plan parsing), 3.3 (git), et des features 1 (tasks) et 2 (agents + LLM).
    C'est le composant qui assemble tout.

Etape 3 (parallele) :
  → 3.5 WebSocket — agent backend-infra
  → 3.6 Endpoints d'orchestration — agent backend-api
    Ces deux sont independantes entre elles mais dependent du worker (3.4)
    pour emettre les evenements et exposer les actions.
```

---

## Feature 4 — Dashboard React

### Objectif

Fournir une interface utilisateur pour piloter Maestro visuellement : soumettre des taches, consulter les plans generes, approuver ou rejeter, suivre l'execution en temps reel via WebSocket, et consulter les resultats.
A la fin de cette feature, un developpeur peut utiliser Maestro entierement depuis son navigateur.

### Contexte technique

- SPA React en TypeScript, servie par le backend Express (dossier `web/` a la racine, build statique copie dans `public/`).
- Pas de framework CSS lourd — un systeme de design leger maison ou un utilitaire minimal (ex: classnames + CSS modules).
- Communication avec le backend via `fetch` (REST) et `WebSocket` natif (evenements temps reel).
- Pas de state manager externe pour le MVP — `useReducer` + contexte React suffisent.
- Le backend sert deja les endpoints REST et les evenements WebSocket. Le frontend les consomme, il ne necessite aucune modification backend (sauf le serving des fichiers statiques).
- Dependances frontend prevues : `react`, `react-dom`, `react-router-dom`, `vite` (build tool).

### Sous-taches

#### 4.1 — Initialisation du projet frontend

Setup du projet React dans `web/` :

- `web/package.json` avec scripts (dev, build, preview)
- `web/tsconfig.json` avec `strict: true`
- Configuration Vite avec proxy vers le backend (`/api` → `localhost:4000`, `/ws` → WebSocket)
- Structure de dossiers :
  ```
  web/
  ├── src/
  │   ├── components/    → composants reutilisables (Button, Badge, Card, Modal)
  │   ├── pages/         → pages de l'application (TaskList, TaskDetail)
  │   ├── hooks/         → hooks custom (useWebSocket, useTasks, useApi)
  │   ├── services/      → clients API et WebSocket
  │   ├── types/         → types partages (Task, ExecutionPlan, TaskEvent)
  │   └── App.tsx        → routing principal
  ├── index.html
  └── vite.config.ts
  ```
- Page d'accueil minimale qui affiche "Maestro" et le status de sante du backend (appel `GET /api/health`)
- Configuration du backend pour servir les fichiers statiques de `web/dist/` en production

#### 4.2 — Client API et types partages

Couche de communication avec le backend :

- `web/src/types/task.ts` — types `Task`, `TaskStatus`, `ExecutionPlan`, `PlanStep` (miroir des types backend)
- `web/src/types/events.ts` — types `TaskEvent`, `TaskEventType` (miroir des evenements WebSocket)
- `web/src/services/api-client.ts` — client HTTP type :
  - `fetchTasks(status?)` → `Task[]`
  - `fetchTask(id)` → `Task`
  - `createTask(title, description)` → `Task`
  - `updateTask(id, data)` → `Task`
  - `approveTask(id)` → `Task`
  - `cancelTask(id)` → `Task`
  - `fetchTaskLogs(id)` → `{ taskId, status, logs }`
  - `fetchAgents()` → `AgentSummary[]`
- `web/src/services/websocket-client.ts` — client WebSocket :
  - Connexion automatique avec reconnexion exponentielle
  - Methode `subscribe(callback)` pour recevoir les evenements
  - Methode `unsubscribe(callback)` pour se desinscrire
  - Expose l'etat de connexion (`connected`, `disconnected`, `reconnecting`)
- Gestion des erreurs API : les erreurs structurees du backend (`code`, `message`, `suggestion`) sont parsees et exploitables cote UI
- Tests : tests unitaires du client API avec `fetch` mocke, tests du client WebSocket avec un serveur WS de test

#### 4.3 — Hooks React et gestion d'etat

Hooks custom pour connecter les composants aux donnees :

- `useApi<T>(fetcher)` — hook generique pour les appels API avec etats `loading`, `error`, `data`, et fonction `refetch`
- `useTasks(status?)` — charge la liste des taches, se met a jour automatiquement via WebSocket quand un evenement `task:status_changed` arrive
- `useTask(id)` — charge une tache, se met a jour en temps reel via WebSocket
- `useWebSocket()` — fournit la connexion WebSocket et l'etat de connexion au contexte React
- `useTaskEvents(taskId)` — accumule les evenements WebSocket pour une tache donnee (historique en memoire)
- `WebSocketProvider` — composant contexte qui encapsule la connexion WebSocket et la fournit a toute l'application
- Tests : tests des hooks avec `@testing-library/react-hooks`

#### 4.4 — Page liste des taches

Vue principale de l'application :

- Affiche toutes les taches groupees par statut (colonnes kanban ou liste filtrable)
- Chaque tache affiche : titre, statut (badge colore), date de creation, lien PR si disponible
- Filtre par statut (tabs ou dropdown)
- Bouton "Nouvelle tache" qui ouvre un formulaire de creation (titre + description, validation zod cote client)
- Mise a jour en temps reel : quand un evenement WebSocket `task:status_changed` arrive, la tache se deplace dans la bonne colonne/section sans rechargement
- Indicateur de connexion WebSocket (pastille verte/rouge)
- Responsive : utilisable sur un ecran 13" minimum
- Tests : rendu de la liste, creation d'une tache, mise a jour temps reel

#### 4.5 — Page detail d'une tache

Vue detaillee d'une seule tache :

- En-tete : titre, statut, dates, branche, lien PR
- Section plan (visible quand `status >= ready`) :
  - Affiche le `summary` du plan
  - Liste les etapes avec : numero, agent, description, statut (en attente / en cours / termine / echoue)
  - Visualisation des dependances entre etapes (fleches ou indentation)
  - Boutons d'action : "Approuver" (si status `ready`), "Annuler" (si status `running` ou `analyzing`)
- Section logs (visible quand `status >= running`) :
  - Logs de chaque agent, expandables par etape
  - Mise a jour en temps reel via evenements `task:agent_output`
  - Scroll automatique vers le bas pour les logs en cours
- Section questions (visible si le plan contient des `questions`) :
  - Affiche les questions de l'orchestrateur qui necessitent une clarification
- Timeline d'evenements : historique chronologique de tous les evenements recus pour cette tache
- Tests : affichage des differents etats, actions approuver/annuler, mise a jour temps reel des logs

#### 4.6 — Serving statique et integration build

Integration du frontend dans le backend pour le deploiement :

- Script `npm run build:web` dans le `package.json` racine qui build le frontend
- Le backend sert les fichiers statiques de `web/dist/` sur `/`
- Fallback SPA : toute route non-API retourne `index.html` (pour le routing client-side)
- Variable d'environnement `SERVE_STATIC` (defaut `true` en production) pour activer/desactiver
- Script `npm run dev:full` qui lance le backend et le frontend en parallele (avec `concurrently` ou via deux terminaux)
- Tests : verification que le build produit les fichiers attendus, verification du serving statique

### Parallelisation possible

```
Etape 1 (sequentiel) :
  → 4.1 Initialisation du projet frontend
    Doit etre fait en premier — structure, config Vite, proxy.

Etape 2 (parallele) :
  → 4.2 Client API et types — agent frontend-infra
  → 4.3 Hooks React — agent frontend-logic
    Les types et le client API peuvent etre ecrits en parallele avec les hooks
    (les hooks utilisent les types, mais on peut les definir en premier dans 4.2
    puis les deux avancent en parallele).
    Note : 4.3 depend des types de 4.2. Pour paralleliser, definir les types d'abord
    dans 4.2, puis lancer 4.2 (client) et 4.3 (hooks) en parallele.

Etape 3 (parallele) :
  → 4.4 Page liste des taches — agent frontend-ui
  → 4.5 Page detail d'une tache — agent frontend-ui
    Ces deux pages sont independantes. Elles dependent de 4.2 (client API)
    et 4.3 (hooks) pour fonctionner.

Etape 4 (sequentiel) :
  → 4.6 Serving statique et integration build — agent backend-infra
    Depend du frontend fonctionnel pour integrer le build.
```

---

## Feature 5 — Contexte projet et SOUL.md

### Objectif

Permettre a Maestro de s'adapter a chaque projet : charger un fichier SOUL.md qui decrit les conventions, l'architecture et les regles du projet cible, et l'injecter automatiquement dans chaque prompt d'agent. Gerer la configuration du projet (repertoire de travail, remote git, agents actifs) via un fichier de configuration et une API dediee.
A la fin de cette feature, Maestro produit des plans et du code adaptes au projet cible, pas des reponses generiques.

### Contexte technique

- Le SOUL.md est au projet cible ce que le CLAUDE.md est a Maestro : un fichier markdown qui decrit comment travailler dans ce projet.
- Le SOUL.md est lu depuis le repertoire de travail du projet cible (`WORKING_DIR/SOUL.md`).
- La configuration projet est stockee dans `maestro.config.json` a la racine du repertoire de travail, ou via des variables d'environnement.
- Le contexte projet est injecte dans le system prompt de chaque agent, entre le template de l'agent et la tache a realiser. L'ordre est : template agent → SOUL.md → contexte partage (`agents/shared/`).
- Le worker et le LLM provider doivent etre adaptes pour accepter ce contexte supplementaire.

### Sous-taches

#### 5.1 — Domaine Project (TDD)

Logique metier de la configuration projet :

- Type `ProjectConfig` :
  - `workingDir` : chemin du repertoire de travail du projet cible
  - `gitRemote` : URL du remote git (optionnel, auto-detecte sinon)
  - `defaultBranch` : branche de base pour les PR (defaut `main`)
  - `agents` : liste des agents actifs pour ce projet (optionnel, tous par defaut)
  - `orchestratorAgent` : nom de l'agent orchestrateur (defaut `orchestrator`)
  - `maxRetries` : nombre de tentatives par etape (defaut `2`)
  - `timeout` : timeout par appel LLM en secondes (defaut `300`)
- Type `ProjectContext` :
  - `config` : `ProjectConfig`
  - `soul` : contenu du SOUL.md (string, peut etre vide)
  - `sharedContext` : contenu des fichiers partages concatenes (string)
- Fonction `createDefaultConfig(workingDir)` → retourne une config avec les valeurs par defaut
- Fonction `mergeConfig(fileConfig, envConfig)` → fusionne la config fichier avec les variables d'environnement (env prend le dessus)
- Fonction `validateConfig(config)` → valide que le workingDir existe, que les agents references existent dans le registry
- Schema zod pour `ProjectConfig` avec valeurs par defaut
- Erreurs : `ProjectConfigError` (config invalide), `SoulFileError` (fichier illisible)
- Tests : creation de config, fusion, validation, cas d'erreur

#### 5.2 — Chargement du SOUL.md et de la configuration

Implementation du chargement depuis le filesystem :

- Interface `ProjectLoader` (dans le domaine) :
  - `loadConfig(workingDir)` → `ProjectConfig` (lit `maestro.config.json` ou retourne les defauts)
  - `loadSoul(workingDir)` → `string` (lit `SOUL.md` ou retourne une chaine vide)
  - `loadContext(workingDir)` → `ProjectContext` (combine config + soul + shared)
- Implementation `FileSystemProjectLoader` (dans infra) :
  - Lit `maestro.config.json` si present, sinon utilise les defauts
  - Lit `SOUL.md` si present, sinon retourne `""`
  - Auto-detection du remote git via `git remote get-url origin`
  - Auto-detection de la branche par defaut via `git symbolic-ref refs/remotes/origin/HEAD`
  - Cache en memoire (le contexte ne change pas en cours d'execution)
  - Logging : log du chargement avec les chemins et la taille du contexte
- Tests : avec un repertoire temporaire, cas avec/sans SOUL.md, cas avec/sans config

#### 5.3 — Injection du contexte dans les prompts

Modification du worker et du LLM provider pour injecter le contexte :

- Nouvelle fonction `buildAgentPrompt(template, soul, sharedContext)` → construit le system prompt complet :
  ```
  {template agent}

  ---
  ## Contexte du projet
  {contenu du SOUL.md}

  ---
  ## Conventions partagees
  {contenu des fichiers shared/}
  ```
- Le worker charge le `ProjectContext` au demarrage et le passe a chaque appel `executeStep`
- Les sections vides sont omises (pas de "Contexte du projet" si SOUL.md n'existe pas)
- Le prompt est logge en mode debug avec sa taille totale
- Tests : construction du prompt avec/sans SOUL.md, avec/sans shared, verification de l'ordre des sections

#### 5.4 — API configuration projet

Endpoints pour consulter et modifier la configuration :

- `GET /api/project` — retourne la configuration courante et le contexte (config + presence du SOUL.md + taille du contexte)
- `GET /api/project/soul` — retourne le contenu brut du SOUL.md
- `PUT /api/project/config` — modifie la configuration (validee avec zod, ecrite dans `maestro.config.json`)
- `GET /api/project/agents` — retourne la liste des agents actifs pour ce projet (intersection entre agents disponibles et agents configures)
- Validation : refuser les modifications si une tache est en cours d'execution (`running` ou `analyzing`)
- Tests avec supertest, cas nominaux et cas d'erreur

#### 5.5 — Integration dans le dashboard

Ajout d'une page de configuration dans le frontend :

- Page `/settings` accessible depuis la navigation
- Affiche la configuration courante (working dir, branche, agents actifs, timeouts)
- Formulaire d'edition de la configuration avec validation
- Affiche le contenu du SOUL.md en lecture seule (avec coloration syntaxique markdown basique)
- Indicateur : "SOUL.md detecte" ou "SOUL.md absent" avec une explication de ce que c'est
- Warning si aucun SOUL.md n'est detecte : "Maestro fonctionnera, mais les resultats seront plus generiques"

### Parallelisation possible

```
Etape 1 (sequentiel) :
  → 5.1 Domaine Project
    Definit les types et interfaces utilises par toutes les autres sous-taches.

Etape 2 (parallele) :
  → 5.2 FileSystemProjectLoader — agent backend-infra
  → 5.3 Injection du contexte — agent backend-domain
    Ces deux sont relativement independantes :
    - 5.2 charge les fichiers depuis le disque
    - 5.3 construit le prompt a partir du contexte charge
    Elles partagent le type ProjectContext de 5.1.

Etape 3 (parallele) :
  → 5.4 API configuration — agent backend-api
  → 5.5 Integration dashboard — agent frontend-ui
    Ces deux sont independantes : 5.4 cree les endpoints, 5.5 les consomme.
    Elles dependent de 5.2 (loader) pour fonctionner.
```

---

## Feature 6 — Feedback humain et re-execution

### Objectif

Permettre au developpeur d'interagir avec le workflow au-dela du simple approuver/annuler : editer un plan avant de l'approuver, donner du feedback sur le resultat d'un agent pour relancer une etape, re-executer partiellement un plan (seulement les etapes echouees ou modifiees), et consulter un historique complet des executions.
A la fin de cette feature, Maestro supporte un workflow iteratif ou le developpeur collabore avec les agents plutot que de simplement valider ou rejeter.

### Contexte technique

- Le plan d'execution est actuellement stocke en JSON dans le champ `plan` de la tache. Pour supporter l'edition et le suivi par etape, il faut un modele plus riche.
- L'historique des executions necessite une nouvelle table SQLite (`task_executions`) qui enregistre chaque run, chaque etape, et chaque resultat d'agent.
- Le feedback humain est un message texte libre que le worker injecte dans le prompt de l'agent lors du retry.
- La re-execution partielle reutilise les resultats des etapes deja reussies et ne relance que les etapes ciblees.

### Sous-taches

#### 6.1 — Modele d'execution riche (TDD)

Evoluer le modele pour supporter le suivi par etape et l'historique :

- Type `StepStatus` : `'pending' | 'running' | 'completed' | 'failed' | 'skipped'`
- Type `StepExecution` :
  - `stepOrder` : numero de l'etape
  - `agent` : nom de l'agent
  - `task` : description de l'etape
  - `status` : `StepStatus`
  - `output` : sortie de l'agent (string, null si pas encore execute)
  - `error` : message d'erreur (string, null si succes)
  - `startedAt` : date de debut (null si pas encore demarre)
  - `completedAt` : date de fin (null si pas termine)
  - `attempt` : numero de tentative (1-indexed)
  - `feedback` : feedback humain injecte pour cette tentative (string, null)
- Type `TaskExecution` :
  - `id` : identifiant unique de l'execution
  - `taskId` : reference vers la tache
  - `plan` : `ExecutionPlan` tel qu'approuve (potentiellement edite)
  - `steps` : `StepExecution[]`
  - `status` : `'running' | 'completed' | 'failed' | 'cancelled'`
  - `startedAt` : date de debut
  - `completedAt` : date de fin (null si en cours)
- Fonction `createExecution(taskId, plan)` → cree une execution avec toutes les etapes en `pending`
- Fonction `updateStepStatus(execution, stepOrder, status, output?)` → met a jour le statut d'une etape (immutable)
- Fonction `getFailedSteps(execution)` → retourne les etapes en echec
- Fonction `getRetryableExecution(execution, stepsToRetry)` → cree une nouvelle execution qui reutilise les etapes reussies et remet en `pending` les etapes ciblees
- Fonction `isExecutionComplete(execution)` → verifie si toutes les etapes sont terminees ou skippees
- Tests : creation, mise a jour, detection des echecs, creation de retry, completion

#### 6.2 — Persistance des executions

Table SQLite pour l'historique :

- Interface `ExecutionRepository` (dans le domaine) :
  - `create(execution)` → `TaskExecution`
  - `findById(id)` → `TaskExecution | null`
  - `findByTaskId(taskId)` → `TaskExecution[]` (toutes les executions d'une tache, ordonnees par date)
  - `update(execution)` → `TaskExecution`
  - `findLatestByTaskId(taskId)` → `TaskExecution | null`
- Implementation `SqliteExecutionRepository` (dans infra) :
  - Table `task_executions` : id, task_id, plan (JSON), status, started_at, completed_at
  - Table `step_executions` : id, execution_id, step_order, agent, task, status, output, error, started_at, completed_at, attempt, feedback
  - Migration SQL (ajout des deux tables)
  - Mapping objet ↔ ligne SQL avec serialisation JSON pour le plan
- Tests : CRUD complet, requetes par taskId, ordering, mise a jour des etapes

#### 6.3 — Edition du plan

Permettre de modifier le plan avant de l'approuver :

- `PUT /api/tasks/:id/plan` — remplace le plan d'une tache en statut `ready`
  - Valide le nouveau plan avec le schema zod existant (`executionPlanSchema`)
  - Verifie que les agents references existent dans le registry
  - Refuse si la tache n'est pas en statut `ready`
  - Met a jour le champ `plan` de la tache
  - Emet un evenement `task:plan_updated`
- Nouveau type d'evenement WebSocket : `task:plan_updated`
- Cote frontend (page detail) :
  - Bouton "Editer le plan" qui passe en mode edition
  - Editeur JSON structure : possibilite d'ajouter, supprimer, reordonner des etapes
  - Validation en temps reel du plan (schema + agents existants)
  - Preview des modifications avant sauvegarde
  - Bouton "Sauvegarder" qui appelle `PUT /api/tasks/:id/plan`
- Tests backend : edition valide, edition invalide, edition hors statut ready
- Tests frontend : mode edition, validation, sauvegarde

#### 6.4 — Feedback et retry par etape

Permettre de donner du feedback sur une etape et de la relancer :

- `POST /api/tasks/:id/steps/:stepOrder/retry` — relance une etape echouee avec un feedback optionnel
  - Body : `{ feedback?: string }`
  - Verifie que la tache a une execution active
  - Verifie que l'etape est en statut `failed`
  - Cree une nouvelle `StepExecution` avec `attempt` incremente et le `feedback`
  - Le worker injecte le feedback dans le prompt de l'agent :
    ```
    {tache de l'etape}

    ## Tentative precedente
    L'execution precedente a echoue. Voici le feedback du developpeur :
    {feedback}

    Resultat de la tentative precedente :
    {output de la tentative precedente}
    ```
  - Emet un evenement `task:step_retried`
- `POST /api/tasks/:id/retry` — relance toutes les etapes echouees d'une execution
  - Body : `{ feedback?: string }` (feedback global applique a toutes les etapes)
  - Cree une nouvelle execution via `getRetryableExecution`
  - Passe la tache en statut `running`
  - Le worker execute seulement les etapes en `pending` (les `completed` sont skippees)
- Modification du worker :
  - Le worker verifie le statut de chaque etape avant de l'executer : si `completed`, il skip
  - Le worker injecte le feedback dans le prompt si present
  - Le worker met a jour la `StepExecution` en base a chaque changement de statut
- Nouveaux types d'evenements WebSocket : `task:step_retried`, `task:execution_started`
- Tests : retry d'une etape, retry global, injection du feedback, skip des etapes reussies

#### 6.5 — Vue execution dans le dashboard

Enrichir la page detail pour afficher l'historique et le retry :

- Onglet "Executions" dans la page detail d'une tache :
  - Liste chronologique de toutes les executions (la plus recente en haut)
  - Chaque execution affiche : statut, date, nombre d'etapes reussies/echouees
  - L'execution en cours est mise en evidence
- Vue detaillee d'une execution :
  - Chaque etape affiche : agent, description, statut (badge), sortie (expandable), duree
  - Les etapes echouees ont un bouton "Retry" avec un champ de feedback optionnel
  - Les etapes en cours affichent un indicateur de progression (spinner)
  - Les etapes skippees sont grisees avec la mention "Reutilisee de l'execution precedente"
- Bouton "Relancer les etapes echouees" (visible si au moins une etape est en echec et la tache n'est pas `running`)
- Mise a jour en temps reel des statuts d'etapes via WebSocket
- Tests : affichage des executions, retry d'une etape, mise a jour temps reel

#### 6.6 — Nettoyage et migration du worker

Adapter le worker existant pour utiliser le nouveau modele d'execution :

- Le worker cree une `TaskExecution` au debut de chaque execution
- Le worker met a jour les `StepExecution` a chaque changement de statut (pending → running → completed/failed)
- Le worker enregistre la sortie de chaque agent dans la `StepExecution` (plus dans `task.agentLogs`)
- Le champ `task.agentLogs` est deprecie : les logs sont desormais dans `step_executions.output`
- Le worker supporte le mode "re-execution" : il accepte une execution existante avec des etapes `completed` et ne relance que les `pending`
- Migration : les taches existantes avec des `agentLogs` sont conservees tel quel (pas de migration de donnees)
- Tests : worker avec le nouveau modele, mode re-execution, persistence des etapes

### Parallelisation possible

```
Etape 1 (sequentiel) :
  → 6.1 Modele d'execution riche
    Definit les types et fonctions utilises par toutes les autres sous-taches.

Etape 2 (parallele) :
  → 6.2 Persistance des executions — agent backend-infra
  → 6.3 Edition du plan (backend) — agent backend-api
    Ces deux sont independantes :
    - 6.2 cree les tables et le repository
    - 6.3 ajoute l'endpoint d'edition du plan (n'a pas besoin du repository d'execution)

Etape 3 (sequentiel) :
  → 6.4 Feedback et retry par etape — agent backend-core
    Depend de 6.1 (modele), 6.2 (persistance), et 6.3 (edition).
    C'est le composant qui relie le modele d'execution au worker.

Etape 4 (parallele) :
  → 6.5 Vue execution dans le dashboard — agent frontend-ui
  → 6.6 Nettoyage et migration du worker — agent backend-core
    Ces deux sont independantes entre elles mais dependent de 6.4 :
    - 6.5 consomme les endpoints de retry et affiche les executions
    - 6.6 adapte le worker interne pour utiliser le nouveau modele
```
