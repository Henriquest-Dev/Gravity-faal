import { check } from '../src/core/conditions';
import { DialogueRunner } from '../src/core/dialogue';
import { applyEffects, updateQuests, type Signal } from '../src/core/rules';
import { addItem, objKey, record, type GameState } from '../src/core/state';
import type { InteractableDef } from '../src/core/types';
import { DIALOGUES, MAPS, RULES } from '../src/game/data';

/**
 * Data-level replica of what the world does when the player uses things. It
 * asserts each requirement holds at that moment, so a scripted playthrough
 * fails if the intended order is impossible.
 */
export class Sim {
  signals: Signal[] = [];
  constructor(public s: GameState) {}

  private obj(mapId: string, id: string): InteractableDef {
    const o = MAPS[mapId].interactables?.find((i) => i.id === id);
    if (!o) throw new Error(`no interactable ${mapId}/${id}`);
    return o;
  }

  enter(mapId: string): this {
    this.s.mapId = mapId;
    if (!this.s.visited.includes(mapId)) this.s.visited.push(mapId);
    this.fx(MAPS[mapId].onEnter);
    return this;
  }

  private fx(effects: InteractableDef['effects']): void {
    const fresh = applyEffects(this.s, effects, RULES, this.s.mapId);
    this.signals.push(...fresh);
    for (const sg of fresh) if (sg.type === 'teleport') this.enter(sg.map);
  }

  use(id: string, mapId = this.s.mapId): this {
    const o = this.obj(mapId, id);
    if (!check(o.if, this.s, mapId)) throw new Error(`${id} does not exist now`);
    if (o.character && this.s.character !== o.character) throw new Error(`${id} needs ${o.character}`);
    if (!['examine', 'grapple', 'npcProxy'].includes(o.kind) && !check(o.requires, this.s, mapId)) throw new Error(`${mapId}/${id}: requirement not met: ${JSON.stringify(o.requires)}`);
    const key = objKey(mapId, id);
    switch (o.kind) {
      case 'pickup': case 'chest':
        this.s.objects[key] = o.kind === 'pickup' ? 'taken' : 'open';
        if (o.item) addItem(this.s, o.item);
        this.fx(o.effects);
        break;
      case 'door': this.s.objects[key] = 'open'; this.fx(o.effects); break;
      case 'repair': this.s.objects[key] = 'fixed'; record(this.s, 'repaired', id); this.fx(o.effects); break;
      case 'portal': record(this.s, 'portals', id); this.fx(o.effects); break;
      case 'rift': this.s.objects[key] = 'open'; record(this.s, 'portals', `rift:${id}`); break;
      case 'glyph': this.s.objects[key] = 'active'; this.fx(o.effects); break;
      case 'examine': this.s.flags[`revealed:${key}`] = true; this.s.objects[key] = 'read'; this.fx(o.effects); break;
      case 'switch': this.s.objects[key] = 'on'; this.fx(o.effects); break;
      case 'npcProxy': this.talk(o.text!); return this;
      default: break;
    }
    this.signals.push(...updateQuests(this.s, RULES));
    return this;
  }

  /** Marks a puzzle group solved the way the world does (all members correct). */
  solve(group: string, mapId = this.s.mapId): this {
    this.s.flags[`${group}_solved`] = true;
    const owner = MAPS[mapId].interactables?.find((i) => i.group === group && i.onSolve);
    this.fx(owner?.onSolve);
    this.signals.push(...updateQuests(this.s, RULES));
    return this;
  }

  /** Runs a dialogue picking choices by the start of their text (or index). */
  talk(id: string, ...picks: (string | number)[]): this {
    const r = new DialogueRunner(DIALOGUES[id], this.s, RULES);
    if (!r.start()) throw new Error(`dialogue ${id} has no entry for this state`);
    let guard = 0;
    while (!r.done && guard++ < 50) {
      const choices = r.visibleChoices();
      if (choices.length) {
        const p = picks.shift();
        if (p === undefined) throw new Error(`dialogue ${id}: choice needed at ${r.node?.id}: ${choices.map((c) => c.text).join(' | ')}`);
        const idx = typeof p === 'number' ? p : choices.findIndex((c) => c.text.startsWith(p));
        if (idx < 0) throw new Error(`dialogue ${id}: no choice "${p}" at ${r.node?.id}`);
        r.choose(idx);
      } else r.advance();
    }
    this.fx([]);
    for (const sg of r.signals) if (sg.type === 'teleport') this.enter(sg.map);
    this.signals.push(...r.signals, ...updateQuests(this.s, RULES));
    return this;
  }

  defeat(enemyId: string): this {
    if (!this.s.defeated.includes(enemyId)) this.s.defeated.push(enemyId);
    this.signals.push(...updateQuests(this.s, RULES));
    return this;
  }

  as(character: string): this {
    this.s.character = character;
    return this;
  }

  quest(id: string) {
    return this.s.quests[id]?.state ?? 'inactive';
  }
}
