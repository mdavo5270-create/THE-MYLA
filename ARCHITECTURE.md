# Architecture technique — THE MYLA

## 1. Vue d’ensemble

THE MYLA suit une architecture **client-serveur** classique pour un jeu multijoueur temps réel.

- **Client** : rendu 2D isométrique (Phaser 3), input, UI.
- **Server** : autorité de vérité, validation, synchronisation, persistance.
- **Shared** : types TypeScript, événements Socket.IO, constantes communes.

## 2. Monorepo

Workspaces npm : `client`, `server`, `shared`.

## 3. Frontend

Phaser 3 + TypeScript + Vite. Organisation : scenes, entities, maps, camera, systems, interface, network, assets.

## 4. Backend

Node.js + TypeScript + Socket.IO + Express + Prisma + PostgreSQL.
Modules : auth, multiplayer, game (stub), economy (stub), chat, database, security.

## 5. Base de données

PostgreSQL + Prisma. Tables initiales : User, PlayerProfile.

## 6. Infrastructure

Cloudflare Pages (frontend), VPS Docker (backend), GitHub Actions CI.

## 7. Sécurité

JWT, validation Zod, rate limiting, CORS, pas de secrets dans le code.

Voir documentation/TECHNICAL_DECISIONS.md pour le détail des choix.
