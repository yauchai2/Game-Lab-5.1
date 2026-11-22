const { chromium } = require('playwright');
const { pathToFileURL } = require('node:url');
(async()=>{
  const browser=await chromium.launch({channel:'chrome',args:process.platform==='darwin'?['--use-angle=metal']:[]});
  try {
    const page=await browser.newPage({viewport:{width:1280,height:720}});
    await page.goto(pathToFileURL(process.cwd()+'/dist/index.html').href);
    await page.click('#btnStart');
    console.log(await page.evaluate(()=>{
      const gl=__game.pipe.renderer.getContext(), debug=gl.getExtension('WEBGL_debug_renderer_info');
      return debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
    }));
    for(const field of [0,1,4]){
      if(field) await page.evaluate(id=>__game.enterField(id),field);
      await page.waitForTimeout(1500);
      const record=await page.evaluate(()=>new Promise(resolve=>{
        const times=[];
        function sample(time) {
          times.push(time);
          if(time-times[0]<5000) {requestAnimationFrame(sample);return;}
          const gaps=times.slice(1).map((v,i)=>v-times[i]).sort((a,b)=>a-b);
          resolve({fps:Math.round((times.length-1)*10000/(time-times[0]))/10,p95ms:gaps[Math.floor(gaps.length*.95)],internal:[__game.pipe.w,__game.pipe.h]});
        }
        requestAnimationFrame(sample);
      }));
      console.log(field || 'town',record);
    }
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
