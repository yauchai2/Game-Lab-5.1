// Painterly water: 3 depth bands (shore-distance field), contour doodles, shore foam + travelling wave line,
// shallow voronoi caustics, ripple rings, sparkles and horizontal pixel dashes. Ported from lantern-vale/src/world.js.
shader_type spatial;
render_mode unshaded, cull_disabled;

uniform sampler2D shore_tex : filter_linear;
uniform float half_size = 48.0;
uniform float time_s = 0.0;
uniform vec3 deep = vec3(0.18, 0.52, 0.78);
uniform vec3 shallow = vec3(0.38, 0.82, 0.88);
uniform vec3 line_col = vec3(0.66, 0.92, 0.98);
varying vec3 vW;

float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
	return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float s=0.0,a=0.5; for(int i=0;i<4;i++){ s+=a*noise(p); p*=2.03; a*=0.5;} return s; }
vec2 h22(vec2 p){ return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453); }
float vor(vec2 p, float t){ vec2 g=floor(p), f=fract(p); float d1=8.0, d2=8.0;
	for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){ vec2 o=vec2(float(i),float(j)); vec2 r=h22(g+o); r=0.5+0.45*sin(t+6.2831*r); float d=length(o+r-f); if(d<d1){d2=d1;d1=d;} else if(d<d2){d2=d;} }
	return d2-d1; }
float rings(vec2 p, float t){ vec2 g=floor(p), f=fract(p); float acc=0.0;
	for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){ vec2 o=vec2(float(i),float(j)); vec2 id=g+o; vec2 r=h22(id); float on=step(0.55,h22(id+3.7).x);
		float ph=fract(t*0.22+r.x*3.0+h22(id+9.1).y); vec2 c=o+0.2+r*0.6; float dd=length(c-f); float rad=ph*1.15;
		float ring=1.0-smoothstep(0.0,0.045,abs(dd-rad)); float ring2=1.0-smoothstep(0.0,0.035,abs(dd-rad*0.62));
		acc+=on*(ring+ring2*0.7)*(1.0-ph)*(1.0-ph); }
	return clamp(acc,0.0,1.0); }

void vertex() { vW = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }

void fragment() {
	float uTime = time_s;
	vec2 uv = (vW.xz + half_size) / (half_size * 2.0);
	float inside = step(0.0,uv.x)*step(uv.x,1.0)*step(0.0,uv.y)*step(uv.y,1.0);
	float d = mix(1.0, texture(shore_tex, uv).r, inside) * 8.0;
	float depthT = smoothstep(0.0, 6.0, d);
	float wb0 = (noise(vW.xz*0.9+uTime*0.1)-0.5)*0.9;
	float bandT = step(1.3+wb0, d) * 0.5 + step(3.6+wb0*1.4, d) * 0.5;
	vec3 col = mix(shallow, deep, bandT);
	vec2 p = vW.xz*0.16 + vec2(uTime*0.03, uTime*0.02);
	float n = fbm(p + fbm(p*1.3 - uTime*0.02)*1.2);
	float l = abs(fract(n*5.0) - 0.5);
	col = mix(col, line_col, (1.0-smoothstep(0.035,0.06,l))*0.55*(0.4+0.6*depthT));
	float wob = (noise(vW.xz*1.7+uTime*0.4)-0.5)*0.25;
	float rim = 1.0 - smoothstep(0.62, 0.72, d + wob);
	float wave = fract(uTime*0.22);
	float wl = abs(d + wob - (0.45 + wave*1.3));
	float waveLine = (1.0 - smoothstep(0.05, 0.13, wl)) * (1.0-wave) * (1.0 - step(2.2, d));
	float band2 = (1.0 - smoothstep(0.9, 1.05, d+wob)) * 0.35;
	col = mix(col, shallow*1.15, band2);
	col = mix(col, vec3(1.0,0.99,0.95), clamp(rim + waveLine*0.85, 0.0, 1.0));
	float shallowT = (1.0 - smoothstep(0.7, 3.2, d)) * smoothstep(0.35, 0.8, d);
	float vl = 1.0 - smoothstep(0.03, 0.11, vor(vW.xz*0.55 + vec2(uTime*0.03, 0.0), uTime*0.5));
	col = mix(col, vec3(0.9,0.98,1.0), vl * shallowT * 0.55);
	float rg = rings(vW.xz*0.22, uTime) * smoothstep(1.2, 4.0, d);
	col = mix(col, vec3(0.92,0.98,1.0), rg * 0.6);
	float sp = step(0.985, noise(vW.xz*3.0 + vec2(uTime*0.6,-uTime*0.4))) * depthT;
	vec2 dashCell = vec2(floor(vW.x * 0.65 + sin(floor(vW.z * 2.2) + uTime * 0.55) * 0.35), floor(vW.z * 2.2));
	vec2 dashUv = vec2(fract(vW.x * 0.65 + sin(floor(vW.z * 2.2) + uTime * 0.55) * 0.35), fract(vW.z * 2.2));
	float dashOn = step(0.86, hash(dashCell)) * step(0.18, dashUv.x) * step(dashUv.x, 0.82) * step(0.38, dashUv.y) * step(dashUv.y, 0.62);
	col = mix(col, vec3(0.98, 1.0, 1.0), clamp(dashOn * 0.72 * smoothstep(0.6, 2.0, d), 0.0, 0.8));
	col += sp*0.35;
	// design colours live in display (sRGB) space, like the three.js build with ColorManagement off
	ALBEDO = pow(col, vec3(2.2));
}
