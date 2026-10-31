import * as THREE from 'three';
import { World, Terrain } from '../map/world';
import { TextureGenerator } from './TextureGenerator';

export const CHUNK_TILES = 32;
export const TILE_SCALE = 2.0; // 1 tile = 2 world units
export const CHUNK_WORLD_SIZE = CHUNK_TILES * TILE_SCALE; // 64 units
export const WATER_ELEVATION_THRESHOLD = 0.44;
export const MOUNTAIN_HEIGHT_SCALE = 38.0;
export const SEABED_DEPTH_SCALE = 16.0;

export interface ChunkKey {
  cx: number;
  cz: number;
}

/**
 * Procedural continuous 3D terrain with smooth elevation, slope-based rock cliffs,
 * alpine snow peaks, sandy shorelines, and PBR lighting integration.
 */
export class TerrainMesh {
  private readonly world: World;
  private readonly chunks = new Map<string, THREE.Mesh>();
  private readonly material: THREE.MeshStandardMaterial;

  constructor(world: World) {
    this.world = world;
    this.material = this.createTerrainMaterial();
  }

  /**
   * Evaluates continuous 3D height at any floating world coordinate.
   */
  getHeightAt(worldX: number, worldZ: number): number {
    const tx = worldX / TILE_SCALE;
    const ty = worldZ / TILE_SCALE;
    const e = this.world.elevation(tx, ty);

    if (e < WATER_ELEVATION_THRESHOLD) {
      // Underwater slope to seabed
      return (e - WATER_ELEVATION_THRESHOLD) * SEABED_DEPTH_SCALE;
    }
    // Land elevation
    return (e - WATER_ELEVATION_THRESHOLD) * MOUNTAIN_HEIGHT_SCALE;
  }

  /**
   * Retrieves the biome at world coordinates.
   */
  getBiomeAt(worldX: number, worldZ: number): string {
    const tx = Math.floor(worldX / TILE_SCALE);
    const ty = Math.floor(worldZ / TILE_SCALE);
    const t = this.world.tile(tx, ty);
    switch (t.terrain) {
      case Terrain.DeepWater: return 'Océan Profond';
      case Terrain.ShallowWater: return 'Eaux Côtières';
      case Terrain.Sand: return 'Plage Dorée';
      case Terrain.Grass: return 'Plaines Verdoyantes';
      case Terrain.Forest: return 'Forêt Dense';
      case Terrain.Dry: return 'Terres Arides';
      case Terrain.Rock: return 'Falaises Rocheuses';
      case Terrain.Snow: return 'Pics Enneigés';
      default: return 'Inconnu';
    }
  }

  /**
   * Creates a custom PBR material using Three.js MeshStandardMaterial with onBeforeCompile
   * to blend grass, rock, sand and snow based on height and surface normal slope.
   */
  private createTerrainMaterial(): THREE.MeshStandardMaterial {
    const grassTex = TextureGenerator.getGrassTexture();
    const rockTex = TextureGenerator.getRockTexture();
    const sandTex = TextureGenerator.getSandTexture();
    const snowTex = TextureGenerator.getSnowTexture();

    const mat = new THREE.MeshStandardMaterial({
      roughness: 0.85,
      metalness: 0.05,
      flatShading: false,
    });

    mat.onBeforeCompile = (shader) => {
      shader.uniforms['uGrassTex'] = { value: grassTex };
      shader.uniforms['uRockTex'] = { value: rockTex };
      shader.uniforms['uSandTex'] = { value: sandTex };
      shader.uniforms['uSnowTex'] = { value: snowTex };

      // Pass world position and normal to fragment shader
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `
        #include <common>
        varying vec3 vWorldPos;
        varying vec3 vTerrainNormal;
        `
      );

      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vTerrainNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        `
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `
        #include <common>
        uniform sampler2D uGrassTex;
        uniform sampler2D uRockTex;
        uniform sampler2D uSandTex;
        uniform sampler2D uSnowTex;
        varying vec3 vWorldPos;
        varying vec3 vTerrainNormal;
        `
      );

      // Replace diffuse color with multi-texture slope & elevation blending
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `
        #include <color_fragment>

        vec2 uvTiled = vWorldPos.xz * 0.12;

        vec3 colGrass = texture2D(uGrassTex, uvTiled).rgb;
        vec3 colRock = texture2D(uRockTex, uvTiled * 1.5).rgb;
        vec3 colSand = texture2D(uSandTex, uvTiled * 1.2).rgb;
        vec3 colSnow = texture2D(uSnowTex, uvTiled * 1.0).rgb;

        // Slope calculation: 1.0 is flat horizontal, 0.0 is vertical cliff
        float slope = clamp(vTerrainNormal.y, 0.0, 1.0);
        float cliffFactor = 1.0 - smoothstep(0.55, 0.82, slope);

        // Height blending
        float h = vWorldPos.y;
        vec3 terrainColor;

        if (h < 0.6) {
          // Beach / Sand near and below water level
          terrainColor = colSand;
        } else if (h < 2.0) {
          // Transition sand -> grass
          float t = smoothstep(0.6, 2.0, h);
          terrainColor = mix(colSand, colGrass, t);
        } else if (h < 10.5) {
          // Grasslands & lower hills
          terrainColor = colGrass;
        } else if (h < 13.5) {
          // Transition grass -> snow
          float t = smoothstep(10.5, 13.5, h);
          terrainColor = mix(colGrass, colSnow, t);
        } else {
          // High snow peaks
          terrainColor = colSnow;
        }

        // Apply cliff rock on steep slopes
        terrainColor = mix(terrainColor, colRock, cliffFactor * 0.95);

        diffuseColor = vec4(terrainColor, 1.0);
        `
      );
    };

    return mat;
  }

  /**
   * Generates a single chunk 3D mesh with smooth continuous height and normals.
   */
  private buildChunkMesh(cx: number, cz: number): THREE.Mesh {
    const res = CHUNK_TILES;
    const geom = new THREE.PlaneGeometry(CHUNK_WORLD_SIZE, CHUNK_WORLD_SIZE, res, res);
    geom.rotateX(-Math.PI / 2);

    const pos = geom.attributes.position;
    const originX = cx * CHUNK_WORLD_SIZE;
    const originZ = cz * CHUNK_WORLD_SIZE;

    if (pos) {
      for (let i = 0; i < pos.count; i++) {
        const lx = pos.getX(i);
        const lz = pos.getZ(i);
        const wx = originX + lx;
        const wz = originZ + lz;
        const y = this.getHeightAt(wx, wz);
        pos.setY(i, y);
      }
      geom.computeVertexNormals();
    }

    const mesh = new THREE.Mesh(geom, this.material);
    mesh.position.set(originX, 0, originZ);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    return mesh;
  }

  /**
   * Updates chunks dynamically around the camera focus position.
   */
  update(focusX: number, focusZ: number, scene: THREE.Scene, chunkRadius: number = 4): void {
    const centerChunkX = Math.floor(focusX / CHUNK_WORLD_SIZE);
    const centerChunkZ = Math.floor(focusZ / CHUNK_WORLD_SIZE);

    const neededKeys = new Set<string>();

    for (let dx = -chunkRadius; dx <= chunkRadius; dx++) {
      for (let dz = -chunkRadius; dz <= chunkRadius; dz++) {
        // Circular distance check
        if (dx * dx + dz * dz > (chunkRadius + 0.5) * (chunkRadius + 0.5)) continue;

        const cx = centerChunkX + dx;
        const cz = centerChunkZ + dz;
        const key = `${cx},${cz}`;
        neededKeys.add(key);

        if (!this.chunks.has(key)) {
          const mesh = this.buildChunkMesh(cx, cz);
          this.chunks.set(key, mesh);
          scene.add(mesh);
        }
      }
    }

    // Unload far chunks to keep memory and performance optimal
    for (const [key, mesh] of this.chunks.entries()) {
      if (!neededKeys.has(key)) {
        scene.remove(mesh);
        mesh.geometry.dispose();
        this.chunks.delete(key);
      }
    }
  }

  getActiveChunkCount(): number {
    return this.chunks.size;
  }
}
