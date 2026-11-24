#!/usr/bin/env python3
"""
Phase C1：將 Modular Cute Fantasy Character Pack #1 轉換為 WebGL 最佳化 GLB 資產
輸出：
  - game/assets/char/adventurer_base.glb  (36 組模組化蒙皮網格 + 統一骨架 + 霧面柔和材質)
  - game/assets/char/anim_fighter.glb     (純骨骼動畫軌道，無幾何體)
  - game/assets/char/anim_archer.glb
  - game/assets/char/anim_mage.glb
  - game/assets/char/anim_necromancer.glb
  - game/assets/char/anim_monk.glb
  - game/assets/char/tex/*.png            (膚色/瞳色/法袍/法杖變體貼圖)
"""
import bpy
import os
import shutil

SRC_DIR = '/Users/alanchan/.gemini/antigravity/brain/d4a27fce-e42a-41fb-abaa-1b5374f8adb3/scratch/mcf_full'
OUT_DIR = '/Users/alanchan/Desktop/Game-Lab/Game-Lab-5.1/development/lantern-vale/game/assets/char'
TEX_OUT = os.path.join(OUT_DIR, 'tex')
os.makedirs(TEX_OUT, exist_ok=True)

# 精確對應 SK_Adventurer.fbx 內每個材質名稱 → 貼圖相對路徑
MAT_TEX_MAP = {
    'Mat_hair_001': 'Textures/T_Skins/T_hair_001A.png',
    'Mat_hair_002': 'Textures/T_Skins/T_hair_002A.png',
    'Mat_hair_003': 'Textures/T_Skins/T_hair_003A.png',
    'Mat_hair_004': 'Textures/T_Skins/T_hair_004A.png',
    'Mat_hair_005': 'Textures/T_Skins/T_hair_005A.png',
    'Mat_skin_body_001': 'Textures/T_Skins/T_skin_body_001A.png',
    'Mat_skin_face_001': 'Textures/T_Skins/T_skin_face_001A.png',
    'Mat_skin_eyes':     'Textures/T_Skins/T_skin_eyes_001A.png',
    'Mat_skin_brow_001': 'Textures/T_Skins/T_skin_brow_001A.png',
    'Mat_skin_nose':     'Textures/T_Skins/T_skin_nose_001A.png',
    'Mat_outfit_archer_body_001':   'Textures/T_Outfits/T_outfit_archer_body_001A.png',
    'Mat_outfit_archer_boots_001':  'Textures/T_Outfits/T_outfit_archer_boots_001A.png',
    'Mat_outfit_archer_cloak_001':  'Textures/T_Outfits/T_outfit_archer_cloak_001A.png',
    'Mat_outfit_archer_quiver_001': 'Textures/T_Outfits/T_outfit_archer_quiver_001A.png',
    'Mat_outfit_fighter_body_001':   'Textures/T_Outfits/T_outfit_fighter_body_001A.png',
    'Mat_outfit_fighter_boots_001':  'Textures/T_Outfits/T_outfit_fighter_boots_001A.png',
    'Mat_outfit_fighter_gloves_001': 'Textures/T_Outfits/T_outfit_fighter_gloves_001A.png',
    'Mat_outfit_fighter_hat_001':    'Textures/T_Outfits/T_outfit_fighter_hat_001A.png',
    'Mat_outfit_mage_body_001':  'Textures/T_Outfits/T_outfit_mage_body_001.png',
    'Mat_outfit_mage_boots_001': 'Textures/T_Outfits/T_outfit_mage_boots_001A.png',
    'Mat_outfit_mage_cloak_001': 'Textures/T_Outfits/T_outfit_mage_cloak_001A.png',
    'Mat_outfit_mage_hat_001':   'Textures/T_Outfits/T_outfit_mage_hat_001A.png',
    'outfit_hat':                'Textures/T_Outfits/T_outfit_mage_hat_002A.png',
    'Mat_outfit_monk_body_001':  'Textures/T_Outfits/T_outfit_monk_body_001A.png',
    'Mat_outfit_monk_boots_001': 'Textures/T_Outfits/T_outfit_monk_boots_001A.png',
    'Mat_outfit_monk_cloak_001': 'Textures/T_Outfits/T_outfit_monk_cloak_001A.png',
    'Mat_outfit_monk_hat_001':   'Textures/T_Outfits/T_outfit_monk_hat_001A.png',
    'Mat_outfit_necromancer_body_001':  'Textures/T_Outfits/T_outfit_necromancer_body_001A.png',
    'Mat_outfit_necromancer_boots_001': 'Textures/T_Outfits/T_outfit_necromancer_boots_001A.png',
    'Mat_outfit_necromancer_hat_001':   'Textures/T_Outfits/T_outfit_necromancer_hat_001A.png',
    'Mat_weapon_archerarrow_001':     'Textures/T_Weapons/T_weapon_archerbow_001A.png',
    'Mat_weapon_fighteraxe_001':      'Textures/T_Weapons/T_weapon_fighteraxe_001A.png',
    'Mat_weapon_fighteraxe_002':      'Textures/T_Weapons/T_weapon_fighteraxe_002A.png',
    'Mat_weapon_magestaff_001':       'Textures/T_Weapons/T_weapon_magestaff_001A.png',
    'Mat_weapon_magestaff_001_a':     'Textures/T_Weapons/T_weapon_magestaff_001A.png',
    'Mat_weapon_monkstaff_001':       'Textures/T_Weapons/T_weapon_monkstaff_001A.png',
    'Mat_weapon_necromancerblade_001':   'Textures/T_Weapons/T_weapon_necromancerblade_001A.png',
    'Mat_weapon_necromancerblade_001_a': 'Textures/T_Weapons/T_weapon_necromancerblade_001A.png',
}

VARIANT_TEXTURES = {
    'skin_body_A.png': 'Textures/T_Skins/T_skin_body_001A.png',
    'skin_body_B.png': 'Textures/T_Skins/T_skin_body_001B.png',
    'skin_body_C.png': 'Textures/T_Skins/T_skin_body_001C.png',
    'skin_face_A.png': 'Textures/T_Skins/T_skin_face_001A.png',
    'skin_face_B.png': 'Textures/T_Skins/T_skin_face_001B.png',
    'skin_face_C.png': 'Textures/T_Skins/T_skin_face_001C.png',
    'skin_nose_A.png': 'Textures/T_Skins/T_skin_nose_001A.png',
    'skin_nose_B.png': 'Textures/T_Skins/T_skin_nose_001B.png',
    'skin_nose_C.png': 'Textures/T_Skins/T_skin_nose_001C.png',
    'skin_eyes_A.png': 'Textures/T_Skins/T_skin_eyes_001A.png',
    'skin_eyes_B.png': 'Textures/T_Skins/T_skin_eyes_001B.png',
    'skin_eyes_C.png': 'Textures/T_Skins/T_skin_eyes_001C.png',
    'skin_eyes_D.png': 'Textures/T_Skins/T_skin_eyes_001D.png',
    'mage_body_001.png': 'Textures/T_Outfits/T_outfit_mage_body_001.png',
    'mage_body_002.png': 'Textures/T_Outfits/T_outfit_mage_body_002.png',
    'mage_staff_A.png':  'Textures/T_Weapons/T_weapon_magestaff_001A.png',
    'mage_staff_B.png':  'Textures/T_Weapons/T_weapon_magestaff_001B.png',
}

def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def bind_material_texture(mat, img_path):
    """相容繁體中文介面 Blender 5.0：僅透過節點類型字串與插槽索引建構霧面柔和材質"""
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out_node = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    tex = nt.nodes.new('ShaderNodeTexImage')
    img = bpy.data.images.load(img_path, check_existing=True)
    img.pack()
    tex.image = img
    # 柔和霧面手感（粗糙度 0.88，低反光）
    for inp in bsdf.inputs:
        if inp.identifier == 'Roughness':
            inp.default_value = 0.88
        elif inp.identifier == 'Specular IOR Level':
            inp.default_value = 0.12
        elif inp.identifier == 'Metallic':
            inp.default_value = 0.0
    nt.links.new(tex.outputs[0], bsdf.inputs[0])
    nt.links.new(bsdf.outputs[0], out_node.inputs[0])

def build_base_glb():
    clear_scene()
    fbx_path = os.path.join(SRC_DIR, 'Models/SK_Adventurer.fbx')
    bpy.ops.import_scene.fbx(filepath=fbx_path, ignore_leaf_bones=True)
    # 檢視高度範圍
    zs = []
    for obj in bpy.data.objects:
        if obj.type == 'MESH':
            for v in obj.bound_box:
                co = obj.matrix_world @ bpy.mathutils.Vector(v) if hasattr(bpy, 'mathutils') else obj.matrix_world @ __import__('mathutils').Vector(v)
                zs.append(co.z)
    if zs:
        print(f'[BASE] Raw Z bounds: {min(zs):.3f} .. {max(zs):.3f} (height={max(zs)-min(zs):.3f})')

    # 套用所有貼圖
    mapped, missed = 0, []
    for mat in bpy.data.materials:
        base_name = mat.name.split('.')[0]
        rel = MAT_TEX_MAP.get(mat.name) or MAT_TEX_MAP.get(base_name)
        if rel:
            full = os.path.join(SRC_DIR, rel)
            if os.path.exists(full):
                bind_material_texture(mat, full)
                mapped += 1
            else:
                missed.append((mat.name, full))
        else:
            missed.append((mat.name, 'NO_MAP'))
    print(f'[BASE] Materials mapped={mapped}, missed={missed}')

    # 移除本體中多餘的動畫，保持純淨綁定
    for act in list(bpy.data.actions):
        bpy.data.actions.remove(act)

    out_glb = os.path.join(OUT_DIR, 'adventurer_base.glb')
    bpy.ops.export_scene.gltf(
        filepath=out_glb,
        export_format='GLB',
        export_materials='EXPORT',
        export_texcoords=True,
        export_normals=True,
        export_skins=True,
        export_animations=False,
        export_image_format='WEBP',
        export_image_quality=85,
        export_yup=True,
    )
    print(f'[BASE] Exported {out_glb} ({os.path.getsize(out_glb)/1024:.1f} KB)')

def build_anim_glbs():
    classes = [
        ('fighter', 'Animation/Fighter@animation.fbx'),
        ('archer', 'Animation/Archer@animation.fbx'),
        ('mage', 'Animation/Mage@animation.fbx'),
        ('necromancer', 'Animation/Necromancer@animation.fbx'),
        ('monk', 'Animation/Monk@animation.fbx'),
    ]
    SKIP_CLIPS = {'runback', 'runl', 'runr', 'walkfast'}
    for key, rel in classes:
        clear_scene()
        fbx_path = os.path.join(SRC_DIR, rel)
        bpy.ops.import_scene.fbx(filepath=fbx_path, ignore_leaf_bones=True)
        # 刪除所有幾何體，僅保留骨架＋動作軌道，讓每個動畫包極致輕量！
        for obj in list(bpy.data.objects):
            if obj.type != 'ARMATURE':
                bpy.data.objects.remove(obj, do_unlink=True)
        # 移除靜態姿勢與冗餘方向動作，並正規化動作名稱
        kept = []
        for act in list(bpy.data.actions):
            short = act.name.split('@')[-1] if '@' in act.name else act.name.split('|')[-1]
            low = short.lower()
            if 'static' in low or low in SKIP_CLIPS:
                bpy.data.actions.remove(act)
                continue
            act.name = short
            kept.append(short)
        arm = next((o for o in bpy.data.objects if o.type == 'ARMATURE'), None)
        if arm:
            arm.animation_data_create()
            for act in bpy.data.actions:
                tr = arm.animation_data.nla_tracks.new()
                tr.name = act.name
                tr.strips.new(act.name, int(act.frame_range[0]), act)
        out_glb = os.path.join(OUT_DIR, f'anim_{key}.glb')
        bpy.ops.export_scene.gltf(
            filepath=out_glb,
            export_format='GLB',
            export_animations=True,
            export_animation_mode='NLA_TRACKS',
            export_frame_step=2,
            export_optimize_animation_size=True,
            export_skins=False,
            export_yup=True,
        )
        print(f'[ANIM:{key}] Exported {len(kept)} clips -> {os.path.basename(out_glb)} ({os.path.getsize(out_glb)/1024:.1f} KB): {sorted(kept)}')

def copy_variants():
    for dst_name, rel in VARIANT_TEXTURES.items():
        src = os.path.join(SRC_DIR, rel)
        if os.path.exists(src):
            shutil.copy2(src, os.path.join(TEX_OUT, dst_name))
    print(f'[TEX] Copied {len(os.listdir(TEX_OUT))} variant textures to {TEX_OUT}')

if __name__ == '__main__':
    build_base_glb()
    build_anim_glbs()
    copy_variants()
    print('ALL CHARACTER ASSETS BUILT SUCCESSFULLY')
