/**
 * Shared types between client and server.
 * These are contracts only — no runtime logic.
 */

/** Unique identifier for a user account */
export type UserId = string;

/** Unique identifier for a player entity in the world */
export type PlayerId = string;

/** Unique identifier for a room / zone instance */
export type RoomId = string;

/** 2D position in world coordinates (isometric tile space later) */
export interface Position {
  x: number;
  y: number;
}

/** Basic player public state synchronized over the network */
export interface PlayerPublicState {
  id: PlayerId;
  userId: UserId;
  displayName: string;
  position: Position;
  /** Direction / facing — to be refined with game design */
  direction?: number;
  /** Optional skin / appearance id */
  appearanceId?: string;
}

/** Authentication payload returned by the server */
export interface AuthTokens {
  accessToken: string;
  /** Optional refresh token — not implemented yet */
  refreshToken?: string;
  expiresIn: number;
}

/** User profile stored in database (subset safe to expose) */
export interface UserProfile {
  id: UserId;
  username: string;
  displayName: string;
  createdAt: string; // ISO
}

/** Intent sent by the client (never trusted as-is) */
export interface PlayerIntent {
  type: 'move' | 'interact' | 'chat' | 'custom';
  payload: unknown;
  /** Client-side sequence for reconciliation (future) */
  seq?: number;
  timestamp?: number;
}

/** Error shape returned by the server */
export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}
