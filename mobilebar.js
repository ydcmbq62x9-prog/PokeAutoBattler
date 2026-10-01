/* On a phone the bottom strip is contested: the summary sheet, the carry bar
   and the action bar all want it. The buttons must stay visible and tappable. */
const { chromium } = require('playwright');
const URL = 'file:///mnt/user-data/outputs/gen2/pokebattler.html';
const errors = [];
const mark = m => console.log('… ' + m);

(async () => {
  const browser = await chromium.launch();
  // hasTouch + no hover is what puts the popup into sheet mode
  const ctx = await browser.newContext({
    viewport:{width:390,height:800}, deviceScaleFactor:2,
    hasTouch:true, isMobile:true,
  });
  ctx.setDefaultTimeout(6000);
  const page = await ctx.newPage();
  page.on('console', m => { if(m.type()==='error') errors.push('console: '+m.text()); });
  page.on('pageerror', e => errors.push('pageerror: '+e.message));
  await page.goto(URL);
  await page.waitForTimeout(300);

  await page.evaluate(() => {
    G.turn = 14; G.badges = 3; G.credits = 30;
    G.team = [makeUnit('wartortle',2), makeUnit('onix',0), makeUnit('pikachu',0)];
    G.team[0].held = 'band';
    G.pc = [makeUnit('abra',0)];
    G.bag = ['sitrus','lefto'];
    rollShop(G, false); save(); render();
  });
  await page.waitForTimeout(200);

  const box = async sel => page.$eval(sel, e => {
    const r = e.getBoundingClientRect();
    return { top:Math.round(r.top), bottom:Math.round(r.bottom), h:Math.round(r.height) };
  }).catch(() => null);

  const vh = 800;
  // the held badge must not steal a tap meant for the card
  const badgeTaps = await page.$eval('[data-act="team"][data-i="0"] .held',
    e => getComputedStyle(e).pointerEvents).catch(() => null);
  if(badgeTaps !== 'none') errors.push('the held badge is still a tap target on touch');

  // --- pick up a party pokémon: the action bar must be on screen and clear ---
  await page.click('[data-act="team"][data-i="0"]');
  await page.waitForTimeout(300);

  const bar = await box('.ctxbar');
  if(!bar) errors.push('no action bar after selecting a pokémon');
  else {
    if(bar.bottom > vh + 2) errors.push(`the action bar is off screen (bottom ${bar.bottom} > ${vh})`);
    if(bar.top < 0) errors.push('the action bar is above the viewport');
  }
  const sheet = await box('.popup');
  if(sheet && bar){
    if(sheet.bottom > bar.top + 1)
      errors.push(`the summary sheet (bottom ${sheet.bottom}) covers the action bar (top ${bar.top})`);
  }
  const carry = await box('.carry');
  if(carry && bar && carry.bottom > bar.top + 1)
    errors.push(`the carry bar (bottom ${carry.bottom}) covers the action bar (top ${bar.top})`);
  mark(`bar ${bar && bar.top}–${bar && bar.bottom}, sheet ends ${sheet && sheet.bottom}, carry ends ${carry && carry.bottom}`);

  // every button in the bar must be hittable, not just visible
  const buttons = await page.$$eval('.ctxbar .btn', els => els.map(e => e.textContent.trim()));
  mark('buttons: ' + buttons.join(' | '));
  for(const label of buttons){
    const el = await page.$(`.ctxbar .btn:text-is("${label}")`).catch(()=>null);
    if(!el) continue;
    const hit = await el.evaluate(e => {
      const r = e.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2);
      return !!top && (top === e || e.contains(top));
    });
    if(!hit) errors.push(`"${label}" is covered by something else`);
  }

  // --- selling from a pokémon ---
  const before = await page.evaluate(() => ({ c: G.credits, held: G.team[0].held }));
  const sellBtn = await page.$('.ctxbar [data-act="sellheld"]');
  if(!sellBtn) errors.push('no Sell button for a pokémon holding an item');
  else {
    await sellBtn.click();
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => ({ c: G.credits, held: G.team[0].held }));
    if(after.held) errors.push('selling left the item on the pokémon');
    if(after.c <= before.c) errors.push(`selling paid nothing (${before.c} -> ${after.c})`);
    mark(`sold off a pokémon: ${before.c}₽ -> ${after.c}₽`);
  }

  // --- selling from the Bag ---
  await page.click('.wall.bag .bcell:not(.empty)');
  await page.waitForTimeout(250);
  const bagBefore = await page.evaluate(() => ({ c: G.credits, n: G.bag.length }));
  const bagSell = await page.$('.ctxbar [data-act="sellheld"][data-where="bag"]');
  if(!bagSell) errors.push('no Sell button for a Bag item');
  else {
    await bagSell.click();
    await page.waitForTimeout(300);
    const bagAfter = await page.evaluate(() => ({ c: G.credits, n: G.bag.length }));
    if(bagAfter.n !== bagBefore.n - 1) errors.push('the item did not leave the Bag');
    if(bagAfter.c <= bagBefore.c) errors.push('selling from the Bag paid nothing');
    mark(`sold from the Bag: ${bagBefore.c}₽ -> ${bagAfter.c}₽, ${bagAfter.n} left`);
  }

  // picking up an item has to show you what you picked up
  await page.evaluate(() => { sel = null; G.bag = ['band','claw']; render(); });
  await page.waitForTimeout(150);
  await page.click('.wall.bag .bcell:not(.empty)');
  await page.waitForTimeout(250);
  const carried = await page.evaluate(() => {
    const c = document.querySelector('.carry');
    return c && !c.hidden ? c.textContent.replace(/\s+/g,' ').trim() : null;
  });
  if(!carried) errors.push('picking up a Bag item shows nothing on the cursor');
  else if(!/Muscle Band/.test(carried)) errors.push('the cursor does not name the item: ' + carried);
  else if(!/pokémon/.test(carried)) errors.push('the cursor does not say what to do with it: ' + carried);
  const cBox = await box('.carry'), cBar = await box('.ctxbar');
  if(cBox && cBar && cBox.bottom > cBar.top + 1)
    errors.push('the item cursor covers the action bar');
  mark('carrying an item: ' + carried);

  // --- a full Bag must not trap an item on a pokémon ---
  await page.evaluate(() => {
    G.bag = ['band','claw','lefto','coin'];
    G.team[0].held = 'sitrus';
    sel = { kind:'team', idx:0 }; save(); render();
  });
  await page.waitForTimeout(250);
  const take = await page.$('.ctxbar [data-act="unequip"]');
  const takeDisabled = take ? await take.evaluate(e => e.hasAttribute('disabled')) : null;
  if(!takeDisabled) errors.push('Take should be disabled with a full Bag');
  const sellAnyway = await page.$('.ctxbar [data-act="sellheld"]');
  if(!sellAnyway) errors.push('with a full Bag there is no way to get rid of a held item');
  else {
    const dis = await sellAnyway.evaluate(e => e.hasAttribute('disabled'));
    if(dis) errors.push('Sell is disabled with a full Bag — the item is stuck');
  }
  mark('a full Bag still lets you sell the item off the pokémon');

  // --- nothing selected: the Battle button is clear again ---
  await page.evaluate(() => { sel = null; render(); });
  await page.waitForTimeout(250);
  const stray = await page.$('.ctxbar');
  if(stray) errors.push('the action bar stayed after deselecting');
  const cta = await box('[data-act="endturn"]');
  if(cta){
    const hit = await page.$eval('[data-act="endturn"]', e => {
      e.scrollIntoView({block:'center'});
      const r = e.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2);
      return !!top && (top === e || e.contains(top));
    });
    if(!hit) errors.push('the Battle button is covered');
  }
  mark('Battle is clear with nothing selected');
  await page.screenshot({ path:'shot-mobile-bar.png' });

  await browser.close();
  if(errors.length){
    console.log('\n' + errors.length + ' FAILURES:');
    [...new Set(errors)].slice(0,20).forEach(e => console.log('  - ' + e));
    process.exit(1);
  }
  console.log('\nmobile bottom bar passed');
})();
