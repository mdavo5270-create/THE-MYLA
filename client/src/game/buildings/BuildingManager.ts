import * as THREE from 'three';
import { TileGrid, PlacedBuilding } from '../grid/TileGrid';
import { BuildingDefinition, BuildingModels } from './BuildingModels';

export type BuildMode = 'none' | 'place' | 'demolish';

/**
 * Gestionnaire de construction et de dépôt de bâtiments en 3D :
 * - Prévisualisation fantôme temps réel (verte si valide, rouge si bloqué)
 * - Placement / Rotation à 90° avec la touche R
 * - Outil Bulldozer / Démolition
 * - Animation des éléments mobiles (pales de moulin)
 * - Gestion des lumières nocturnes des bâtiments posés
 */
export class BuildingManager {
  private readonly scene: THREE.Scene;
  private readonly grid: TileGrid;

  readonly definitions: Map<string, BuildingDefinition> = new Map();
  private placedBuildings: PlacedBuilding[] = [];

  mode: BuildMode = 'none';
  selectedDefId: string | null = null;
  currentRotation: number = 0; // 0, 1, 2, 3

  private ghostMesh: THREE.Group | null = null;
  private hoveredTile: { gridX: number; gridZ: number } | null = null;

  // Liste des lumières de bâtiments pour gestion jour/nuit
  private buildingLights: THREE.PointLight[] = [];

  constructor(scene: THREE.Scene, grid: TileGrid) {
    this.scene = scene;
    this.grid = grid;

    // Charger les définitions
    BuildingModels.getAllDefinitions().forEach((def) => {
      this.definitions.set(def.id, def);
    });
  }

  selectBuilding(defId: string): void {
    if (this.mode === 'place' && this.selectedDefId === defId) {
      this.cancelAction();
      return;
    }

    this.cancelAction();
    const def = this.definitions.get(defId);
    if (!def) return;

    this.mode = 'place';
    this.selectedDefId = defId;
    this.createGhostMesh(def);
  }

  selectDemolish(): void {
    if (this.mode === 'demolish') {
      this.cancelAction();
      return;
    }
    this.cancelAction();
    this.mode = 'demolish';
  }

  cancelAction(): void {
    this.mode = 'none';
    this.selectedDefId = null;
    this.removeGhostMesh();
    this.grid.hideCursor();
  }

  rotateCurrent(): void {
    this.currentRotation = (this.currentRotation + 1) % 4;
    if (this.ghostMesh) {
      this.ghostMesh.rotation.y = this.currentRotation * (Math.PI / 2);
    }
  }

  private createGhostMesh(def: BuildingDefinition): void {
    this.removeGhostMesh();
    const mesh = def.createMesh();

    // Rendre semi-transparent et vert/lumineux pour la prévisualisation
    mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = new THREE.MeshBasicMaterial({
          color: 0x22c55e,
          transparent: true,
          opacity: 0.55,
          wireframe: false,
        });
      }
      if (child instanceof THREE.Light) {
        child.visible = false;
      }
    });

    this.ghostMesh = mesh;
    this.ghostMesh.rotation.y = this.currentRotation * (Math.PI / 2);
    this.scene.add(this.ghostMesh);
  }

  private removeGhostMesh(): void {
    if (this.ghostMesh) {
      this.scene.remove(this.ghostMesh);
      this.ghostMesh = null;
    }
  }

  /**
   * Met à jour le survol de tuile et la position de la prévisualisation 3D.
   */
  updateHover(gridX: number, gridZ: number): void {
    this.hoveredTile = { gridX, gridZ };
    const tile = this.grid.getTile(gridX, gridZ);

    if (!tile) {
      this.grid.hideCursor();
      if (this.ghostMesh) this.ghostMesh.visible = false;
      return;
    }

    const pos = this.grid.gridToWorld(gridX, gridZ);

    if (this.mode === 'place' && this.selectedDefId) {
      const def = this.definitions.get(this.selectedDefId);
      const canBuild = def ? (!tile.isWater || def.canPlaceOnWater) && !tile.building : false;

      this.grid.setCursorPosition(gridX, gridZ, canBuild);

      if (this.ghostMesh) {
        this.ghostMesh.position.set(pos.x, pos.y, pos.z);
        this.ghostMesh.visible = true;

        // Mise à jour de la couleur du ghost (vert = OK, rouge = Impossible)
        const ghostColor = canBuild ? 0x22c55e : 0xef4444;
        this.ghostMesh.traverse((child) => {
          if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial) {
            child.material.color.setHex(ghostColor);
          }
        });
      }
    } else if (this.mode === 'demolish') {
      const hasBuilding = !!tile.building;
      this.grid.setCursorPosition(gridX, gridZ, hasBuilding);
      if (this.ghostMesh) this.ghostMesh.visible = false;
    } else {
      this.grid.setCursorPosition(gridX, gridZ, true);
      if (this.ghostMesh) this.ghostMesh.visible = false;
    }
  }

  /**
   * Tente de construire ou de démolir sur la tuile actuellement survolée.
   */
  handleClick(): boolean {
    if (!this.hoveredTile) return false;
    const { gridX, gridZ } = this.hoveredTile;
    const tile = this.grid.getTile(gridX, gridZ);
    if (!tile) return false;

    if (this.mode === 'place' && this.selectedDefId) {
      const def = this.definitions.get(this.selectedDefId);
      if (!def) return false;

      // Vérification des règles de placement
      if (tile.isWater && !def.canPlaceOnWater) return false;
      if (tile.building) return false;

      // Création et pose du vrai bâtiment 3D
      const buildingMesh = def.createMesh();
      const pos = this.grid.gridToWorld(gridX, gridZ);
      buildingMesh.position.set(pos.x, pos.y, pos.z);
      buildingMesh.rotation.y = this.currentRotation * (Math.PI / 2);

      // Petite animation d'apparition / pop
      buildingMesh.scale.set(0.1, 0.1, 0.1);
      this.scene.add(buildingMesh);

      // Animation d'expansion fluide
      const startTime = performance.now();
      const popAnim = () => {
        const elapsed = (performance.now() - startTime) / 1000;
        const t = Math.min(1.0, elapsed * 6.0);
        // Courbe élastique douce
        const s = Math.sin(t * Math.PI * 0.5) * 1.05;
        const currentScale = t >= 1.0 ? 1.0 : s;
        buildingMesh.scale.set(currentScale, currentScale, currentScale);
        if (t < 1.0) requestAnimationFrame(popAnim);
      };
      popAnim();

      // Enregistrer les lumières de ce bâtiment
      buildingMesh.traverse((child) => {
        if (child instanceof THREE.PointLight) {
          this.buildingLights.push(child);
        }
      });

      const placed: PlacedBuilding = {
        id: `bld_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        defId: this.selectedDefId,
        tileX: gridX,
        tileZ: gridZ,
        rotation: this.currentRotation,
        mesh: buildingMesh,
      };

      tile.building = placed;
      this.placedBuildings.push(placed);

      // Mettre à jour le curseur
      this.updateHover(gridX, gridZ);
      return true;
    }

    if (this.mode === 'demolish') {
      if (!tile.building) return false;

      // Supprimer le bâtiment
      const bld = tile.building;
      this.scene.remove(bld.mesh);

      // Nettoyer les lumières
      bld.mesh.traverse((child) => {
        if (child instanceof THREE.PointLight) {
          const idx = this.buildingLights.indexOf(child);
          if (idx !== -1) this.buildingLights.splice(idx, 1);
        }
      });

      tile.building = undefined;
      this.placedBuildings = this.placedBuildings.filter((b) => b.id !== bld.id);

      this.updateHover(gridX, gridZ);
      return true;
    }

    return false;
  }

  /**
   * Met à jour les animations dynamiques (ex: moulin) et les lumières selon l'heure.
   */
  update(deltaSeconds: number, isNight: boolean): void {
    // Animation des pales de moulin
    for (const bld of this.placedBuildings) {
      if (bld.defId === 'windmill') {
        const rotor = bld.mesh.getObjectByName('windmill_rotor');
        if (rotor) {
          rotor.rotation.z += deltaSeconds * 1.8;
        }
      }
    }

    // Gestion de l'intensité des lumières nocturnes des bâtiments
    for (const light of this.buildingLights) {
      // Les lanternes et fenêtres brillent intensément dans la nuit sombre !
      light.intensity = isNight ? 2.2 : 0.2;
    }
  }

  getPlacedCount(): number {
    return this.placedBuildings.length;
  }
}
