import * as THREE from 'three';

export interface AtmosphereState {
  timeOfDay: number; // 0.0 to 24.0 hours
  weather: 'clear' | 'foggy' | 'rainy';
}

interface SkyUniforms {
  [key: string]: THREE.IUniform;
  uSunPosition: { value: THREE.Vector3 };
  uZenithColor: { value: THREE.Color };
  uHorizonColor: { value: THREE.Color };
  uSunColor: { value: THREE.Color };
  uIsNight: { value: number };
}

/**
 * Dynamic Atmospheric Sky, Realistic Sunlight & Moon, Directional Soft Shadows,
 * Stars, and Harmonized Volumetric Fog.
 */
export class SkyAtmosphere {
  readonly sunLight: THREE.DirectionalLight;
  readonly hemiLight: THREE.HemisphereLight;
  readonly skyMesh: THREE.Mesh;
  private skyUniforms: SkyUniforms;
  private scene: THREE.Scene;

  timeOfDay: number = 15.5; // Default 3:30 PM Golden Hour
  weather: 'clear' | 'foggy' | 'rainy' = 'clear';

  readonly sunDirection: THREE.Vector3 = new THREE.Vector3();
  readonly sunColor: THREE.Color = new THREE.Color();
  readonly fogColor: THREE.Color = new THREE.Color();
  fogDensity: number = 0.0035;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Atmospheric Directional Sun / Moon Light
    this.sunLight = new THREE.DirectionalLight(0xfffaed, 2.2);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 5;
    this.sunLight.shadow.camera.far = 400;
    const shadowDist = 90;
    this.sunLight.shadow.camera.left = -shadowDist;
    this.sunLight.shadow.camera.right = shadowDist;
    this.sunLight.shadow.camera.top = shadowDist;
    this.sunLight.shadow.camera.bottom = -shadowDist;
    this.sunLight.shadow.bias = -0.0004;
    scene.add(this.sunLight);
    scene.add(this.sunLight.target);

    // Hemispheric Ambient Light (Sky / Ground bounce)
    this.hemiLight = new THREE.HemisphereLight(0xb1e1ff, 0x3d3522, 0.7);
    scene.add(this.hemiLight);

    // Dynamic Atmospheric Sky Dome
    const skyGeom = new THREE.SphereGeometry(800, 32, 24);
    skyGeom.scale(-1, 1, 1); // Render inside

    this.skyUniforms = {
      uSunPosition: { value: new THREE.Vector3() },
      uZenithColor: { value: new THREE.Color(0x2764b8) },
      uHorizonColor: { value: new THREE.Color(0xb0d5f8) },
      uSunColor: { value: new THREE.Color(0xfffae6) },
      uIsNight: { value: 0.0 },
    };

    const skyMaterial = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform vec3 uSunPosition;
        uniform vec3 uZenithColor;
        uniform vec3 uHorizonColor;
        uniform vec3 uSunColor;
        uniform float uIsNight;
        varying vec3 vWorldPosition;

        // Pseudo-random star generator
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }

        void main() {
          vec3 dir = normalize(vWorldPosition);
          float height = clamp(dir.y, 0.0, 1.0);

          // Atmospheric gradient from horizon to zenith
          vec3 sky = mix(uHorizonColor, uZenithColor, pow(height, 0.65));

          // Sun Disc & Glow
          float sunDot = max(0.0, dot(dir, normalize(uSunPosition)));
          float sunDisc = step(0.9993, sunDot);
          float sunGlow = pow(sunDot, 64.0) * 0.8 + pow(sunDot, 8.0) * 0.25;
          sky += uSunColor * (sunDisc + sunGlow);

          // Night Stars
          if (uIsNight > 0.01) {
            vec2 starCoord = floor(dir.xz / (dir.y + 0.1) * 350.0);
            float s = hash(starCoord);
            if (s > 0.985 && dir.y > 0.08) {
              float starIntensity = pow((s - 0.985) / 0.015, 2.0);
              sky += vec3(0.9, 0.95, 1.0) * starIntensity * uIsNight * 0.9;
            }
          }

          gl_FragColor = vec4(sky, 1.0);
        }
      `,
      depthWrite: false,
      side: THREE.BackSide,
    });

    this.skyMesh = new THREE.Mesh(skyGeom, skyMaterial);
    scene.add(this.skyMesh);

    // Initial fog
    scene.fog = new THREE.FogExp2(0xb0d5f8, this.fogDensity);
  }

  update(focusPosition: THREE.Vector3, cameraPosition: THREE.Camera): void {
    // Keep sky centered on camera
    this.skyMesh.position.copy(cameraPosition.position);

    // Sun trajectory calculation (time 0h to 24h)
    const dayProgress = (this.timeOfDay % 24) / 24;
    const sunAngle = (dayProgress - 0.25) * Math.PI * 2; // Sunrise ~6h, Noon 12h, Sunset 18h

    const sunDist = 160;
    const sunX = Math.cos(sunAngle) * sunDist;
    const sunY = Math.sin(sunAngle) * sunDist;
    const sunZ = Math.sin(sunAngle * 0.5) * 40;

    const isDay = sunY > -5;
    const elevationFactor = Math.max(0, sunY / sunDist);

    if (isDay) {
      this.sunDirection.set(sunX, Math.max(2.0, sunY), sunZ).normalize();
      this.sunLight.position.set(focusPosition.x + sunX, focusPosition.y + Math.max(20, sunY), focusPosition.z + sunZ);
      this.sunLight.target.position.copy(focusPosition);

      // Color temperature calculation
      if (elevationFactor < 0.18) {
        // Sunrise / Sunset golden-orange
        this.sunColor.setHex(0xff7733);
        this.sunLight.color.setHex(0xff8844);
        this.sunLight.intensity = 1.6;
        this.skyUniforms.uZenithColor.value.setHex(0x1a386b);
        this.skyUniforms.uHorizonColor.value.setHex(0xe88d56);
        this.fogColor.setHex(0xd48757);
      } else if (elevationFactor < 0.45) {
        // Golden Afternoon / Morning
        this.sunColor.setHex(0xffe6a3);
        this.sunLight.color.setHex(0xfff0c4);
        this.sunLight.intensity = 2.4;
        this.skyUniforms.uZenithColor.value.setHex(0x2767c2);
        this.skyUniforms.uHorizonColor.value.setHex(0xa8d3fa);
        this.fogColor.setHex(0xa0caf2);
      } else {
        // Bright midday
        this.sunColor.setHex(0xffffff);
        this.sunLight.color.setHex(0xfffaf0);
        this.sunLight.intensity = 2.8;
        this.skyUniforms.uZenithColor.value.setHex(0x195cb8);
        this.skyUniforms.uHorizonColor.value.setHex(0x9ccbf5);
        this.fogColor.setHex(0x94c4ef);
      }
      this.skyUniforms.uIsNight.value = 0.0;
      this.hemiLight.color.setHex(0xa4d4ff);
      this.hemiLight.groundColor.setHex(0x353228);
      this.hemiLight.intensity = 0.8;
    } else {
      // Night / Moonlight
      const moonX = -sunX;
      const moonY = Math.max(15, -sunY);
      const moonZ = -sunZ;
      this.sunDirection.set(moonX, moonY, moonZ).normalize();
      this.sunLight.position.set(focusPosition.x + moonX, focusPosition.y + moonY, focusPosition.z + moonZ);
      this.sunLight.target.position.copy(focusPosition);

      this.sunColor.setHex(0x7da4e8);
      this.sunLight.color.setHex(0x6085cc);
      this.sunLight.intensity = 0.45;

      this.skyUniforms.uZenithColor.value.setHex(0x050a16);
      this.skyUniforms.uHorizonColor.value.setHex(0x0a1426);
      this.skyUniforms.uIsNight.value = 1.0;
      this.fogColor.setHex(0x081020);

      this.hemiLight.color.setHex(0x2a3e66);
      this.hemiLight.groundColor.setHex(0x0a0e14);
      this.hemiLight.intensity = 0.25;
    }

    // Weather adjustments
    if (this.weather === 'foggy') {
      this.fogDensity = 0.012;
      this.sunLight.intensity *= 0.6;
    } else if (this.weather === 'rainy') {
      this.fogDensity = 0.008;
      this.fogColor.lerp(new THREE.Color(0x3b4a59), 0.6);
      this.sunLight.intensity *= 0.4;
    } else {
      this.fogDensity = 0.0032;
    }

    this.skyUniforms.uSunPosition.value.copy(this.sunLight.position);
    this.skyUniforms.uSunColor.value.copy(this.sunColor);

    if (this.scene.fog && this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.copy(this.fogColor);
      this.scene.fog.density = this.fogDensity;
    }
  }

  setTimeOfDay(hours: number): void {
    this.timeOfDay = ((hours % 24) + 24) % 24;
  }

  setWeather(weather: 'clear' | 'foggy' | 'rainy'): void {
    this.weather = weather;
  }
}
