import { WorldRenderer3D } from '../renderer3d/WorldRenderer3D';
import { BuildingModels } from '../buildings/BuildingModels';

/**
 * Interface moderne Glassmorphism de THE MYLA :
 * - Dock de construction de bâtiments (Maison, Tour, Moulin, Lanterne, Route, Fontaine, Ferme...)
 * - Outil de démolition (Bulldozer)
 * - Bouton de rotation 90° (Touche R)
 * - Toggle instantané Mode Sombre / Nuit sombre sans blanchiment
 * - Télémétrie en direct (FPS, tuile survolée, compteur de bâtiments)
 */
export class HudOverlay {
  private readonly renderer3d: WorldRenderer3D;
  private readonly root: HTMLElement;

  private diagEl!: HTMLElement;
  private timeLabel!: HTMLElement;
  private timeSlider!: HTMLInputElement;
  private rotationBtn!: HTMLElement;
  private buildingButtons: Map<string, HTMLButtonElement> = new Map();
  private demolishBtn!: HTMLButtonElement;

  private updateTimer: number = 0;

  constructor(renderer3d: WorldRenderer3D) {
    this.renderer3d = renderer3d;

    // Nettoyer l'ancien overlay s'il existe
    const existing = document.getElementById('hud-root');
    if (existing) existing.remove();

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
    this.buildBuildingDock();

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

    const card = document.createElement('div');
    card.style.cssText = `
      background: rgba(15, 23, 42, 0.85);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 12px;
      padding: 12px 16px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      min-width: 270px;
    `;

    card.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
        <span style="font-weight: 800; font-size: 15px; letter-spacing: 0.5px; background: linear-gradient(135deg, #38bdf8, #818cf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
          THE MYLA · TUILES 3D
        </span>
        <span id="hud-fps-badge" style="background: rgba(34, 197, 94, 0.2); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.35); padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 700;">
          60 FPS
        </span>
      </div>
      <div id="hud-telemetry" style="font-size: 12px; color: #94a3b8; line-height: 1.6;">
        Initialisation de la grille…
      </div>
    `;

    const shortcuts = document.createElement('div');
    shortcuts.style.cssText = `
      background: rgba(15, 23, 42, 0.7);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      padding: 6px 12px;
      font-size: 11px;
      color: #cbd5e1;
    `;
    shortcuts.innerHTML = `💡 <b>Clic</b> Poser · <b>R</b> Tourner · <b>Échap</b> Annuler · <b>Molette</b> Zoom`;

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
      background: rgba(15, 23, 42, 0.85);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 12px;
      padding: 14px 16px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      display: flex;
      flex-direction: column;
      gap: 12px;
      pointer-events: auto;
      width: 240px;
    `;

    // Bouton bascule instantanée Mode Sombre / Mode Jour
    const darkToggleBtn = document.createElement('button');
    darkToggleBtn.style.cssText = `
      width: 100%;
      padding: 9px;
      background: linear-gradient(135deg, #1e293b, #0f172a);
      border: 1px solid rgba(56, 189, 248, 0.4);
      color: #38bdf8;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      transition: all 0.2s ease;
    `;
    darkToggleBtn.innerHTML = `🌙 Basculer Nuit Sombre / Jour`;
    darkToggleBtn.onclick = () => {
      this.renderer3d.toggleNightMode();
      this.timeSlider.value = this.renderer3d.getTimeOfDay().toString();
    };
    panel.appendChild(darkToggleBtn);

    // Heure & Éclairage
    const timeSection = document.createElement('div');
    timeSection.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
        <span style="font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">Heure</span>
        <span id="hud-time-val" style="font-size: 12px; font-weight: 700; color: #fbbf24;">14:30</span>
      </div>
    `;

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '24';
    slider.step = '0.5';
    slider.value = this.renderer3d.getTimeOfDay().toString();
    slider.style.cssText = 'width: 100%; cursor: pointer; accent-color: #38bdf8;';
    slider.oninput = () => {
      this.renderer3d.setTimeOfDay(parseFloat(slider.value));
    };
    this.timeSlider = slider;
    timeSection.appendChild(slider);
    panel.appendChild(timeSection);

    // Modes Caméra
    const camSection = document.createElement('div');
    camSection.innerHTML = `<div style="font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; margin-bottom: 6px;">Vue Caméra</div>`;
    const camButtons = document.createElement('div');
    camButtons.style.cssText = 'display: flex; gap: 4px;';

    const modes = [
      { id: 'isometric' as const, label: '📐 Iso' },
      { id: 'free' as const, label: '🌐 Libre' },
      { id: 'topdown' as const, label: '🛰️ Zénith' },
    ];
    modes.forEach((m) => {
      const btn = document.createElement('button');
      btn.style.cssText = `
        flex: 1;
        padding: 6px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: #e2e8f0;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
      `;
      btn.innerText = m.label;
      btn.onclick = () => this.renderer3d.setCameraMode(m.id);
      camButtons.appendChild(btn);
    });
    camSection.appendChild(camButtons);
    panel.appendChild(camSection);

    this.root.appendChild(panel);
    this.timeLabel = timeSection.querySelector('#hud-time-val')!;
  }

  /**
   * Dock de construction interactif fixé en bas de l'écran.
   */
  private buildBuildingDock(): void {
    const dockContainer = document.createElement('div');
    dockContainer.style.cssText = `
      position: absolute;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      gap: 10px;
      pointer-events: auto;
      background: rgba(15, 23, 42, 0.88);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 16px;
      padding: 10px 14px;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
      max-width: 95vw;
      overflow-x: auto;
    `;

    const defs = BuildingModels.getAllDefinitions();

    defs.forEach((def) => {
      const btn = document.createElement('button');
      btn.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 4px;
        padding: 8px 12px;
        min-width: 64px;
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 10px;
        color: #e2e8f0;
        cursor: pointer;
        transition: all 0.15s ease;
      `;
      btn.innerHTML = `
        <span style="font-size: 22px;">${def.icon}</span>
        <span style="font-size: 10px; font-weight: 600; white-space: nowrap;">${def.name}</span>
      `;

      btn.onclick = () => {
        this.renderer3d.buildingManager.selectBuilding(def.id);
        this.updateDockState();
      };

      this.buildingButtons.set(def.id, btn);
      dockContainer.appendChild(btn);
    });

    // Séparateur vertical
    const sep = document.createElement('div');
    sep.style.cssText = 'width: 1px; height: 36px; background: rgba(255, 255, 255, 0.15); margin: 0 4px;';
    dockContainer.appendChild(sep);

    // Bouton Rotation (R)
    const rotBtn = document.createElement('button');
    rotBtn.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      padding: 8px 12px;
      min-width: 58px;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 10px;
      color: #38bdf8;
      cursor: pointer;
    `;
    rotBtn.innerHTML = `
      <span style="font-size: 20px;">🔄</span>
      <span style="font-size: 10px; font-weight: 700;">Rot (R)</span>
    `;
    rotBtn.onclick = () => {
      this.renderer3d.buildingManager.rotateCurrent();
      this.updateDockState();
    };
    this.rotationBtn = rotBtn;
    dockContainer.appendChild(rotBtn);

    // Bouton Démolition (Bulldozer)
    const demoBtn = document.createElement('button');
    demoBtn.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      padding: 8px 12px;
      min-width: 58px;
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.35);
      border-radius: 10px;
      color: #f87171;
      cursor: pointer;
    `;
    demoBtn.innerHTML = `
      <span style="font-size: 20px;">💥</span>
      <span style="font-size: 10px; font-weight: 700;">Démolir</span>
    `;
    demoBtn.onclick = () => {
      this.renderer3d.buildingManager.selectDemolish();
      this.updateDockState();
    };
    this.demolishBtn = demoBtn;
    dockContainer.appendChild(demoBtn);

    this.root.appendChild(dockContainer);
  }

  private updateDockState(): void {
    const bm = this.renderer3d.buildingManager;

    // Mise à jour de l'état des boutons de bâtiments
    this.buildingButtons.forEach((btn, id) => {
      const isSelected = bm.mode === 'place' && bm.selectedDefId === id;
      btn.style.background = isSelected ? 'rgba(56, 189, 248, 0.3)' : 'rgba(255, 255, 255, 0.06)';
      btn.style.borderColor = isSelected ? '#38bdf8' : 'rgba(255, 255, 255, 0.12)';
      btn.style.color = isSelected ? '#38bdf8' : '#e2e8f0';
      btn.style.transform = isSelected ? 'scale(1.08)' : 'scale(1)';
    });

    // État du bouton Démolir
    if (this.demolishBtn) {
      const isDemo = bm.mode === 'demolish';
      this.demolishBtn.style.background = isDemo ? 'rgba(239, 68, 68, 0.4)' : 'rgba(239, 68, 68, 0.15)';
      this.demolishBtn.style.borderColor = isDemo ? '#ef4444' : 'rgba(239, 68, 68, 0.35)';
      this.demolishBtn.style.transform = isDemo ? 'scale(1.08)' : 'scale(1)';
    }

    // Affichage de la rotation
    if (this.rotationBtn) {
      const deg = bm.currentRotation * 90;
      this.rotationBtn.querySelector('span:last-child')!.textContent = `Rot ${deg}°`;
    }
  }

  private loop = (): void => {
    requestAnimationFrame(this.loop);

    const now = performance.now();
    if (now - this.updateTimer < 100) return;
    this.updateTimer = now;

    const diag = this.renderer3d.getDiagnostics();

    // Mise à jour de la télémétrie
    if (this.diagEl) {
      const modeText =
        diag.buildMode === 'place' ? '🔨 Construction active' :
        diag.buildMode === 'demolish' ? '💥 Outil Démolition' : '👀 Mode Inspection';

      this.diagEl.innerHTML = `
        <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
          <span>Action :</span> <b style="color: #38bdf8;">${modeText}</b>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
          <span>Carreau :</span> <b>[${diag.tileX}, ${diag.tileZ}]</b> (${diag.terrainType})
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>Bâtiments posés :</span> <b style="color: #4ade80;">${diag.placedBuildingsCount}</b>
        </div>
      `;
    }

    // Badge FPS
    const badge = this.root.querySelector('#hud-fps-badge') as HTMLElement;
    if (badge) {
      badge.innerText = `${diag.fps} FPS`;
      badge.style.color = diag.fps >= 50 ? '#4ade80' : diag.fps >= 30 ? '#fbbf24' : '#f87171';
    }

    // Heure
    if (this.timeLabel) {
      this.timeLabel.innerText = `${diag.timeOfDay} ${diag.isNight ? '🌙' : '☀️'}`;
    }

    this.updateDockState();
  };
}
