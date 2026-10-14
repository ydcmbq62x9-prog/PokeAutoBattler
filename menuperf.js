const { chromium } = require('playwright');
const URL = require('./pkbpaths').PAGE;
(async () => {
  const browser = await chromium.launch();
  for (const [w,h,cpu] of [[1250,950,1],[390,844,4]]) {
    const page = await browser.newPage({ viewport:{width:w,height:h} });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
    await page.goto(URL); await page.waitForTimeout(800);
    await page.evaluate(() => { G.pendingRewards=[]; document.querySelectorAll('.modal').forEach(x=>x.remove());
      G.team=['charmeleon','squirtle','pikachu','pidgey'].map((id,k)=>{const u=makeUnit(id,0);u.pos=k;return u;}); G.turn=6; rollShop(G,false); render(); });
    await page.waitForTimeout(500);
    const r = await page.evaluate(() => new Promise(res => {
      const t0 = performance.now(), frames=[]; let lt=[];
      try{ new PerformanceObserver(l=>l.getEntries().forEach(e=>lt.push(Math.round(e.duration)))).observe({entryTypes:['longtask']}); }catch(e){}
      const tick = t => { frames.push(t); if(t - t0 < 500) requestAnimationFrame(tick); else res({ gaps: frames.slice(1).map((f,i)=>Math.round(f-frames[i])), lt }); };
      const s = performance.now(); document.querySelector('[data-act="menu"]').click(); const clickMs = performance.now()-s;
      requestAnimationFrame(tick); window.__click = clickMs;
    }));
    const click = await page.evaluate(()=>window.__click);
    console.log(w, 'cpu x'+cpu, 'click handler ms', click.toFixed(1), 'frame gaps', r.gaps.join(','), 'longtasks', r.lt.join(','));
    await page.close();
  }
  await browser.close();
})();
