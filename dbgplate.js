const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport:{ width:390, height:844 } });
  await p.addInitScript(() => { window.PKB_TITLE = false; });
  await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await p.waitForTimeout(600);
  await p.evaluate(() => { document.querySelectorAll('.modal').forEach(m => m.remove()); newRun({ gens:[1] }); G.turn = 14;
    const ids = ['snorlax','lapras','charizard','mew','pikachu','gengar']; G.team = ids.map((id, i) => { const u = makeUnit(id, 2); u.pos = i; return u; }); fixSlots(G); render(); startBattle(); });
  await p.waitForTimeout(3000);
  console.log(await p.evaluate(() => { return [...document.querySelectorAll('.ftr')].map(f => { const a = f.querySelector('.fart img').getBoundingClientRect(), h = f.querySelector('.fhead').getBoundingClientRect(), t = f.getBoundingClientRect(); return f.className.replace('ftr ','') + ' tile ' + Math.round(t.top) + '-' + Math.round(t.bottom) + ' art ' + Math.round(a.top) + '-' + Math.round(a.bottom) + ' plate ' + Math.round(h.top) + '-' + Math.round(h.bottom) + ' ' + f.querySelector('.fname').textContent; }); const f = 0; const r = e => { const x = f.querySelector(e).getBoundingClientRect(); return [e, Math.round(x.top), Math.round(x.bottom), Math.round(x.height)]; };
    return [['tile', Math.round(f.getBoundingClientRect().top), Math.round(f.getBoundingClientRect().bottom)], r('.fmove'), r('.fbody'), r('.fart'), r('.fart img'), r('.fhead'), getComputedStyle(f.querySelector('.fmove')).display, getComputedStyle(f.querySelector('.fbody')).height]; }));
  await b.close();
})();
