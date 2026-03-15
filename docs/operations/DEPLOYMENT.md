# Deploiement

## Option 1 : Local (recommande pour le MVP)

Tout tourne sur la machine du developpeur.

```
Machine locale
├── Frontend        → localhost:3000
├── Backend + Queue → localhost:4000
├── Worker          → process Node
├── SQLite          → fichier local
└── Git repo        → dossier local
```

### Lancement

```bash
# Terminal 1 : frontend
cd maestro/frontend
npm run dev

# Terminal 2 : backend + worker
cd maestro/backend
npm run dev
```

Ou via un script unique :

```bash
npm run dev  # lance tout via concurrently
```

### Prerequis

- Node.js >= 18
- CLI `claude` installee et authentifiee (abonnement Claude Code actif)
- CLI `gh` (GitHub) ou `az` (Azure DevOps) configuree
- Git configure avec acces au repo cible

---

## Option 2 : Raspberry Pi

Identique a l'option locale, mais le Pi tourne en permanence. Les devs accedent au frontend depuis leur navigateur.

### Acces reseau

Le Pi est derriere le reseau local. Pour y acceder :

**Reseau local uniquement (le plus simple) :**
```
http://192.168.1.xx:3000
```

**Depuis l'exterieur :**

| Solution | Avantage | Inconvenient |
|---|---|---|
| Cloudflare Tunnel | Gratuit, securise, pas de port a ouvrir | Necessite un compte Cloudflare |
| Tailscale | VPN mesh, simple a configurer | Chaque client doit installer Tailscale |
| Ngrok | Tres rapide a mettre en place | URL temporaire (sauf plan payant) |

### Setup Cloudflare Tunnel (recommande)

```bash
# Sur le Pi
cloudflared tunnel create maestro
cloudflared tunnel route dns maestro maestro.mondomaine.com
cloudflared tunnel run maestro
```

### Configuration du Pi

```bash
# Installer Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo bash -
sudo apt install -y nodejs

# Installer Claude Code
npm install -g @anthropic-ai/claude-code

# Cloner Maestro
git clone https://github.com/mon-org/maestro.git
cd maestro && npm install

# Lancer en service systemd
sudo cp maestro.service /etc/systemd/system/
sudo systemctl enable maestro
sudo systemctl start maestro
```

### Ressources Pi

| Modele | RAM | Suffisant ? |
|---|---|---|
| Pi 4 (4 GB) | 4 GB | Oui pour 1-2 taches simultanées |
| Pi 4 (8 GB) | 8 GB | Confortable |
| Pi 5 (8 GB) | 8 GB | Ideal |

Le goulot d'etranglement n'est pas le Pi (qui ne fait que du HTTP et du git) mais les rate limits de l'abonnement Claude Code.

---

## Option 3 : Cloud (pour la suite)

Quand le MVP est valide et qu'on veut scaler :

```
Vercel / Netlify          Railway / Fly.io / EC2
┌────────────────┐        ┌──────────────────┐
│ Frontend       │        │ Backend          │
│ (static/SSR)   │        │ Workers          │
└────────────────┘        │ Redis (queue)    │
                          │ PostgreSQL (DB)  │
                          └──────────────────┘
```

A ce stade, migrer aussi vers l'API Anthropic directe (AnthropicProvider) pour un controle fin des modeles et des couts.

---

## Variables d'environnement

```bash
# .env (ne jamais commiter)

# Git
GIT_PROVIDER=github                    # github | azure | gitlab
GIT_REPO_URL=https://github.com/org/repo.git
GIT_TOKEN=ghp_xxxxxxxxxxxx            # PAT pour push et PR
GIT_DEFAULT_BRANCH=main

# LLM
LLM_PROVIDER=claude-cli               # claude-cli | anthropic-api
ANTHROPIC_API_KEY=sk-ant-xxxxx        # uniquement si LLM_PROVIDER=anthropic-api

# App
PORT=4000
FRONTEND_URL=http://localhost:3000
DATABASE_PATH=./data/maestro.db
AGENTS_DIR=./agents
SHARED_CONTEXT_DIR=./shared
```
