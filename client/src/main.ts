import { fetchWorldConfig } from './network/api';
import { WorldRenderer3D } from './game/renderer3d/WorldRenderer3D';
import { HudOverlay } from './game/ui/HudOverlay';

async function boot(): Promise<void> {
  const container = document.getElementById('game-container');
  if (!container) {
    throw new Error('Element #game-container introuvable dans le DOM');
  }

  // Fetch world seed & dimensions from backend API (or fallback to deterministic default)
  const worldConfig = await fetchWorldConfig();

  // Initialize Ultra-Realistic 3D World Engine
  const renderer3d = new WorldRenderer3D(worldConfig, container);

  // Initialize Glassmorphism HUD, Camera Controls & Interactive Minimap
  new HudOverlay(renderer3d);

  console.log(`[THE MYLA 3D] Monde initialisé avec succès : Seed="${worldConfig.seed}", Taille=${worldConfig.width}x${worldConfig.height}`);
}

void boot();
