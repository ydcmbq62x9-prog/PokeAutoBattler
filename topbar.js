const { chromium } = require('playwright');
(async () => { const b = await chromium.launch();
  for(const w of [320, 340, 360, 375, 390, 430]){
    const ctx = await b.newContext({ viewport:{ width:w, height:700 }, deviceScaleFactor:2, hasTouch:true, isMobile:true }); const p = await ctx.newPage();
    await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await p.waitForTimeout(300);
    await p.evaluate(() => { newRun(); document.querySelectorAll('.modal').forEach(x => x.remove()); const t = document.getElementById('title'); if(t){ t.remove(); document.body.classList.remove('titled'); titleEl = null; } G.pendingRewards = []; G.badges = 8; G.stage = 30; G.credits = 40; G.turn = 30; render(); });
    const r = await p.evaluate(() => { const box = e => { const q = e && e.getBoundingClientRect(); return q ? [Math.round(q.left), Math.round(q.top), Math.round(q.right), Math.round(q.bottom)] : null; };
      const bar = document.querySelector('.topbar, #top, .top'); const badges = document.querySelector('.stat.badges'); const nxt = document.querySelector('.stat.next'); const turn = document.querySelector('.tcol.tright, .stat.turn');
      return { badges: box(badges), next: box(nxt), turn: box(document.querySelector('.stat.turn')), start: box(document.querySelector('[data-act="menu"]')), lives: box(document.querySelector('.stat.lives')), cash: box(document.querySelector('.stat.credits')) }; });
    console.log(w, JSON.stringify(r));
    await (await p.$('.topbar, #top, .top, header') || await p.$('body')).screenshot({ path: `/tmp/claude-0/top-${w}.png` }).catch(() => {});
    await p.screenshot({ path: `/tmp/claude-0/top-${w}.png`, clip:{ x:0, y:0, width:w, height:90 } });
    await ctx.close(); }
  await b.close(); })();
