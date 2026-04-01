# Maestro - Features MVP

Ce document liste les premières features à implémenter, classées par priorité. Chaque feature est décrite avec son scope, son comportement attendu, et les modules concernés.

---

## P0 — Fondations (sans ça, rien ne marche)

### F01 — Initialisation du projet (`npx maestro init`)

**Scope** : CLI

Permet d'initialiser Maestro dans un repo git existant.

**Comportement :**
- Vérifie que le répertoire courant est un repo git
- Vérifie que Claude CLI est installé et accessible (`claude --version`)
- Crée la structure `.maestro/` (config.yml, agents/, skills/, .gitignore partiel)
- Initialise la base SQLite
- Crée les agents par défaut (`developer.yml`, `qa-engineer.yml`)
- Affiche un message de succès avec la commande suivante

**Critères d'acceptation :**
- [ ] `npx maestro init` dans un repo git crée la structure complète
- [ ] `npx maestro init` dans un non-repo git affiche une erreur claire
- [ ] `npx maestro init` dans un repo déjà initialisé ne casse rien (idempotent)
- [ ] Claude CLI absent → message d'erreur avec lien d'installation

---

### F02 — Lancement du serveur (`npx maestro dev`)

**Scope** : CLI, Server

Démarre le serveur Next.js local qui sert l'UI et l'API.

**Comportement :**
- Vérifie que `.maestro/` existe
- Trouve un port disponible (défaut 4200)
- Démarre le serveur Next.js
- Démarre le heartbeat scheduler
- Synchronise les fichiers de config (agents, skills) vers la DB
- Ouvre le navigateur
- Affiche l'URL dans le terminal

**Critères d'acceptation :**
- [ ] Le serveur démarre et sert l'UI sur le port choisi
- [ ] Le heartbeat est actif
- [ ] Les agents et skills définis en fichiers sont visibles dans l'UI
- [ ] Ctrl+C arrête proprement le serveur et les processes en cours

---

### F03 — Création et gestion des features

**Scope** : UI, Server, Database

L'utilisateur peut créer des features (taches) à réaliser par les agents.

**Comportement :**
- Créer une feature avec titre, description, et priorité
- Changer le statut d'une feature (backlog → in_progress → done)
- Lister les features avec filtres (statut, agent)
- Génération automatique d'une clé (MAE-1, MAE-2...)
- L'assignation à un agent est faite par l'orchestrateur, pas par l'utilisateur

**Critères d'acceptation :**
- [ ] L'UI affiché la liste des features groupées par statut
- [ ] Le formulaire de création est fonctionnel
- [ ] Les statuts sont modifiables manuellement
- [ ] Les clés sont uniques et auto-incrémentées

---

### F04 — Configuration et gestion des agents

**Scope** : UI, Server, Database

L'utilisateur peut créer, configurer et gérer les agents worker.

**Comportement :**
- Créer un agent via l'UI (génère le fichier YAML)
- Configurer : modèle, effort, max turns, instructions, skills, timeouts
- Voir le statut de chaque agent (idle, running, stopped)
- Supprimer un agent

**Critères d'acceptation :**
- [ ] Créer un agent depuis l'UI génère le fichier `.maestro/agents/<name>.yml`
- [ ] Modifier un agent met à jour le fichier et la DB
- [ ] Le statut temps réel est visible dans la sidebar
- [ ] Supprimer un agent arrête ses runs et supprime le fichier

---

### F05 — Exécution d'un agent (spawn Claude CLI)

**Scope** : Agents, Server

Le coeur du système : lancer Claude CLI pour travailler sur une feature.

**Comportement :**
- Construire les arguments Claude CLI depuis la config de l'agent et le prompt de l'orchestrateur
- Préparer le répertoire de skills
- Spawner le processus `claude` avec `--output-format stream-json`
- Parser le flux JSON ligne par ligne
- Sauvegarder les events en DB
- Emettre les events via WebSocket
- Gérer la fin du run (succès, échec, timeout)
- Sauvegarder le session ID pour le résumé futur

**Critères d'acceptation :**
- [ ] Un run démarre correctement dans le répertoire du projet
- [ ] Les events sont parsées et stockés en DB
- [ ] Le flux est visible en temps réel via WebSocket
- [ ] Le coût et les tokens sont capturés à la fin du run
- [ ] Le session ID est persisté pour le résumé

---

### F06 — Vue temps réel d'un run (Live view)

**Scope** : UI

Affichage en direct du flux d'un agent pendant son exécution.

**Comportement :**
- Connexion WebSocket pour recevoir les events
- Affichage diffèrencie par type : texte assistant, thinking, tool calls, tool results, system
- Auto-scroll vers le bas avec possibilité de remonter
- Indicateur de statut "Live" quand le run est en cours
- Affichage du résumé et des métriques quand le run est terminé

**Critères d'acceptation :**
- [ ] Le flux s'affiché en temps réel sans lag perceptible
- [ ] Les diffèrents types d'events sont visuellement distincts
- [ ] L'auto-scroll fonctionne correctement
- [ ] Les events historiques sont charges au chargement de la page
- [ ] La page reste réactive même avec des milliers d'events

---

## P1 — Orchestrateur et autonomie

### F07 — Orchestrateur (MCP + spawn)

**Scope** : Orchestrator, MCP, Server

L'orchestrateur est un agent Claude spawné par le heartbeat qui coordonne les agents worker.

**Comportement :**
- Spawné comme processus Claude CLI avec accès au serveur MCP interne
- Lit l'état du projet via les outils MCP (features, agents, messages)
- Décide quels agents doivent travailler sur quelles features
- Fournit du contexte pertinent à chaque agent (fichiers, conventions, deps)
- Peut proposer de nouveaux archétypes d'agents à l'utilisateur
- Maintient la continuite via `--resume`

**Critères d'acceptation :**
- [ ] L'orchestrateur est spawné au tick du heartbeat
- [ ] Il peut lire l'état du projet via les outils MCP
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

**Critères d'acceptation :**
- [ ] Le serveur MCP démarre et répond aux appels d'outils
- [ ] Chaque outil retourne les données correctes
- [ ] `assign_task` déclenche effectivement un run d'agent
- [ ] `propose_agent` crée une proposition en DB
- [ ] Les erreurs sont gérées proprement (agent introuvable, feature invalide)

---

### F09 — Heartbeat scheduler

**Scope** : Heartbeat, Server

Le heartbeat réveille périodiquement l'orchestrateur.

**Comportement :**
- Boucle périodique (défaut 60s)
- **Guard** : vérifie qu'il y a du travail nouveau avant de spawner (features en attente, messages non lus, runs terminés, propositions acceptees). Si rien n'a change → skip (evite de consommer des tokens)
- Vérifie qu'aucun orchestrateur ou agent ne tourne avant de spawner
- Spawné l'orchestrateur si la guard passe
- Détecte et nettoie les runs orphelins
- Purge les run_events de plus de 24h

**Critères d'acceptation :**
- [ ] L'orchestrateur est réveille automatiquement quand il y a du travail
- [ ] La guard empêche les spawns inutiles (pas de tokens gaspillés)
- [ ] Pas de spawn si un run est déjà en cours
- [ ] Les runs orphelins sont détectes après redémarrage
- [ ] La purge des logs fonctionne
- [ ] Le heartbeat peut être désactivé dans la config

---

### F10 — Wakeup manuel

**Scope** : UI, CLI, Server

L'utilisateur peut réveiller l'orchestrateur manuellement.

**Comportement :**
- Bouton "Wake" dans l'UI
- Commande `npx maestro wake`
- Déclenche immédiatement un run de l'orchestrateur

**Critères d'acceptation :**
- [ ] Le bouton Wake déclenche l'orchestrateur
- [ ] La commande CLI fonctionne
- [ ] Feedback immédiat dans l'UI

---

### F11 — Stop et restart d'un agent

**Scope** : UI, Agents

L'utilisateur peut arrêter un agent en cours et le relancer.

**Comportement :**
- **Stop** : SIGTERM → grace period → SIGKILL, marqué le run comme `stopped`
- **Restart** : relancé avec `--resume` si possible

**Critères d'acceptation :**
- [ ] Stop arrête le processus proprement
- [ ] Le run est marqué comme `stopped` (pas `failed`)
- [ ] Restart reprend la session Claude si elle existe
- [ ] Les boutons sont disponibles dans l'UI

---

### F12 — Messages utilisateur (entre runs)

**Scope** : UI, Server, Orchestrator

L'utilisateur peut envoyer un message pour guider ou débloquer un agent.

**Comportement :**
- Zone de texte dans la live view ou la page feature
- Le message est stocké en DB avec statut `pending`
- L'orchestrateur lit les messages en attente au prochain réveil
- L'orchestrateur intègre le message dans le prompt du prochain run de l'agent concerné

**Critères d'acceptation :**
- [ ] Le champ de message est visible
- [ ] Le message est stocké en DB
- [ ] L'orchestrateur lit et traite les messages
- [ ] Le message influence le comportement de l'agent au run suivant

---

### F12bis — Onboarding au premier lancement

**Scope** : Orchestrator, UI

Au premier lancement (aucune feature, aucun run), l'orchestrateur propose une analyse du projet.

**Comportement :**
- L'UI détecte qu'il n'y a aucune feature et affiché un guidé de démarrage
- L'orchestrateur, au premier wake, peut proposer un agent "onboarding" qui analyse le codebase (stack, structure, conventions) et génère un résumé de contexte
- Alternativement, l'orchestrateur peut directement utiliser `get_project_context` et produire un résumé stocké en config
- L'utilisateur est guidé pour créer sa première feature

**Critères d'acceptation :**
- [ ] Au premier lancement, l'UI affiché un état vide accueillant (pas juste des listes vides)
- [ ] L'orchestrateur a suffisamment de contexte pour déléguer des le premier run
- [ ] L'utilisateur comprend quoi faire (créer une feature)

---

## P2 — Skills et configuration avancee

### F13 — Gestion des skills

**Scope** : UI, Server, Skills

Créer, éditer et attacher des skills aux agents.

**Comportement :**
- Lister les skills existants dans `.maestro/skills/`
- Créer un nouveau skill (éditeur Markdown dans l'UI)
- Editer un skill existant
- Supprimer un skill
- Attacher/detacher un skill d'un agent

**Critères d'acceptation :**
- [ ] La page Skills affiché tous les skills du projet
- [ ] L'éditeur Markdown fonctionne
- [ ] Les modifications sont écrites dans le fichier `.md`
- [ ] L'attachement à un agent met à jour le YAML de l'agent

---

### F14 — Dashboard de synthèse

**Scope** : UI, Server

Page d'accueil avec vue d'ensemble du projet.

**Comportement :**
- Compteurs : features totales, en cours, terminées
- Activité récente : derniers events significatifs
- Features en cours avec agent assigné et statut
- Statut de l'orchestrateur
- Cout cumulé

**Critères d'acceptation :**
- [ ] Les compteurs sont corrects et mis à jour en temps réel
- [ ] L'activité récente affiché les 20 derniers events
- [ ] Les features en cours sont cliquables

---

### F15 — Configuration globale

**Scope** : UI, Server

Page de settings pour configurer Maestro.

**Comportement :**
- Modifier l'intervalle du heartbeat
- Configurer le modèle de l'orchestrateur
- Voir les infos système (version, chemin, DB)

**Critères d'acceptation :**
- [ ] Les modifications sont sauvegardées dans `.maestro/config.yml`
- [ ] Les changements prennent effet immédiatement
- [ ] Les infos système sont affichées correctement

---

## P3 — Polish et qualité de vie

### F16 — Historique des runs par feature

**Scope** : UI

Dans le detail d'une feature, voir l'historique des runs (les events sont purgées après 24h, mais le résumé et les métriques restent).

---

### F17 — Statistiques de coût

**Scope** : UI, Server

Suivi du coût d'utilisation de Claude (par agent, par feature, total projet).

---

### F18 — Commande `npx maestro status`

**Scope** : CLI

Affichage rapide du statut dans le terminal.

---

### F19 — Commande `npx maestro doctor`

**Scope** : CLI

Vérification de l'environnement et diagnostic (Claude CLI, git, DB, config).

---

## Ordre d'implémentation suggère

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

> Note : le MCP server (F08) est implémenté avant l'orchestrateur (F07) car
> c'est une dépendance. L'orchestrateur ne peut pas fonctionner sans les outils MCP.
