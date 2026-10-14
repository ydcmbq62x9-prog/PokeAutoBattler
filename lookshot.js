const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  for(const [w,h,tag] of [[390,844,'ph'],[1250,850,'pc']]) for(const look of ['mini','paper']){
    const p = await b.newPage({ viewport:{ width:w, height:h } });
    const errs=[]; p.on('pageerror', e => errs.push(String(e)));
    await p.addInitScript(l => { window.PKB_TITLE = false; localStorage.setItem('pkb_look', l); }, look);
    await p.goto(require('./pkbpaths').PAGE); await p.waitForTimeout(600);
    await p.evaluate(() => { document.querySelectorAll('.modal').forEach(m => m.remove()); newRun({ gens:[1] }); G.turn = 14;
      const ids = ['snorlax','lapras','charizard','mew','pikachu','gengar']; G.team = ids.map((id, i) => { const u = makeUnit(id, 2); u.pos = i; return u; }); fixSlots(G); render(); startBattle(); });
    await p.waitForTimeout(4000); await (await p.$('.bstage')).screenshot({ path:`look_${tag}_${look}.png` });
    console.log(tag, look, await p.evaluate(() => document.querySelector('.bstage').className), errs);
    await p.close();
  }
  await b.close();
})();
