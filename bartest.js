/* The summary popup's stat bars.
   The maxima were typed in (70/24/140) and the stat rescale silently pegged
   every attack bar at 100% while speed never passed ~62%. They are now derived
   from the roster; this suite is what stops them drifting apart again. */
const { chromium } = require('playwright');
const URL = require('./pkbpaths').PAGE;
const errors = [];
const mark = m => console.log('… ' + m);

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport:{width:1200,height:1000} })).newPage();
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto(URL);
  await page.waitForTimeout(250);

  // the maxima track the roster, whatever the roster is
  const max = await page.evaluate(() => {
    const top = s => Math.max(...Object.keys(SPECIES).filter(k => !SPECIES[k].legendary).map(k => SPECIES[k][s]));   // 2.1.0: legendaries may run the bar full
    return { bar: BAR_MAX, roster: { hp: top('hp'), atk: top('atk'), spd: top('spd') } };
  });
  for(const s of ['hp','atk','spd']){
    if(max.bar[s] <= max.roster[s])
      errors.push(`BAR_MAX.${s} is ${max.bar[s]} but the roster reaches ${max.roster[s]}`);
    if(max.bar[s] > max.roster[s] * 1.5)
      errors.push(`BAR_MAX.${s} is ${max.bar[s]}, far past the roster's ${max.roster[s]} — bars will look empty`);
  }
  mark(`maxima ${JSON.stringify(max.bar)} over roster ${JSON.stringify(max.roster)}`);

  /* No base-form pokémon may peg or flatline a bar: if the strongest starter
     reads 100% and the weakest reads 3%, the bar has stopped comparing. */
  const widths = await page.evaluate(() => {
    const out = [];
    for(const id of Object.keys(SPECIES).filter(k => !SPECIES[k].legendary)){
      const u = makeUnit(id, 0);
      out.push({ id,
        hp:  effHp(u)  / BAR_MAX.hp,
        atk: effAtk(u) / BAR_MAX.atk,
        spd: effSpd(u) / BAR_MAX.spd });
    }
    return out;
  });
  for(const s of ['hp','atk','spd']){
    const worst = widths.reduce((a,b) => b[s] > a[s] ? b : a);
    if(worst[s] >= 1) errors.push(`${worst.id} pegs the ${s} bar at ${(worst[s]*100).toFixed(0)}%`);
    if(worst[s] < 0.7) errors.push(`nothing fills the ${s} bar past ${(worst[s]*100).toFixed(0)}% — the scale is too loose`);
    mark(`${s}: fullest base form is ${worst.id} at ${(worst[s]*100).toFixed(0)}%`);
  }

  /* And the rendered popup has to agree with the numbers — a bar that computes
     correctly and draws at 100% because of a CSS clamp is still wrong. */
  await page.evaluate(() => {
    G.team = [makeUnit('pikachu',0), makeUnit('onix',0), makeUnit('snorlax',0)];
    save(); render();
  });
  await page.waitForTimeout(150);
  const card = await page.$('[data-pop^="team:"]');
  if(!card){ errors.push('no party card to hover'); }
  else {
    await card.click();
    await page.waitForTimeout(250);
    const drawn = await page.$$eval('#inspect .sbar u', els => els.map(e => parseFloat(e.style.width)));
    if(drawn.length < 3) errors.push('the summary does not draw three stat bars: ' + drawn.length);
    if(drawn.some(w => w >= 100)) errors.push('a bar is drawn full for a base-form pokémon: ' + drawn.join('/'));
    if(drawn.some(w => !(w > 0))) errors.push('a bar is drawn empty: ' + drawn.join('/'));
    const who = await page.$eval('#inspect .popname', e => e.textContent.trim()).catch(() => '?');
    mark(`${who} summary draws ` + drawn.map(w => Math.round(w) + '%').join(' / '));
  }

  await browser.close();
  if(errors.length){
    console.log('\n' + errors.length + ' FAILURES:');
    [...new Set(errors)].forEach(e => console.log('  - ' + e));
    process.exit(1);
  }
  console.log('\nstat bars passed');
})();
