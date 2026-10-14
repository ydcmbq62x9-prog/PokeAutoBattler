const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport:{ width:852, height:393 }, hasTouch:true, isMobile:true });
  const p = await ctx.newPage();
  await p.addInitScript(() => { window.PKB_TITLE = false; });
  await p.goto(require('./pkbpaths').ARTIFACT); await p.waitForTimeout(600);
  await p.evaluate(() => { document.querySelectorAll('.modal').forEach(m => m.remove()); newRun({ gens:[2] }); G.team = ['chikorita','ledyba'].map((id, i) => { const u = makeUnit(id, 1); u.pos = i * 2 + 1; return u; }); render(); });
  const vis = () => p.evaluate(() => ({ v: document.querySelector('.vtag').textContent, inspect: getComputedStyle(document.getElementById('inspect')).display, shelves: getComputedStyle(document.querySelector('.bcR .shelves')).display }));
  console.log('start', await vis());
  await p.locator('[data-act="team"][data-i="1"]').tap(); await p.waitForTimeout(400); console.log('tapped', await vis());
  await p.locator('[data-act="cancel"]').first().tap(); await p.waitForTimeout(400); console.log('cancel', await vis());
  await b.close();
})();
