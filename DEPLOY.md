# Déploiement (Render)

| Service | Type | Commande de build | Commande de démarrage |
|---|---|---|---|
| `the-myla-db` | PostgreSQL | — | — |
| `the-myla-server` | Web Service (Node) | `npm install --include=dev && npm run db:generate && npm run build:server` | `npx prisma migrate deploy --schema server/prisma/schema.prisma && npm run start --workspace=server` |
| `the-myla-client` | Static Site | `npm install --include=dev && npm run build --workspace=client` (publish: `client/dist`) | — |

## Variables d'environnement

**Serveur** : `DATABASE_URL`, `JWT_SECRET` (≥ 32 caractères), `CORS_ORIGIN` (URL du client), `NODE_ENV=production`, `WORLD_SEED` (optionnel), `WORLD_SIZE` (optionnel, 4096 par défaut).

**Client** (au moment du build) : `VITE_API_URL`, `VITE_SOCKET_URL` (URL du serveur).

La carte est générée à la volée à partir de `WORLD_SEED` : tous les joueurs voient le même monde, sans stockage.
