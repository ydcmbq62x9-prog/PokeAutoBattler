const { chromium } = require('playwright');
const [w,h,tag] = [+process.argv[2]||390, +process.argv[3]||844, process.argv[4]||'ph'];
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport:{ width:w, height:h } });
  const errs=[]; p.on('pageerror', e => errs.push(String(e)));
  await p.addInitScript(() => { window.PKB_TITLE = false; window.PKB_WIPE = true; });
  await p.goto(require('./pkbpaths').PAGE); await p.waitForTimeout(600);
  await p.evaluate(() => { document.querySelectorAll('.modal').forEach(m => m.remove()); newRun({ gens:[1] });
    G.stage = runPlan().findIndex(s => s.kind === 'gym');
    G.team = ['mewtwo','mew','dragonite','snorlax','gyarados','alakazam'].map((id, i) => { const u = makeUnit(id, 3); u.pos = i; return u; }); fixSlots(G); render(); });
  await p.evaluate(() => document.querySelector('[data-act=endturn]').click());
  await p.waitForTimeout(1900); await p.screenshot({ path:`ce_${tag}_a.png` });
  await p.waitForTimeout(700); await p.screenshot({ path:`ce_${tag}_b.png` });
  await p.waitForTimeout(1500);
  await p.evaluate(() => finishPlayback());
  const t0 = Date.now();
  for(const ms of [1500, 2700, 3500, 4300, 5200]){ await p.waitForTimeout(ms - (Date.now()-t0)); await p.screenshot({ path:`ce_${tag}_${ms}.png` }); }
  console.log(errs, await p.evaluate(() => battle.result)); await b.close();
})();
