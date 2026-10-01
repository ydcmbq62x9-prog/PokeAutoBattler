const { chromium, devices } = require('playwright');
let fails = 0; const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
const mark = () => { const vis = [...document.querySelectorAll('#title .tmi, .modal .smi')].filter(e => e.offsetParent);
  return vis.map(e => ({ t: e.textContent.trim().slice(0, 10), arrow: e.classList.contains('cur'), outline: getComputedStyle(e).outlineStyle !== 'none' && parseFloat(getComputedStyle(e).outlineWidth) > 0,
    bg: getComputedStyle(e).backgroundColor })); };
(async () => { const b = await chromium.launch();
  for(const [tag, dev] of [['pc', { viewport:{ width:1250, height:900 } }], ['phone', devices['iPhone 13']]]){
    const ctx = await b.newContext(dev); await ctx.addInitScript(() => { window.PKB_TITLE = true; }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await p.waitForTimeout(500);
    const tap = sel => dev.hasTouch ? p.tap(sel) : p.click(sel);
    await tap('.tpress'); await p.waitForTimeout(300);
    // the reported case: focus on one item, pointer on another
    if(!dev.hasTouch){
      await p.focus('[data-t="daily"]'); await p.keyboard.press('Shift'); await p.mouse.move(600, 300);
      await p.hover('[data-t="options"]'); await p.mouse.move(5, 5); await p.hover('[data-t="options"]'); await p.waitForTimeout(150); }
    else { await p.focus('[data-t="daily"]'); await p.tap('[data-t="options"]').catch(() => {}); await p.waitForTimeout(100); await p.evaluate(() => { document.querySelectorAll('.modal').forEach(m => m.remove()); }); }
    const m = await p.evaluate(mark);
    check(m.filter(x => x.arrow).length === 1, `${tag}: exactly one ▶ arrow on the title menu (${m.filter(x => x.arrow).map(x => x.t)})`);
    check(m.every(x => !x.outline), `${tag}: no dashed/outline box on any title item`);
    if(!dev.hasTouch){ // keyboard use: arrows move, still one marker
      await p.keyboard.press('ArrowDown'); await p.keyboard.press('Tab'); await p.waitForTimeout(100);
      const k = await p.evaluate(mark); check(k.filter(x => x.arrow).length === 1 && k.every(x => !x.outline), `${tag}: after arrow keys and Tab there is still just the arrow`); }
    // START menu inside the game
    await p.evaluate(() => { newRun(); document.querySelectorAll('.modal').forEach(x => x.remove()); const t = document.getElementById('title'); if(t){ t.remove(); document.body.classList.remove('titled'); titleEl = null; } G.pendingRewards = []; render(); });
    await p.waitForTimeout(200);
    await p.evaluate(() => { const sb = document.querySelector('[data-act="menu"]'); sb && sb.click(); }); await p.waitForTimeout(400);
    const sm = await p.evaluate(mark);
    if(sm.length){ if(!dev.hasTouch){ await p.focus('.smi:nth-of-type(3)').catch(() => {}); await p.waitForTimeout(80); }
      const s2 = await p.evaluate(mark); check(s2.filter(x => x.arrow).length === 1 && s2.every(x => !x.outline && (x.bg === 'rgba(0, 0, 0, 0)' || x.bg === 'transparent')), `${tag}: START menu shows only its arrow (${s2.length} items)`); }
    check(!errs.length, `${tag}: no errors ${errs.join(';')}`);
    await ctx.close(); }
  await b.close(); console.log(fails ? `${fails} FAILED` : 'selfix passed'); process.exit(fails ? 1 : 0); })();
