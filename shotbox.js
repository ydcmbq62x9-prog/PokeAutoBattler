const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport:{width:1200,height:1000}, deviceScaleFactor:3 });
  await p.goto(require('./pkbpaths').PAGE);
  await p.waitForTimeout(250);
  await p.evaluate(() => {
    G.turn=12; G.badges=3; G.credits=30;
    G.team=[makeUnit('machop',0)];
    G.pc=[makeUnit('squirtle',0), makeUnit('onix',0), makeUnit('squirtle',0),
          makeUnit('vulpix',0), makeUnit('squirtle',0), makeUnit('pikachu',0)];
    save(); render();
  });
  await p.waitForTimeout(150);
  await p.click('[data-act="pc"][data-i="0"]');
  await p.waitForTimeout(150);
  await p.mouse.move(2, 2);          // get the hover popup out of the shot
  await p.waitForTimeout(250);
  const el = await p.$('.panel.pc');
  await el.screenshot({ path:'boxmerge.png' });
  await b.close();
})();
