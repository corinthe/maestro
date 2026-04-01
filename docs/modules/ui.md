# Module UI

## Responsabilité

Interface web principale de Maestro. Dashboard temps réel pour gérer les features, observer les agents, et intervenir sur leur travail.

## Design system

### Principes visuels

- **Minimaliste** : peu d'elements décoratifs, focus sur le contenu
- **Accents de couleur** : une couleur primaire (violet/indigo) pour les actions et statuts importants, le reste en niveaux de gris
- **Typographie** : Inter ou Geist, sans-serif, tailles réduites
- **Espacement** : génèreux, aéré, inspiré de Linear
- **Pas de dark mode** pour l'instant
- **Pas de raccourcis clavier** pour l'instant

### Palette

| Usage | Couleur |
|-------|---------|
| Fond principal | `#FAFAFA` (gris tres clair) |
| Fond carte | `#FFFFFF` |
| Texte principal | `#1A1A1A` |
| Texte secondaire | `#6B7280` |
| Bordures | `#E5E7EB` |
| Accent primaire | `#6366F1` (indigo) |
| Succes | `#10B981` |
| Erreur | `#EF4444` |
| Warning | `#F59E0B` |
| En cours | `#3B82F6` |

### Composants shadcn utilises

- `Card` : conteneurs principaux
- `Button` : actions
- `Badge` : statuts (idle, running, succeeded, failed)
- `Dialog` : modales de creation/édition
- `Tabs` : navigation secondaire
- `ScrollArea` : zones scrollables (logs, activity)
- `Avatar` : identité visuelle des agents
- `Tooltip` : informations contextuelles
- `DropdownMenu` : actions contextuelles
- `Input`, `Textarea`, `Select` : formulaires
- `Separator` : divisions visuelles

## Pages et layouts

### Layout principal

```
┌──────────────────────────────────────────────────────────────┐
│  Sidebar (fixe, 240px)  │           Contenu principal        │
│                          │                                    │
│  ┌────────────────────┐ │                                    │
│  │ Maestro             │ │                                    │
│  │    my-project       │ │                                    │
│  ├────────────────────┤ │                                    │
│  │ Dashboard           │ │                                    │
│  │ Features            │ │                                    │
│  │ Agents              │ │                                    │
│  │ Activity            │ │                                    │
│  ├────────────────────┤ │                                    │
│  │ Skills              │ │                                    │
│  │ Settings            │ │                                    │
│  ├────────────────────┤ │                                    │
│  │ Orchestrator  ● run │ │                                    │
│  │ Agents:             │ │                                    │
│  │  ● backend-dev  run │ │                                    │
│  │  ○ frontend-dev idle│ │                                    │
│  └────────────────────┘ │                                    │
└──────────────────────────┴────────────────────────────────────┘
```

### Page Dashboard (`/`)

Vue d'ensemble du projet.

```
┌─────────────────────────────────────────────────────┐
│  Dashboard                                          │
│                                                     │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│  │ 5       │ │ 2       │ │ 3       │ │ 1       │  │
│  │ Total   │ │ Running │ │ Pending │ │ Done    │  │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘  │
│                                                     │
│  Activite recente                                   │
│  ┌─────────────────────────────────────────────┐    │
│  │ 14:32  backend-dev  Commit: add auth module │    │
│  │ 14:28  backend-dev  Tool: Edit user.ts      │    │
│  │ 14:15  frontend-dev Run completed           │    │
│  │ 14:01  backend-dev  Run started             │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  Features en cours                                  │
│  ┌─────────────────────────────────────────────┐    │
│  │ feat/user-auth     backend-dev    Running   │    │
│  │ feat/dashboard     frontend-dev   Pending   │    │
│  │ feat/api-tests     backend-dev    Queued    │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

### Page Features (`/features`)

Liste des features à la manière de Linear : liste compacte, statuts colorés, drag-and-drop optionnel.

```
┌────────────────────────────────────────────────────────────┐
│  Features                              [+ New feature]     │
│                                                            │
│  Filtres: [All ▾] [All agents ▾]                           │
│                                                            │
│  ● In Progress                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ ▸ MAE-1  Implement user authentication   backend-dev │  │
│  │ ▸ MAE-2  Build dashboard components     frontend-dev │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  ○ Backlog                                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ ▸ MAE-3  Add API integration tests      unassigned   │  │
│  │ ▸ MAE-4  Setup CI pipeline              unassigned   │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  ✓ Done                                                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ ▸ MAE-5  Project scaffolding            backend-dev  │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

### Page Feature detail (`/features/:id`)

```
┌────────────────────────────────────────────────────────────┐
│  ← Features    MAE-1  Implement user authentication        │
│                                                            │
│  Status: In Progress    Agent: backend-dev    Branch: feat/│
│                                                            │
│  Description                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Implement JWT-based user authentication with login,  │  │
│  │ register, and token refresh endpoints.               │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  Runs                                                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Run #3  Running   Started 4m ago    [Stop] [View]   │  │
│  │ Run #2  Failed    12m ago           [Restart] [View]│  │
│  │ Run #1  Succeeded 45m ago           [View]          │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

### Page Run detail / Live view (`/runs/:id`)

C'est la page la plus critique : le flux en direct de ce que fait l'agent.

```
┌────────────────────────────────────────────────────────────┐
│  Run #3 — MAE-1 — backend-dev                   ● Live    │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                                                      │  │
│  │  [system] Claude initialized (sonnet-4-6, session:x) │  │
│  │                                                      │  │
│  │  [thinking] I need to create the auth module with... │  │
│  │                                                      │  │
│  │  [assistant] I'll start by creating the JWT          │  │
│  │  utility functions and the auth middleware.          │  │
│  │                                                      │  │
│  │  [tool_call] Edit src/auth/jwt.ts                    │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │ + import jwt from 'jsonwebtoken'               │  │  │
│  │  │ + export function signToken(payload) { ... }   │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  │                                                      │  │
│  │  [tool_result] File edited successfully              │  │
│  │                                                      │  │
│  │  [assistant] Now I'll create the auth middleware...  │  │
│  │                                                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Leave a message for the next run...        [Send]   │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  [Stop run]  [Restart]                                     │
└────────────────────────────────────────────────────────────┘
```

> Note : le message n'est pas injecté pendant le run. Il est stocké et transmis
> à l'orchestrateur au prochain réveil, qui l'intègre dans le prompt du run suivant.

### Page Agents (`/agents`)

```
┌─────────────────────────────────────────────────────────┐
│  Agents                                  [+ New agent]  │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │  backend-dev                                    │    │
│  │  Model: claude-sonnet-4-6  Status: ● Running    │    │
│  │  Current: feat/user-auth   Runs: 12  Cost: $0.45│    │
│  │                           [Configure] [Stop]    │    │
│  ├─────────────────────────────────────────────────┤    │
│  │  frontend-dev                                   │    │
│  │  Model: claude-sonnet-4-6  Status: ○ Idle       │    │
│  │  Current: —               Runs: 5   Cost: $0.12 │    │
│  │                           [Configure] [Wake]    │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

### Page Agent proposals (dans `/agents` ou notification)

Quand l'orchestrateur propose un nouvel archetype d'agent, une notification apparaît dans l'UI :

```
┌────────────────────────────────────────────────────────────┐
│  New agent proposal from orchestrator                      │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  qa-engineer                                         │  │
│  │  "Runs tests and validates features before           │  │
│  │   marking them as done"                              │  │
│  │                                                      │  │
│  │  Rationale: Several features have been completed     │  │
│  │  without test validation. A QA agent would catch     │  │
│  │  regressions early.                                  │  │
│  │                                                      │  │
│  │  Model: claude-sonnet-4-6                            │  │
│  │  Skills: testing-strategy                            │  │
│  │                                        [Accept] [Reject] │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

### Page Skills (`/skills`)

```
┌─────────────────────────────────────────────────────────┐
│  Skills                                  [+ New skill]  │
│                                                         │
│  Local                                                  │
│  ┌─────────────────────────────────────────────────┐    │
│  │  code-review.md          Used by: all agents    │    │
│  │  testing-strategy.md     Used by: backend-dev   │    │
│  │  react-patterns.md       Used by: frontend-dev  │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  Registry (future)                                      │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Coming soon — browse and install shared skills │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

## Structure technique

```
app/
├── layout.tsx                  # Layout racine + sidebar
├── page.tsx                    # Dashboard
├── features/
│   ├── page.tsx                # Liste des features
│   └── [id]/
│       └── page.tsx            # Detail feature
├── agents/
│   ├── page.tsx                # Liste des agents
│   └── [id]/
│       └── page.tsx            # Configuration agent
├── runs/
│   └── [id]/
│       └── page.tsx            # Live view d'un run
├── skills/
│   └── page.tsx                # Gestion des skills
├── settings/
│   └── page.tsx                # Configuration globale
├── activity/
│   └── page.tsx                # Flux d'activite global
└── globals.css                 # Styles Tailwind + overrides

components/
├── ui/                         # Composants shadcn (generes)
├── layout/
│   ├── sidebar.tsx
│   ├── sidebar-agent-status.tsx
│   └── page-header.tsx
├── features/
│   ├── feature-list.tsx
│   ├── feature-card.tsx
│   ├── feature-form.tsx
│   └── feature-status-badge.tsx
├── agents/
│   ├── agent-card.tsx
│   ├── agent-config-form.tsx
│   └── agent-status-indicator.tsx
├── runs/
│   ├── run-live-view.tsx       # Composant principal du flux en direct
│   ├── run-event.tsx           # Rendu d'un event individuel
│   ├── run-message-input.tsx   # Zone d'envoi de message (entre runs)
│   └── run-controls.tsx        # Boutons stop/restart
├── orchestrator/
│   ├── orchestrator-status.tsx # Indicateur de statut
│   └── proposal-card.tsx       # Carte de proposition d'agent
├── skills/
│   ├── skill-list.tsx
│   └── skill-editor.tsx
└── dashboard/
    ├── stats-cards.tsx
    ├── recent-activity.tsx
    └── active-features.tsx

hooks/
├── use-websocket.ts            # Connexion WebSocket + reconnexion auto
├── use-agents.ts               # SWR/React Query pour les agents
├── use-features.ts
├── use-runs.ts
└── use-run-events.ts           # Stream d'events d'un run
```

## Gestion du temps réel

Le hook `useWebSocket` maintient une connexion persistante et dispatch les events vers les composants concernés :

```typescript
// Simplifie
function useWebSocket() {
  const ws = useRef<WebSocket>();

  useEffect(() => {
    ws.current = new WebSocket(`ws://localhost:${port}/api/ws`);
    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      // Dispatch vers le bon handler selon data.type
      eventBus.emit(data.type, data);
    };
    // Reconnexion automatique avec backoff
  }, []);
}
```

Les composants s'abonnent aux events qui les concernént :

```typescript
// Dans run-live-view.tsx
useEffect(() => {
  const unsubscribe = eventBus.on("run.event", (data) => {
    if (data.runId === runId) {
      appendEvent(data.event);
    }
  });
  return unsubscribe;
}, [runId]);
```
