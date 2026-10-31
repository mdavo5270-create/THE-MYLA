/**
 * Procedural world: any tile can be computed on demand, so the map can be
 * enormous (default 4096 x 4096 = ~16.7 million tiles) without storing it.
 */

import { fbm, hash2, hashString } from './noise';

export const TILE_W = 64;
export const TILE_H = 32;
export const CHUNK = 16;
export const LEVEL_PX = 5;
export const MAX_LEVEL = 7;

export enum Terrain {
  DeepWater,
  ShallowWater,
  Sand,
  Grass,
  Forest,
  Dry,
  Rock,
  Snow,
}

export interface TileInfo {
  terrain: Terrain;
  /** 0 for water, 1..MAX_LEVEL for land */
  level: number;
  variant: number;
}

export interface WorldConfig {
  seed: string;
  width: number;
  height: number;
}

export const DEFAULT_WORLD: WorldConfig = { seed: 'the-myla', width: 4096, height: 4096 };

export const TERRAIN_COLORS: Record<Terrain, number> = {
  [Terrain.DeepWater]: 0x16365e,
  [Terrain.ShallowWater]: 0x2a6f9e,
  [Terrain.Sand]: 0xe2d18b,
  [Terrain.Grass]: 0x5fa850,
  [Terrain.Forest]: 0x2f7a3d,
  [Terrain.Dry]: 0xb59a52,
  [Terrain.Rock]: 0x7d7f86,
  [Terrain.Snow]: 0xf1f5fa,
};

function smoothstep(a: number, b: number, v: number): number {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export class World {
  readonly config: WorldConfig;
  private readonly seedElevation: number;
  private readonly seedMoisture: number;
  private readonly seedVariant: number;

  constructor(config: WorldConfig) {
    this.config = config;
    const base = hashString(config.seed);
    this.seedElevation = base;
    this.seedMoisture = (base ^ 0x9e3779b9) >>> 0;
    this.seedVariant = (base ^ 0x85ebca6b) >>> 0;
  }

  get width(): number {
    return this.config.width;
  }

  get height(): number {
    return this.config.height;
  }

  inBounds(tx: number, ty: number): boolean {
    return tx >= 0 && ty >= 0 && tx < this.width && ty < this.height;
  }

  /** 0..1 elevation, with ocean pushed around the map border. */
  elevation(tx: number, ty: number): number {
    const nx = (tx / this.width) * 2 - 1;
    const ny = (ty / this.height) * 2 - 1;
    const edge = smoothstep(0.7, 1.0, Math.max(Math.abs(nx), Math.abs(ny)));
    const continents = fbm(tx / 420, ty / 420, this.seedElevation, 3);
    const detail = fbm(tx / 70, ty / 70, this.seedElevation + 77, 4);
    const e = continents * 0.7 + detail * 0.3;
    return e - edge * 0.45;
  }

  tile(tx: number, ty: number): TileInfo {
    const variant = Math.floor(hash2(tx, ty, this.seedVariant) * 3);
    if (!this.inBounds(tx, ty)) return { terrain: Terrain.DeepWater, level: 0, variant };

    const e = this.elevation(tx, ty);
    if (e < 0.36) return { terrain: Terrain.DeepWater, level: 0, variant };
    if (e < 0.44) return { terrain: Terrain.ShallowWater, level: 0, variant };

    const level = Math.min(MAX_LEVEL, 1 + Math.floor((e - 0.44) * 16));
    if (e < 0.47) return { terrain: Terrain.Sand, level, variant };

    const m = fbm(tx / 160, ty / 160, this.seedMoisture, 4);
    if (e > 0.74) return { terrain: Terrain.Snow, level, variant };
    if (e > 0.64) return { terrain: Terrain.Rock, level, variant };
    if (m > 0.56) return { terrain: Terrain.Forest, level, variant };
    if (m < 0.38) return { terrain: Terrain.Dry, level, variant };
    return { terrain: Terrain.Grass, level, variant };
  }

  /** Find a nearby walkable (land) tile, starting from the map centre. */
  findSpawn(): { x: number; y: number } {
    const cx = Math.floor(this.width / 2);
    const cy = Math.floor(this.height / 2);
    for (let r = 0; r < this.width / 2; r += 4) {
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        const x = Math.floor(cx + Math.cos(a) * r);
        const y = Math.floor(cy + Math.sin(a) * r);
        const t = this.tile(x, y);
        if (t.terrain === Terrain.Grass || t.terrain === Terrain.Forest) return { x, y };
      }
    }
    return { x: cx, y: cy };
  }
}

/** Tile -> world (screen-space) pixel position of the tile's top vertex. */
export function tileToWorld(tx: number, ty: number): { x: number; y: number } {
  return { x: (tx - ty) * (TILE_W / 2), y: (tx + ty) * (TILE_H / 2) };
}

/** World pixel -> fractional tile coordinates. */
export function worldToTile(x: number, y: number): { x: number; y: number } {
  const a = x / (TILE_W / 2);
  const b = y / (TILE_H / 2);
  return { x: (a + b) / 2, y: (b - a) / 2 };
}
