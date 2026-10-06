const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport:{ width:1000, height:900 }, deviceScaleFactor:2 });
  const errs=[]; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + process.cwd() + '/bl-local.html'); await p.waitForTimeout(800);
  const ph = await p.$('#ph');
  await ph.screenshot({ path:'cam0.png' });
  await p.evaluate(() => document.getElementById('scroller').scrollTo(0, 500)); await p.waitForTimeout(300); await ph.screenshot({ path:'cam0b.png' });
  await p.evaluate(() => document.getElementById('scroller').scrollTo(0, 0));
  await p.click('#btnGo'); await p.waitForTimeout(950); await ph.screenshot({ path:'cam1.png' });
  await p.waitForTimeout(2600); await ph.screenshot({ path:'cam2.png' });
  await p.waitForTimeout(9000); await ph.screenshot({ path:'cam3.png' });
  console.log(errs); await b.close();
})();
