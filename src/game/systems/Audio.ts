// Procedural Web Audio: the asset pack has no audio, so effects and music are
// synthesised. Starts only after a user gesture; suspends with the page.

type Sfx =
  | 'step_grass' | 'step_dirt' | 'step_stone' | 'step_wood' | 'step_metal' | 'step_water' | 'step_void'
  | 'splash' | 'open' | 'close' | 'rift' | 'stasis' | 'hit' | 'hurt' | 'ui' | 'confirm' | 'deny'
  | 'clue' | 'transition' | 'jump' | 'land' | 'dodge' | 'pickup' | 'swing' | 'bolt' | 'grapple' | 'puzzle' | 'telegraph';

interface Theme { root: number; scale: number[]; tempo: number; wave: OscillatorType; pad: number; strange?: boolean }
const THEMES: Record<string, Theme> = {
  shack: { root: 196, scale: [0, 2, 4, 7, 9], tempo: 0.42, wave: 'triangle', pad: 0.5 },
  town: { root: 220, scale: [0, 2, 4, 5, 7, 9], tempo: 0.36, wave: 'triangle', pad: 0.5 },
  forest: { root: 174.6, scale: [0, 3, 5, 7, 10], tempo: 0.5, wave: 'sine', pad: 0.6 },
  interior: { root: 196, scale: [0, 4, 7, 11], tempo: 0.55, wave: 'sine', pad: 0.4 },
  bunker: { root: 130.8, scale: [0, 1, 5, 7, 8], tempo: 0.6, wave: 'square', pad: 0.7, strange: true },
  workshop: { root: 164.8, scale: [0, 2, 3, 7, 9], tempo: 0.4, wave: 'square', pad: 0.4 },
  euclydia: { root: 261.6, scale: [0, 4, 7, 11, 14], tempo: 0.38, wave: 'triangle', pad: 0.5 },
  rupture: { root: 146.8, scale: [0, 1, 6, 7], tempo: 0.5, wave: 'sawtooth', pad: 0.6, strange: true },
  nightmare: { root: 110, scale: [0, 1, 4, 6, 10], tempo: 0.62, wave: 'sawtooth', pad: 0.8, strange: true },
  invaded: { root: 123.5, scale: [0, 1, 5, 6, 10], tempo: 0.34, wave: 'sawtooth', pad: 0.7, strange: true },
  temporal: { root: 207.6, scale: [0, 2, 6, 8, 10], tempo: 0.3, wave: 'square', pad: 0.5, strange: true },
  boss: { root: 98, scale: [0, 1, 3, 6, 7], tempo: 0.24, wave: 'sawtooth', pad: 0.8, strange: true },
  title: { root: 196, scale: [0, 3, 7, 10], tempo: 0.5, wave: 'triangle', pad: 0.6 },
};

export class AudioSystem {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private noiseBuf: AudioBuffer | null = null;
  private musicTimer: number | null = null;
  private theme: string | null = null;
  private step = 0;
  private recent = new Map<string, number>();
  volumes = { master: 0.8, music: 0.45, sfx: 0.8 };
  muted = false;

  /** Must be called from a user gesture handler. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended' && !document.hidden) void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.sfxBus = this.ctx.createGain();
    this.musicBus = this.ctx.createGain();
    this.sfxBus.connect(this.master);
    this.musicBus.connect(this.master);
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 0.5;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.applyVolumes();
    if (this.theme) this.startMusic(this.theme, true);
  }

  applyVolumes(): void {
    if (!this.ctx) return;
    this.master.gain.value = this.muted ? 0 : this.volumes.master;
    this.sfxBus.gain.value = this.volumes.sfx;
    this.musicBus.gain.value = this.volumes.music * 0.5;
  }

  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slide = 0, delay = 0, bus = this.sfxBus): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, filter: number, type: BiquadFilterType = 'lowpass', delay = 0): void {
    if (!this.ctx || !this.noiseBuf) return;
    const t = this.ctx.currentTime + delay;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = filter;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.sfxBus);
    s.start(t);
    s.stop(t + dur + 0.02);
  }

  play(name: Sfx): void {
    if (!this.ctx || this.ctx.state !== 'running') return;
    // the same effect at most every 40 ms: avoids stacking when many actors trigger it
    const now = performance.now();
    if ((this.recent.get(name) ?? 0) > now - 40) return;
    this.recent.set(name, now);
    switch (name) {
      case 'step_grass': this.noise(0.06, 0.12, 900); break;
      case 'step_dirt': this.noise(0.06, 0.14, 600); break;
      case 'step_stone': this.noise(0.04, 0.12, 2400, 'bandpass'); this.tone(180, 0.03, 'square', 0.02); break;
      case 'step_wood': this.tone(140, 0.06, 'triangle', 0.08); this.noise(0.03, 0.06, 1200); break;
      case 'step_metal': this.tone(420, 0.07, 'square', 0.03); this.noise(0.03, 0.06, 3000, 'highpass'); break;
      case 'step_water': this.noise(0.12, 0.12, 1600, 'bandpass'); break;
      case 'step_void': this.tone(90, 0.12, 'sine', 0.05, 30); break;
      case 'splash': this.noise(0.35, 0.3, 1400); this.tone(300, 0.2, 'sine', 0.05, -200); break;
      case 'open': this.tone(220, 0.12, 'square', 0.05, 160); this.noise(0.1, 0.08, 800, 'lowpass', 0.05); break;
      case 'close': this.tone(330, 0.12, 'square', 0.05, -160); break;
      case 'rift': this.tone(110, 0.6, 'sawtooth', 0.07, 600); this.tone(880, 0.6, 'sine', 0.04, -600); break;
      case 'stasis': this.tone(660, 0.5, 'sine', 0.06); this.tone(990, 0.5, 'sine', 0.04, 0, 0.08); break;
      case 'hit': this.noise(0.08, 0.25, 2000); this.tone(160, 0.08, 'square', 0.06, -80); break;
      case 'hurt': this.tone(300, 0.25, 'sawtooth', 0.08, -220); break;
      case 'ui': this.tone(880, 0.04, 'square', 0.03); break;
      case 'confirm': this.tone(660, 0.07, 'square', 0.04); this.tone(990, 0.09, 'square', 0.04, 0, 0.07); break;
      case 'deny': this.tone(200, 0.15, 'square', 0.05, -60); break;
      case 'clue': this.tone(784, 0.1, 'triangle', 0.06); this.tone(1046, 0.1, 'triangle', 0.06, 0, 0.1); this.tone(1318, 0.2, 'triangle', 0.05, 0, 0.2); break;
      case 'transition': this.noise(0.4, 0.12, 500); break;
      case 'jump': this.tone(300, 0.12, 'square', 0.04, 300); break;
      case 'land': this.noise(0.08, 0.15, 500); break;
      case 'dodge': this.noise(0.15, 0.12, 3000, 'highpass'); break;
      case 'pickup': this.tone(1046, 0.08, 'square', 0.04); this.tone(1568, 0.12, 'square', 0.04, 0, 0.08); break;
      case 'swing': this.noise(0.1, 0.14, 2600, 'bandpass'); break;
      case 'bolt': this.tone(600, 0.2, 'sawtooth', 0.05, -300); break;
      case 'grapple': this.tone(500, 0.25, 'square', 0.03, 600); this.noise(0.2, 0.06, 4000, 'highpass'); break;
      case 'puzzle': this.tone(523, 0.1, 'triangle', 0.06); this.tone(659, 0.1, 'triangle', 0.06, 0, 0.1); this.tone(784, 0.1, 'triangle', 0.06, 0, 0.2); this.tone(1046, 0.3, 'triangle', 0.06, 0, 0.3); break;
      case 'telegraph': this.tone(240, 0.18, 'square', 0.03, 120); break;
    }
  }

  step_(surface: string): void {
    this.play(`step_${surface}` as Sfx);
  }

  /** Simple generative loop per area; restarts only when the theme changes. */
  startMusic(theme: string, force = false): void {
    if (this.theme === theme && !force) return;
    this.theme = theme;
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
    this.musicTimer = null;
    if (!this.ctx) return;
    const th = THEMES[theme] ?? THEMES.shack;
    this.step = 0;
    this.musicTimer = window.setInterval(() => this.musicTick(th), th.tempo * 1000);
  }

  stopMusic(): void {
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
    this.musicTimer = null;
    this.theme = null;
  }

  private musicTick(th: Theme): void {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const s = this.step++;
    const note = (deg: number, oct = 0) => {
      const n = th.scale.length;
      const idx = ((deg % n) + n) % n;
      const o = Math.floor(deg / n) + oct;
      return th.root * Math.pow(2, (th.scale[idx] + o * 12) / 12);
    };
    // deterministic pseudo-melody from the step counter
    const pattern = [0, 2, 4, 2, 3, 1, 4, 0, 2, 3, 1, 4, 5, 3, 2, 1];
    const deg = pattern[s % pattern.length] + (Math.floor(s / 16) % 2 ? 1 : 0);
    if (s % 2 === 0 || th.strange) this.tone(note(deg, 1), th.tempo * 0.9, th.wave, 0.03, th.strange && s % 5 === 0 ? -40 : 0, 0, this.musicBus);
    if (s % 8 === 0) {
      this.tone(note(0, -1), th.tempo * 8 * th.pad, 'sine', 0.05, 0, 0, this.musicBus);
      this.tone(note(2, -1), th.tempo * 8 * th.pad, 'sine', 0.03, 0, 0, this.musicBus);
    }
  }
}
