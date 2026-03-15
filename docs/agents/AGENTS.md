# Systeme d'agents

## Qu'est-ce qu'un agent ?

Un agent est un fichier markdown qui decrit une personnalite, un domaine d'expertise, des contraintes et des instructions. Ce fichier est injecte comme system prompt lorsqu'on appelle le LLM. Un agent est un template : il peut etre instancie plusieurs fois en parallele.

## Structure d'un template d'agent

Chaque agent est un fichier `.md` dans le dossier `agents/` :

```markdown
# Nom de l'agent

## Identite
Tu es un [role]. Tu es expert en [domaines].

## Responsabilites
- Ce que tu dois faire
- Ce sur quoi tu interviens

## Contraintes
- Ce que tu ne dois PAS faire
- Tes limites

## Conventions
- Style de code
- Patterns a suivre
- Outils a utiliser

## Output attendu
- Format de ta reponse
- Ce que l'orchestrateur attend de toi
```

## Les agents du MVP

### Orchestrateur (`orchestrator.md`)

L'agent le plus important. Il ne code pas. Il analyse la tache, identifie les agents necessaires, definit l'ordre d'execution et produit un plan structure.

```markdown
# Orchestrateur

## Identite
Tu es un chef de projet technique. Tu ne codes pas toi-meme.
Tu analyses les taches et produis des plans d'execution.

## Responsabilites
- Analyser la tache soumise
- Identifier les fichiers impactes
- Determiner quels agents sont necessaires
- Definir l'ordre d'execution (sequentiel ou parallele)
- Estimer la complexite

## Output attendu
Reponds TOUJOURS en JSON avec cette structure :
{
  "summary": "resume de la tache",
  "steps": [
    {
      "order": 1,
      "agent": "architect",
      "task": "description de la sous-tache",
      "depends_on": [],
      "parallel": false
    },
    {
      "order": 2,
      "agent": "backend",
      "task": "description",
      "depends_on": [1],
      "parallel": true
    },
    {
      "order": 2,
      "agent": "frontend",
      "task": "description",
      "depends_on": [1],
      "parallel": true
    },
    {
      "order": 3,
      "agent": "tester",
      "task": "description",
      "depends_on": [2],
      "parallel": false
    }
  ],
  "files_impacted": ["src/api/users.ts", "src/components/UserForm.tsx"],
  "questions": ["question pour le dev si quelque chose n'est pas clair"]
}
```

### Architecte (`architect.md`)

Produit le plan technique detaille : structure de fichiers, interfaces, contrats entre modules.

### Backend (`backend.md`)

Implemente le code backend. Suit le plan de l'architecte, respecte les conventions du projet.

### Frontend (`frontend.md`)

Implemente le code frontend. Suit le plan de l'architecte et le design system.

### Testeur (`tester.md`)

Ecrit les tests, lance les tests existants, verifie qu'il n'y a pas de regression.

### Reviewer (`reviewer.md`)

Relit le code produit par les autres agents, suggere des ameliorations, verifie la qualite.

## Contexte partage

En plus de son template, chaque agent recoit un contexte commun :

```
agents/
├── orchestrator.md
├── backend.md
├── ...
shared/
├── context.md          → description du projet, stack, objectifs
├── conventions.md      → regles de code, patterns, style
└── decisions.md        → decisions techniques prises (mises a jour au fil du temps)
```

Le contexte partage est injecte dans le prompt de chaque agent en plus de son SOUL.md.

## Memoire partagee

Les agents peuvent decouvrir des informations utiles pendant leur travail (ex: une API qui a change, une contrainte technique). Ces decouvertes sont :

1. Retournees dans la reponse de l'agent (champ `discoveries`)
2. Recuperees par l'orchestrateur
3. Persistees dans `shared/decisions.md` ou un store dedie
4. Injectees dans le contexte des agents futurs si pertinent

L'orchestrateur decide ce qui merite d'etre persiste. Tout n'est pas sauvegarde.

## Creer un nouvel agent

Pour ajouter un agent, il suffit de creer un fichier dans `agents/` :

```
agents/devops.md
```

L'agent registry le detecte automatiquement. L'orchestrateur doit etre informe de son existence (via le contexte partage ou son propre template mis a jour).

## Spawn multiple

Un agent est un template. L'orchestrateur peut decider de spawner plusieurs instances du meme agent :

```json
{
  "steps": [
    { "order": 1, "agent": "backend", "task": "module auth" },
    { "order": 1, "agent": "backend", "task": "module paiement" },
    { "order": 1, "agent": "backend", "task": "module notifications" }
  ]
}
```

Trois instances de l'agent backend tournent en parallele, chacune sur un module different. Chaque instance est un appel independant a la CLI claude avec le meme template mais un contexte/tache different.
