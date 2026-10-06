const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport:{ width:393, height:740 } });
  await p.addInitScript(() => { window.PKB_TITLE = false; window.PKB_FLAT = true; });
  await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await p.waitForTimeout(600);
  console.log(await p.evaluate(() => { document.querySelectorAll('.modal').forEach(m => m.remove());
    const st = document.createElement('style'); st.textContent = '.pfield .slot:not(:first-child){margin-top:40px!important}'; document.head.appendChild(st);
    newRun({ gens:[2] }); render();
    const w = document.querySelector('.wcam .bstage'); let worst = 0;
    for(const s of document.querySelectorAll('.pfield .slot')){ const i = +s.dataset.i, m = w.querySelector(`.slotmark.p.r${Math.floor(i/2)}.f${i%2}`); worst = Math.max(worst, Math.abs(s.getBoundingClientRect().top - planeRect(m).top)); }
    return 'worst after a forced 40px shift: ' + worst.toFixed(1); }));
  await b.close();
})();
