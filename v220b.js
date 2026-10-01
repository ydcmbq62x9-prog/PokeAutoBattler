const { chromium, devices } = require('playwright');
let fails = 0; const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
(async () => { const b = await chromium.launch(); const ctx = await b.newContext(devices['iPhone 13']); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await p.waitForTimeout(300);
  await p.evaluate(() => { newRun(); document.querySelectorAll('.modal').forEach(x => x.remove()); const t = document.getElementById('title'); if(t){ t.remove(); document.body.classList.remove('titled'); titleEl = null; }
    G.pendingRewards = []; G.team = [makeUnit('machop', 0)]; G.pc = [makeUnit('abra', 1), makeUnit('gastly', TUNING.expForLevel3), makeUnit('mewtwo', 0)]; fixSlots(G); render(); });
  const read = async box => { await p.evaluate(b => { sel = null; inspect = null; render(); }, box); await p.tap(`.cell[data-act="pc"][data-i="${box}"]`); await p.waitForTimeout(200);
    return p.evaluate(() => { const r = document.querySelector('#inspect .pophead') || document.querySelector('.popup:not([hidden]) .pophead'); if(!r) return null;
      const pp = r.querySelector('.poppips'); return { lv: (r.querySelector('.poplv') || {}).textContent, pips: pp ? pp.querySelectorAll('i').length : -1, on: pp ? pp.querySelectorAll('i.on').length : -1, max: !!(pp && pp.classList.contains('max')), w: pp ? pp.getBoundingClientRect().width : 0 }; }); };
  const a = await read(0), g = await read(1), m = await read(2);
  check(a && a.lv === 'Lv 1' && a.pips === 2 && a.on === 1 && a.w > 10, `a PC Abra with one copy shows Lv 1 and 1 of 2 pips (${JSON.stringify(a)})`);
  check(g && g.lv === 'Lv 3' && g.max, `a level-3 pokémon shows MAX (${JSON.stringify(g)})`);
  check(m && /Legendary/.test(m.lv) && m.pips === -1 && !m.max, `a legendary shows ★ Legendary and no pips (${JSON.stringify(m)})`);
  await p.tap('.cell[data-act="pc"][data-i="0"]').catch(()=>{}); await p.waitForTimeout(100);
  await p.evaluate(() => { sel = null; inspect = null; render(); }); await p.tap('.cell[data-act="pc"][data-i="0"]'); await p.waitForTimeout(200);
  await p.screenshot({ path: '/tmp/claude-0/pips.png' });
  check(!errs.length, 'no errors ' + errs.join('; '));
  await b.close(); console.log(fails ? `${fails} FAILED` : 'v220b passed'); process.exit(fails ? 1 : 0); })();
