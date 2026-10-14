const { chromium } = require('playwright');
(async()=>{
  const b = await chromium.launch(); const errs=[];
  for(const [w,h,touch,tag] of [[390,844,true,'phone'],[1250,900,false,'wide']]){
    const ctx = await b.newContext({viewport:{width:w,height:h}, hasTouch:touch, isMobile:touch});
    const p = await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
    await p.goto(require('./pkbpaths').PAGE); await p.waitForTimeout(300);
    await p.evaluate(()=>{ G.pendingRewards=[]; document.querySelectorAll('.modal').forEach(x=>x.remove());
      G.team=['charmeleon','squirtle','pikachu','jigglypuff'].map((id,k)=>{const u=makeUnit(id,0); u.pos=[0,1,3,4][k]; return u;}); G.team[0].held='lefto'; G.team[1].copies=2;
      G.turn=8; G.stage=5; rollShop(G,false); save(); render(); });
    await p.waitForTimeout(900);
    await p.screenshot({path:`s43-${tag}-shop.png`});
    await p.click('.pfield .slot[data-i="0"]'); await p.waitForTimeout(900);
    await p.screenshot({path:`s43-${tag}-unit.png`});
    await p.keyboard.press('Escape'); await p.waitForTimeout(100);
    await p.evaluate(()=>{ document.querySelector('.drow[data-act="dc"]').scrollIntoView({block:'center'}); });
    await p.click('.drow[data-act="dc"]'); await p.waitForTimeout(900);
    await p.screenshot({path:`s43-${tag}-dc.png`});
    await ctx.close();
  }
  console.log(errs); await b.close();
})();
