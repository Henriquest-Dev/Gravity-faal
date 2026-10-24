import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import Phaser from 'phaser';
import './styles.css';
import { BootScene } from './game/scenes/BootScene';
import { MenuScene } from './game/scenes/MenuScene';
import { WorldScene } from './game/scenes/WorldScene';
import { session } from './game/session';
import { Ui } from './game/ui/Ui';

// the game's typeface must be ready before canvas texts are drawn
void document.fonts?.load('16px "Cipher Hand"');

const host = document.getElementById('game')!;
const ui = new Ui(document.getElementById('ui-root')!);

// ?renderer=canvas forces the 2D canvas renderer (fallback for devices with poor WebGL drivers)
const forceCanvas = new URLSearchParams(location.search).get('renderer') === 'canvas' || session.settings.renderer === 'canvas';
const game = new Phaser.Game({
  type: forceCanvas ? Phaser.CANVAS : Phaser.AUTO,
  parent: host,
  backgroundColor: '#14110f',
  pixelArt: true, // nearest-neighbour sampling everywhere
  roundPixels: true,
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  input: { activePointers: 4 },
  fps: { target: 60, smoothStep: true },
  scene: [BootScene, MenuScene, WorldScene],
  callbacks: { preBoot: (g) => g.registry.set('ui', ui) },
});

// Pause safely when hidden (tab switch, app in background) and recover on return.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    session.input.releaseAll();
    ui.touch.release();
    session.audio.suspend();
    game.loop.sleep();
  } else {
    game.loop.wake();
    session.audio.resume();
    const world = game.scene.getScene('world');
    if (world?.scene.isActive() && !ui.blocking) ui.open('pause');
  }
});
window.addEventListener('blur', () => {
  session.input.releaseAll();
  ui.touch.release();
});
// first gesture unlocks audio (browser autoplay policy)
for (const ev of ['pointerdown', 'keydown'] as const) window.addEventListener(ev, () => session.audio.unlock(), { passive: true });
// avoid page scroll / zoom gestures while playing on touch screens
document.addEventListener('touchmove', (e) => { if ((e.target as HTMLElement).closest('.p-body, textarea')) return; e.preventDefault(); }, { passive: false });
document.addEventListener('contextmenu', (e) => e.preventDefault());

// Android back button: closes menus or pauses instead of leaving the game.
if (Capacitor.isNativePlatform()) {
  void App.addListener('backButton', () => {
    const world = game.scene.getScene('world');
    if (ui.panel) ui.close();
    else if (world?.scene.isActive() && !ui.blocking) ui.open('pause');
    else if (!world?.scene.isActive()) void App.exitApp();
  });
}
