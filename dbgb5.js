const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport:{width:430,height:900} });
  await page.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html');
  await page.waitForTimeout(300);
  await page.click(`[data-act="dc"][data-i="0"]`); await page.waitForTimeout(300);
  for(const blk of ['end','center','start','nearest']){
  console.log(blk, await page.evaluate(blk => { const s = document.querySelector('[data-act=team][data-i="4"]'); s.scrollIntoView({block:blk}); const r = s.getBoundingClientRect(); const es = document.elementsFromPoint(r.left + r.width/2, r.top + r.height/2).slice(0,3).map(e=>e.className.split(' ')[0]); return [Math.round(r.top), Math.round(r.bottom), scrollY, es.join(',')].join(' '); }, blk));
  }
  await browser.close();
})();
