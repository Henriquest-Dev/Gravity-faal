#!/usr/bin/env python3
"""Extract the sprite sheets, props, textures and reference scenes embedded in
assets-src/Gravity_Falls_Catalogo_Assets.docx into public/assets/.

The original asset package (PNG sheets with alpha + JSON indexes) was not
available, only the catalogue document. The catalogue embeds every sheet at
full resolution (8 columns x 4 rows), but on a flat beige background and some
of them as JPEG. This script:

  * removes the background (flood fill from the cell borders + tight global
    key for enclosed holes) and binarises alpha so the pixel art stays crisp;
  * slices prop sheets into individual trimmed PNGs with a ground pivot;
  * downsamples the texture sheet (each texture is shown at 4x) to 32x32;
  * measures, per sheet row, the visible bounds and the foot line, so the
    engine can align by the feet instead of the transparent cell;
  * writes public/assets/metadata/manifest.json.

Usage: python3 -I tools/extract_catalog.py assets-src/Gravity_Falls_Catalogo_Assets.docx public/assets
"""
import json
import os
import re
import sys
import zipfile
from collections import deque
from io import BytesIO

from PIL import Image

BG = (227, 222, 203)
FLOOD_TOL = 46      # distance tolerated for background connected to borders
GLOBAL_TOL = 16     # distance tolerated anywhere (enclosed background holes)
DIRS4 = ["south", "west", "east", "north"]

CHAR_SHEETS = [
    # image index, character id, kind, fps, loop
    (4, "bill_child", "walk"), (5, "bill_child", "run"), (6, "bill_child", "ability"),
    (7, "bill", "walk"), (8, "bill", "run"), (9, "bill", "ability"),
    (10, "dipper", "walk"), (11, "dipper", "run"), (12, "dipper", "ability"),
    (13, "mabel", "walk"), (14, "mabel", "run"), (15, "mabel", "ability"),
    (16, "stan", "walk"), (17, "stan", "run"),
    (18, "soos", "walk"), (19, "soos", "run"),
    (20, "wendy", "walk"), (21, "wendy", "run"),
    (22, "pacifica", "walk"), (23, "pacifica", "run"),
    (24, "mcgucket", "walk"), (25, "mcgucket", "run"),
    (26, "ford", "walk"), (27, "ford", "run"),
    (28, "felicia", "walk"), (29, "felicia", "run"),
]
KIND_TIMING = {"walk": (9, True), "run": (12, True), "ability": (14, False)}

GROUP_SHEETS = [
    # image, id, cell, rows, rowKind, fps, loop, perspective note
    (45, "bola8_move", 192, ["south", "west", "east", "north"], "directions", 8, True, None),
    (46, "bola8_attack", 192, ["south", "west", "east", "north"], "directions", 12, False, None),
    (47, "dimensional_presence", 192, ["pyronica", "hectorgon", "keyhole", "teeth"], "characters", 8, True, "south"),
    (48, "dimensional_ability", 192, ["pyronica", "hectorgon", "keyhole", "teeth"], "characters", 12, False, "south"),
    (49, "time_baby", 256, ["idle", "levitate", "time_power", "recover"], "states", 8, None, "south"),
    (50, "time_agents", 128, ["blendin", "lolph", "dundgren", "cyclock"], "characters", 8, True, "mixed"),
    (51, "euclydia_adults", 128, ["professor_circle", "artisan_triangle", "merchant_square", "elder_hexagon"], "characters", 6, True, "south"),
    (52, "effects", 128, ["rift", "stasis", "run_dust", "impact"], "effects", 16, False, None),
    (53, "cast_a", 128, ["stan", "soos", "wendy", "mcgucket"], "characters", 6, True, "south"),
    (54, "cast_b", 128, ["ford", "pacifica", "felicia", "waddles"], "characters", 6, True, "south"),
    (55, "protag_idle", 128, ["bill_child", "bill", "dipper", "mabel"], "characters", 6, True, "south"),
    (56, "protag_hurt", 128, ["bill_child", "bill", "dipper", "mabel"], "characters", 14, False, "south"),
    (57, "protag_jump", 128, ["bill_child", "bill", "dipper", "mabel"], "characters", 14, False, "south"),
    (58, "protag_dodge", 128, ["bill_child", "bill", "dipper", "mabel"], "characters", 18, False, "south"),
    (59, "protag_climb", 128, ["bill_child", "bill", "dipper", "mabel"], "characters", 8, True, "north"),
    (60, "protag_swim", 128, ["bill_child", "bill", "dipper", "mabel"], "characters", 8, True, "east"),
]
TIME_BABY_LOOP = {"idle": True, "levitate": True, "time_power": False, "recover": False}

PROP_SETS = [
    (61, "nature", ["pine", "pine_b", "autumn_tree", "dead_tree", "bush", "fern", "rock", "rock_b",
                    "stump", "log", "mushrooms", "flower", "cattails", "fence", "gate", "signpost",
                    "mailbox", "bench", "bridge_arch", "dock", "cabin", "woodshed", "cave_entrance", "lamp_post"]),
    (62, "interiors", ["desk", "bookshelf", "display_case", "armchair", "round_table", "chair", "bed", "sofa",
                       "rug", "stairs", "trapdoor", "door", "control_console", "lab_table", "generator",
                       "portal_model", "crate", "barrel", "wrecked_car", "scrap_pile", "toolbox", "gear",
                       "floor_lamp", "cash_register"]),
    (63, "euclydia", ["a_frame_house", "hex_house", "dome_house", "observatory", "vine_arch", "stone_door",
                      "round_tree", "planter", "fountain", "obelisk", "lamp", "bench", "tri_bed", "table",
                      "chair", "bookshelf", "plush", "rug", "grass_path", "cobble_patch", "stairs",
                      "rope_bridge", "crystal_cluster", "portal_ring"]),
    (64, "rifts", ["square_platform", "triangle_platform", "broken_piece_a", "broken_piece_b", "ruined_arch",
                   "rune_door", "blue_crystal", "holed_monolith", "rune_obelisk", "rope_bridge", "spiral_stone",
                   "mirror", "floating_rock", "pink_crystal", "stairs", "pillar", "ground_rift", "void_portal",
                   "chains", "eye_sigil", "lantern", "sigil_plate", "gold_plaque", "ring"]),
    (65, "temporal", ["clock_tower", "hourglass_frame", "time_gate", "time_console", "time_capsule", "cell_door",
                      "hover_platform", "time_bridge", "railing", "pad", "tape_measure", "time_bottle",
                      "time_cube", "throne", "archive_shelf", "doorway", "barrier", "lamp", "checkpoint_booth",
                      "elevator", "capsule", "gear", "wheel", "terminal"]),
]
TEXTURES = ["grass", "dirt", "sand", "cobble_moss", "sand_light", "water", "wood_floor", "stone_beige",
            "rock_dark", "metal_plate", "metal_teal", "brick", "euclid_peach", "euclid_lavender",
            "euclid_mint", "euclid_gold", "stone_cracked", "void", "nightmare_cracked", "rune_floor",
            "dirt_dark", "leaves_green", "leaves_autumn", "grass_dark"]

ENVIRONMENTS = [
    (30, "euclydia_plaza", 1), (31, "bill_house", 1), (32, "observatory", 1), (33, "euclydia_rupture", 1),
    (34, "nightmare_realm", 1), (1, "shack_exterior", 2), (35, "town_center", 2), (36, "shack_interior", 2),
    (37, "forest_lake_cave", 2), (38, "portal_bunker", 2), (39, "mcgucket_workshop", 2),
    (40, "town_invaded", 2), (41, "time_city", 2), (42, "time_baby_arena", 2), (43, "time_archive", 2),
    (44, "timeline_crossing", 2),
]
REFERENCES = [(2, "video_frame_cabin"), (3, "video_frame_depth")]


def dist2(a, b):
    return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2


def key_background(img):
    """Return RGBA image with background removed (binary alpha)."""
    img = img.convert("RGB")
    w, h = img.size
    px = img.load()
    flood = FLOOD_TOL ** 2
    tight = GLOBAL_TOL ** 2
    transparent = bytearray(w * h)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            q.append((x, y))
    while q:
        x, y = q.popleft()
        i = y * w + x
        if transparent[i]:
            continue
        if dist2(px[x, y], BG) > flood:
            continue
        transparent[i] = 1
        if x > 0: q.append((x - 1, y))
        if x < w - 1: q.append((x + 1, y))
        if y > 0: q.append((x, y - 1))
        if y < h - 1: q.append((x, y + 1))
    for y in range(h):
        for x in range(w):
            i = y * w + x
            if not transparent[i] and dist2(px[x, y], BG) <= tight:
                transparent[i] = 1
    out = Image.new("RGBA", (w, h))
    op = out.load()
    for y in range(h):
        for x in range(w):
            if transparent[y * w + x]:
                op[x, y] = (0, 0, 0, 0)
            else:
                r, g, b = px[x, y]
                op[x, y] = (r, g, b, 255)
    # remove isolated single pixels left by JPEG noise
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            if op[x, y][3] and not any(op[x + dx, y + dy][3] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                op[x, y] = (0, 0, 0, 0)
    return out


def downsample_mode(img, f):
    """Integer downscale keeping pixel art crisp: each fxf block takes its most
    common opaque colour, or stays transparent when mostly empty."""
    w, h = (img.width + f - 1) // f, (img.height + f - 1) // f
    src = img.load()
    out = Image.new("RGBA", (w, h))
    op = out.load()
    for y in range(h):
        for x in range(w):
            counts = {}
            total = 0
            opaque = 0
            for dy in range(f):
                for dx in range(f):
                    sx, sy = x * f + dx, y * f + dy
                    if sx >= img.width or sy >= img.height:
                        continue
                    total += 1
                    p = src[sx, sy]
                    if p[3]:
                        opaque += 1
                        counts[p] = counts.get(p, 0) + 1
            if opaque * 2 >= total and counts:
                op[x, y] = max(counts.items(), key=lambda kv: kv[1])[0]
    return out


def bbox(img, box=None):
    region = img.crop(box) if box else img
    bb = region.getchannel("A").getbbox()
    if bb and box:
        bb = (bb[0] + box[0], bb[1] + box[1], bb[2] + box[0], bb[3] + box[1])
    return bb


def row_metrics(sheet, cell, cols=8, rows=4):
    """Visible bounds per row (relative to the cell) and the foot line."""
    result = []
    for r in range(rows):
        union = None
        feet = []
        centers = []
        for c in range(cols):
            box = (c * cell, r * cell, (c + 1) * cell, (r + 1) * cell)
            bb = bbox(sheet, box)
            if not bb:
                continue
            rel = (bb[0] - box[0], bb[1] - box[1], bb[2] - box[0], bb[3] - box[1])
            union = rel if union is None else (min(union[0], rel[0]), min(union[1], rel[1]),
                                               max(union[2], rel[2]), max(union[3], rel[3]))
            feet.append(rel[3])
            centers.append((rel[0] + rel[2]) / 2)
        if union is None:
            result.append(None)
            continue
        feet.sort()
        foot = feet[len(feet) // 2]  # median: robust against a raised frame
        cx = sorted(centers)[len(centers) // 2]
        result.append({
            "visible": {"x": union[0], "y": union[1], "w": union[2] - union[0], "h": union[3] - union[1]},
            "pivot": {"x": round(cx), "y": foot},
        })
    return result


def main():
    docx, out = sys.argv[1], sys.argv[2]
    z = zipfile.ZipFile(docx)

    def load(n):
        names = [f for f in z.namelist() if re.fullmatch(rf"word/media/image{n}\.(png|jpg|jpeg)", f)]
        if not names:
            raise SystemExit(f"missing image{n} in catalogue")
        data = z.read(names[0])
        return Image.open(BytesIO(data)), names[0]

    def save(img, rel):
        path = os.path.join(out, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        img.save(path, optimize=True)
        return rel

    manifest = {
        "version": 1,
        "generatedBy": "tools/extract_catalog.py",
        "source": "assets-src/Gravity_Falls_Catalogo_Assets.docx",
        "notes": [
            "The original package (PNG + JSON indexes) was not provided; sheets were recovered from the catalogue.",
            "Background removed by colour key; alpha is binary. JPEG-derived sheets may show slight edge noise.",
            "Individual sheets: 8 columns x 4 rows, rows = south, west, east, north.",
            "Collective sheets: each row is a character, state or effect (see rowKind).",
            "Props were normalised to ~112px in the catalogue; @2/@3 variants (mode downsampling) restore a coherent world scale, chosen per prop in src/data/props.json.",
        ],
        "characters": {},
        "sheets": {},
        "props": {},
        "textures": {},
        "environments": {},
        "references": {},
        "generated": [],
    }

    for n, cid, kind in CHAR_SHEETS:
        img, src = load(n)
        sheet = key_background(img)
        rel = save(sheet, f"characters/{cid}/{kind}.png")
        fps, loop = KIND_TIMING[kind]
        manifest["characters"].setdefault(cid, {})[kind] = {
            "file": rel, "source": src, "cell": 128, "cols": 8, "rows": 4, "rowKind": "directions",
            "rowNames": DIRS4, "fps": fps, "loop": loop, "status": "final-from-catalogue",
            "metrics": row_metrics(sheet, 128),
        }
        print("char", cid, kind)

    for n, sid, cell, rows, row_kind, fps, loop, perspective in GROUP_SHEETS:
        img, src = load(n)
        sheet = key_background(img)
        rel = save(sheet, f"animations/{sid}.png")
        entry = {
            "file": rel, "source": src, "cell": cell, "cols": 8, "rows": 4, "rowKind": row_kind,
            "rowNames": rows, "fps": fps, "loop": loop, "perspective": perspective,
            "status": "final-from-catalogue", "metrics": row_metrics(sheet, cell),
        }
        if sid == "time_baby":
            entry["loopByRow"] = TIME_BABY_LOOP
            entry["sceneScale"] = 1
        manifest["sheets"][sid] = entry
        print("sheet", sid)

    for n, set_id, names in PROP_SETS:
        img, src = load(n)
        sheet = key_background(img)
        cw, ch = 128, 136
        for i, name in enumerate(names):
            c, r = i % 6, i // 6
            # the bottom 16px of every cell hold the catalogue index label
            box = (c * cw, r * ch, (c + 1) * cw, r * ch + 120)
            bb = bbox(sheet, box)
            if not bb:
                raise SystemExit(f"empty prop {set_id}/{name}")
            piece = sheet.crop(bb)
            rel = save(piece, f"props/{set_id}/{name}.png")
            variants = {}
            for f in (2, 3):
                small = downsample_mode(piece, f)
                variants[str(f)] = {"file": save(small, f"props/{set_id}/{name}@{f}.png"), "w": small.width, "h": small.height}
            manifest["props"][f"{set_id}/{name}"] = {
                "file": rel, "source": src, "w": piece.width, "h": piece.height,
                "pivot": {"x": piece.width // 2, "y": piece.height}, "status": "final-from-catalogue",
                "variants": variants,
            }
        print("props", set_id)

    img, src = load(66)
    img = img.convert("RGB")
    for i, name in enumerate(TEXTURES):
        c, r = i % 6, i // 6
        tile = img.crop((c * 128, r * 128, (c + 1) * 128, (r + 1) * 128))
        # each texture pixel occupies a 4x4 block: sample block centres
        small = Image.new("RGB", (32, 32))
        tp = tile.load()
        sp = small.load()
        for y in range(32):
            for x in range(32):
                sp[x, y] = tp[x * 4 + 2, y * 4 + 2]
        rel = save(small, f"textures/{name}.png")
        manifest["textures"][name] = {"file": rel, "source": src, "size": 32, "status": "final-from-catalogue"}
    print("textures")

    for n, eid, arc in ENVIRONMENTS:
        img, src = load(n)
        rel = save(img.convert("RGB"), f"environments/{eid}.png")
        manifest["environments"][eid] = {
            "file": rel, "source": src, "arc": arc, "role": "composition-reference-only",
            "w": img.width, "h": img.height,
        }
    for n, rid in REFERENCES:
        img, src = load(n)
        rel = save(img.convert("RGB"), f"reference/{rid}.png")
        manifest["references"][rid] = {"file": rel, "source": src}
    print("environments")

    frames = sum(32 for _ in CHAR_SHEETS) + sum(32 for _ in GROUP_SHEETS)
    manifest["counts"] = {
        "frames": frames, "sheets": len(CHAR_SHEETS) + len(GROUP_SHEETS),
        "environments": len(ENVIRONMENTS), "props": sum(len(p[2]) for p in PROP_SETS), "textures": len(TEXTURES),
    }
    os.makedirs(os.path.join(out, "metadata"), exist_ok=True)
    with open(os.path.join(out, "metadata", "manifest.json"), "w", encoding="utf8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)
    print("counts", manifest["counts"])


if __name__ == "__main__":
    main()
