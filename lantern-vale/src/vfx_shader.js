// Phase V2：Piloto Studio 風格 Three.js 特效著色器（對齊 UberFXSG Pixelated）
// 支援：雙色漸層著色、UV 捲動、噪點溶解＋亮邊、Flipbook 序列幀、Fresnel 邊緣發光、像素對齊取樣
import * as THREE from 'three';

export const VFX_THEMES = {
  fire:     { a: 0xfff08a, b: 0xff5a22, rim: 0xffb84a },
  bluefire: { a: 0xb8f8ff, b: 0x1e88ff, rim: 0x6ce8ff },
  frost:    { a: 0xffffff, b: 0x58c8ff, rim: 0xaef4ff },
  thunder:  { a: 0xfff8b0, b: 0x7a68ff, rim: 0x8ce8ff },
  arcane:   { a: 0xffe4ff, b: 0x9c4eff, rim: 0xd4a0ff },
  death:    { a: 0xff9ad8, b: 0x6a1e9c, rim: 0xc848ff },
  lotus:    { a: 0xfff4d8, b: 0xff7aa8, rim: 0x96f0b8 },
  holy:     { a: 0xffffff, b: 0xffc83a, rim: 0xfff2a0 },
  wind:     { a: 0xf0fff8, b: 0x4ad89a, rim: 0xa8ffe0 },
  earth:    { a: 0xffe6a0, b: 0xc87432, rim: 0x98e06a },
  poison:   { a: 0xd8ff8a, b: 0x38a84e, rim: 0x8ef078 },
  heal:     { a: 0xf4fff0, b: 0x4ed878, rim: 0xffe88a },
};

const VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vViewDir;

void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vViewDir = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform sampler2D uNoise;
uniform float uHasMap;
uniform float uHasNoise;
uniform float uTime;
uniform vec2 uScroll;
uniform vec2 uGrid;
uniform float uFrame;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uRimColor;
uniform float uRimPow;
uniform float uDissolve;
uniform float uOpacity;
uniform float uPixelSnap;
uniform float uSolid;

varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vViewDir;

void main() {
  vec2 uv = vUv;
  if (uPixelSnap > 0.5) {
    uv = floor(uv * uPixelSnap) / uPixelSnap;
  }

  // Flipbook 序列幀或連續 UV 捲動
  vec2 sampleUv = uv;
  if (uGrid.x > 1.0 || uGrid.y > 1.0) {
    float cols = uGrid.x;
    float rows = uGrid.y;
    float f = floor(mod(uFrame, cols * rows));
    float cx = mod(f, cols);
    float cy = floor(f / cols);
    sampleUv = vec2((cx + uv.x) / cols, 1.0 - (cy + 1.0 - uv.y) / rows);
  } else {
    sampleUv = uv + uScroll * uTime;
  }

  float mask = 1.0;
  vec3 texRgb = vec3(1.0);
  if (uHasMap > 0.5) {
    vec4 t = texture2D(uMap, sampleUv);
    texRgb = t.rgb;
    float lum = dot(t.rgb, vec3(0.299, 0.587, 0.114));
    // Piloto 貼圖多採黑底發光（t.a=1, rgb=0），實心 3D 模型則保留全不透明
    mask = uSolid > 0.5 ? t.a : (t.a * smoothstep(0.08, 0.42, lum));
  }

  // 噪點溶解與灼熱亮邊
  float nVal = 1.0;
  if (uHasNoise > 0.5) {
    nVal = texture2D(uNoise, uv * 1.4 + uScroll * uTime * 0.7).r;
  }
  float edge = uSolid > 0.5
    ? smoothstep(uDissolve, uDissolve + 0.15, nVal)
    : smoothstep(uDissolve, uDissolve + 0.16, nVal * mask);
  if (edge < 0.04 || mask < 0.04) discard;

  vec3 nW = normalize(vNormalW);
  float rim = 0.0;
  if (uRimPow > 0.01) {
    float ndv = clamp(abs(dot(nW, normalize(vViewDir))), 0.0, 1.0);
    rim = pow(1.0 - ndv, uRimPow);
  }
  float sunShade = clamp(dot(nW, normalize(vec3(0.45, 0.85, 0.35))) * 0.5 + 0.55, 0.35, 1.0);

  // 雙色手繪漸層＋卡通光照＋Fresnel 邊緣發光
  float grad = uSolid > 0.5
    ? clamp(sunShade * 0.8 + rim * 0.35, 0.0, 1.0)
    : clamp(mask * 0.75 + rim * 0.45, 0.0, 1.0);
  if (uPixelSnap > 0.5) grad = floor(grad * 4.0) / 4.0;
  vec3 col = mix(uColorB, uColorA, grad);
  if (uHasMap > 0.5) {
    float sat = max(texRgb.r, max(texRgb.g, texRgb.b)) - min(texRgb.r, min(texRgb.g, texRgb.b));
    col = mix(col, texRgb * mix(vec3(1.0), uColorA, 0.3), smoothstep(0.12, 0.35, sat));
  }
  col += uRimColor * rim * 0.65;
  float burnBand = smoothstep(uDissolve + 0.18, uDissolve + 0.02, nVal * mask) * step(0.01, uDissolve);
  col = mix(col, uColorA * 1.45, burnBand * 0.8);

  float alpha = (uSolid > 0.5 ? edge : (edge * mask)) * uOpacity;
  gl_FragColor = vec4(col, alpha);
}
`;

export function createPilotoFxMaterial(opts = {}) {
  const theme = typeof opts.theme === 'string' ? (VFX_THEMES[opts.theme] || VFX_THEMES.fire) : (opts.theme || VFX_THEMES.fire);
  const colA = new THREE.Color(opts.colorA ?? theme.a);
  const colB = new THREE.Color(opts.colorB ?? theme.b);
  const rimCol = new THREE.Color(opts.rimColor ?? theme.rim);
  const additive = opts.additive !== false;

  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: opts.depthWrite ?? false,
    side: opts.doubleSide !== false ? THREE.DoubleSide : THREE.FrontSide,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: {
      uMap:       { value: opts.map || null },
      uNoise:     { value: opts.noise || null },
      uHasMap:    { value: opts.map ? 1.0 : 0.0 },
      uHasNoise:  { value: opts.noise ? 1.0 : 0.0 },
      uTime:      { value: 0 },
      uScroll:    { value: new THREE.Vector2(opts.scrollX ?? 0, opts.scrollY ?? 0) },
      uGrid:      { value: new THREE.Vector2(opts.cols ?? 1, opts.rows ?? 1) },
      uFrame:     { value: 0 },
      uColorA:    { value: colA },
      uColorB:    { value: colB },
      uRimColor:  { value: rimCol },
      uRimPow:    { value: opts.rimPow ?? 1.8 },
      uDissolve:  { value: opts.dissolve ?? 0.0 },
      uOpacity:   { value: opts.opacity ?? 0.95 },
      uPixelSnap: { value: opts.pixelSnap ?? 64.0 },
      uSolid:     { value: opts.solid ? 1.0 : 0.0 },
    },
  });
  return mat;
}
