const { chromium } = require('playwright');
(async()=>{
  const b = await chromium.launch(); const p = await b.newPage({viewport:{width:1000,height:900}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.setContent('<!doctype html><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"><body>' + require('fs').readFileSync('wipes.html','utf8'));
  await p.waitForTimeout(500); await p.screenshot({path:'wp-rest.png'});
  const clip = await p.evaluate(()=>{const r=document.querySelector('#screen').getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height};});
  for(const [w, ts] of [['snap',[250,420]],['iris',[380,640]],['zoom',[250,690]]]){
    await p.click('#p-'+w); let last=0;
    for(const t of ts){ await p.waitForTimeout(t-last); last=t; await p.screenshot({path:`wp-${w}-${t}.png`, clip}); }
    await p.waitForTimeout(1500);
  }
  console.log(errs); await b.close();
})();
