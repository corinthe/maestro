# CLAUDE.md — Regles du projet Maestro

## Identite du projet

Maestro est une plateforme d'orchestration d'agents IA pour le developpement logiciel.
Stack : TypeScript, Node.js, React, SQLite, WebSocket.

## Architecture

### Structure DDD — organiser par domaine metier, pas par couche technique

```
src/
├── domain/
│   ├── task/          → entite Task, statuts, transitions, validation
│   ├── agent/         → AgentTemplate, AgentRegistry, SOUL.md loader
│   ├── orchestration/ → plan, execution, worker, queue
│   └── git/           → branches, commits, PR
├── infra/             → implementations concretes (SQLite, WebSocket, CLI claude)
├── api/               → routes HTTP (couche fine, pas de logique metier)
└── shared/            → types partages, erreurs, logger, utils
```

### Regles de structure

- Chaque domaine expose son interface via un fichier `index.ts` (barrel export)
- Les domaines ne s'importent jamais entre eux directement — ils passent par des interfaces
- L'infra implemente les interfaces definies dans les domaines (inversion de dependance)
- La couche `api/` est fine : elle valide l'input, appelle le domaine, formate l'output
- Pas de logique metier dans `api/` ni dans `infra/`

## Code quality

### Separation des responsabilites

- 1 fichier = 1 responsabilite unique
- Une fonction fait UNE chose. Si le nom contient "and" ou "et", c'est deux fonctions
- La taille n'est pas un probleme en soi — le melange de responsabilites, si
- Preferer des fonctions pures (input → output, pas d'effet de bord) quand c'est possible

### Nommage

- Noms explicites et descriptifs, jamais d'abreviations ambigues
- Variables : `camelCase`
- Types/Interfaces/Classes : `PascalCase`
- Fichiers : `kebab-case.ts`
- Constantes : `UPPER_SNAKE_CASE`
- Les noms de fonctions commencent par un verbe : `createTask`, `parseAgentPlan`, `validateTransition`
- Les booleens commencent par `is`, `has`, `can`, `should` : `isValid`, `hasAgent`, `canTransition`

### TypeScript

- `strict: true` obligatoire
- Pas de `any` sauf cas exceptionnels documentes avec un commentaire `// eslint-disable-next-line`
- Preferer les `interface` pour les contrats entre modules, `type` pour les unions et utilitaires
- Typer les retours de fonctions explicitement (pas d'inference pour les fonctions exportees)
- Utiliser les discriminated unions pour les etats (statuts de tache, resultats d'agents)

## Tests

### Methodologie

- TDD pour la logique metier : ecrire le test AVANT l'implementation
  - Transitions de statut, validation, parsing de plan, regles d'orchestration
- Test-after pour l'infra : l'API se stabilise en codant, tester ensuite
  - SQLite repositories, WebSocket, CLI claude provider
- Chaque fichier `foo.ts` a son fichier de test `foo.test.ts` dans le meme dossier

### Framework

- Vitest comme test runner
- Pas de mocks sauf pour les frontieres externes (CLI claude, filesystem, reseau)
- Les domaines se testent avec de vrais objets, pas de mocks internes
- Chaque test a un nom qui decrit le comportement attendu en francais :
  `"doit refuser la transition inbox → running"`

### Couverture

- Chaque feature livree est accompagnee de ses tests
- Les cas d'erreur sont testes autant que les cas nominaux

## Gestion des erreurs

### Principe : une erreur doit expliquer QUOI, POURQUOI, et COMMENT resoudre

Jamais un message comme `"Error"` ou `"Something went wrong"`.
Toujours trois informations :

1. **Quoi** : ce qui s'est passe
2. **Pourquoi** : la cause probable
3. **Comment** : ce que l'utilisateur/developpeur peut faire

### Erreurs metier typees

Chaque domaine definit ses propres classes d'erreur qui etendent une classe de base :

```typescript
// shared/errors/base-error.ts
export class MaestroError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context: Record<string, unknown> = {},
    public readonly suggestion?: string
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

// domain/task/errors.ts
export class InvalidTaskTransitionError extends MaestroError {
  constructor(taskId: string, from: string, to: string) {
    super(
      `Impossible de passer la tache "${taskId}" de "${from}" a "${to}"`,
      "TASK_INVALID_TRANSITION",
      { taskId, from, to },
      `Transitions valides depuis "${from}": ${getValidTransitions(from).join(", ")}`
    );
  }
}
```

### Regles

- Ne jamais avaler une erreur silencieusement (`catch {}` vide interdit)
- Toujours enrichir l'erreur avec du contexte avant de la propager
- Les erreurs inattendues (bugs) sont distinctes des erreurs metier (comportement prevu)
- En API, retourner un JSON structure avec `code`, `message`, `suggestion`, et `details`
- Pas de stack trace en reponse API (seulement dans les logs)

## Logging

### Principe : tout ce qui se passe doit etre tracable

Le systeme de log doit permettre de reconstituer le parcours complet d'une tache,
de la soumission a la PR, en lisant les logs.

### Niveaux de log

| Niveau | Usage | Exemple |
|--------|-------|---------|
| `error` | Quelque chose a echoue | `Agent backend a echoue apres 3 tentatives` |
| `warn` | Situation anormale mais geree | `Timeout agent, retry 2/3` |
| `info` | Evenement metier significatif | `Tache #847 passee en status "ready"` |
| `debug` | Detail technique pour le debugging | `Prompt envoye a l'agent: 1240 chars` |

### Regles

- Utiliser un logger structure (pino) qui produit du JSON en production et du texte lisible en dev
- Chaque log inclut un contexte : `taskId`, `agentName`, `step`, etc.
- Les operations longues loggent leur debut ET leur fin avec la duree
- Les appels externes (CLI claude, git, API) sont toujours logges avec input/output
- En cas d'erreur, le log inclut la stack trace, le contexte, et l'erreur originale
- Ne jamais logger de donnees sensibles (tokens, cles API, mots de passe)

### Format

```typescript
// Bon
logger.info({ taskId, status: "ready", planSteps: 3 }, "Plan genere et en attente de validation");
logger.error({ taskId, agent: "backend", attempt: 2, error: err.message }, "Echec agent, nouvelle tentative");

// Mauvais
logger.info("task ready");
console.log("error:", err);
```

## Refactoring

### Quand refactorer

- Apres chaque feature terminee (tests verts) : regarder ce qui peut etre simplifie
- Quand un fichier ou une fonction melange plusieurs responsabilites
- Quand du code est duplique a 3 endroits ou plus
- Quand un nom ne reflete plus ce que fait le code

### Comment

- Toujours sous couvert de tests verts — ne jamais refactorer sans filet de tests
- Un commit de refactoring est separe du commit de feature
- Prefixer le message : `refactor: extract plan validation into dedicated module`

## Git

### Commits

- Messages en anglais, prefixes conventionnels : `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`
- Un commit = un changement logique. Ne pas melanger feature et refactoring dans le meme commit

### Branches

- `feature/nom-court` pour les features
- `fix/nom-court` pour les bugs
- `refactor/nom-court` pour le refactoring

## CLI Claude (LLM Provider)

### Regles d'integration

- Utiliser `spawn` sans `shell: true` — le shell casse les arguments contenant du texte libre (prompts)
- Toujours passer `--dangerously-skip-permissions` pour que les agents puissent ecrire sans confirmation
- Pour le streaming : `--print --output-format stream-json --verbose` (pas `--stream-text` qui n'existe pas)
- Le format stream-json n'est PAS le format de l'API Anthropic. Les types d'evenements sont :
  - `{"type":"system"}` — init (ignorer)
  - `{"type":"assistant","message":{"content":[{"type":"text","text":"..."}]}}` — contenu
  - `{"type":"result","result":"..."}` — resultat final
- Sans streaming : `--print` seul retourne le texte brut

### Frontend (web/)

- SPA React dans `web/`, build avec Vite
- Le WebSocket client se connecte sur le path `/ws` (pas la racine), aligne avec le proxy Vite
- React 19 : utiliser `React.JSX.Element` (pas `JSX.Element`)
- Proxy Vite en dev : `/api` → `:4000`, `/ws` → WebSocket `:4000`
- Serving statique en prod : le backend sert `web/dist/` avec fallback SPA
- Scripts : `npm run dev:full` lance backend + frontend en parallele

## Dependencies

- Minimaliser les dependances externes
- Justifier chaque nouvelle dependance (pourquoi pas une solution maison ?)
- Dependances prevues pour le MVP :
  - `express` ou `fastify` — serveur HTTP
  - `better-sqlite3` — base de donnees
  - `ws` — WebSocket
  - `pino` — logger structure
  - `vitest` — tests
  - `zod` — validation de schemas
  - `uuid` — generation d'identifiants
  - `react`, `react-dom` — UI
  - `react-router-dom` — routing frontend
  - `vite`, `@vitejs/plugin-react` — build tool frontend
