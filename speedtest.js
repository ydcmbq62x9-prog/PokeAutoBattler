/* Playback must be readable by default, controllable, and remembered. */
const { chromium } = require('playwright');
const URL = require('./pkbpaths').PAGE;
const errors = [];
const mark = m => console.log('… ' + m);

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport:{width:1200,height:1000} });
  ctx.setDefaultTimeout(6000);
  const page = await ctx.newPage();
  page.on('console', m => { if(m.type()==='error') errors.push('console: '+m.text()); });
  page.on('pageerror', e => errors.push('pageerror: '+e.message));
  await page.goto(URL);
  await page.waitForTimeout(250);

  // the delay model, checked directly against the numbers we designed for
  const model = await page.evaluate(() => {
    const out = {};
    const saved = battle;
    const fake = n => ({ steps: Array.from({length:n}, () => ({ lines:['a'] })), i:0 });
    for(const n of [8, 18, 26, 44, 132, 234]){
      battle = fake(n);
      out['n'+n] = stepDelay();
    }
    // a step that says three things should dwell longer than a one-liner
    battle = { steps:[{lines:['a','b','c','d']}, {lines:['a']}], i:0 };
    out.busy = stepDelay();
    battle = { steps:[{lines:['a']}, {lines:['a']}], i:0 };
    out.quiet = stepDelay();
    battle = saved;
    return out;
  });
  if(model.n18 < 600) errors.push(`a median fight steps every ${model.n18}ms — too fast to read`);
  if(model.n234 < 400) errors.push(`even the longest fight should stay above 400ms (${model.n234}ms)`);
  if(model.busy <= model.quiet) errors.push('a multi-line step does not dwell longer');
  mark(`delays: ${JSON.stringify(model)}`);

  // play a real battle and use the control
  await page.evaluate(() => {
    G.turn = 6; G.credits = 40;
    G.team = [makeUnit('squirtle',0), makeUnit('onix',0), makeUnit('pikachu',0)];
    save(); render();
  });
  await page.click('[data-act="endturn"]');
  await page.waitForTimeout(400);

  const speedBtns = await page.$$eval('.speed .sp', els => els.map(e => e.textContent.trim()));
  if(speedBtns.join(',') !== '1×,2×,4×') errors.push('speed control shows ' + speedBtns.join(','));
  const onNow = await page.$eval('.speed .sp.on', e => e.textContent.trim()).catch(()=>null);
  if(onNow !== '1×') errors.push('default speed is ' + onNow);

  // a progress counter so you know how much fight is left
  const counter = await page.$eval('.steps', e => e.textContent.trim()).catch(()=>null);
  if(!counter || !/\d+\/\d+/.test(counter)) errors.push('no step counter during playback');

  // 4× must actually advance faster than 1×
  const advance = async () => {
    const before = await page.evaluate(() => battle.i);
    await page.waitForTimeout(1500);
    return (await page.evaluate(() => battle.i)) - before;
  };
  const slow = await advance();
  await page.click('[data-act="speed"][data-i="4"]');
  await page.waitForTimeout(120);
  const fast = await advance();
  if(!(fast > slow)) errors.push(`4× advanced ${fast} steps vs 1×'s ${slow}`);
  mark(`1× advanced ${slow} steps in 1.5s, 4× advanced ${fast}`);

  // and the choice sticks across a reload
  await page.reload();
  await page.waitForTimeout(300);
  const remembered = await page.evaluate(() => speed);
  if(remembered !== 4) errors.push('the speed choice was not remembered (' + remembered + ')');
  mark('speed is remembered');

  // Skip still jumps to the end
  await page.evaluate(() => { G.team = [makeUnit('squirtle',0)]; save(); render(); });
  await page.click('[data-act="endturn"]');
  await page.waitForTimeout(300);
  const skip = await page.$('[data-act="skip"]');
  if(skip){
    await skip.click();
    await page.waitForTimeout(250);
    const atEnd = await page.evaluate(() => battle.i === battle.steps.length - 1);
    if(!atEnd) errors.push('Skip did not jump to the end');
    const cont = await page.$('[data-act="afterbattle"]');
    if(!cont) errors.push('no Continue button after skipping');
  }
  mark('skip works');

  // --- the Pokédex lists every held item ---
  await page.evaluate(() => { finishPlayback(); afterBattle(); });
  await page.waitForTimeout(400);
  await page.click('[data-act="menu"]');
  await page.waitForTimeout(150);
  await page.click('[data-m="dex"]');
  await page.waitForTimeout(250);
  const dex = await page.evaluate(() => {
    const txt = document.body.innerText;
    return Object.keys(HELD_ITEMS).map(k => ({
      name: HELD_ITEMS[k].name,
      listed: txt.includes(HELD_ITEMS[k].name),
      described: txt.includes(HELD_ITEMS[k].text.slice(0, 24)),
    }));
  });
  for(const d of dex){
    if(!d.listed) errors.push(`the dex does not list ${d.name}`);
    if(!d.described) errors.push(`the dex does not explain ${d.name}`);
  }
  const kinds = await page.$$eval('.dexkind b', els => els.map(e => e.textContent.trim()));
  if(kinds.join(',') !== 'Stat,Trigger,Economy') errors.push('dex kind groups: ' + kinds.join(','));
  mark(`dex lists all ${dex.length} held items in ${kinds.length} groups`);
  await page.screenshot({ path:'shot-dex-held.png', fullPage:false });

  await browser.close();
  if(errors.length){
    console.log('\n' + errors.length + ' FAILURES:');
    [...new Set(errors)].slice(0,20).forEach(e => console.log('  - ' + e));
    process.exit(1);
  }
  console.log('\nspeed + dex passed');
})();
