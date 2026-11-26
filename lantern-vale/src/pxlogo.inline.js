/* Beaconfall pixel logo: hand-built bitmap lettering, no image assets. Classic script inlined into index.html by build.mjs so the boot splash can draw it before the game bundle runs. Exposes window.LVLogo. */
(function () {
  'use strict';
  var PAL = { white: '#fffdf4', cream: '#fff8e4', creamLo: '#ffe9a8', gold: '#ffcf4a', goldLo: '#f7a93a',
    orange: '#e8734a', brass: '#d08622', brassLo: '#8f4a1e', ink: '#24141c' };
  var GW = 11, GH = 17, GAP = 4, DEPTH = 3, PAD = 5, GLOW = 14, FLAME_H = 11;

  // 11x17 glyphs, 3px strokes, built from rectangles [x0,y0,x1,y1]
  var RECTS = {
    B: [[0, 0, 2, 16], [3, 0, 7, 2], [3, 7, 7, 9], [3, 14, 7, 16], [8, 1, 10, 7], [8, 9, 10, 15]],
    E: [[0, 0, 2, 16], [3, 0, 10, 2], [3, 7, 9, 9], [3, 14, 10, 16]],
    A: [[0, 3, 2, 16], [8, 3, 10, 16], [3, 0, 7, 2], [1, 1, 2, 2], [8, 1, 9, 2], [3, 9, 7, 11]],
    C: [[0, 1, 2, 15], [3, 0, 10, 2], [3, 14, 10, 16], [8, 3, 10, 5], [8, 11, 10, 13]],
    O: [[0, 1, 2, 15], [8, 1, 10, 15], [3, 0, 7, 2], [3, 14, 7, 16]],
    N: [[0, 0, 2, 16], [8, 0, 10, 16]],
    F: [[0, 0, 2, 16], [3, 0, 10, 2], [3, 7, 9, 9]],
    L: [[0, 0, 2, 16], [3, 14, 10, 16]]
  };
  function glyph(ch) {
    var m = [], y, x, i;
    for (y = 0; y < GH; y++) m.push(new Array(GW).fill(0));
    var rs = RECTS[ch].slice();
    if (ch === 'N') for (y = 2; y <= 14; y++) { x = 3 + Math.round((y - 2) * 3 / 12); rs.push([x, y, x + 2, y]); }
    rs.forEach(function (r) { for (y = r[1]; y <= r[3]; y++) for (x = r[0]; x <= r[2]; x++) m[y][x] = 1; });
    var at = function (a, b) { return m[b] && m[b][a] ? 1 : 0; };
    var o = m.map(function (r) { return r.slice(); });
    for (y = 0; y < GH; y++) for (x = 0; x < GW; x++) if (m[y][x]) {
      var u = at(x, y - 1), d = at(x, y + 1), l = at(x - 1, y), r = at(x + 1, y);
      if ((!u && !l) || (!u && !r) || (!d && !l) || (!d && !r)) o[y][x] = 0;
    }
    return o;
  }
  var TEXT = 'BEACONFALL', FLAME_IDX = 2;
  var W = TEXT.length * GW + (TEXT.length - 1) * GAP, MASK = [], CELLX = [];
  (function () {
    for (var y = 0; y < GH; y++) MASK.push(new Array(W).fill(0));
    var x0 = 0;
    TEXT.split('').forEach(function (ch) {
      var g = glyph(ch);
      for (var y = 0; y < GH; y++) for (var x = 0; x < GW; x++) if (g[y][x]) MASK[y][x0 + x] = 1;
      CELLX.push(x0); x0 += GW + GAP;
    });
  })();
  var FLAME_A = ['....o....', '...oo....', '...ooo...', '..ooyo...', '..oyyoo..', '.ooyywoo.', '.oyywwyo.', '.oywwwyo.', '.oywwwyo.', '..oyyyo..', '...ooo...'];
  var FLAME_B = ['.....o...', '....oo...', '...ooo...', '..oooyo..', '..oyyyo..', '.ooyywoo.', '.oyywwyo.', '.oywwwyo.', '.oywwwyo.', '..oyyyo..', '...ooo...'];
  var FCOL = { o: PAL.orange, y: PAL.gold, w: PAL.white };

  var CW = W + DEPTH + PAD * 2 + GLOW * 2;
  var CH = GH + DEPTH + PAD * 2 + FLAME_H + GLOW * 2;
  var OX = PAD + GLOW, OY = PAD + FLAME_H + GLOW;
  var LEAD = OY, BELOW = CH - (OY + GH + DEPTH);

  function on(x, y) { return MASK[y] && MASK[y][x]; }
  function solid(x, y) { for (var k = 0; k <= DEPTH; k++) if (on(x - k, y - k)) return true; return false; }

  // static layer (outline + extrusion + face gradient) — drawn once into an offscreen canvas
  var STATIC = null;
  function buildStatic() {
    var c = document.createElement('canvas'); c.width = CW; c.height = CH;
    var ctx = c.getContext('2d');
    var px = function (x, y, col) { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); };
    var x, y, k, dx, dy;
    for (y = -1; y <= GH + DEPTH; y++) for (x = -1; x <= W + DEPTH; x++) {
      var hit = false;
      for (dy = -1; dy <= 1 && !hit; dy++) for (dx = -1; dx <= 1 && !hit; dx++) if (solid(x + dx, y + dy)) hit = true;
      if (hit && !solid(x, y)) px(OX + x, OY + y, PAL.ink);
    }
    for (k = DEPTH; k >= 1; k--) {
      var col = k === 1 ? PAL.orange : k === 2 ? PAL.brass : PAL.brassLo;
      for (y = 0; y < GH; y++) for (x = 0; x < W; x++) if (on(x, y)) px(OX + x + k, OY + y + k, col);
    }
    var face = [];
    for (y = 0; y < GH; y++) for (x = 0; x < W; x++) if (on(x, y)) {
      var c2 = y < 5 ? PAL.white : y < 10 ? PAL.cream : y < 14 ? PAL.creamLo : PAL.gold;
      if (!on(x, y - 1) && y < 14) c2 = PAL.white;
      if (!on(x, y + 1) && y >= 2) c2 = PAL.goldLo;
      px(OX + x, OY + y, c2); face.push([x, y, c2]);
    }
    STATIC = { canvas: c, face: face };
  }

  function draw(canvas, frame, sweep, glow) {
    if (!STATIC) buildStatic();
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, CW, CH);
    var x, y;
    if (glow) { // stepped, dithered halo — no blur, stays pixel-crisp
      var fcx = OX + CELLX[FLAME_IDX] + 5, fcy = OY - 5;
      for (y = 0; y < CH; y++) for (x = 0; x < CW; x++) {
        var d = Math.hypot((x - fcx) * 0.8, (y - fcy) * 1.1), a = 0;
        if (d < 9) a = .34; else if (d < 15) a = .2; else if (d < 22) a = .1;
        if (a && ((x + y) % 2 === 0 || d < 9)) { ctx.fillStyle = 'rgba(255,238,170,' + (a * 1.5) + ')'; ctx.fillRect(x, y, 1, 1); }
      }
    }
    ctx.drawImage(STATIC.canvas, 0, 0);
    if (sweep != null) { // diagonal light sweep across the lettering
      var f = STATIC.face;
      for (var i = 0; i < f.length; i++) {
        var q = (f[i][0] + f[i][1] * 0.6) - sweep;
        if (q >= 0 && q < 4) { ctx.fillStyle = PAL.white; ctx.fillRect(OX + f[i][0], OY + f[i][1], 1, 1); }
        else if (q >= 4 && q < 6) { ctx.fillStyle = PAL.cream; ctx.fillRect(OX + f[i][0], OY + f[i][1], 1, 1); }
      }
    }
    var spr = frame ? FLAME_B : FLAME_A, fx = OX + CELLX[FLAME_IDX] + 1, fy = PAD + GLOW;
    for (y = 0; y < spr.length; y++) for (x = 0; x < spr[y].length; x++) {
      var ch = spr[y][x];
      if (ch !== '.') { ctx.fillStyle = FCOL[ch]; ctx.fillRect(fx + x, fy + y, 1, 1); }
    }
  }

  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  /* mount(canvas, {budget: () => max css width of the letters, onSize: (s, lead, below) => void})
     Picks a scale that is an integer number of DEVICE pixels per logo pixel, so edges stay sharp. */
  function mount(canvas, opt) {
    opt = opt || {};
    canvas.width = CW; canvas.height = CH;
    var s = 1, frame = 0, sweepAt = -1, t0 = 0, timer = 0, tick = 0;
    function fit() {
      var dpr = window.devicePixelRatio || 1;
      var letters = Math.max(120, opt.budget ? opt.budget() : 400);
      var dev = Math.max(2, Math.floor(letters * dpr / W));
      s = dev / dpr;
      canvas.style.width = (CW * s) + 'px'; canvas.style.height = (CH * s) + 'px';
      if (opt.onSize) opt.onSize(s, LEAD, BELOW, W, GH + DEPTH);
    }
    function visible() { return canvas.isConnected && canvas.offsetParent !== null && !document.hidden; }
    function paint() { draw(canvas, frame, sweepAt >= 0 ? sweepAt : null, true); }
    function step() {
      if (!canvas.isConnected) { clearInterval(timer); return; }
      if (!visible()) return;
      tick++;
      frame = (tick % 2) ? 1 : 0;
      var now = Date.now();
      if (sweepAt < 0 && now - t0 > 6000) { sweepAt = -12; t0 = now; }
      if (sweepAt >= 0) { sweepAt += 16; if (sweepAt > W + 24) { sweepAt = -1; } }
      paint();
    }
    fit(); paint(); t0 = Date.now() - 3000;
    window.addEventListener('resize', function () { fit(); paint(); });
    if (!reduce && opt.animate !== false) timer = setInterval(step, 150);
    return { refit: function () { fit(); paint(); } };
  }
  window.LVLogo = { mount: mount, W: W, LEAD: LEAD, BELOW: BELOW, PAL: PAL };
})();
