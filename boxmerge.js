/* Levelling a pokémon without taking it out of the box. */
const { chromium } = require('playwright');
const URL = require('./pkbpaths').PAGE;
const errors = [];
const mark = m => console.log('… ' + m);

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport:{width:1200,height:1000}, deviceScaleFactor:2 });
  ctx.setDefaultTimeout(6000);
  const page = await ctx.newPage();
  page.on('console', m => { if(m.type()==='error') errors.push('console: '+m.text()); });
  page.on('pageerror', e => errors.push('pageerror: '+e.message));
  await page.goto(URL);
  await page.waitForTimeout(250);

  await page.evaluate(() => {
    G.turn = 10; G.badges = 2; G.credits = 30;
    G.team = [makeUnit('machop',0)];
    G.pc = [makeUnit('squirtle',0), makeUnit('onix',0), makeUnit('squirtle',0), makeUnit('squirtle',0)];
    save(); render();
  });
  await page.waitForTimeout(150);

  // the ＋ badge marks copies that can level, including box-only ones
  const ready = await page.$$eval('[data-act="pc"] .cready', els => els.length);
  if(ready < 2) errors.push(`only ${ready} box cells offer a merge`);
  const lone = await page.$('[data-act="pc"][data-i="1"] .cready');
  if(lone) errors.push('a lone Onix is marked mergeable');
  mark(`${ready} box copies marked as ready to combine`);

  // pick one up: its twins light up, the Onix does not
  await page.click('[data-act="pc"][data-i="0"]');
  await page.waitForTimeout(120);
  const merge = await page.$$eval('[data-act="pc"].mergeable', els => els.map(e => e.dataset.i));
  if(merge.join(',') !== '2,3') errors.push('twins highlighted: ' + merge.join(',') + ' (expected 2,3)');
  const lifted = await page.$('[data-act="pc"][data-i="0"].lifted');
  if(!lifted) errors.push('the picked-up copy is not dimmed');
  const hint = await page.$eval('.hintbar', e => e.textContent.trim()).catch(()=>null);
  if(!hint || !/box/.test(hint)) errors.push('the hint does not mention the box: ' + hint);
  mark('hint: ' + hint);

  // combine them in place
  await page.click('[data-act="pc"][data-i="2"]');
  await page.waitForTimeout(200);
  let box = await page.evaluate(() => G.pc.map(u => u.id + ':' + unitLevel(u) + ':' + u.exp));
  if(box.length !== 3) errors.push('the box did not close up: ' + box.join(' '));
  if(!box.some(b => b.startsWith('squirtle') && b.endsWith(':1')))
    errors.push('no copy was banked: ' + box.join(' '));
  if(await page.$('[data-act="pc"].mergeable')) errors.push('the highlight stayed on after merging');
  mark('combined in the box: ' + box.join(' '));

  // one more evolves it, still in the box
  // v34: cells are BOXES, and a box keeps its place when a neighbour leaves
  const first = await page.evaluate(() => G.pc.find(u => u.id === 'squirtle' && u.exp > 0).box);
  const other = await page.evaluate(b => G.pc.find(u => u.box !== b && u.id === 'squirtle').box, first);
  await page.click(`[data-act="pc"][data-i="${other}"]`);
  await page.waitForTimeout(120);
  await page.click(`[data-act="pc"][data-i="${first}"]`);
  await page.waitForTimeout(250);
  box = await page.evaluate(() => G.pc.map(u => u.id + ':' + unitLevel(u)));
  if(!box.some(b => b.startsWith('wartortle'))) errors.push('it did not evolve in the box: ' + box.join(' '));
  const toast = await page.$eval('#inspect', e => e.textContent.trim()).catch(()=>'');
  if(!/evolved/i.test(toast)) errors.push('no evolution message: ' + toast);
  mark('evolved in the box: ' + box.join(' ') + ' — "' + toast.split('\n')[0] + '"');

  // v34: tapping a different species swaps their boxes; an empty box takes it
  await page.evaluate(() => { G.pc = [makeUnit('squirtle',0), makeUnit('onix',0)]; sel = null; save(); render(); });
  await page.waitForTimeout(120);
  await page.click('[data-act="pc"][data-i="0"]');
  await page.waitForTimeout(100);
  await page.click('[data-act="pc"][data-i="1"]');
  await page.waitForTimeout(150);
  let where = await page.evaluate(() => G.pc.map(u => u.id + '@' + u.box).join(' '));
  if(where !== 'onix@0 squirtle@1') errors.push('tapping a different species did not swap them: ' + where);
  const stillTwo = await page.evaluate(() => G.pc.length);
  if(stillTwo !== 2) errors.push('two different species merged');
  await page.click('[data-act="pc"][data-i="1"]'); await page.waitForTimeout(100);
  await page.click('[data-act="pc"][data-i="6"]'); await page.waitForTimeout(150);
  where = await page.evaluate(() => G.pc.map(u => u.id + '@' + u.box).join(' '));
  if(where !== 'onix@0 squirtle@6') errors.push('an empty box did not take it: ' + where);
  mark('different species swap; any empty box takes a pokémon: ' + where);

  // withdrawing onto a party twin still works
  await page.evaluate(() => {
    G.team = [makeUnit('squirtle',0)]; G.pc = [makeUnit('squirtle',0)]; sel = null; save(); render();
  });
  await page.waitForTimeout(120);
  await page.click('[data-act="pc"][data-i="0"]');
  await page.waitForTimeout(100);
  await page.click('[data-act="team"][data-i="0"]');
  await page.waitForTimeout(200);
  const after = await page.evaluate(() => ({ pc: G.pc.length, exp: G.team[0].exp }));
  if(after.pc !== 0 || after.exp !== 1) errors.push('the party route broke: ' + JSON.stringify(after));
  mark('the party route still works');

  await browser.close();
  if(errors.length){
    console.log('\n' + errors.length + ' FAILURES:');
    [...new Set(errors)].slice(0,20).forEach(e => console.log('  - ' + e));
    process.exit(1);
  }
  console.log('\nbox levelling passed');
})();
