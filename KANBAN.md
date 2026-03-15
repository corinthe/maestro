# Tableau Kanban

## Colonnes

```
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│  Inbox   │ │ Analyse  │ │  Ready   │ │ En cours │ │  Review  │ │   Done   │
│          │ │          │ │          │ │          │ │          │ │          │
│ Taches   │ │ L'orches-│ │ Plan     │ │ Agents   │ │ PR       │ │ PR       │
│ brutes   │ │ trateur  │ │ pret,    │ │ en train │ │ ouverte  │ │ mergee   │
│ soumises │ │ analyse  │ │ en       │ │ de coder │ │ en       │ │          │
│ par les  │ │          │ │ attente  │ │          │ │ attente  │ │          │
│ devs     │ │          │ │ de       │ │          │ │ de       │ │          │
│          │ │          │ │ validation│ │          │ │ review   │ │          │
└──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘
```

## Transitions

```
Inbox ──────► Analyse        automatique (worker prend la tache)
Analyse ────► Ready          automatique (plan genere)
Analyse ────► Inbox          automatique (si l'orchestrateur a des questions bloquantes)
Ready ──────► En cours       manuelle (le dev valide le plan)
Ready ──────► Inbox          manuelle (le dev rejette le plan)
En cours ───► Review         automatique (PR ouverte)
En cours ───► Failed         automatique (erreur non recuperable)
Review ─────► En cours       automatique (commentaire PR declenche un agent)
Review ─────► Done           manuelle (PR mergee, detectee par webhook)
```

## Contenu d'une carte

### Vue kanban (resume)

```
┌─────────────────────────────────┐
│ #847 GET /api/users             │
│                                 │
│ Backend · Testeur               │  ← agents impliques
│ 3 fichiers · ~45k tokens        │  ← estimation
│                                 │
│ ██████████░░ 75%                │  ← progression
│                                 │
│ il y a 2 min                    │
└─────────────────────────────────┘
```

### Vue detail (au clic)

```
┌──────────────────────────────────────────────────────┐
│ #847 - Endpoint GET /api/users avec pagination       │
│ Statut : En cours                                    │
│ Branche : feature/task-847                           │
│                                                      │
│ ── Description ──────────────────────────────────── │
│ Endpoint GET /api/users                              │
│ Pagination par query params (page, limit)            │
│ Filtre optionnel par role                            │
│                                                      │
│ ── Plan ─────────────────────────────────────────── │
│ 1. [OK] Architecte : interfaces et structure         │
│ 2. [>>] Backend : implementation route + service     │
│ 3. [..] Testeur : tests unitaires et integration     │
│                                                      │
│ ── Fichiers modifies ───────────────────────────── │
│ + src/types/pagination.ts                            │
│ + src/routes/users.ts                                │
│ + src/services/userService.ts                        │
│ ~ src/routes/index.ts                                │
│                                                      │
│ ── Logs agent en cours ─────────────────────────── │
│ [backend] Lecture de src/routes/index.ts...           │
│ [backend] Creation de src/routes/users.ts...         │
│ [backend] Creation de src/services/userService.ts... │
│                                                      │
│ ── Actions ──────────────────────────────────────── │
│ [ Interrompre ]  [ Voir la PR ]                      │
└──────────────────────────────────────────────────────┘
```

## Colonne speciale : Failed

Les taches en echec ne disparaissent pas. Elles apparaissent dans une colonne ou section separee avec :
- Le message d'erreur
- Les logs complets
- La possibilite de relancer (retry) ou d'abandonner

```
┌─────────────────────────────────┐
│ #832 Refactoring auth module    │
│                                 │
│ ECHEC : tests echouent apres   │
│ 3 tentatives                   │
│                                 │
│ [ Relancer ] [ Abandonner ]     │
└─────────────────────────────────┘
```
