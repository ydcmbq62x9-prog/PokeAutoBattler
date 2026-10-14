const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const errs = [];
  const p = await b.newPage({ viewport:{width:390,height:860}, deviceScaleFactor:2 });
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(require('./pkbpaths').PAGE);
  await p.waitForTimeout(250);
  await p.evaluate(() => {
    localStorage.setItem('pkb_speed','1');
    G.turn=8; G.credits=40;
    G.team=[makeUnit('wartortle',2), makeUnit('onix',0), makeUnit('pikachu',0)];
    save(); render();
  });
  await p.click('[data-act="endturn"]');
  await p.waitForTimeout(1200);
  const over = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  if(over) errs.push('battle screen overflows at 390px');
  const bar = await p.$('.shopbar');
  await bar.screenshot({ path:'phonebar.png' });
  // the dex jumper must wrap, not overflow
  await p.evaluate(() => finishPlayback());
  await p.waitForTimeout(150);
  await p.click('[data-act="afterbattle"]'); await p.waitForTimeout(300);
  await p.click('[data-act="menu"]'); await p.waitForTimeout(120);
  await p.click('[data-m="dex"]'); await p.waitForTimeout(250);
  const jumpOver = await p.$eval('.dexjump', e => e.scrollWidth > e.clientWidth + 1);
  if(jumpOver) errs.push('the dex jumper overflows at 390px');
  const jump = await p.$('.dexjump');
  await jump.screenshot({ path:'phonejump.png' });
  await b.close();
  if(errs.length){ errs.forEach(e=>console.log('  - '+e)); process.exit(1); }
  console.log('phone layout ok');
})();
