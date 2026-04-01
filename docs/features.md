# Maestro - Features MVP

Ce document liste les premieres features a implementer, classees par priorite. Chaque feature est decrite avec son scope, son comportement attendu, et les modules concernes.

---

## P0 — Fondations (sans ca, rien ne marche)

### F01 — Initialisation du projet (`npx maestro init`)

**Scope** : CLI

Permet d'initialiser Maestro dans un repo git existant.

**Comportement :**
- Verifie que le repertoire courant est un repo git
- Verifie que Claude CLI est installe et accessible (`claude --version`)
- Cree la structure `.maestro/` (config.yml, agents/, skills/, .gitignore partiel)
- Initialise la base SQLite
- Cree un agent par defaut (ex: `developer.yml`)
- Affiche un message de succes avec la commande suivante

**Criteres d'acceptation :**
- [ ] `npx maestro init` dans un repo git cree la structure complete
- [ ] `npx maestro init` dans un non-repo git affiche une erreur claire
- [ ] `npx maestro init` dans un repo deja initialise ne casse rien (idempotent)
- [ ] Claude CLI absent → message d'erreur avec lien d'installation

---

### F02 — Lancement du serveur (`npx maestro dev`)

**Scope** : CLI, Server

Demarre le serveur Next.js local qui sert l'UI et l'API.

**Comportement :**
- Verifie que `.maestro/` existe
- Trouve un port disponible (defaut 4200)
- Demarre le serveur Next.js
- Demarre le heartbeat scheduler
- Synchronise les fichiers de config (agents, skills) vers la DB
- Ouvre le navigateur
- Affiche l'URL dans le terminal

**Criteres d'acceptation :**
- [ ] Le serveur demarre et sert l'UI sur le port choisi
- [ ] Le heartbeat est actif
- [ ] Les agents et skills definis en fichiers sont visibles dans l'UI
- [ ] Ctrl+C arrete proprement le serveur et les processes en cours

---

### F03 — Creation et gestion des features

**Scope** : UI, Server, Database

L'utilisateur peut creer des features (taches) a realiser par les agents.

**Comportement :**
- Creer une feature avec titre, description, et priorite
- Changer le statut d'une feature (backlog → in_progress → done)
- Lister les features avec filtres (statut, agent)
- Generation automatique d'une cle (MAE-1, MAE-2...)
- L'assignation a un agent est faite par l'orchestrateur, pas par l'utilisateur

**Criteres d'acceptation :**
- [ ] L'UI affiche la liste des features groupees par statut
- [ ] Le formulaire de creation est fonctionnel
- [ ] Les statuts sont modifiables manuellement
- [ ] Les cles sont uniques et auto-incrementees

---

### F04 — Configuration et gestion des agents

**Scope** : UI, Server, Database

L'utilisateur peut creer, configurer et gerer les agents worker.

**Comportement :**
- Creer un agent via l'UI (genere le fichier YAML)
- Configurer : modele, effort, max turns, instructions, skills, timeouts
- Voir le statut de chaque agent (idle, running, stopped)
- Supprimer un agent

**Criteres d'acceptation :**
- [ ] Creer un agent depuis l'UI genere le fichier `.maestro/agents/<name>.yml`
- [ ] Modifier un agent met a jour le fichier et la DB
- [ ] Le statut temps reel est visible dans la sidebar
- [ ] Supprimer un agent arrete ses runs et supprime le fichier

---

### F05 — Execution d'un agent (spawn Claude CLI)

**Scope** : Agents, Server

Le coeur du systeme : lancer Claude CLI pour travailler sur une feature.

**Comportement :**
- Construire les arguments Claude CLI depuis la config de l'agent et le prompt de l'orchestrateur
- Preparer le repertoire de skills
- Spawner le processus `claude` avec `--output-format stream-json`
- Parser le flux JSON ligne par ligne
- Sauvegarder les events en DB
- Emettre les events via WebSocket
- Gerer la fin du run (succes, echec, timeout)
- Sauvegarder le session ID pour le resume futur

**Criteres d'acceptation :**
- [ ] Un run demarre correctement dans le repertoire du projet
- [ ] Les events sont parsees et stockes en DB
- [ ] Le flux est visible en temps reel via WebSocket
- [ ] Le cout et les tokens sont captures a la fin du run
- [ ] Le session ID est persiste pour le resume

---

### F06 — Vue temps reel d'un run (Live view)

**Scope** : UI

Affichage en direct du flux d'un agent pendant son execution.

**Comportement :**
- Connexion WebSocket pour recevoir les events
- Affichage differencie par type : texte assistant, thinking, tool calls, tool results, system
- Auto-scroll vers le bas avec possibilite de remonter
- Indicateur de statut "Live" quand le run est en cours
- Affichage du resume et des metriques quand le run est termine

**Criteres d'acceptation :**
- [ ] Le flux s'affiche en temps reel sans lag perceptible
- [ ] Les differents types d'events sont visuellement distincts
- [ ] L'auto-scroll fonctionne correctement
- [ ] Les events historiques sont charges au chargement de la page
- [ ] La page reste reactive meme avec des milliers d'events

---

## P1 — Orchestrateur et autonomie

### F07 — Orchestrateur (MCP + spawn)

**Scope** : Orchestrator, MCP, Server

L'orchestrateur est un agent Claude spawne par le heartbeat qui coordonne les agents worker.

**Comportement :**
- Spawne comme processus Claude CLI avec acces au serveur MCP interne
- Lit l'etat du projet via les outils MCP (features, agents, messages)
- Decide quels agents doivent travailler sur quelles features
- Fournit du contexte pertinent a chaque agent (fichiers, conventions, deps)
- Peut proposer de nouveaux archetypes d'agents a l'utilisateur
- Maintient la continuite via `--resume`

**Criteres d'acceptation :**
- [ ] L'orchestrateur est spawne au tick du heartbeat
- [ ] Il peut lire l'etat du projet via les outils MCP
- [ ] Il peut lancer un agent via `assign_task`
- [ ] Il peut proposer un agent via `propose_agent`
- [ ] Les propositions sont visibles dans l'UI
- [ ] L'utilisateur peut accepter/rejeter une proposition
- [ ] La session est maintenue entre les ticks

---

### F08 — Serveur MCP interne

**Scope** : MCP, Server

Le serveur MCP expose les outils que l'orchestrateur utilise pour interagir avec Maestro.

**Comportement :**
- Protocole stdio entre Claude CLI et le serveur MCP
- Outils de lecture : `list_features`, `list_agents`, `get_agent_status`, `get_project_context`, `get_pending_messages`
- Outils d'action : `assign_task`, `propose_agent`, `complete_feature`, `set_feature_priority`

**Criteres d'acceptation :**
- [ ] Le serveur MCP demarre et repond aux appels d'outils
- [ ] Chaque outil retourne les donnees correctes
- [ ] `assign_task` declenche effectivement un run d'agent
- [ ] `propose_agent` cree une proposition en DB
- [ ] Les erreurs sont gerees proprement (agent introuvable, feature invalide)

---

### F09 — Heartbeat scheduler

**Scope** : Heartbeat, Server

Le heartbeat reveille periodiquement l'orchestrateur.

**Comportement :**
- Boucle periodique (defaut 60s)
- Verifie qu'aucun orchestrateur ou agent ne tourne avant de spawner
- Spawne l'orchestrateur s'il y a des features en attente
- Detecte et nettoie les runs orphelins
- Purge les run_events de plus de 24h

**Criteres d'acceptation :**
- [ ] L'orchestrateur est reveille automatiquement
- [ ] Pas de spawn si un run est deja en cours
- [ ] Les runs orphelins sont detectes apres redemarrage
- [ ] La purge des logs fonctionne
- [ ] Le heartbeat peut etre desactive dans la config

---

### F10 — Wakeup manuel

**Scope** : UI, CLI, Server

L'utilisateur peut reveiller l'orchestrateur manuellement.

**Comportement :**
- Bouton "Wake" dans l'UI
- Commande `npx maestro wake`
- Declenche immediatement un run de l'orchestrateur

**Criteres d'acceptation :**
- [ ] Le bouton Wake declenche l'orchestrateur
- [ ] La commande CLI fonctionne
- [ ] Feedback immediat dans l'UI

---

### F11 — Stop et restart d'un agent

**Scope** : UI, Agents

L'utilisateur peut arreter un agent en cours et le relancer.

**Comportement :**
- **Stop** : SIGTERM → grace period → SIGKILL, marque le run comme `stopped`
- **Restart** : relance avec `--resume` si possible

**Criteres d'acceptation :**
- [ ] Stop arrete le processus proprement
- [ ] Le run est marque comme `stopped` (pas `failed`)
- [ ] Restart reprend la session Claude si elle existe
- [ ] Les boutons sont disponibles dans l'UI

---

### F12 — Messages utilisateur (entre runs)

**Scope** : UI, Server, Orchestrator

L'utilisateur peut envoyer un message pour guider ou debloquer un agent.

**Comportement :**
- Zone de texte dans la live view ou la page feature
- Le message est stocke en DB avec statut `pending`
- L'orchestrateur lit les messages en attente au prochain reveil
- L'orchestrateur integre le message dans le prompt du prochain run de l'agent concerne

**Criteres d'acceptation :**
- [ ] Le champ de message est visible
- [ ] Le message est stocke en DB
- [ ] L'orchestrateur lit et traite les messages
- [ ] Le message influence le comportement de l'agent au run suivant

---

## P2 — Skills et configuration avancee

### F13 — Gestion des skills

**Scope** : UI, Server, Skills

Creer, editer et attacher des skills aux agents.

**Comportement :**
- Lister les skills existants dans `.maestro/skills/`
- Creer un nouveau skill (editeur Markdown dans l'UI)
- Editer un skill existant
- Supprimer un skill
- Attacher/detacher un skill d'un agent

**Criteres d'acceptation :**
- [ ] La page Skills affiche tous les skills du projet
- [ ] L'editeur Markdown fonctionne
- [ ] Les modifications sont ecrites dans le fichier `.md`
- [ ] L'attachement a un agent met a jour le YAML de l'agent

---

### F14 — Dashboard de synthese

**Scope** : UI, Server

Page d'accueil avec vue d'ensemble du projet.

**Comportement :**
- Compteurs : features totales, en cours, terminees
- Activite recente : derniers events significatifs
- Features en cours avec agent assigne et statut
- Statut de l'orchestrateur
- Cout cumule

**Criteres d'acceptation :**
- [ ] Les compteurs sont corrects et mis a jour en temps reel
- [ ] L'activite recente affiche les 20 derniers events
- [ ] Les features en cours sont cliquables

---

### F15 — Configuration globale

**Scope** : UI, Server

Page de settings pour configurer Maestro.

**Comportement :**
- Modifier l'intervalle du heartbeat
- Configurer le modele de l'orchestrateur
- Voir les infos systeme (version, chemin, DB)

**Criteres d'acceptation :**
- [ ] Les modifications sont sauvegardees dans `.maestro/config.yml`
- [ ] Les changements prennent effet immediatement
- [ ] Les infos systeme sont affichees correctement

---

## P3 — Polish et qualite de vie

### F16 — Historique des runs par feature

**Scope** : UI

Dans le detail d'une feature, voir l'historique des runs (les events sont purgees apres 24h, mais le resume et les metriques restent).

---

### F17 — Statistiques de cout

**Scope** : UI, Server

Suivi du cout d'utilisation de Claude (par agent, par feature, total projet).

---

### F18 — Commande `npx maestro status`

**Scope** : CLI

Affichage rapide du statut dans le terminal.

---

### F19 — Commande `npx maestro doctor`

**Scope** : CLI

Verification de l'environnement et diagnostic (Claude CLI, git, DB, config).

---

## Ordre d'implementation suggere

```
Phase 1 — Squelette
  F01 (init) → F02 (dev) → F03 (features) → F04 (agents)

Phase 2 — Execution
  F05 (spawn Claude) → F06 (live view)

Phase 3 — Orchestrateur
  F08 (MCP server) → F07 (orchestrateur) → F09 (heartbeat) → F10 (wake)

Phase 4 — Controle
  F11 (stop/restart) → F12 (messages)

Phase 5 — Enrichissement
  F13 (skills) → F14 (dashboard) → F15 (config) → F16-F19
```

> Note : le MCP server (F08) est implemente avant l'orchestrateur (F07) car
> c'est une dependance. L'orchestrateur ne peut pas fonctionner sans les outils MCP.
