const { chromium, devices } = require('playwright');
(async () => { const b = await chromium.launch(); const ctx = await b.newContext(devices['iPhone 13']); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(require('./pkbpaths').PAGE); await p.waitForTimeout(300);
  await p.evaluate(() => { newRun(); document.querySelectorAll('.modal').forEach(x => x.remove()); const t = document.getElementById('title'); if(t){ t.remove(); document.body.classList.remove('titled'); }
    G.pendingRewards = []; G.turn = 22; G.badges = 5; G.trainerExp = { hp:40, atk:40, spd:20 };
    G.team = [makeUnit('articuno',0), makeUnit('machoke',60), makeUnit('pikachu',0)]; fixSlots(G); G.credits = 30; G.encounter = { id:'moltres', cost:12, turn:G.turn }; render(); });
  await p.waitForTimeout(300); await p.screenshot({ path:'/tmp/claude-0/s1.png' });
  await p.evaluate(() => { sel = { kind:'team', idx:0 }; inspect = { kind:'unit', u:G.team[0] }; render(); }); await p.waitForTimeout(300);
  await p.screenshot({ path:'/tmp/claude-0/s2.png' });
  console.log(errs.join('\n') || 'no errors'); await b.close(); })();
