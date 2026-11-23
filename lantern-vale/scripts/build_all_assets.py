#!/usr/bin/env python3
"""
全 12 張野外地圖（v6 資產對齊版）3D 低面地標與生態怪物自動化 GLB 轉檔管線
- 色板圖（Palette PNG）保持原始解析度避免相鄰色格縮放混色
- 怪物 PSD 貼圖使用 macOS sips 轉為 256px 輕量 PNG（契合 270p Pixel-Toon）
"""
import os
import sys
import tarfile
import tempfile
import subprocess
from pathlib import Path

BLENDER = "/Applications/Blender.app/Contents/MacOS/blender"
ASSETS_ROOT = Path("/Users/alanchan/Desktop/Game-Lab/temporary/assets")
GAME_ASSETS = Path(__file__).resolve().parent.parent / "game" / "assets"

PKGS = {
    "4137": ASSETS_ROOT / "scenes02/4137_梦幻村庄资产包/Fantasy Village Pack 1.3.unitypackage",
    "4379": ASSETS_ROOT / "scenes02/4379_低面小岛场景包/Low Poly Floating Islands 1.0.unitypackage",
    "4130": ASSETS_ROOT / "scenes02/4130_低面洞穴矿洞场景/Ultimate Low Poly Mining Cave Blacksmith Pack - Ores Gems Props Tools v2.0.1.unitypackage",
    "4167": ASSETS_ROOT / "scenes02/4167_低面自然地貌集合/Low Poly Rocks Pack.unitypackage",
    "4356": ASSETS_ROOT / "monster/4356_可爱卡通怪物包/Monsters Ultimate Pack 04 Cute Series v1.0.unitypackage",
    "4117": ASSETS_ROOT / "monster/4117_低面怪物角色资产/RPG Monster Wave 2 Polyart 1.1.unitypackage",
}

T_VILLAGE = "Assets/Tarbo-FantasyVillage/Textures/Village_Base.png"
T_VILLAGE_A = "Assets/Tarbo-FantasyVillage/Textures/Village_ColorA.png"
T_VILLAGE_B = "Assets/Tarbo-FantasyVillage/Textures/Village_ColorB.png"
T_VILLAGE_SNOW = "Assets/Tarbo-FantasyVillage/Textures/Village_Base_Snow.png"
T_VILLAGE_AUTUMN = "Assets/Tarbo-FantasyVillage/Textures/Village_Autumn.png"
T_ISLAND = "Assets/Low Poly Floating Islands/Textures/Lowpoly_Flaoting_Islands_PortTexture.png"
T_MINING = "Assets/PurePoly/Mining_Pack/Textures/PP_Color_Palette.png"
T_POLYART = "Assets/RPGMonsterWave02Polyart/Textures/PolyartDefaultTex.png"

JOBS = [
    # ---- Batch 1 Landmarks (#01, #04, #07 + Shared) ----
    dict(out="landmarks/windmill.glb",        pkg="4137", mesh="Assets/Tarbo-FantasyVillage/Meshes/Buildings/TB_Bd_Tower.FBX",      tex=T_VILLAGE,        keep_res=True, target_h=9.6),
    dict(out="landmarks/windmill_blades.glb", pkg="4137", mesh="Assets/Tarbo-FantasyVillage/Meshes/Buildings/TB_Bd_Windmill.FBX",   tex=T_VILLAGE,        keep_res=True, target_h=7.4, rot_x_deg=90.0, center_pivot=True),
    dict(out="landmarks/cottage.glb",         pkg="4137", mesh="Assets/Tarbo-FantasyVillage/Meshes/Buildings/TB_Bd_House.FBX",      tex=T_VILLAGE,        keep_res=True, target_h=5.2),
    dict(out="landmarks/stonehenge.glb",      pkg="4167", mesh="Assets/Low Poly Rocks Pack/Rock Assets/Meshes/1 Color/Stonehenge_Rocks/FBX/Stonehenge_01.fbx", tex=None, flat_color=(0.76, 0.74, 0.69, 1.0), target_h=5.2),
    dict(out="landmarks/snow_house.glb",      pkg="4137", mesh="Assets/Tarbo-FantasyVillage/Meshes/Buildings/TB_Bd_SWHouse.FBX",    tex=T_VILLAGE_SNOW,   keep_res=True, target_h=5.4),
    dict(out="landmarks/snow_tower.glb",      pkg="4137", mesh="Assets/Tarbo-FantasyVillage/Meshes/Buildings/TB_Bd_WatchTower.FBX", tex=T_VILLAGE_SNOW,   keep_res=True, target_h=8.8),
    dict(out="landmarks/ice_crystal.glb",     pkg="4130", mesh="Assets/PurePoly/Mining_Pack/Meshes/PP_Crystal_01_Blue.fbx",         tex=T_MINING,         keep_res=True, target_h=6.8),
    dict(out="landmarks/cave_arch.glb",       pkg="4130", mesh="Assets/PurePoly/Mining_Pack/Meshes/PP_Cave_Small_01.fbx",           tex=T_MINING,         keep_res=True, target_h=6.5),
    dict(out="landmarks/lighthouse.glb",      pkg="4379", mesh="Assets/Low Poly Floating Islands/Models/LPFI_PortLand/Light House.fbx", tex=T_ISLAND,     keep_res=True, target_h=12.0),
    dict(out="landmarks/island_house.glb",    pkg="4379", mesh="Assets/Low Poly Floating Islands/Models/LPFI_PortLand/House.fbx",   tex=T_ISLAND,         keep_res=True, target_h=5.0),

    # ---- Batch 2 Landmarks (#02, #03, #05, #06, #08, #09, #10, #11, #12) ----
    dict(out="landmarks/torii_gate.glb",      pkg="4379", mesh="Assets/Low Poly Floating Islands/Models/LPFL_PondLand/Gate.fbx",            tex=T_ISLAND, keep_res=True, target_h=6.8),
    dict(out="landmarks/sakura_tree.glb",     pkg="4379", mesh="Assets/Low Poly Floating Islands/Models/LPFL_PondLand/Tree_1.fbx",          tex=T_ISLAND, keep_res=True, target_h=7.8),
    dict(out="landmarks/beach_house.glb",     pkg="4379", mesh="Assets/Low Poly Floating Islands/Models/LPFL_BeachLand/House.fbx",          tex=T_ISLAND, keep_res=True, target_h=6.2),
    dict(out="landmarks/coconut_tree.glb",    pkg="4379", mesh="Assets/Low Poly Floating Islands/Models/LPFL_BeachLand/Coconut Tree_1.fbx", tex=T_ISLAND, keep_res=True, target_h=7.2),
    dict(out="landmarks/pirate_boat.glb",     pkg="4379", mesh="Assets/Low Poly Floating Islands/Models/LPFL_PirateCave/Boat.fbx",          tex=T_ISLAND, keep_res=True, target_h=4.6),
    dict(out="landmarks/forest_cabin.glb",    pkg="4379", mesh="Assets/Low Poly Floating Islands/Models/LPFL_ForestLand/House.fbx",         tex=T_ISLAND, keep_res=True, target_h=5.8),
    dict(out="landmarks/mine_cart.glb",       pkg="4130", mesh="Assets/PurePoly/Mining_Pack/Meshes/PP_Mine_Cart_01.fbx",                    tex=T_MINING, keep_res=True, target_h=2.4),
    dict(out="landmarks/forge_furnace.glb",   pkg="4130", mesh="Assets/PurePoly/Mining_Pack/Meshes/PP_Furnace_01.fbx",                      tex=T_MINING, keep_res=True, target_h=5.6),
    dict(out="landmarks/red_crystal.glb",     pkg="4130", mesh="Assets/PurePoly/Mining_Pack/Meshes/PP_Crystal_01_Red.fbx",                  tex=T_MINING, keep_res=True, target_h=6.4),
    dict(out="landmarks/giant_shroom.glb",    pkg="4130", mesh="Assets/PurePoly/Mining_Pack/Meshes/PP_Mushrooms_Brown_01.fbx",              tex=T_MINING, keep_res=True, target_h=4.4),
    dict(out="landmarks/blacksmith.glb",      pkg="4137", mesh="Assets/Tarbo-FantasyVillage/Meshes/Buildings/TB_Bd_Blacksmith.FBX",         tex=T_VILLAGE_AUTUMN, keep_res=True, target_h=6.4),

    # ---- Phase 3A Town & Harbor Landmarks (4137 Fantasy Village) ----
    dict(out="landmarks/bell_tower.glb",      pkg="4137", mesh="Assets/Tarbo-FantasyVillage/Meshes/Buildings/TB_Bd_BellTower.FBX",          tex=T_VILLAGE,   keep_res=True, target_h=8.6),
    dict(out="landmarks/town_well.glb",       pkg="4137", mesh="Assets/Tarbo-FantasyVillage/Meshes/Buildings/TB_Bd_Well.FBX",               tex=T_VILLAGE,   keep_res=True, target_h=3.0),
    dict(out="landmarks/fishing_hut.glb",     pkg="4137", mesh="Assets/Tarbo-FantasyVillage/Meshes/Buildings/TB_Bd_Fishing.FBX",            tex=T_VILLAGE,   keep_res=True, target_h=4.8),
    dict(out="landmarks/town_blacksmith.glb", pkg="4137", mesh="Assets/Tarbo-FantasyVillage/Meshes/Buildings/TB_Bd_Blacksmith.FBX",         tex=T_VILLAGE,   keep_res=True, target_h=5.8),
    dict(out="landmarks/cottage_b.glb",       pkg="4137", mesh="Assets/Tarbo-FantasyVillage/Meshes/Buildings/TB_Bd_House.FBX",              tex=T_VILLAGE_A, keep_res=True, target_h=5.2),
    dict(out="landmarks/cottage_c.glb",       pkg="4137", mesh="Assets/Tarbo-FantasyVillage/Meshes/Buildings/TB_Bd_SWHouse.FBX",            tex=T_VILLAGE_B, keep_res=True, target_h=5.4),

    # ---- Phase 3B Dungeon & Boss Arena Landmarks (4130 Mining & Cave) ----
    dict(out="landmarks/cave_skull.glb",      pkg="4130", mesh="Assets/PurePoly/Mining_Pack/Meshes/PP_Cave_Skull_01.fbx",                   tex=T_MINING, keep_res=True, target_h=8.8),
    dict(out="landmarks/crystal_pillar.glb",  pkg="4130", mesh="Assets/PurePoly/Mining_Pack/Meshes/PP_Crystal_Column_01_Blue.fbx",          tex=T_MINING, keep_res=True, target_h=5.8),
    dict(out="landmarks/fire_torch.glb",      pkg="4130", mesh="Assets/PurePoly/Mining_Pack/Meshes/PP_Fire_Torch_New_01.fbx",               tex=T_MINING, keep_res=True, target_h=2.8),
    dict(out="landmarks/cave_campfire.glb",   pkg="4130", mesh="Assets/PurePoly/Mining_Pack/Meshes/PP_Campfire_01.fbx",                     tex=T_MINING, keep_res=True, target_h=1.4),

    # ---- Monsters (13 species covering all 12 maps) ----
    dict(out="monsters/plant_chewer.glb",  pkg="4356", mesh="Assets/Monsters Ultimate Pack 04 Cute Series/Plant Chewer Cute Series/FBX/Plant Chewer.FBX",   tex="Assets/Monsters Ultimate Pack 04 Cute Series/Plant Chewer Cute Series/Textures/Plant Chewer.psd",   target_h=1.45, is_monster=True),
    dict(out="monsters/golem_ice.glb",     pkg="4356", mesh="Assets/Monsters Ultimate Pack 04 Cute Series/Golem Ice Cute Series/FBX/Golem Ice.FBX",         tex="Assets/Monsters Ultimate Pack 04 Cute Series/Golem Ice Cute Series/Textures/Golem Ice.psd",         target_h=2.05, is_monster=True),
    dict(out="monsters/golem_fire.glb",    pkg="4356", mesh="Assets/Monsters Ultimate Pack 04 Cute Series/Golem Fire Cute Series/FBX/Golem Fire.FBX",       tex="Assets/Monsters Ultimate Pack 04 Cute Series/Golem Fire Cute Series/Textures/Golem Fire.psd",       target_h=2.10, is_monster=True),
    dict(out="monsters/golem_earth.glb",   pkg="4356", mesh="Assets/Monsters Ultimate Pack 04 Cute Series/Golem Earth Cute Series/FBX/Golem Earth.FBX",     tex="Assets/Monsters Ultimate Pack 04 Cute Series/Golem Earth Cute Series/Textures/Golem Earth.psd",     target_h=2.05, is_monster=True),
    dict(out="monsters/scorpion_king.glb", pkg="4356", mesh="Assets/Monsters Ultimate Pack 04 Cute Series/Scorpion King Cute Series/FBX/Scorpion King.FBX", tex="Assets/Monsters Ultimate Pack 04 Cute Series/Scorpion King Cute Series/Textures/Scorpion King.psd", target_h=2.15, is_monster=True),
    dict(out="monsters/spore.glb",         pkg="4356", mesh="Assets/Monsters Ultimate Pack 04 Cute Series/Spore Cute Series/FBX/Spore.FBX",                 tex="Assets/Monsters Ultimate Pack 04 Cute Series/Spore Cute Series/Textures/Spore.psd",                 target_h=1.35, is_monster=True),
    dict(out="monsters/beholder.glb",      pkg="4117", mesh="Assets/RPGMonsterWave02Polyart/Meshes/BeholderMesh.fbx",     tex=T_POLYART, target_h=1.65, is_monster=True),
    dict(out="monsters/flying_demon.glb",  pkg="4117", mesh="Assets/RPGMonsterWave02Polyart/Meshes/FylingDemonMesh.fbx",  tex=T_POLYART, target_h=2.35, is_monster=True),
    dict(out="monsters/crab_monster.glb",  pkg="4117", mesh="Assets/RPGMonsterWave02Polyart/Meshes/CrabMonsterMesh.fbx",  tex=T_POLYART, target_h=1.45, is_monster=True),
    dict(out="monsters/chest_monster.glb", pkg="4117", mesh="Assets/RPGMonsterWave02Polyart/Meshes/ChestMonsterMesh.fbx", tex=T_POLYART, target_h=1.55, is_monster=True),
    dict(out="monsters/werewolf.glb",      pkg="4117", mesh="Assets/RPGMonsterWave02Polyart/Meshes/WerewolfMesh.fbx",     tex=T_POLYART, target_h=2.10, is_monster=True),
    dict(out="monsters/black_knight.glb",  pkg="4117", mesh="Assets/RPGMonsterWave02Polyart/Meshes/BlackKnightMesh.fbx",  tex=T_POLYART, target_h=2.25, is_monster=True),
    dict(out="monsters/specter.glb",       pkg="4117", mesh="Assets/RPGMonsterWave02Polyart/Meshes/SpecterMesh.fbx",      tex=T_POLYART, target_h=1.95, is_monster=True),
]


def extract_from_pkg(pkg_path, wanted_paths, dest_dir):
    wanted_lower = {p.lower(): p for p in wanted_paths if p}
    guid_map = {}
    with tarfile.open(pkg_path, "r:*") as tf:
        members = tf.getmembers()
        for m in members:
            parts = m.name.lstrip("./").split("/")
            if len(parts) == 2 and parts[1] == "pathname":
                f = tf.extractfile(m)
                if f:
                    lines = f.read().decode("utf-8", errors="ignore").splitlines()
                    if lines:
                        p = lines[0].strip()
                        if p.lower() in wanted_lower:
                            guid_map[parts[0]] = wanted_lower[p.lower()]
        out_map = {}
        for m in members:
            parts = m.name.lstrip("./").split("/")
            if len(parts) == 2 and parts[1] == "asset" and parts[0] in guid_map:
                orig = guid_map[parts[0]]
                safe_name = orig.replace("/", "__")
                dest = dest_dir / safe_name
                f = tf.extractfile(m)
                if f:
                    dest.write_bytes(f.read())
                    out_map[orig] = dest
    return out_map


def prep_png(src_path, dest_png, keep_res=False):
    if keep_res and str(src_path).lower().endswith(".png"):
        dest_png.write_bytes(Path(src_path).read_bytes())
        return dest_png
    cmd = ["sips", "-s", "format", "png"]
    if not keep_res:
        cmd += ["-Z", "256"]
    cmd += [str(src_path), "--out", str(dest_png)]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return dest_png


def main():
    tmp_dir = Path(tempfile.mkdtemp(prefix="lv_all_assets_"))
    print("Working in:", tmp_dir)

    by_pkg = {}
    for j in JOBS:
        by_pkg.setdefault(j["pkg"], set()).add(j["mesh"])
        if j.get("tex"):
            by_pkg[j["pkg"]].add(j["tex"])

    extracted = {}
    for pkg_id, paths in by_pkg.items():
        print(f"Extracting {len(paths)} files from pkg {pkg_id}...")
        extracted[pkg_id] = extract_from_pkg(PKGS[pkg_id], paths, tmp_dir)
        for p in paths:
            if p not in extracted[pkg_id]:
                print(f"  WARNING: missing {p} in pkg {pkg_id}")

    tex_cache = {}
    blender_tasks = []
    for j in JOBS:
        m_path = extracted[j["pkg"]].get(j["mesh"])
        if not m_path:
            continue
        tex_png = None
        if j.get("tex"):
            t_key = (j["pkg"], j["tex"], bool(j.get("keep_res")))
            if t_key not in tex_cache:
                t_raw = extracted[j["pkg"]].get(j["tex"])
                if t_raw:
                    tex_cache[t_key] = prep_png(t_raw, tmp_dir / f"tex_{len(tex_cache)}.png", keep_res=bool(j.get("keep_res")))
            tex_png = tex_cache.get(t_key)
        out_glb = GAME_ASSETS / j["out"]
        out_glb.parent.mkdir(parents=True, exist_ok=True)
        blender_tasks.append({
            "mesh": str(m_path),
            "tex": str(tex_png) if tex_png else None,
            "flat_color": j.get("flat_color"),
            "out": str(out_glb),
            "target_h": j["target_h"],
            "rot_x_deg": float(j.get("rot_x_deg", 0.0)),
            "center_pivot": bool(j.get("center_pivot", False)),
            "is_monster": bool(j.get("is_monster")),
        })

    blender_script = tmp_dir / "convert_all.py"
    blender_script.write_text(f"""
import bpy, mathutils, os, math

tasks = {repr(blender_tasks)}

for t in tasks:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=t['mesh'], ignore_leaf_bones=True)

    for obj in list(bpy.data.objects):
        if obj.type in ('LIGHT', 'CAMERA'):
            bpy.data.objects.remove(obj, do_unlink=True)

    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:
        o.select_set(True)
    if meshes:
        bpy.context.view_layer.objects.active = meshes[0]
        bpy.ops.object.convert(target='MESH')
    for obj in list(bpy.data.objects):
        if obj.type == 'ARMATURE':
            bpy.data.objects.remove(obj, do_unlink=True)

    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    for o in meshes:
        mw = o.matrix_world.copy()
        o.parent = None
        o.matrix_world = mw

    for obj in list(bpy.data.objects):
        if obj.type == 'EMPTY':
            bpy.data.objects.remove(obj, do_unlink=True)

    mat = bpy.data.materials.new(name='LVMat')
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out_node = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    nt.links.new(bsdf.outputs['BSDF'], out_node.inputs['Surface'])
    bsdf.inputs['Roughness'].default_value = 0.92
    if 'Specular IOR Level' in bsdf.inputs:
        bsdf.inputs['Specular IOR Level'].default_value = 0.08
    if t['tex'] and os.path.exists(t['tex']):
        img = bpy.data.images.load(t['tex'])
        img.pack()
        tex_node = nt.nodes.new('ShaderNodeTexImage')
        tex_node.image = img
        tex_node.interpolation = 'Closest'
        nt.links.new(tex_node.outputs['Color'], bsdf.inputs['Base Color'])
    elif t['flat_color']:
        bsdf.inputs['Base Color'].default_value = t['flat_color']

    for o in meshes:
        o.data.materials.clear()
        o.data.materials.append(mat)

    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:
        o.select_set(True)
    if meshes:
        bpy.context.view_layer.objects.active = meshes[0]
        if t.get('rot_x_deg'):
            for o in meshes:
                o.rotation_euler.x += math.radians(t['rot_x_deg'])
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

        min_x = min_y = min_z = 1e9
        max_x = max_y = max_z = -1e9
        for o in meshes:
            for v in o.data.vertices:
                w = o.matrix_world @ v.co
                min_x, max_x = min(min_x, w.x), max(max_x, w.x)
                min_y, max_y = min(min_y, w.y), max(max_y, w.y)
                min_z, max_z = min(min_z, w.z), max(max_z, w.z)
        h = max(max_z - min_z, 1e-4)
        sc = t['target_h'] / h
        cx, cy = (min_x + max_x) * 0.5, (min_y + max_y) * 0.5
        cz = (min_z + max_z) * 0.5 if t.get('center_pivot') else min_z
        for o in meshes:
            for v in o.data.vertices:
                v.co.x = (v.co.x - cx) * sc
                v.co.y = (v.co.y - cy) * sc
                v.co.z = (v.co.z - cz) * sc
            o.data.update()

    os.makedirs(os.path.dirname(t['out']), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=t['out'],
        export_format='GLB',
        export_animations=False,
        export_materials='EXPORT',
    )
    sz = os.path.getsize(t['out']) // 1024
    print(f"EXPORTED {{os.path.basename(t['out'])}} ({{sz}} KB)")
""", encoding="utf-8")

    subprocess.run([BLENDER, "--background", "--python", str(blender_script)], check=True)
    print("\nAll 34 v6 GLB assets exported successfully!")


if __name__ == "__main__":
    main()
