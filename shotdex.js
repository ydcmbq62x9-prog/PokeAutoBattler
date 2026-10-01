const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport:{width:1150,height:1050}, deviceScaleFactor:2 });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html');
  await p.waitForTimeout(250);
  await p.click('[data-act="menu"]'); await p.waitForTimeout(120);
  await p.click('[data-m="dex"]');   await p.waitForTimeout(250);
  await p.click('[data-jump="held"]'); await p.waitForTimeout(800);
  const box = await p.$('.modal .box');
  await box.screenshot({ path:'dex-held.png' });
  await b.close();
  if(errs.length){ errs.forEach(e=>console.log('  - '+e)); process.exit(1); }
  console.log('dex screenshot ok');
})();
