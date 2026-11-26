const { chromium } = require('playwright');
(async () => {
  const god = process.argv[2] === 'god';
  const args = process.env.LV_SOFTWARE_GL === '0' ? []
    : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
  const browser = await chromium.launch({ channel: process.env.LV_CHROMIUM_CHANNEL || undefined, args });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message + e.stack));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(process.env.LV_GAME_URL || 'http://localhost:8080/');
  await page.waitForTimeout(1500);
  await page.click('#btnHeroNext');
  await page.click('#btnStart');
  await page.waitForTimeout(500);
  await page.evaluate(() => __game.startRun());
  await page.waitForTimeout(300);
  const startDepth = +(process.argv[3]||0); if (startDepth) await page.evaluate(d => __game.loadRoom(d, 'item'), startDepth);
  const shots = [];
  for (let chunk = 0; chunk < +(process.argv[4]||80); chunk++) {
    const res = await page.evaluate(({ god }) => {
      const g = __game, W = g.world, p = g.player; const log = [];
      const tgt = new (p.pos.constructor)();
      const fd = new (g.aim.constructor)();
      const setDir = (dx, dz) => {
        const angle = Math.atan2(dz, dx) + (g.camYaw || 0);
        const x = Math.cos(angle), z = Math.sin(angle);
        g.keys = { w: z < -0.38, s: z > 0.38, a: x < -0.38, d: x > 0.38 };
      };
      const aimAt = (x, z) => {
        g.camera.updateMatrixWorld();
        tgt.set(x, p.y, z).project(g.camera);
        g.mouse.x = (tgt.x * 0.5 + 0.5) * innerWidth;
        g.mouse.y = (-tgt.y * 0.5 + 0.5) * innerHeight;
      };
      const walkTo = (x, z) => { W.computeFlow(x, z); const v = { x: 0, y: 0, set(a, b) { this.x = a; this.y = b; return this; }, normalize() { const l = Math.hypot(this.x, this.y) || 1; this.x /= l; this.y /= l; return this; } };
        if (W.flowDir(p.pos.x, p.pos.z, v)) setDir(v.x, v.y); else setDir(x - p.pos.x, z - p.pos.z); };
      for (let i = 0; i < 300; i++) {
        if (god) { p.hp = p.stats.maxHp; p.stats.baseDmg = 40; }
        if (g.state === 'boon') { g.ui.pickBoonIndex(0); }
        if (g.state === 'dead' || g.state === 'win') return { done: g.state, depth: g.depth, kills: p.kills, log };
        if (g.state === 'play') {
          g.mouse.l = g.mouse.r = false;
          let best = null, bd = 1e9;
          for (const e of g.enemies) { const d = Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z); if (d < bd) { bd = d; best = e; } }
          if (best) {
            aimAt(best.pos.x, best.pos.z);
            const ranged = g.meta.p.weapon === 'bow';
            if (ranged && bd < 3) setDir(p.pos.x - best.pos.x, p.pos.z - best.pos.z);
            else if (bd > (ranged ? 7 : 2)) walkTo(best.pos.x, best.pos.z);
            else g.keys = {};
            if (bd < (ranged ? 9 : 2.6)) g.mouse.l = true;
            else if (p.mana > 20) g.mouse.r = true;
            if (bd < 3.5) g.trySlam();
            g.tryWisp();
            if (g.eprojs.some(pr => Math.hypot(pr.mesh.position.x - p.pos.x, pr.mesh.position.z - p.pos.z) < 1.5)) g.tryRoll();
          } else if (g.cleared) {
            const d = g.drops.find(d => d.kind === 'item');
            if (d) { walkTo(d.g.position.x, d.g.position.z); if (g.nearestDrop()) { const n = g.nearestDrop(); const cur = p.equip[n.item.slot]; const sc = it => !it ? 0 : (it.rarity*10 + it.mods.length + (it.implicit?it.implicit.v:0)/10); if (sc(n.item) > sc(cur)) g.tryPickup(); else { g.scene.remove(n.g); g.drops.splice(g.drops.indexOf(n), 1); } } }
            else { const x = g.exits.find(x => x.on); if (x) walkTo(x.x, x.z); }
          } else g.keys = {};
          if (p.hp < p.stats.maxHp * 0.45) g.tryFlask();
        }
        const d0 = g.depth;
        g.update(1 / 30);
        if (g.depth !== d0) log.push(`depth ${g.depth} hp ${Math.round(p.hp)}/${p.stats.maxHp} kills ${p.kills} boons ${p.boons.join(',')} equip ${Object.values(p.equip).filter(Boolean).map(i => i.name).join('/')}`);
      }
      return { done: null, en: g.enemies.map(e=>[e.type,e.state,e.pos.x.toFixed(1),e.pos.z.toFixed(1),Math.round(e.hp)]), dbg: { drops: g.drops.map(d => [d.kind, d.g.position.x.toFixed(1), d.g.position.z.toFixed(1), d.y.toFixed(2), d.vy.toFixed(2)]), exits: g.exits.map(x => [x.on, x.x, x.z, W.isWalk(x.x, x.z)]), state2: g.state }, depth: g.depth, state: g.state, hp: Math.round(p.hp), enemies: g.enemies.length, cleared: g.cleared, wave: g.waveIdx, pos: [p.pos.x.toFixed(1), p.pos.z.toFixed(1)], log };
    }, { god });
    for (const l of res.log) console.log(l);
    if (chunk % 3 === 0) console.log(JSON.stringify({ ...res, log: undefined }));
    if (res.done) { console.log('END', JSON.stringify(res)); break; }
    if (chunk % 10 === 5) { await page.waitForTimeout(600); await page.screenshot({ path: `shots/bot${chunk}.png` }); }
    await page.waitForTimeout(50);
  }
  console.log(errs.slice(0, 10).join('\n'));
  await browser.close();
  if (errs.length) process.exitCode = 1;
})();
