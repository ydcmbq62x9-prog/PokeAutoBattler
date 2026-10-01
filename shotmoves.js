const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  for(const [w,h,tag] of [[1250,1000,'wide'],[390,844,'phone']]){
    const p = await b.newPage({ viewport:{width:w,height:h}, deviceScaleFactor:2 });
    const errs=[]; p.on('pageerror', e=>errs.push(String(e)));
    await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await p.waitForTimeout(200);
    await p.evaluate(() => { G.pendingRewards=[]; G.turn=12; G.stage=5;
      G.team=['charizard','blastoise','butterfree','gengar','pidgeot','clefable'].map(i=>makeUnit(i,2));
      G.team.forEach(u=>{u.hp+=60;u.atk+=60;u.spd+=30;}); rollShop(G,false); save(); render(); });
    if(tag==='wide'){ await p.hover('[data-pop="team:0"]'); await p.waitForTimeout(250); await p.screenshot({ path:`mv-pop.png` }); await p.mouse.move(1,1); }
    await p.click('[data-act="endturn"]');
    // find a step with a status on screen
    for(let i=0;i<40;i++){ await p.waitForTimeout(350); if(await p.$('.stchip')) break; }
    await p.screenshot({ path:`mv-${tag}-battle.png` });
    console.log(tag, errs.length?errs:'no errors', !!(await p.$('.stchip')), !!(await p.$('.shchip')));
    await p.close();
  }
  await b.close();
})();
