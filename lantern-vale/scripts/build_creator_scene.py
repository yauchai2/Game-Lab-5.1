#!/usr/bin/env python3
"""
Extract `Location mountain ship` (`mountain ship with env.prefab`) from
`Low Poly Locations Ultimate Pack 1.0.0.unitypackage`, assemble all 70+
instances in Blender with exact Unity transforms and `texture main.png`,
and export `game/assets/scenes/creator_mountain_ship.glb`.
"""
import json, os, re, shutil, subprocess, sys, tarfile

PKG = '/Users/alanchan/Desktop/Game-Lab/temporary/assets/scenes02/Low Poly Locations Ultimate Pack 1.0.0.unitypackage'
BLENDER = '/Applications/Blender.app/Contents/MacOS/Blender'
WORK = '/tmp/lv_mountain_ship'
OUT_GLB = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'game', 'assets', 'scenes', 'creator_mountain_ship.glb'))


def parse_leaf_prefab(yaml_text):
    """Extract default Transform (pos, rot, scale) and referenced FBX guid from a leaf prefab."""
    fbx_m = re.search(r'm_Mesh:\s*\{[^}]*guid:\s*([0-9a-f]{32})', yaml_text)
    fbx_guid = fbx_m.group(1) if fbx_m else None
    pos = [0.0, 0.0, 0.0]
    rot = [0.0, 0.0, 0.0, 1.0]
    scl = [1.0, 1.0, 1.0]
    m = re.search(r'm_LocalPosition:\s*\{x:\s*([^,]+),\s*y:\s*([^,]+),\s*z:\s*([^}]+)\}', yaml_text)
    if m: pos = [float(m.group(1)), float(m.group(2)), float(m.group(3))]
    m = re.search(r'm_LocalRotation:\s*\{x:\s*([^,]+),\s*y:\s*([^,]+),\s*z:\s*([^,]+),\s*w:\s*([^}]+)\}', yaml_text)
    if m: rot = [float(m.group(1)), float(m.group(2)), float(m.group(3)), float(m.group(4))]
    m = re.search(r'm_LocalScale:\s*\{x:\s*([^,]+),\s*y:\s*([^,]+),\s*z:\s*([^}]+)\}', yaml_text)
    if m: scl = [float(m.group(1)), float(m.group(2)), float(m.group(3))]
    return {'fbx_guid': fbx_guid, 'pos': pos, 'rot': rot, 'scl': scl}


def parse_scene_prefab(yaml_text, leaf_map):
    """Parse all PrefabInstance blocks inside `mountain ship with env.prefab`."""
    instances = []
    blocks = yaml_text.split('--- !u!1001 ')
    for blk in blocks[1:]:
        src_m = re.search(r'm_SourcePrefab:\s*\{[^}]*guid:\s*([0-9a-f]{32})', blk)
        if not src_m:
            continue
        prefab_guid = src_m.group(1)
        leaf = leaf_map.get(prefab_guid)
        if not leaf or not leaf['fbx_guid']:
            continue
        pos = list(leaf['pos'])
        rot = list(leaf['rot'])
        scl = list(leaf['scl'])
        name = leaf['name']
        # Parse m_Modifications key/value pairs
        mods = re.findall(r'propertyPath:\s*([^\n]+)\n\s*value:\s*([^\n]*)', blk)
        for prop, val in mods:
            prop = prop.strip()
            val = val.strip()
            if prop == 'm_Name' and val:
                name = val
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
        instances.append({
            'name': name,
            'fbx_guid': leaf['fbx_guid'],
            'fbx_file': leaf['fbx_file'],
            'pos': pos,
            'rot': rot,
            'scl': scl,
        })
    return instances


def extract_assets():
    if os.path.exists(WORK):
        shutil.rmtree(WORK)
    os.makedirs(WORK, exist_ok=True)
    os.makedirs(os.path.dirname(OUT_GLB), exist_ok=True)

    with tarfile.open(PKG, 'r:gz') as tf:
        members = {m.name: m for m in tf.getmembers()}
        guid_to_path = {}
        for name, m in members.items():
            if name.endswith('/pathname'):
                g = name.split('/')[0]
                guid_to_path[g] = tf.extractfile(m).read().decode('utf-8', 'ignore').splitlines()[0].strip()

        root_guid = [g for g, p in guid_to_path.items() if p.endswith('mountain ship with env.prefab')][0]
        tex_guid = [g for g, p in guid_to_path.items() if p.endswith('Textures/texture main.png')][0]
        root_yaml = tf.extractfile(members[f'{root_guid}/asset']).read().decode('utf-8', 'ignore')

        # Extract texture main.png
        tex_path = os.path.join(WORK, 'texture_main.png')
        with open(tex_path, 'wb') as f:
            f.write(tf.extractfile(members[f'{tex_guid}/asset']).read())

        # Collect all referenced leaf prefabs
        ref_guids = set(re.findall(r'guid:\s*([0-9a-f]{32})', root_yaml))
        leaf_map = {}
        fbx_guids = set()
        for g in ref_guids:
            p = guid_to_path.get(g, '')
            if p.endswith('.prefab'):
                y = tf.extractfile(members[f'{g}/asset']).read().decode('utf-8', 'ignore')
                info = parse_leaf_prefab(y)
                info['name'] = os.path.splitext(os.path.basename(p))[0]
                if info['fbx_guid']:
                    fbx_guids.add(info['fbx_guid'])
                    info['fbx_file'] = f"{info['fbx_guid']}.fbx"
                leaf_map[g] = info

        # Extract all referenced FBX files
        for fg in fbx_guids:
            out_fbx = os.path.join(WORK, f'{fg}.fbx')
            with open(out_fbx, 'wb') as f:
                f.write(tf.extractfile(members[f'{fg}/asset']).read())

        instances = parse_scene_prefab(root_yaml, leaf_map)
        manifest = {
            'tex_path': tex_path,
            'out_glb': OUT_GLB,
            'work': WORK,
            'instances': instances,
        }
        manifest_path = os.path.join(WORK, 'manifest.json')
        with open(manifest_path, 'w') as f:
            json.dump(manifest, f, indent=2)
        print(f"Extracted {len(fbx_guids)} FBXs and {len(instances)} instances -> {manifest_path}")
        return manifest_path


BLENDER_SCRIPT = r'''
import bpy, json, math, os, sys
from mathutils import Matrix, Quaternion, Vector

argv = sys.argv[sys.argv.index('--') + 1:]
with open(argv[0]) as f:
    manifest = json.load(f)

bpy.ops.wm.read_factory_settings(use_empty=True)

# Single shared palette material using texture main.png
mat = bpy.data.materials.new(name='PalmovMain')
mat.use_nodes = True
nt = mat.node_tree
nt.nodes.clear()
out_node = nt.nodes.new('ShaderNodeOutputMaterial')
bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
nt.links.new(bsdf.outputs['BSDF'], out_node.inputs['Surface'])
bsdf.inputs['Roughness'].default_value = 0.88
if 'Specular IOR Level' in bsdf.inputs:
    bsdf.inputs['Specular IOR Level'].default_value = 0.12
elif 'Specular' in bsdf.inputs:
    bsdf.inputs['Specular'].default_value = 0.12

tex_node = nt.nodes.new('ShaderNodeTexImage')
img = bpy.data.images.load(manifest['tex_path'])
img.pack()
tex_node.image = img
tex_node.interpolation = 'Closest'
nt.links.new(tex_node.outputs['Color'], bsdf.inputs['Base Color'])

# Import each unique FBX once and bake its local mesh transform
mesh_cache = {}
work = manifest['work']

for inst in manifest['instances']:
    fg = inst['fbx_guid']
    if fg in mesh_cache:
        continue
    fbx_path = os.path.join(work, inst['fbx_file'])
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=fbx_path, use_custom_normals=True, ignore_leaf_bones=True)
    added = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in added if o.type == 'MESH']
    if not meshes:
        mesh_cache[fg] = None
        for o in added:
            bpy.data.objects.remove(o, do_unlink=True)
        continue
    # Apply transforms and join if multiple meshes inside one FBX
    bpy.ops.object.select_all(action='DESELECT')
    for m in meshes:
        m.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if len(meshes) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    mesh_data = obj.data
    mesh_data.name = f"mesh_{fg[:8]}"
    mesh_cache[fg] = mesh_data
    for o in list(bpy.data.objects):
        if o in added or o == obj:
            bpy.data.objects.remove(o, do_unlink=True)

# Coordinate conversion: Unity (left-handed Y-up) -> Blender (right-handed Z-up)
# glTF exporter then maps Blender (bx, by, bz) -> glTF/Three.js (bx, bz, -by)
# Unity (ux, uy, uz) -> glTF (-ux, uy, uz) => Blender (-ux, -uz, uy)
# Basis change matrix M from Unity to Blender:
# [ -1,  0,  0 ]
# [  0,  0, -1 ]
# [  0,  1,  0 ]
# Note: det(M) = -1 (handedness flip). For rotation quaternion (qx, qy, qz, qw) in Unity:
# In glTF right-handed Y-up: q_gltf = (w=qw, x=qx, y=-qy, z=-qz)
# Then glTF Y-up -> Blender Z-up is +90 deg around X: R_x(+90) * R_gltf * R_x(-90)
rx_p90 = Quaternion((1.0, 0.0, 0.0), math.radians(90.0))
rx_m90 = Quaternion((1.0, 0.0, 0.0), math.radians(-90.0))

scene_root = bpy.data.objects.new('MountainShipRoot', None)
bpy.context.collection.objects.link(scene_root)

key_bounds = {}
for idx, inst in enumerate(manifest['instances']):
    md = mesh_cache.get(inst['fbx_guid'])
    if not md:
        continue
    obj = bpy.data.objects.new(f"{inst['name']}_{idx}", md)
    bpy.context.collection.objects.link(obj)
    obj.parent = scene_root

    ux, uy, uz = inst['pos']
    qx, qy, qz, qw = inst['rot']
    sx, sy, sz = inst['scl']

    # Position in Blender Z-up
    obj.location = Vector((-ux, -uz, uy))
    # Rotation: Unity -> glTF -> Blender Z-up
    q_gltf = Quaternion((qw, qx, -qy, -qz)).normalized()
    q_bl = (rx_p90 @ q_gltf @ rx_m90).normalized()
    obj.rotation_mode = 'QUATERNION'
    obj.rotation_quaternion = q_bl
    # Scale (swap Y/Z for Blender Z-up)
    obj.scale = Vector((sx, sz, sy))

bpy.context.view_layer.update()

# Compute overall and key landmark bounds in glTF/Three.js coordinates (bx, bz, -by)
def bl_to_gltf(v):
    return (v.x, v.z, -v.y)

all_min = [1e9, 1e9, 1e9]
all_max = [-1e9, -1e9, -1e9]
for o in bpy.data.objects:
    if o.type != 'MESH':
        continue
    bmin = [1e9, 1e9, 1e9]
    bmax = [-1e9, -1e9, -1e9]
    for corner in o.bound_box:
        w = o.matrix_world @ Vector(corner)
        gx, gy, gz = bl_to_gltf(w)
        for i, val in enumerate((gx, gy, gz)):
            bmin[i] = min(bmin[i], val)
            bmax[i] = max(bmax[i], val)
            all_min[i] = min(all_min[i], val)
            all_max[i] = max(all_max[i], val)
    for k in ('island mountain ship', 'destroyed ship 5', 'observation tower', 'water location mountain ship', 'mountain 4'):
        if o.name.startswith(k):
            key_bounds[o.name] = {'min': [round(x, 2) for x in bmin], 'max': [round(x, 2) for x in bmax]}

print("OVERALL_GLTF_MIN:", [round(x, 2) for x in all_min])
print("OVERALL_GLTF_MAX:", [round(x, 2) for x in all_max])
for k, v in sorted(key_bounds.items()):
    print(f"LANDMARK {k}: min={v['min']} max={v['max']}")

# Export optimized GLB
bpy.ops.export_scene.gltf(
    filepath=manifest['out_glb'],
    export_format='GLB',
    use_selection=False,
    export_yup=True,
    export_apply=False,
    export_materials='EXPORT',
    export_texcoords=True,
    export_normals=True,
    export_draco_mesh_compression_enable=False,
)
print("EXPORTED_GLB:", manifest['out_glb'], "SIZE_KB:", round(os.path.getsize(manifest['out_glb'])/1024, 1))
'''


if __name__ == '__main__':
    manifest_path = extract_assets()
    bl_py = os.path.join(WORK, 'assemble.py')
    with open(bl_py, 'w') as f:
        f.write(BLENDER_SCRIPT)
    cmd = [BLENDER, '--background', '--python', bl_py, '--', manifest_path]
    res = subprocess.run(cmd, capture_output=True, text=True)
    print(res.stdout[-3500:])
    if res.returncode != 0:
        print("STDERR:", res.stderr[-2000:], file=sys.stderr)
        sys.exit(res.returncode)
