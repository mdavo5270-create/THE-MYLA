import * as THREE from 'three';

export type CameraMode = 'isometric' | 'free' | 'topdown';

/**
 * High performance, smooth 3D camera controller with inertia damping,
 * multi-mode support (Isometric 3D, Free Orbit, Top-Down), keyboard gliding,
 * mouse dragging, and minimap teleportation.
 */
export class Controls3D {
  readonly camera: THREE.PerspectiveCamera;
  private domElement: HTMLElement;

  mode: CameraMode = 'isometric';

  // Target look-at position in 3D world space
  readonly target: THREE.Vector3 = new THREE.Vector3(0, 5, 0);
  private desiredTarget: THREE.Vector3 = new THREE.Vector3(0, 5, 0);

  // Spherical coordinates around target
  distance: number = 65;
  private desiredDistance: number = 65;
  azimuth: number = Math.PI * 0.25; // 45 degrees
  private desiredAzimuth: number = Math.PI * 0.25;
  pitch: number = Math.PI * 0.28; // ~50 degrees
  private desiredPitch: number = Math.PI * 0.28;

  // Keyboard state
  private keys = new Set<string>();

  // Pointer state
  private isPointerDown: boolean = false;
  private pointerButton: number = 0;
  private lastPointerX: number = 0;
  private lastPointerY: number = 0;

  // Touch state
  private lastTouchDist: number = 0;

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.camera = camera;
    this.domElement = domElement;

    this.bindEvents();
    this.setMode('isometric');
  }

  setMode(mode: CameraMode): void {
    this.mode = mode;
    if (mode === 'isometric') {
      this.desiredAzimuth = Math.PI * 0.25;
      this.desiredPitch = Math.PI * 0.28;
    } else if (mode === 'topdown') {
      this.desiredPitch = Math.PI * 0.48;
    }
  }

  teleportTo(x: number, z: number, y: number = 5): void {
    this.desiredTarget.set(x, y, z);
    this.target.set(x, y, z);
  }

  private bindEvents(): void {
    // Keyboard
    window.addEventListener('keydown', (e) => this.keys.add(e.code));
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));

    // Pointer
    this.domElement.addEventListener('pointerdown', (e) => {
      this.isPointerDown = true;
      this.pointerButton = e.button;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
    });

    window.addEventListener('pointermove', (e) => {
      if (!this.isPointerDown) return;
      const dx = e.clientX - this.lastPointerX;
      const dy = e.clientY - this.lastPointerY;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;

      if (this.mode === 'free' || this.pointerButton === 2 || e.shiftKey) {
        // Orbit rotation
        this.desiredAzimuth -= dx * 0.006;
        this.desiredPitch = Math.max(0.12, Math.min(Math.PI * 0.48, this.desiredPitch + dy * 0.006));
      } else {
        // Pan terrain
        const forward = new THREE.Vector3(-Math.sin(this.azimuth), 0, -Math.cos(this.azimuth));
        const right = new THREE.Vector3(Math.cos(this.azimuth), 0, -Math.sin(this.azimuth));
        const factor = (this.distance / 1200);

        this.desiredTarget.addScaledVector(right, -dx * factor * 50);
        this.desiredTarget.addScaledVector(forward, dy * factor * 50);
      }
    });

    window.addEventListener('pointerup', () => {
      this.isPointerDown = false;
    });

    // Zoom
    this.domElement.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomSpeed = 0.0015;
      this.desiredDistance = Math.max(16, Math.min(220, this.desiredDistance * (1 + e.deltaY * zoomSpeed)));
    }, { passive: false });

    // Touch
    this.domElement.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        const t0 = e.touches[0];
        const t1 = e.touches[1];
        if (t0 && t1) {
          const dx = t0.clientX - t1.clientX;
          const dy = t0.clientY - t1.clientY;
          this.lastTouchDist = Math.sqrt(dx * dx + dy * dy);
        }
      }
    }, { passive: true });

    this.domElement.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2) {
        const t0 = e.touches[0];
        const t1 = e.touches[1];
        if (t0 && t1) {
          const dx = t0.clientX - t1.clientX;
          const dy = t0.clientY - t1.clientY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (this.lastTouchDist > 0 && dist > 0) {
            const ratio = this.lastTouchDist / dist;
            this.desiredDistance = Math.max(16, Math.min(220, this.desiredDistance * ratio));
          }
          this.lastTouchDist = dist;
        }
      }
    }, { passive: true });

    // Prevent default context menu for smooth right-click rotation
    this.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  update(deltaSeconds: number, terrainHeightGetter?: (x: number, z: number) => number): void {
    // Keyboard gliding
    let moveX = 0;
    let moveZ = 0;

    if (this.keys.has('KeyA') || this.keys.has('KeyQ') || this.keys.has('ArrowLeft')) moveX -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) moveX += 1;
    if (this.keys.has('KeyW') || this.keys.has('KeyZ') || this.keys.has('ArrowUp')) moveZ -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) moveZ += 1;

    if (moveX !== 0 || moveZ !== 0) {
      const isShift = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
      const baseSpeed = 45;
      const speed = (isShift ? baseSpeed * 2.8 : baseSpeed) * (this.distance / 65) * deltaSeconds;

      const forward = new THREE.Vector3(-Math.sin(this.azimuth), 0, -Math.cos(this.azimuth)).normalize();
      const right = new THREE.Vector3(Math.cos(this.azimuth), 0, -Math.sin(this.azimuth)).normalize();

      this.desiredTarget.addScaledVector(right, moveX * speed);
      this.desiredTarget.addScaledVector(forward, -moveZ * speed);
    }

    // Auto-adjust target Y to terrain surface
    if (terrainHeightGetter) {
      const groundY = terrainHeightGetter(this.desiredTarget.x, this.desiredTarget.z);
      this.desiredTarget.y = Math.max(0.5, groundY + 1.5);
    }

    // Smooth Damping (Lerp)
    const damp = Math.min(1.0, deltaSeconds * 9.0);
    this.target.lerp(this.desiredTarget, damp);
    this.distance += (this.desiredDistance - this.distance) * damp;
    this.azimuth += (this.desiredAzimuth - this.azimuth) * damp;
    this.pitch += (this.desiredPitch - this.pitch) * damp;

    // Calculate Camera Position on Sphere around Target
    const cosPitch = Math.cos(this.pitch);
    const sinPitch = Math.sin(this.pitch);
    const camX = this.target.x + this.distance * Math.sin(this.azimuth) * cosPitch;
    const camY = this.target.y + this.distance * sinPitch;
    const camZ = this.target.z + this.distance * Math.cos(this.azimuth) * cosPitch;

    this.camera.position.set(camX, camY, camZ);
    this.camera.lookAt(this.target);
  }
}
