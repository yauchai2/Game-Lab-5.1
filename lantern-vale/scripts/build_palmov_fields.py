#!/usr/bin/env python3
"""
Phase W3-W5: Batch-export 20 signature `Locations with Env` Palmov setpieces
(one bespoke hero landmark diorama for each of the 20 Field Maps in Lantern Vale)
-> game/assets/scenes/field_01.glb .. field_20.glb
"""
import json, os, re, shutil, subprocess, sys, tarfile

PKG = '/Users/alanchan/Desktop/Game-Lab/temporary/assets/scenes02/Low Poly Locations Ultimate Pack 1.0.0.unitypackage'
BLENDER = '/Applications/Blender.app/Contents/MacOS/Blender'
WORK = '/tmp/lv_palmov_fields'
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT_SCENES = os.path.join(ROOT_DIR, 'game', 'assets', 'scenes')

# 20 Field Maps -> (prefab_rel, target_horizontal_span_m, strip_keywords)
FIELD_SETPIECES = {
    1:  ('Low Poly Nature/bridge over river with env.prefab',         20.0, ['water', 'land ']),
    2:  ('Low Poly Nature/camping birch forest with env.prefab',      20.0, ['water', 'land ']),
    3:  ('Low poly Island/shamanic island with env.prefab',           19.0, ['water', 'land ']),
    4:  ('Low Poly Winter/crystal mountain with env.prefab',          22.0, ['water', 'land ']),
    5:  ('Low Poly Western/coal mine with env.prefab',                21.0, ['water', 'land ']),
    6:  ('Low Poly Japanese/old palace forest with env.prefab',       21.0, ['water', 'land ']),
    7:  ('Low Poly Sea/ancient artifacts with env.prefab',            20.0, ['water', 'land ']),
    8:  ('Low poly Island/adventure island with env.prefab',          20.0, ['water', 'land ']),
    9:  ('Low Poly Sea/lighthouse pier with env.prefab',              20.0, ['water', 'land ']),
    10: ('Low Poly Japanese/japanese lake with env.prefab',           21.0, ['water', 'land ']),
    11: ('Low Poly Nature/air balloons with env.prefab',              22.0, ['water', 'land ']),
    12: ('Low Poly Autumn/autumn hot springs with env.prefab',        20.0, ['water', 'land ']),
    13: ('Low Poly Desert/arab castle with env.prefab',               21.0, ['water', 'land ']),
    14: ('Low Poly Desert/desert pyramids with env.prefab',           23.0, ['water', 'land ']),
    15: ('Low Poly Desert/tropical ruins with env.prefab',            21.0, ['water', 'land ']),
    16: ('Low Poly Autumn/cemetery haunted house with env.prefab',    20.0, ['water', 'land ']),
    17: ('Low Poly Autumn/abandoned house with env.prefab',           19.0, ['water', 'land ']),
    18: ('Low Poly Sea/sea monster attack with env.prefab',           22.0, ['water', 'land ']),
    19: ('Low Poly Space/space station with env.prefab',              22.0, ['water', 'land ']),
    20: ('Low Poly Space/ufo crash with env.prefab',                  21.0, ['water', 'land ']),
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

        tex_g = p2g['Textures/texture main.png']
        tex_path = os.path.join(WORK, 'texture_main.png')
        with open(tex_path, 'wb') as f:
            f.write(tf.extractfile(members[f'{tex_g}/asset']).read())

        needed_fbx = set()
        jobs = []
        leaf_cache = {}
        for fid, (prefab_rel, span, strip_kws) in sorted(FIELD_SETPIECES.items()):
            full_rel = 'Prefabs/Locations with Env/' + prefab_rel
            rg = p2g.get(full_rel)
            if not rg:
                print(f"ERROR: missing prefab for field {fid}: {full_rel}")
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
            insts = parse_scene_prefab(ry, leaf_map, strip_kws)
            jobs.append({
                'fid': fid,
                'span': span,
                'instances': insts,
                'out': os.path.join(OUT_SCENES, f'field_{fid:02d}.glb'),
            })

        for fg in needed_fbx:
            with open(os.path.join(WORK, f'{fg}.fbx'), 'wb') as f:
                f.write(tf.extractfile(members[f'{fg}/asset']).read())

        mp = os.path.join(WORK, 'manifest.json')
        with open(mp, 'w') as f:
            json.dump({'work': WORK, 'tex_path': tex_path, 'jobs': jobs}, f)
        print(f"Prepared {len(jobs)} field setpieces ({len(needed_fbx)} unique FBXs)")
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

for job in manifest['jobs']:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mat = make_mat()
    cache = {}
    objs = []
    for idx, inst in enumerate(job['instances']):
        fg = inst['fbx_guid']
        if fg not in cache: cache[fg] = import_fbx_mesh(fg, mat)
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
    if not objs:
        print(f"SKIP field_{job['fid']:02d}: 0 objs")
        continue
    bmin = [1e9, 1e9, 1e9]; bmax = [-1e9, -1e9, -1e9]
    for o in objs:
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            for i in range(3): bmin[i] = min(bmin[i], w[i]); bmax[i] = max(bmax[i], w[i])
    cur_span = max(0.01, bmax[0] - bmin[0], bmax[1] - bmin[1])
    sc = job['span'] / cur_span
    cx = (bmin[0] + bmax[0]) / 2.0
    cy = (bmin[1] + bmax[1]) / 2.0
    zmin = bmin[2]
    for o in objs:
        o.location = Vector(((o.location.x - cx) * sc, (o.location.y - cy) * sc, (o.location.z - zmin) * sc))
        o.scale *= sc
    bpy.ops.export_scene.gltf(filepath=job['out'], export_format='GLB', export_yup=True, export_materials='EXPORT', export_texcoords=True, export_normals=True)
    kb = round(os.path.getsize(job['out']) / 1024, 1)
    print(f"FIELD_{job['fid']:02d}: {len(objs):3d} objs, span={job['span']}m -> {kb}KB")
'''


if __name__ == '__main__':
    mp = extract_all()
    bl_py = os.path.join(WORK, 'export_fields.py')
    with open(bl_py, 'w') as f: f.write(BLENDER_SCRIPT)
    res = subprocess.run([BLENDER, '--background', '--python', bl_py, '--', mp], capture_output=True, text=True)
    for line in res.stdout.splitlines():
        if line.startswith(('FIELD_', 'SKIP ', 'Prepared ')):
            print(line)
    if res.returncode != 0:
        print("STDERR:", res.stderr[-1500:], file=sys.stderr)
        sys.exit(res.returncode)
