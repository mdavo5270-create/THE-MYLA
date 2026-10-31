import Phaser from 'phaser';
import { WorldScene } from './game/scenes/WorldScene';
import { fetchWorldConfig } from './network/api';

async function boot(): Promise<void> {
  const world = await fetchWorldConfig();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game-container',
    backgroundColor: '#0b1e33',
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: window.innerWidth,
      height: window.innerHeight,
    },
    scene: [],
  });
  game.scene.add('World', WorldScene, true, { world });
}

void boot();
