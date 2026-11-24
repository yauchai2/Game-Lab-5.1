#!/usr/bin/env python3
"""
Phase R0-R5 Verified Asset Exporter:
  1. Exports 24 verified Palmov POI setpieces -> game/assets/palmov_poi/<key>.glb
     with strict stripping of water/land slabs, modern cars (sedan/SUV/space car), and tiny <20cm fruit/mug clutter.
  2. Exports 11 new Giant Field Boss GLBs -> game/assets/monsters/boss_<key>.glb
     extracted directly from /Users/alanchan/Desktop/Game-Lab/temporary/assets/monster/.
"""
import json, os, re, shutil, subprocess, sys, tarfile

PALMOV_PKG = '/Users/alanchan/Desktop/Game-Lab/temporary/assets/scenes02/Low Poly Locations Ultimate Pack 1.0.0.unitypackage'
MONSTER_DIR = '/Users/alanchan/Desktop/Game-Lab/temporary/assets/monster'
BLENDER = '/Applications/Blender.app/Contents/MacOS/Blender'
WORK = '/tmp/lv_v6_assets'
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT_POI = os.path.join(ROOT_DIR, 'game', 'assets', 'palmov_poi')
OUT_MON = os.path.join(ROOT_DIR, 'game', 'assets', 'monsters')

# Strict strip keywords (water slabs, flat ground tiles, modern vehicles, floating boats, micro food clutter)
STRIP_KWS = [
    'water ', 'watre ', 'land ', 'island mountain ship', 'island lighthouse',
    'rotten sedan', 'car suvs', 'space car', 'planet 2',
    'sailboat', 'boat ',
    'fish', 'meat', 'garnet', 'orange', 'grape', 'bread', 'mango', 'carrot', 'mug',
]

# 19 Verified Grounded Palmov POI Setpieces (zero boats on land, zero floating bridges, zero out-of-place Japanese temples)
PALMOV_POIS = {
    'teapot_hill':      ('Low Poly Autumn/tea house autumn forest with env.prefab', 19.0),
    'forest_waterfall': ('Low Poly Nature/forest waterfall with env.prefab',        18.0),
    'abandoned_house':  ('Low Poly Autumn/abandoned house with env.prefab',         16.0),
    'cemetery_church':  ('Low Poly Autumn/cemetery haunted house with env.prefab',  22.0),
    'kraken_wreck':     ('Low Poly Sea/sea monster attack with env.prefab',         21.0),
    'ski_resort':       ('Low Poly Winter/ski resort with env.prefab',              21.0),
    'crystal_mountain': ('Low Poly Winter/crystal mountain with env.prefab',        20.0),
    'coal_mine':        ('Low Poly Western/coal mine with env.prefab',              20.0),
    'redrock_oasis':    ('Low Poly Western/waterfall desert with env.prefab',       19.0),
    'hot_springs':      ('Low Poly Autumn/autumn hot springs with env.prefab',      19.0),
    'mountain_forest':  ('Low Poly Nature/mountain forest with env.prefab',         18.0),
    'roman_ruins':      ('Low Poly Desert/roman ruins with env.prefab',             19.0),
    'mountain_ship':    ('Low poly Island/mountain ship with env.prefab',           20.0),
    'alpine_camp':      ('Low Poly Autumn/autumn mountain camping with env.prefab', 19.0),
    'autumn_harvest':   ('Low Poly Autumn/autumn harvest with env.prefab',          20.0),
    'arab_castle':      ('Low Poly Desert/arab castle with env.prefab',             21.0),
    'tropical_ruins':   ('Low Poly Desert/tropical ruins with env.prefab',          20.0),
    'space_shuttle':    ('Low Poly Space/space shuttle launch with env.prefab',     20.0),
    'fantastic_planet': ('Low Poly Space/fantastic planet with env.prefab',         19.0),
}

# 11 New Giant Field Bosses (key -> (pack_prefix, fbx_basename, target_height_m))
BOSS_MODELS = {
    'boss_sunflora':        ('4338_', 'Sunflora Pixie.FBX',  2.3),
    'boss_dragon_inferno':  ('4338_', 'Dragon Inferno.FBX',  3.1),
    'boss_archangel':       ('4301_', 'Archangel.FBX',       2.8),
    'boss_hermit_king':     ('4338_', 'Hermit King.FBX',     2.5),
    'boss_evil_mage':       ('4303_', 'EvilMageMesh.fbx',    2.5),
    'boss_wind_mage':       ('4301_', 'Wind Mage.FBX',       2.6),
    'boss_queen_worm':      ('4356_', 'Queen Worm.FBX',      2.9),
    'boss_snake_naga':      ('4338_', 'Snake Naga.FBX',      2.8),
    'boss_grim_reaper':     ('4356_', 'Grim Reaper.FBX',     2.9),
    'boss_dragon_darkness': ('4284_', 'Dragon Darkness.FBX', 3.1),
    'boss_dragon_nightfall':('4284_', 'Dragon Nightfall.FBX',3.3),
}


def parse_leaf_prefab(yaml_text):
    fbx_m = re.search(r'm_Mesh:\s*\{[^}]*guid:\s*([0-9a-f]{32})', yaml_text)
    fbx_guid = fbx_m.group(1) if fbx_m else None
    pos, rot, scl = [0.0, 0.0, 0.0], [0.0, 0.0, 0.0, 1.0], [1.0, 1.0, 1.0]
    m = re.search(r'm_LocalPosition:\s*\{x:\s*([^,]+),\s*y:\s*([^,]+),\s*z:\s*([^}]+)\}', yaml_text)
    if m: pos = [float(m.group(1)), float(m.group(2)), float(m.group(3))]
    m = re.search(r'm_LocalRotation:\s*\{x:\s*([^,]+),\s*y:\s*([^,]+),\s*z:\s*([^,]+),\s*w:\s*([^}]+)\}', yaml_text)
    if m: rot = [float(m.group(1)), float(m.group(2)), float(m.group(3)), float(m.group(4))]
    m = re.search(r'm_LocalScale:\s*\{x:\s*([^,]+),\s*y:\s*([^,]+),\s*z:\s*([^}]+)\}', yaml_text)
    if m: scl = [float(m.group(1)), float(m.group(2)), float(m.group(3))]
    return {'fbx_guid': fbx_guid, 'pos': pos, 'rot': rot, 'scl': scl}


def parse_scene_prefab(yaml_text, leaf_map):
    instances = []
    for blk in yaml_text.split('--- !u!1001 ')[1:]:
        src_m = re.search(r'm_SourcePrefab:\s*\{[^}]*guid:\s*([0-9a-f]{32})', blk)
        if not src_m: continue
        leaf = leaf_map.get(src_m.group(1))
        if not leaf or not leaf['fbx_guid']: continue
        name = leaf['name']
        pos, rot, scl = list(leaf['pos']), list(leaf['rot']), list(leaf['scl'])
        for prop, val in re.findall(r'propertyPath:\s*([^\n]+)\n\s*value:\s*([^\n]*)', blk):
            prop, val = prop.strip(), val.strip()
            if prop == 'm_Name' and val: name = val
            elif prop == 'm_LocalPosition.x': pos[0] = float(val)
            elif prop == 'm_LocalPosition.y': pos[1] = float(val)
            elif prop == 'm_LocalPosition.z': pos[2] = float(val)
            elif prop == 'm_LocalRotation.x': rot[0] = float(val)
            elif prop == 'm_LocalRotation.y': rot[1] = float(val)
            elif prop == 'm_LocalRotation.z': rot[2] = float(val)
            elif prop == 'm_LocalRotation.w': rot[3] = float(val)
            elif prop == 'm_LocalScale.x': scl[0] = float(val)
            elif prop == 'm_LocalScale.y': scl[1] = float(val)
            elif prop == 'm_LocalScale.z': scl[2] = float(val)
        low = (name + ' ').lower()
        if any(k in low for k in STRIP_KWS):
            continue
        instances.append({'name': name, 'fbx_guid': leaf['fbx_guid'], 'pos': pos, 'rot': rot, 'scl': scl})
    return instances


def extract_all():
    if os.path.exists(WORK): shutil.rmtree(WORK)
    os.makedirs(WORK, exist_ok=True)
    os.makedirs(OUT_POI, exist_ok=True)
    os.makedirs(OUT_MON, exist_ok=True)

    # 1. Extract Palmov POI setpieces
    poi_jobs = []
    with tarfile.open(PALMOV_PKG, 'r:gz') as tf:
        members = {m.name: m for m in tf.getmembers()}
        g2p, p2g = {}, {}
        for name, m in members.items():
            if name.endswith('/pathname'):
                g = name.split('/')[0]
                p = tf.extractfile(m).read().decode('utf-8', 'ignore').splitlines()[0].strip()
                rel = p.replace('Assets/Palmov Island/Low Poly Locations Ultimate Pack/', '')
                g2p[g] = rel; p2g[rel] = g

        tex_g = p2g['Textures/texture main.png']
        tex_path = os.path.join(WORK, 'texture_main.png')
        with open(tex_path, 'wb') as f:
            f.write(tf.extractfile(members[f'{tex_g}/asset']).read())

        needed_fbx = set()
        leaf_cache = {}
        for key, (prefab_rel, span) in PALMOV_POIS.items():
            full_rel = 'Prefabs/Locations with Env/' + prefab_rel
            rg = p2g.get(full_rel)
            if not rg:
                print(f"MISSING POI: {key} -> {full_rel}")
                continue
            ry = tf.extractfile(members[f'{rg}/asset']).read().decode('utf-8', 'ignore')
            leaf_map = {}
            for g in set(re.findall(r'guid:\s*([0-9a-f]{32})', ry)):
                p = g2p.get(g, '')
                if p.endswith('.prefab'):
                    if g not in leaf_cache:
                        ly = tf.extractfile(members[f'{g}/asset']).read().decode('utf-8', 'ignore')
                        info = parse_leaf_prefab(ly)
                        info['name'] = os.path.splitext(os.path.basename(p))[0]
                        leaf_cache[g] = info
                    info = leaf_cache[g]
                    if info['fbx_guid']: needed_fbx.add(info['fbx_guid'])
                    leaf_map[g] = info
            insts = parse_scene_prefab(ry, leaf_map)
            poi_jobs.append({'key': key, 'span': span, 'instances': insts, 'out': os.path.join(OUT_POI, f'{key}.glb')})

        for fg in needed_fbx:
            with open(os.path.join(WORK, f'{fg}.fbx'), 'wb') as f:
                f.write(tf.extractfile(members[f'{fg}/asset']).read())

    # 2. Extract 11 Giant Field Boss FBXs + best matching diffuse texture from monster unitypackages
    boss_jobs = []
    pack_dirs = {d[:5]: os.path.join(MONSTER_DIR, d) for d in os.listdir(MONSTER_DIR) if os.path.isdir(os.path.join(MONSTER_DIR, d))}
    for key, (prefix, fbx_name, target_h) in BOSS_MODELS.items():
        pdir = pack_dirs.get(prefix)
        if not pdir: continue
        pkgs = [os.path.join(r, fn) for r, _, fs in os.walk(pdir) for fn in fs if fn.endswith('.unitypackage')]
        found = False
        for pkg in pkgs:
            if found: break
            with tarfile.open(pkg, 'r:gz') as tf:
                members = {m.name: m for m in tf.getmembers()}
                g2p = {n.split('/')[0]: tf.extractfile(m).read().decode('utf-8','ignore').splitlines()[0].strip()
                       for n, m in members.items() if n.endswith('/pathname')}
                fbx_g = next((g for g, p in g2p.items() if os.path.basename(p).lower() == fbx_name.lower()), None)
                if not fbx_g: continue
                stem = os.path.splitext(fbx_name)[0].lower().replace('mesh', '').strip()
                # Find best diffuse texture matching stem or generic palette
                tex_cands = [(g, p) for g, p in g2p.items() if p.lower().endswith(('.png', '.tga', '.jpg')) and 'normal' not in p.lower() and 'mask' not in p.lower() and 'metallic' not in p.lower() and 'ao' not in p.lower()]
                tex_g = None
                for g, p in tex_cands:
                    if stem and stem.split()[0] in os.path.basename(p).lower():
                        tex_g = g; break
                if not tex_g and tex_cands:
                    tex_g = tex_cands[0][0]
                b_fbx = os.path.join(WORK, f'{key}.fbx')
                with open(b_fbx, 'wb') as f: f.write(tf.extractfile(members[f'{fbx_g}/asset']).read())
                b_tex = None
                if tex_g and f'{tex_g}/asset' in members:
                    ext = os.path.splitext(g2p[tex_g])[1] or '.png'
                    b_tex = os.path.join(WORK, f'{key}_tex{ext}')
                    with open(b_tex, 'wb') as f: f.write(tf.extractfile(members[f'{tex_g}/asset']).read())
                boss_jobs.append({'key': key, 'fbx': b_fbx, 'tex': b_tex, 'target_h': target_h, 'out': os.path.join(OUT_MON, f'{key}.glb')})
                found = True

    mp = os.path.join(WORK, 'manifest.json')
    with open(mp, 'w') as f:
        json.dump({'work': WORK, 'tex_path': tex_path, 'pois': poi_jobs, 'bosses': boss_jobs}, f)
    print(f"Prepared {len(poi_jobs)} Palmov POIs & {len(boss_jobs)} Giant Bosses")
    return mp


BLENDER_SCRIPT = r'''
import bpy, json, math, os, sys
from mathutils import Quaternion, Vector

argv = sys.argv[sys.argv.index('--') + 1:]
with open(argv[0]) as f:
    manifest = json.load(f)

work = manifest['work']
rx_p90 = Quaternion((1.0, 0.0, 0.0), math.radians(90.0))
rx_m90 = Quaternion((1.0, 0.0, 0.0), math.radians(-90.0))

def make_mat(tex_path, name='PalmovMain'):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out_n = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    nt.links.new(bsdf.outputs['BSDF'], out_n.inputs['Surface'])
    bsdf.inputs['Roughness'].default_value = 0.85
    if 'Specular IOR Level' in bsdf.inputs: bsdf.inputs['Specular IOR Level'].default_value = 0.1
    if tex_path and os.path.exists(tex_path):
        tex_n = nt.nodes.new('ShaderNodeTexImage')
        img = bpy.data.images.load(tex_path)
        img.pack()
        tex_n.image = img
        tex_n.interpolation = 'Closest'
        nt.links.new(tex_n.outputs['Color'], bsdf.inputs['Base Color'])
    return mat

def import_fbx_mesh(fbx_path, mat):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=fbx_path, use_custom_normals=True, ignore_leaf_bones=True)
    added = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in added if o.type == 'MESH']
    if not meshes:
        for o in added: bpy.data.objects.remove(o, do_unlink=True)
        return None
    bpy.ops.object.select_all(action='DESELECT')
    for m in meshes: m.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if len(meshes) > 1: bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    if mat:
        obj.data.materials.clear()
        obj.data.materials.append(mat)
    md = obj.data
    for o in list(bpy.data.objects):
        if o in added or o == obj: bpy.data.objects.remove(o, do_unlink=True)
    return md

# 1. Export all Palmov POIs
for job in manifest['pois']:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mat = make_mat(manifest['tex_path'])
    cache = {}
    objs = []
    for idx, inst in enumerate(job['instances']):
        fg = inst['fbx_guid']
        if fg not in cache: cache[fg] = import_fbx_mesh(os.path.join(work, f'{fg}.fbx'), mat)
        md = cache[fg]
        if not md: continue
        obj = bpy.data.objects.new(f"{inst['name']}_{idx}", md)
        bpy.context.collection.objects.link(obj)
        ux, uy, uz = inst['pos']
        qx, qy, qz, qw = inst['rot']
        sx, sy, sz = inst['scl']
        obj.location = Vector((-ux, -uz, uy))
        q_gltf = Quaternion((qw, qx, -qy, -qz)).normalized()
        obj.rotation_mode = 'QUATERNION'
        obj.rotation_quaternion = (rx_p90 @ q_gltf @ rx_m90).normalized()
        obj.scale = Vector((sx, sz, sy))
        objs.append(obj)
    bpy.context.view_layer.update()
    if not objs: continue
    bmin = [1e9, 1e9, 1e9]; bmax = [-1e9, -1e9, -1e9]
    for o in objs:
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            for i in range(3): bmin[i] = min(bmin[i], w[i]); bmax[i] = max(bmax[i], w[i])
    cur_span = max(0.01, bmax[0] - bmin[0], bmax[1] - bmin[1])
    sc = job['span'] / cur_span
    cx, cy, zmin = (bmin[0]+bmax[0])/2.0, (bmin[1]+bmax[1])/2.0, bmin[2]
    for o in objs:
        o.location = Vector(((o.location.x - cx)*sc, (o.location.y - cy)*sc, (o.location.z - zmin)*sc))
        o.scale *= sc
    bpy.ops.export_scene.gltf(filepath=job['out'], export_format='GLB', export_yup=True, export_materials='EXPORT', export_texcoords=True, export_normals=True)
    print(f"POI {job['key']:18s}: {len(objs):3d} objs -> {round(os.path.getsize(job['out'])/1024,1)}KB")

# 2. Export all 11 Giant Field Bosses (normalized to target_h, Y_min=0, centered X/Z)
for b in manifest['bosses']:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mat = make_mat(b['tex'], name=b['key'])
    md = import_fbx_mesh(b['fbx'], mat)
    if not md: continue
    obj = bpy.data.objects.new(b['key'], md)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.update()
    xs = [v.co.x for v in md.vertices]; ys = [v.co.y for v in md.vertices]; zs = [v.co.z for v in md.vertices]
    cx, cy, zmin, zmax = (min(xs)+max(xs))/2, (min(ys)+max(ys))/2, min(zs), max(zs)
    sc = b['target_h'] / max(0.001, zmax - zmin)
    for v in md.vertices:
        v.co.x = (v.co.x - cx) * sc
        v.co.y = (v.co.y - cy) * sc
        v.co.z = (v.co.z - zmin) * sc
    md.update()
    bpy.ops.export_scene.gltf(filepath=b['out'], export_format='GLB', export_yup=True, export_materials='EXPORT', export_texcoords=True, export_normals=True)
    print(f"BOSS {b['key']:22s} -> {round(os.path.getsize(b['out'])/1024,1)}KB")
'''


if __name__ == '__main__':
    mp = extract_all()
    bl_py = os.path.join(WORK, 'export_v6.py')
    with open(bl_py, 'w') as f: f.write(BLENDER_SCRIPT)
    res = subprocess.run([BLENDER, '--background', '--python', bl_py, '--', mp], capture_output=True, text=True)
    for line in res.stdout.splitlines():
        if line.startswith(('POI ', 'BOSS ', 'Prepared ', 'MISSING ')):
            print(line)
    if res.returncode != 0:
        print("STDERR:", res.stderr[-1500:], file=sys.stderr)
        sys.exit(res.returncode)
