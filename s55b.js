const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const errs=[]; const p = await b.newPage({ viewport:{ width:390, height:844 } });
  p.on('pageerror', e => errs.push(String(e)));
  await p.addInitScript(() => { window.PKB_TITLE = false; });
  await p.goto(require('./pkbpaths').PAGE); await p.waitForTimeout(600);
  await p.evaluate(() => { document.querySelectorAll('.modal').forEach(m => m.remove()); newRun({ gens:[1] }); G.badges = 3;
    const ids = ['snorlax','lapras','charizard','mew','pikachu','gengar']; G.team = ids.map((id, i) => { const u = makeUnit(id, 2); u.pos = i; return u; }); fixSlots(G); render(); startBattle(); });
  await p.waitForTimeout(3000);
  await p.evaluate(() => { battle.paused = true; lightLamp(battle.stage, battle); fieldBanner(battle.stage, 'Water'); });
  await p.waitForTimeout(500);
  console.log(await p.evaluate(() => { const e = document.querySelector('.fieldban .fsw'); const c = getComputedStyle(e); return [e.getBoundingClientRect().width, e.getBoundingClientRect().height, c.display, c.position, c.opacity, c.visibility]; }));
  await p.screenshot({ path:'s55b.png', clip:{x:0,y:0,width:390,height:420} });
  // a real gym win: does floor unlock get recorded?
  const r = await p.evaluate(async () => { battle.newFloor='Water'; battle.kind='gym'; battle.boss={ theme:['Water'], badge:'Cascade', name:'Misty' }; battle.result='win'; await afterBattle({keep:true}); return career().floors; });
  console.log('floors', r, errs); await b.close();
})();
