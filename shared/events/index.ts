/**
 * Socket.IO event names and payload contracts.
 */

import type { PlayerId, PlayerPublicState, Position, RoomId, UserId } from '../types';

export const ClientEvents = {
  AUTH: 'auth:authenticate',
  INTENT: 'player:intent',
  JOIN_ROOM: 'room:join',
  LEAVE_ROOM: 'room:leave',
  CHAT_SEND: 'chat:send',
} as const;

export const ServerEvents = {
  AUTH_RESULT: 'auth:result',
  WORLD_SNAPSHOT: 'world:snapshot',
  ENTITY_UPDATE: 'entity:update',
  ENTITY_REMOVE: 'entity:remove',
  PLAYER_JOINED: 'player:joined',
  PLAYER_LEFT: 'player:left',
  CHAT_MESSAGE: 'chat:message',
  ERROR: 'error',
} as const;

export type ClientEvent = (typeof ClientEvents)[keyof typeof ClientEvents];
export type ServerEvent = (typeof ServerEvents)[keyof typeof ServerEvents];

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
  tick: number;
}

export interface EntityUpdatePayload {
  id: PlayerId;
  position?: Position;
  direction?: number;
  [key: string]: unknown;
}

export interface ChatMessagePayload {
  from: PlayerId;
  displayName: string;
  text: string;
  timestamp: number;
}
