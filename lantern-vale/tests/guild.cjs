const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { chromium } = require('playwright');

(async () => {
  const server = spawn(process.execPath,['server/server.js'],{env:{...process.env,PORT:'0',LV_DATABASE:':memory:'},stdio:['ignore','pipe','inherit']});
  let browser;
  try {
    const [line] = await once(server.stdout,'data');
    const address=String(line).match(/http:\/\/localhost:\d+/)[0];
    browser=await chromium.launch({channel:'chrome',args:['--use-angle=metal']});
    const pages=await Promise.all([browser.newPage(),browser.newPage()]);
    const errors=[];
    for (const page of pages) {
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(address);
      await page.locator('#btnQuickStart').click();
      await page.waitForFunction(() => __game.wallet && __game.net.dungeonLobbies);
      await page.evaluate(() => __game.dungeon.open({ kind: 'raid' }, '共鳴樹庭'));
    }
    await pages[0].waitForFunction(() => __game.dungeon.pending?.info?.members.length === 2);
    await pages[0].locator('[data-dungeon-start]').click();
    await Promise.all(pages.map(page => page.waitForFunction(() => __game.raid)));
    await pages[0].waitForFunction(() => __game.raid.allies.size >= 1);
    await Promise.all(pages.map(async page=>{
      await page.keyboard.down('w');await page.waitForFunction(()=>__game.player.pos.z<2);await page.keyboard.up('w');
      await page.keyboard.down('Space');
    }));
    await pages[0].screenshot({path:'shots/guild-raid.png'});
    await Promise.all(pages.map(async page=>{
      await page.waitForFunction(()=>!__game.raid && __game.wallet.amber===1,null,{timeout:30000});
      await page.keyboard.up('Space');
      await page.evaluate(() => __game.ui.openPanel('exchange'));
    }));
    await pages[0].getByRole('button',{name:'上架',exact:true}).click();
    await pages[1].getByRole('button',{name:'買入',exact:true}).click();
    await pages[0].waitForFunction(()=>__game.wallet.coins===16);
    await pages[1].waitForFunction(()=>__game.wallet.coins===7);
    assert.deepEqual(await pages[1].evaluate(()=>[__game.wallet.coins,__game.wallet.amber]),[7,2]);
    await pages[1].reload();await pages[1].click('#btnQuickStart');
    await pages[1].waitForFunction(()=>__game.wallet?.amber===2);
    assert.deepEqual(errors,[]); console.log('Two browsers completed an authoritative raid, traded and restored their online wallet.');
  } finally {if(browser)await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
