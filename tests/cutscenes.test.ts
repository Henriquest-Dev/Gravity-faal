import { describe, expect, it } from 'vitest';
import type { CutsceneStep } from '../src/core/types';
import { CHARACTERS, CUTSCENES, DIALOGUES, MAPS, QUESTS } from '../src/game/data';

/** Every `{ cutscene: id }` effect anywhere in the data. */
function referencedCutscenes(): string[] {
  const out: string[] = [];
  const walk = (o: unknown) => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) { o.forEach(walk); return; }
    const r = o as Record<string, unknown>;
    if (typeof r.cutscene === 'string') out.push(r.cutscene);
    for (const v of Object.values(r)) walk(v);
  };
  walk(MAPS);
  walk(DIALOGUES);
  walk(QUESTS);
  return out;
}

describe('cutscenes', () => {
  it('every referenced cutscene exists', () => {
    for (const id of referencedCutscenes()) expect(CUTSCENES[id], id).toBeDefined();
  });

  it('every cutscene is referenced somewhere', () => {
    const used = new Set(referencedCutscenes());
    for (const id of Object.keys(CUTSCENES)) expect(used.has(id), id).toBe(true);
  });

  it('steps name real dialogues, characters and well-formed coordinates', () => {
    for (const cs of Object.values(CUTSCENES)) {
      const spawned = new Set<string>();
      for (const st of cs.steps as CutsceneStep[]) {
        const where = `${cs.id}: ${JSON.stringify(st).slice(0, 60)}`;
        if ('dialogue' in st) expect(DIALOGUES[st.dialogue], where).toBeDefined();
        if ('spawn' in st) {
          expect(CHARACTERS[st.char], where).toBeDefined();
          spawned.add(st.spawn);
        }
        if ('say' in st && st.say) expect(CHARACTERS[st.say], where).toBeDefined();
        for (const key of ['move', 'face', 'anim', 'alpha', 'remove'] as const) {
          const ref = (st as Record<string, unknown>)[key];
          if (typeof ref === 'string') {
            const ok = spawned.has(ref) || ref === 'player' || ref === 'companion' || ref.startsWith('npc:');
            expect(ok, where).toBe(true);
          }
        }
        if ('camera' in st && Array.isArray(st.camera)) expect(st.camera.every((n) => Number.isFinite(n)), where).toBe(true);
      }
    }
  });

  it('npc references point at NPCs of a map where the cutscene plays', () => {
    const owners: Record<string, string[]> = {};
    for (const m of Object.values(MAPS)) {
      const walk = (o: unknown) => {
        if (!o || typeof o !== 'object') return;
        if (Array.isArray(o)) { o.forEach(walk); return; }
        const r = o as Record<string, unknown>;
        if (typeof r.cutscene === 'string') (owners[r.cutscene] ??= []).push(m.id);
        for (const v of Object.values(r)) walk(v);
      };
      walk(m);
    }
    for (const cs of Object.values(CUTSCENES)) {
      for (const st of cs.steps) {
        for (const v of Object.values(st)) {
          if (typeof v !== 'string' || !v.startsWith('npc:')) continue;
          const id = v.slice(4);
          const maps = owners[cs.id] ?? [];
          expect(maps.some((m) => MAPS[m].npcs?.some((n) => n.id === id)), `${cs.id} ${v}`).toBe(true);
        }
      }
    }
  });
});
