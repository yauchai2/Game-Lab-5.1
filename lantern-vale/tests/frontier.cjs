const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try {
    const page = await browser.newPage({viewport:{width:1280,height:720}});
    const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    await page.goto(pathToFileURL(process.cwd()+'/dist/index.html').href);
    await page.click('#btnStart');
    const travel = async name => {
      await page.keyboard.press('m');
      await page.locator('.atlas').getByRole('button',{name,exact:true}).click();
      await page.locator('.map-travel').click();
    };
    await travel('晨光草原');
    assert.equal(await page.evaluate(()=>__game.field),1);
    await page.evaluate(()=>{for(let i=0;i<35;i++) __game.update(1/30);});
    assert.equal(await page.evaluate(()=>__game.enemies.length),7);
    await page.screenshot({path:'shots/persistent-meadow.png'});
    await page.evaluate(()=>{
      const g=__game;
      for (const kind of ['wood','ore','fish']) {
        const s=g.spots.find(s=>s.kind===kind);g.player.pos.set(s.x,0,s.z);g.tryInteract();
      }
      g.killEnemy(g.enemies.find(e=>e.spawnIndex===5));
    });
    await travel('燈谷鎮');
    const panel = async kind => {
      await page.evaluate(kind=>{
        const g=__game, spot=g.spots.find(s=>s.kind===kind);
        g.player.pos.set(spot.x,0,spot.z); g.tryInteract();
      },kind);
    };
    await panel('forge');
    await page.getByRole('button',{name:'素材鍛造與武器'}).click();
    await page.getByRole('button',{name:'鍛造',exact:true}).click();
    assert.ok(await page.evaluate(()=>Object.values(__game.meta.p.gear).some(x=>x?.rarity===2)));
    await page.click('#btnPanelClose');
    await panel('market');
    await page.getByRole('button',{name:'買入'}).first().click();
    await page.getByRole('button',{name:'寄售'}).first().click();
    assert.equal(await page.evaluate(()=>__game.meta.p.sales.length),1);
    await page.screenshot({path:'shots/vale-market.png'});
    await page.click('#btnPanelClose');
    await travel('低語森林');
    assert.equal(await page.evaluate(()=>__game.world.half),50);
    await page.evaluate(()=>{const g=__game;g.meta.p.goods.ore=12;g.die();});
    await page.waitForFunction(()=>__game.depth===-1);
    assert.equal(await page.evaluate(()=>__game.meta.p.goods.ore),9);
    await travel('低語森林');
    await page.evaluate(()=>{const g=__game,s=g.spots.find(s=>s.kind==='grave');g.player.pos.set(s.x,0,s.z);g.tryInteract();});
    assert.equal(await page.evaluate(()=>__game.meta.p.goods.ore),12);
    const keys = await page.evaluate(()=>__game.meta.p.keys);
    await page.evaluate(()=>__game.goExit(__game.exits[0]));
    await page.waitForFunction(()=>!__game.field && __game.depth===0);
    assert.equal(await page.evaluate(()=>__game.meta.p.keys),keys-1);
    assert.deepEqual(errors,[]);
    console.log('Region travel, gathering, elite rewards, crafting, auction, death recovery and keystone passed.');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
