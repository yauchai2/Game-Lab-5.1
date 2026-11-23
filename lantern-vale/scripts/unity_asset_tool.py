#!/usr/bin/env python3
"""
Unity .unitypackage 輕量提取與 Blender Headless GLB 轉換工具
用法：
  python3 scripts/unity_asset_tool.py list <pkg.unitypackage> [keyword]
  python3 scripts/unity_asset_tool.py extract <pkg.unitypackage> <keyword> <out_dir>
  python3 scripts/unity_asset_tool.py to-glb <input.fbx|obj> <output.glb> [target_height]
"""
import os
import sys
import tarfile
import tempfile
import subprocess
from pathlib import Path

BLENDER = "/Applications/Blender.app/Contents/MacOS/blender"


def index_unitypackage(pkg_path):
    """回傳 {guid: pathname} 映射表"""
    guids = {}
    with tarfile.open(pkg_path, "r:*") as tf:
        for m in tf.getmembers():
            parts = m.name.lstrip("./").split("/")
            if len(parts) == 2 and parts[1] == "pathname":
                f = tf.extractfile(m)
                if f:
                    raw = f.read().decode("utf-8", errors="ignore").splitlines()
                    if raw:
                        guids[parts[0]] = raw[0].strip()
    return guids


def cmd_list(pkg_path, keyword=""):
    kw = keyword.lower()
    guids = index_unitypackage(pkg_path)
    exts = (".fbx", ".obj", ".glb", ".gltf", ".png", ".jpg", ".tga")
    hits = []
    for guid, p in sorted(guids.items(), key=lambda kv: kv[1]):
        pl = p.lower()
        if not any(pl.endswith(e) for e in exts):
            continue
        if kw and kw not in pl:
            continue
        hits.append(p)
    print(f"Found {len(hits)} matching assets in {os.path.basename(pkg_path)}:")
    for h in hits[:120]:
        print(" ", h)
    if len(hits) > 120:
        print(f"  ... ({len(hits) - 120} more)")


def cmd_extract(pkg_path, keyword, out_dir):
    kw = keyword.lower()
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    guids = index_unitypackage(pkg_path)
    want = {}
    for guid, p in guids.items():
        pl = p.lower()
        if kw in pl and any(pl.endswith(e) for e in (".fbx", ".obj", ".glb", ".gltf", ".png", ".jpg", ".tga")):
            want[guid] = p
    if not want:
        print("No matching assets found.")
        return
    count = 0
    with tarfile.open(pkg_path, "r:*") as tf:
        for m in tf.getmembers():
            parts = m.name.lstrip("./").split("/")
            if len(parts) == 2 and parts[1] == "asset" and parts[0] in want:
                rel = want[parts[0]].lstrip("/")
                dest = out / Path(rel).name
                f = tf.extractfile(m)
                if f:
                    dest.write_bytes(f.read())
                    print("Extracted:", dest)
                    count += 1
    print(f"Done: extracted {count} files to {out}")


def cmd_to_glb(inp, out_glb, target_h="4.0"):
    if not os.path.exists(BLENDER):
        sys.exit(f"Blender not found at {BLENDER}")
    script = f"""
import bpy, mathutils, os
bpy.ops.wm.read_factory_settings(use_empty=True)
inp = {repr(os.path.abspath(inp))}
out = {repr(os.path.abspath(out_glb))}
ext = os.path.splitext(inp)[1].lower()
if ext == '.fbx':
    bpy.ops.import_scene.fbx(filepath=inp)
elif ext == '.obj':
    bpy.ops.wm.obj_import(filepath=inp)
else:
    raise RuntimeError('Unsupported format: ' + ext)

# Remove lights & cameras
for obj in list(bpy.data.objects):
    if obj.type in ('LIGHT', 'CAMERA'):
        bpy.data.objects.remove(obj, do_unlink=True)

# Compute combined mesh bounds & normalize height + bottom to Y/Z=0
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
if meshes:
    min_x = min_y = min_z = 1e9
    max_x = max_y = max_z = -1e9
    for o in meshes:
        for v in o.bound_box:
            w = o.matrix_world @ mathutils.Vector(v)
            min_x, max_x = min(min_x, w.x), max(max_x, w.x)
            min_y, max_y = min(min_y, w.y), max(max_y, w.y)
            min_z, max_z = min(min_z, w.z), max(max_z, w.z)
    h = max(max_z - min_z, 1e-4)
    sc = {float(target_h)} / h
    cx, cy = (min_x + max_x) * 0.5, (min_y + max_y) * 0.5
    roots = [o for o in bpy.data.objects if o.parent is None]
    for r in roots:
        r.location.x = (r.location.x - cx) * sc
        r.location.y = (r.location.y - cy) * sc
        r.location.z = (r.location.z - min_z) * sc
        r.scale = (r.scale.x * sc, r.scale.y * sc, r.scale.z * sc)

os.makedirs(os.path.dirname(out), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=out,
    export_format='GLB',
    export_animations=False,
    export_materials='EXPORT',
    export_draco_mesh_compression_enable=False,
)
print('Exported GLB:', out)
"""
    with tempfile.NamedTemporaryFile("w", suffix=".py", delete=False) as tf:
        tf.write(script)
        py_path = tf.name
    try:
        subprocess.run([BLENDER, "--background", "--python", py_path], check=True)
    finally:
        os.unlink(py_path)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    cmd = sys.argv[1]
    if cmd == "list":
        cmd_list(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else "")
    elif cmd == "extract":
        cmd_extract(sys.argv[2], sys.argv[3], sys.argv[4])
    elif cmd == "to-glb":
        cmd_to_glb(sys.argv[2], sys.argv[3], sys.argv[4] if len(sys.argv) > 4 else "4.0")
    else:
        print(__doc__)
        sys.exit(1)
