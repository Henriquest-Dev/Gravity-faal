// Regenerates src/data/maps/*.json from the authoring scripts in tools/maps/.
// Usage: node tools/build-maps.mjs [mapId...]
import { readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'src', 'data', 'maps');
mkdirSync(outDir, { recursive: true });
const only = process.argv.slice(2);
// Decoration never covers gameplay points: drop scattered props near interactables, NPCs, spawns and exits.
const DECOR = /nature\/(fern|flower|mushrooms|cattails|bush)|nature\/pine|nature\/pine_b|nature\/autumn_tree|nature\/dead_tree/;
function declutter(map) {
  const points = [
    ...(map.interactables ?? []).map((o) => [o.x, o.y, 1.6]),
    ...(map.npcs ?? []).map((o) => [o.x, o.y, 1.6]),
    ...(map.enemies ?? []).map((o) => [o.x, o.y, 1.4]),
    ...Object.values(map.spawns).map((o) => [o.x, o.y, 1.6]),
    ...map.exits.map((e) => [e.x + e.w / 2, e.y + e.h / 2, Math.max(e.w, e.h) / 2 + 1]),
  ];
  map.props = (map.props ?? []).filter((p) => {
    if (p.id || p.layer === 'foreground' || !DECOR.test(p.prop)) return true;
    return !points.some(([x, y, r]) => Math.hypot(p.x - x, p.y - y) < r);
  });
}
const round = (v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v);

for (const f of readdirSync(join(here, 'maps')).filter((f) => f.endsWith('.mjs') && f !== 'lib.mjs' && !f.endsWith('_layout.mjs')).sort()) {
  const id = f.replace('.mjs', '');
  if (only.length && !only.includes(id)) continue;
  const mod = await import(pathToFileURL(join(here, 'maps', f)).href);
  const map = mod.default();
  declutter(map);
  if (map.id !== id) throw new Error(`${f}: id mismatch ${map.id}`);
  if (map.terrain.length !== map.height || map.terrain.some((r) => r.length !== map.width)) throw new Error(`${id}: terrain size mismatch`);
  // terrain rows on one line each keeps the JSON readable and hand-editable
  const { terrain, ...rest } = map;
  let json = JSON.stringify({ ...rest, terrain: ['@@TERRAIN@@'] }, (k, v) => round(v), 1);
  json = json.replace('"@@TERRAIN@@"', terrain.map((r) => JSON.stringify(r)).join(',\n  '));
  writeFileSync(join(outDir, `${id}.json`), json + '\n');
  console.log('map', id, `${map.width}x${map.height}`);
}
