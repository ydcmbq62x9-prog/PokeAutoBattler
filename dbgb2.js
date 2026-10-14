const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport:{width:430,height:900} });
  await page.goto(require('./pkbpaths').PAGE);
  await page.waitForTimeout(300);
  await page.click(`[data-act="dc"][data-i="0"]`);
  console.log(await page.evaluate(() => [...document.querySelectorAll('[data-act=team]')].map(s => { const r = s.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2); const c = e && e.closest('[data-act]'); return s.dataset.i + ' ' + s.className.replace(/\s+/g,' ') + ' -> ' + (e && e.className) + ' / ' + (c && c.dataset.act + c.dataset.i) + ' @' + Math.round(r.top); }).join('\n')));
  await browser.close();
})();
