const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const errs=[];
  for(const [vw,vh,tag] of [[390,844,'ph'],[1280,800,'pc']]){
    const p = await b.newPage({ viewport:{ width:vw, height:vh }, deviceScaleFactor:1 });
    p.on('pageerror', e => errs.push(String(e)));
    await p.addInitScript(() => { window.PKB_TITLE = false; });
    await p.goto(require('./pkbpaths').PAGE); await p.waitForTimeout(600);
    for(const badges of [0, 4, 8]){
      await p.evaluate((bd) => { document.querySelectorAll('.modal').forEach(m => m.remove()); if(battle){ battle = null; phase='shop'; } newRun({ gens:[1] }); G.turn = 14; G.badges = bd;
        const ids = ['snorlax','lapras','charizard','mew','pikachu','gengar']; G.team = ids.map((id, i) => { const u = makeUnit(id, 2); u.pos = i; return u; }); fixSlots(G); render(); startBattle(); }, badges);
      await p.waitForTimeout(3000); await p.evaluate(() => { battle.paused = true; });
      await p.screenshot({ path:`s55_${tag}_${badges}.png` });
    }
    // trainer card with some career
    await p.evaluate(() => { battle = null; phase='shop'; render(); const r = records(); r.career = { battles:57, wins:41, gyms:19, elite:6, champs:2, used:{pikachu:30, snorlax:12}, hit:{dmg:212,id:'gengar'}, fastest:31, floors:['Water','Fire','dusk','league'] }; saveRecords(r); PREF.set('homefloor','Water'); openTrainerCard(); });
    await p.waitForTimeout(500);
    await p.evaluate(() => { const h = document.querySelector('.career'); h.scrollIntoView(); });
    await p.screenshot({ path:`s55_${tag}_card.png` });
    await p.evaluate(() => { document.querySelector('.hfgrid').scrollIntoView(); });
    await p.screenshot({ path:`s55_${tag}_card2.png` });
    await p.evaluate(() => { document.querySelectorAll('.modal').forEach(m => m.remove()); render(); });
    await p.waitForTimeout(800);
    await p.screenshot({ path:`s55_${tag}_shop.png` });
    await p.close();
  }
  console.log(errs); await b.close();
})();
