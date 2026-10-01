const { chromium } = require('playwright');
(async()=>{ const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await p.waitForTimeout(300);
  const r = await p.evaluate(()=>{ G.pendingRewards=[]; document.querySelectorAll('.modal').forEach(x=>x.remove()); G.team=[makeUnit('onix',0)]; G.team[0].pos=0; save(); render();
    handle('team',0); const a=!!sel; handle('team',0); const t=!!sel; handle('dc',0); const c=!!sel; handle('dc',0); const d=!!sel; return {a,t,c,d}; });
  console.log(r); await b.close(); })();
