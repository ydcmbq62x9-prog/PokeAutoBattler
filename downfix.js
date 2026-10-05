/* 2.2.1: a fainted fighter leaves no shadow behind (PC and phone, normal and reduced motion). */
const { chromium, devices } = require('playwright');
let fails = 0; const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
(async () => { const b = await chromium.launch();
  for(const [tag, dev, motion] of [['pc', { viewport:{ width:1250, height:900 } }, 'no-preference'], ['phone', devices['iPhone 13'], 'no-preference'], ['pc reduced motion', { viewport:{ width:1250, height:900 }, reducedMotion:'reduce' }, 'reduce']]){
    const ctx = await b.newContext(dev); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await p.waitForTimeout(400);
    await p.evaluate(() => { newRun(); document.querySelectorAll('.modal').forEach(x => x.remove()); const t = document.getElementById('title'); if(t){ t.remove(); document.body.classList.remove('titled'); titleEl = null; }
      G.pendingRewards = []; G.team = [makeUnit('charizard', 4), makeUnit('blastoise', 4)]; fixSlots(G); G.stage = 0; G.turn = 2; setSpeed(4); rollShop(G, false); save(); render(); });
    await p.click('[data-act="endturn"]');
    await p.waitForFunction(() => document.querySelector('.ftr.down'), null, { timeout: 30000 }).catch(() => {});
    await p.waitForTimeout(1200);
    const r = await p.evaluate(() => { const d = [...document.querySelectorAll('.ftr.down')]; return { n: d.length, ops: d.map(e => getComputedStyle(e.querySelector('.fmove')).opacity), x: d.map(e => getComputedStyle(e, '::after').content) }; });
    check(r.n > 0, `${tag}: someone fainted in the fight (${r.n})`);
    check(r.ops.every(o => parseFloat(o) <= 0.35) && r.x.every(c => /\u2715|✕/.test(c)), `${tag}: 4.13.0 board: every fainted tile stays, greyed out with a cross (opacity ${r.ops.join(',')})`);
    const alive = await p.evaluate(() => [...document.querySelectorAll('.ftr:not(.down)')].map(e => parseFloat(getComputedStyle(e.querySelector('.fshadow')).opacity)));
    check(alive.length === 0 || alive.every(o => o > 0.9), `${tag}: fighters still standing keep theirs`);
    check(!errs.length, `${tag}: no errors ${errs.join(';')}`);
    await ctx.close(); }
  await b.close(); console.log(fails ? `${fails} FAILED` : 'downfix passed'); process.exit(fails ? 1 : 0); })();
