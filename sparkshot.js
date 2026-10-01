const { chromium, devices } = require('playwright');
(async () => { const b = await chromium.launch(); const p = await (await b.newContext(devices['iPhone 13'])).newPage();
  await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await p.waitForTimeout(250);
  await p.evaluate(() => { G.turn = 20; G.badges = 6; G.credits = 50; G.team = [makeUnit('machamp', 0)]; fixSlots(G);
    G.mart = [{ id:'protein', held:false }, { id:'hpup', held:false }, { id:'band', held:true }, { id:'claw', held:true }]; render();
    document.querySelector('.martlist').scrollIntoView(); });
  await p.evaluate(() => { G.mart = [{ id:'protein', held:false }, { id:'expshare', held:false }, { id:'choice', held:true }, { id:'orb', held:true }]; render(); });
  const shots = [];
  for(const t of [420, 560, 700, 900]){ await p.waitForTimeout(t - (shots.length ? [420,560,700,900][shots.length-1] : 0)); const f = `spark-${t}.png`; await (await p.$('.martlist')).screenshot({ path: f }); shots.push(f); }
  await b.close(); })();
