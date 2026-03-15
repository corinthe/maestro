# Glossaire

| Terme | Definition |
|---|---|
| **Agent** | Un template markdown (SOUL.md) qui decrit un role specialise (architecte, backend, etc.). Un agent est un blueprint : il peut etre instancie plusieurs fois. |
| **Agent Registry** | Le composant qui charge et fournit les templates d'agents depuis le dossier `agents/`. |
| **Carte** | Un element du kanban representant une tache. Contient la description, le plan, les logs, et le lien vers la PR. |
| **Contexte partage** | Ensemble de fichiers markdown (`shared/`) contenant les informations communes a tous les agents : stack technique, conventions, decisions. |
| **Decouverte** | Information utile trouvee par un agent pendant son travail (ex: une API qui a change). Persistee dans la memoire partagee pour les agents futurs. |
| **Human-in-the-loop** | Points du workflow ou un humain intervient : validation du plan (Ready) et review de la PR (Review). |
| **Instance** | Une execution concrete d'un agent. Le meme template peut etre instancie N fois en parallele avec des taches differentes. |
| **LLM Provider** | Couche d'abstraction qui isole l'orchestrateur du moyen d'appel au LLM (CLI claude ou API directe). |
| **Orchestrateur** | Agent special qui analyse les taches et produit des plans d'execution. Il ne code pas, il delegue. |
| **Plan** | Document JSON produit par l'orchestrateur qui decrit les etapes, les agents a utiliser, l'ordre, et les fichiers impactes. |
| **Queue** | File d'attente qui decouple la soumission des taches de leur execution. Garantit le traitement meme si le worker est occupe. |
| **SOUL.md** | Fichier markdown qui definit l'identite, les responsabilites, les contraintes et le format de sortie d'un agent. Inspire par GitAgent. |
| **Spawn** | Action de lancer une instance d'agent. Le worker "spawn" Claude Code avec le template de l'agent en system prompt. |
| **Worker** | Process qui prend les taches dans la queue et les execute en orchestrant les agents et en interagissant avec Git. |
