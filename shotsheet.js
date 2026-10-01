const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); const p = await b.newPage({ viewport:{ width:420, height:900 } });
  await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler-balance-sheet.html');
  const h = await p.$('h2:has-text("who can they field")'); await h.scrollIntoViewIfNeeded();
  await p.evaluate(() => window.scrollBy(0, -10));
  await p.screenshot({ path: 'sheet-bosses.png' });
  await b.close();
})();
