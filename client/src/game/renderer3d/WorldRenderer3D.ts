import * as THREE from 'three';
import { World, WorldConfig } from '../map/world';
import { TileGrid } from '../grid/TileGrid';
import { BuildingManager } from '../buildings/BuildingManager';
import { SkyAtmosphere } from './SkyAtmosphere';
import { Controls3D, CameraMode } from './Controls3D';

export interface Diagnostics {
  fps: number;
  tileX: number;
  tileZ: number;
  terrainType: string;
  altitude: number;
  timeOfDay: string;
  isNight: boolean;
  placedBuildingsCount: number;
  buildMode: string;
}

/**
 * Moteur 3D principal de THE MYLA intégrant :
 * - Grille de tuiles / carreaux isométriques 3D découpés
 * - Système de construction et dépôt de bâtiments en temps réel
 * - Vrai mode sombre nocturne sans blanchiment
 * - Éclairage PBR avec ombres douces et illumination nocturne des lanternes/fenêtres
 */
export class WorldRenderer3D {
  readonly world: World;
  readonly container: HTMLElement;

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;

  readonly grid: TileGrid;
  readonly buildingManager: BuildingManager;
  readonly sky: SkyAtmosphere;
  private controls: Controls3D;

  private clock: THREE.Clock = new THREE.Clock();
  private frameCount: number = 0;
  private fps: number = 60;
  private lastFpsUpdate: number = 0;
  private isRunning: boolean = false;

  // Raycasting pour la détection des carreaux sous le curseur
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2(-999, -999);
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private planeIntersectPoint = new THREE.Vector3();
  private isPointerDragging: boolean = false;
  private pointerDownPos = new THREE.Vector2();

  constructor(worldConfig: WorldConfig, container: HTMLElement) {
    this.world = new World(worldConfig);
    this.container = container;

    // Configuration WebGLRenderer haute fidélité
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1.0, 1200);

    // Initialisation du ciel et de l'atmosphère (vrai mode sombre)
    this.sky = new SkyAtmosphere(this.scene);

    // Initialisation de la grille de tuiles (carreaux 3D nets)
    this.grid = new TileGrid(this.world, 64, 64);
    this.scene.add(this.grid.group);

    // Initialisation du gestionnaire de bâtiments
    this.buildingManager = new BuildingManager(this.scene, this.grid);

    // Contrôleur de caméra isométrique
    this.controls = new Controls3D(this.camera, this.renderer.domElement);
    this.controls.teleportTo(0, 5, 0);

    // Écouteurs de souris pour le raycasting de tuiles
    this.bindMouseRaycast();

    // Raccourcis clavier (R pour pivoter, Échap pour annuler)
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('resize', this.onResize);

    // Démarrer la boucle de rendu
    this.start();
  }

  private bindMouseRaycast(): void {
    const el = this.renderer.domElement;

    el.addEventListener('pointerdown', (e) => {
      this.pointerDownPos.set(e.clientX, e.clientY);
      this.isPointerDragging = false;
    });

    el.addEventListener('pointermove', (e) => {
      const rect = el.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      // Détection de glisser pour la caméra
      if (Math.abs(e.clientX - this.pointerDownPos.x) > 5 || Math.abs(e.clientY - this.pointerDownPos.y) > 5) {
        this.isPointerDragging = true;
      }
    });

    el.addEventListener('pointerup', (e) => {
      // Si clic sans glisser et clic gauche : poser / démolir le bâtiment
      if (!this.isPointerDragging && e.button === 0 && this.buildingManager.mode !== 'none') {
        this.buildingManager.handleClick();
      }
    });
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === 'KeyR') {
      // Rotation à 90° du bâtiment
      this.buildingManager.rotateCurrent();
    } else if (e.code === 'Escape') {
      // Annuler l'action de construction
      this.buildingManager.cancelAction();
    }
  };

  private onResize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.clock.start();
    this.loop();
  }

  stop(): void {
    this.isRunning = false;
  }

  private loop = (): void => {
    if (!this.isRunning) return;
    requestAnimationFrame(this.loop);

    const delta = Math.min(this.clock.getDelta(), 0.1);
    const elapsed = this.clock.getElapsedTime();

    // Calcul du FPS
    this.frameCount++;
    if (elapsed - this.lastFpsUpdate >= 0.5) {
      this.fps = Math.round((this.frameCount / (elapsed - this.lastFpsUpdate)));
      this.frameCount = 0;
      this.lastFpsUpdate = elapsed;
    }

    // Raycast de la souris sur le plan de la grille
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hit = this.raycaster.ray.intersectPlane(this.groundPlane, this.planeIntersectPoint);

    if (hit) {
      const gridCoords = this.grid.worldToGrid(this.planeIntersectPoint.x, this.planeIntersectPoint.z);
      if (gridCoords) {
        this.buildingManager.updateHover(gridCoords.gridX, gridCoords.gridZ);
      } else {
        this.grid.hideCursor();
      }
    }

    // Mise à jour de la caméra
    this.controls.update(delta);

    const focusPos = this.controls.target;

    // Mise à jour de l'atmosphère (Soleil/Lune)
    this.sky.update(focusPos, this.camera);

    // Mise à jour des bâtiments (animations et lumières de nuit)
    this.buildingManager.update(delta, this.sky.isNight);

    // Rendu de la scène
    this.renderer.render(this.scene, this.camera);
  };

  // APIs pour le menu et l'interface
  setTimeOfDay(hours: number): void {
    this.sky.setTimeOfDay(hours);
  }

  getTimeOfDay(): number {
    return this.sky.timeOfDay;
  }

  toggleNightMode(): void {
    if (this.sky.isNight) {
      this.sky.setTimeOfDay(14.0); // Retour au jour
    } else {
      this.sky.setTimeOfDay(0.0);  // Nuit sombre
    }
  }

  setCameraMode(mode: CameraMode): void {
    this.controls.setMode(mode);
  }

  teleportToTile(gridX: number, gridZ: number): void {
    const pos = this.grid.gridToWorld(gridX, gridZ);
    this.controls.teleportTo(pos.x, pos.y + 1, pos.z);
  }

  getDiagnostics(): Diagnostics {
    const focus = this.controls.target;
    const g = this.grid.worldToGrid(focus.x, focus.z);
    const gx = g ? g.gridX : 0;
    const gz = g ? g.gridZ : 0;
    const tile = this.grid.getTile(gx, gz);

    const h = Math.floor(this.sky.timeOfDay);
    const m = Math.floor((this.sky.timeOfDay - h) * 60);
    const timeFormatted = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

    return {
      fps: this.fps,
      tileX: gx,
      tileZ: gz,
      terrainType: tile ? (tile.isWater ? 'Eau / Lac' : 'Terre / Prairie') : 'Extérieur',
      altitude: tile ? tile.height : 0,
      timeOfDay: timeFormatted,
      isNight: this.sky.isNight,
      placedBuildingsCount: this.buildingManager.getPlacedCount(),
      buildMode: this.buildingManager.mode,
    };
  }

  destroy(): void {
    this.stop();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('resize', this.onResize);
    this.renderer.dispose();
  }
}
