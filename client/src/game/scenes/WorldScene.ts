import Phaser from 'phaser';
import { connectSocket } from '../../network/api';
import {
  CHUNK,
  LEVEL_PX,
  MAX_LEVEL,
  TERRAIN_COLORS,
  TILE_H,
  TILE_W,
  Terrain,
  World,
  tileToWorld,
  worldToTile,
  type TileInfo,
  type WorldConfig,
} from '../map/world';

const MAX_H = MAX_LEVEL * LEVEL_PX;
const PAD = 14; // headroom above a tile texture (trees, peaks)
const CHUNK_PX_W = CHUNK * TILE_W;
const CHUNK_PX_H = CHUNK * TILE_H + MAX_H + PAD;
const CHUNKS_PER_FRAME = 3;
const CACHE_HIGH = 80;
const CACHE_LOW = 64;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;
const MINI_W = 240;
const MINI_H = 120;

function shade(color: number, f: number): number {
  const r = Math.min(255, Math.round(((color >> 16) & 0xff) * f));
  const g = Math.min(255, Math.round(((color >> 8) & 0xff) * f));
  const b = Math.min(255, Math.round((color & 0xff) * f));
  return (r << 16) | (g << 8) | b;
}

interface ChunkEntry {
  rt: Phaser.GameObjects.RenderTexture;
  used: number;
}

export class WorldScene extends Phaser.Scene {
  private world!: World;
  private chunks = new Map<string, ChunkEntry>();
  private madeTextures = new Set<string>();
  private scratch!: Phaser.GameObjects.Graphics;
  private frame = 0;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys?: Record<string, Phaser.Input.Keyboard.Key>;
  private lastPinch = 0;
  private socketStatus = '…';
  private hud?: HTMLDivElement;
  private hudTimer = 0;
  private miniView?: HTMLCanvasElement;
  private root?: HTMLDivElement;
  private mapOffsetX = 0;
  private mapW = 1;
  private mapH = 1;

  constructor() {
    super('World');
  }

  init(data: { world: WorldConfig }): void {
    this.world = new World(data.world);
  }

  create(): void {
    const w = this.world;
    this.mapOffsetX = -(w.height * TILE_W) / 2;
    this.mapW = ((w.width + w.height) * TILE_W) / 2;
    this.mapH = ((w.width + w.height) * TILE_H) / 2;

    this.scratch = this.make.graphics({ x: 0, y: 0 }, false);

    const cam = this.cameras.main;
    cam.setBackgroundColor(0x0b1e33);
    cam.setBounds(this.mapOffsetX, -MAX_H - PAD, this.mapW, this.mapH + MAX_H + PAD + 64);
    const spawn = w.findSpawn();
    const p = tileToWorld(spawn.x, spawn.y);
    cam.centerOn(p.x, p.y);

    this.setupInput();
    this.buildUi();
    connectSocket((s) => {
      this.socketStatus = s;
    });

    this.events.once('shutdown', () => this.root?.remove());
  }

  // ---------------------------------------------------------------- input

  private setupInput(): void {
    this.input.addPointer(1);
    const cam = this.cameras.main;

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const p1 = this.input.pointer1;
      const p2 = this.input.pointer2;
      if (p1.isDown && p2.isDown) {
        const d = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
        if (this.lastPinch > 0) this.setZoom(cam.zoom * (d / this.lastPinch));
        this.lastPinch = d;
        return;
      }
      if (p.isDown) {
        cam.scrollX -= (p.x - p.prevPosition.x) / cam.zoom;
        cam.scrollY -= (p.y - p.prevPosition.y) / cam.zoom;
      }
    });
    this.input.on('pointerup', () => {
      this.lastPinch = 0;
    });
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      this.setZoom(cam.zoom * (dy > 0 ? 0.9 : 1.1));
    });

    this.cursors = this.input.keyboard?.createCursorKeys();
    this.keys = this.input.keyboard?.addKeys('W,A,S,D,Z,Q') as Record<string, Phaser.Input.Keyboard.Key> | undefined;
  }

  private setZoom(z: number): void {
    this.cameras.main.setZoom(Phaser.Math.Clamp(z, MIN_ZOOM, MAX_ZOOM));
  }

  // ------------------------------------------------------------ tile art

  private ensureTexture(t: TileInfo): string {
    const key = `t${t.terrain}_${t.level}_${t.variant}`;
    if (this.madeTextures.has(key)) return key;

    const g = this.scratch;
    g.clear();
    const h = t.level * LEVEL_PX;
    const base = shade(TERRAIN_COLORS[t.terrain], [0.93, 1, 1.07][t.variant] ?? 1);
    const hw = TILE_W / 2;
    const hh = TILE_H / 2;
    const top = PAD;

    if (h > 0) {
      g.fillStyle(shade(base, 0.78));
      g.fillPoints(
        [{ x: 0, y: top + hh }, { x: hw, y: top + TILE_H }, { x: hw, y: top + TILE_H + h }, { x: 0, y: top + hh + h }],
        true,
      );
      g.fillStyle(shade(base, 0.6));
      g.fillPoints(
        [{ x: hw, y: top + TILE_H }, { x: TILE_W, y: top + hh }, { x: TILE_W, y: top + hh + h }, { x: hw, y: top + TILE_H + h }],
        true,
      );
    }
    g.fillStyle(base);
    g.fillPoints(
      [{ x: hw, y: top }, { x: TILE_W, y: top + hh }, { x: hw, y: top + TILE_H }, { x: 0, y: top + hh }],
      true,
    );
    this.decorate(g, t, base, hw, top + hh);

    g.generateTexture(key, TILE_W, PAD + TILE_H + h);
    this.madeTextures.add(key);
    return key;
  }

  private decorate(g: Phaser.GameObjects.Graphics, t: TileInfo, base: number, cx: number, cy: number): void {
    const v = t.variant;
    switch (t.terrain) {
      case Terrain.Forest: {
        const spots: Array<[number, number]> = [[-9, -2], [8, 3]];
        for (const [ox, oy] of spots) {
          const x = cx + ox + (v - 1) * 3;
          const y = cy + oy;
          g.fillStyle(0x5b3a1e);
          g.fillRect(x - 1, y - 1, 2, 4);
          g.fillStyle(0x1f5a2b);
          g.fillTriangle(x - 6, y, x + 6, y, x, y - 14);
          g.fillStyle(0x2c7a3a);
          g.fillTriangle(x - 5, y - 5, x + 5, y - 5, x, y - 17);
        }
        break;
      }
      case Terrain.Grass: {
        g.fillStyle(0x7cc065);
        g.fillRect(cx - 10 + v * 4, cy - 3, 2, 2);
        g.fillRect(cx + 6 - v * 3, cy + 2, 2, 2);
        g.fillRect(cx - 2, cy - 6 + v, 2, 2);
        break;
      }
      case Terrain.Sand:
      case Terrain.Dry: {
        g.fillStyle(shade(base, 0.82));
        g.fillRect(cx - 8 + v * 3, cy - 2, 2, 1);
        g.fillRect(cx + 5, cy + 3 - v, 2, 1);
        break;
      }
      case Terrain.Rock:
      case Terrain.Snow: {
        g.fillStyle(shade(base, t.terrain === Terrain.Snow ? 0.94 : 1.15));
        g.fillPoints([{ x: cx, y: cy - 7 }, { x: cx + 14, y: cy }, { x: cx, y: cy + 7 }, { x: cx - 14, y: cy }], true);
        break;
      }
      case Terrain.ShallowWater: {
        g.fillStyle(0x8cc4e8);
        g.fillRect(cx - 9 + v * 3, cy - 2, 8, 1);
        g.fillRect(cx + 1 - v * 2, cy + 3, 6, 1);
        break;
      }
      default:
        break;
    }
  }

  // --------------------------------------------------------------- chunks

  private chunkRect(cx: number, cy: number): Phaser.Geom.Rectangle {
    const vx = ((cx - cy) * CHUNK * TILE_W) / 2;
    const vy = ((cx + cy) * CHUNK * TILE_H) / 2;
    return new Phaser.Geom.Rectangle(vx - CHUNK_PX_W / 2, vy - MAX_H - PAD, CHUNK_PX_W, CHUNK_PX_H);
  }

  private createChunk(cx: number, cy: number): ChunkEntry {
    const r = this.chunkRect(cx, cy);
    const entries: Array<{ key: string; x: number; y: number }> = [];
    for (let s = 0; s <= 2 * (CHUNK - 1); s++) {
      for (let lx = Math.max(0, s - (CHUNK - 1)); lx <= Math.min(CHUNK - 1, s); lx++) {
        const ly = s - lx;
        const info = this.world.tile(cx * CHUNK + lx, cy * CHUNK + ly);
        entries.push({
          key: this.ensureTexture(info),
          x: ((lx - ly) * TILE_W) / 2 + ((CHUNK - 1) * TILE_W) / 2,
          y: ((lx + ly) * TILE_H) / 2 + MAX_H - info.level * LEVEL_PX,
        });
      }
    }
    const rt = this.add.renderTexture(r.x, r.y, CHUNK_PX_W, CHUNK_PX_H).setOrigin(0, 0).setDepth(cx + cy);
    rt.beginDraw();
    for (const e of entries) rt.batchDrawFrame(e.key, undefined, e.x, e.y);
    rt.endDraw();
    return { rt, used: this.frame };
  }

  private updateChunks(): void {
    const view = this.cameras.main.worldView;
    const corners = [
      worldToTile(view.x, view.y),
      worldToTile(view.right, view.y),
      worldToTile(view.x, view.bottom),
      worldToTile(view.right, view.bottom),
    ];
    const ncx = Math.ceil(this.world.width / CHUNK);
    const ncy = Math.ceil(this.world.height / CHUNK);
    const minC = (vals: number[], max: number) => Phaser.Math.Clamp(Math.floor(Math.min(...vals) / CHUNK) - 1, 0, max - 1);
    const maxC = (vals: number[], max: number) => Phaser.Math.Clamp(Math.floor(Math.max(...vals) / CHUNK) + 1, 0, max - 1);
    const xs = corners.map((c) => c.x);
    const ys = corners.map((c) => c.y);

    const missing: Array<{ cx: number; cy: number; d: number }> = [];
    const mid = { x: view.centerX, y: view.centerY };
    for (let cy = minC(ys, ncy); cy <= maxC(ys, ncy); cy++) {
      for (let cx = minC(xs, ncx); cx <= maxC(xs, ncx); cx++) {
        const r = this.chunkRect(cx, cy);
        if (r.right < view.x || r.x > view.right || r.bottom < view.y || r.y > view.bottom) continue;
        const entry = this.chunks.get(`${cx},${cy}`);
        if (entry) entry.used = this.frame;
        else missing.push({ cx, cy, d: Phaser.Math.Distance.Between(r.centerX, r.centerY, mid.x, mid.y) });
      }
    }

    missing.sort((a, b) => a.d - b.d);
    for (const m of missing.slice(0, CHUNKS_PER_FRAME)) {
      this.chunks.set(`${m.cx},${m.cy}`, this.createChunk(m.cx, m.cy));
    }

    if (this.chunks.size > CACHE_HIGH) {
      const old = [...this.chunks.entries()]
        .filter(([, e]) => e.used < this.frame)
        .sort((a, b) => a[1].used - b[1].used);
      for (const [key, e] of old) {
        if (this.chunks.size <= CACHE_LOW) break;
        e.rt.destroy();
        this.chunks.delete(key);
      }
    }
  }

  // ------------------------------------------------------------------- UI

  private buildUi(): void {
    const root = document.createElement('div');
    root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:10;font:12px system-ui,sans-serif;color:#e8f1ff';
    this.root = root;

    const hud = document.createElement('div');
    hud.style.cssText =
      'position:absolute;top:10px;left:10px;padding:8px 10px;border-radius:8px;background:rgba(8,16,28,.72);line-height:1.5;white-space:pre';
    root.appendChild(hud);
    this.hud = hud;

    const box = document.createElement('div');
    box.style.cssText =
      'position:absolute;right:10px;bottom:10px;border-radius:8px;overflow:hidden;background:rgba(8,16,28,.72);pointer-events:auto;touch-action:none';
    const mini = this.buildMinimapCanvas();
    this.miniView = document.createElement('canvas');
    this.miniView.width = MINI_W;
    this.miniView.height = MINI_H;
    this.miniView.style.cssText = 'position:absolute;inset:0';
    box.style.width = `${MINI_W}px`;
    box.style.height = `${MINI_H}px`;
    box.append(mini, this.miniView);
    const jump = (e: PointerEvent) => {
      if (e.type === 'pointermove' && !(e.buttons & 1)) return;
      const rect = box.getBoundingClientRect();
      const wx = this.mapOffsetX + ((e.clientX - rect.left) / MINI_W) * this.mapW;
      const wy = ((e.clientY - rect.top) / MINI_H) * this.mapH;
      this.cameras.main.centerOn(wx, wy);
    };
    box.addEventListener('pointerdown', jump);
    box.addEventListener('pointermove', jump);
    root.appendChild(box);
    document.body.appendChild(root);
  }

  private buildMinimapCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = MINI_W;
    canvas.height = MINI_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;
    const img = ctx.createImageData(MINI_W, MINI_H);
    for (let v = 0; v < MINI_H; v++) {
      for (let u = 0; u < MINI_W; u++) {
        const wx = this.mapOffsetX + ((u + 0.5) / MINI_W) * this.mapW;
        const wy = ((v + 0.5) / MINI_H) * this.mapH;
        const t = worldToTile(wx, wy);
        const tx = Math.floor(t.x);
        const ty = Math.floor(t.y);
        if (!this.world.inBounds(tx, ty)) continue;
        const c = TERRAIN_COLORS[this.world.tile(tx, ty).terrain];
        const i = (v * MINI_W + u) * 4;
        img.data[i] = (c >> 16) & 0xff;
        img.data[i + 1] = (c >> 8) & 0xff;
        img.data[i + 2] = c & 0xff;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
  }

  private updateUi(delta: number): void {
    const cam = this.cameras.main;
    const view = cam.worldView;

    const ctx = this.miniView?.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, MINI_W, MINI_H);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(
        ((view.x - this.mapOffsetX) / this.mapW) * MINI_W,
        (view.y / this.mapH) * MINI_H,
        (view.width / this.mapW) * MINI_W,
        (view.height / this.mapH) * MINI_H,
      );
    }

    this.hudTimer += delta;
    if (this.hudTimer < 200 || !this.hud) return;
    this.hudTimer = 0;
    const c = worldToTile(view.centerX, view.centerY);
    this.hud.textContent =
      `THE MYLA\n` +
      `Carte ${this.world.width} × ${this.world.height} (${((this.world.width * this.world.height) / 1e6).toFixed(1)} M tuiles)\n` +
      `Position ${Math.floor(c.x)}, ${Math.floor(c.y)}   Zoom ${cam.zoom.toFixed(2)}   ${Math.round(this.game.loop.actualFps)} FPS\n` +
      `Serveur : ${this.socketStatus}\n` +
      `Glisser = se déplacer · Molette / pincer = zoom · ZQSD/flèches`;
  }

  // --------------------------------------------------------------- update

  update(_time: number, delta: number): void {
    this.frame++;
    const cam = this.cameras.main;
    const k = this.keys;
    const speed = (900 / cam.zoom) * (delta / 1000);
    const left = this.cursors?.left.isDown || k?.A?.isDown || k?.Q?.isDown;
    const right = this.cursors?.right.isDown || k?.D?.isDown;
    const up = this.cursors?.up.isDown || k?.W?.isDown || k?.Z?.isDown;
    const down = this.cursors?.down.isDown || k?.S?.isDown;
    if (left) cam.scrollX -= speed;
    if (right) cam.scrollX += speed;
    if (up) cam.scrollY -= speed;
    if (down) cam.scrollY += speed;

    this.updateChunks();
    this.updateUi(delta);
  }
}
