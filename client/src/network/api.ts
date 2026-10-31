import { io, type Socket } from 'socket.io-client';
import { DEFAULT_WORLD, type WorldConfig } from '../game/map/world';

const API_URL: string = (import.meta.env.VITE_API_URL as string | undefined) ?? '';
const SOCKET_URL: string = (import.meta.env.VITE_SOCKET_URL as string | undefined) ?? API_URL;

/** Ask the server for the world seed/size. Falls back to defaults when offline. */
export async function fetchWorldConfig(): Promise<WorldConfig> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`${API_URL}/world`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as Partial<WorldConfig>;
    if (typeof data.seed === 'string' && typeof data.width === 'number' && typeof data.height === 'number') {
      return { seed: data.seed, width: data.width, height: data.height };
    }
    throw new Error('Invalid world payload');
  } catch {
    return DEFAULT_WORLD;
  }
}

export function connectSocket(onStatus: (status: string) => void): Socket {
  const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'], reconnectionDelayMax: 10000 });
  onStatus('connexion…');
  socket.on('connect', () => onStatus('connecté'));
  socket.on('disconnect', () => onStatus('déconnecté'));
  socket.on('connect_error', () => onStatus('hors ligne'));
  return socket;
}
