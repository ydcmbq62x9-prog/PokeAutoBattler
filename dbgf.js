const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  for(const [w,h] of [[390,844],[1250,900],[844,390]]){
  const p = await b.newPage({ viewport:{ width:w, height:h } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.addInitScript(() => { window.PKB_TITLE = false; });
  await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await p.waitForTimeout(500);
  console.log(w, await p.evaluate(async () => { document.querySelectorAll('.modal').forEach(m => m.remove()); newRun({ gens:[1] });
    G.team = ['snorlax','pikachu'].map((id, i) => { const u = makeUnit(id, 1); u.pos = i; return u; }); fixSlots(G); render(); await startBattle(); await new Promise(r => setTimeout(r, 2500));
    const f = document.querySelector('#world .ftr.p'), a = f.querySelector('.fart').getBoundingClientRect(), r = f.getBoundingClientRect();
    return JSON.stringify({ fw: r.width|0, fh: r.height|0, aw: a.width|0, ah: a.height|0, abot: (r.bottom - a.bottom)|0, acx: ((a.left+a.width/2) - (r.left + r.width/2))|0 }); }));
  await p.close(); }
  await b.close();
})();
