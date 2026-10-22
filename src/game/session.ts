import { SaveStore, type StorageLike } from '../core/save';
import { createState, type GameState } from '../core/state';
import { AudioSystem } from './systems/Audio';
import { InputManager, type Action } from './systems/Input';

export interface Settings {
  musicVolume: number;
  sfxVolume: number;
  masterVolume: number;
  touchScale: number;
  touchOpacity: number;
  touchControls: 'auto' | 'on' | 'off';
  screenShake: boolean;
  reducedEffects: boolean;
  bindings: Partial<Record<Action, string[]>>;
  lastSlot: number;
}

const DEFAULT_SETTINGS: Settings = {
  musicVolume: 0.45, sfxVolume: 0.8, masterVolume: 0.8, touchScale: 1, touchOpacity: 0.75,
  touchControls: 'auto', screenShake: true, reducedEffects: false, bindings: {}, lastSlot: 1,
};

/** localStorage can throw (private mode, WebView policies): fall back to memory. */
function safeStorage(): StorageLike {
  try {
    const k = '__gf_probe';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return window.localStorage;
  } catch {
    const mem = new Map<string, string>();
    return { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v), removeItem: (k) => void mem.delete(k) };
  }
}

class Session {
  storage = safeStorage();
  saves = new SaveStore(this.storage);
  settings: Settings = this.loadSettings();
  input = new InputManager(this.settings.bindings);
  audio = new AudioSystem();
  state: GameState = createState(1);
  slot = this.settings.lastSlot;
  debug = new URLSearchParams(location.search).has('debug');
  isTouch = window.matchMedia?.('(pointer: coarse)').matches ?? false;

  constructor() {
    this.applyAudio();
  }

  loadSettings(): Settings {
    try {
      const raw = this.storage.getItem('gf.settings');
      if (raw) return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
    } catch {
      /* corrupt settings are replaced by defaults */
    }
    return { ...DEFAULT_SETTINGS };
  }

  saveSettings(): void {
    this.settings.bindings = this.input.bindings;
    this.storage.setItem('gf.settings', JSON.stringify(this.settings));
    this.applyAudio();
  }

  applyAudio(): void {
    this.audio.volumes = { master: this.settings.masterVolume, music: this.settings.musicVolume, sfx: this.settings.sfxVolume };
    this.audio.applyVolumes();
  }

  touchVisible(): boolean {
    if (this.settings.touchControls === 'on') return true;
    if (this.settings.touchControls === 'off') return false;
    return this.isTouch || this.input.lastDevice === 'touch';
  }
}

export const session = new Session();
