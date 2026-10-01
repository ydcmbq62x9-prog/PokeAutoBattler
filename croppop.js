const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport:{width:1250,height:1000}, deviceScaleFactor:3 });
  await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html');
  await p.waitForTimeout(200);
  await p.evaluate(() => {
    G.turn=14; G.credits=60;
    G.team=[makeUnit('wartortle',2), makeUnit('onix',0), makeUnit('machamp',0)];
    G.team[0].held='band'; G.team[1].held='coat'; G.team[2].held='evio';
    G.bag=['sitrus','lefto']; rollShop(G,false); save(); render();
  });
  await p.waitForTimeout(200);
  for(const [i,name] of [[0,'band'],[2,'gated']]){
    await p.hover(`[data-pop="team:${i}"]`);
    await p.waitForTimeout(260);
    const el = await p.$('.popup');
    await el.screenshot({ path:`pop-${name}.png` });
    await p.mouse.move(2,2); await p.waitForTimeout(150);
  }
  await b.close();
})();
