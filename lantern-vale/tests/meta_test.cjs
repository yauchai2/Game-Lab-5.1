const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs=[]; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
  await page.goto('file://' + process.cwd() + '/dist/index.html'); await page.waitForTimeout(1200);
  await page.click('#btnStart'); await page.waitForTimeout(1200);
  const tp = async (x,z,d=22) => { await page.evaluate(([x,z,d]) => { const g=__game; g.fade=0; g.player.pos.x=x; g.player.pos.z=z; g.camDistOverride=d; for(let i=0;i<40;i++) g.update(1/30); }, [x,z,d]); await page.waitForTimeout(300); };
  await tp(-4.5, 5.0, 16); await page.screenshot({ path: 'shots/meta_board.png' });
  await page.keyboard.press('f'); await page.waitForTimeout(300); await page.screenshot({ path: 'shots/meta_quest.png' });
  await page.keyboard.press('Escape');
  // give heirloom + shards
  await page.evaluate(() => { const g=__game; const {makeItem}=g.__loot||{}; });
  await tp(11, -3.5, 16); await page.evaluate(() => { const g=__game; g.meta.p.shards=500; g.meta.setHeirloom(g.player.equip.staff); g.meta.save(); });
  await page.screenshot({ path: 'shots/meta_forge_town.png' });
  await page.keyboard.press('f'); await page.waitForTimeout(300);
  await page.click('[data-forge=add]'); await page.waitForTimeout(200); await page.screenshot({ path: 'shots/meta_forge.png' });
  await page.keyboard.press('Escape');
  await tp(2.8, -9, 16); await page.keyboard.press('f'); await page.waitForTimeout(300);
  await page.click('[data-mod=swarm]'); await page.click('[data-mod=elite]'); await page.screenshot({ path: 'shots/meta_map.png' });
  await page.keyboard.press('Escape');
  console.log('mods', await page.evaluate(()=>__game.meta.p.mods.join()));
  // start a run, collect, check pickups
  await page.evaluate(() => { __game.camDistOverride=0; __game.startRun(); }); await page.waitForTimeout(800);
  console.log(await page.evaluate(() => { const g=__game; g.fade=0; return { pickups: g.pickups.map(k=>k.kind).join(), enemies: g.enemies.length, depth: g.depth }; }));
  await page.evaluate(() => { const g=__game; for (const k of g.pickups) { g.player.pos.x=k.x; g.player.pos.z=k.z; g.player.y=k.g.position.y; g.update(1/30);} });
  console.log(await page.evaluate(() => JSON.stringify({ f: __game.meta.p.feathers, s: __game.meta.p.shells, q: __game.meta.p.quests.list })));
  await page.waitForTimeout(500); await page.screenshot({ path: 'shots/meta_run.png' });
  // die -> heirloom ui
  await page.evaluate(() => { const g=__game; g.meta.runShards=40; g.hurtPlayer=g.hurtPlayer; g.player.hp=0; g.die(); }); await page.waitForTimeout(1500);
  await page.screenshot({ path: 'shots/meta_dead.png' });
  console.log(await page.evaluate(() => JSON.stringify({ shards: __game.meta.p.shards })));
  console.log('ERR', errs.join('\n')); await b.close();
})();
