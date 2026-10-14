const { chromium, devices } = require('playwright');
(async () => { const b = await chromium.launch(); const p = await (await b.newContext(devices['iPhone 13'])).newPage();
  await p.goto(require('./pkbpaths').PAGE); await p.waitForTimeout(250);
  await p.evaluate(() => { G.turn = 20; G.badges = 5; G.credits = 50; G.team = [makeUnit('abra', 0)];
    G.mart = [{ id:'protein', held:false }, { id:'candy', held:false }, { id:'expshare', held:false }, { id:'band', held:true }, { id:'char', held:true }, { id:'egg', held:true }]; render(); });
  const el = await p.$('.martlist'); await el.screenshot({ path:'rar-mart.png' }); await b.close(); })();
