import Phaser from 'phaser';
import { ASSET_ROOT, missingAssets, queueGlobal, setManifest, type Manifest } from '../assets';
import type { Ui } from '../ui/Ui';
import { makeGenerated } from '../world/generated';

/** Loads the manifest, then every global asset with a progress bar and a validation report. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload(): void {
    const ui = this.registry.get('ui') as Ui;
    ui.loading(true, 'A ler o inventário de recursos…', 0);
    this.load.json('manifest', ASSET_ROOT + 'metadata/manifest.json');
    this.load.once('loaderror', (f: Phaser.Loader.File) => missingAssets.push(`${f.key} (${f.url})`));
  }

  create(): void {
    const ui = this.registry.get('ui') as Ui;
    const manifest = this.cache.json.get('manifest') as Manifest | undefined;
    if (!manifest) {
      ui.loading(true, 'Erro: metadata/manifest.json não encontrado.', 0);
      ui.loadingError(['Sem o manifest não é possível carregar personagens, objectos e texturas.', 'Corre "npm run assets:extract" para regenerar public/assets.']);
      return;
    }
    setManifest(manifest);
    queueGlobal(this);
    this.load.on('progress', (p: number) => ui.loading(true, 'A carregar personagens e texturas…', p));
    this.load.on('loaderror', (f: Phaser.Loader.File) => missingAssets.push(`${f.key} → ${f.url}`));
    this.load.once('complete', () => {
      this.load.off('progress');
      makeGenerated(this);
      if (missingAssets.length) {
        // identifiable errors instead of silent holes in the world
        ui.loadingError([`${missingAssets.length} recurso(s) em falta:`, ...missingAssets.slice(0, 8)]);
        console.error('Recursos em falta', missingAssets);
        window.setTimeout(() => this.next(ui), 2500);
      } else this.next(ui);
    });
    this.load.start();
  }

  private next(ui: Ui): void {
    ui.loading(false);
    this.scene.start('menu');
  }
}
