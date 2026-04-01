# Module Heartbeat

## Responsabilite

Scheduler autonome qui reveille periodiquement les agents pour qu'ils verifient s'ils ont du travail. Gere aussi les wakeups manuels et la surveillance des runs en cours.

## Concept

Le heartbeat est un **cron interne** au serveur Maestro. A intervalles reguliers, il parcourt les agents actifs et verifie s'ils ont des features assignees en attente. Si oui, il declenche un run.

L'utilisateur peut aussi declencher un wakeup manuel (via l'UI ou `npx maestro wake`).

## Cycle du heartbeat

```
┌─────────────────────────────────────────────────────┐
│                    Heartbeat Loop                    │
│                                                     │
│  Toutes les N secondes (configurable, defaut: 30s)  │
│                                                     │
│  Pour chaque agent actif :                          │
│    1. L'agent est-il deja en train de tourner ?      │
│       → Oui : skip                                  │
│    2. Y a-t-il des features assignees en backlog     │
│       ou in_progress sans run actif ?               │
│       → Non : skip                                  │
│    3. Prendre la feature la plus prioritaire         │
│    4. Creer un run queued                           │
│    5. Demarrer le run (spawn Claude CLI)            │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## Configuration

Dans `.maestro/config.yml` :

```yaml
heartbeat:
  enabled: true           # Activer/desactiver le heartbeat
  intervalSec: 30         # Intervalle entre les verifications
  maxConcurrentRuns: 3    # Nombre max de runs simultanes (tous agents confondus)
```

## Wakeup manuel

Un wakeup manuel declenche immediatement la verification pour un agent (ou tous) :

```
POST /api/agents/:id/wake
POST /api/agents/wake-all
```

Le wakeup ne force pas un run. Il declenche la meme logique que le heartbeat : verifier s'il y a du travail, et si oui, demarrer un run.

## Gestion de la concurrence

Maestro gere la concurrence a deux niveaux :

### 1. Par agent

Un agent ne peut avoir qu'**un seul run actif** a la fois. Si l'agent est deja en cours d'execution, le heartbeat le skip.

### 2. Global

Le parametre `maxConcurrentRuns` limite le nombre total de runs simultanees. Cela evite de surcharger la machine et de depasser les quotas Claude.

```typescript
function canStartNewRun(): boolean {
  const activeRuns = db.runs.count({ status: "running" });
  return activeRuns < config.heartbeat.maxConcurrentRuns;
}
```

## Surveillance des runs

Le heartbeat surveille aussi les runs en cours :

### Detection de runs orphelins

Un run peut devenir orphelin si le processus Claude CLI crashe sans signaler sa terminaison. Le heartbeat detecte ces cas :

```typescript
function reapOrphanedRuns() {
  const staleRuns = db.runs.findMany({
    status: "running",
    updatedAt: { lt: Date.now() - STALE_THRESHOLD }
  });

  for (const run of staleRuns) {
    // Verifier si le processus existe encore
    if (!isProcessAlive(run.pid)) {
      markRunFailed(run.id, "Process terminated unexpectedly");
    }
  }
}
```

### Timeout

Si un run depasse son `timeoutSec`, le heartbeat :

1. Envoie SIGTERM au processus
2. Attend `graceSec`
3. Envoie SIGKILL si necessaire
4. Marque le run comme `timed_out`

## Events emis

Le heartbeat emet des events via WebSocket :

| Event | Quand |
|-------|-------|
| `agent.status` | Un agent change de statut (idle → running, etc.) |
| `run.status` | Un run change de statut |
| `heartbeat.tick` | A chaque tick du heartbeat (pour l'UI, optionnel) |

## Reprise apres redemarrage

Quand Maestro redemarre (apres un `dev` stop/start) :

1. Les runs en statut `running` sont verifiees
2. Si le processus n'existe plus → marquer comme `failed` (orphelin)
3. Le heartbeat reprend son cycle normal
4. Les features `in_progress` sans run actif seront reprises au prochain tick

## Structure technique

```
lib/
└── heartbeat/
    ├── scheduler.ts        # Boucle principale du heartbeat
    ├── run-dispatcher.ts   # Logique de dispatch (quel agent, quelle feature)
    ├── orphan-reaper.ts    # Detection et nettoyage des runs orphelins
    └── concurrency.ts      # Gestion de la concurrence
```

## Diagramme de sequence : heartbeat tick

```
Scheduler          AgentService        RunService          Claude Adapter
    │                   │                   │                     │
    │  tick              │                   │                     │
    ├──►                │                   │                     │
    │   getIdleAgents() │                   │                     │
    ├──────────────────►│                   │                     │
    │   [agent1, agent2]│                   │                     │
    │◄──────────────────│                   │                     │
    │                   │                   │                     │
    │   Pour agent1:    │                   │                     │
    │   getPendingFeature(agent1)            │                     │
    ├──────────────────────────────────────►│                     │
    │   feature MAE-3   │                   │                     │
    │◄──────────────────────────────────────│                     │
    │                   │                   │                     │
    │   canStartNewRun()?                   │                     │
    ├──────────────────────────────────────►│                     │
    │   true            │                   │                     │
    │◄──────────────────────────────────────│                     │
    │                   │                   │                     │
    │   createRun(agent1, MAE-3)            │                     │
    ├──────────────────────────────────────►│                     │
    │   run created     │                   │                     │
    │◄──────────────────────────────────────│                     │
    │                   │                   │                     │
    │   executeRun(run) │                   │                     │
    ├──────────────────────────────────────────────────────────►│
    │                   │                   │     spawn claude   │
    │                   │                   │◄────────────────────│
```
