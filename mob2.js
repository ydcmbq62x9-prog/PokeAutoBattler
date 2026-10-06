const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport:{ width:393, height:740 }, hasTouch:true, isMobile:true, deviceScaleFactor:2 });
  const p = await ctx.newPage(); const errs=[]; p.on('pageerror', e => errs.push(String(e)));
  await p.addInitScript(() => { window.PKB_TITLE = false; window.PKB_WIPE = true; });
  await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await p.waitForTimeout(700);
  await p.evaluate(() => { document.querySelectorAll('.modal').forEach(m => m.remove()); newRun({ gens:[2] }); render(); });
  await p.waitForTimeout(500); await p.screenshot({ path:'p2_0.png' });
  await p.locator('.drow[data-act="dc"][data-i="0"]').tap(); await p.waitForTimeout(700);
  await p.screenshot({ path:'p2_1.png' });
  const info = await p.evaluate(() => ({ sy: scrollY, slots: [...document.querySelectorAll('.pfield .slot')].map(s => { const r = s.getBoundingClientRect(); return s.dataset.i + ':' + Math.round(r.left) + ',' + Math.round(r.top) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height); }),
    marks: [...document.querySelectorAll('#world .slotmark.p')].map(m => { const r = m.getBoundingClientRect(); return m.className.replace('slotmark p ','') + ':' + Math.round(r.left) + ',' + Math.round(r.top); }), cls: document.body.className }));
  console.log(JSON.stringify(info, null, 1)); console.log(errs);
  await b.close();
})();
