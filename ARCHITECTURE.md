# Architecture

## Vue d'ensemble

```
┌─────────────────────────────────────────────────┐
│                  Frontend                        │
│            React + Kanban board                   │
│             localhost:3000                        │
└──────────────────┬──────────────────────────────┘
                   │ REST + WebSocket
┌──────────────────▼──────────────────────────────┐
│                  Backend                         │
│           Node.js (Express/Fastify)              │
│             localhost:4000                        │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ Task API │  │ Agent    │  │  WebSocket    │  │
│  │          │  │ Registry │  │  Server       │  │
│  └────┬─────┘  └──────────┘  └───────────────┘  │
│       │                                          │
│  ┌────▼─────┐                                    │
│  │  Queue   │                                    │
│  └────┬─────┘                                    │
└───────┼──────────────────────────────────────────┘
        │
┌───────▼──────────────────────────────────────────┐
│                  Worker                           │
│                                                   │
│  ┌────────────────────────────────────────────┐   │
│  │            Orchestrateur                    │   │
│  │                                             │   │
│  │  1. Charge le template de l'orchestrateur   │   │
│  │  2. Envoie la tache a Claude                │   │
│  │  3. Recoit un plan                          │   │
│  │  4. Execute le plan :                       │   │
│  │     - spawn Claude avec profil agent X      │   │
│  │     - spawn Claude avec profil agent Y      │   │
│  │     - collect les resultats                 │   │
│  │  5. Git add, commit, push                   │   │
│  │  6. Ouvre une PR                            │   │
│  └───────────┬────────────────────────────────┘   │
│              │                                     │
│  ┌───────────▼────────────────────────────────┐   │
│  │         LLM Provider (abstraction)          │   │
│  │                                             │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  │   │
│  │  │ ClaudeCliProvider│  │AnthropicProvider│  │   │
│  │  │ (MVP)           │  │(futur)          │  │   │
│  │  └─────────────────┘  └─────────────────┘  │   │
│  └─────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────┘
        │
   ┌────▼────┐
   │Git repo │
   │ local   │
   └─────────┘
```

## Flux de donnees

```
1. Frontend  ──POST /tasks──►  Backend (cree la tache, statut: inbox)
2. Backend   ──event──►        Queue (tache en attente)
3. Worker    ◄──poll──         Queue (prend la tache)
4. Worker    ──ws:status──►    Backend ──ws──► Frontend (analyse en cours)
5. Worker    ──PUT /tasks──►   Backend (plan genere, statut: ready)
6. Frontend  ◄──ws:update──   Backend (affiche le plan)
7. Humain    ──POST /tasks/approve──► Backend (valide le plan)
8. Backend   ──event──►        Queue (tache approuvee)
9. Worker    ◄──poll──         Queue (execute le plan)
10. Worker   ──ws:progress──►  Backend ──ws──► Frontend (progression)
11. Worker   ──PUT /tasks──►   Backend (PR ouverte, statut: review)
12. Frontend ◄──ws:update──   Backend (affiche le lien PR)
```

## Base de donnees (SQLite)

### Table: tasks

| Colonne | Type | Description |
|---|---|---|
| id | TEXT (UUID) | Identifiant unique |
| title | TEXT | Titre court |
| description | TEXT | Description complete de la tache |
| status | TEXT | inbox, analyzing, ready, approved, running, review, done, failed |
| plan | TEXT (JSON) | Plan genere par l'orchestrateur |
| branch | TEXT | Nom de la branche git |
| pr_url | TEXT | URL de la PR |
| agent_logs | TEXT (JSON) | Logs de chaque agent |
| created_at | DATETIME | Date de creation |
| updated_at | DATETIME | Derniere mise a jour |

### Table: agent_runs

| Colonne | Type | Description |
|---|---|---|
| id | TEXT (UUID) | Identifiant unique |
| task_id | TEXT (FK) | Tache parente |
| agent_name | TEXT | Nom de l'agent utilise |
| prompt | TEXT | Prompt envoye |
| output | TEXT | Reponse de l'agent |
| status | TEXT | running, completed, failed |
| started_at | DATETIME | Debut |
| finished_at | DATETIME | Fin |

## Securite

- La CLI claude tourne avec `--dangerously-skip-permissions` pour l'automatisation. Cela signifie que les agents ont un acces complet au systeme de fichiers et au shell dans le dossier du repo.
- Pour le MVP, c'est acceptable car tout tourne en local sur la machine du developpeur.
- En production, chaque worker devrait tourner dans un conteneur isole (Docker) avec un acces restreint.
- Le token Git (PAT) ne doit jamais etre expose aux agents via le contexte. Il est utilise uniquement par le worker pour push/PR.
