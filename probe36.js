const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport:{width:1250,height:1000} });
  await p.goto('file:///mnt/user-data/outputs/pokebattler.html'); await p.waitForTimeout(200);
  await p.evaluate(() => { G.pendingRewards=[]; const m=(id,pos)=>{const u=makeUnit(id,0);u.pos=pos;return u;};
    G.team=[m('onix',0), m('machop',1), m('abra',4)]; save(); render(); document.querySelectorAll('.modal').forEach(m=>m.remove());
    window.__t0 = null; const orig = window.playIntro; });
  await p.evaluate(() => document.querySelector('[data-act="endturn"]').click());
  for(let k=0;k<8;k++){ await p.waitForTimeout(150);
    console.log(await p.evaluate(() => { const e=document.querySelector('.introban'); if(!e) return 'none '+performance.now().toFixed(0);
      const a=e.getAnimations()[0]; return `${performance.now().toFixed(0)} ct=${a&&a.currentTime&&a.currentTime.toFixed(0)} dur=${a&&a.effect.getTiming().duration} tf=${getComputedStyle(e).transform}`; }));
  }
  await b.close();
})();
