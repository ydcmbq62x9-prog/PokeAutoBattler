const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport:{width:430,height:900}, deviceScaleFactor:2 });
  ctx.setDefaultTimeout(5000);
  const page = await ctx.newPage();
  await page.goto(require('./pkbpaths').PAGE);
  await page.waitForTimeout(300);
  console.log(await page.evaluate(() => [document.querySelectorAll('.modal').length, [...document.querySelectorAll('.modal')].map(m=>m.className).join('|'), phase]));
  await page.click(`[data-act="dc"][data-i="0"]`).catch(e=>console.log('dc', e.message.slice(0,300)));
  const tgt = await page.$('[data-act="team"].valid');
  console.log('tgt', !!tgt);
  if(tgt){ const idx = await tgt.getAttribute('data-i'); await page.click(`[data-act="team"][data-i="${idx}"]`).catch(e=>console.log('team', e.message.slice(0,600))); }
  console.log(await page.$$eval('[data-act="team"] .unit', els => els.length));
  await browser.close();
})();
