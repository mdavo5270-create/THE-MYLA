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
 * Atmosphère dynamique & Éclairage ultra-réaliste :
 * - Vrai mode sombre / Nuit profonde et contrastée (pas d'éclaircissement parasite)
 * - Ombres directionnelles nettes
 * - Ciel étoilé et clair de lune tamisé
 * - Brouillard harmonisé qui ne décolore pas la scène
 */
export class SkyAtmosphere {
  readonly sunLight: THREE.DirectionalLight;
  readonly hemiLight: THREE.HemisphereLight;
  readonly skyMesh: THREE.Mesh;
  private skyUniforms: SkyUniforms;
  private scene: THREE.Scene;

  timeOfDay: number = 14.5; // Heure par défaut (après-midi lumineux)
  weather: 'clear' | 'foggy' | 'rainy' = 'clear';

  readonly sunDirection: THREE.Vector3 = new THREE.Vector3();
  readonly sunColor: THREE.Color = new THREE.Color();
  readonly fogColor: THREE.Color = new THREE.Color();
  fogDensity: number = 0.002;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Lumière directionnelle principale (Soleil / Lune)
    this.sunLight = new THREE.DirectionalLight(0xfffaed, 2.0);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 5;
    this.sunLight.shadow.camera.far = 400;
    const shadowDist = 80;
    this.sunLight.shadow.camera.left = -shadowDist;
    this.sunLight.shadow.camera.right = shadowDist;
    this.sunLight.shadow.camera.top = shadowDist;
    this.sunLight.shadow.camera.bottom = -shadowDist;
    this.sunLight.shadow.bias = -0.0005;
    scene.add(this.sunLight);
    scene.add(this.sunLight.target);

    // Lumière hémisphérique (ambiance ciel / sol)
    this.hemiLight = new THREE.HemisphereLight(0xb1e1ff, 0x221c15, 0.45);
    scene.add(this.hemiLight);

    // Dôme céleste
    const skyGeom = new THREE.SphereGeometry(600, 32, 24);
    skyGeom.scale(-1, 1, 1);

    this.skyUniforms = {
      uSunPosition: { value: new THREE.Vector3() },
      uZenithColor: { value: new THREE.Color(0x194d9e) },
      uHorizonColor: { value: new THREE.Color(0x91c4f2) },
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

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }

        void main() {
          vec3 dir = normalize(vWorldPosition);
          float height = clamp(dir.y, 0.0, 1.0);

          vec3 sky = mix(uHorizonColor, uZenithColor, pow(height, 0.7));

          // Disque & halo solaire
          float sunDot = max(0.0, dot(dir, normalize(uSunPosition)));
          float sunDisc = step(0.9992, sunDot);
          float sunGlow = pow(sunDot, 64.0) * 0.9 + pow(sunDot, 12.0) * 0.3;
          sky += uSunColor * (sunDisc + sunGlow) * (1.0 - uIsNight * 0.85);

          // Étoiles scintillantes dans la vraie nuit sombre
          if (uIsNight > 0.1) {
            vec2 starCoord = floor(dir.xz / (dir.y + 0.08) * 400.0);
            float s = hash(starCoord);
            if (s > 0.982 && dir.y > 0.05) {
              float starIntensity = pow((s - 0.982) / 0.018, 2.0);
              sky += vec3(0.95, 0.98, 1.0) * starIntensity * uIsNight;
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

    // Brouillard atmosphérique subtil
    scene.fog = new THREE.FogExp2(0x91c4f2, this.fogDensity);
  }

  get isNight(): boolean {
    return this.timeOfDay < 5.5 || this.timeOfDay > 19.5;
  }

  update(focusPosition: THREE.Vector3, camera: THREE.Camera): void {
    this.skyMesh.position.copy(camera.position);

    const dayProgress = (this.timeOfDay % 24) / 24;
    const sunAngle = (dayProgress - 0.25) * Math.PI * 2;

    const sunDist = 140;
    const sunX = Math.cos(sunAngle) * sunDist;
    const sunY = Math.sin(sunAngle) * sunDist;
    const sunZ = Math.sin(sunAngle * 0.5) * 35;

    const isDay = sunY > -4;
    const elevationFactor = Math.max(0, sunY / sunDist);

    if (isDay) {
      this.sunDirection.set(sunX, Math.max(2.0, sunY), sunZ).normalize();
      this.sunLight.position.set(focusPosition.x + sunX, focusPosition.y + Math.max(25, sunY), focusPosition.z + sunZ);
      this.sunLight.target.position.copy(focusPosition);

      if (elevationFactor < 0.15) {
        // Aube / Crépuscule doré
        this.sunColor.setHex(0xff7020);
        this.sunLight.color.setHex(0xff7d2e);
        this.sunLight.intensity = 1.6;
        this.skyUniforms.uZenithColor.value.setHex(0x132a52);
        this.skyUniforms.uHorizonColor.value.setHex(0xd16d38);
        this.fogColor.setHex(0x9c512a);
        this.hemiLight.color.setHex(0xffa166);
        this.hemiLight.groundColor.setHex(0x2b1e15);
        this.hemiLight.intensity = 0.35;
      } else if (elevationFactor < 0.4) {
        // Après-midi doré
        this.sunColor.setHex(0xfff0c2);
        this.sunLight.color.setHex(0xfff3d4);
        this.sunLight.intensity = 2.2;
        this.skyUniforms.uZenithColor.value.setHex(0x1c59b0);
        this.skyUniforms.uHorizonColor.value.setHex(0x99cbfa);
        this.fogColor.setHex(0x8ebff0);
        this.hemiLight.color.setHex(0xaad8ff);
        this.hemiLight.groundColor.setHex(0x29241b);
        this.hemiLight.intensity = 0.5;
      } else {
        // Plein midi éclatant
        this.sunColor.setHex(0xffffff);
        this.sunLight.color.setHex(0xfffaed);
        this.sunLight.intensity = 2.5;
        this.skyUniforms.uZenithColor.value.setHex(0x1b57ad);
        this.skyUniforms.uHorizonColor.value.setHex(0x94c5f5);
        this.fogColor.setHex(0x89beee);
        this.hemiLight.color.setHex(0xafd9ff);
        this.hemiLight.groundColor.setHex(0x29241b);
        this.hemiLight.intensity = 0.55;
      }
      this.skyUniforms.uIsNight.value = 0.0;
    } else {
      // VRAI MODE SOMBRE / NUIT NOIRE ET PROFONDE
      // Pas de blanchiment : ciel noir étoilé, ombres profondes et clair de lune subtil
      const moonX = -sunX;
      const moonY = Math.max(12, -sunY * 0.7);
      const moonZ = -sunZ;

      this.sunDirection.set(moonX, moonY, moonZ).normalize();
      this.sunLight.position.set(focusPosition.x + moonX, focusPosition.y + moonY, focusPosition.z + moonZ);
      this.sunLight.target.position.copy(focusPosition);

      // Clair de lune bleuté très doux et sombre
      this.sunColor.setHex(0x3b66aa);
      this.sunLight.color.setHex(0x28477a);
      this.sunLight.intensity = 0.35; // Nuit sombre réelle

      // Ciel nocturne profond
      this.skyUniforms.uZenithColor.value.setHex(0x02050d);
      this.skyUniforms.uHorizonColor.value.setHex(0x050c1c);
      this.skyUniforms.uIsNight.value = 1.0;

      // Brouillard nocturne noir/bleu très sombre (ne blanchit pas la scène)
      this.fogColor.setHex(0x030713);

      // Ambiance très faible pour laisser les lumières des bâtiments briller
      this.hemiLight.color.setHex(0x0f1c33);
      this.hemiLight.groundColor.setHex(0x04060a);
      this.hemiLight.intensity = 0.12;
    }

    // Gestion de la météo
    if (this.weather === 'foggy') {
      this.fogDensity = 0.008;
      this.sunLight.intensity *= 0.6;
    } else if (this.weather === 'rainy') {
      this.fogDensity = 0.005;
      this.sunLight.intensity *= 0.45;
    } else {
      this.fogDensity = 0.0018;
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
