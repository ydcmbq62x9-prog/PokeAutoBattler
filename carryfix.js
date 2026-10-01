/* 2.2.1: the pick-up chip appears under the pointer, only while something is lifted. */
const { chromium, devices } = require('playwright');
let fails = 0; const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
(async () => { const b = await chromium.launch();
  for(const [tag, dev] of [['pc', { viewport:{ width:1250, height:900 } }], ['small window', { viewport:{ width:720, height:700 } }]]){
    const ctx = await b.newContext(dev); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await p.waitForTimeout(400);
    await p.evaluate(() => { newRun(); document.querySelectorAll('.modal').forEach(x => x.remove()); const t = document.getElementById('title'); if(t){ t.remove(); document.body.classList.remove('titled'); titleEl = null; }
      G.pendingRewards = []; G.credits = 30; G.team = [makeUnit('squirtle', 0), makeUnit('machop', 0)]; fixSlots(G); PREF.set('text', 'instant'); render(); });
    const chip = () => p.evaluate(() => { const c = document.querySelector('.carry'); if(!c) return { exists: false, shown: false };
      const r = c.getBoundingClientRect(), cs = getComputedStyle(c); return { exists: true, shown: cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0, x: r.left, y: r.top, w: r.width, h: r.height }; });
    check(!(await chip()).shown, `${tag}: nothing selected → no chip on screen`);
    // pick up with the mouse (it moves there first, then clicks)
    const slot = await p.$('.slot[data-act="team"][data-i="0"]'); const bb = await slot.boundingBox(); const mx = bb.x + bb.width / 2, my = bb.y + bb.height / 2;
    await p.mouse.move(mx, my); await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(150);
    let c = await chip();
    check(c.shown && Math.abs(c.x - (mx + 14)) < 8 && Math.abs(c.y - (my + 14)) < 8, `${tag}: the chip appears right by the pointer at once (chip ${Math.round(c.x)},${Math.round(c.y)} · pointer ${Math.round(mx)},${Math.round(my)})`);
    await p.mouse.move(mx + 120, my + 60); await p.waitForTimeout(60); c = await chip();
    check(Math.abs(c.x - Math.min(mx + 134, innerWidthOf(dev) - c.w - 4)) < 8 && Math.abs(c.y - (my + 74)) < 8, `${tag}: and it follows the mouse (kept inside the window)`);
    await p.keyboard.press('Escape'); await p.waitForTimeout(150);
    check(!(await chip()).shown, `${tag}: Escape puts it away`);
    // pick up something with a script click and NO pointer movement on a fresh page: hidden until the pointer is seen, never at the corner
    await p.reload(); await p.waitForTimeout(400);
    await p.evaluate(() => { document.querySelectorAll('.modal').forEach(x => x.remove()); const t = document.getElementById('title'); if(t){ t.remove(); document.body.classList.remove('titled'); titleEl = null; } render(); });
    await p.evaluate(() => { const s = document.querySelector('.slot[data-act="team"][data-i="0"]'); s && s.click(); }); await p.waitForTimeout(150);
    c = await chip(); check(!c.shown || (c.x > 4 && c.y > 4 && !(c.x < 60 && c.y > innerHeight - 120)), `${tag}: with no pointer seen yet the chip is not left in a corner`);
    await p.mouse.move(400, 300); await p.waitForTimeout(80); c = await chip();
    check(c.shown && Math.abs(c.x - 414) < 8 && Math.abs(c.y - 314) < 8, `${tag}: it appears under the pointer on the first move`);
    // keeps inside the window at the edges
    await p.mouse.move(innerWidthOf(dev) - 2, 300); await p.waitForTimeout(60); c = await chip();
    check(c.x + c.w <= innerWidthOf(dev) + 1, `${tag}: it stays inside the window at the right edge`);
    check(!errs.length, `${tag}: no errors ${errs.join(';')}`);
    await ctx.close(); }
  // phone: pinned bar, unaffected
  const ctx = await b.newContext(devices['iPhone 13']); const p = await ctx.newPage();
  await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await p.waitForTimeout(400);
  await p.evaluate(() => { newRun(); document.querySelectorAll('.modal').forEach(x => x.remove()); const t = document.getElementById('title'); if(t){ t.remove(); document.body.classList.remove('titled'); titleEl = null; } G.pendingRewards = []; G.team = [makeUnit('squirtle', 0)]; fixSlots(G); render(); });
  const hid = await p.evaluate(() => { const c = document.querySelector('.carry'); return !c || getComputedStyle(c).display === 'none'; });
  await p.tap('.slot[data-act="team"][data-i="0"]'); await p.waitForTimeout(200);
  const ph = await p.evaluate(() => { const c = document.querySelector('.carry'), r = c.getBoundingClientRect(); return { shown: getComputedStyle(c).display !== 'none', pinned: c.classList.contains('pinned'), cx: r.left + r.width / 2, vw: innerWidth, bottom: innerHeight - r.bottom }; });
  check(hid, 'phone: nothing selected → no chip'); check(ph.shown && ph.pinned && Math.abs(ph.cx - ph.vw / 2) < 3 && ph.bottom < 130, `phone: selected → the chip is the bar centred along the bottom (${JSON.stringify(ph)})`);
  await b.close(); console.log(fails ? `${fails} FAILED` : 'carryfix passed'); process.exit(fails ? 1 : 0); })();
function innerWidthOf(dev){ return dev.viewport.width; }
