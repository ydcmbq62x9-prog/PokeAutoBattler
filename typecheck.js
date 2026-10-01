const { chromium, devices } = require('playwright');
(async () => { const b = await chromium.launch(); const p = await (await b.newContext(devices['iPhone 13'])).newPage();
  await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await p.waitForTimeout(300);
  const r = await p.evaluate(() => {
    const out = {};
    for(const [stone, want] of [['waterstone','vaporeon'],['thunderstone','jolteon'],['firestone','flareon']]){
      newRun(); G.credits = 50; G.turn = 12; G.badges = 4; G.team = [makeUnit('eevee', 0)]; fixSlots(G);
      G.mart = [{ id: stone, held:false }]; render();
      // buy & use the stone through the real UI flow
      const r = buyItem(G, 0, G.team[0].pos != null ? 0 : 0, 'team'); render();
      out[stone + '_buy'] = r;
      const u = G.team[0];
      sel = { kind:'team', idx:0 }; inspect = { kind:'unit', u }; render();
      out[stone] = { id: u.id, spType: SPECIES[u.id].type, chip: (document.querySelector('#inspect .poptype') || {}).textContent,
        tcol: getComputedStyle(document.querySelector('.slot[data-act="team"] .unit')).getPropertyValue('--tcol'),
        weak: (document.querySelector('#inspect .popmu') || {}).textContent.replace(/\s+/g,' ').trim() };
    }
    out.dex = ['eevee','vaporeon','jolteon','flareon'].map(k => k + ':' + SPECIES[k].type + '/' + tcgTypeFor(SPECIES[k].gen1));
    return out; });
  console.log(JSON.stringify(r, null, 1)); await b.close(); })();
