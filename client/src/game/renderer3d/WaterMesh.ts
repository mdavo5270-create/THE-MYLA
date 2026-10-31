import * as THREE from 'three';
import { TextureGenerator } from './TextureGenerator';

interface WaterUniforms {
  [key: string]: THREE.IUniform;
  uTime: { value: number };
  uNormalMap: { value: THREE.CanvasTexture };
  uSunDirection: { value: THREE.Vector3 };
  uSunColor: { value: THREE.Color };
  uWaterColorDeep: { value: THREE.Color };
  uWaterColorShallow: { value: THREE.Color };
  uWaveSpeed: { value: number };
  uWaveScale: { value: number };
  uNormalStrength: { value: number };
  uCameraPosition: { value: THREE.Vector3 };
  uFogColor: { value: THREE.Color };
  uFogDensity: { value: number };
}

/**
 * Photorealistic animated 3D water with dual scrolling wave normal maps,
 * Fresnel reflectance, depth color gradients, specular sun highlights,
 * and shoreline foam edge dynamics.
 */
export class WaterMesh {
  readonly mesh: THREE.Mesh;
  private waterUniforms: WaterUniforms;
  private normalMap: THREE.CanvasTexture;

  constructor(size: number = 2048) {
    this.normalMap = TextureGenerator.getWaterNormalMap();

    const geometry = new THREE.PlaneGeometry(size, size, 128, 128);
    geometry.rotateX(-Math.PI / 2);

    this.waterUniforms = {
      uTime: { value: 0 },
      uNormalMap: { value: this.normalMap },
      uSunDirection: { value: new THREE.Vector3(0.5, 0.8, 0.3).normalize() },
      uSunColor: { value: new THREE.Color(0xfff4d6) },
      uWaterColorDeep: { value: new THREE.Color(0x061e3d) },
      uWaterColorShallow: { value: new THREE.Color(0x199bb6) },
      uWaveSpeed: { value: 0.04 },
      uWaveScale: { value: 24.0 },
      uNormalStrength: { value: 0.85 },
      uCameraPosition: { value: new THREE.Vector3() },
      uFogColor: { value: new THREE.Color(0x7da4cf) },
      uFogDensity: { value: 0.0035 },
    };

    const vertexShader = `
      uniform float uTime;
      uniform float uWaveSpeed;
      varying vec2 vUv;
      varying vec3 vWorldPosition;
      varying vec3 vNormal;

      void main() {
        vUv = uv;
        vec3 pos = position;

        // Subtle organic physical wave displacement
        float wave1 = sin(pos.x * 0.12 + uTime * 2.2) * cos(pos.z * 0.12 + uTime * 1.8) * 0.22;
        float wave2 = sin(pos.x * 0.25 - uTime * 1.5) * cos(pos.z * 0.25 + uTime * 1.3) * 0.10;
        pos.y += wave1 + wave2;

        vec4 worldPos = modelMatrix * vec4(pos, 1.0);
        vWorldPosition = worldPos.xyz;
        vNormal = normalize((modelMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `;

    const fragmentShader = `
      uniform float uTime;
      uniform sampler2D uNormalMap;
      uniform vec3 uSunDirection;
      uniform vec3 uSunColor;
      uniform vec3 uWaterColorDeep;
      uniform vec3 uWaterColorShallow;
      uniform float uWaveScale;
      uniform float uNormalStrength;
      uniform vec3 uCameraPosition;
      uniform vec3 uFogColor;
      uniform float uFogDensity;

      varying vec2 vUv;
      varying vec3 vWorldPosition;
      varying vec3 vNormal;

      void main() {
        vec3 viewDir = normalize(uCameraPosition - vWorldPosition);

        // Dual scrolling wave textures for organic swell
        vec2 uv1 = vUv * uWaveScale + vec2(uTime * 0.025, uTime * 0.018);
        vec2 uv2 = vUv * (uWaveScale * 1.45) - vec2(uTime * 0.019, -uTime * 0.024);

        vec3 normal1 = texture2D(uNormalMap, uv1).rgb * 2.0 - 1.0;
        vec3 normal2 = texture2D(uNormalMap, uv2).rgb * 2.0 - 1.0;
        vec3 combinedNormal = normalize(vec3(
          (normal1.x + normal2.x) * uNormalStrength,
          1.0,
          (normal1.y + normal2.y) * uNormalStrength
        ));

        // Fresnel term (Schlick's approximation)
        float cosTheta = clamp(dot(viewDir, combinedNormal), 0.0, 1.0);
        float fresnel = 0.02 + 0.98 * pow(1.0 - cosTheta, 4.0);

        // Blending shallow turquoise and deep ocean
        vec3 waterBase = mix(uWaterColorDeep, uWaterColorShallow, pow(cosTheta, 2.0) * 0.65);

        // Specular Sun Highlight (Blinn-Phong)
        vec3 halfVector = normalize(uSunDirection + viewDir);
        float NdotH = clamp(dot(combinedNormal, halfVector), 0.0, 1.0);
        float specular = pow(NdotH, 140.0) * 1.8;
        vec3 sunGlint = uSunColor * specular;

        // Sky reflection (fresnel tint)
        vec3 skyReflection = mix(vec3(0.55, 0.72, 0.92), uSunColor, 0.35) * fresnel * 0.85;

        // Foam simulation along wave peaks
        float foamFactor = clamp((combinedNormal.x + combinedNormal.z) * 1.8 - 0.7, 0.0, 1.0);
        vec3 foam = vec3(0.95, 0.98, 1.0) * foamFactor * 0.45;

        vec3 finalColor = waterBase + skyReflection + sunGlint + foam;

        // Atmospheric distance fog
        float dist = length(uCameraPosition - vWorldPosition);
        float fogFactor = 1.0 - exp(-dist * uFogDensity);
        finalColor = mix(finalColor, uFogColor, clamp(fogFactor, 0.0, 1.0));

        gl_FragColor = vec4(finalColor, 0.88);
      }
    `;

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: this.waterUniforms,
      transparent: true,
      depthWrite: true,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.y = 0.0;
    this.mesh.renderOrder = 1;
  }

  update(deltaSeconds: number, camera: THREE.Camera, sunDir: THREE.Vector3, sunCol: THREE.Color, fogCol: THREE.Color, fogDensity: number): void {
    this.waterUniforms.uTime.value += deltaSeconds;
    this.waterUniforms.uCameraPosition.value.copy(camera.position);
    this.waterUniforms.uSunDirection.value.copy(sunDir);
    this.waterUniforms.uSunColor.value.copy(sunCol);
    this.waterUniforms.uFogColor.value.copy(fogCol);
    this.waterUniforms.uFogDensity.value = fogDensity;
  }

  setPosition(x: number, z: number): void {
    this.mesh.position.x = x;
    this.mesh.position.z = z;
  }
}
