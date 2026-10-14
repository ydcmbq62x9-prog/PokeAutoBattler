const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport:{width:1200,height:1000}, deviceScaleFactor:2 });
  await p.goto(require('./pkbpaths').PAGE);
  await p.waitForTimeout(250);
  await p.evaluate(() => {
    localStorage.setItem('pkb_speed','1');
    G.turn=8; G.credits=40;
    G.team=[makeUnit('wartortle',2), makeUnit('onix',0), makeUnit('pikachu',0), makeUnit('machoke',0)];
    G.team[0].held='band'; G.team[1].held='coat';
    save(); render();
  });
  await p.click('[data-act="endturn"]');
  await p.waitForTimeout(2600);
  const bar = await p.$('.shopbar');
  await bar.screenshot({ path:'speedbar.png' });
  await p.screenshot({ path:'shot-battle.png' });
  await b.close();
})();
