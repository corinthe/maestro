# Module Heartbeat

## Responsabilité

Scheduler autonome qui réveille périodiquement l'**orchestrateur** pour qu'il évalue l'état du projet et délègue du travail aux agents. Gère aussi les wakeups manuels et la surveillance des runs en cours.

## Concept

Le heartbeat est un **cron interne** au serveur Maestro. À intervalles réguliers, il spawne l'orchestrateur (un agent Claude) qui décide quoi faire. Le heartbeat ne dispatche jamais directement du travail aux agents — c'est toujours l'orchestrateur qui décide.

L'utilisateur peut aussi déclencher un wakeup manuel (via l'UI ou `npx maestro wake`), ce qui réveille immédiatement l'orchestrateur.

## Cycle du heartbeat

```
┌─────────────────────────────────────────────────────────────┐
│                        Heartbeat Loop                        │
│                                                              │
│  Toutes les N secondes (configurable, defaut: 60s)           │
│                                                              │
│  1. L'orchestrateur est-il deja en train de tourner ?         │
│     → Oui : skip                                             │
│  2. Y a-t-il un agent worker en cours d'execution ?           │
│     → Oui : skip (attendre qu'il finisse)                    │
│  3. Guard : y a-t-il quelque chose de nouveau ?               │
│     Verifier AU MOINS une condition :                         │
│     - Features en backlog/in_progress sans run recent         │
│     - Messages utilisateur non lus                            │
│     - Runs termines depuis le dernier tick orchestrateur       │
│     - Propositions d'agents acceptees a traiter               │
│     → Rien de nouveau : skip (evite de consommer des tokens)  │
│  4. Spawner l'orchestrateur                                   │
│     → L'orchestrateur evalue l'etat et decide des actions    │
│     → Il peut lancer un agent, proposer un plan, etc.        │
│  5. Attendre la fin de l'orchestrateur                        │
│  6. Si un agent a ete lance, attendre sa fin                  │
│  7. Reprise du cycle                                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Configuration

Dans `.maestro/config.yml` :

```yaml
heartbeat:
  enabled: true           # Activer/desactiver le heartbeat
  intervalSec: 60         # Intervalle entre les verifications
```

## Wakeup manuel

Un wakeup manuel réveille immédiatement l'orchestrateur :

```
POST /api/orchestrator/wake
```

Le wakeup ne force pas un run. Il spawné l'orchestrateur qui évalue si du travail doit être fait.

Depuis le CLI :

```bash
npx maestro wake          # Reveille l'orchestrateur
```

## Guard : éviter les spawns inutiles

Avant de spawner l'orchestrateur, le heartbeat vérifie qu'il y a effectivement quelque chose de nouveau à traiter. Sans cette guard, l'orchestrateur consommerait des tokens à chaque tick pour conclure "rien à faire".

```typescript
function hasWorkToDo(): boolean {
  // Features en attente sans run recent
  const pendingFeatures = db.features.count({
    status: { in: ["backlog", "in_progress"] }
  });

  // Messages utilisateur non lus
  const unreadMessages = db.messages.count({ status: "pending" });

  // Runs termines depuis le dernier tick orchestrateur
  const lastOrchestratorRun = db.runs.findFirst({
    runType: "orchestrator",
    orderBy: { createdAt: "desc" }
  });
  const newCompletedRuns = db.runs.count({
    status: { in: ["succeeded", "failed", "stopped"] },
    finishedAt: { gt: lastOrchestratorRun?.createdAt ?? "1970-01-01" }
  });

  // Propositions acceptees a traiter
  const acceptedProposals = db.proposals.count({
    status: "accepted",
    resolvedAt: { gt: lastOrchestratorRun?.createdAt ?? "1970-01-01" }
  });

  return pendingFeatures > 0
    || unreadMessages > 0
    || newCompletedRuns > 0
    || acceptedProposals > 0;
}
```

Si `hasWorkToDo()` retourne `false`, le heartbeat skip le tick sans spawner l'orchestrateur.

## Surveillancé des runs

Le heartbeat surveille les runs en cours (orchestrateur et agents) :

### Détection de runs orphelins

Un run peut devenir orphelin si le processus Claude CLI crashe. Le heartbeat détecte ces cas :

```typescript
function reapOrphanedRuns() {
  const staleRuns = db.runs.findMany({
    status: "running",
    updatedAt: { lt: Date.now() - STALE_THRESHOLD }
  });

  for (const run of staleRuns) {
    if (!isProcessAlive(run.pid)) {
      markRunFailed(run.id, "Process terminated unexpectedly");
    }
  }
}
```

### Timeout

Si un run dépasse son `timeoutSec`, le heartbeat :

1. Envoie SIGTERM au processus
2. Attend `graceSec`
3. Envoie SIGKILL si nécessaire
4. Marque le run comme `timed_out`

## Events émis

Le heartbeat émet des events via WebSocket :

| Event | Quand |
|-------|-------|
| `orchestrator.status` | L'orchestrateur change de statut (idle → running → idle) |
| `agent.status` | Un agent change de statut |
| `run.status` | Un run change de statut |

## Reprise après redémarrage

Quand Maestro redémarre (après un `dev` stop/start) :

1. Les runs en statut `running` sont vérifiees
2. Si le processus n'existe plus → marquer comme `failed` (orphelin)
3. Le heartbeat reprend son cycle normal
4. L'orchestrateur sera réveille au prochain tick pour évaluer la situation

## Purge automatique des logs

Les `run_events` de plus de **24 heures** sont purgés automatiquement à chaque tick du heartbeat :

```typescript
function purgeOldEvents() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  db.runEvents.deleteMany({ createdAt: { lt: cutoff } });
}
```

Les runs eux-mêmes (table `runs`) sont conservés indéfiniment pour l'historique et les statistiques de cout. Seuls les events détaillés (le flux stream-json) sont purgés.

## Structure technique

```
lib/
└── heartbeat/
    ├── scheduler.ts        # Boucle principale du heartbeat
    ├── orphan-reaper.ts    # Detection et nettoyage des runs orphelins
    └── log-purge.ts        # Purge des events > 24h
```

## Diagramme de séquence : heartbeat tick

```
Scheduler       OrchestratorService     AgentService        Claude Adapter
    │                   │                    │                     │
    │  tick              │                    │                     │
    ├──►                │                    │                     │
    │  purgeOldEvents() │                    │                     │
    ├──►                │                    │                     │
    │  reapOrphans()    │                    │                     │
    ├──►                │                    │                     │
    │                   │                    │                     │
    │  canRunOrchestrator()?                 │                     │
    ├──►  (no agent running, features exist) │                     │
    │                   │                    │                     │
    │  spawnOrchestrator()                   │                     │
    ├──────────────────►│                    │                     │
    │                   │ (claude CLI + MCP) │                     │
    │                   │                    │                     │
    │                   │ assign_task(       │                     │
    │                   │   backend-dev,     │                     │
    │                   │   MAE-1, prompt)   │                     │
    │                   ├───────────────────►│                     │
    │                   │                    │ spawn agent         │
    │                   │                    ├────────────────────►│
    │                   │                    │                     │
    │                   │ (orchestrateur     │                     │
    │                   │  se termine)       │                     │
    │◄──────────────────│                    │                     │
    │                   │                    │    (agent works)    │
    │                   │                    │◄────────────────────│
    │                   │                    │    (agent done)     │
```
