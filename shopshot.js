const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  for(const [w,h,tag] of [[390,844,'ph'],[1250,900,'pc']]){
    const p = await b.newPage({ viewport:{ width:w, height:h } });
    await p.addInitScript(() => { window.PKB_TITLE = false; });
    await p.goto(require('./pkbpaths').PAGE); await p.waitForTimeout(600);
    await p.evaluate(() => { document.querySelectorAll('.modal').forEach(m => m.remove()); newRun({ gens:[1] }); G.turn = 9; G.credits = 23;
      const ids = ['charmeleon','wartortle','pikachu','gengar','snorlax']; G.team = ids.map((id, i) => { const u = makeUnit(id, 2); u.pos = i; return u; }); G.pc = [makeUnit('eevee',1), makeUnit('abra',0)]; fixSlots(G); rollShop(G, false); render(); });
    await p.waitForTimeout(500); await p.screenshot({ path:`shop_${tag}.png`, fullPage: tag === 'ph' });
    await p.close();
  }
  await b.close();
})();
