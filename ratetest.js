/* Showing a pokémon's rate outside a fight.
   The danger with a preview is that it drifts from the thing it previews, so
   the load-bearing assertion here is that the shop strip and the battle's own
   clock agree about who acts when. */
const { chromium } = require('playwright');
const URL = 'file:///mnt/user-data/outputs/gen2/pokebattler.html';
const errors = [];
const mark = m => console.log('… ' + m);

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport:{width:1200,height:1050} });
  ctx.setDefaultTimeout(6000);
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if(m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(URL);
  await page.waitForTimeout(250);

  /* A party with a wide spread, so "acts more often" is visible rather than
     a rounding artefact: Alakazam is roughly three times Snorlax. */
  await page.evaluate(() => {
    G.team = ['alakazam','pikachu','onix','snorlax'].map(id => makeUnit(id, 0));
    G.daycare = [{ unit: makeUnit('scyther', 0) }, { unit: makeUnit('geodude', 0) }];
    save(); render();
  });
  await page.waitForTimeout(200);

  // ---- A: the strip exists, is party-only, and is in the right order ----
  const q = await page.$$eval('.queue.shopq .qmon', els => els.map(e => e.title));
  if(!q.length) return fail('no order strip in the shop');
  if(q.length !== 8) errors.push(`the strip shows ${q.length} slots, expected 8`);
  const fastest = await page.evaluate(() =>
    G.team.slice().sort((a,b) => effSpd(b) - effSpd(a))[0].nm);
  if(!q[0].startsWith(fastest)) errors.push(`the strip opens with ${q[0]}, not ${fastest}`);
  const counts = q.reduce((m,t) => (m[t.split(' ')[0]] = (m[t.split(' ')[0]]||0)+1, m), {});
  const slow = await page.evaluate(() =>
    G.team.slice().sort((a,b) => effSpd(a) - effSpd(b))[0].nm);
  if((counts[fastest]||0) <= (counts[slow]||0))
    errors.push(`the fastest appears ${counts[fastest]}x and the slowest ${counts[slow]}x`);
  const nowCount = await page.$$eval('.queue.shopq .qmon.now', e => e.length);
  if(nowCount !== 1) errors.push('the strip marks ' + nowCount + ' as next');
  mark(`order strip: ${Object.entries(counts).map(([k,v]) => k+'x'+v).join(' ')}`);

  /* The strip is a PREDICTION. If it and the battle ever disagree, it is worse
     than nothing — it teaches the player a rule the fight then breaks. */
  const agree = await page.evaluate(() => {
    const team = G.team.filter(Boolean);
    const shown = previewOrder(team, 8).map(u => u.nm);
    // the same walk the battle does, from the battle's own primitive
    const q = team.map((u,i) => ({ u, i, at: intervalFor(effSpd(u)) })), out = [];
    while(out.length < 8){
      q.sort((a,b) => a.at - b.at || effSpd(b.u) - effSpd(a.u) || a.i - b.i);
      out.push(q[0].u.nm); q[0].at += intervalFor(effSpd(q[0].u));
    }
    return shown.join('>') === out.join('>') ? null : `${shown.join('>')} vs ${out.join('>')}`;
  });
  if(agree) errors.push('the preview and the clock disagree: ' + agree);

  /* And the order it predicts has to be the order the real simulator produces
     when only your side is acting — run a fight against a wall of punchbags
     that never kill anyone, and compare the first few of YOUR actions. */
  const real = await page.evaluate(() => {
    const team = G.team.filter(Boolean);
    const pred = previewOrder(team, 6).map(u => u.nm);
    const dummies = [0,1,2].map(() => { const d = makeUnit('snorlax', 0); d.hp = 9000; return d; });
    const r = simulateBattle(team.map(u => ({...u})), dummies, 12345);
    const name = {};
    for(const u of team) name[u.uid] = u.nm;
    const acted = r.steps.filter(s => s.actor != null && name[s.actor])
                         .map(s => name[s.actor]).slice(0, 6);
    return { pred, acted };
  });
  if(real.acted.length < 6) errors.push('the punchbag fight produced too few player actions to compare');
  else if(real.pred.join('>') !== real.acted.join('>'))
    errors.push(`predicted ${real.pred.join('>')} but the fight ran ${real.acted.join('>')}`);
  else mark('the fight runs the order the shop predicted: ' + real.pred.join(' > '));

  // ---- B: the rate line in the summary ----
  await page.click('[data-pop="team:0"] .sprite');
  await page.waitForTimeout(250);
  const line = await page.$eval('#inspect .paceline', e => e.textContent.replace(/\s+/g,' ').trim())
    .catch(() => null);
  if(!line) errors.push('no rate line in the summary');
  else {
    const m = line.match(/([\d.]+)×/);
    if(!m) errors.push('the rate line has no multiplier: ' + line);
    else {
      const shown = parseFloat(m[1]);
      const want = await page.evaluate(() => paceVs(G.team[0], G.team.filter(Boolean)));
      if(Math.abs(shown - want) > 0.005) errors.push(`the line says ${shown}× but the engine says ${want}`);
    }
    if(!/Blistering|Brisk|Steady|Sluggish/.test(line)) errors.push('no pace chip: ' + line);
    mark('summary: "' + line + '"');
  }

  // a lone pokémon has nothing to be fast compared to, so the line stays away
  await page.evaluate(() => { G.team = [makeUnit('pikachu',0)]; save(); render(); });
  await page.waitForTimeout(150);
  await page.keyboard.press('Escape');
  await page.click('[data-pop="team:0"] .sprite');
  await page.waitForTimeout(250);
  const solo = await page.$('#inspect .paceline');
  if(solo) errors.push('the rate line shows with a one-pokémon party');
  const soloq = await page.$('.queue.shopq:not(.ghostq)');
  if(soloq) errors.push('the order strip shows with a one-pokémon party');
  mark('one pokémon: no strip, no rate line');

  // ---- F: the Daycare says where it would slot in ----
  await page.evaluate(() => {
    G.team = ['onix','snorlax','machoke'].map(id => makeUnit(id, 0));
    G.daycare = [{ unit: makeUnit('alakazam', 0) }, { unit: makeUnit('geodude', 0) }];
    save(); render();
  });
  await page.waitForTimeout(200);
  const dp = await page.$$eval('.drow .dpace', els => els.map(e => e.textContent.trim()));
  if(dp.length < 2) errors.push('the daycare rows do not show a rank: ' + dp.length);
  if(dp[0] !== 'fastest') errors.push(`alakazam next to onix/snorlax/machoke reads "${dp[0]}"`);
  const tip = await page.$eval('.drow .dpace', e => e.title);
  if(!/×/.test(tip)) errors.push('no ratio in the daycare tooltip: ' + tip);
  mark(`daycare: ${dp.join(', ')} — "${tip}"`);

  // ---- it all still fits on a phone ----
  await page.setViewportSize({ width:390, height:860 });
  await page.waitForTimeout(250);
  const over = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  if(over) errors.push('horizontal overflow at 390px');
  const stripFits = await page.evaluate(() => {
    const el = document.querySelector('.queue.shopq');
    return !el || el.getBoundingClientRect().width <= window.innerWidth;
  });
  if(!stripFits) errors.push('the order strip is wider than the phone');
  mark('phone width ok');

  await browser.close();
  if(errors.length){
    console.log('\n' + errors.length + ' FAILURES:');
    [...new Set(errors)].forEach(e => console.log('  - ' + e));
    process.exit(1);
  }
  console.log('\nrate display passed');

  function fail(m){ errors.push(m); }
})();
