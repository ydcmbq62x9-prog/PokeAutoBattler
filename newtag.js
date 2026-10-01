const { chromium, devices } = require('playwright');
(async () => { const b = await chromium.launch();
  for(const [tag, dev] of [['iphone', devices['iPhone 13']], ['se', { ...devices['iPhone SE'] }], ['wide', { viewport:{ width:1250, height:900 } }]]){
    const p = await (await b.newContext({ ...dev, colorScheme:'dark' })).newPage();
    await p.goto('file:///mnt/user-data/outputs/pokebattler.html'); await p.waitForTimeout(300);
    const r = await p.evaluate(() => { localStorage.setItem('pkb_seen_version', 'v48'); PREF.set('theme','dark'); applyTheme && applyTheme(); openChangelog();
      const pills = [...document.querySelectorAll('.clog .cnew, .clog .cnow')].map(e => ({ t: e.textContent, lines: e.getClientRects().length, h: Math.round(e.getBoundingClientRect().height) }));
      const metaSplit = [...document.querySelectorAll('.clog .cmeta')].filter(m => { const rs = [...m.children].map(c => Math.round(c.getBoundingClientRect().top)); return new Set(rs).size > 1; }).length;
      return { pills, metaSplit }; });
    console.log(tag, JSON.stringify(r));
    await (await p.$('.modal .box')).screenshot({ path:`newtag-${tag}.png` });
    // after closing, nothing is new any more
    const after = await p.evaluate(() => { document.querySelector('.modal [data-m="close"]').click(); openChangelog(); const n = document.querySelectorAll('.clog .cnew').length; document.querySelectorAll('.modal').forEach(m => m.remove()); return { n, unseen: hasUnseen() }; });
    console.log('  reopen:', JSON.stringify(after));
  }
  await b.close(); })();
