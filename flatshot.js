const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport:{ width:393, height:740 }, hasTouch:true, isMobile:true, deviceScaleFactor:2 });
  const p = await ctx.newPage(); const errs=[]; p.on('pageerror', e => errs.push(String(e)));
  await p.addInitScript(() => { window.PKB_TITLE = false; window.PKB_WIPE = true; window.PKB_FLAT = true; });
  await p.goto(require('./pkbpaths').PAGE); await p.waitForTimeout(700);
  await p.evaluate(() => { document.querySelectorAll('.modal').forEach(m => m.remove()); newRun({ gens:[2] }); G.team = [makeUnit('chikorita',1)]; G.team[0].pos = 1; render(); });
  await p.locator('.drow[data-act="dc"][data-i="0"]').tap(); await p.waitForTimeout(500);
  await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(400); await p.screenshot({ path:'fl_1.png' });
  const off = await p.evaluate(() => { const st = document.querySelector('.wcam .bstage'); let w = 0; for(const s of document.querySelectorAll('.pfield .slot')){ const i = +s.dataset.i, m = st.querySelector(`.slotmark.p.r${Math.floor(i/2)}.f${i%2}`); const a = s.getBoundingClientRect(), c = m.getBoundingClientRect(); w = Math.max(w, Math.abs(a.top - c.top), Math.abs((a.left+a.width/2) - (c.left+c.width/2))); } return w; });
  console.log('worst slot/mark offset', off.toFixed(1));
  await p.evaluate(() => { sel = null; render(); document.querySelector('[data-act=endturn]').click(); });
  await p.waitForTimeout(700); await p.screenshot({ path:'fl_2.png' });
  await p.waitForTimeout(2000); await p.screenshot({ path:'fl_3.png' });
  console.log(errs); await b.close();
})();
