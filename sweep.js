const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const sizes = [[390,844,'ph'],[360,640,'sm'],[844,390,'land'],[768,1024,'tab'],[1250,850,'pc']];
  for(const [w,h,tag] of sizes){
    const p = await b.newPage({ viewport:{ width:w, height:h } });
    const errs=[]; p.on('pageerror', e => errs.push(String(e)));
    await p.addInitScript(() => { window.PKB_TITLE = false; });
    await p.goto(require('./pkbpaths').PAGE); await p.waitForTimeout(600);
    await p.evaluate(() => { document.querySelectorAll('.modal').forEach(m => m.remove()); newRun({ gens:[1,2] }); G.turn = 14;
      const ids = ['snorlax','lapras','charizard','mew','pikachu','farfetchd']; G.team = ids.map((id, i) => { const u = makeUnit(id, 2); u.pos = i; return u; }); fixSlots(G); render(); startBattle(); });
    await p.waitForTimeout(3600); await p.screenshot({ path:`sw_${tag}_a.png` });
    await p.evaluate(() => { const s = [...document.querySelectorAll('button')].find(b => /Skip/.test(b.textContent)); s && s.click(); });
    await p.waitForTimeout(1800); await p.screenshot({ path:`sw_${tag}_b.png` });
    console.log(tag, errs.join(' | '));
    await p.close();
  }
  await b.close();
})();
