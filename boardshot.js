const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  for(const [w,h,tag] of [[844,390,'land'],[768,1024,'tab']]){
    const p = await b.newPage({ viewport:{ width:w, height:h }, deviceScaleFactor:1 });
    const errs=[]; p.on('pageerror', e => errs.push(String(e)));
    await p.addInitScript(() => { window.PKB_TITLE = false; localStorage.setItem('pkb_tutorial','done'); });
    await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await p.waitForTimeout(600);
    await p.evaluate(() => { document.querySelectorAll('.modal').forEach(m => m.remove());
      newRun({ gens:[1,2] }); G.turn = 14; G.credits = 0;
      const ids = ['snorlax','lapras','charizard','mew','pikachu','gengar']; G.team = ids.map((id, i) => { const u = makeUnit(id, 2); u.pos = i; growUnit(u, { hp:40, atk:30, spd:10 }); return u; }); fixSlots(G); render(); });
    await p.evaluate(() => startBattle()); await p.waitForTimeout(4200);
    await p.screenshot({ path:`board_${tag}.png` });
    await p.waitForTimeout(2500); await p.screenshot({ path:`board_${tag}2.png` });
    console.log(tag, errs);
  }
  await b.close();
})();
