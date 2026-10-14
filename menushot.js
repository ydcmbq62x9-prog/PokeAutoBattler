const { chromium } = require('playwright');
(async () => { const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' }); const p = await b.newPage({ viewport:{ width:844, height:390 } });
  await p.addInitScript(() => { window.PKB_TITLE = false; }); await p.goto(require('./pkbpaths').PAGE); await p.waitForTimeout(600);
  await p.evaluate(() => { document.querySelectorAll('.modal').forEach(m => m.remove()); openMenu(); }); await p.waitForTimeout(400);
  await p.screenshot({ path:'menu_land.png' }); await b.close(); })();
