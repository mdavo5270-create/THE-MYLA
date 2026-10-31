/**
 * Shared constants.
 * Keep values that must stay identical on client and server here.
 */

/** Default tick rate (server simulation) — can be adjusted later */
export const SERVER_TICK_RATE = 20; // Hz

/** Maximum length for display names */
export const MAX_DISPLAY_NAME_LENGTH = 24;

/** Maximum length for chat messages */
export const MAX_CHAT_MESSAGE_LENGTH = 256;

/** Default room used when none is specified (prototype) */
export const DEFAULT_ROOM_ID = 'world-1';

/** Network */
export const SOCKET_PATH = '/socket.io';

/** Version of the shared protocol (bump when breaking changes) */
export const PROTOCOL_VERSION = '0.1.0';
