const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  for(const [w,h,n] of [[1250,900,'pc'],[390,780,'ph'],[360,640,'sm']]){
    const ctx = await b.newContext({ viewport:{width:w,height:h} });
    await ctx.addInitScript(() => { window.PKB_TITLE = true; window.PKB_WIPE = true; });
    const p = await ctx.newPage();
    await p.goto(require('./pkbpaths').PAGE); await p.evaluate(() => { localStorage.clear(); localStorage.setItem('pkb_records', JSON.stringify({runs:6,cleared:2,best:37,hardcore:{count:2,first:'2026-09-20',last:'2026-09-28'}})); PREF.set('name','Sean'); });
    await p.reload(); await p.waitForTimeout(400);
    await p.mouse.click(w/2, h-20); await p.waitForTimeout(400);
    await p.screenshot({ path:`hc-title-${n}.png` });
    await p.click('#title [data-t="trainer"]'); await p.waitForTimeout(300);
    await p.screenshot({ path:`hc-card-${n}.png` });
    await p.evaluate(() => document.querySelector('.modal.trainer [data-m="close"]').click());
    await p.evaluate(() => { localStorage.setItem('pkb_records', JSON.stringify({runs:1,cleared:0,best:3})); });
    await p.reload(); await p.waitForTimeout(300); await p.mouse.click(w/2, h-20); await p.waitForTimeout(300);
    await p.click('#title [data-t="trainer"]'); await p.waitForTimeout(300);
    await p.screenshot({ path:`hc-card-locked-${n}.png` });
    await p.evaluate(() => document.querySelector('.modal.trainer [data-m="close"]').click());
    await p.evaluate(() => { document.getElementById('title') && document.getElementById('title').remove(); document.body.classList.remove('titled'); G = newGame(7,{mods:{onelife:true}}); G.over='won'; G.hcNew=true; G.badges=8; phase='over'; render(); });
    await p.waitForTimeout(600); await p.screenshot({ path:`hc-win-${n}.png` });
    await ctx.close();
  }
  await b.close();
})();
