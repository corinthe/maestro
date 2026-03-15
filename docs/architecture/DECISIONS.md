# Decisions techniques

Ce document trace les decisions prises et leur justification. Il sert de reference pour comprendre pourquoi l'architecture est telle qu'elle est.

---

## DEC-001 : CLI claude plutot qu'API directe pour le MVP

**Decision** : Utiliser la CLI `claude` (Claude Code) comme moteur d'execution plutot que l'API Anthropic.

**Pourquoi** :
- Le tool use (lecture/ecriture de fichiers, execution de commandes) est deja implemente dans Claude Code. Le reimplementer prendrait plusieurs jours.
- Claude Code explore le repo de lui-meme pour comprendre le contexte. Avec l'API, il faudrait decider manuellement quels fichiers envoyer.
- L'abonnement Claude Code est forfaitaire : pas de surprise sur la facture pendant le prototypage.
- La couche d'abstraction (LLMProvider) permet de migrer vers l'API plus tard sans modifier l'orchestrateur.

**Compromis** :
- Pas de controle sur le modele utilise (on ne choisit pas entre Opus/Sonnet/Haiku)
- Pas de metriques de tokens
- Rate limits de l'abonnement potentiellement bloquants avec plusieurs agents paralleles

---

## DEC-002 : SQLite plutot que PostgreSQL pour le MVP

**Decision** : Utiliser SQLite pour la base de donnees du MVP.

**Pourquoi** :
- Zero configuration, pas de serveur a installer
- Un seul fichier, facile a sauvegarder ou reinitialiser
- Suffisant pour un seul utilisateur avec quelques dizaines de taches
- Migration vers PostgreSQL triviale (memes requetes SQL pour l'essentiel)

---

## DEC-003 : Queue in-memory plutot que Redis pour le MVP

**Decision** : Utiliser une simple queue JavaScript en memoire plutot que Redis + Bull.

**Pourquoi** :
- Le MVP n'a qu'un seul worker. Pas besoin de distribution.
- Moins de dependances = moins de configuration = demarrage plus rapide.
- Si le process redemarre, les taches en cours sont perdues. Acceptable pour un MVP.

**Compromis** :
- Pas de persistance de la queue
- Pas de retry automatique au redemarrage
- A remplacer par Bull/Redis en phase 2

---

## DEC-004 : Un agent = un fichier markdown

**Decision** : Les templates d'agents sont de simples fichiers `.md` dans un dossier `agents/`.

**Pourquoi** :
- Pas de format proprietaire, pas de schema a apprendre
- Editable avec n'importe quel editeur de texte
- Versionnable avec Git (diff, historique, PR)
- Inspire par GitAgent et par le fonctionnement de CLAUDE.md dans Claude Code
- Un nouveau collegue peut comprendre un agent en lisant le fichier

---

## DEC-005 : L'orchestrateur est lui-meme un agent

**Decision** : L'orchestrateur n'est pas du code procedural. C'est un agent LLM avec son propre template.

**Pourquoi** :
- Il peut analyser des taches en langage naturel et produire des plans adaptes
- Il est modifiable sans changer le code (on edite son `.md`)
- Il peut raisonner sur quel agent utiliser, dans quel ordre, en parallele ou non
- La logique procedurale (le worker) se contente d'executer le plan JSON qu'il produit

**Compromis** :
- L'orchestrateur peut se tromper (mauvais plan, mauvais agent choisi)
- La validation humaine (etape Ready) compense ce risque

---

## DEC-006 : Validation humaine obligatoire avant execution

**Decision** : Le dev doit valider le plan avant que les agents codent.

**Pourquoi** :
- Un agent qui part dans la mauvaise direction consomme des tokens pour rien
- Le dev connait le contexte metier que l'orchestrateur peut ignorer
- Ca cree un point de controle naturel dans le workflow
- Le dev reste en controle, l'outil est un accelerateur pas un remplacement

---

## DEC-007 : Jamais de merge automatique

**Decision** : Maestro ouvre des PR mais ne les merge jamais.

**Pourquoi** :
- Le code genere doit etre relu par un humain
- Les agents peuvent halluciner (imports inexistants, packages inventes)
- Une PR est une proposition, pas un fait accompli
- Le dev garde la responsabilite finale du code qui arrive en production
