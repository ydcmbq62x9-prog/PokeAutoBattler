const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport:{width:430,height:900} });
  await page.goto(require('./pkbpaths').PAGE);
  await page.waitForTimeout(300);
  await page.click(`[data-act="dc"][data-i="0"]`); await page.waitForTimeout(600);
  console.log(await page.evaluate(() => [...document.querySelectorAll('[data-act=team]')].map(s => { const r = s.getBoundingClientRect(); const es = document.elementsFromPoint(r.left + r.width/2, r.top + r.height/2).slice(0,4).map(e=>e.className.split(' ')[0]+(e.dataset.i||'')); return s.dataset.i + ' ' + [r.left,r.top,r.width,r.height].map(Math.round) + ' -> ' + es.join(','); }).join('\n')));
  await browser.close();
})();
