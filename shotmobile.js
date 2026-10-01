const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport:{width:390,height:800}, deviceScaleFactor:2,
                                   hasTouch:true, isMobile:true });
  const p = await ctx.newPage();
  await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html');
  await p.waitForTimeout(300);
  await p.evaluate(() => {
    G.turn=14; G.badges=3; G.credits=30;
    G.team=[makeUnit('wartortle',2), makeUnit('onix',0), makeUnit('pikachu',0)];
    G.team[0].held='band'; G.bag=['sitrus','lefto']; rollShop(G,false); save(); render();
  });
  await p.waitForTimeout(200);
  await p.click('[data-act="team"][data-i="0"]');
  await p.waitForTimeout(350);
  await p.screenshot({ path:'mobile-sel.png' });
  // and the bag case
  await p.evaluate(() => { sel = null; render(); });
  await p.waitForTimeout(150);
  await p.click('.wall.bag .bcell:not(.empty)');
  await p.waitForTimeout(350);
  await p.screenshot({ path:'mobile-bag.png' });
  await b.close();
})();
