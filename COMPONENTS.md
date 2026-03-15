# Composants

## 1. Frontend

### Role
Interface utilisateur : tableau kanban, visualisation temps reel, interactions humaines.

### Responsabilites
- Afficher le board kanban avec les taches par colonne
- Permettre la creation de taches
- Afficher le plan genere et permettre sa validation/modification
- Montrer la progression des agents en temps reel
- Afficher les logs et resultats
- Permettre l'interruption d'une tache

### Stack
- React (ou Next.js en mode SPA)
- Composant kanban : `@hello-pangea/dnd` ou `react-beautiful-dnd`
- WebSocket client pour le temps reel
- Appels REST pour les actions CRUD

### Routes
```
GET  /                  → Board kanban
GET  /tasks/:id         → Detail d'une tache (plan, logs, PR)
```

---

## 2. Backend API

### Role
Point central : recoit les requetes du frontend, gere l'etat des taches, notifie le frontend, alimente la queue.

### Responsabilites
- CRUD des taches
- Machine a etats des transitions de statut
- Serveur WebSocket pour le temps reel
- Publication d'evenements vers la queue
- Stockage en base (SQLite)

### Endpoints

```
POST   /api/tasks              → Creer une tache
GET    /api/tasks              → Lister les taches (avec filtre par statut)
GET    /api/tasks/:id          → Detail d'une tache
PUT    /api/tasks/:id          → Modifier une tache
POST   /api/tasks/:id/approve  → Valider le plan et lancer l'execution
POST   /api/tasks/:id/cancel   → Annuler / interrompre une tache
GET    /api/tasks/:id/logs     → Logs des agents pour cette tache
GET    /api/agents             → Lister les agents disponibles
GET    /api/agents/:name       → Lire le template d'un agent
```

### WebSocket events (serveur → client)

```
task:status_changed    → { taskId, oldStatus, newStatus }
task:agent_started     → { taskId, agentName, prompt }
task:agent_output      → { taskId, agentName, chunk }
task:agent_completed   → { taskId, agentName, result }
task:plan_ready        → { taskId, plan }
task:pr_opened         → { taskId, prUrl }
task:failed            → { taskId, error }
```

---

## 3. Queue

### Role
Decouple la soumission de l'execution. Garantit qu'une tache est traitee meme si le worker est occupe.

### Responsabilites
- Recevoir les taches a traiter
- Les distribuer aux workers disponibles
- Gerer les priorites (optionnel pour le MVP)
- Gerer le retry en cas d'echec

### Implementation MVP
Pour le MVP, une simple queue in-memory (un tableau avec un setInterval qui poll) suffit. Pas besoin de Redis au debut.

```javascript
// Simple queue in-memory
class TaskQueue {
  constructor() { this.queue = []; }
  push(task) { this.queue.push(task); }
  pop() { return this.queue.shift(); }
  get length() { return this.queue.length; }
}
```

Pour la suite : Bull/BullMQ avec Redis.

---

## 4. Worker

### Role
Execute les taches. C'est lui qui fait le vrai travail : il orchestre les agents et interagit avec le repo Git.

### Responsabilites
- Prendre une tache dans la queue
- Preparer le repo (clone ou pull, creer la branche)
- Charger les templates d'agents
- Executer l'orchestration (phase analyse, puis phase execution)
- Rapporter la progression au backend via HTTP/WebSocket
- Finaliser (commit, push, ouvrir la PR)
- Gerer les erreurs et timeouts

### Cycle de vie d'une tache dans le worker

```
1. Recevoir la tache
2. git pull origin main
3. git checkout -b feature/task-{id}
4. Phase analyse :
   a. Charger le template orchestrateur
   b. Spawn claude avec la tache
   c. Parser le plan retourne
   d. Envoyer le plan au backend (statut → ready)
   e. Attendre la validation humaine
5. Phase execution :
   a. Pour chaque etape du plan :
      - Charger le template de l'agent concerne
      - Spawn claude avec le contexte + la sous-tache
      - Collecter le resultat
      - Rapporter la progression
   b. Si des agents peuvent tourner en parallele, les lancer ensemble
6. Phase finalisation :
   a. git add -A
   b. git commit
   c. git push -u origin HEAD
   d. gh pr create (ou az repos pr create, ou glab mr create)
   e. Envoyer l'URL de la PR au backend (statut → review)
7. En cas d'erreur :
   a. Logger l'erreur
   b. Retry si tentatives < max
   c. Sinon, statut → failed avec message explicatif
```

### Concurrence
Le MVP supporte un seul worker (une seule tache a la fois). La queue assure que les taches suivantes attendent leur tour.

---

## 5. LLM Provider

### Role
Abstraction qui isole l'orchestrateur du moyen d'execution. Aujourd'hui la CLI claude, demain l'API Anthropic, ou OpenAI, ou autre.

### Interface

```javascript
class LLMProvider {
  /**
   * @param {string} systemPrompt - Le template de l'agent (SOUL.md)
   * @param {Array} messages - Historique de conversation
   * @param {string} workingDir - Dossier de travail (le repo)
   * @returns {Promise<{content: string, toolCalls: Array}>}
   */
  async chat(systemPrompt, messages, workingDir) {
    throw new Error("Not implemented");
  }
}
```

### Implementation CLI (MVP)

Voir [LLM-PROVIDER.md](./LLM-PROVIDER.md) pour le detail.

---

## 6. Agent Registry

### Role
Charge et fournit les templates d'agents.

### Responsabilites
- Lire les fichiers SOUL.md depuis le dossier `agents/`
- Les mettre a disposition de l'orchestrateur
- Permettre l'ajout de nouveaux agents sans modifier le code

### Structure

```
agents/
├── orchestrator.md    → Agent special : analyse et planifie
├── architect.md       → Conception technique, plan d'implementation
├── backend.md         → Implementation code backend
├── frontend.md        → Implementation code frontend
├── tester.md          → Ecriture et execution des tests
└── reviewer.md        → Relecture et suggestions d'amelioration
```

Le registry est un simple chargeur de fichiers :

```javascript
class AgentRegistry {
  constructor(agentsDir) {
    this.dir = agentsDir;
  }

  load(name) {
    return fs.readFileSync(path.join(this.dir, `${name}.md`), "utf-8");
  }

  list() {
    return fs.readdirSync(this.dir)
      .filter(f => f.endsWith(".md"))
      .map(f => f.replace(".md", ""));
  }
}
```
