// Full-screen post pass for the low-res SubViewport: depth outline, hard-edged cloud shadows, light shafts,
// grade, saturation, 9-step luminance quantise, vignette. Ported from lantern-vale/src/render.js.
shader_type spatial;
render_mode unshaded, depth_test_disabled, cull_disabled, skip_vertex_transform;

uniform sampler2D screen_tex : hint_screen_texture, filter_nearest;
uniform sampler2D depth_tex : hint_depth_texture, filter_nearest;
uniform vec3 grade = vec3(1.04, 1.02, 0.96);
uniform vec3 shaft_col = vec3(1.0, 0.94, 0.70);
uniform float shaft_k = 1.0;
uniform float cloud_k = 0.45;
uniform float sat = 1.13;
uniform float time_s = 0.0;

float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
	return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float s=0.0,a=0.5; for(int i=0;i<4;i++){ s+=a*noise(p); p*=2.02; a*=0.5;} return s; }

void vertex() { POSITION = vec4(VERTEX.xy, 1.0, 1.0); }

vec3 view_pos(vec2 uv, float depth, mat4 inv_proj) {
	vec3 ndc = vec3(uv * 2.0 - 1.0, depth * 2.0 - 1.0); // OpenGL (Compatibility) depth range
	vec4 v = inv_proj * vec4(ndc, 1.0);
	return v.xyz / v.w;
}

void fragment() {
	vec2 uv = SCREEN_UV;
	vec2 px = 1.0 / vec2(textureSize(screen_tex, 0));
	vec3 col = pow(texture(screen_tex, uv).rgb, vec3(1.0/2.2)); // back to display space
	float d0 = texture(depth_tex, uv).r;
	vec3 vp0 = view_pos(uv, d0, INV_PROJECTION_MATRIX);
	float l0 = -vp0.z;
	// --- outline: darken the nearer side of depth discontinuities (hue-shifted, never black)
	float edge = 0.0;
	vec2 offs[4] = vec2[4](vec2(px.x,0.0), vec2(-px.x,0.0), vec2(0.0,px.y), vec2(0.0,-px.y));
	for (int i = 0; i < 4; i++) {
		float di = texture(depth_tex, uv + offs[i]).r;
		float li = -view_pos(uv + offs[i], di, INV_PROJECTION_MATRIX).z;
		if (li - l0 > 0.06 * l0 + 0.15) edge = 1.0;
	}
	// --- cloud shadows: binarised fbm blobs in world space, cool-tinted
	vec3 wp = (INV_VIEW_MATRIX * vec4(vp0, 1.0)).xyz;
	vec2 cwp = floor(wp.xz * 3.0) / 3.0;
	float cloud = fbm(cwp*0.035 + vec2(time_s*0.010, time_s*0.005)) * 0.75 + noise(cwp*0.21 + 4.0 - time_s*0.01) * 0.25;
	float cs = step(0.47, cloud) * step(d0, 0.9999) * cloud_k;
	vec3 shaded = col * vec3(0.52, 0.72, 0.98);
	shaded = mix(vec3(dot(shaded, vec3(0.299,0.587,0.114))), shaded, 1.3);
	col = mix(col, shaded, cs);
	col = mix(col, col * vec3(0.58,0.60,0.74), edge * 0.85);
	// --- light shafts (diagonal, parallax with camera)
	vec2 sp = uv + CAMERA_POSITION_WORLD.xz * vec2(0.006,-0.004);
	float s = sp.x*0.9 + sp.y*0.55;
	float sh = smoothstep(0.55, 1.0, noise(vec2(s*5.0 + time_s*0.03, 0.5))) * 0.7
	         + smoothstep(0.7, 1.0, noise(vec2(s*13.0 - time_s*0.02, 3.0))) * 0.35;
	sh *= smoothstep(-0.1, 0.9, 1.0 - uv.y*0.7 + uv.x*0.3);
	col += shaft_col * sh * 0.11 * shaft_k;
	// --- grade, saturation, 9-step luminance quantise, vignette
	col *= grade;
	float lum = dot(col, vec3(0.299,0.587,0.114));
	col = mix(vec3(lum), col, sat);
	float Lq = floor(lum*9.0+0.5)/9.0;
	col *= clamp((Lq+0.02)/(lum+0.02), 0.78, 1.28);
	col = col*0.96 + vec3(0.02,0.012,0.03);
	vec2 vc = uv - 0.5;
	col *= 1.0 - dot(vc,vc)*0.22;
	ALBEDO = pow(clamp(col, 0.0, 1.0), vec3(2.2));
}
