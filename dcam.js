const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport:{ width:1366, height:860 } });
  await p.addInitScript(() => { window.PKB_TITLE = false; window.PKB_WIPE = true; });
  await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await p.waitForTimeout(700);
  const st = () => p.evaluate(() => ({ t: WORLD.cam.style.transform, fresh: shopCamera(), host: WORLD.cam.parentNode.id || WORLD.cam.parentNode.className, box: JSON.stringify(WORLD.box) }));
  await p.evaluate(() => { document.querySelectorAll('.modal').forEach(m => m.remove()); newRun({ gens:[2] }); sessionBattles = 9; G.stage = runPlan().findIndex(s => s.kind === 'gym');
    G.team = ['quilava','bayleef','hoothoot','ledian','pichu','azumarill'].map((id, i) => { const u = makeUnit(id, 2); u.pos = i; return u; }); render(); });
  await p.waitForTimeout(300); console.log('before', await st());
  await p.evaluate(() => document.querySelector('[data-act=endturn]').click()); await p.waitForTimeout(3000);
  await p.evaluate(() => { battle.result = 'win'; finishPlayback(); }); await p.waitForTimeout(5000);
  await p.evaluate(() => document.querySelector('[data-act=afterbattle]').click()); await p.waitForTimeout(1300);
  await p.evaluate(() => document.querySelector('.fieldcards .fcard').click()); await p.waitForTimeout(3500);
  console.log('after', await st());
  await b.close();
})();
