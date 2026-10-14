const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport:{width:430,height:900} });
  await page.goto(require('./pkbpaths').PAGE);
  await page.waitForTimeout(300);
  await page.evaluate(() => { window.__h=[]; for(const t of ['pointerdown','mousedown','pointerup','mouseup','click']) document.addEventListener(t, e => window.__h.push(t+' '+e.clientX+','+e.clientY+' '+e.target.className.split(' ').slice(0,2).join('.')+(e.target.dataset.i||'')), true); });
  await page.click(`[data-act="dc"][data-i="0"]`); await page.waitForTimeout(300);
  await page.evaluate(() => { scrollTo(0,38); window.__h.push('--- scroll '+scrollY); }); await page.waitForTimeout(200);
  await page.mouse.move(120,449); await page.waitForTimeout(100);
  await page.evaluate(() => { const e = document.elementsFromPoint(120,449).slice(0,3).map(e=>e.className.split(' ')[0]+(e.dataset.i||'')); window.__h.push('hover: '+e); });
  await page.mouse.down(); await page.waitForTimeout(50); await page.mouse.up();
  console.log(await page.evaluate(() => window.__h.join('\n')));
  await browser.close();
})();
