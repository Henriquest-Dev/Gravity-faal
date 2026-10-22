import { check } from './conditions';
import type { RuleData, Signal } from './rules';
import { applyEffects } from './rules';
import type { GameState } from './state';
import type { DialogueChoice, DialogueDef, DialogueNode } from './types';

export interface DialogueView {
  speaker: string;
  text: string;
  mood?: string;
  choices: DialogueChoice[];
}

/** Pure dialogue state machine; the UI renders `view` and calls advance/choose. */
export class DialogueRunner {
  node: DialogueNode | null = null;
  readonly signals: Signal[] = [];

  constructor(
    readonly def: DialogueDef,
    readonly state: GameState,
    readonly data: RuleData,
  ) {}

  /** Picks the first entry whose condition holds. Returns false when nothing applies. */
  start(): boolean {
    for (const entry of this.def.entries) {
      if (entry.once && this.state.flags[entry.once]) continue;
      if (!check(entry.if, this.state)) continue;
      if (entry.once) this.state.flags[entry.once] = true;
      return this.goto(entry.start);
    }
    return false;
  }

  private goto(id: string | undefined): boolean {
    if (!id) {
      this.node = null;
      return false;
    }
    const node = this.def.nodes[id];
    if (!node) throw new Error(`Dialogue ${this.def.id}: missing node ${id}`);
    this.node = node;
    this.signals.push(...applyEffects(this.state, node.effects, this.data));
    return true;
  }

  get view(): DialogueView | null {
    if (!this.node) return null;
    return { speaker: this.node.speaker, text: this.node.text, mood: this.node.mood, choices: this.visibleChoices() };
  }

  visibleChoices(): DialogueChoice[] {
    if (!this.node?.choices) return [];
    return this.node.choices.filter((c) => check(c.if, this.state));
  }

  /** Advance a node without choices. Returns false when the dialogue ended. */
  advance(): boolean {
    if (!this.node) return false;
    if (this.visibleChoices().length) return true;
    return this.goto(this.node.next);
  }

  choose(index: number): boolean {
    const choice = this.visibleChoices()[index];
    if (!choice) return !!this.node;
    this.signals.push(...applyEffects(this.state, choice.effects, this.data));
    return this.goto(choice.next);
  }

  get done(): boolean {
    return this.node === null;
  }
}
