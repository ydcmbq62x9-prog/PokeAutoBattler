/* 2.2.1: the dock (next-fight box + BATTLE + Undo) keeps one shape at every width and state. */
const { chromium, devices } = require('playwright');
let fails = 0; const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
(async () => { const b = await chromium.launch();
  for(const [tag, dev] of [['640', { viewport:{ width:640, height:800 } }], ['720', { viewport:{ width:720, height:800 } }], ['1000', { viewport:{ width:1000, height:800 } }], ['1400', { viewport:{ width:1400, height:900 } }], ['phone', devices['iPhone 13']], ['small phone', { viewport:{ width:340, height:640 }, hasTouch:true, isMobile:true }]]){
    const ctx = await b.newContext(dev); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(require('./pkbpaths').PAGE); await p.waitForTimeout(400);
    await p.evaluate(() => { newRun(); document.querySelectorAll('.modal').forEach(x => x.remove()); const t = document.getElementById('title'); if(t){ t.remove(); document.body.classList.remove('titled'); titleEl = null; }
      G.pendingRewards = []; G.credits = 30; render(); });
    const geo = () => p.evaluate(() => { const d = document.querySelector('.dock'); if(!d) return null; const q = x => { const e = d.querySelector(x); if(!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height, b: r.bottom }; };
      return { s: q('.speech'), f: q('.btn.fight'), u: q('.btn.undo'), vw: innerWidth, dockW: d.getBoundingClientRect().width }; });
    const wide = dev.viewport.width >= 620 && dev.viewport.width < 1000, phoneDock = dev.viewport.width <= 700;   // 4.9.1: up to 700px the dock is only the BATTLE button. 5.0.0: from 1000px it is the foot of the shop column, box over BATTLE
    const chk = (g, what) => { if(!g || !g.s || !g.f){ check(false, `${tag}: ${what}: dock present`); return; }
      if(phoneDock){ check(g.f.h <= 70 && g.f.w >= g.dockW - 2, `${tag}: ${what}: BATTLE is a slim full-width bar (${g.f.h.toFixed(0)}px)`); if(g.u) check(g.u.h < 45 && g.u.b <= g.f.t + 1, `${tag}: ${what}: Undo sits above it`); return; }
      if(wide){
        check(Math.abs(g.s.t - g.f.t) < 1.5 && Math.abs(g.s.h - g.f.h) < 1.5, `${tag}: ${what}: box and BATTLE are the same height and line up (${g.s.h.toFixed(0)} / ${g.f.h.toFixed(0)}, tops ${g.s.t.toFixed(0)} / ${g.f.t.toFixed(0)})`);
        check(g.s.w > g.dockW * 0.55 && g.f.w <= 215 && g.f.w >= 150, `${tag}: ${what}: the box keeps most of the width, BATTLE a fixed size (${g.s.w.toFixed(0)} / ${g.f.w.toFixed(0)} of ${g.dockW.toFixed(0)})`);
        check(g.s.h <= 130 && g.f.h <= 130, `${tag}: ${what}: neither grows tall (${g.s.h.toFixed(0)}px)`);
      } else {
        check(Math.abs(g.s.w - g.f.w) < 1.5 && g.f.h <= 60 && g.s.h <= 120, `${tag}: ${what}: box and BATTLE stack at the same width, BATTLE a normal button (${g.s.w.toFixed(0)} / ${g.f.w.toFixed(0)}, ${g.f.h.toFixed(0)}px)`); }
      if(g.u) check(g.u.b <= g.s.t + 1 && g.u.h < 45, `${tag}: ${what}: Undo sits on its own row above (${g.u.h.toFixed(0)}px)`); };
    chk(await geo(), 'plain');
    await p.evaluate(() => { document.querySelector('.drow[data-act="dc"][data-i="0"]').click(); document.querySelector('.slot[data-act="team"][data-i="0"]').click(); }); await p.waitForTimeout(250);
    const g1 = await geo(); check(!!(g1 && g1.u), `${tag}: Undo is showing`); chk(g1, 'with Undo');
    if(wide){ await p.evaluate(() => { sel = { kind:'team', idx:0 }; inspect = { kind:'unit', u:G.team[0] }; render(); }); await p.waitForTimeout(150); chk(await geo(), 'with the summary open'); }
    await p.evaluate(() => { const bs = GYMS[0]; G.stage = runPlan().findIndex(s => s.kind === 'elite'); if(G.stage < 0) G.stage = runPlan().findIndex(s => s.kind === 'champion'); render(); }); await p.waitForTimeout(150);
    chk(await geo(), 'Elite Four (long name)');
    await p.evaluate(() => { G.team.forEach(u => u.hp = 0); G.pc = []; render(); });   // nobody can fight
    await p.waitForTimeout(100); const gn = await geo();
    if(gn && gn.f){ check(gn.f.h <= 130, `${tag}: "nobody can fight" state keeps a reasonable size (${gn.f.h.toFixed(0)}px)`); }
    check(!errs.length, `${tag}: no errors ${errs.join(';')}`);
    await ctx.close(); }
  await b.close(); console.log(fails ? `${fails} FAILED` : 'dockfix passed'); process.exit(fails ? 1 : 0); })();
