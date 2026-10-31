/**
 * Socket.IO event names and payload contracts.
 * Keep client and server in sync via this module.
 */

import type { PlayerId, PlayerPublicState, Position, RoomId, UserId } from '../types';

/** Events emitted by the client */
export const ClientEvents = {
  /** Authenticate the socket after connection */
  AUTH: 'auth:authenticate',
  /** Player sends an intent (movement, action…) */
  INTENT: 'player:intent',
  /** Join a specific room / zone */
  JOIN_ROOM: 'room:join',
  /** Leave current room */
  LEAVE_ROOM: 'room:leave',
  /** Chat message */
  CHAT_SEND: 'chat:send',
} as const;

/** Events emitted by the server */
export const ServerEvents = {
  /** Authentication result */
  AUTH_RESULT: 'auth:result',
  /** Full or partial world snapshot for the room */
  WORLD_SNAPSHOT: 'world:snapshot',
  /** Single entity update */
  ENTITY_UPDATE: 'entity:update',
  /** Entity removed */
  ENTITY_REMOVE: 'entity:remove',
  /** Player joined the room */
  PLAYER_JOINED: 'player:joined',
  /** Player left the room */
  PLAYER_LEFT: 'player:left',
  /** Chat message broadcast */
  CHAT_MESSAGE: 'chat:message',
  /** Generic error */
  ERROR: 'error',
} as const;

export type ClientEvent = (typeof ClientEvents)[keyof typeof ClientEvents];
export type ServerEvent = (typeof ServerEvents)[keyof typeof ServerEvents];

/** Payload examples (interfaces) */

export interface AuthAuthenticatePayload {
  token: string;
}

export interface AuthResultPayload {
  success: boolean;
  userId?: UserId;
  playerId?: PlayerId;
  error?: string;
}

export interface JoinRoomPayload {
  roomId: RoomId;
}

export interface WorldSnapshotPayload {
  roomId: RoomId;
  players: PlayerPublicState[];
  /** Server tick or timestamp */
  tick: number;
}

export interface EntityUpdatePayload {
  id: PlayerId;
  position?: Position;
  direction?: number;
  // Extensible later
  [key: string]: unknown;
}

export interface ChatMessagePayload {
  from: PlayerId;
  displayName: string;
  text: string;
  timestamp: number;
}
