const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  for(const vp of [{ width:393, height:740 }, { width:1250, height:900 }]){
  const p = await b.newPage({ viewport: vp, deviceScaleFactor:2 });
  await p.addInitScript(() => { window.PKB_TITLE = false; window.PKB_WIPE = true; window.PKB_FLAT = true; });
  await p.goto(require('./pkbpaths').PAGE); await p.waitForTimeout(600);
  await p.evaluate(() => { document.querySelectorAll('.modal').forEach(m => m.remove()); newRun({ gens:[2] }); sessionBattles = 9;
    G.team = ['cyndaquil','chikorita','hoothoot'].map((id, i) => { const u = makeUnit(id, 0); u.pos = i; return u; }); render(); });
  await p.evaluate(() => document.querySelector('[data-act=endturn]').click());
  await p.waitForTimeout(2500); await p.evaluate(() => { battle.result = 'win'; finishPlayback(); }); await p.waitForTimeout(1500);
  await p.evaluate(() => document.querySelector('[data-act=afterbattle]').click());
  const seen = await p.evaluate(() => new Promise(r => { const out = new Set(); const t0 = performance.now(); const iv = setInterval(() => { for(const f of document.querySelectorAll('.sfloat')) out.add(f.textContent + (f.closest('.slot') ? '@slot' : '@body') + (document.body.classList.contains('cam-going') ? '(hidden)' : '')); if(performance.now() - t0 > 3000){ clearInterval(iv); r([...out]); } }, 50); }));
  console.log('seen', seen);
  await p.waitForTimeout(10);
  console.log(vp.width, await p.evaluate(() => [...document.querySelectorAll('.slot .sfloat')].map(f => { const r = f.getBoundingClientRect(), s = f.closest('.slot'), a = s && s.querySelector('.artwrap').getBoundingClientRect(); return f.textContent + ' dx=' + Math.round(r.left + r.width/2 - (a.left + a.width/2)) + ' above=' + Math.round(a.top - r.bottom); }).join(' | ')));
  await p.screenshot({ path:`exp_${vp.width}.png` });
  await p.close(); }
  await b.close();
})();
