const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  for(const flat of [true, false]){
  const p = await b.newPage({ viewport:{ width:393, height:740 }, deviceScaleFactor:2 });
  await p.addInitScript(f => { window.PKB_TITLE = false; window.PKB_FLAT = f; }, flat);
  await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await p.waitForTimeout(600);
  console.log(flat, await p.evaluate(() => { document.querySelectorAll('.modal').forEach(m => m.remove()); newRun({ gens:[2] }); G.team = [makeUnit('hoothoot',1)]; G.team[0].pos = 0; render(); sel = { kind:'dc', idx:0 }; render();
    const occ = document.querySelector('.pfield .slot[data-i="0"] .artwrap').getBoundingClientRect(), ring = s => { const e = document.querySelector(`.pfield .slot[data-i="${s}"]`), r = e.getBoundingClientRect(), cs = getComputedStyle(e, '::after'); return r.top + parseFloat(cs.top) + parseFloat(cs.height) / 2; };
    return { feet0: Math.round(occ.bottom), ring1: Math.round(ring(1)), ring2: Math.round(ring(2)), ring3: Math.round(ring(3)) }; }));
  await p.screenshot({ path: `ring_${flat}.png` });
  await p.close(); }
  await b.close();
})();
