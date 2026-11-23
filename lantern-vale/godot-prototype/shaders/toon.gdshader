// A Short Hike-style 4-step toon ramp, ported from three.js MeshToonMaterial gradientMap [140,188,238,255].
shader_type spatial;
render_mode diffuse_lambert, specular_disabled;

uniform vec4 albedo : source_color = vec4(1.0);
uniform bool use_vertex_color = true;
uniform bool flat_shading = true;
uniform float emission_boost = 0.0;

varying vec3 vcol;

void vertex() { vcol = COLOR.rgb; }

void fragment() {
	ALBEDO = albedo.rgb * (use_vertex_color ? vcol : vec3(1.0));
	if (flat_shading) {
		NORMAL = normalize(cross(dFdx(VERTEX), dFdy(VERTEX)));
	}
	EMISSION = ALBEDO * emission_boost;
	ROUGHNESS = 1.0;
}

void light() {
	float nl = dot(NORMAL, LIGHT);
	float coord = clamp(nl * 0.5 + 0.5, 0.0, 0.9999);
	int idx = int(floor(coord * 4.0));
	float ramp = idx == 0 ? 0.549 : (idx == 1 ? 0.737 : (idx == 2 ? 0.933 : 1.0));
	DIFFUSE_LIGHT += ramp * LIGHT_COLOR * ATTENUATION / PI;
}
