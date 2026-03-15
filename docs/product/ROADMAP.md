# Roadmap

## Phase 1 : MVP local (objectif actuel)

Un seul utilisateur, tout en local, CLI claude comme moteur.

### Livrables
- [ ] Backend API avec gestion des taches (CRUD + machine a etats)
- [ ] Worker qui orchestre les agents via la CLI claude
- [ ] Agent registry (chargement des templates depuis le dossier `agents/`)
- [ ] LLM Provider abstrait avec implementation ClaudeCliProvider
- [ ] Integration Git (branche, commit, push, PR via `gh`)
- [ ] Frontend kanban basique avec WebSocket pour le temps reel
- [ ] Contexte partage (conventions, stack, decisions)
- [ ] 5 templates d'agents initiaux (orchestrateur, architecte, backend, frontend, testeur)

### Ce qui n'est PAS dans le MVP
- Multi-utilisateur
- Authentification
- Dashboard de couts
- Serveur MCP
- Tests automatises du produit lui-meme (on les ajoutera en phase 2)

---

## Phase 2 : Stabilisation et multi-utilisateur

### Objectifs
- [ ] Ajout de tests (unitaires + integration)
- [ ] Authentification basique (login/password ou OAuth GitHub)
- [ ] Multi-utilisateur : chaque dev voit ses taches
- [ ] Queue persistante (Redis + Bull)
- [ ] Migration SQLite → PostgreSQL
- [ ] Gestion des erreurs robuste (retry, timeout, fallback humain)
- [ ] Logs structures et consultables dans le frontend
- [ ] Deploiement sur Raspberry Pi ou VPS en mode service

---

## Phase 3 : API directe et controle fin

### Objectifs
- [ ] Implementation AnthropicProvider (API directe)
- [ ] Routage de modele par agent (Opus pour l'architecte, Sonnet pour le backend, Haiku pour le linting)
- [ ] Metriques de tokens par tache, par agent, par utilisateur
- [ ] Budget par tache (max tokens autorises)
- [ ] Support multi-provider (Anthropic + OpenAI + Mistral)
- [ ] Dashboard de couts

---

## Phase 4 : Multi-equipe et collaboration

### Objectifs
- [ ] Gestion des equipes
- [ ] Heritage d'agents (entreprise → equipe → individu)
- [ ] Vue partagee du kanban par equipe
- [ ] Quotas par equipe
- [ ] Notifications (Slack, email, webhook)
- [ ] Webhook entrant depuis GitHub/Azure (commentaires PR → relance agent)
- [ ] SSO / SAML

---

## Phase 5 : Serveur MCP centralise

### Objectifs
- [ ] Serveur MCP HTTP qui expose les agents, outils, et ressources
- [ ] Git comme source de verite → CI/CD deploie sur le serveur MCP
- [ ] MCP Prompts : templates d'agents servis dynamiquement
- [ ] MCP Resources : documentation et contexte injectes dynamiquement
- [ ] MCP Tools : outils centralises avec auth OAuth
- [ ] Telemetrie OpenTelemetry
- [ ] Les agents dans Git, la distribution via MCP

---

## Phase 6 : Produit SaaS

### Objectifs
- [ ] Multi-tenant complet
- [ ] Plans de pricing (free, pro, team, enterprise)
- [ ] Onboarding guide
- [ ] Sandbox securise pour les workers (Docker)
- [ ] API publique pour integrations tierces
- [ ] Marketplace d'agents communautaires
