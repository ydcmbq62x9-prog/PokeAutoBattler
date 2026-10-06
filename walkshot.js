const { chromium } = require('playwright');
const [w,h,tag] = [+process.argv[2]||390, +process.argv[3]||844, process.argv[4]||'ph'];
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport:{ width:w, height:h } });
  const errs=[]; p.on('pageerror', e => errs.push(String(e)));
  await p.addInitScript(() => { window.PKB_TITLE = false; window.PKB_WIPE = true; });
  await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await p.waitForTimeout(600);
  await p.evaluate(() => { document.querySelectorAll('.modal').forEach(m => m.remove()); newRun({ gens:[1] }); G.turn = 9; G.credits = 23;
    G.stage = runPlan().findIndex(s => s.kind === 'gym');
    const ids = ['charmeleon','wartortle','pikachu','gengar','snorlax']; G.team = ids.map((id, i) => { const u = makeUnit(id, 2); u.pos = i; return u; }); fixSlots(G); rollShop(G, false); render(); });
  await p.waitForTimeout(400); await p.screenshot({ path:`wk_${tag}_0.png` });
  await p.evaluate(() => document.querySelector('[data-act=endturn]').click());
  const t0 = Date.now();
  for(const ms of [2000, 2500, 2900, 3300, 3700, 4100, 4600]){ await p.waitForTimeout(ms - (Date.now()-t0)); await p.screenshot({ path:`wk_${tag}_${ms}.png` }); }
  console.log(errs); await b.close();
})();
