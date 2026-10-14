const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  for(const [w,h,tag] of [[1250,1000,'wide'],[390,844,'phone']]){
    const p = await b.newPage({ viewport:{width:w,height:h}, deviceScaleFactor:2 });
    const errs=[]; p.on('pageerror', e=>errs.push(String(e)));
    await p.goto(require('./pkbpaths').PAGE); await p.waitForTimeout(200);
    // a gym is next: put the run one step before Misty
    await p.evaluate(() => {
      G.pendingRewards=[]; G.credits=40;
      G.team=['jigglypuff','oddish','voltorb','shellder','rhyhorn','clefairy'].map(i=>makeUnit(i,0));
      G.team[0].held='band'; G.team[1].held='lefto'; G.team[2].held='char'; G.team[3].held='coat'; G.team[4].held='sitrus'; G.team[5].held='egg';
      const plan = runPlan(); const i = plan.findIndex(x => x.boss && x.boss.id === 'misty');
      G.stage = i; G.turn = 9; G.badges = 1; rollShop(G,false); save(); render();
    });
    await p.waitForTimeout(250);
    await p.screenshot({ path:`tr-${tag}-shop.png`, fullPage: tag==='phone' });
    await p.click('[data-act="endturn"]'); await p.waitForTimeout(700);
    await p.screenshot({ path:`tr-${tag}-battle.png` });
    console.log(tag, errs.length ? errs : 'no errors');
    await p.close();
  }
  await b.close();
})();
