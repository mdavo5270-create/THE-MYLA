/**
 * THE MYLA — Server entry point
 * Foundation only. No full gameplay.
 */

import 'dotenv/config';
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Server as SocketServer } from 'socket.io';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authRouter } from './auth/routes.js';
import { healthRouter } from './routes/health.js';
import { worldRouter } from './routes/world.js';
import { setupSocket } from './multiplayer/socket.js';

const app = express();
const httpServer = createServer(app);

const io = new SocketServer(httpServer, {
  path: env.SOCKET_PATH,
  cors: {
    origin: env.CORS_ORIGIN,
    methods: ['GET', 'POST'],
  },
});

// --- Middleware ---
app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  })
);
app.use(express.json({ limit: '100kb' }));

// --- HTTP routes ---
app.use('/health', healthRouter);
app.use('/auth', authRouter);
app.use('/world', worldRouter);

// --- Socket.IO ---
setupSocket(io);

// --- Error handling ---
app.use(errorHandler);

// --- Start ---
httpServer.listen(env.PORT, env.HOST, () => {
  logger.info(`THE MYLA server listening on http://${env.HOST}:${env.PORT}`);
  logger.info(`Environment: ${env.NODE_ENV}`);
});

export { app, io };
