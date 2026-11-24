#!/usr/bin/env python3
"""
Phase W1: Universal Palmov Low Poly Locations Ultimate Pack Exporter.
Exports:
  1. Normalized standalone props/buildings/trees -> game/assets/palmov/<key>.glb
  2. Pre-assembled `Locations with Env` setpieces (water/land slabs stripped) -> game/assets/scenes/setpiece_<key>.glb
All meshes share `texture main.png` with clean flat/low-poly shading and Y_min=0 ground alignment.
"""
import json, os, re, shutil, subprocess, sys, tarfile

PKG = '/Users/alanchan/Desktop/Game-Lab/temporary/assets/scenes02/Low Poly Locations Ultimate Pack 1.0.0.unitypackage'
BLENDER = '/Applications/Blender.app/Contents/MacOS/Blender'
WORK = '/tmp/lv_palmov_w1'
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT_PROPS = os.path.join(ROOT_DIR, 'game', 'assets', 'palmov')
OUT_SCENES = os.path.join(ROOT_DIR, 'game', 'assets', 'scenes')

# Standalone Palmov props & buildings (key -> (relative_fbx_path, target_height_meters))
PROPS = {
    'village_house_1': ('Models/Houses/Village houses/village house.fbx', 5.2),
    'village_house_2': ('Models/Houses/Village houses/village house 2.fbx', 5.4),
    'village_house_3': ('Models/Houses/Village houses/village house 3.fbx', 5.0),
    'village_house_4': ('Models/Houses/Village houses/village house 4.fbx', 5.6),
    'village_house_5': ('Models/Houses/Village houses/village house 5.fbx', 4.8),
    'wooden_house_1':  ('Models/Houses/Wooden houses/wooden house.fbx', 4.8),
    'wooden_house_2':  ('Models/Houses/Wooden houses/wooden house 2.fbx', 5.2),
    'farm_barn':       ('Models/Houses/Farm houses/farm barn.fbx', 6.2),
    'farm_house':      ('Models/Houses/Farm houses/farm house.fbx', 5.4),
    'farm_windmill':   ('Models/Environment/farm windmill.fbx', 8.5),
    'lighthouse':      ('Models/Houses/Lighthouses/lighthouse.fbx', 10.5),
    'fountain':        ('Models/Environment/Fountains/fountain.fbx', 2.4),
    'well':            ('Models/Environment/Wells/well.fbx', 2.6),
    'food_tent_1':     ('Models/Environment/Food tents/food tent.fbx', 3.1),
    'food_tent_2':     ('Models/Environment/Food tents/food tent 2.fbx', 3.1),
    'food_tent_3':     ('Models/Environment/Food tents/food tent 3.fbx', 3.1),
    'lamppost':        ('Models/Environment/Lighting/lamppost 2.fbx', 3.4),
    'bench':           ('Models/Environment/Benches/bench 2.fbx', 0.95),
    'village_fence':   ('Models/Environment/Fences/Village fences/village fence.fbx', 1.1),
    'wooden_bridge':   ('Models/Environment/Bridges/wooden bridge.fbx', 1.8),
    'wooden_pier':     ('Models/Environment/Wooden piers/wooden pier.fbx', 1.4),
    'fishing_boat':    ('Models/Vehicles/Boats/fishing boat.fbx', 1.7),
    'ship_dock':       ('Models/Vehicles/Ships/ship.fbx', 6.8),
    'barrel':          ('Models/Environment/Barrels/barrel.fbx', 0.9),
    'box':             ('Models/Environment/Boxs/box 2.fbx', 0.85),
    'bonfire':         ('Models/Environment/Camping envi/bonfire.fbx', 1.05),
    'camp_tent_red':   ('Models/Environment/Camping envi/camping tent red.fbx', 2.2),
    'camp_tent_blue':  ('Models/Environment/Camping envi/camping tent blue.fbx', 2.2),
    'camp_tent_yellow':('Models/Environment/Camping envi/camping tent yellow.fbx', 2.2),
    'tree_green':      ('Models/Trees/tree 2.fbx', 5.4),
    'tree_pine':       ('Models/Trees/tree 3.fbx', 6.2),
    'tree_autumn':     ('Models/Trees/Autumn trees/autumn tree 2.fbx', 5.4),
    'tree_sakura':     ('Models/Trees/Sakura trees/sakura tree 2.fbx', 5.6),
}

# Pre-assembled `Locations with Env` setpieces (key -> (prefab_suffix, target_scale, strip_keywords))
SETPIECES = {
    'autumn_camp': ('Low Poly Autumn/autumn mountain camping with env.prefab', 0.30, ['water', 'land ']),
    'tea_house':   ('Low Poly Autumn/tea house autumn forest with env.prefab', 0.30, ['water', 'land ']),
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


def parse_scene_prefab(yaml_text, leaf_map, strip_kws):
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
        low = name.lower()
        if any(k in low for k in strip_kws):
            continue
        instances.append({'name': name, 'fbx_guid': leaf['fbx_guid'], 'pos': pos, 'rot': rot, 'scl': scl})
    return instances


def extract_all():
    if os.path.exists(WORK): shutil.rmtree(WORK)
    os.makedirs(WORK, exist_ok=True)
    os.makedirs(OUT_PROPS, exist_ok=True)
    os.makedirs(OUT_SCENES, exist_ok=True)

    with tarfile.open(PKG, 'r:gz') as tf:
        members = {m.name: m for m in tf.getmembers()}
        g2p, p2g = {}, {}
        for name, m in members.items():
            if name.endswith('/pathname'):
                g = name.split('/')[0]
                p = tf.extractfile(m).read().decode('utf-8', 'ignore').splitlines()[0].strip()
                rel = p.replace('Assets/Palmov Island/Low Poly Locations Ultimate Pack/', '')
                g2p[g] = rel
                p2g[rel] = g

        # Texture
        tex_g = p2g['Textures/texture main.png']
        tex_path = os.path.join(WORK, 'texture_main.png')
        with open(tex_path, 'wb') as f:
            f.write(tf.extractfile(members[f'{tex_g}/asset']).read())

        needed_fbx = set()
        prop_jobs = []
        for key, (rel_fbx, target_h) in PROPS.items():
            fg = p2g.get(rel_fbx)
            if not fg:
                print(f"WARNING: missing prop {key} -> {rel_fbx}")
                continue
            needed_fbx.add(fg)
            prop_jobs.append({'key': key, 'fbx_guid': fg, 'target_h': target_h, 'out': os.path.join(OUT_PROPS, f'{key}.glb')})

        setpiece_jobs = []
        for key, (prefab_rel, scale, strip_kws) in SETPIECES.items():
            full_rel = 'Prefabs/Locations with Env/' + prefab_rel
            rg = p2g.get(full_rel)
            if not rg:
                print(f"WARNING: missing setpiece {key} -> {full_rel}")
                continue
            ry = tf.extractfile(members[f'{rg}/asset']).read().decode('utf-8', 'ignore')
            leaf_map = {}
            for g in set(re.findall(r'guid:\s*([0-9a-f]{32})', ry)):
                p = g2p.get(g, '')
                if p.endswith('.prefab'):
                    ly = tf.extractfile(members[f'{g}/asset']).read().decode('utf-8', 'ignore')
                    info = parse_leaf_prefab(ly)
                    info['name'] = os.path.splitext(os.path.basename(p))[0]
                    if info['fbx_guid']: needed_fbx.add(info['fbx_guid'])
                    leaf_map[g] = info
            insts = parse_scene_prefab(ry, leaf_map, strip_kws)
            setpiece_jobs.append({'key': key, 'scale': scale, 'instances': insts, 'out': os.path.join(OUT_SCENES, f'setpiece_{key}.glb')})

        for fg in needed_fbx:
            with open(os.path.join(WORK, f'{fg}.fbx'), 'wb') as f:
                f.write(tf.extractfile(members[f'{fg}/asset']).read())

        manifest = {'work': WORK, 'tex_path': tex_path, 'props': prop_jobs, 'setpieces': setpiece_jobs}
        mp = os.path.join(WORK, 'manifest.json')
        with open(mp, 'w') as f: json.dump(manifest, f)
        print(f"Prepared {len(prop_jobs)} props, {len(setpiece_jobs)} setpieces, {len(needed_fbx)} unique FBXs")
        return mp


BLENDER_SCRIPT = r'''
import bpy, json, math, os, sys
from mathutils import Quaternion, Vector

argv = sys.argv[sys.argv.index('--') + 1:]
with open(argv[0]) as f:
    manifest = json.load(f)

work = manifest['work']

def make_mat():
    mat = bpy.data.materials.new(name='PalmovMain')
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out_n = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    nt.links.new(bsdf.outputs['BSDF'], out_n.inputs['Surface'])
    bsdf.inputs['Roughness'].default_value = 0.88
    if 'Specular IOR Level' in bsdf.inputs: bsdf.inputs['Specular IOR Level'].default_value = 0.1
    tex_n = nt.nodes.new('ShaderNodeTexImage')
    img = bpy.data.images.load(manifest['tex_path'])
    img.pack()
    tex_n.image = img
    tex_n.interpolation = 'Closest'
    nt.links.new(tex_n.outputs['Color'], bsdf.inputs['Base Color'])
    return mat

def import_fbx_mesh(fg, mat):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=os.path.join(work, f'{fg}.fbx'), use_custom_normals=True, ignore_leaf_bones=True)
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
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    md = obj.data
    for o in list(bpy.data.objects):
        if o in added or o == obj: bpy.data.objects.remove(o, do_unlink=True)
    return md

# 1. Export each standalone prop normalized to target_h, centered X/Z, Y_min=0
for job in manifest['props']:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mat = make_mat()
    md = import_fbx_mesh(job['fbx_guid'], mat)
    if not md: continue
    obj = bpy.data.objects.new(job['key'], md)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.update()
    xs = [v.co.x for v in md.vertices]
    ys = [v.co.y for v in md.vertices]
    zs = [v.co.z for v in md.vertices]
    cx, cy, zmin, zmax = (min(xs)+max(xs))/2, (min(ys)+max(ys))/2, min(zs), max(zs)
    h = max(0.001, zmax - zmin)
    sc = job['target_h'] / h
    for v in md.vertices:
        v.co.x = (v.co.x - cx) * sc
        v.co.y = (v.co.y - cy) * sc
        v.co.z = (v.co.z - zmin) * sc
    md.update()
    bpy.ops.export_scene.gltf(filepath=job['out'], export_format='GLB', export_yup=True, export_materials='EXPORT', export_texcoords=True, export_normals=True)
    print(f"PROP {job['key']}: {round(os.path.getsize(job['out'])/1024,1)}KB")

# 2. Export pre-assembled setpieces (normalized to Y_min=0, centered X/Z)
rx_p90 = Quaternion((1.0, 0.0, 0.0), math.radians(90.0))
rx_m90 = Quaternion((1.0, 0.0, 0.0), math.radians(-90.0))

for sp in manifest['setpieces']:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mat = make_mat()
    cache = {}
    objs = []
    for idx, inst in enumerate(sp['instances']):
        fg = inst['fbx_guid']
        if fg not in cache: cache[fg] = import_fbx_mesh(fg, mat)
        md = cache[fg]
        if not md: continue
        obj = bpy.data.objects.new(f"{inst['name']}_{idx}", md)
        bpy.context.collection.objects.link(obj)
        ux, uy, uz = inst['pos']
        qx, qy, qz, qw = inst['rot']
        sx, sy, sz = inst['scl']
        obj.location = Vector((-ux, -uz, uy)) * sp['scale']
        q_gltf = Quaternion((qw, qx, -qy, -qz)).normalized()
        obj.rotation_mode = 'QUATERNION'
        obj.rotation_quaternion = (rx_p90 @ q_gltf @ rx_m90).normalized()
        obj.scale = Vector((sx, sz, sy)) * sp['scale']
        objs.append(obj)
    bpy.context.view_layer.update()
    # Center X/Y and snap Z_min to 0 in Blender Z-up
    bmin = [1e9, 1e9, 1e9]; bmax = [-1e9, -1e9, -1e9]
    for o in objs:
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            for i in range(3): bmin[i] = min(bmin[i], w[i]); bmax[i] = max(bmax[i], w[i])
    off = Vector((-(bmin[0]+bmax[0])/2, -(bmin[1]+bmax[1])/2, -bmin[2]))
    for o in objs: o.location += off
    bpy.ops.export_scene.gltf(filepath=sp['out'], export_format='GLB', export_yup=True, export_materials='EXPORT', export_texcoords=True, export_normals=True)
    print(f"SETPIECE {sp['key']}: {len(objs)} objs -> {round(os.path.getsize(sp['out'])/1024,1)}KB")
'''


if __name__ == '__main__':
    mp = extract_all()
    bl_py = os.path.join(WORK, 'export_w1.py')
    with open(bl_py, 'w') as f: f.write(BLENDER_SCRIPT)
    res = subprocess.run([BLENDER, '--background', '--python', bl_py, '--', mp], capture_output=True, text=True)
    for line in res.stdout.splitlines():
        if line.startswith(('PROP ', 'SETPIECE ', 'Prepared ')):
            print(line)
    if res.returncode != 0:
        print("STDERR:", res.stderr[-1500:], file=sys.stderr)
        sys.exit(res.returncode)
