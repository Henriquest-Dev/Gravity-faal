import type { GameState } from './state';
import type { Condition } from './types';

/** Evaluate a data-driven condition. `mapId` scopes object lookups without a "/". */
export function check(cond: Condition | undefined, s: GameState, mapId = s.mapId): boolean {
  if (!cond) return true;
  if ('all' in cond) return cond.all.every((c) => check(c, s, mapId));
  if ('any' in cond) return cond.any.some((c) => check(c, s, mapId));
  if ('not' in cond) return !check(cond.not, s, mapId);
  if ('flag' in cond) return !!s.flags[cond.flag];
  if ('var' in cond) {
    const v = s.vars[cond.var] ?? 0;
    if (cond.gte !== undefined && !(v >= cond.gte)) return false;
    if (cond.lte !== undefined && !(v <= cond.lte)) return false;
    if (cond.gt !== undefined && !(v > cond.gt)) return false;
    if (cond.lt !== undefined && !(v < cond.lt)) return false;
    return true;
  }
  if ('item' in cond) return (s.inventory[cond.item] ?? 0) >= (cond.count ?? 1);
  if ('quest' in cond) {
    const q = s.quests[cond.quest];
    const state = q?.state ?? 'inactive';
    const states = Array.isArray(cond.state) ? cond.state : [cond.state];
    if (!states.includes(state)) return false;
    return true;
  }
  if ('ability' in cond) return s.abilities.includes(cond.ability);
  if ('arc1' in cond) {
    const list = Array.isArray(cond.arc1) ? cond.arc1 : [cond.arc1];
    return s.arc1Ending !== null && list.includes(s.arc1Ending);
  }
  if ('arc' in cond) return s.arc === cond.arc;
  if ('character' in cond) return s.character === cond.character;
  if ('event' in cond) {
    const list = s.events[cond.event] ?? [];
    if (cond.value !== undefined) return list.includes(cond.value);
    return list.length >= (cond.countGte ?? 1);
  }
  if ('object' in cond) {
    const key = cond.object.includes('/') ? cond.object : `${mapId}/${cond.object}`;
    return (s.objects[key] ?? 'initial') === cond.state;
  }
  if ('npc' in cond) return (s.npcs[cond.npc] ?? 'initial') === cond.state;
  if ('defeated' in cond) return s.defeated.includes(cond.defeated);
  if ('visited' in cond) return s.visited.includes(cond.visited);
  throw new Error(`Unknown condition ${JSON.stringify(cond)}`);
}
