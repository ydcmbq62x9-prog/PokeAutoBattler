const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport:{width:430,height:900} });
  await page.goto(require('./pkbpaths').PAGE);
  await page.waitForTimeout(300);
  await page.evaluate(() => document.addEventListener('click', e => { window.__hits = (window.__hits||[]); window.__hits.push(e.clientX+','+e.clientY+' '+(e.target.className||e.target.tagName) + ' > ' + (e.target.closest('[data-act]')||{dataset:{}}).dataset.act + ' sel=' + JSON.stringify(sel)); }, true));
  await page.click(`[data-act="dc"][data-i="0"]`);
  await page.click(`[data-act="team"][data-i="4"]`);
  console.log(await page.evaluate(() => [window.__hits.join('\n'), G.team.length, G.credits, scrollY]));
  await browser.close();
})();
