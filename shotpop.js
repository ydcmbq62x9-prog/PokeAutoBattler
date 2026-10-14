const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport:{width:1250,height:1000}, deviceScaleFactor:2 });
  await p.goto(require('./pkbpaths').PAGE);
  await p.waitForTimeout(200);
  await p.evaluate(() => {
    G.turn=14; G.credits=60;
    G.team=[makeUnit('wartortle',2), makeUnit('onix',0), makeUnit('pikachu',0), makeUnit('machoke',0)];
    G.pc=[makeUnit('abra',0), makeUnit('gastly',0)];
    G.team[0].held='band'; G.team[1].held='coat'; G.team[2].held='coin'; G.team[3].held='evio';
    G.pc[0].held='claw';
    G.bag=['sitrus','lefto'];
    rollShop(G,false); save(); render();
  });
  await p.waitForTimeout(200);
  await p.hover('[data-pop="team:0"]');
  await p.waitForTimeout(250);
  await p.screenshot({ path:'shot-pop-held.png' });
  // and the gated case
  await p.mouse.move(2,2); await p.waitForTimeout(100);
  await p.evaluate(() => { G.team[3] = makeUnit('machamp',0); G.team[3].held='evio'; render(); });
  await p.waitForTimeout(120);
  await p.hover('[data-pop="team:3"]');
  await p.waitForTimeout(250);
  await p.screenshot({ path:'shot-pop-gated.png' });
  await b.close();
})();
