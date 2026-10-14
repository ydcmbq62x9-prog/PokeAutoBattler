const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport:{ width:390, height:844 } });
  const errs=[]; p.on('pageerror', e => errs.push(String(e)));
  await p.addInitScript(() => { window.PKB_TITLE = false; });
  await p.goto(require('./pkbpaths').PAGE); await p.waitForTimeout(600);
  await p.evaluate(() => { document.querySelectorAll('.modal').forEach(m => m.remove()); newRun({ gens:[1] }); G.turn = 14;
    const ids = ['snorlax','lapras','charizard','mew','pikachu','gengar']; G.team = ids.map((id, i) => { const u = makeUnit(id, 2); u.pos = i; return u; }); fixSlots(G); render(); startBattle(); });
  await p.waitForTimeout(2600);
  await p.evaluate(() => { battle.paused = true; victorySweep(battle.stage); crowdReact(battle.stage, true); });
  await p.waitForTimeout(700); await (await p.$('.bstage')).screenshot({ path:'sweep1.png' });
  const n = await p.evaluate(() => ({ conf: document.querySelectorAll('.fx.confetti').length, bulbs: document.querySelectorAll('.bulb').length, anims: document.querySelector('.tview').getAnimations().length }));
  console.log(JSON.stringify(n), errs); await b.close();
})();
