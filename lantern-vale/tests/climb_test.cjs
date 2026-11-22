const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs=[]; page.on('pageerror', e => errs.push(e.message+e.stack)); page.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
  await page.goto('file://' + process.cwd() + '/dist/index.html');
  await page.waitForTimeout(1200);
  await page.click('#btnStart'); await page.waitForTimeout(300);
  const r = await page.evaluate(() => {
    const g = __game, W = g.world, p = g.player; g.fade = 0;
    for (const e of g.enemies) g.killEnemy(e); g.enemies = []; g.waves = []; g.cleared = true;
    // find a low walkable cell adjacent (within 2) to a plateau cell
    const out = {};
    let found = null;
    for (let k = 0; k < W.walk.length && !found; k++) if (W.walk[k]) {
      const i = k % 121, j = (k / 121) | 0; if (j < 5 || i < 5 || i > 115 || j > 115) continue;
      for (const [di, dj] of [[3,0],[-3,0],[0,3],[0,-3]]) { const nk = (j + dj) * 121 + i + di; if (W.height[nk] > 1.3) { found = { x: -30 + i * 0.5, z: -30 + j * 0.5, dx: Math.sign(di), dz: Math.sign(dj) }; break; } }
    }
    out.found = found; if (!found) return out;
    p.pos.set(found.x, 0, found.z); p.y = 0;
    g.keys = { d: found.dx > 0, a: found.dx < 0, s: found.dz > 0, w: found.dz < 0 };
    const ys = [];
    for (let i = 0; i < 90; i++) { g.update(1/30); if (i % 10 === 0) ys.push([+p.y.toFixed(2), p.climbing, +p.stamina.toFixed(0)]); }
    out.climb = ys; out.finalY = p.y;
    // jump + glide off the cliff
    g.keys = { d: found.dx<0, a: found.dx>0, s: found.dz<0, w: found.dz>0 };
    for (let i = 0; i < 12; i++) g.update(1/30);
    g.keys[' '] = true; g.tryJump();
    const ys2 = [];
    for (let i = 0; i < 60; i++) { g.update(1/30); if (i % 10 === 0) ys2.push([+p.y.toFixed(2), +p.vy.toFixed(1), p.gliding, p.air]); }
    out.jump = ys2;
    return out;
  });
  console.log(JSON.stringify(r));
  console.log(errs.join('\n'));
  await browser.close();
})();
