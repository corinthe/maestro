# Module Heartbeat

## Responsabilite

Scheduler autonome qui reveille periodiquement l'**orchestrateur** pour qu'il evalue l'etat du projet et delegue du travail aux agents. Gere aussi les wakeups manuels et la surveillance des runs en cours.

## Concept

Le heartbeat est un **cron interne** au serveur Maestro. A intervalles reguliers, il spawne l'orchestrateur (un agent Claude) qui decide quoi faire. Le heartbeat ne dispatche jamais directement du travail aux agents — c'est toujours l'orchestrateur qui decide.

L'utilisateur peut aussi declencher un wakeup manuel (via l'UI ou `npx maestro wake`), ce qui reveille immediatement l'orchestrateur.

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

Un wakeup manuel reveille immediatement l'orchestrateur :

```
POST /api/orchestrator/wake
```

Le wakeup ne force pas un run. Il spawne l'orchestrateur qui evalue si du travail doit etre fait.

Depuis le CLI :

```bash
npx maestro wake          # Reveille l'orchestrateur
```

## Guard : eviter les spawns inutiles

Avant de spawner l'orchestrateur, le heartbeat verifie qu'il y a effectivement quelque chose de nouveau a traiter. Sans cette guard, l'orchestrateur consommerait des tokens a chaque tick pour conclure "rien a faire".

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

## Surveillance des runs

Le heartbeat surveille les runs en cours (orchestrateur et agents) :

### Detection de runs orphelins

Un run peut devenir orphelin si le processus Claude CLI crashe. Le heartbeat detecte ces cas :

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

Si un run depasse son `timeoutSec`, le heartbeat :

1. Envoie SIGTERM au processus
2. Attend `graceSec`
3. Envoie SIGKILL si necessaire
4. Marque le run comme `timed_out`

## Events emis

Le heartbeat emet des events via WebSocket :

| Event | Quand |
|-------|-------|
| `orchestrator.status` | L'orchestrateur change de statut (idle → running → idle) |
| `agent.status` | Un agent change de statut |
| `run.status` | Un run change de statut |

## Reprise apres redemarrage

Quand Maestro redemarre (apres un `dev` stop/start) :

1. Les runs en statut `running` sont verifiees
2. Si le processus n'existe plus → marquer comme `failed` (orphelin)
3. Le heartbeat reprend son cycle normal
4. L'orchestrateur sera reveille au prochain tick pour evaluer la situation

## Purge automatique des logs

Les `run_events` de plus de **24 heures** sont purges automatiquement a chaque tick du heartbeat :

```typescript
function purgeOldEvents() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  db.runEvents.deleteMany({ createdAt: { lt: cutoff } });
}
```

Les runs eux-memes (table `runs`) sont conserves indefiniment pour l'historique et les statistiques de cout. Seuls les events detailles (le flux stream-json) sont purges.

## Structure technique

```
lib/
└── heartbeat/
    ├── scheduler.ts        # Boucle principale du heartbeat
    ├── orphan-reaper.ts    # Detection et nettoyage des runs orphelins
    └── log-purge.ts        # Purge des events > 24h
```

## Diagramme de sequence : heartbeat tick

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
