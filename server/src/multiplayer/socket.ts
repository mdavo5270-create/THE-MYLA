/**
 * Socket.IO setup — minimal connection handling.
 * Authenticated rooms and gameplay sync come in Phase 1.
 */

import type { Server } from 'socket.io';
import { logger } from '../utils/logger.js';

export function setupSocket(io: Server): void {
  io.on('connection', (socket) => {
    logger.info('Socket connected', { id: socket.id });
    socket.emit('server:hello', { service: 'the-myla-server', version: '0.1.0' });

    socket.on('disconnect', (reason) => {
      logger.info('Socket disconnected', { id: socket.id, reason });
    });
  });
}
