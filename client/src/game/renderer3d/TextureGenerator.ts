import * as THREE from 'three';

/**
 * Generates procedural high-resolution PBR textures for terrain surfaces,
 * rocks, foliage, and animated water normal maps.
 */
export class TextureGenerator {
  private static cache = new Map<string, THREE.CanvasTexture>();

  /**
   * Generates a seamless procedural grass texture with micro-blade details,
   * subtle hue shifts and mossy undertones.
   */
  static getGrassTexture(): THREE.CanvasTexture {
    const key = 'grass';
    if (this.cache.has(key)) return this.cache.get(key)!;

    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Base emerald green
    ctx.fillStyle = '#448833';
    ctx.fillRect(0, 0, size, size);

    // Multi-layer organic speckles & blade simulation
    const id = ctx.getImageData(0, 0, size, size);
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * 36;
      const n2 = Math.sin((i / 4 / size) * 0.2) * 12;
      d[i] = Math.min(255, Math.max(30, 68 + n + n2 * 0.5));     // R
      d[i + 1] = Math.min(255, Math.max(70, 136 + n * 1.2 + n2)); // G
      d[i + 2] = Math.min(255, Math.max(20, 52 + n * 0.7));     // B
      d[i + 3] = 255;
    }
    ctx.putImageData(id, 0, 0);

    // Add subtle darker clumping
    for (let c = 0; c < 200; c++) {
      const cx = Math.random() * size;
      const cy = Math.random() * size;
      const r = 4 + Math.random() * 12;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, 'rgba(35, 75, 25, 0.4)');
      grad.addColorStop(1, 'rgba(35, 75, 25, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    this.cache.set(key, tex);
    return tex;
  }

  /**
   * Generates a craggy granite rock / cliff texture with cracks and striations.
   */
  static getRockTexture(): THREE.CanvasTexture {
    const key = 'rock';
    if (this.cache.has(key)) return this.cache.get(key)!;

    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#686a70';
    ctx.fillRect(0, 0, size, size);

    const id = ctx.getImageData(0, 0, size, size);
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * 45;
      d[i] = Math.min(255, Math.max(40, 104 + n));
      d[i + 1] = Math.min(255, Math.max(40, 106 + n));
      d[i + 2] = Math.min(255, Math.max(45, 112 + n * 1.1));
      d[i + 3] = 255;
    }
    ctx.putImageData(id, 0, 0);

    // Dark fault lines / fissures
    ctx.strokeStyle = 'rgba(35, 36, 40, 0.55)';
    ctx.lineWidth = 1.5;
    for (let l = 0; l < 25; l++) {
      ctx.beginPath();
      let x = Math.random() * size;
      let y = Math.random() * size;
      ctx.moveTo(x, y);
      for (let s = 0; s < 6; s++) {
        x += (Math.random() - 0.5) * 60;
        y += (Math.random() - 0.5) * 60;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    this.cache.set(key, tex);
    return tex;
  }

  /**
   * Generates a warm natural beach sand texture with fine grain and wave ripples.
   */
  static getSandTexture(): THREE.CanvasTexture {
    const key = 'sand';
    if (this.cache.has(key)) return this.cache.get(key)!;

    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#d9c285';
    ctx.fillRect(0, 0, size, size);

    const id = ctx.getImageData(0, 0, size, size);
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * 22;
      d[i] = Math.min(255, Math.max(120, 217 + n));
      d[i + 1] = Math.min(255, Math.max(100, 194 + n * 0.9));
      d[i + 2] = Math.min(255, Math.max(60, 133 + n * 0.7));
      d[i + 3] = 255;
    }
    ctx.putImageData(id, 0, 0);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    this.cache.set(key, tex);
    return tex;
  }

  /**
   * Generates crisp alpine snow with subtle blue ambient occlusion and sparkle.
   */
  static getSnowTexture(): THREE.CanvasTexture {
    const key = 'snow';
    if (this.cache.has(key)) return this.cache.get(key)!;

    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#f0f5fc';
    ctx.fillRect(0, 0, size, size);

    const id = ctx.getImageData(0, 0, size, size);
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * 14;
      d[i] = Math.min(255, Math.max(220, 240 + n));
      d[i + 1] = Math.min(255, Math.max(225, 245 + n));
      d[i + 2] = Math.min(255, Math.max(235, 253 + n));
      d[i + 3] = 255;
    }
    ctx.putImageData(id, 0, 0);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    this.cache.set(key, tex);
    return tex;
  }

  /**
   * Generates a high quality water normal map for realistic animated wave ripples.
   */
  static getWaterNormalMap(): THREE.CanvasTexture {
    const key = 'water_normal';
    if (this.cache.has(key)) return this.cache.get(key)!;

    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Heightmap generation with sin/cos wave synthesis
    const h = new Float32Array(size * size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = (x / size) * Math.PI * 2;
        const v = (y / size) * Math.PI * 2;
        const w1 = Math.sin(u * 6 + v * 3) * 0.35;
        const w2 = Math.sin(u * 12 - v * 9) * 0.25;
        const w3 = Math.cos(u * 18 + v * 15) * 0.2;
        const w4 = Math.sin(u * 28 - v * 24) * 0.12;
        const w5 = Math.cos(u * 44 + v * 38) * 0.08;
        h[y * size + x] = w1 + w2 + w3 + w4 + w5;
      }
    }

    // Convert height to normal map (Sobel operator)
    const id = ctx.createImageData(size, size);
    const d = id.data;
    const strength = 2.5;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const xl = (x - 1 + size) % size;
        const xr = (x + 1) % size;
        const yt = (y - 1 + size) % size;
        const yb = (y + 1) % size;

        const valXR = h[y * size + xr] ?? 0;
        const valXL = h[y * size + xl] ?? 0;
        const valYB = h[yb * size + x] ?? 0;
        const valYT = h[yt * size + x] ?? 0;

        const dx = (valXR - valXL) * strength;
        const dy = (valYB - valYT) * strength;
        const dz = 1.0;

        const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const nx = dx / len;
        const ny = dy / len;
        const nz = dz / len;

        const idx = (y * size + x) * 4;
        d[idx] = Math.floor((nx * 0.5 + 0.5) * 255);
        d[idx + 1] = Math.floor((ny * 0.5 + 0.5) * 255);
        d[idx + 2] = Math.floor((nz * 0.5 + 0.5) * 255);
        d[idx + 3] = 255;
      }
    }

    ctx.putImageData(id, 0, 0);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    this.cache.set(key, tex);
    return tex;
  }
}
