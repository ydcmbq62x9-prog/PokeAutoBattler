const { chromium } = require('playwright');
const [w,h,tag,mode] = [+process.argv[2]||390, +process.argv[3]||844, process.argv[4]||'ph', process.argv[5]||'champ'];
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport:{ width:w, height:h } });
  const errs=[]; p.on('pageerror', e => errs.push(String(e)));
  await p.addInitScript(() => { window.PKB_TITLE = false; window.PKB_WIPE = true; });
  await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await p.waitForTimeout(600);
  await p.evaluate(mode => { document.querySelectorAll('.modal').forEach(m => m.remove()); newRun({ gens:[1] }); sessionBattles = 9;
    if(mode === 'champ'){ G.badges = 8; G.stage = runPlan().findIndex(s => s.kind === 'champion'); }
    else G.stage = runPlan().findIndex(s => s.kind === 'gym');
    const team = mode === 'champ' ? ['mewtwo','mew','dragonite','snorlax','gyarados','alakazam'] : ['magikarp','caterpie'];
    G.team = team.map((id, i) => { const u = makeUnit(id, mode === 'champ' ? 3 : 0); u.pos = i; return u; }); fixSlots(G); render(); }, mode);
  await p.evaluate(() => document.querySelector('[data-act=endturn]').click());
  await p.waitForTimeout(2500); await p.evaluate(mode => { if(mode === 'champ'){ battle.result = 'win'; } finishPlayback(); }, mode);
  for(const t of [3000, 5500, 7500]){ await p.waitForTimeout(t === 3000 ? 3000 : 2200); await p.screenshot({ path:`ch_${tag}_${mode}_${t}.png` }); }
  console.log(errs, await p.evaluate(() => battle && [battle.kind, battle.result, battle.photoTaken]));
  await b.close();
})();
