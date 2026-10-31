import { WorldRenderer3D } from '../renderer3d/WorldRenderer3D';
import { TERRAIN_COLORS } from '../map/world';

const MINI_W = 190;
const MINI_H = 190;

/**
 * Modern glassmorphism HUD interface:
 * - Live telemetry (FPS, Biome, Coordinates, Altitude)
 * - Camera mode toggles (Isometric 3D, Free 3D, Top-Down)
 * - Real-time Day/Night lighting slider & quick presets
 * - Weather ambiance toggles (Clear, Fog, Rain)
 * - Interactive Minimap with real-time camera tracking and click-to-teleport
 */
export class HudOverlay {
  private readonly renderer3d: WorldRenderer3D;
  private readonly root: HTMLElement;

  private diagEl!: HTMLElement;
  private miniCanvas!: HTMLCanvasElement;
  private miniOverlayCanvas!: HTMLCanvasElement;
  private timeSlider!: HTMLInputElement;
  private timeLabel!: HTMLElement;

  private updateTimer: number = 0;

  constructor(renderer3d: WorldRenderer3D) {
    this.renderer3d = renderer3d;

    this.root = document.createElement('div');
    this.root.id = 'hud-root';
    this.root.style.cssText = `
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 50;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #f1f5f9;
      user-select: none;
    `;

    document.body.appendChild(this.root);

    this.buildTopBar();
    this.buildControlsPanel();
    this.buildMinimap();

    // Start UI update loop
    this.loop();
  }

  private buildTopBar(): void {
    const topBar = document.createElement('div');
    topBar.style.cssText = `
      position: absolute;
      top: 16px;
      left: 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      pointer-events: auto;
    `;

    // Title Card
    const card = document.createElement('div');
    card.style.cssText = `
      background: rgba(15, 23, 42, 0.78);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 12px;
      padding: 12px 16px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      min-width: 280px;
    `;

    card.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
        <span style="font-weight: 800; font-size: 15px; letter-spacing: 0.5px; background: linear-gradient(135deg, #38bdf8, #818cf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
          THE MYLA · 3D
        </span>
        <span id="hud-fps-badge" style="background: rgba(34, 197, 94, 0.2); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.35); padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 700;">
          60 FPS
        </span>
      </div>
      <div id="hud-telemetry" style="font-size: 12px; color: #94a3b8; line-height: 1.6;">
        Chargement de la télémétrie…
      </div>
    `;

    // Shortcuts pill
    const shortcuts = document.createElement('div');
    shortcuts.style.cssText = `
      background: rgba(15, 23, 42, 0.65);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      padding: 6px 12px;
      font-size: 11px;
      color: #cbd5e1;
    `;
    shortcuts.innerHTML = `🕹️ <b>ZQSD / Flèches</b> Déplacer · <b>Clic Droit</b> Orbiter · <b>Molette</b> Zoom · <b>Shift</b> Sprint`;

    topBar.appendChild(card);
    topBar.appendChild(shortcuts);
    this.root.appendChild(topBar);

    this.diagEl = card.querySelector('#hud-telemetry')!;
  }

  private buildControlsPanel(): void {
    const panel = document.createElement('div');
    panel.style.cssText = `
      position: absolute;
      top: 16px;
      right: 16px;
      background: rgba(15, 23, 42, 0.78);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 12px;
      padding: 14px 16px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      display: flex;
      flex-direction: column;
      gap: 12px;
      pointer-events: auto;
      width: 250px;
    `;

    // Camera Mode
    const camSection = document.createElement('div');
    camSection.innerHTML = `<div style="font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; margin-bottom: 6px;">Mode Caméra</div>`;
    const camButtons = document.createElement('div');
    camButtons.style.cssText = 'display: flex; gap: 4px;';

    const modes: Array<{ id: 'isometric' | 'free' | 'topdown'; label: string; icon: string }> = [
      { id: 'isometric', label: 'Iso 3D', icon: '📐' },
      { id: 'free', label: 'Libre', icon: '🌐' },
      { id: 'topdown', label: 'Zénith', icon: '🛰️' },
    ];

    const modeBtnEls: HTMLElement[] = [];
    modes.forEach((m) => {
      const btn = document.createElement('button');
      btn.style.cssText = `
        flex: 1;
        padding: 6px 8px;
        background: ${m.id === 'isometric' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.05)'};
        border: 1px solid ${m.id === 'isometric' ? 'rgba(56, 189, 248, 0.6)' : 'rgba(255, 255, 255, 0.1)'};
        color: ${m.id === 'isometric' ? '#38bdf8' : '#e2e8f0'};
        border-radius: 6px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
      `;
      btn.innerHTML = `${m.icon} ${m.label}`;
      btn.onclick = () => {
        this.renderer3d.setCameraMode(m.id);
        modeBtnEls.forEach((b, idx) => {
          const isCurr = modes[idx]?.id === m.id;
          b.style.background = isCurr ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.05)';
          b.style.borderColor = isCurr ? 'rgba(56, 189, 248, 0.6)' : 'rgba(255, 255, 255, 0.1)';
          b.style.color = isCurr ? '#38bdf8' : '#e2e8f0';
        });
      };
      modeBtnEls.push(btn);
      camButtons.appendChild(btn);
    });
    camSection.appendChild(camButtons);
    panel.appendChild(camSection);

    // Day/Night Cycle Slider & Presets
    const timeSection = document.createElement('div');
    timeSection.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
        <span style="font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">Heure / Éclairage</span>
        <span id="hud-time-val" style="font-size: 12px; font-weight: 700; color: #fbbf24;">15:30</span>
      </div>
    `;

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '24';
    slider.step = '0.25';
    slider.value = this.renderer3d.getTimeOfDay().toString();
    slider.style.cssText = 'width: 100%; cursor: pointer; accent-color: #38bdf8;';
    slider.oninput = () => {
      this.renderer3d.setTimeOfDay(parseFloat(slider.value));
    };
    this.timeSlider = slider;
    timeSection.appendChild(slider);

    // Quick Time Presets
    const presetsDiv = document.createElement('div');
    presetsDiv.style.cssText = 'display: flex; gap: 4px; margin-top: 6px;';
    const presets = [
      { label: '🌅 Aube', time: 6.5 },
      { label: '☀️ Midi', time: 12.0 },
      { label: '🌇 Couché', time: 18.5 },
      { label: '🌙 Nuit', time: 0.0 },
    ];
    presets.forEach((p) => {
      const pbtn = document.createElement('button');
      pbtn.style.cssText = `
        flex: 1;
        padding: 4px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 4px;
        color: #94a3b8;
        font-size: 10px;
        cursor: pointer;
      `;
      pbtn.innerText = p.label;
      pbtn.onclick = () => {
        this.renderer3d.setTimeOfDay(p.time);
        this.timeSlider.value = p.time.toString();
      };
      presetsDiv.appendChild(pbtn);
    });
    timeSection.appendChild(presetsDiv);
    panel.appendChild(timeSection);

    // Weather Section
    const weatherSection = document.createElement('div');
    weatherSection.innerHTML = `<div style="font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; margin-bottom: 6px;">Météo & Ambiance</div>`;
    const weatherDiv = document.createElement('div');
    weatherDiv.style.cssText = 'display: flex; gap: 4px;';
    const weathers: Array<{ id: 'clear' | 'foggy' | 'rainy'; label: string }> = [
      { id: 'clear', label: '☀️ Clair' },
      { id: 'foggy', label: '🌫️ Brume' },
      { id: 'rainy', label: '🌧️ Pluie' },
    ];
    weathers.forEach((w) => {
      const wbtn = document.createElement('button');
      wbtn.style.cssText = `
        flex: 1;
        padding: 5px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 4px;
        color: #cbd5e1;
        font-size: 10px;
        cursor: pointer;
      `;
      wbtn.innerText = w.label;
      wbtn.onclick = () => {
        this.renderer3d.setWeather(w.id);
      };
      weatherDiv.appendChild(wbtn);
    });
    weatherSection.appendChild(weatherDiv);
    panel.appendChild(weatherSection);

    this.root.appendChild(panel);
    this.timeLabel = timeSection.querySelector('#hud-time-val')!;
  }

  private buildMinimap(): void {
    const box = document.createElement('div');
    box.style.cssText = `
      position: absolute;
      right: 16px;
      bottom: 16px;
      width: ${MINI_W}px;
      height: ${MINI_H + 28}px;
      background: rgba(15, 23, 42, 0.85);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      pointer-events: auto;
      display: flex;
      flex-direction: column;
    `;

    const header = document.createElement('div');
    header.style.cssText = `
      height: 28px;
      background: rgba(0, 0, 0, 0.35);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 10px;
      font-size: 11px;
      font-weight: 700;
      color: #94a3b8;
    `;
    header.innerHTML = `<span>🗺️ CARTE MONDE</span><span style="font-size: 9px; color: #64748b;">CLIC = TP</span>`;
    box.appendChild(header);

    const mapContainer = document.createElement('div');
    mapContainer.style.cssText = `position: relative; width: ${MINI_W}px; height: ${MINI_H}px; cursor: crosshair;`;

    // Static terrain canvas
    this.miniCanvas = document.createElement('canvas');
    this.miniCanvas.width = MINI_W;
    this.miniCanvas.height = MINI_H;
    this.miniCanvas.style.cssText = 'position: absolute; inset: 0;';

    // Dynamic overlay canvas for player reticle
    this.miniOverlayCanvas = document.createElement('canvas');
    this.miniOverlayCanvas.width = MINI_W;
    this.miniOverlayCanvas.height = MINI_H;
    this.miniOverlayCanvas.style.cssText = 'position: absolute; inset: 0; pointer-events: none;';

    mapContainer.appendChild(this.miniCanvas);
    mapContainer.appendChild(this.miniOverlayCanvas);

    // Click on Minimap to teleport 3D camera
    const onMapClick = (e: MouseEvent) => {
      const rect = mapContainer.getBoundingClientRect();
      const u = Math.max(0, Math.min(1, (e.clientX - rect.left) / MINI_W));
      const v = Math.max(0, Math.min(1, (e.clientY - rect.top) / MINI_H));
      const targetTileX = Math.floor(u * this.renderer3d.world.width);
      const targetTileY = Math.floor(v * this.renderer3d.world.height);
      this.renderer3d.teleportToTile(targetTileX, targetTileY);
    };

    mapContainer.addEventListener('click', onMapClick);

    box.appendChild(mapContainer);
    this.root.appendChild(box);

    // Draw base minimap asynchronously
    this.renderBaseMinimap();
  }

  private renderBaseMinimap(): void {
    const ctx = this.miniCanvas.getContext('2d');
    if (!ctx) return;

    const img = ctx.createImageData(MINI_W, MINI_H);
    const w = this.renderer3d.world.width;
    const h = this.renderer3d.world.height;

    for (let v = 0; v < MINI_H; v++) {
      for (let u = 0; u < MINI_W; u++) {
        const tx = Math.floor((u / MINI_W) * w);
        const ty = Math.floor((v / MINI_H) * h);
        const tile = this.renderer3d.world.tile(tx, ty);
        const col = TERRAIN_COLORS[tile.terrain] ?? 0x16365e;

        const idx = (v * MINI_W + u) * 4;
        img.data[idx] = (col >> 16) & 0xff;
        img.data[idx + 1] = (col >> 8) & 0xff;
        img.data[idx + 2] = col & 0xff;
        img.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  private loop = (): void => {
    requestAnimationFrame(this.loop);

    const now = performance.now();
    if (now - this.updateTimer < 100) return;
    this.updateTimer = now;

    const diag = this.renderer3d.getDiagnostics();

    // Update Telemetry
    if (this.diagEl) {
      this.diagEl.innerHTML = `
        <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
          <span>Biome :</span> <b style="color: #38bdf8;">${diag.biome}</b>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
          <span>Position :</span> <b>${diag.tileX}, ${diag.tileY}</b> (Alt: ${diag.altitude}m)
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>Chunks 3D :</span> <span>${diag.activeChunks} actifs (${Math.round(diag.triangles / 1000)}k tris)</span>
        </div>
      `;
    }

    // Update FPS badge
    const badge = this.root.querySelector('#hud-fps-badge') as HTMLElement;
    if (badge) {
      badge.innerText = `${diag.fps} FPS`;
      badge.style.color = diag.fps >= 50 ? '#4ade80' : diag.fps >= 30 ? '#fbbf24' : '#f87171';
    }

    // Update time label
    if (this.timeLabel) {
      this.timeLabel.innerText = diag.timeOfDay;
    }

    // Update Minimap reticle
    const ctx = this.miniOverlayCanvas?.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, MINI_W, MINI_H);

      const u = (diag.tileX / this.renderer3d.world.width) * MINI_W;
      const v = (diag.tileY / this.renderer3d.world.height) * MINI_H;

      // Pulse circle
      ctx.beginPath();
      ctx.arc(u, v, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#38bdf8';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      // Crosshairs
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.beginPath();
      ctx.moveTo(u, 0); ctx.lineTo(u, MINI_H);
      ctx.moveTo(0, v); ctx.lineTo(MINI_W, v);
      ctx.stroke();
    }
  };
}
