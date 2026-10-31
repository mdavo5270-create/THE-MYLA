import * as THREE from 'three';
import { World, WorldConfig } from '../map/world';
import { TerrainMesh, TILE_SCALE } from './TerrainMesh';
import { WaterMesh } from './WaterMesh';
import { FoliageSystem } from './FoliageSystem';
import { SkyAtmosphere } from './SkyAtmosphere';
import { Controls3D, CameraMode } from './Controls3D';

export interface Diagnostics {
  fps: number;
  worldX: number;
  worldZ: number;
  tileX: number;
  tileY: number;
  biome: string;
  altitude: number;
  activeChunks: number;
  timeOfDay: string;
  drawCalls: number;
  triangles: number;
}

/**
 * Master 3D Engine Orchestrator for THE MYLA.
 * Manages Three.js WebGLRenderer, PBR materials, real-time soft shadows,
 * dynamic terrain streaming, water dynamics, and atmospheric lighting.
 */
export class WorldRenderer3D {
  readonly world: World;
  readonly container: HTMLElement;

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;

  private terrain: TerrainMesh;
  private water: WaterMesh;
  private foliage: FoliageSystem;
  private sky: SkyAtmosphere;
  private controls: Controls3D;

  private clock: THREE.Clock = new THREE.Clock();
  private frameCount: number = 0;
  private fps: number = 60;
  private lastFpsUpdate: number = 0;

  private isRunning: boolean = false;

  constructor(worldConfig: WorldConfig, container: HTMLElement) {
    this.world = new World(worldConfig);
    this.container = container;

    // Initialize High-Performance WebGLRenderer with Soft Shadows and ACES Filmic Tone Mapping
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
    this.renderer.toneMappingExposure = 1.15;

    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    // Scene & Camera
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1.0, 1600);

    // 3D Subsystems
    this.sky = new SkyAtmosphere(this.scene);
    this.terrain = new TerrainMesh(this.world);
    this.water = new WaterMesh(3000);
    this.scene.add(this.water.mesh);
    this.foliage = new FoliageSystem(this.world, this.terrain);
    this.controls = new Controls3D(this.camera, this.renderer.domElement);

    // Initial spawn location (converted from tile coordinates to 3D world units)
    const spawn = this.world.findSpawn();
    const spawnX = spawn.x * TILE_SCALE;
    const spawnZ = spawn.y * TILE_SCALE;
    const spawnY = this.terrain.getHeightAt(spawnX, spawnZ);
    this.controls.teleportTo(spawnX, spawnZ, spawnY);

    // Window Resize Handler
    window.addEventListener('resize', this.onResize);

    this.start();
  }

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

    // FPS calculation
    this.frameCount++;
    if (elapsed - this.lastFpsUpdate >= 0.5) {
      this.fps = Math.round((this.frameCount / (elapsed - this.lastFpsUpdate)));
      this.frameCount = 0;
      this.lastFpsUpdate = elapsed;
    }

    // Update Camera Controls
    this.controls.update(delta, (x, z) => this.terrain.getHeightAt(x, z));

    const focusPos = this.controls.target;

    // Update 3D Subsystems
    this.sky.update(focusPos, this.camera);
    this.water.update(
      delta,
      this.camera,
      this.sky.sunDirection,
      this.sky.sunColor,
      this.sky.fogColor,
      this.sky.fogDensity
    );
    this.water.setPosition(focusPos.x, focusPos.z);

    this.terrain.update(focusPos.x, focusPos.z, this.scene, 4);
    this.foliage.update(focusPos.x, focusPos.z, this.scene, delta, 3);

    // Render 3D Scene
    this.renderer.render(this.scene, this.camera);
  };

  // Controller APIs for HUD / UI
  setTimeOfDay(hours: number): void {
    this.sky.setTimeOfDay(hours);
  }

  getTimeOfDay(): number {
    return this.sky.timeOfDay;
  }

  setWeather(weather: 'clear' | 'foggy' | 'rainy'): void {
    this.sky.setWeather(weather);
  }

  getWeather(): string {
    return this.sky.weather;
  }

  setCameraMode(mode: CameraMode): void {
    this.controls.setMode(mode);
  }

  getCameraMode(): CameraMode {
    return this.controls.mode;
  }

  teleportToTile(tileX: number, tileY: number): void {
    const wx = tileX * TILE_SCALE;
    const wz = tileY * TILE_SCALE;
    const wy = this.terrain.getHeightAt(wx, wz);
    this.controls.teleportTo(wx, wz, wy);
  }

  getDiagnostics(): Diagnostics {
    const focus = this.controls.target;
    const tx = Math.floor(focus.x / TILE_SCALE);
    const ty = Math.floor(focus.z / TILE_SCALE);
    const biome = this.terrain.getBiomeAt(focus.x, focus.z);
    const alt = this.terrain.getHeightAt(focus.x, focus.z);

    const h = Math.floor(this.sky.timeOfDay);
    const m = Math.floor((this.sky.timeOfDay - h) * 60);
    const timeFormatted = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

    return {
      fps: this.fps,
      worldX: Math.round(focus.x),
      worldZ: Math.round(focus.z),
      tileX: tx,
      tileY: ty,
      biome,
      altitude: Math.round(alt * 10) / 10,
      activeChunks: this.terrain.getActiveChunkCount(),
      timeOfDay: timeFormatted,
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
    };
  }

  destroy(): void {
    this.stop();
    window.removeEventListener('resize', this.onResize);
    this.renderer.dispose();
  }
}
