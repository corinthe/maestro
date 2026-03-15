# Workflow

## Workflow complet : de l'idee a la PR

Ce document decrit le parcours d'une tache de bout en bout.

## Exemple concret

> **Tache** : "Ajouter un endpoint GET /api/users avec pagination et filtrage par role"

---

### Etape 1 : Soumission (humain)

Le developpeur ouvre le kanban et cree une tache :

```
Titre : Endpoint GET /api/users avec pagination
Description :
  - Endpoint GET /api/users
  - Pagination par query params (page, limit)
  - Filtre optionnel par role (admin, user, viewer)
  - Retourne la liste + metadata de pagination
  - Authentification requise
```

La carte apparait dans la colonne **Inbox**.

---

### Etape 2 : Analyse (automatique)

Le worker prend la tache et lance l'orchestrateur.

L'orchestrateur :
1. Lit le contexte partage (stack, conventions, structure existante)
2. Identifie les fichiers existants pertinents (routes, modeles, middleware)
3. Produit un plan

```json
{
  "summary": "Ajout d'un endpoint REST pour lister les users avec pagination et filtrage",
  "steps": [
    {
      "order": 1,
      "agent": "architect",
      "task": "Definir la structure de la route, le schema de pagination, et les interfaces TypeScript",
      "depends_on": [],
      "parallel": false
    },
    {
      "order": 2,
      "agent": "backend",
      "task": "Implementer la route GET /api/users avec le service, le repository, et le middleware d'auth",
      "depends_on": [1],
      "parallel": false
    },
    {
      "order": 3,
      "agent": "tester",
      "task": "Ecrire les tests unitaires et d'integration pour le endpoint",
      "depends_on": [2],
      "parallel": false
    }
  ],
  "files_impacted": [
    "src/routes/users.ts",
    "src/services/userService.ts",
    "src/types/pagination.ts",
    "tests/routes/users.test.ts"
  ],
  "questions": []
}
```

La carte passe dans la colonne **Ready**. Le dev recoit une notification.

---

### Etape 3 : Validation (humain)

Le dev ouvre la carte, voit le plan. Il peut :

- **Approuver** tel quel → clique "Lancer"
- **Modifier** → ajoute un commentaire : "Ajoute aussi un filtre par date de creation"
  - Le plan est regenere avec le feedback
- **Rejeter** → la carte retourne dans Inbox

Le dev approuve. La carte passe dans **En cours**.

---

### Etape 4 : Execution (automatique)

Le worker execute le plan etape par etape :

#### 4.1 Agent architecte

```
Prompt : [template architect.md] + [contexte partage] + [tache du plan]
```

L'architecte (via Claude Code) :
- Lit la structure du projet
- Cree `src/types/pagination.ts` avec les interfaces
- Definit la structure de la route dans un commentaire ou document

#### 4.2 Agent backend

```
Prompt : [template backend.md] + [contexte partage] + [output architecte] + [tache du plan]
```

Le backend (via Claude Code) :
- Lit les fichiers existants
- Cree `src/routes/users.ts`
- Cree `src/services/userService.ts`
- Modifie `src/routes/index.ts` pour enregistrer la route

#### 4.3 Agent testeur

```
Prompt : [template tester.md] + [contexte partage] + [fichiers crees] + [tache du plan]
```

Le testeur (via Claude Code) :
- Lit le code produit
- Cree `tests/routes/users.test.ts`
- Lance les tests (`npm test`)
- Si un test echoue, corrige et relance

Pendant toute l'execution, le frontend affiche la progression en temps reel.

---

### Etape 5 : Finalisation (automatique)

Le worker :
1. `git add src/types/pagination.ts src/routes/users.ts src/services/userService.ts src/routes/index.ts tests/routes/users.test.ts`
2. `git commit -m "feat: add GET /api/users endpoint with pagination and role filtering"`
3. `git push -u origin feature/task-847`
4. `gh pr create --title "feat: GET /api/users with pagination" --body "..."`

La carte passe dans **Review**. Le dev recoit le lien de la PR.

---

### Etape 6 : Review (humain)

Le dev (ou un collegue) review la PR comme n'importe quelle PR :
- Commente
- Demande des changements
- Approuve

Si un commentaire demande une modification, le webhook GitHub notifie Maestro. L'orchestrateur relance l'agent backend avec le feedback. Nouveau commit sur la meme branche.

---

### Etape 7 : Done

La PR est mergee. La carte passe dans **Done**.

---

## Exemple parallele

> **Tache** : "Creer la page de profil utilisateur avec son API"

Plan de l'orchestrateur :

```
Etape 1 (sequentiel) : architecte → plan technique
Etape 2 (parallele)  : backend → API /api/users/:id
                        frontend → composant ProfilePage.tsx
Etape 3 (sequentiel) : testeur → tests API + tests composant
```

Le worker lance les agents backend et frontend en meme temps apres l'architecte. Le testeur attend que les deux aient fini.

---

## Gestion des erreurs

| Situation | Comportement |
|---|---|
| Agent timeout (> 5 min) | Kill le process, retry une fois, sinon → failed |
| Tests echouent | L'agent testeur tente de corriger (max 2 fois) |
| Build echoue | L'orchestrateur relance le dernier agent avec l'erreur |
| Conflit git | La tache passe en failed, le dev est notifie |
| Question non resolue | La tache reste en Ready, le dev voit la question |
| Trop de retries | La tache passe en failed avec les logs complets |
