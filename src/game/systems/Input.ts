// Unified input: keyboard (remappable), mouse and touch feed the same action state.
// Contexts keep dialogue/menu keys from leaking into gameplay.

export type Action =
  | 'up' | 'down' | 'left' | 'right' | 'run' | 'interact' | 'primary' | 'secondary'
  | 'jump' | 'dodge' | 'switch' | 'inventory' | 'map' | 'journal' | 'pause' | 'advance'
  | 'cycle' | 'debug';

export const ACTION_LABELS: Record<Action, string> = {
  up: 'Mover para cima', down: 'Mover para baixo', left: 'Mover para a esquerda', right: 'Mover para a direita',
  run: 'Correr', interact: 'Interagir', primary: 'Acção principal', secondary: 'Acção secundária (capacidade)',
  jump: 'Saltar', dodge: 'Esquivar', switch: 'Alternar Dipper/Mabel', inventory: 'Inventário', map: 'Mapa',
  journal: 'Diário', pause: 'Pausa', advance: 'Avançar diálogo', cycle: 'Mudar capacidade', debug: 'Modo de depuração',
};

export const DEFAULT_BINDINGS: Record<Action, string[]> = {
  up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'], interact: ['KeyE'], primary: ['KeyJ'], secondary: ['KeyK'], jump: ['Space'],
  dodge: ['KeyL'], switch: ['KeyQ'], inventory: ['KeyI'], map: ['KeyM'], journal: ['KeyN'], pause: ['Escape'],
  advance: ['Enter', 'NumpadEnter'], cycle: ['KeyR', 'Tab'], debug: ['F3'],
};

export type InputContext = 'world' | 'ui';

export class InputManager {
  bindings: Record<Action, string[]>;
  context: InputContext = 'world';
  private codeToActions = new Map<string, Action[]>();
  private heldCodes = new Set<string>();
  private latched = new Set<string>(); // ignored until released (context switches)
  private virtual = new Map<Action, Set<number>>(); // touch pointer ids holding an action
  private pressedQueue = new Set<Action>();
  private uiPressed = new Set<Action>();
  touchMove = { x: 0, y: 0 };
  touchRun = false;
  aim: { x: number; y: number } | null = null; // world direction from mouse or touch drag
  mouseWorld: { x: number; y: number } | null = null;
  mouseActiveUntil = 0;
  lastDevice: 'keyboard' | 'touch' = 'keyboard';
  onAnyKey: ((code: string) => boolean) | null = null; // remap capture

  constructor(bindings?: Partial<Record<Action, string[]>>) {
    this.bindings = { ...DEFAULT_BINDINGS, ...(bindings ?? {}) };
    this.rebuild();
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.releaseAll);
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.releaseAll(); });
  }

  rebuild(): void {
    this.codeToActions.clear();
    for (const [a, codes] of Object.entries(this.bindings) as [Action, string[]][]) {
      for (const c of codes) {
        const list = this.codeToActions.get(c) ?? [];
        list.push(a);
        this.codeToActions.set(c, list);
      }
    }
  }

  setBinding(action: Action, index: number, code: string): void {
    // a key belongs to one action only: remove it elsewhere first
    for (const a of Object.keys(this.bindings) as Action[]) this.bindings[a] = this.bindings[a].filter((c) => c !== code);
    const list = [...this.bindings[action]];
    list[index] = code;
    this.bindings[action] = list.filter(Boolean);
    this.rebuild();
  }

  resetBindings(): void {
    this.bindings = JSON.parse(JSON.stringify(DEFAULT_BINDINGS));
    this.rebuild();
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (this.onAnyKey) {
      e.preventDefault();
      if (this.onAnyKey(e.code)) this.onAnyKey = null;
      return;
    }
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
    const actions = this.codeToActions.get(e.code);
    if (actions) e.preventDefault();
    this.lastDevice = 'keyboard';
    if (e.repeat) return;
    this.heldCodes.add(e.code);
    if (!actions) return;
    for (const a of actions) this.press(a);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.heldCodes.delete(e.code);
    this.latched.delete(e.code);
  };

  private press(a: Action): void {
    if (this.context === 'world') this.pressedQueue.add(a);
    else this.uiPressed.add(a);
  }

  /** Touch / on-screen buttons. pointerId keeps multi-touch independent. */
  virtualDown(a: Action, pointerId: number): void {
    this.lastDevice = 'touch';
    let set = this.virtual.get(a);
    if (!set) this.virtual.set(a, (set = new Set()));
    if (!set.has(pointerId)) {
      set.add(pointerId);
      this.press(a);
    }
  }

  virtualUp(a: Action, pointerId: number): void {
    this.virtual.get(a)?.delete(pointerId);
  }

  releaseAll = (): void => {
    this.heldCodes.clear();
    this.latched.clear();
    this.virtual.clear();
    this.touchMove = { x: 0, y: 0 };
    this.touchRun = false;
    this.pressedQueue.clear();
    this.uiPressed.clear();
  };

  setContext(ctx: InputContext): void {
    if (ctx === this.context) return;
    this.context = ctx;
    // keys still held from the previous context are ignored until released
    for (const c of this.heldCodes) this.latched.add(c);
    this.pressedQueue.clear();
    this.uiPressed.clear();
  }

  held(a: Action): boolean {
    if (this.context !== 'world') return false;
    for (const c of this.bindings[a]) if (this.heldCodes.has(c) && !this.latched.has(c)) return true;
    return (this.virtual.get(a)?.size ?? 0) > 0;
  }

  /** Edge-triggered gameplay action, consumed on read. */
  consume(a: Action): boolean {
    if (this.context !== 'world') return false;
    if (!this.pressedQueue.has(a)) return false;
    this.pressedQueue.delete(a);
    return true;
  }

  /** Edge-triggered UI action (dialogue/menus), consumed on read. */
  consumeUi(a: Action): boolean {
    if (!this.uiPressed.has(a)) return false;
    this.uiPressed.delete(a);
    return true;
  }

  /** Called once per frame after gameplay read its actions. */
  endFrame(): void {
    this.pressedQueue.clear();
  }

  moveVector(): { x: number; y: number } {
    if (this.context !== 'world') return { x: 0, y: 0 };
    let x = 0, y = 0;
    if (this.held('left')) x -= 1;
    if (this.held('right')) x += 1;
    if (this.held('up')) y -= 1;
    if (this.held('down')) y += 1;
    if (x === 0 && y === 0) return { ...this.touchMove };
    return { x, y };
  }

  running(): boolean {
    return this.held('run') || this.touchRun;
  }

  /** Mouse aim is used only shortly after the mouse moved over the world. */
  mouseAimActive(now: number): boolean {
    return this.lastDevice === 'keyboard' && !!this.mouseWorld && now < this.mouseActiveUntil;
  }

  keyLabel(a: Action): string {
    const c = this.bindings[a][0];
    if (!c) return '—';
    return c.replace(/^Key/, '').replace(/^Digit/, '').replace('ShiftLeft', 'Shift').replace('Space', 'Espaço').replace('Escape', 'Esc').replace('Arrow', '');
  }
}
