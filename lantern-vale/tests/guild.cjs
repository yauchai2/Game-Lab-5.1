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
    for(const [i,page] of pages.entries()) {
      page.on('pageerror',e=>errors.push(e.message));
      await page.goto(address);await page.fill('#inParty','雙人測試');await page.fill('#inName','旅人'+i);await page.click('#btnStart');
      await page.waitForFunction(()=>__game.wallet);
      await page.keyboard.press('m');await page.getByRole('button',{name:'公會組隊副本'}).click();
      await page.waitForFunction(()=>__game.raid);
    }
    await pages[0].waitForFunction(()=>__game.raid.allies.size===1);
    await Promise.all(pages.map(async page=>{
      await page.keyboard.down('w');await page.waitForFunction(()=>__game.player.pos.z<2);await page.keyboard.up('w');
      await page.keyboard.down('Space');
    }));
    await pages[0].screenshot({path:'shots/guild-raid.png'});
    await Promise.all(pages.map(async page=>{
      await page.waitForFunction(()=>!__game.raid && __game.wallet.amber===1,null,{timeout:30000});
      await page.keyboard.up('Space');
      await page.evaluate(()=>{const g=__game;g.player.pos.set(8,0,4);g.tryInteract();});
      await page.getByRole('button',{name:'公會交易所'}).click();
    }));
    await pages[0].getByRole('button',{name:'上架',exact:true}).click();
    await pages[1].getByRole('button',{name:'買入',exact:true}).click();
    await pages[0].waitForFunction(()=>__game.wallet.coins===16);
    await pages[1].waitForFunction(()=>__game.wallet.coins===7);
    assert.deepEqual(await pages[1].evaluate(()=>[__game.wallet.coins,__game.wallet.amber]),[7,2]);
    await pages[1].reload();await pages[1].click('#btnStart');
    await pages[1].waitForFunction(()=>__game.wallet?.amber===2);
    assert.deepEqual(errors,[]); console.log('Two browsers completed an authoritative raid, traded and restored their online wallet.');
  } finally {if(browser)await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
