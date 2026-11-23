#!/usr/bin/env python3
"""
Phase 4B 批次轉檔腳本：
從 scenes02 新增的 5 套資源包（4351 Egypt / 4352 Jungle / 4123 Alien Planets Vol2 / 4384 Polyworks）
於單一 Blender 5.0.1 headless 會話中匯出 18 件全新異界奇觀 GLB 至 game/assets/landmarks/。
"""
import os, sys, json, shutil, tarfile, tempfile, subprocess

BLENDER = "/Applications/Blender.app/Contents/MacOS/blender"
ASSETS_BASE = "/Users/alanchan/Desktop/Game-Lab/temporary/assets/scenes02"
OUT_DIR = "/Users/alanchan/Desktop/Game-Lab/Game-Lab-5.1/development/lantern-vale/game/assets/landmarks"

PACKS = {
    "egypt": os.path.join(ASSETS_BASE, "4351_沙漠绿洲金字塔场景/POLY - Egypt 1.0.unitypackage"),
    "jungle": os.path.join(ASSETS_BASE, "4352_卡通森林遗迹场景/POLY - Jungle 1.0.unitypackage"),
    "lostlands": os.path.join(ASSETS_BASE, "4118_低面探险遗迹场景/The Lost Lands 1.0.unitypackage"),
    "alien": os.path.join(ASSETS_BASE, "4123_低面外星场景包2/Alien Planets Vol2.unitypackage"),
    "polyworks": os.path.join(ASSETS_BASE, "4384_43个低面小场景/Low Poly Complete Collection - Polyworks 4.5.0.unitypackage"),
}

JOBS = [
    # #13 / #14 黃金沙漠與太陽金字塔（金字塔精簡面數至 ~200KB 確保秒載）
    {"pack": "egypt", "out": "egypt_pyramid.glb", "mesh": "Assets/POLY_Egypt/Models/Egypt/Buildings/Pyramid.fbx", "h": 11.5, "decimate": 0.04},
    {"pack": "egypt", "out": "egypt_sphinx.glb", "mesh": "Assets/POLY_Egypt/Models/Egypt/Buildings/Sphinx.fbx", "h": 6.8},
    {"pack": "egypt", "out": "egypt_obelisk.glb", "mesh": "Assets/POLY_Egypt/Models/Egypt/Pillars/PillarObelisk01.fbx", "h": 8.5},
    {"pack": "egypt", "out": "egypt_sarcophagus.glb", "mesh": "Assets/POLY_Egypt/Models/Egypt/Sarcophagus/Sarcophagus01.fbx", "h": 2.8},
    {"pack": "egypt", "out": "egypt_house.glb", "mesh": "Assets/POLY_Egypt/Models/Egypt/Buildings/House01b.fbx", "h": 5.5},

    # #15 失落藤蔓神廟（Binary FBX 實模）
    {"pack": "jungle", "out": "jungle_ruin_wall.glb", "mesh": "Assets/POLY_Jungle/Models/Jungle/Walls/WallLarge01.fbx", "h": 8.2},
    {"pack": "jungle", "out": "jungle_pillar.glb", "mesh": "Assets/POLY_Jungle/Models/Jungle/Pillars/Pillar01.fbx", "h": 7.2},
    {"pack": "jungle", "out": "jungle_statue.glb", "mesh": "Assets/POLY_Jungle/Models/Jungle/Statues/Statue01.fbx", "h": 6.2},
    {"pack": "lostlands", "out": "lost_stonewalk.glb", "mesh": "Assets/The Lost Lands/Graphics/_Meshes/Environment/Stonewalk_001.FBX", "h": 2.6},

    # #18 深海螢光沉淵
    {"pack": "alien", "out": "alien_squid.glb", "mesh": "Assets/Alien_planets_Vol2/Mehses/Creatures/Alien_squid.fbx", "tex": "Assets/Alien_planets_Vol2/Textures/Alien_colors.tga", "h": 7.2},
    {"pack": "alien", "out": "depth_shroom.glb", "mesh": "Assets/Alien_planets_Vol2/Mehses/Plants/Depth_tree.fbx", "tex": "Assets/Alien_planets_Vol2/Textures/Alien_colors.tga", "h": 7.0},
    {"pack": "alien", "out": "depth_tower.glb", "mesh": "Assets/Alien_planets_Vol2/Mehses/Structures/Depth_structure.fbx", "tex": "Assets/Alien_planets_Vol2/Textures/Alien_colors.tga", "h": 8.0},
    {"pack": "alien", "out": "depth_temple.glb", "mesh": "Assets/Alien_planets_Vol2/Mehses/Structures/Depth_structureB.fbx", "tex": "Assets/Alien_planets_Vol2/Textures/Alien_colors.tga", "h": 8.4},

    # #19 / #20 星際白銀前哨站與異星蜂巢裂谷
    {"pack": "alien", "out": "scifi_platform.glb", "mesh": "Assets/Alien_planets_Vol2/Mehses/Structures/SKY_platform.fbx", "tex": "Assets/Alien_planets_Vol2/Textures/Alien_colors.tga", "h": 6.5},
    {"pack": "alien", "out": "scifi_reactor.glb", "mesh": "Assets/Alien_planets_Vol2/Mehses/Structures/Lava_machine.fbx", "tex": "Assets/Alien_planets_Vol2/Textures/Alien_colors.tga", "h": 8.6},
    {"pack": "alien", "out": "sky_flyer.glb", "mesh": "Assets/Alien_planets_Vol2/Mehses/Structures/Sky_flyer.fbx", "tex": "Assets/Alien_planets_Vol2/Textures/Alien_colors.tga", "h": 5.2},
    {"pack": "alien", "out": "alien_hive_tower.glb", "mesh": "Assets/Alien_planets_Vol2/Mehses/Structures/Sky_structure.fbx", "tex": "Assets/Alien_planets_Vol2/Textures/Alien_colors.tga", "h": 9.0},
    {"pack": "polyworks", "out": "purple_crystal.glb", "mesh": "Assets/Off Axis Studios/Polyworks/Meshes/Crystals/Prop_Crystal_Purple_01.fbx", "h": 6.4},
]

BLENDER_SCRIPT = r"""
import bpy, sys, os, json, math
from mathutils import Vector

cfg_path = sys.argv[sys.argv.index("--") + 1]
with open(cfg_path, "r", encoding="utf-8") as f:
    tasks = json.load(f)

for t in tasks:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    fbx_path = t["fbx"]
    out_path = t["out"]
    tex_path = t.get("tex")
    target_h = float(t.get("h", 6.0))

    try:
        bpy.ops.import_scene.fbx(filepath=fbx_path, use_anim=False)
    except Exception as e:
        print("FAILED_IMPORT", out_path, e)
        continue

    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    if not meshes:
        print("NO_MESH", out_path)
        continue

    # 清除攝影機、燈光、空物件干擾
    for o in list(bpy.context.scene.objects):
        if o.type not in ("MESH", "ARMATURE"):
            bpy.data.objects.remove(o, do_unlink=True)

    # 套用色票貼圖（若指定）
    if tex_path and os.path.exists(tex_path):
        img = bpy.data.images.load(tex_path)
        mat = bpy.data.materials.new(name="PaletteMat")
        mat.use_nodes = True
        nt = mat.node_tree
        nt.nodes.clear()
        out_n = nt.nodes.new("ShaderNodeOutputMaterial")
        bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
        tex_n = nt.nodes.new("ShaderNodeTexImage")
        tex_n.image = img
        tex_n.interpolation = "Closest"
        nt.links.new(tex_n.outputs["Color"], bsdf.inputs["Base Color"])
        nt.links.new(bsdf.outputs["BSDF"], out_n.inputs["Surface"])
        if "Roughness" in bsdf.inputs:
            bsdf.inputs["Roughness"].default_value = 0.85
        for o in meshes:
            o.data.materials.clear()
            o.data.materials.append(mat)

    # 若指定減面（例如超高面數金字塔），套用 Decimate 保持低面風格與秒載體積
    dec_ratio = t.get("decimate")
    if dec_ratio:
        for o in meshes:
            mod = o.modifiers.new(name="Decimate", type="DECIMATE")
            mod.ratio = float(dec_ratio)

    # 計算包圍盒並歸一化高度與底面置中
    bpy.context.view_layer.update()
    mn = Vector((1e9, 1e9, 1e9))
    mx = Vector((-1e9, -1e9, -1e9))
    for o in meshes:
        for corner in o.bound_box:
            wc = o.matrix_world @ Vector(corner)
            mn.x = min(mn.x, wc.x); mn.y = min(mn.y, wc.y); mn.z = min(mn.z, wc.z)
            mx.x = max(mx.x, wc.x); mx.y = max(mx.y, wc.y); mx.z = max(mx.z, wc.z)
    h = max(0.001, mx.z - mn.z)
    s = target_h / h
    cx = (mn.x + mx.x) * 0.5
    cy = (mn.y + mx.y) * 0.5
    cz = mn.z

    root = bpy.data.objects.new("Root", None)
    bpy.context.collection.objects.link(root)
    for o in list(bpy.context.scene.objects):
        if o != root and o.parent is None:
            o.parent = root
    root.scale = (s, s, s)
    root.location = (-cx * s, -cy * s, -cz * s)
    bpy.context.view_layer.update()

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format="GLB",
        export_materials="EXPORT",
        export_texcoords=True,
        export_normals=True,
        export_yup=True,
        export_apply=True,
    )
    sz = os.path.getsize(out_path) / 1024.0
    print(f"EXPORTED {os.path.basename(out_path)} ({sz:.1f} KB)")
"""

def extract_needed(tmp_dir):
    by_pack = {}
    for j in JOBS:
        by_pack.setdefault(j["pack"], set()).add(j["mesh"])
        if j.get("tex"):
            by_pack[j["pack"]].add(j["tex"])

    extracted = {}
    for pk, wanted in by_pack.items():
        pkg_path = PACKS[pk]
        print(f"Scanning {os.path.basename(pkg_path)} ({len(wanted)} files)...")
        guid_to_path = {}
        guid_to_member = {}
        with tarfile.open(pkg_path, "r:gz") as tf:
            for m in tf.getmembers():
                parts = m.name.split("/")
                if len(parts) < 2:
                    continue
                guid, leaf = parts[0], parts[1]
                if leaf == "pathname":
                    p = tf.extractfile(m).read().decode("utf-8", "ignore").splitlines()[0].strip()
                    if p in wanted:
                        guid_to_path[guid] = p
                elif leaf == "asset":
                    guid_to_member[guid] = m
            for guid, rel in guid_to_path.items():
                am = guid_to_member.get(guid)
                if not am:
                    print("  MISSING asset blob for", rel)
                    continue
                dst = os.path.join(tmp_dir, pk, os.path.basename(rel))
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                with tf.extractfile(am) as src_f, open(dst, "wb") as dst_f:
                    shutil.copyfileobj(src_f, dst_f)
                # 若為 TGA 色票貼圖，用 sips 無損轉 PNG（保留原始解析度不模糊色塊！）
                if dst.lower().endswith(".tga"):
                    png_dst = dst[:-4] + ".png"
                    subprocess.run(["sips", "-s", "format", "png", dst, "--out", png_dst], check=True, stdout=subprocess.DEVNULL)
                    dst = png_dst
                extracted[(pk, rel)] = dst
                print(f"  Extracted: {os.path.basename(dst)}")
    return extracted

def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    tmp_dir = tempfile.mkdtemp(prefix="lv_p4b_")
    try:
        ext = extract_needed(tmp_dir)
        tasks = []
        for j in JOBS:
            fbx = ext.get((j["pack"], j["mesh"]))
            if not fbx:
                print("SKIP missing:", j["mesh"])
                continue
            tex = ext.get((j["pack"], j["tex"])) if j.get("tex") else None
            tasks.append({
                "fbx": fbx,
                "tex": tex,
                "out": os.path.join(OUT_DIR, j["out"]),
                "h": j["h"],
                "decimate": j.get("decimate"),
            })
        cfg_path = os.path.join(tmp_dir, "tasks.json")
        py_path = os.path.join(tmp_dir, "run_blender.py")
        with open(cfg_path, "w", encoding="utf-8") as f:
            json.dump(tasks, f, indent=2)
        with open(py_path, "w", encoding="utf-8") as f:
            f.write(BLENDER_SCRIPT)
        print(f"Running Blender headless for {len(tasks)} Phase 4B GLBs...")
        subprocess.run([BLENDER, "--background", "--python", py_path, "--", cfg_path], check=True)
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)

if __name__ == "__main__":
    main()
