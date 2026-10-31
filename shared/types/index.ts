/**
 * Shared types between client and server.
 */

export type UserId = string;
export type PlayerId = string;
export type RoomId = string;

export interface Position {
  x: number;
  y: number;
}

export interface PlayerPublicState {
  id: PlayerId;
  userId: UserId;
  displayName: string;
  position: Position;
  direction?: number;
  appearanceId?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}

export interface UserProfile {
  id: UserId;
  username: string;
  displayName: string;
  createdAt: string;
}

export interface PlayerIntent {
  type: 'move' | 'interact' | 'chat' | 'custom';
  payload: unknown;
  seq?: number;
  timestamp?: number;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}
