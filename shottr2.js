const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport:{width:1250,height:1000}, deviceScaleFactor:1.5 });
  const errs=[]; p.on('pageerror', e=>errs.push(String(e)));
  await p.goto('file:///mnt/user-data/outputs/pokebattler.html'); await p.waitForTimeout(200);
  await p.evaluate(() => { G.pendingRewards=[]; G.team=['onix','abra'].map(i=>makeUnit(i,0));
    G.stage = gauntletStart(); G.badges = 8; G.turn = 30; rollShop(G,false); save(); render(); });
  await p.waitForTimeout(200);
  const nu = await p.$('.nextup'); await nu.screenshot({ path:'tr-gauntlet.png' });
  await p.evaluate(() => openDex()); await p.waitForTimeout(250);
  await p.evaluate(() => document.getElementById('dex-gym').scrollIntoView());
  await p.waitForTimeout(150); await p.screenshot({ path:'tr-dex.png' });
  await p.evaluate(() => { document.querySelectorAll('.modal').forEach(m=>m.remove()); G.pendingRewards=[2]; save(); openRewardPicker(); });
  await p.waitForTimeout(250); await p.screenshot({ path:'tr-reward.png' });
  console.log(errs.length?errs:'no errors'); await b.close();
})();
