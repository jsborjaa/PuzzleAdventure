import { withDevCacheBust, type LevelData } from '../data/Levels';
import { ensureImage } from '../data/imageCache';

export async function loadLevelTexture(scene: Phaser.Scene, level: LevelData): Promise<boolean> {
  if (scene.textures.exists(level.imageKey) && scene.textures.get(level.imageKey).key !== '__MISSING') {
    return true;
  }
  const src = await ensureImage('full', level.id, level.imageUrl);
  const url = withDevCacheBust(src);
  return new Promise((resolve) => {
    scene.load.image(level.imageKey, url);
    scene.load.once(Phaser.Loader.Events.COMPLETE, () => resolve(true));
    scene.load.once(Phaser.Loader.Events.FILE_LOAD_ERROR, () => resolve(false));
    scene.load.start();
  });
}
