extends Node
## Lantern Vale look-dev prototype.  Builds everything in code from data/*.json so the look is reproducible.
## Run windowed:  godot --path .            Screenshot:  godot --path . -- --shot=shots/plaza.png --view=plaza

const WATER_Y := -0.32
const HALF := 48.0
var SUN_K := float(OS.get_environment("SUN_K")) if OS.get_environment("SUN_K") != "" else 0.50     # linear-space equivalents of the three.js x2.3 sun / x1.75 hemi (those were tuned in display space)
var AMBIENT_K := float(OS.get_environment("AMB_K")) if OS.get_environment("AMB_K") != "" else 0.36
const PIXEL := 3  # same as Pipeline.pixelScale in render.js

var biome: Dictionary
var town: Dictionary
var toon_shader: Shader = load("res://shaders/toon.gdshader")
var water_shader: Shader = load("res://shaders/water.gdshader")
var post_shader: Shader = load("res://shaders/post.gdshader")
var world: Node3D
var cam: Camera3D
var water_mat: ShaderMaterial
var post_mat: ShaderMaterial
var clock := 0.0
var shot_path := ""
var shot_frames := 0
var view := "plaza"

func _read_json(p: String) -> Variant:
	return JSON.parse_string(FileAccess.get_file_as_string(p))

func _col(h: String) -> Color:
	return Color.html(h)

func toon(c: Color, vcol := false) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = toon_shader
	m.set_shader_parameter("albedo", c)
	m.set_shader_parameter("use_vertex_color", vcol)
	return m

# ---------- terrain ----------
func ground_h(x: float, z: float) -> float:
	var r := Vector2(x, z).length()
	var n := sin(x * 0.21) * 0.16 + sin(z * 0.17 + 1.3) * 0.14 + sin((x + z) * 0.43) * 0.07
	var h := 0.0
	if r > 27.0:
		var t := clampf((r - 27.0) / 8.0, 0.0, 1.0)
		h = -smoothstep(0.0, 1.0, t) * 3.4
	else:
		h = n * clampf((r - 12.0) / 6.0, 0.0, 1.0)  # keep the town flat
	# pond (south-east) and a small stream lobe
	var pd := Vector2(x - 12.5, z - 17.5).length()
	if pd < 6.5:
		h = minf(h, -0.1 - (1.0 - smoothstep(2.0, 6.5, pd)) * 1.3)
	return h

func build_terrain() -> void:
	var cell := 0.8
	var n := int(HALF * 2.0 / cell)
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var grass := _col(biome.grass); var gl := _col(biome.grassLight); var gd := _col(biome.grassDark)
	var sand := _col(biome.sand); var wet := _col(biome.sandWet); var rock := _col(biome.rock)
	var rng := RandomNumberGenerator.new(); rng.seed = 7
	for i in n:
		for j in n:
			var x0 := -HALF + i * cell; var z0 := -HALF + j * cell
			var p: Array = [Vector3(x0, ground_h(x0, z0), z0), Vector3(x0 + cell, ground_h(x0 + cell, z0), z0),
				Vector3(x0 + cell, ground_h(x0 + cell, z0 + cell), z0 + cell), Vector3(x0, ground_h(x0, z0 + cell), z0 + cell)]
			var cx := x0 + cell * 0.5; var cz := z0 + cell * 0.5
			var h: float = (p[0].y + p[2].y) * 0.5
			var c: Color
			var tone := sin(cx * 0.53) * sin(cz * 0.47) + sin(cx * 0.19 + cz * 0.23) * 0.8 + sin(cx * 1.7 + cz * 1.3) * 0.25
			c = grass.lerp(gl if tone > 0.35 else gd, 0.55 if absf(tone) > 0.35 else 0.0)
			var slope: float = absf(p[0].y - p[2].y) + absf(p[1].y - p[3].y)
			if slope > 0.9: c = rock
			elif h < -0.1 and Vector2(cx, cz).length() > 20.0: c = sand if h > WATER_Y - 0.25 else wet
			# town paving ground under the plaza
			if Vector2(cx, cz).length() < 8.0: c = _col("#b3a78f")
			for tri in [[0, 1, 2], [0, 2, 3]]:
				for k in tri:
					st.set_color(c.srgb_to_linear())
					st.add_vertex(p[k])
	st.generate_normals()
	var mi := MeshInstance3D.new()
	mi.mesh = st.commit()
	mi.material_override = toon(Color.WHITE, true)
	world.add_child(mi)

func build_water() -> void:
	# multi-source BFS distance-to-land texture, like World.buildWater in world.js
	var gw := 192
	var dist := PackedFloat32Array(); dist.resize(gw * gw)
	var q: Array[int] = []
	var step_w := HALF * 2.0 / gw
	for k in gw * gw:
		var x := -HALF + (k % gw + 0.5) * step_w; var z := -HALF + (k / gw + 0.5) * step_w
		if ground_h(x, z) > WATER_Y: dist[k] = 0.0; q.append(k)
		else: dist[k] = 9999.0
	var qi := 0
	while qi < q.size():
		var k := q[qi]; qi += 1
		var cx := k % gw; var cy := k / gw
		for o in [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]:
			var nx: int = cx + o.x; var ny: int = cy + o.y
			if nx < 0 or ny < 0 or nx >= gw or ny >= gw: continue
			var nk := ny * gw + nx
			if dist[nk] > dist[k] + 1.0: dist[nk] = dist[k] + 1.0; q.append(nk)
	var img := Image.create(gw, gw, false, Image.FORMAT_RF)
	for k in gw * gw:
		var dw: float = minf(dist[k] * step_w, 8.0) / 8.0
		img.set_pixel(k % gw, k / gw, Color(dw, 0, 0, 1))
	var tex := ImageTexture.create_from_image(img)
	water_mat = ShaderMaterial.new(); water_mat.shader = water_shader
	water_mat.set_shader_parameter("shore_tex", tex)
	water_mat.set_shader_parameter("half_size", HALF)
	water_mat.set_shader_parameter("deep", Vector3(biome.waterDeep[0], biome.waterDeep[1], biome.waterDeep[2]))
	water_mat.set_shader_parameter("shallow", Vector3(biome.waterShallow[0], biome.waterShallow[1], biome.waterShallow[2]))
	water_mat.set_shader_parameter("line_col", Vector3(biome.waterLine[0], biome.waterLine[1], biome.waterLine[2]))
	var pm := PlaneMesh.new(); pm.size = Vector2(700, 700)
	var mi := MeshInstance3D.new(); mi.mesh = pm; mi.material_override = water_mat
	mi.position.y = WATER_Y; mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	world.add_child(mi)

# ---------- prop helpers ----------
func prop(mesh: Mesh, c: Color, pos: Vector3, rot_y_deg := 0.0, parent: Node3D = null) -> MeshInstance3D:
	var mi := MeshInstance3D.new(); mi.mesh = mesh; mi.material_override = toon(c.srgb_to_linear() if false else c)
	mi.position = pos; mi.rotation_degrees.y = rot_y_deg
	(parent if parent else world).add_child(mi)
	return mi

func box(sz: Vector3) -> BoxMesh:
	var b := BoxMesh.new(); b.size = sz; return b

func cyl(rt: float, rb: float, h: float, seg := 8) -> CylinderMesh:
	var c := CylinderMesh.new(); c.top_radius = rt; c.bottom_radius = rb; c.height = h; c.radial_segments = seg; c.rings = 1; return c

func blob(r: float) -> SphereMesh:
	var s := SphereMesh.new(); s.radius = r; s.height = r * 2.0; s.radial_segments = 7; s.rings = 4; return s

func gy(x: float, z: float) -> float:
	return maxf(ground_h(x, z), 0.0)

func cottage(pos: Vector2, rot: float, roof: Color, w: float, d: float, floors: int, wall := Color("#f6ebd0")) -> void:
	var g := Node3D.new(); g.position = Vector3(pos.x, gy(pos.x, pos.y), pos.y); g.rotation_degrees.y = rot; world.add_child(g)
	var wh := 1.7 * floors
	prop(box(Vector3(w, wh, d)), wall, Vector3(0, wh * 0.5, 0), 0, g)
	prop(box(Vector3(w + 0.04, 0.12, d + 0.04)), Color("#a58b6a"), Vector3(0, 0.06, 0), 0, g)
	if floors > 1: prop(box(Vector3(w + 0.1, 0.14, d + 0.1)), Color("#8e6a46"), Vector3(0, 1.7, 0), 0, g)
	var rf := PrismMesh.new(); rf.size = Vector3(w + 0.7, 1.3 + w * 0.1, d + 0.7)
	var r := prop(rf, roof, Vector3(0, wh + rf.size.y * 0.5, 0), 0, g)
	prop(box(Vector3(0.7, 1.2, 0.08)), Color("#7a4e32"), Vector3(0, 0.6, d * 0.5 + 0.03), 0, g)
	for fl in floors:
		prop(box(Vector3(0.6, 0.55, 0.08)), Color("#7fc4e8"), Vector3(w * 0.28, 0.9 + fl * 1.7, d * 0.5 + 0.03), 0, g)
		prop(box(Vector3(0.6, 0.55, 0.08)), Color("#7fc4e8"), Vector3(-w * 0.28, 0.9 + fl * 1.7, d * 0.5 + 0.03), 0, g)
	prop(box(Vector3(0.4, 1.0, 0.4)), Color("#b0a08a"), Vector3(w * 0.3, wh + 1.1, -d * 0.2), 0, g)

func tree(pos: Vector2, s: float, round := true, c_over := Color(0, 0, 0, 0)) -> void:
	var g := Node3D.new(); g.position = Vector3(pos.x, gy(pos.x, pos.y), pos.y); g.scale = Vector3.ONE * s; world.add_child(g)
	var trunk := _col(biome.trunk)
	if round:
		prop(cyl(0.25, 0.4, 2.4, 6), trunk, Vector3(0, 1.2, 0), 0, g)
		var leaves: Array = biome.pine
		var base := _col(biome.leaf[0]) if c_over.a == 0 else c_over
		prop(blob(1.9), base, Vector3(0, 3.5, 0), 0, g)
		prop(blob(1.4), base.lightened(0.12), Vector3(1.0, 4.2, 0.4), 0, g)
		prop(blob(1.3), base.darkened(0.1), Vector3(-0.9, 3.9, -0.5), 0, g)
	else:
		prop(cyl(0.18, 0.28, 1.2, 6), trunk, Vector3(0, 0.6, 0), 0, g)
		prop(cyl(0.0, 1.3, 4.8, 7), _col(biome.pine[0]), Vector3(0, 3.4, 0), 0, g)
		prop(cyl(0.0, 1.0, 3.2, 7), _col(biome.pine[1]), Vector3(0, 5.2, 0), 0, g)

func lamp(pos: Vector2) -> void:
	var g := Node3D.new(); g.position = Vector3(pos.x, gy(pos.x, pos.y), pos.y); world.add_child(g)
	prop(cyl(0.06, 0.09, 2.3, 5), Color("#2c2a30"), Vector3(0, 1.15, 0), 0, g)
	var l := prop(box(Vector3(0.34, 0.4, 0.34)), Color("#ffd26a"), Vector3(0, 2.45, 0), 0, g)
	(l.material_override as ShaderMaterial).set_shader_parameter("emission_boost", 0.8)
	prop(cyl(0.0, 0.3, 0.25, 4), Color("#2c2a30"), Vector3(0, 2.78, 0), 45, g)

func bench(pos: Vector2) -> void:
	var g := Node3D.new(); g.position = Vector3(pos.x, gy(pos.x, pos.y), pos.y)
	g.rotation.y = atan2(-pos.x, -pos.y) + PI  # faces plaza centre
	world.add_child(g)
	prop(box(Vector3(1.6, 0.12, 0.45)), Color("#a63c2e"), Vector3(0, 0.45, 0), 0, g)
	prop(box(Vector3(1.6, 0.4, 0.1)), Color("#a63c2e"), Vector3(0, 0.8, -0.22), 0, g)
	prop(box(Vector3(0.1, 0.45, 0.4)), Color("#6a4a32"), Vector3(-0.7, 0.22, 0), 0, g)
	prop(box(Vector3(0.1, 0.45, 0.4)), Color("#6a4a32"), Vector3(0.7, 0.22, 0), 0, g)

func paver_instances(items: Array) -> void:
	# items: [pos Vector3, size Vector3, rotY, Color]
	var mm := MultiMesh.new(); mm.transform_format = MultiMesh.TRANSFORM_3D; mm.use_colors = true
	mm.mesh = box(Vector3(1, 1, 1)); mm.instance_count = items.size()
	for i in items.size():
		var it: Array = items[i]
		var b := Basis(Vector3.UP, it[2]).scaled(it[1])
		mm.set_instance_transform(i, Transform3D(b, it[0]))
		mm.set_instance_color(i, (it[3] as Color).srgb_to_linear())
	var mmi := MultiMeshInstance3D.new(); mmi.multimesh = mm; mmi.material_override = toon(Color.WHITE, true)
	world.add_child(mmi)

func fountain_mat() -> ShaderMaterial:
	var m := water_mat.duplicate() as ShaderMaterial
	var img := Image.create(2, 2, false, Image.FORMAT_RF); img.fill(Color(0.2, 0, 0, 1))  # constant shore distance ~1.6 m -> shallow band + ripples
	m.set_shader_parameter("shore_tex", ImageTexture.create_from_image(img))
	m.set_shader_parameter("half_size", 100000.0)
	return m

func build_town() -> void:
	var rng := RandomNumberGenerator.new(); rng.seed = 11
	var tone: Array = []
	for t in town.paving: tone.append(_col(t))
	var pav: Array = []
	# plaza rings
	var rad := 3.5
	while rad < 7.6:
		var n := int(round(rad * TAU / 0.66))
		for i in n:
			var a := (i + fmod(rad * 3.0, 1.0)) / n * TAU
			pav.append([Vector3(cos(a) * rad, 0.07, sin(a) * rad), Vector3(0.6 * (0.8 + rng.randf() * 0.3), 0.08, 0.6 * (0.8 + rng.randf() * 0.3)), rng.randf() * 3.14, tone[rng.randi() % tone.size()]])
		rad += 0.56
	for s in town.streets:
		var f := Vector2(s.from[0], s.from[1]); var t := Vector2(s.to[0], s.to[1])
		var ln := f.distance_to(t); var u := (t - f) / ln
		var steps := int(ceil(ln / 0.62)); var m := int(round(s.width / 0.62))
		for i in steps + 1:
			for k in m:
				var off := (k - (m - 1) / 2.0) * 0.62 + (i % 2) * 0.12
				var p := f + u * i * 0.62 + Vector2(-u.y, u.x) * off
				pav.append([Vector3(p.x, gy(p.x, p.y) + 0.06, p.y), Vector3(0.56, 0.08, 0.56), atan2(u.x, u.y), tone[rng.randi() % tone.size()]])
	paver_instances(pav)
	# fountain
	var g0 := gy(0, 0)
	prop(cyl(3.45, 3.45, 0.1, 8), _col("#e8dec6"), Vector3(0, g0 + 0.07, 0))
	for i in 8:
		var a := i / 8.0 * TAU + 0.3927
		prop(box(Vector3(2.5, 0.42, 0.55)), _col("#f0e6cf"), Vector3(cos(a) * 3.3, g0 + 0.25, sin(a) * 3.3), rad_to_deg(-a - PI * 0.5))
	var pool := MeshInstance3D.new(); var pm := CylinderMesh.new(); pm.top_radius = 2.7; pm.bottom_radius = 2.7; pm.height = 0.02; pm.radial_segments = 16
	pool.mesh = pm; pool.material_override = fountain_mat(); pool.position = Vector3(0, g0 + 0.2, 0); world.add_child(pool)
	prop(cyl(0.45, 0.6, 1.2, 8), _col("#d8cfb8"), Vector3(0, g0 + 0.8, 0))
	# buildings
	for h in town.homes:
		cottage(Vector2(h.pos[0], h.pos[1]), h.rotY, _col(h.roof), h.w, h.d, int(h.floors), _col(town.wallColor))
	var L: Dictionary = town.layout
	cottage(Vector2(L.tavern[0], L.tavern[1]), 90, _col("#c95a42"), 6.4, 4.6, 2, Color("#f3e2c0"))
	cottage(Vector2(L.forge[0] + 2.8, L.forge[1]), -90, _col("#e0553c"), 4.2, 3.4, 1)
	cottage(Vector2(L.guild[0], L.guild[1]), 90, _col("#58a0e0"), 6.0, 4.8, 2, Color("#e9dcc0"))
	# market stalls
	for sp in [[11.6, 4.6, "#e0553c"], [14.8, 4.6, "#58a0e0"]]:
		var g := Node3D.new(); g.position = Vector3(sp[0], gy(sp[0], sp[1]), sp[2 - 1]); g.rotation.y = PI; world.add_child(g)
		prop(box(Vector3(2.2, 0.9, 1.0)), Color("#8a5a38"), Vector3(0, 0.45, 0), 0, g)
		for k in 6:
			prop(box(Vector3(0.37, 0.1, 1.9)), _col(sp[2]) if k % 2 == 0 else Color("#fff6e4"), Vector3(-0.92 + k * 0.37, 2.0 - 0.02 * abs(k - 2.5), -0.1), 0, g)
		prop(box(Vector3(0.08, 2.0, 0.08)), Color("#6a4a32"), Vector3(-1.0, 1.0, 0.6), 0, g)
		prop(box(Vector3(0.08, 2.0, 0.08)), Color("#6a4a32"), Vector3(1.0, 1.0, 0.6), 0, g)
	# quest board, forge anvil, map table markers
	var bd: Array = L.board
	prop(box(Vector3(0.14, 2.0, 0.14)), Color("#6a4a32"), Vector3(bd[0] - 0.6, gy(bd[0], bd[1]) + 1.0, bd[1]))
	prop(box(Vector3(0.14, 2.0, 0.14)), Color("#6a4a32"), Vector3(bd[0] + 0.6, gy(bd[0], bd[1]) + 1.0, bd[1]))
	prop(box(Vector3(1.6, 1.0, 0.1)), Color("#f4dfba"), Vector3(bd[0], gy(bd[0], bd[1]) + 1.5, bd[1]))
	for l in town.lampPosts: lamp(Vector2(l[0], l[1]))
	for b in town.benches: bench(Vector2(b[0], b[1]))
	for i in town.roundTrees.size():
		var t: Array = town.roundTrees[i]; tree(Vector2(t[0], t[1]), 1.0 + (i % 3) * 0.15)
	for i in town.cypress.size():
		var t: Array = town.cypress[i]; tree(Vector2(t[0], t[1]), 1.3 + (i % 3) * 0.25, false)
	for b in town.blossom:
		tree(Vector2(b.pos[0], b.pos[1]), 1.0, true, _col(b.color) if b.color else _col("#ffb3c9"))
	# flower beds
	var rng2 := RandomNumberGenerator.new(); rng2.seed = 3
	for bed in [[-6.6, -2.4, 0], [6.6, -2.4, 1]]:
		prop(box(Vector3(1.9, 0.22, 1.0)), Color("#b0a89a"), Vector3(bed[0], gy(bed[0], bed[1]) + 0.11, bed[1]))
		for k in 22:
			var fc: Color = [Color("#ffd45a"), Color("#ff8fb0"), Color("#ffffff"), Color("#ffb3c9")][rng2.randi() % 4]
			prop(blob(0.1), fc, Vector3(bed[0] + (rng2.randf() - 0.5) * 1.5, gy(bed[0], bed[1]) + 0.3, bed[1] + (rng2.randf() - 0.5) * 0.7))
	# lone shoreline trees by the pond
	tree(Vector2(18.5, 14.5), 1.1); tree(Vector2(6.0, 21.5), 0.9)

# ---------- environment, lights, camera, post ----------
func setup_env() -> void:
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = _col("#c6dcff")
	var sky := Sky.new(); var sm := ProceduralSkyMaterial.new()
	sm.sky_top_color = _col(biome.sky); sm.sky_horizon_color = _col(biome.sky); sm.ground_bottom_color = _col(biome.ground); sm.ground_horizon_color = _col(biome.ground)
	sky.sky_material = sm
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.ambient_light_energy = biome.ambient * AMBIENT_K
	env.tonemap_mode = Environment.TONE_MAPPER_LINEAR
	var we := WorldEnvironment.new(); we.environment = env; add_child(we)
	var sun := DirectionalLight3D.new()
	sun.light_color = _col(biome.sun)
	sun.light_energy = biome.sunI * SUN_K
	sun.shadow_enabled = true
	sun.directional_shadow_mode = DirectionalLight3D.SHADOW_ORTHOGONAL
	sun.directional_shadow_max_distance = 120.0
	sun.position = Vector3(-12, 26, 8)
	world.add_child(sun)
	sun.look_at(Vector3.ZERO, Vector3.UP)

func set_camera(target: Vector3, dist: float, yaw := 0.62) -> void:
	var horiz := dist * 0.73
	cam.position = target + Vector3(sin(yaw) * horiz, dist * 0.68, cos(yaw) * horiz)
	cam.look_at(target + Vector3(0, 0.5, 0))

func setup_viewport() -> void:
	var sz := Vector2i(1280, 720)
	var svc := SubViewportContainer.new()
	svc.stretch = true; svc.stretch_shrink = PIXEL
	svc.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	svc.set_anchors_preset(Control.PRESET_FULL_RECT)
	var cl := CanvasLayer.new(); add_child(cl); cl.add_child(svc)
	var sv := SubViewport.new(); sv.size = sz / PIXEL; sv.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	svc.add_child(sv)
	world = Node3D.new(); sv.add_child(world)
	cam = Camera3D.new(); cam.fov = 34.0; cam.near = 2.0; cam.far = 190.0; cam.current = true; world.add_child(cam)

func setup_post() -> void:
	post_mat = ShaderMaterial.new(); post_mat.shader = post_shader
	var g: Array = biome.grade; var s: Array = biome.shaft
	post_mat.set_shader_parameter("grade", Vector3(g[0], g[1], g[2]))
	post_mat.set_shader_parameter("shaft_col", Vector3(s[0], s[1], s[2]))
	var qm := QuadMesh.new(); qm.size = Vector2(2, 2)
	var mi := MeshInstance3D.new(); mi.mesh = qm; mi.material_override = post_mat
	mi.extra_cull_margin = 16384.0; mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	cam.add_child(mi)

func _ready() -> void:
	biome = _read_json("res://data/biomes.json").biomes[0]
	town = _read_json("res://data/town.json")
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--shot="): shot_path = a.substr(7)
		if a.begins_with("--view="): view = a.substr(7)
	setup_viewport()
	setup_env()
	build_terrain()
	build_water()
	build_town()
	match view:
		"pond": set_camera(Vector3(8, 0, 12), 24)
		"overview": set_camera(Vector3(0, 0, 0), 62)
		_: set_camera(Vector3(0, 0, 0), 34)
	if not OS.get_cmdline_user_args().has("--nopost"): setup_post()
	if shot_path != "": clock = 4.0
	print("[proto] scene built in ", Time.get_ticks_msec(), " ms")

func _process(dt: float) -> void:
	if shot_path == "": clock += dt
	water_mat.set_shader_parameter("time_s", clock)
	if post_mat: post_mat.set_shader_parameter("time_s", clock)
	if shot_path != "":
		shot_frames += 1
		print("[proto] frame ", shot_frames, " t=", Time.get_ticks_msec())
		if shot_frames == 12:
			var img := get_viewport().get_texture().get_image()
			img.save_png(shot_path)
			print("saved ", shot_path, " ", img.get_size())
			get_tree().quit()
