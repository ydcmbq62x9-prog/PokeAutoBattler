/* The held-item flow, end to end in the browser: buy into the Bag, give it to
   a pokémon, see it in the summary, take it back off. */
const { chromium } = require('playwright');
const URL = 'file:///mnt/user-data/outputs/pokebattler.html';
const errors = [];
const mark = m => console.log('… ' + m);

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport:{width:1200,height:1000}, deviceScaleFactor:2 });
  ctx.setDefaultTimeout(5000);
  const page = await ctx.newPage();
  page.on('console', m => { if(m.type()==='error') errors.push('console: '+m.text()); });
  page.on('pageerror', e => errors.push('pageerror: '+e.message));

  await page.goto(URL);
  await page.waitForTimeout(250);

  // Jump to a turn where held items are stocked, with money to spend.
  await page.evaluate(() => {
    G.turn = 12; G.credits = 60;
    G.team = [makeUnit('squirtle',0), makeUnit('onix',0), makeUnit('pikachu',0)];
    G.pc = [makeUnit('abra',0)];
    rollShop(G, false); save(); render();
  });
  await page.waitForTimeout(150);
  mark('set up a mid-run board');

  // --- the Bag tray exists, under the PC box, and starts empty ---
  const trays = await page.$$eval('.panel.pc .wall', els => els.map(e => e.className));
  if(trays.length !== 2 || !trays[1].includes('bag'))
    errors.push('the Bag tray is not the second wall inside the PC panel');
  const bagSlots = await page.$$eval('.wall.bag .bcell', els => els.length);
  if(bagSlots !== 4) errors.push(`the Bag shows ${bagSlots} slots, not 4`);

  // --- the Mart is split into two labelled sections ---
  const heads = await page.$$eval('.mhead', els => els.map(e => e.textContent.trim()));
  if(!heads.some(h => /^Held/i.test(h))) errors.push('no Held section in the Mart');
  if(!heads.some(h => /Medicine/i.test(h))) errors.push('no Medicine section in the Mart');

  // --- buy a held item: it goes to the Bag, not onto a pokémon ---
  const heldIdx = await page.evaluate(() => G.mart.findIndex(m => m.held && !m.bought));
  if(heldIdx < 0) errors.push('the Mart stocked no held item at turn 12');
  else {
    await page.click(`[data-act="mart"][data-i="${heldIdx}"]`);
    await page.waitForTimeout(80);
    const buy = await page.$('[data-act="buyheld"]');
    if(!buy) errors.push('no Buy button for a held item');
    else {
      await buy.click();
      await page.waitForTimeout(120);
      const bag = await page.evaluate(() => G.bag.slice());
      if(bag.length !== 1) errors.push(`buying a held item put ${bag.length} things in the Bag`);
      const onMon = await page.evaluate(() => G.team.some(u => u.held));
      if(onMon) errors.push('buying a held item equipped it straight away');
    }
  }
  mark('bought a held item into the Bag');

  // --- give it to a pokémon ---
  await page.click('.wall.bag .bcell:not(.empty)');
  await page.waitForTimeout(80);
  const validSlots = await page.$$eval('.slot.valid', els => els.length);
  if(validSlots < 3) errors.push(`only ${validSlots} party slots offered to take the item`);
  await page.click('[data-act="team"][data-i="0"]');
  await page.waitForTimeout(150);
  const given = await page.evaluate(() => ({ held: G.team[0].held, bag: G.bag.length }));
  if(!given.held) errors.push('the pokémon did not end up holding it');
  if(given.bag !== 0) errors.push('the item did not leave the Bag');
  mark('gave it to a party member');

  // --- the badge orbits the sprite, and the stats moved ---
  const badge = await page.$('[data-act="team"][data-i="0"] .held');
  if(!badge) errors.push('no held badge on the card');
  // a stat item must move the numbers; a trigger or economy item must not
  /* An item that advertises HP/ATK/SPD must move those numbers; one that does
     its work in combat (Metal Coat, Expert Belt) or between rounds must not. */
  const stats = await page.evaluate(() => {
    const u = G.team[0], h = HELD_ITEMS[u.held];
    return { kind:h.kind, name:h.name, gated: !!(h.when && !h.when(u)),
             showsStats: !!(h.stat || h.pct),
             moved: effAtk(u) !== u.atk || effHp(u) !== u.hp || effSpd(u) !== u.spd };
  });
  if(stats.showsStats && !stats.gated && !stats.moved)
    errors.push(`${stats.name} declares a stat bonus but moved no numbers`);
  if(!stats.showsStats && stats.moved)
    errors.push(`${stats.name} declares no stat bonus but changed the stats`);
  // and pin the stat case outright, whatever the shop happened to roll
  const pinned = await page.evaluate(() => {
    const u = G.team[1], before = effAtk(u);
    u.held = 'band'; const after = effAtk(u); u.held = null;
    return { before, after };
  });
  if(pinned.after <= pinned.before) errors.push('Muscle Band did not raise Attack');

  // --- the summary popup explains the item ---
  await page.click('[data-pop="team:0"] .sprite');
  await page.waitForTimeout(150);
  const pop = await page.$eval('#inspect', el => !el.querySelector('.isum') ? null : ({
    name: (el.querySelector('.popname')||{}).textContent,
    item: (el.querySelector('.popheld b')||{}).textContent,
    text: (el.querySelector('.popheld p')||{}).textContent,
  })).catch(() => null);
  if(!pop) errors.push('no summary on tap');
  else {
    if(!pop.item) errors.push('the summary does not name the held item');
    if(!pop.text || pop.text.length < 10) errors.push('the summary does not explain the held item');
    const real = await page.evaluate(() => HELD_ITEMS[G.team[0].held].name);
    if(pop.item && !pop.item.includes(real))
      errors.push(`the summary says "${pop.item}" but it holds ${real}`);
  }
  await page.keyboard.press('Escape');
  mark('the summary describes the item');

  // --- a pokémon with no item gets no item block ---
  await page.click('[data-pop="team:1"] .sprite');
  await page.waitForTimeout(150);
  const bare = await page.$eval('#inspect', el => !!el.querySelector('.popheld')).catch(()=>false);
  if(bare) errors.push('a pokémon holding nothing still shows an item block');
  await page.keyboard.press('Escape');

  // --- take it back off ---
  await page.click('[data-act="team"][data-i="0"] .held');
  await page.waitForTimeout(150);
  const after = await page.evaluate(() => ({ held: G.team[0].held, bag: G.bag.length }));
  if(after.held) errors.push('tapping the badge did not take the item off');
  if(after.bag !== 1) errors.push('the item did not go back to the Bag');
  mark('took it back off');

  // --- a stored pokémon can hold one too ---
  await page.click('.wall.bag .bcell:not(.empty)');
  await page.waitForTimeout(80);
  await page.click('[data-act="pc"][data-i="0"]');
  await page.waitForTimeout(150);
  const pcHeld = await page.evaluate(() => G.pc[0].held);
  if(!pcHeld) errors.push('a PC pokémon could not be given an item');
  const miniBadge = await page.$('[data-act="pc"][data-i="0"] .held.mini');
  if(!miniBadge) errors.push('no badge on the PC cell');
  mark('the PC can hold items too');

  // --- it survives a reload ---
  await page.evaluate(() => save());
  await page.reload();
  await page.waitForTimeout(300);
  const survived = await page.evaluate(() => ({ pc: G.pc[0] && G.pc[0].held, bag: G.bag.length }));
  if(survived.pc !== pcHeld) errors.push('the held item did not survive a reload');
  mark('survived a reload');

  // --- and the board still fits on a phone ---
  await page.setViewportSize({ width:390, height:860 });
  await page.waitForTimeout(250);
  const over = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  if(over) errors.push('horizontal overflow at 390px');
  await page.screenshot({ path:'shot-held-phone.png', fullPage:true });
  await page.setViewportSize({ width:1200, height:1000 });
  await page.waitForTimeout(200);
  await page.screenshot({ path:'shot-held-wide.png', fullPage:true });

  await browser.close();
  if(errors.length){
    console.log('\n' + errors.length + ' FAILURES:');
    [...new Set(errors)].slice(0,20).forEach(e => console.log('  - ' + e));
    process.exit(1);
  }
  console.log('\nheld-item flow passed');
})();
