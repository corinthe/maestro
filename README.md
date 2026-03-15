# Maestro

Maestro est une plateforme d'orchestration d'agents IA pour le developpement logiciel. Elle se presente sous la forme d'un tableau kanban dans lequel un developpeur soumet des taches (features, bugs, refactoring, etc.) qui sont analysees, planifiees et executees par des agents IA specialises.

## Le concept

Au lieu de coder manuellement chaque fonctionnalite, le developpeur decrit ce qu'il veut. Maestro orchestre automatiquement une equipe d'agents IA (architecte, backend, frontend, testeur, etc.) qui collaborent pour produire le code, ouvrir une PR, et attendre la review humaine.

Le developpeur reste dans la boucle : il valide le plan avant l'execution, review la PR, et peut demander des corrections.

## Pourquoi Maestro ?

- **Les agents IA sont puissants isolement, mais difficiles a orchestrer ensemble.** Maestro gere la coordination : quel agent intervient, dans quel ordre, avec quel contexte.
- **Les prompts d'agents sont souvent perdus.** Maestro les versionnent comme du code dans Git, avec review et historique.
- **Le developpeur ne devrait pas quitter son workflow habituel.** Maestro produit des branches et des PR -- le resultat final est une code review classique.

## Vision MVP

Le MVP tourne entierement en local sur la machine du developpeur (ou sur un Raspberry Pi). Il utilise la CLI `claude` (Claude Code) comme moteur d'execution au lieu d'appeler directement les APIs LLM, ce qui permet de beneficier de l'abonnement existant et de toute la mecanique de tool use deja integree dans Claude Code.

## Stack technique MVP

- **Frontend** : React + un composant kanban (react-beautiful-dnd ou equivalent)
- **Backend** : Node.js (Express ou Fastify) + WebSocket
- **Worker** : Process Node qui spawn la CLI `claude` en sous-processus
- **Queue** : Bull (Redis) ou une simple queue in-memory pour le MVP
- **Base de donnees** : SQLite
- **Git** : CLI git + gh/az/glab pour les PR

## Documentation

| Document | Description |
|---|---|
| [FEATURES.md](./FEATURES.md) | Liste des fonctionnalites du MVP |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Architecture technique detaillee |
| [COMPONENTS.md](./COMPONENTS.md) | Description de chaque composant |
| [AGENTS.md](./AGENTS.md) | Systeme d'agents : templates, heritage, orchestration |
| [WORKFLOW.md](./WORKFLOW.md) | Workflow de bout en bout avec exemples |
| [KANBAN.md](./KANBAN.md) | Description du tableau kanban et de ses colonnes |
| [LLM-PROVIDER.md](./LLM-PROVIDER.md) | Abstraction LLM : CLI claude aujourd'hui, API demain |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Options de deploiement (local, Raspberry Pi, cloud) |
| [ROADMAP.md](./ROADMAP.md) | Evolution du MVP vers un produit complet |
