const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport:{ width:844, height:390 } });
  await p.addInitScript(() => { window.PKB_TITLE = false; window.PKB_WIPE = true; });
  await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await p.waitForTimeout(600);
  await p.evaluate(() => { document.querySelectorAll('.modal').forEach(m => m.remove()); newRun({ gens:[1] }); G.turn = 9; G.credits = 23;
    const ids = ['charmeleon','wartortle','pikachu','gengar','snorlax']; G.team = ids.map((id, i) => { const u = makeUnit(id, 2); u.pos = i; return u; }); fixSlots(G); rollShop(G, false); render(); });
  await p.waitForTimeout(400); await p.screenshot({ path:'land_shop.png' });
  await p.evaluate(() => document.querySelector('[data-act=endturn]').click());
  await p.waitForTimeout(700); await p.screenshot({ path:'land_mid.png' });
  await p.waitForTimeout(2600); await p.screenshot({ path:'land_bat.png' });
  await b.close();
})();
