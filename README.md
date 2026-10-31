# THE MYLA

**Jeu web multijoueur isométrique 2D** accessible depuis un navigateur, sans installation obligatoire.

> **Statut** : Fondation technique (v0.1.0) — le gameplay n’est pas encore défini.  
> Ce dépôt contient uniquement l’architecture, les modules de base et la documentation.

## Présentation

THE MYLA est un futur jeu vidéo multijoueur entièrement jouable dans le navigateur (ordinateur, tablette, smartphone).

| Caractéristique        | Détail                                      |
|------------------------|---------------------------------------------|
| Plateforme             | Web (navigateur)                            |
| Graphismes             | 2D isométriques                             |
| Architecture           | Client-serveur                              |
| Capacité initiale      | 100–500 joueurs inscrits                    |
| Frontend               | Phaser 3 + TypeScript + Vite                |
| Backend                | Node.js + TypeScript + Socket.IO            |
| Base de données        | PostgreSQL + Prisma                         |
| Hébergement prévu      | Cloudflare Pages (client) + VPS (serveur)   |

Le gameplay détaillé sera défini dans de futures itérations. Aucune décision irréversible de design n’a été prise dans cette version fondation.

## Structure du monorepo

```
THE-MYLA/
├── client/                 # Frontend Phaser 3
│   └── src/
│       ├── game/           # Scènes, entités, cartes, caméra, systèmes
│       ├── interface/      # UI
│       ├── network/        # Communication Socket.IO
│       └── assets/         # Assets (placeholders)
├── server/                 # Backend Node.js
│   └── src/
│       ├── auth/           # Authentification
│       ├── game/           # Logique serveur (stub)
│       ├── multiplayer/    # Gestion des salles / connexions
│       ├── economy/        # Placeholder économie
│       ├── chat/           # Placeholder chat
│       ├── database/       # Prisma client & helpers
│       └── security/       # Validation, rate limiting
├── shared/                 # Types, événements, constantes partagés
├── database/               # Migrations & seeds (référence)
├── infrastructure/         # Docker & déploiement
├── documentation/          # Docs techniques
└── .github/workflows/      # CI
```

## Prérequis

- **Node.js** ≥ 20
- **npm** ≥ 10
- **PostgreSQL** ≥ 15 (local ou distant)
- **Docker** (optionnel, pour la stack locale)

## Installation rapide

```bash
# 1. Cloner
git clone https://github.com/mdavo5270-create/THE-MYLA.git
cd THE-MYLA

# 2. Installer les dépendances (workspaces)
npm install

# 3. Configurer l’environnement
cp .env.example .env
# Éditer .env avec vos valeurs (DATABASE_URL, JWT_SECRET, etc.)

# 4. Base de données (exemple local)
# Créer la base : createdb the_myla
# Puis :
npm run db:generate
npm run db:migrate

# 5. Lancer en développement
# Terminal 1 – serveur
npm run dev:server

# Terminal 2 – client
npm run dev:client
```

Le client sera disponible sur `http://localhost:5173` (Vite) et le serveur sur `http://localhost:3001`.

## Scripts utiles

| Script              | Description                          |
|---------------------|--------------------------------------|
| `npm run dev:client`| Lance Vite + Phaser                  |
| `npm run dev:server`| Lance le serveur Node avec hot-reload|
| `npm run build`     | Build client + serveur               |
| `npm run lint`      | ESLint                               |
| `npm run format`    | Prettier                             |
| `npm run typecheck` | Vérification TypeScript stricte      |
| `npm run test`      | Tests (quand disponibles)            |

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) — Architecture technique complète
- [ROADMAP.md](./ROADMAP.md) — Étapes de développement
- [CONTRIBUTING.md](./CONTRIBUTING.md) — Règles de contribution
- [SECURITY.md](./SECURITY.md) — Politique de sécurité
- [documentation/TECHNICAL_DECISIONS.md](./documentation/TECHNICAL_DECISIONS.md) — Décisions et alternatives
- [documentation/GAME_DESIGN.md](./documentation/GAME_DESIGN.md) — Design de jeu (en attente)

## Licence

Voir [LICENSE](./LICENSE). Licence MIT par défaut ; peut évoluer selon la stratégie commerciale/communautaire.

## État actuel

Cette version (0.1.0) fournit :

- Structure monorepo complète
- Configurations TypeScript strictes, ESLint, Prettier
- Squelettes des modules (auth, multiplayer, network, etc.)
- Documentation professionnelle
- Docker Compose de base
- Workflow CI GitHub Actions (lint + typecheck)

**Aucun gameplay n’est implémenté.** Les modules sont volontairement des interfaces / stubs prêts à être complétés.
