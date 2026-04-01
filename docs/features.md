# Maestro - Features MVP

Ce document liste les premieres features a implementer, classees par priorite. Chaque feature est decrite avec son scope, son comportement attendu, et les modules concernes.

---

## P0 — Fondations (sans ça, rien ne marche)

### F01 — Initialisation du projet (`npx maestro init`)

**Scope** : CLI

Permet d'initialiser Maestro dans un repo git existant.

**Comportement :**
- Verifie que le repertoire courant est un repo git
- Verifie que Claude CLI est installe et accessible (`claude --version`)
- Cree la structure `.maestro/` (config.yml, agents/, skills/, .gitignore partiel)
- Initialise la base SQLite
- Cree un agent par defaut
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
- [ ] Ctrl+C arrete proprement le serveur et les agents en cours

---

### F03 — Creation et gestion des features

**Scope** : UI, Server, Database

L'utilisateur peut creer des features (taches) a realiser par les agents.

**Comportement :**
- Creer une feature avec titre, description, et priorite
- Assigner une feature a un agent
- Changer le statut d'une feature (backlog → in_progress → done)
- Lister les features avec filtres (statut, agent)
- Generation automatique d'une cle (MAE-1, MAE-2...)
- Generation automatique du nom de branche (`maestro/<slug>`)

**Criteres d'acceptation :**
- [ ] L'UI affiche la liste des features groupees par statut
- [ ] Le formulaire de creation est fonctionnel
- [ ] L'assignation a un agent est possible
- [ ] Les statuts sont modifiables
- [ ] Les cles sont uniques et auto-incrementees

---

### F04 — Configuration et gestion des agents

**Scope** : UI, Server, Database

L'utilisateur peut creer, configurer et gerer les agents.

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
- Creer un git worktree pour la feature
- Construire les arguments Claude CLI depuis la config de l'agent
- Preparer le repertoire de skills
- Spawner le processus `claude` avec `--output-format stream-json`
- Parser le flux JSON ligne par ligne
- Sauvegarder les events en DB
- Emettre les events via WebSocket
- Gerer la fin du run (succes, echec, timeout)
- Sauvegarder le session ID pour le resume futur

**Criteres d'acceptation :**
- [ ] Un run demarre correctement dans un worktree isole
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
- Affichage differencie par type : texte assistant (vert), thinking (gris), tool calls (jaune), tool results (cyan/rouge), system (bleu)
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

## P1 — Autonomie et controle

### F07 — Heartbeat scheduler

**Scope** : Heartbeat, Server

Les agents se reveillent automatiquement pour verifier s'ils ont du travail.

**Comportement :**
- Boucle periodique (defaut 30s)
- Pour chaque agent idle avec des features assignees : demarrer un run
- Respecter la limite de concurrence globale
- Detecter et nettoyer les runs orphelins

**Criteres d'acceptation :**
- [ ] Un agent idle avec une feature assignee demarre automatiquement
- [ ] La concurrence globale est respectee
- [ ] Les runs orphelins sont detectes apres redemarrage du serveur
- [ ] Le heartbeat peut etre desactive dans la config

---

### F08 — Wakeup manuel

**Scope** : UI, CLI, Server

L'utilisateur peut reveiller un agent manuellement.

**Comportement :**
- Bouton "Wake" dans l'UI (page agents + sidebar)
- Commande `npx maestro wake [agent]`
- Declenche immediatement la verification de travail pour l'agent

**Criteres d'acceptation :**
- [ ] Le bouton Wake est disponible pour les agents idle
- [ ] La commande CLI fonctionne
- [ ] L'agent demarre un run si du travail est disponible
- [ ] Feedback immediat dans l'UI (changement de statut)

---

### F09 — Stop et restart d'un agent

**Scope** : UI, CLI, Agents

L'utilisateur peut arreter un agent en cours et le relancer.

**Comportement :**
- **Stop** : SIGTERM → grace period → SIGKILL si necessaire, marque le run comme `stopped`
- **Restart** : relance le run avec `--resume <sessionId>` si possible

**Criteres d'acceptation :**
- [ ] Stop arrete le processus proprement
- [ ] Le run est marque comme `stopped` (pas `failed`)
- [ ] Restart reprend la session Claude si elle existe
- [ ] Restart demarre une nouvelle session si l'ancienne est invalide
- [ ] Les boutons sont disponibles dans l'UI et la sidebar

---

### F10 — Intervention utilisateur (envoyer un message)

**Scope** : UI, Agents

L'utilisateur peut envoyer un message a un agent en cours d'execution pour le guider ou le debloquer.

**Comportement :**
- Zone de texte dans la live view d'un run
- L'envoi stoppe le run en cours (graceful)
- Relance Claude avec `--resume <sessionId>` et le message comme nouveau prompt
- Le message est enregistre dans les run_events

**Criteres d'acceptation :**
- [ ] Le champ de message est visible pendant un run actif
- [ ] L'envoi interrompt et relance le run avec le message
- [ ] Le message apparait dans le flux d'events
- [ ] La session est maintenue (continuite de la conversation)

---

## P2 — Skills et configuration avancee

### F11 — Gestion des skills

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
- [ ] L'editeur Markdown fonctionne (preview optionnel)
- [ ] Les modifications sont ecrites dans le fichier `.md`
- [ ] L'attachement a un agent met a jour le YAML de l'agent

---

### F12 — Dashboard de synthese

**Scope** : UI, Server

Page d'accueil avec vue d'ensemble du projet.

**Comportement :**
- Compteurs : features totales, en cours, terminees
- Activite recente : derniers events des agents
- Features en cours avec agent assigne et statut
- Cout cumule (optionnel)

**Criteres d'acceptation :**
- [ ] Les compteurs sont corrects et mis a jour en temps reel
- [ ] L'activite recente affiche les 20 derniers events
- [ ] Les features en cours sont cliquables

---

### F13 — Configuration globale

**Scope** : UI, Server

Page de settings pour configurer Maestro.

**Comportement :**
- Modifier l'intervalle du heartbeat
- Modifier la concurrence max
- Configurer le modele par defaut
- Voir les infos systeme (version, chemin, DB)

**Criteres d'acceptation :**
- [ ] Les modifications sont sauvegardees dans `.maestro/config.yml`
- [ ] Les changements prennent effet immediatement (pas besoin de restart)
- [ ] Les infos systeme sont affichees correctement

---

## P3 — Polish et qualite de vie

### F14 — Historique des runs par feature

**Scope** : UI

Dans le detail d'une feature, voir l'historique complet des runs.

**Comportement :**
- Liste des runs avec statut, duree, cout
- Acces au detail de chaque run (events)
- Resume textuel du resultat de chaque run

---

### F15 — Statistiques de cout

**Scope** : UI, Server

Suivi du cout d'utilisation de Claude.

**Comportement :**
- Cout par agent
- Cout par feature
- Cout total du projet
- Tokens input/output/cached

---

### F16 — Commande `npx maestro status`

**Scope** : CLI

Affichage rapide du statut dans le terminal sans ouvrir l'UI.

---

### F17 — Commande `npx maestro doctor`

**Scope** : CLI

Verification de l'environnement et diagnostic.

**Comportement :**
- Claude CLI installe et version
- Git disponible et version
- Etat de la DB
- Config valide
- Agents definis et valides

---

## Ordre d'implementation suggere

```
Phase 1 — Squelette
  F01 (init) → F02 (dev) → F03 (features) → F04 (agents)

Phase 2 — Execution
  F05 (spawn Claude) → F06 (live view) → F07 (heartbeat)

Phase 3 — Controle
  F08 (wake) → F09 (stop/restart) → F10 (intervention)

Phase 4 — Enrichissement
  F11 (skills) → F12 (dashboard) → F13 (config) → F14-F17
```
