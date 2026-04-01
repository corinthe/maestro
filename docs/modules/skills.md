# Module Skills & Prompts

## Responsabilite

Gestion de la bibliotheque de skills (au format natif Claude Code) et des templates de prompts. Les skills sont attaches aux agents pour guider leur comportement. A terme, ils pourront etre partages via un registre centralise.

## Concepts

### Skill

Un **skill** est un fichier Markdown au format natif Claude Code. Il contient des instructions, du contexte, ou des patterns que Claude doit suivre.

```markdown
# Code Review

When reviewing code, follow these guidelines:
- Check for security vulnerabilities (OWASP top 10)
- Verify error handling is comprehensive
- Ensure tests cover edge cases
- Look for performance anti-patterns
- Validate naming conventions match the project style
```

Les skills sont stockes dans `.maestro/skills/` et sont injectes dans Claude via le flag `--add-dir`.

### Prompt template

Un **prompt template** est le template utilise pour construire le prompt envoye a Claude lors d'un run. Il combine le contexte de la feature avec les instructions de l'agent.

```
You are agent "{{agent.name}}".
{{agent.instructions}}

Your current task:
Feature: {{feature.title}}
Description: {{feature.description}}
Branch: {{feature.branch}}

{{#if previousRun}}
This is a continuation. Your previous run ended with status: {{previousRun.status}}.
{{#if previousRun.summary}}
Summary of your previous work: {{previousRun.summary}}
{{/if}}
{{/if}}

Work in the current directory. Commit your changes when you reach a good stopping point.
```

## Skills locaux

### Stockage

```
.maestro/
└── skills/
    ├── code-review.md
    ├── testing-strategy.md
    ├── react-patterns.md
    └── api-conventions.md
```

### Attachement aux agents

Dans la configuration d'un agent :

```yaml
# .maestro/agents/backend-dev.yml
skills:
  - code-review        # → .maestro/skills/code-review.md
  - testing-strategy   # → .maestro/skills/testing-strategy.md
```

### Injection dans Claude CLI

Avant chaque run, Maestro :

1. Cree un repertoire temporaire avec les skills de l'agent
2. Y copie ou symlinke les fichiers `.md` concernes
3. Passe `--add-dir <temp-skills-dir>` a Claude CLI
4. Nettoie le repertoire temporaire apres le run

## Registre centralise (futur)

Le registre permettra de partager des skills et des configurations d'agents entre projets et equipes.

### Vision

```
┌──────────────┐     push/pull     ┌──────────────────┐
│   .maestro/  │ ◄───────────────► │  Registre central │
│   skills/    │                   │  (API HTTP)       │
│   agents/    │                   │                   │
└──────────────┘                   │  Skills publics   │
                                   │  Skills d'equipe  │
                                   │  Agents templates │
                                   └──────────────────┘
```

### Operations envisagees

```
# Publier un skill sur le registre
npx maestro skill push code-review

# Installer un skill depuis le registre
npx maestro skill pull @team/api-conventions

# Lister les skills disponibles
npx maestro skill search "testing"
```

### Scope

- **Publics** : accessibles a tous
- **Equipe** : scopes a une organisation (`@team/skill-name`)
- **Prives** : accessibles uniquement au createur

> Le registre n'est pas dans le scope du MVP. Les skills sont geres localement dans le repo.

## Gestion via l'UI

L'interface permet de :

- **Lister** les skills du projet
- **Creer** un nouveau skill (editeur Markdown)
- **Editer** un skill existant
- **Supprimer** un skill
- **Voir** quels agents utilisent un skill
- **Attacher/detacher** un skill d'un agent

## Structure technique

```
lib/
└── skills/
    ├── skill-service.ts     # CRUD sur les fichiers .md
    ├── skill-injector.ts    # Preparation du repertoire temporaire
    └── prompt-builder.ts    # Construction du prompt a partir du template
```

## Distinction skill vs agent

| | Skill | Agent |
|---|---|---|
| **Nature** | Fichier d'instructions (`.md`) | Entite d'execution avec config |
| **Persistance** | Fichier dans `.maestro/skills/` | Fichier YAML dans `.maestro/agents/` |
| **Relation** | Attache a un ou plusieurs agents | Utilise un ou plusieurs skills |
| **Partage** | Via registre (futur) | Via registre (futur) |
| **Exemples** | "code-review", "testing-strategy" | "backend-dev", "frontend-dev" |
