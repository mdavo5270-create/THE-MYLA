import * as THREE from 'three';
import { World, Terrain } from '../map/world';
import { TerrainMesh, CHUNK_WORLD_SIZE, TILE_SCALE } from './TerrainMesh';

interface FoliageChunk {
  cx: number;
  cz: number;
  pines?: THREE.InstancedMesh;
  oaks?: THREE.InstancedMesh;
  palms?: THREE.InstancedMesh;
  rocks?: THREE.InstancedMesh;
}

/**
 * Procedural 3D Foliage & Nature System with instanced meshes for Pine trees,
 * Broadleaf Oak trees, Coastal Palm trees, and Boulders with wind animations.
 */
export class FoliageSystem {
  private readonly world: World;
  private readonly terrain: TerrainMesh;
  private readonly chunks = new Map<string, FoliageChunk>();

  // Shared Geometries & Materials
  private pineGeom: THREE.BufferGeometry;
  private pineMat: THREE.MeshStandardMaterial;

  private oakGeom: THREE.BufferGeometry;
  private oakMat: THREE.MeshStandardMaterial;

  private palmGeom: THREE.BufferGeometry;
  private palmMat: THREE.MeshStandardMaterial;

  private rockGeom: THREE.BufferGeometry;
  private rockMat: THREE.MeshStandardMaterial;

  private windTime: number = 0;

  constructor(world: World, terrain: TerrainMesh) {
    this.world = world;
    this.terrain = terrain;

    // Build Pine Tree Compound Geometry
    this.pineGeom = this.createPineGeometry();
    this.pineMat = new THREE.MeshStandardMaterial({
      color: 0x225c28,
      roughness: 0.8,
      metalness: 0.05,
      flatShading: true,
    });

    // Build Oak Tree Geometry
    this.oakGeom = this.createOakGeometry();
    this.oakMat = new THREE.MeshStandardMaterial({
      color: 0x3d8234,
      roughness: 0.85,
      metalness: 0.02,
      flatShading: true,
    });

    // Build Palm Tree Geometry
    this.palmGeom = this.createPalmGeometry();
    this.palmMat = new THREE.MeshStandardMaterial({
      color: 0x489634,
      roughness: 0.85,
      metalness: 0.02,
      flatShading: true,
    });

    // Build Rock Geometry
    this.rockGeom = this.createRockGeometry();
    this.rockMat = new THREE.MeshStandardMaterial({
      color: 0x6e7178,
      roughness: 0.9,
      metalness: 0.1,
      flatShading: true,
    });
  }

  private createPineGeometry(): THREE.BufferGeometry {
    const geometries: THREE.BufferGeometry[] = [];

    // Trunk
    const trunk = new THREE.CylinderGeometry(0.2, 0.35, 1.8, 6);
    trunk.translate(0, 0.9, 0);
    geometries.push(trunk);

    // Tier 1 Cone
    const cone1 = new THREE.ConeGeometry(1.6, 2.2, 7);
    cone1.translate(0, 2.4, 0);
    geometries.push(cone1);

    // Tier 2 Cone
    const cone2 = new THREE.ConeGeometry(1.25, 2.0, 7);
    cone2.translate(0, 3.4, 0);
    geometries.push(cone2);

    // Tier 3 Cone (Top)
    const cone3 = new THREE.ConeGeometry(0.85, 1.8, 7);
    cone3.translate(0, 4.3, 0);
    geometries.push(cone3);

    return this.mergeGeometries(geometries);
  }

  private createOakGeometry(): THREE.BufferGeometry {
    const geometries: THREE.BufferGeometry[] = [];

    // Trunk
    const trunk = new THREE.CylinderGeometry(0.3, 0.5, 2.2, 6);
    trunk.translate(0, 1.1, 0);
    geometries.push(trunk);

    // Foliage Clusters
    const c1 = new THREE.DodecahedronGeometry(1.4, 1);
    c1.translate(0, 3.2, 0);
    geometries.push(c1);

    const c2 = new THREE.DodecahedronGeometry(1.1, 1);
    c2.translate(-0.7, 2.8, 0.4);
    geometries.push(c2);

    const c3 = new THREE.DodecahedronGeometry(1.15, 1);
    c3.translate(0.6, 2.9, -0.5);
    geometries.push(c3);

    const c4 = new THREE.DodecahedronGeometry(0.95, 1);
    c4.translate(0.2, 4.0, 0.2);
    geometries.push(c4);

    return this.mergeGeometries(geometries);
  }

  private createPalmGeometry(): THREE.BufferGeometry {
    const geometries: THREE.BufferGeometry[] = [];

    // Curved Trunk
    const trunk = new THREE.CylinderGeometry(0.2, 0.35, 3.2, 6);
    trunk.translate(0.4, 1.6, 0);
    trunk.rotateZ(-0.15);
    geometries.push(trunk);

    // Palm Crown Fronds
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const frond = new THREE.ConeGeometry(0.6, 2.0, 4);
      frond.rotateX(Math.PI / 2.6);
      frond.rotateY(angle);
      frond.translate(0.8, 3.2, 0);
      geometries.push(frond);
    }

    return this.mergeGeometries(geometries);
  }

  private createRockGeometry(): THREE.BufferGeometry {
    const geom = new THREE.DodecahedronGeometry(1.0, 0);
    const pos = geom.attributes.position;
    if (pos) {
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        const scale = 0.8 + Math.sin(x * 5.0 + y * 3.0) * 0.25;
        pos.setXYZ(i, x * scale, y * scale * 0.7, z * scale);
      }
      geom.computeVertexNormals();
    }
    return geom;
  }

  private mergeGeometries(geoms: THREE.BufferGeometry[]): THREE.BufferGeometry {
    let totalVerts = 0;
    for (const g of geoms) {
      const p = g.attributes.position;
      if (p) totalVerts += p.count;
    }

    const mergedPos = new Float32Array(totalVerts * 3);
    const mergedNorm = new Float32Array(totalVerts * 3);

    let offset = 0;
    for (const g of geoms) {
      const p = g.attributes.position;
      if (!p) continue;
      const n = g.attributes.normal || g.computeVertexNormals();
      for (let i = 0; i < p.count; i++) {
        mergedPos[(offset + i) * 3] = p.getX(i);
        mergedPos[(offset + i) * 3 + 1] = p.getY(i);
        mergedPos[(offset + i) * 3 + 2] = p.getZ(i);

        if (n) {
          mergedNorm[(offset + i) * 3] = n.getX(i);
          mergedNorm[(offset + i) * 3 + 1] = n.getY(i);
          mergedNorm[(offset + i) * 3 + 2] = n.getZ(i);
        }
      }
      offset += p.count;
    }

    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(mergedPos, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(mergedNorm, 3));
    merged.computeVertexNormals();
    return merged;
  }

  private buildChunkFoliage(cx: number, cz: number, scene: THREE.Scene): FoliageChunk {
    const originX = cx * CHUNK_WORLD_SIZE;
    const originZ = cz * CHUNK_WORLD_SIZE;

    const pineMatrices: THREE.Matrix4[] = [];
    const oakMatrices: THREE.Matrix4[] = [];
    const palmMatrices: THREE.Matrix4[] = [];
    const rockMatrices: THREE.Matrix4[] = [];

    const dummy = new THREE.Object3D();

    // Sample potential vegetation sites across chunk
    const step = 4.0;
    for (let lx = 2; lx < CHUNK_WORLD_SIZE - 2; lx += step) {
      for (let lz = 2; lz < CHUNK_WORLD_SIZE - 2; lz += step) {
        const jx = lx + (Math.sin(lx * 13.5 + lz * 7.2) * 1.6);
        const jz = lz + (Math.cos(lx * 8.3 - lz * 11.7) * 1.6);

        const wx = originX + jx;
        const wz = originZ + jz;
        const y = this.terrain.getHeightAt(wx, wz);

        // No vegetation deep underwater
        if (y < 0.2) continue;

        const tx = Math.floor(wx / TILE_SCALE);
        const ty = Math.floor(wz / TILE_SCALE);
        const tileInfo = this.world.tile(tx, ty);

        const rand = (Math.sin(wx * 17.1 + wz * 31.9) * 0.5 + 0.5);

        if (tileInfo.terrain === Terrain.Forest) {
          if (rand > 0.35) {
            dummy.position.set(wx, y, wz);
            dummy.rotation.y = rand * Math.PI * 2;
            const s = 0.8 + rand * 0.5;
            dummy.scale.set(s, s, s);
            dummy.updateMatrix();
            pineMatrices.push(dummy.matrix.clone());
          }
        } else if (tileInfo.terrain === Terrain.Grass) {
          if (rand > 0.68) {
            dummy.position.set(wx, y, wz);
            dummy.rotation.y = rand * Math.PI * 2;
            const s = 0.75 + rand * 0.45;
            dummy.scale.set(s, s, s);
            dummy.updateMatrix();
            oakMatrices.push(dummy.matrix.clone());
          } else if (rand < 0.12) {
            // Scattered boulder in grasslands
            dummy.position.set(wx, y, wz);
            dummy.rotation.set(rand * 2, rand * 3, rand);
            const s = 0.6 + rand * 0.8;
            dummy.scale.set(s, s, s);
            dummy.updateMatrix();
            rockMatrices.push(dummy.matrix.clone());
          }
        } else if (tileInfo.terrain === Terrain.Sand) {
          if (y >= 0.4 && y <= 1.8 && rand > 0.82) {
            // Coastal Palm
            dummy.position.set(wx, y, wz);
            dummy.rotation.y = rand * Math.PI * 2;
            const s = 0.7 + rand * 0.5;
            dummy.scale.set(s, s, s);
            dummy.updateMatrix();
            palmMatrices.push(dummy.matrix.clone());
          }
        } else if (tileInfo.terrain === Terrain.Rock || tileInfo.terrain === Terrain.Snow) {
          if (rand > 0.6) {
            // High altitude boulders
            dummy.position.set(wx, y, wz);
            dummy.rotation.set(rand * 3, rand * 2, rand);
            const s = 0.8 + rand * 1.4;
            dummy.scale.set(s, s, s);
            dummy.updateMatrix();
            rockMatrices.push(dummy.matrix.clone());
          }
        }
      }
    }

    const chunkData: FoliageChunk = { cx, cz };

    const setupMesh = (geom: THREE.BufferGeometry, mat: THREE.Material, matrices: THREE.Matrix4[]) => {
      if (matrices.length === 0) return undefined;
      const inst = new THREE.InstancedMesh(geom, mat, matrices.length);
      for (let i = 0; i < matrices.length; i++) {
        const m = matrices[i];
        if (m) inst.setMatrixAt(i, m);
      }
      inst.instanceMatrix.needsUpdate = true;
      inst.castShadow = true;
      inst.receiveShadow = true;
      scene.add(inst);
      return inst;
    };

    chunkData.pines = setupMesh(this.pineGeom, this.pineMat, pineMatrices);
    chunkData.oaks = setupMesh(this.oakGeom, this.oakMat, oakMatrices);
    chunkData.palms = setupMesh(this.palmGeom, this.palmMat, palmMatrices);
    chunkData.rocks = setupMesh(this.rockGeom, this.rockMat, rockMatrices);

    return chunkData;
  }

  update(focusX: number, focusZ: number, scene: THREE.Scene, deltaSeconds: number, radius: number = 3): void {
    this.windTime += deltaSeconds;

    const centerChunkX = Math.floor(focusX / CHUNK_WORLD_SIZE);
    const centerChunkZ = Math.floor(focusZ / CHUNK_WORLD_SIZE);

    const neededKeys = new Set<string>();

    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        if (dx * dx + dz * dz > (radius + 0.5) * (radius + 0.5)) continue;

        const cx = centerChunkX + dx;
        const cz = centerChunkZ + dz;
        const key = `${cx},${cz}`;
        neededKeys.add(key);

        if (!this.chunks.has(key)) {
          const chunkFoliage = this.buildChunkFoliage(cx, cz, scene);
          this.chunks.set(key, chunkFoliage);
        }
      }
    }

    // Unload distant foliage
    for (const [key, c] of this.chunks.entries()) {
      if (!neededKeys.has(key)) {
        if (c.pines) { scene.remove(c.pines); c.pines.dispose(); }
        if (c.oaks) { scene.remove(c.oaks); c.oaks.dispose(); }
        if (c.palms) { scene.remove(c.palms); c.palms.dispose(); }
        if (c.rocks) { scene.remove(c.rocks); c.rocks.dispose(); }
        this.chunks.delete(key);
      }
    }
  }
}
