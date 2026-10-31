import * as THREE from 'three';
import { World, Terrain } from '../map/world';

export const TILE_SIZE = 2.0; // Taille d'un carreau en unités 3D

export interface PlacedBuilding {
  id: string; // instance unique
  defId: string; // identifiant du type de bâtiment
  tileX: number;
  tileZ: number;
  rotation: number; // 0, 1, 2, 3 (* 90°)
  mesh: THREE.Group;
}

export interface GridTile {
  x: number;
  z: number;
  terrain: Terrain;
  level: number;
  height: number;
  isWater: boolean;
  building?: PlacedBuilding;
}

/**
 * Système de Grille de Tuiles / Carreaux 3D isométrique :
 * - Chaque tuile est un bloc 3D distinct avec bordures biseautées et surface plane.
 * - Relief par paliers / plateaux réguliers pour permettre la pose propre de bâtiments.
 * - Curseur de survol 3D en temps réel.
 */
export class TileGrid {
  readonly world: World;
  readonly width: number;
  readonly height: number;
  readonly originX: number;
  readonly originZ: number;

  private tiles: GridTile[][] = [];
  readonly group = new THREE.Group();

  // Curseur de sélection de tuile
  readonly cursorMesh: THREE.LineSegments;
  private cursorMat: THREE.LineBasicMaterial;

  constructor(world: World, width: number = 64, height: number = 64) {
    this.world = world;
    this.width = width;
    this.height = height;

    // Centré autour du point de spawn
    const spawn = world.findSpawn();
    this.originX = Math.max(0, spawn.x - Math.floor(width / 2));
    this.originZ = Math.max(0, spawn.y - Math.floor(height / 2));

    // Construction du curseur 3D
    const boxGeom = new THREE.BoxGeometry(TILE_SIZE * 0.98, 0.25, TILE_SIZE * 0.98);
    const edgesGeom = new THREE.EdgesGeometry(boxGeom);
    this.cursorMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      linewidth: 3,
      depthTest: false,
    });
    this.cursorMesh = new THREE.LineSegments(edgesGeom, this.cursorMat);
    this.cursorMesh.renderOrder = 999;
    this.cursorMesh.visible = false;
    this.group.add(this.cursorMesh);

    this.buildGrid();
  }

  private buildGrid(): void {
    // Matériaux des tuiles (PBR texturés avec carreaux nets)
    const grassTopMat = new THREE.MeshStandardMaterial({
      color: 0x4d9438,
      roughness: 0.8,
      metalness: 0.05,
      flatShading: true,
    });
    const sandTopMat = new THREE.MeshStandardMaterial({
      color: 0xdeb86a,
      roughness: 0.9,
      flatShading: true,
    });
    const rockTopMat = new THREE.MeshStandardMaterial({
      color: 0x73767c,
      roughness: 0.85,
      flatShading: true,
    });
    const snowTopMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5fa,
      roughness: 0.7,
      flatShading: true,
    });
    const dirtSideMat = new THREE.MeshStandardMaterial({
      color: 0x4a3420,
      roughness: 0.95,
      flatShading: true,
    });
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x1479b8,
      roughness: 0.15,
      metalness: 0.2,
      transparent: true,
      opacity: 0.82,
    });

    // Grille 2D des données de tuiles
    for (let x = 0; x < this.width; x++) {
      this.tiles[x] = [];
      for (let z = 0; z < this.height; z++) {
        const tx = this.originX + x;
        const tz = this.originZ + z;
        const info = this.world.tile(tx, tz);

        const isWater = info.terrain === Terrain.DeepWater || info.terrain === Terrain.ShallowWater;
        // Niveau par paliers (step elevation pour surface de construction plate)
        const level = isWater ? 0 : Math.max(1, info.level);
        const height = isWater ? 0.05 : level * 0.75;

        this.tiles[x]![z] = {
          x,
          z,
          terrain: info.terrain,
          level,
          height,
          isWater,
        };

        // Création du bloc 3D de la tuile (carreau distinct avec bordure biseautée)
        const wx = (x - this.width / 2) * TILE_SIZE;
        const wz = (z - this.height / 2) * TILE_SIZE;

        if (isWater) {
          // Tuile d'eau légèrement enfoncée
          const waterGeom = new THREE.BoxGeometry(TILE_SIZE * 0.96, 0.3, TILE_SIZE * 0.96);
          const waterBlock = new THREE.Mesh(waterGeom, waterMat);
          waterBlock.position.set(wx, 0.0, wz);
          waterBlock.receiveShadow = true;
          this.group.add(waterBlock);
        } else {
          // Tuile de terre ferme
          let topMat = grassTopMat;
          if (info.terrain === Terrain.Sand) topMat = sandTopMat;
          else if (info.terrain === Terrain.Rock) topMat = rockTopMat;
          else if (info.terrain === Terrain.Snow) topMat = snowTopMat;

          // Géométrie du carreau avec épaisseur vers le bas
          const blockHeight = height + 1.2;
          const tileGeom = new THREE.BoxGeometry(TILE_SIZE * 0.95, blockHeight, TILE_SIZE * 0.95);

          // Matériau multi-faces : dessus spécifique, côtés en terre
          const materials = [
            dirtSideMat, // droite
            dirtSideMat, // gauche
            topMat,      // dessus (le carreau)
            dirtSideMat, // dessous
            dirtSideMat, // face
            dirtSideMat, // dos
          ];

          const block = new THREE.Mesh(tileGeom, materials);
          block.position.set(wx, height - blockHeight / 2, wz);
          block.receiveShadow = true;
          block.castShadow = true;
          this.group.add(block);

          // Ligne de bordure de carreau subtile pour accentuer la netteté de la grille
          const borderGeom = new THREE.BoxGeometry(TILE_SIZE * 0.952, 0.04, TILE_SIZE * 0.952);
          const borderMat = new THREE.MeshBasicMaterial({
            color: 0x1a2618,
            transparent: true,
            opacity: 0.22,
          });
          const border = new THREE.Mesh(borderGeom, borderMat);
          border.position.set(wx, height + 0.01, wz);
          this.group.add(border);
        }
      }
    }
  }

  getTile(gridX: number, gridZ: number): GridTile | undefined {
    if (gridX < 0 || gridX >= this.width || gridZ < 0 || gridZ >= this.height) return undefined;
    return this.tiles[gridX]?.[gridZ];
  }

  /**
   * Convertit une position 3D (X, Z) en coordonnées de grille (gridX, gridZ).
   */
  worldToGrid(worldX: number, worldZ: number): { gridX: number; gridZ: number } | null {
    const fx = worldX / TILE_SIZE + this.width / 2;
    const fz = worldZ / TILE_SIZE + this.height / 2;
    const gx = Math.floor(fx + 0.5);
    const gz = Math.floor(fz + 0.5);

    if (gx >= 0 && gx < this.width && gz >= 0 && gz < this.height) {
      return { gridX: gx, gridZ: gz };
    }
    return null;
  }

  /**
   * Convertit des coordonnées de grille en position 3D (X, Y, Z).
   */
  gridToWorld(gridX: number, gridZ: number): { x: number; y: number; z: number } {
    const tile = this.getTile(gridX, gridZ);
    const y = tile ? tile.height : 0;
    const x = (gridX - this.width / 2) * TILE_SIZE;
    const z = (gridZ - this.height / 2) * TILE_SIZE;
    return { x, y, z };
  }

  /**
   * Met à jour la position et la couleur du curseur de survol.
   */
  setCursorPosition(gridX: number, gridZ: number, valid: boolean): void {
    const tile = this.getTile(gridX, gridZ);
    if (!tile) {
      this.cursorMesh.visible = false;
      return;
    }

    const pos = this.gridToWorld(gridX, gridZ);
    this.cursorMesh.position.set(pos.x, pos.y + 0.12, pos.z);
    this.cursorMat.color.setHex(valid ? 0x22c55e : 0xef4444);
    this.cursorMesh.visible = true;
  }

  hideCursor(): void {
    this.cursorMesh.visible = false;
  }
}
