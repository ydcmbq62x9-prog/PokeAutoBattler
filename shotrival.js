const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  for(const [w,h,tag] of [[1250,1000,'wide'],[390,844,'phone']]){
    const p = await b.newPage({ viewport:{width:w,height:h}, deviceScaleFactor:2 });
    await p.goto('file:///mnt/user-data/outputs/pokebattler.html'); await p.waitForTimeout(200);
    await p.evaluate(() => { G.pendingRewards=[]; G.team=['charmander','vulpix','pidgey','rattata'].map(i=>makeUnit(i,0));
      G.team.forEach(u=>{u.hp+=40;u.atk+=40;u.spd+=20;}); G.stage = rivalStages(G)[0]; G.turn=3; G.bag=[]; rollShop(G,false); save(); render(); });
    await p.click('[data-act="endturn"]'); await p.waitForTimeout(1600);
    await p.screenshot({ path:`rv-${tag}-start.png` });
    await p.click('[data-act="skip"]'); await p.waitForTimeout(300);
    await p.screenshot({ path:`rv-${tag}-end.png` });
    await p.close();
  }
  await b.close();
})();
