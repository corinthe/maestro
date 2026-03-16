# Dette technique & Améliorations

> Revue effectuée le 2026-03-15. Ce document recense les points d'amélioration identifiés.
> Statuts : `todo` | `in-progress` | `done` | `wont-fix`

---

## Architecture & Résilience

### 1. Queue et EventBus en mémoire
- **Statut :** `todo`
- **Priorité :** Moyenne
- **Description :** `InMemoryTaskQueue` et `InMemoryEventBus` perdent tout état au redémarrage. Si le serveur crash pendant l'exécution d'une tâche, elle est perdue.
- **Action :** Persister la queue dans SQLite et ajouter un mécanisme de recovery au démarrage.

### 2. Fire-and-forget sur POST /approve
- **Statut :** `todo`
- **Priorité :** Moyenne
- **Description :** L'endpoint renvoie 200 immédiatement et exécute en background avec un `.catch()` silencieux. Le client n'a aucun moyen de savoir si l'exécution a échoué.
- **Action :** Retourner un `executionId` et exposer un endpoint de suivi de l'exécution.

### 3. Pas de graceful shutdown
- **Statut :** `done`
- **Priorité :** Haute
- **Description :** `src/index.ts` ne gère pas `SIGTERM`/`SIGINT`. Les tâches en cours seront coupées brutalement.
- **Action :** Intercepter les signaux, drainer la queue, attendre la fin des steps en cours avant de fermer.

### 4. Pas de health check DB au démarrage
- **Statut :** `todo`
- **Priorité :** Basse
- **Description :** Le worker démarre sans vérifier que la base SQLite est accessible et saine.
- **Action :** Ajouter une vérification de santé de la DB avant de lancer le worker.

---

## Worker

### 5. Classe Worker trop chargée (~315 lignes)
- **Statut :** `todo`
- **Priorité :** Haute
- **Description :** Le `Worker` cumule analyse, parsing de plan, exécution des steps, gestion git et retry. C'est le candidat principal pour un refactoring.
- **Action :** Extraire en services dédiés : `AnalysisService`, `StepExecutionService`, `FinalizationService`.

### 6. Retry limité et non configurable
- **Statut :** `todo`
- **Priorité :** Moyenne
- **Description :** 2 tentatives seulement, sans backoff exponentiel configurable. Pas de distinction entre erreurs transitoires (timeout LLM) et erreurs permanentes (agent introuvable).
- **Action :** Rendre le retry configurable, ajouter un backoff exponentiel, classifier les erreurs (transitoire vs permanente).

---

## API & Sécurité

### 7. Aucun rate limiting
- **Statut :** `todo`
- **Priorité :** Moyenne
- **Description :** L'API est ouverte sans protection contre le flooding.
- **Action :** Ajouter `express-rate-limit` ou équivalent.

### 8. Pas de validation des paramètres d'URL
- **Statut :** `todo`
- **Priorité :** Basse
- **Description :** Les `:id` dans les routes ne sont pas validés (format UUID attendu ?).
- **Action :** Ajouter un middleware ou un schéma Zod pour valider le format des paramètres d'URL.

### 9. Pas de CORS configuré
- **Statut :** `todo`
- **Priorité :** Basse
- **Description :** Si un frontend React doit consommer l'API, CORS devra être configuré explicitement.
- **Action :** Ajouter le middleware CORS avec une whitelist d'origines configurable.

### 10. Pas de pagination sur GET /api/tasks
- **Statut :** `todo`
- **Priorité :** Haute
- **Description :** Avec beaucoup de tâches, cette route renverra tout en mémoire d'un coup.
- **Action :** Ajouter `limit`/`offset` (ou cursor-based pagination) tôt pour éviter un refactoring douloureux plus tard.

---

## Tests

### 11. Données de test dupliquées
- **Statut :** `todo`
- **Priorité :** Moyenne
- **Description :** Les JSON de plans sont copiés-collés dans plusieurs fichiers de test.
- **Action :** Créer un module `test-fixtures/` partagé avec les données de test communes.

### 12. Tests WebSocket fragiles
- **Statut :** `todo`
- **Priorité :** Basse
- **Description :** Les tests WebSocket dépendent de timings (`setTimeout`) pour la connexion.
- **Action :** Remplacer par des mécanismes event-driven (attendre l'event `open`).

### 13. Pas de tests d'intégration end-to-end
- **Statut :** `todo`
- **Priorité :** Moyenne
- **Description :** Chaque couche est bien testée isolément, mais aucun test ne vérifie le flux complet `POST /tasks` → analyse → approve → exécution → PR.
- **Action :** Ajouter un ou deux tests E2E avec un `FakeLLMProvider` qui simulent le parcours complet.

---

## Patterns de code

### 14. console.log résiduels potentiels
- **Statut :** `todo`
- **Priorité :** Basse
- **Description :** Le logger Pino devrait être l'unique point de sortie. Vérifier qu'aucun `console.log` ne traîne.
- **Action :** Ajouter une règle ESLint `no-console` pour interdire les `console.*` en dehors du logger.

### 15. Gestion des timezones sur les dates
- **Statut :** `todo`
- **Priorité :** Basse
- **Description :** Les dates sont stockées en ISO string dans SQLite sans timezone explicite. Si le serveur change de TZ, les dates existantes deviennent ambiguës.
- **Action :** S'assurer que toutes les dates sont stockées en UTC explicite.

---

## Outillage & CI

### 16. Pas de linter/formatter configuré
- **Statut :** `todo`
- **Priorité :** Moyenne
- **Description :** Ni ESLint ni Prettier dans le projet. Les conventions de CLAUDE.md sont respectées manuellement.
- **Action :** Configurer ESLint + Prettier avec les règles du projet.

### 17. Pas de pre-commit hooks
- **Statut :** `todo`
- **Priorité :** Basse
- **Description :** Rien n'empêche de commiter du code non formaté ou avec des erreurs de lint.
- **Action :** Ajouter Husky + lint-staged.

### 18. Phase git du worker échoue : aucun fichier à committer
- **Statut :** `todo`
- **Priorité :** Haute
- **Description :** Après l'exécution des agents, le worker tente `git commit` mais `filesImpacted` est vide (0 fichiers). Deux causes :
  1. L'orchestrateur ne retourne pas de `files_impacted` pertinents dans le plan
  2. Les agents écrivent dans le `WORKING_DIR` (qui est Maestro lui-même), pas dans un projet cible séparé
  3. Même si les agents écrivent des fichiers, le worker ne fait un `git add` que sur `filesImpacted` du plan — il ne détecte pas les fichiers réellement modifiés par les agents
- **Logs :** `files: 0, message: "feat: ..."` → `git commit -m ...` échoue car rien n'est staged
- **Action :**
  - Configurer un `WORKING_DIR` distinct pour le projet cible (sera résolu par la feature 5 — contexte projet)
  - Après exécution des agents, détecter les fichiers réellement modifiés (`git status --porcelain`) plutôt que se fier uniquement à `filesImpacted`
  - Gérer le cas où il n'y a rien à committer (skip git au lieu d'échouer)

### 19. package-lock.json modifié non commité
- **Statut :** `todo`
- **Priorité :** Basse
- **Description :** Le git status montre des changements non commités sur `package-lock.json`, risque de dérive de dépendances.
- **Action :** Commiter ou régénérer le lockfile proprement.
