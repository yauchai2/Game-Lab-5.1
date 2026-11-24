#!/usr/bin/env python3
"""
Phase V1：從 4 套 Piloto Studio Roguelike VFX .unitypackage 抽出精選 3D 特效網格與貼圖
用法：
  1) python3 scripts/build_vfx_assets.py --extract
  2) /Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/build_vfx_assets.py -- --pack

產出：
  - game/assets/vfx/vfx_meshes.glb   (28 組精選 3D VFX 網格，歸零原點與標準尺度，~1MB)
  - game/assets/vfx/tex/*.webp       (22 張精選序列幀／法陣／溶解雜訊／漫畫衝擊貼圖，~1MB)
"""
import os
import sys
import tarfile

VFX_SRC_ROOT = "/Users/alanchan/Desktop/Game-Lab/temporary/assets/vfx"
SCRATCH_FBX = "/Users/alanchan/.gemini/antigravity/brain/d4a27fce-e42a-41fb-abaa-1b5374f8adb3/scratch/vfx_fbx"
OUT_DIR = "/Users/alanchan/Desktop/Game-Lab/Game-Lab-5.1/development/lantern-vale/game/assets/vfx"
TEX_OUT = os.path.join(OUT_DIR, "tex")

PACKAGES = {
    "arcanist": os.path.join(VFX_SRC_ROOT, "Roguelike Arcanist VFX Pack", "Arcanist VFX Pack1.0.1.unitypackage"),
    "bluefire": os.path.join(VFX_SRC_ROOT, "Roguelike Blue Fire VFX Kit", "Blue Fire1.0.1.unitypackage"),
    "magic2":   os.path.join(VFX_SRC_ROOT, "Roguelike Magic VFX Kit", "Roguelike Magic VFX Kit2.0.unitypackage"),
    "magic3":   os.path.join(VFX_SRC_ROOT, "Roguelike Magic 3 VFX Kit", "Roguelike Magic 3 VFX Kit1.1.unitypackage"),
}

# (輸出網格名稱, 來源套件, 檔名結尾匹配)
CURATED_MESHES = [
    ("fire_whale",        "magic2",   "vfxm_FireWhale_001.fbx"),
    ("thunder_phoenix",   "magic2",   "vfxm_ThunderPheonix.fbx"),
    ("healing_tree",      "magic2",   "vfxm_HealingTree_001.fbx"),
    ("wolf_head",         "magic2",   "vfxm_MonsterWolf_Head_Chomp.fbx"),
    ("ice_puffer",        "magic2",   "vfxm_IcePuffleFish.fbx"),
    ("dragon_head",       "magic3",   "Dragon_Head_Animation.fbx"),
    ("paladin_sword",     "magic2",   "SM_HeavyHeroSword_A.fbx"),
    ("knight_spear",      "magic2",   "SM_KnightSpear_ColorC.fbx"),
    ("shuriken",          "magic2",   "SM_GiantShuriken_ColorA.fbx"),
    ("arrow",             "magic2",   "SM_Arrow_02.fbx"),
    ("ice_shards",        "magic2",   "IceShards.fbx"),
    ("totem_rage",        "magic2",   "vfxm_Totem_EnragedWarrior.fbx"),
    ("totem_heal",        "magic2",   "vfxm_Totem_WingedSmiley.fbx"),
    ("black_hole",        "arcanist", "BlackHole_Base_Smooth.fbx"),
    ("ring_wind",         "arcanist", "RingWind_Angled.fbx"),
    ("petal",             "arcanist", "vfxm_Petal.fbx"),
    ("tornado",           "bluefire", "Tornado_05.fbx"),
    ("slash_thick",       "bluefire", "Slash_Thick.fbx"),
    ("slash_clean",       "magic3",   "SlashMesh_Clean.fbx"),
    ("ground_crack",      "bluefire", "SM_ Necro_GroundCrack.fbx"),
    ("candle",            "bluefire", "SM_Candle_Gradient_A.fbx"),
    ("magic_missile",     "bluefire", "vfxm_MagicMissile.fbx"),
    ("fire_tower",        "bluefire", "M_Fire_Tower.fbx"),
    ("sphere_flames",     "magic2",   "vfxm_SphereFlames.fbx"),
    ("magic_circle_star", "magic2",   "vfxm_MagicCircle_Star.fbx"),
    ("portal_ring",       "magic2",   "vfxm_Portal_Ring.fbx"),
    ("mana_crystal",      "magic3",   "SM_TowerDefense_Arcane_ManaCrystal.fbx"),
    ("peace_emblem",      "magic3",   "SM_SacredPeaceEmblem_B.fbx"),
]

# (輸出檔名, 來源套件, 檔名結尾匹配, 最大邊長)
CURATED_TEXTURES = [
    ("fire_flipbook.webp",  "magic3",   "FireFlipbook_1.png",                 512),
    ("elec_flipbook.webp",  "arcanist", "T_Electricity_Flipbook_4x2.png",     512),
    ("smoke_flipbook.webp", "bluefire", "T_Smoke_Flipbook_8x8.png",           512),
    ("magic_circle.webp",   "magic2",   "MagicRunicCircle.png",               512),
    ("holy_ring.webp",      "magic3",   "Holy_DecalRing.png",                 512),
    ("mana_runes.webp",     "magic3",   "Mana_Runes_Impact_decal_bright.png", 512),
    ("energy_circle.webp",  "arcanist", "Energy_Circle.png",                  512),
    ("ground_crack.webp",   "magic2",   "GroundCrack_RadialPostExplody.png",  512),
    ("fire_dissolve.webp",  "bluefire", "Fire_dissolve_05.png",               256),
    ("liquid_noise.webp",   "magic3",   "LiquidNoise.png",                    256),
    ("lightning_beam.webp", "magic2",   "LightningBeam_1x8_Rough.png",        512),
    ("hit_punch.webp",      "arcanist", "T_Hit_Punch_Outlined.png",           256),
    ("shock_ring.webp",     "magic2",   "Ring_ShockwaveLiquidy.png",          256),
    ("anime_shock.webp",    "magic3",   "Anime_Shock1.png",                   256),
    ("flare_cross.webp",    "arcanist", "T_Flare_Cross.png",                  256),
    ("flare_glow.webp",     "arcanist", "T_Flare_Glowdot.png",                256),
    ("ghost_trail.webp",    "arcanist", "T_GhostTrail.png",                   256),
    ("arcanist_cards.webp", "arcanist", "T_Arcanist_Cards.png",               512),
    ("arrows_mist.webp",    "magic3",   "Arrows_Rain_Tex_Decal_Mist.png",     256),
    ("flowers.webp",        "magic2",   "Flowers_Rough.png",                  256),
    ("warning_icon.webp",   "magic3",   "IconWarningOutline0.png",            256),
    ("dragon_tex.webp",     "magic3",   "Tex_dragon_BaseColor.png",           256),
]


def extract_all():
    from PIL import Image
    import io

    os.makedirs(SCRATCH_FBX, exist_ok=True)
    os.makedirs(TEX_OUT, exist_ok=True)

    # 依套件分組需求，每個 .unitypackage 只開啟讀取一次
    needed_meshes = {}
    for out_name, pkg, suffix in CURATED_MESHES:
        needed_meshes.setdefault(pkg, []).append((out_name, suffix))
    needed_tex = {}
    for out_name, pkg, suffix, max_sz in CURATED_TEXTURES:
        needed_tex.setdefault(pkg, []).append((out_name, suffix, max_sz))

    mesh_ok, tex_ok = 0, 0
    for pkg_key, pkg_path in PACKAGES.items():
        if pkg_key not in needed_meshes and pkg_key not in needed_tex:
            continue
        print(f"[Extract] Scanning {pkg_key}...")
        with tarfile.open(pkg_path, "r:gz") as tf:
            guid_to_path = {}
            guid_to_member = {}
            for m in tf.getmembers():
                parts = m.name.split("/")
                if len(parts) != 2:
                    continue
                if parts[1] == "pathname":
                    p = tf.extractfile(m).read().decode("utf-8", errors="ignore").strip().splitlines()[0]
                    guid_to_path[parts[0]] = p
                elif parts[1] == "asset":
                    guid_to_member[parts[0]] = m

            path_items = list(guid_to_path.items())
            for out_name, suffix in needed_meshes.get(pkg_key, []):
                hit = next((g for g, p in path_items if p.endswith("/" + suffix) or p == suffix), None)
                if not hit or hit not in guid_to_member:
                    print(f"  [WARN] Mesh not found: {pkg_key}/{suffix}")
                    continue
                data = tf.extractfile(guid_to_member[hit]).read()
                dst = os.path.join(SCRATCH_FBX, f"{out_name}.fbx")
                with open(dst, "wb") as f:
                    f.write(data)
                mesh_ok += 1

            for out_name, suffix, max_sz in needed_tex.get(pkg_key, []):
                hit = next((g for g, p in path_items if p.endswith("/" + suffix) or p == suffix), None)
                if not hit or hit not in guid_to_member:
                    print(f"  [WARN] Texture not found: {pkg_key}/{suffix}")
                    continue
                raw = tf.extractfile(guid_to_member[hit]).read()
                img = Image.open(io.BytesIO(raw)).convert("RGBA")
                if max(img.size) > max_sz:
                    img.thumbnail((max_sz, max_sz), Image.LANCZOS)
                dst = os.path.join(TEX_OUT, out_name)
                img.save(dst, "WEBP", quality=82, method=5)
                tex_ok += 1

    tex_bytes = sum(os.path.getsize(os.path.join(TEX_OUT, f)) for f in os.listdir(TEX_OUT))
    print(f"[Extract] Done! Meshes={mesh_ok}/{len(CURATED_MESHES)}, Textures={tex_ok}/{len(CURATED_TEXTURES)} ({tex_bytes/1024:.0f} KB)")


def pack_glb():
    import bpy
    from mathutils import Vector

    bpy.ops.wm.read_factory_settings(use_empty=True)
    os.makedirs(OUT_DIR, exist_ok=True)
    exported_names = []

    for out_name, _, _ in CURATED_MESHES:
        fbx_path = os.path.join(SCRATCH_FBX, f"{out_name}.fbx")
        if not os.path.exists(fbx_path):
            print(f"  [SKIP] Missing {fbx_path}")
            continue

        before = set(bpy.data.objects)
        try:
            bpy.ops.import_scene.fbx(filepath=fbx_path, use_anim=False)
        except Exception as e:
            print(f"  [ERR] Failed importing {out_name}: {e}")
            continue
        added = [o for o in bpy.data.objects if o not in before]
        meshes = [o for o in added if o.type == "MESH"]
        if not meshes:
            for o in added:
                bpy.data.objects.remove(o, do_unlink=True)
            continue

        # 刪除骨架／空物件，僅保留並合併為單一標準化網格
        non_meshes = [o for o in added if o.type != "MESH"]
        bpy.ops.object.select_all(action="DESELECT")
        for o in meshes:
            o.parent = None
            o.select_set(True)
        bpy.context.view_layer.objects.active = meshes[0]
        if len(meshes) > 1:
            bpy.ops.object.join()
        obj = bpy.context.view_layer.objects.active
        for o in non_meshes:
            bpy.data.objects.remove(o, do_unlink=True)

        # 套用變換並將尺寸歸一化至最大邊長 = 2.0 單位（中心置於原點，方便 Three.js 統一縮放！）
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

        if obj.data and len(obj.data.vertices) > 0:
            coords = [v.co for v in obj.data.vertices]
            min_v = Vector((min(c.x for c in coords), min(c.y for c in coords), min(c.z for c in coords)))
            max_v = Vector((max(c.x for c in coords), max(c.y for c in coords), max(c.z for c in coords)))
            center = (min_v + max_v) * 0.5
            size = max_v - min_v
            max_dim = max(size.x, size.y, size.z, 1e-4)
            inv = 2.0 / max_dim
            for v in obj.data.vertices:
                v.co = (v.co - center) * inv
            obj.data.update()

        # 清除冗餘材質（全部由 src/vfx_shader.js 動態著色，大幅縮減 GLB 體積！）
        obj.data.materials.clear()
        obj.name = out_name
        obj.data.name = out_name
        exported_names.append(out_name)

    glb_out = os.path.join(OUT_DIR, "vfx_meshes.glb")
    bpy.ops.export_scene.gltf(
        filepath=glb_out,
        export_format="GLB",
        export_materials="NONE",
        export_animations=False,
        export_draco_mesh_compression_enable=False,
    )
    sz_kb = os.path.getsize(glb_out) / 1024
    print(f"[Pack] Exported {len(exported_names)} meshes -> {glb_out} ({sz_kb:.1f} KB)")


if __name__ == "__main__":
    if "--extract" in sys.argv:
        extract_all()
    elif "--pack" in sys.argv:
        pack_glb()
    else:
        print("Pass --extract (python3) or --pack (blender --background --python ... -- --pack)")
