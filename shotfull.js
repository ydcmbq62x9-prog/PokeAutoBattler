const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport:{width:1250,height:1200}, deviceScaleFactor:2 });
  await p.goto(require('./pkbpaths').PAGE);
  await p.waitForTimeout(250);
  await p.evaluate(() => {
    G.turn=16; G.badges=3; G.stage=3*(TUNING.battlesPerBadge+1)+TUNING.battlesPerBadge; G.credits=31;
    G.team=[makeUnit('wartortle',2), makeUnit('onix',0), makeUnit('pikachu',0),
            makeUnit('machoke',0), makeUnit('butterfree',0), makeUnit('vulpix',0)];
    G.team[0].held='band'; G.team[1].held='coat'; G.team[3].held='coin';
    G.pc=[makeUnit('abra',0)]; G.bag=['sitrus','lefto'];
    rollShop(G,false); save(); render();
  });
  await p.waitForTimeout(250);
  await p.screenshot({ path:'shot-shop-gym.png', fullPage:true });
  await b.close();
})();
