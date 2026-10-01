const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport:{width:1100,height:1000}, deviceScaleFactor:2 });
  await p.goto('file:///mnt/user-data/outputs/pokebattler.html');
  await p.waitForTimeout(250);
  await p.evaluate(() => {
    localStorage.setItem('pkb_speed','4');
    G.turn=10; G.badges=2; G.credits=30;
    G.team=[makeUnit('pikachu',0), makeUnit('alakazam',0), makeUnit('onix',0)];
    for(const u of G.team){ u.hp += 60; u.atk += 12; }
    save(); render();
  });
  await p.waitForTimeout(150);
  await p.click('[data-act="endturn"]');
  await p.waitForTimeout(2500);
  const log = await p.$('#blog');
  await log.screenshot({ path:'tempo-log.png' });
  await b.close();
})();
