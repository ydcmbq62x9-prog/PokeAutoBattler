const { chromium } = require('playwright');
(async()=>{
  const b = await chromium.launch(); const errs=[];
  for (const [w,h,tag] of [[390,844,'phone'],[1250,900,'wide']]){
    const p = await b.newPage({viewport:{width:w,height:h}, deviceScaleFactor:1});
    p.on('pageerror',e=>errs.push(tag+' '+e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(tag+' '+m.text())});
    await p.goto(require('./pkbpaths').PAGE); await p.waitForTimeout(400);
    await p.evaluate(()=>{ G.team=['wartortle','geodude','pidgeotto','clefairy','charmeleon','pikachu'].map(i=>makeUnit(i,0));
      G.team.forEach((u,k)=>u.pos=[2,5,1,4,0,3][k]); G.badges=3; G.stage=13; G.turn=14; G.credits=18; G.lives=4; G.streak=5; save(); render(); });
    await p.waitForTimeout(300);
    await p.click('.slot[data-i="2"]').catch(()=>{}); await p.waitForTimeout(900);
    await p.screenshot({path:`shots/v37-shop-${tag}.png`, fullPage: tag==='phone'});
    await p.screenshot({path:`shots/v37-shopview-${tag}.png`});
    await p.keyboard.press('Escape');
    await p.click('[data-act="menu"]'); await p.waitForTimeout(400);
    await p.screenshot({path:`shots/v37-menu-${tag}.png`});
    await p.click('[data-m="trainer"]'); await p.waitForTimeout(300);
    await p.screenshot({path:`shots/v37-card-${tag}.png`});
    await p.click('.modal [data-m="options"]'); await p.waitForTimeout(300);
    await p.screenshot({path:`shots/v37-opts-${tag}.png`});
    await p.click('.modal [data-m="close"]'); await p.waitForTimeout(200);
    await p.evaluate(()=>{G.stage=12; save(); render();}); await p.waitForTimeout(200);
    await p.click('[data-act="endturn"]'); await p.waitForTimeout(4500);
    await p.screenshot({path:`shots/v37-battle-${tag}.png`});
    console.log(tag,'overflow', await p.evaluate(()=>document.documentElement.scrollWidth));
    await p.close();
  }
  console.log(errs); await b.close();
})();
