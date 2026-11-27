import * as THREE from 'three';
import { windPatch } from './world.js';

// Low-resolution render -> post pass (outline, cloud shadows, light shafts, grade) -> nearest upscale via CSS.
export class Pipeline {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    THREE.ColorManagement.enabled = false;
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.setPixelRatio(1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.info.autoReset = false;
    this.pixelScale = 2;
    this.normalMat = new THREE.MeshNormalMaterial();
    this.postScene = new THREE.Scene();
    this.postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.postMat = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: null }, tDepth: { value: null }, tNormal: { value: null },
        uRes: { value: new THREE.Vector2() }, uTime: { value: 0 },
        uNear: { value: 1 }, uFar: { value: 100 }, uInvVP: { value: new THREE.Matrix4() },
        uGrade: { value: new THREE.Vector3(1, 1, 1) }, uShaft: { value: new THREE.Vector3(1, 0.9, 0.6) }, uShaftK: { value: 1 },
        uCam: { value: new THREE.Vector3() }, uHurt: { value: 0 }, uFade: { value: 0 }, uSat: { value: 1.13 },
        uOutline: { value: new THREE.Vector3(0.58, 0.60, 0.74) }, uCloud: { value: 1 },
        // Dev Tuner 美術參數（預設值＝原本畫面，改這些不影響正式遊玩）
        uHue: { value: 0 }, uContrast: { value: 1 }, uBright: { value: 1 },
        uTint: { value: new THREE.Vector3(1, 1, 1) }, uShadowTint: { value: new THREE.Vector3(1, 1, 1) }, uHighTint: { value: new THREE.Vector3(1, 1, 1) }, uSplit: { value: 0 },
        uEdgeStr: { value: 0.85 }, uEdgeThick: { value: 1 }, uEdgeSens: { value: 1 }, uCrease: { value: 0.5 },
        uSteps: { value: 9 }, uStepMix: { value: 1 },
        uRimStr: { value: 0 }, uRimPow: { value: 2.5 }, uRimCol: { value: new THREE.Vector3(1, 0.92, 0.75) },
        uCloudCol: { value: new THREE.Vector3(0.60, 0.78, 0.98) },
        uBloom: { value: 0 }, uBloomThr: { value: 0.7 }, uBloomRad: { value: 3 },
        uVig: { value: 0.22 }, uGrain: { value: 0 },
      },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }`,
      fragmentShader: `
        uniform sampler2D tColor, tDepth, tNormal; uniform vec2 uRes; uniform float uTime, uNear, uFar, uHurt, uFade, uSat, uShaftK, uCloud;
        uniform float uHue, uContrast, uBright, uSplit, uEdgeStr, uEdgeThick, uEdgeSens, uCrease, uSteps, uStepMix, uRimStr, uRimPow, uBloom, uBloomThr, uBloomRad, uVig, uGrain;
        uniform vec3 uTint, uShadowTint, uHighTint, uRimCol, uCloudCol;
        uniform mat4 uInvVP; uniform vec3 uGrade, uShaft, uCam, uOutline; varying vec2 vUv;
        float lin(float d){ float z=d*2.0-1.0; return 2.0*uNear*uFar/(uFar+uNear-z*(uFar-uNear)); }
        float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
        float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
          return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
        float fbm(vec2 p){ float s=0.0,a=0.5; for(int i=0;i<4;i++){ s+=a*noise(p); p*=2.02; a*=0.5;} return s; }
        void main(){
          vec2 px = 1.0/uRes;
          vec3 col = texture2D(tColor, vUv).rgb;
          float d0 = texture2D(tDepth, vUv).r;
          float l0 = lin(d0);
          vec3 n0 = texture2D(tNormal, vUv).rgb*2.0-1.0;
          // --- outline: darken the nearer side of depth discontinuities, lighten crisp creases
          float edge = 0.0, crease = 0.0;
          vec2 ep = px*uEdgeThick; vec2 offs[4]; offs[0]=vec2(ep.x,0.0); offs[1]=vec2(-ep.x,0.0); offs[2]=vec2(0.0,ep.y); offs[3]=vec2(0.0,-ep.y);
          for(int i=0;i<4;i++){
            float li = lin(texture2D(tDepth, vUv+offs[i]).r);
            if (li - l0 > (0.06*l0 + 0.15)/uEdgeSens) edge = 1.0;
            vec3 ni = texture2D(tNormal, vUv+offs[i]).rgb*2.0-1.0;
            if (dot(ni,n0) < 0.75 && abs(li-l0) < 0.04*l0) crease = max(crease, 1.0);
          }
          // --- world position for cloud shadows
          vec4 ndc = vec4(vUv*2.0-1.0, d0*2.0-1.0, 1.0);
          vec4 wp = uInvVP*ndc; wp/=wp.w;
          // 柔和有機雲影（移除 floor 格仔量化，平滑飄過丘陵草地）
          vec2 cwp = wp.xz;
          float cloud = fbm(cwp*0.032 + vec2(uTime*0.010, uTime*0.005)) * 0.75 + noise(cwp*0.18 + 4.0 - uTime*0.01) * 0.25;
          float cs = smoothstep(0.45, 0.58, cloud) * step(d0, 0.9999) * uCloud * 0.52;
          vec3 shaded = col * uCloudCol;
          shaded = mix(vec3(dot(shaded, vec3(0.299,0.587,0.114))), shaded, 1.25);
          col = mix(col, shaded, cs);
          col = mix(col, col*1.10+0.015, crease*uCrease*(1.0-edge));
          // 輪廓：只暗化同色相，不用黑線（A Short Hike 幾乎無黑邊）
          col = mix(col, col*uOutline, edge*uEdgeStr);
          // 邊緣光（法線為 view space，z 朝向鏡頭）
          if (uRimStr > 0.001) col += uRimCol * pow(1.0 - clamp(n0.z, 0.0, 1.0), uRimPow) * step(d0, 0.9999) * uRimStr;
          // 簡易 bloom：8 點環狀取樣亮部
          if (uBloom > 0.001) { vec3 bl = vec3(0.0); for (int i=0;i<8;i++){ float a=float(i)*0.7854; vec3 c2=texture2D(tColor, vUv+vec2(cos(a),sin(a))*px*uBloomRad).rgb; bl += max(c2-uBloomThr, 0.0); } col += bl/8.0*uBloom*2.0; }
          // --- light shafts (diagonal, parallax with camera)
          vec2 sp = vUv + uCam.xz*vec2(0.006,-0.004);
          float s = sp.x*0.9 + sp.y*0.55;
          float sh = smoothstep(0.55, 1.0, noise(vec2(s*5.0 + uTime*0.03, 0.5))) * 0.7
                   + smoothstep(0.7, 1.0, noise(vec2(s*13.0 - uTime*0.02, 3.0))) * 0.35;
          sh *= smoothstep(-0.1, 0.9, 1.0 - vUv.y*0.7 + vUv.x*0.3);
          col += uShaft * sh * 0.11 * uShaftK;
          // thin wind streaks (sparse)
          float ws = sp.x*0.55 - sp.y*0.9 + uTime*0.015;
          float wl = step(0.995, noise(vec2(ws*80.0, floor(uTime*0.3)))) * step(0.7, noise(vec2(vUv.x*3.0+uTime*0.2, vUv.y*3.0)));
          col += wl*0.25*uShaftK;
          // --- grade: warm lift, saturation, vignette
          col *= uGrade * uTint;
          if (abs(uHue) > 0.0001) { // YIQ 色相旋轉
            float ch=cos(uHue), sh2=sin(uHue);
            mat3 toYIQ = mat3(0.299,0.596,0.211, 0.587,-0.274,-0.523, 0.114,-0.322,0.312);
            mat3 toRGB = mat3(1.0,1.0,1.0, 0.956,-0.272,-1.106, 0.621,-0.647,1.703);
            vec3 yiq = toYIQ*col; yiq.yz = mat2(ch,sh2,-sh2,ch)*yiq.yz; col = toRGB*yiq;
          }
          col = (col-0.5)*uContrast+0.5; col *= uBright;
          float lum0 = dot(col, vec3(0.299,0.587,0.114));
          col *= mix(vec3(1.0), uShadowTint, (1.0-smoothstep(0.1,0.6,lum0))*uSplit) * mix(vec3(1.0), uHighTint, smoothstep(0.4,0.9,lum0)*uSplit);
          float lum = dot(col, vec3(0.299,0.587,0.114));
          col = mix(vec3(lum), col, uSat);
          // 亮度分階（平塗感）：把明度量化成 9 階，保留色相
          float Lq = floor(lum*uSteps+0.5)/uSteps; col *= mix(1.0, clamp((Lq+0.02)/(lum+0.02), 0.78, 1.28), uStepMix);
          col = col*0.96 + vec3(0.02,0.012,0.03);
          vec2 vc = vUv-0.5; float vig = 1.0 - dot(vc,vc)*uVig;
          col *= vig;
          col = mix(col, vec3(0.75,0.08,0.12), uHurt*smoothstep(0.15,0.6,length(vc)));
          col = mix(col, vec3(0.08,0.06,0.12), uFade);
          // gentle ordered dither to keep low-res gradients pixel-y
          float bayer = mod(floor(gl_FragCoord.x)+floor(gl_FragCoord.y)*2.0, 4.0)/4.0 - 0.375;
          col += (hash(gl_FragCoord.xy + fract(uTime)*37.0) - 0.5) * uGrain;
          gl_FragColor = vec4(col, 1.0);
        }`,
      depthTest: false, depthWrite: false,
    });
    this.postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.postMat));
    this.rt = null; this.rtN = null;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }
  setPixelScale(s) { this.pixelScale = s; this.resize(); }
  resize() {
    const W = window.innerWidth, H = window.innerHeight;
    // target === 1 表示關閉低解像像素效果（原畫高清），>= 2 為復古低像素倍率
    const target = this.pixelScale;
    const scale = target <= 1 ? Math.min(window.devicePixelRatio || 1, 2) : (1 / target);
    const w = Math.max(160, Math.floor(W * scale)), h = Math.max(90, Math.floor(H * scale));
    this.w = w; this.h = h;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = W + 'px';
    this.renderer.domElement.style.height = H + 'px';
    this.renderer.domElement.style.imageRendering = target <= 1 ? 'auto' : 'pixelated';
    if (this.rt) { this.rt.dispose(); this.rtN.dispose(); }
    const dt = new THREE.DepthTexture(w, h); dt.type = THREE.UnsignedIntType;
    const filt = target <= 1 ? THREE.LinearFilter : THREE.NearestFilter;
    this.rt = new THREE.WebGLRenderTarget(w, h, { minFilter: filt, magFilter: filt, depthTexture: dt });
    this.rtN = new THREE.WebGLRenderTarget(w, h, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    this.postMat.uniforms.uRes.value.set(w, h);
    if (this.onResize) this.onResize(w, h);
  }
  render(scene, camera, t) {
    const r = this.renderer, u = this.postMat.uniforms;
    r.info.reset();
    r.setRenderTarget(this.rt); r.render(scene, camera);
    // normal pass (no shadows needed)
    const sm = r.shadowMap.autoUpdate; r.shadowMap.autoUpdate = false;
    const hidden = [], swapped = [], nm = this.normalMat, cache = this.windNormals || (this.windNormals = new Map());
    scene.traverse(o => {
      if (o.userData.noNormal && o.visible) { o.visible = false; hidden.push(o); return; }
      if (!o.material || o.material === nm) return;
      const w = o.material.userData && o.material.userData.wind;
      let m = nm;
      if (w) { const key = w.join(','); m = cache.get(key); if (!m) { m = windPatch(new THREE.MeshNormalMaterial(), w); cache.set(key, m); } }
      swapped.push(o, o.material); o.material = m;
    });
    r.setRenderTarget(this.rtN); r.render(scene, camera);
    for (let i = 0; i < swapped.length; i += 2) swapped[i].material = swapped[i + 1];
    hidden.forEach(o => o.visible = true);
    r.shadowMap.autoUpdate = sm;
    u.tColor.value = this.rt.texture; u.tDepth.value = this.rt.depthTexture; u.tNormal.value = this.rtN.texture;
    u.uTime.value = t; u.uNear.value = camera.near; u.uFar.value = camera.far;
    u.uInvVP.value.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).invert();
    u.uCam.value.copy(camera.position);
    r.setRenderTarget(null); r.render(this.postScene, this.postCam);
  }
}
