const { chromium, devices } = require('playwright');
let fails = 0; const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
(async () => { const b = await chromium.launch();
  for(const [tag, dev] of [['iPhone 13', devices['iPhone 13']], ['short', { viewport:{ width:390, height:700 }, deviceScaleFactor:2, hasTouch:true, isMobile:true }]]){
    const ctx = await b.newContext(dev); await ctx.addInitScript(() => { window.PKB_WIPE = true; }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(require('./pkbpaths').PAGE); await p.waitForTimeout(300);
    await p.evaluate(() => { newRun(); document.querySelectorAll('.modal').forEach(x => x.remove()); const t = document.getElementById('title'); if(t){ t.remove(); document.body.classList.remove('titled'); titleEl = null; }
      G.pendingRewards = []; G.team = [makeUnit('machop', 0)]; fixSlots(G); PREF.set('wipe', 'full'); PREF.set('text', 'instant'); render(); });
    await p.evaluate(() => { window.__w = wipe(() => new Promise(r => setTimeout(r, 900)), null); });
    await p.waitForTimeout(300);
    const g = await p.evaluate(() => { const w = document.querySelector('.wipe').getBoundingClientRect(), i = document.querySelector('.wiris').getBoundingClientRect();
      return { top: w.top, bottom: w.bottom, vh: innerHeight, iy: i.top + i.height / 2, vx: innerWidth / 2, ix: i.left + i.width / 2 }; });
    check(g.top <= -200 && g.bottom >= g.vh + 200, `${tag}: the shade runs well past the screen top and bottom (${g.top} … ${g.bottom} vs ${g.vh})`);
    check(Math.abs(g.iy - g.vh / 2) < 2 && Math.abs(g.ix - g.vx) < 2, `${tag}: the circle is still centred on the screen`);
    const px = await p.evaluate(() => { const e = document.elementFromPoint(innerWidth / 2, innerHeight - 1); return !!(e && e.closest('.wipe')); });
    check(px, `${tag}: the bottom edge of the screen is covered by the wipe`);
    await p.evaluate(() => window.__w); await p.waitForTimeout(100);
    check(await p.evaluate(() => !document.querySelector('.wipe')) && !errs.length, `${tag}: wipe cleans up, no errors`);
    await ctx.close(); }
  await b.close(); console.log(fails ? `${fails} FAILED` : 'wipefix passed'); process.exit(fails ? 1 : 0); })();
