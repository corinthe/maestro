# Features MVP

## Tableau Kanban

- [ ] Board kanban avec colonnes configurables
- [ ] Creation de taches via formulaire texte libre
- [ ] Drag & drop manuel des cartes entre colonnes
- [ ] Transitions automatiques declenchees par les agents
- [ ] Affichage temps reel de l'activite des agents (via WebSocket)
- [ ] Lien direct vers la PR generee depuis la carte
- [ ] Possibilite d'interrompre une tache en cours

## Gestion des agents

- [ ] Templates d'agents stockes en fichiers markdown (SOUL.md)
- [ ] Chargement dynamique des templates depuis un dossier local
- [ ] Agent orchetrateur qui analyse la tache et produit un plan
- [ ] Agents specialises : architecte, backend, frontend, testeur
- [ ] Possibilite de creer de nouveaux agents en ajoutant un fichier
- [ ] Contexte partage entre agents (conventions, stack, decisions)

## Orchestration

- [ ] Analyse automatique de la tache par l'agent architecte
- [ ] Generation d'un plan (agents necessaires, ordre, fichiers impactes)
- [ ] Validation humaine du plan avant execution
- [ ] Execution sequentielle ou parallele selon le plan
- [ ] Boucle de feedback : le dev peut commenter et relancer
- [ ] Timeout configurable par tache
- [ ] Retry limite (max 2-3 tentatives) en cas d'echec

## Integration Git

- [ ] Creation automatique d'une branche par tache
- [ ] Commit et push du code genere
- [ ] Ouverture automatique d'une PR (GitHub, Azure DevOps, GitLab)
- [ ] Description de PR generee automatiquement
- [ ] Webhook entrant : un commentaire sur la PR relance un agent

## Monitoring

- [ ] Logs de chaque execution d'agent
- [ ] Historique des taches (plan, agents utilises, resultat)
- [ ] Statut en temps reel (quel agent tourne, depuis combien de temps)

## Hors scope MVP

- Authentification multi-utilisateur
- Multi-tenant / gestion par equipe
- Dashboard de couts detaille
- Serveur MCP centralise
- Gestion de quotas
- SSO / SAML
