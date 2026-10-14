const { chromium } = require('playwright');
(async()=>{
  const b = await chromium.launch();
  for(const theme of ['light','dark']){
    const ctx = await b.newContext({viewport:{width:390,height:844}, deviceScaleFactor:2});
    await ctx.addInitScript(t => localStorage.setItem('pkb_theme', t), theme);
    const p = await ctx.newPage();
    await p.goto(require('./pkbpaths').PAGE); await p.waitForTimeout(400);
    await p.evaluate(()=>{ G.pendingRewards=[]; G.team=['wartortle','geodude','pidgeotto','clefairy','charmeleon','pikachu'].map(i=>makeUnit(i,0));
      G.team.forEach((u,k)=>u.pos=[2,5,1,4,0,3][k]); G.badges=2; G.stage=6; G.turn=7; G.credits=18; G.lives=4; G.streak=3; save(); render();
      document.querySelectorAll('.modal').forEach(x=>x.remove()); });
    await p.waitForTimeout(900);
    await p.screenshot({path:`wipe-shop-${theme}.jpg`, type:'jpeg', quality:72});
    await p.click('[data-act="endturn"]'); await p.waitForTimeout(4200);
    await p.screenshot({path:`wipe-battle-${theme}.jpg`, type:'jpeg', quality:72});
    await ctx.close();
  }
  await b.close();
})();
