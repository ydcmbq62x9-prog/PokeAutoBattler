const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport:{ width:393, height:740 }, deviceScaleFactor:2 });
  await p.addInitScript(() => { window.PKB_TITLE = false; window.PKB_FLAT = true; });
  await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await p.waitForTimeout(600);
  await p.evaluate(() => { document.querySelectorAll('.modal').forEach(m => m.remove()); newRun({ gens:[2] }); G.credits = 20;
    const id = G.daycare[0].unit.id; G.team = [makeUnit(id, 0), makeUnit(id, 0)]; G.team[0].exp = TUNING.expForLevel2 - 1; G.team[0].pos = 0; G.team[1].pos = 1; render(); });
  await p.locator('.drow[data-act="dc"][data-i="0"]').click(); await p.waitForTimeout(200);
  await p.locator('.slot[data-act="team"][data-i="0"]').click();
  await p.waitForTimeout(400);
  console.log(await p.evaluate(() => JSON.stringify(G.team.map(u => [u.id, u.exp, unitLevel(u), u.pos])) + ' dc=' + G.daycare[0].unit.id)); console.log(await p.evaluate(() => [...document.querySelectorAll('.sfloat')].map(f => { const r = f.getBoundingClientRect(), s = f.closest('.slot'), a = s && s.querySelector('.artwrap').getBoundingClientRect(); return f.textContent + (a ? ' dx=' + Math.round(r.left + r.width/2 - (a.left + a.width/2)) + ' above=' + Math.round(a.top - r.bottom) : ' (body) y=' + Math.round(r.top)); }).join(' | ')));
  await p.screenshot({ path:'lv.png' });
  await b.close();
})();
