const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport:{width:1250,height:950} });
  await page.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await page.waitForTimeout(800);
  const out = await page.evaluate(() => {
    const r={}; const f = HTMLElement.prototype.focus; let ft=0;
    HTMLElement.prototype.focus = function(){ const t=performance.now(); f.apply(this, arguments); ft += performance.now()-t; };
    let t=performance.now(); openMenu(); r.total=performance.now()-t; r.focus=ft;
    document.querySelectorAll('.modal').forEach(x=>x.remove());
    t=performance.now(); hasUnseen(); r.unseen=performance.now()-t;
    t=performance.now(); finePointer(); r.fine=performance.now()-t;
    return r; });
  console.log(out); await browser.close(); })();
