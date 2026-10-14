const { chromium, devices } = require('playwright');
(async () => { const b = await chromium.launch(); const p = await (await b.newContext(devices['iPhone 13'])).newPage();
  await p.goto(require('./pkbpaths').PAGE); await p.waitForTimeout(300);
  await p.evaluate(() => { newRun(); document.querySelectorAll('.modal').forEach(x => x.remove()); const t = document.getElementById('title'); if(t){ t.remove(); document.body.classList.remove('titled'); titleEl = null; }
    G.pendingRewards = []; G.team = [makeUnit('machop', 0)]; G.pc = [makeUnit('abra', 1), makeUnit('gastly', TUNING.expForLevel3), makeUnit('mewtwo', 0)]; fixSlots(G); render(); });
  const box = await p.evaluate(() => G.pc.find(u => u.id === 'abra').box);
  await p.tap(`.cell[data-act="pc"][data-i="${box}"]`); await p.waitForTimeout(250);
  await (await p.$('#inspect .pophead')).screenshot({ path: '/tmp/claude-0/pophead.png' });
  await (await p.$('.cell[data-act="pc"]')).evaluate(e => e.scrollIntoView({ block: 'center' })); await p.waitForTimeout(150);
  await p.screenshot({ path: '/tmp/claude-0/pc.png' }); await b.close(); })();
