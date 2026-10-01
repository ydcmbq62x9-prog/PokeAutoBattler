/* Regression: after a reload, every summary must show the pokémon that is
   actually in the space you tap. (The Wartortle→Bulbasaur bug.) Since v43 the
   summary lives in the message box (#inspect), not a pop-up. */
const { chromium } = require('playwright');

const URL = 'file:///mnt/user-data/outputs/pokebattler.html';
const errors = [];

(async () => {
  const browser = await chromium.launch();
  // a desktop viewport so hover (fine pointer) drives the popup
  const ctx = await browser.newContext({ viewport:{width:1200,height:1000}, deviceScaleFactor:2 });
  ctx.setDefaultTimeout(5000);
  const page = await ctx.newPage();
  page.on('console', m => { if(m.type()==='error') errors.push('console: '+m.text()); });
  page.on('pageerror', e => errors.push('pageerror: '+e.message));

  await page.goto(URL);
  await page.waitForTimeout(250);

  // --- fill a party and a few PC slots over several turns ---
  for(let turn=1; turn<=5; turn++){
    for(let i=0; i<6; i++){
      const card = await page.$(`[data-act="dc"][data-i="${i}"]:not(.locked):not(.out)`);
      if(!card) continue;
      await page.click(`[data-act="dc"][data-i="${i}"]`).catch(()=>{});
      await page.waitForTimeout(40);
      let tgt = await page.$('[data-act="team"].valid, [data-act="team"].mergeable');
      if(!tgt) tgt = await page.$('[data-act="pc"].valid');
      if(tgt){
        const act = await tgt.getAttribute('data-act'), idx = await tgt.getAttribute('data-i');
        await page.click(`[data-act="${act}"][data-i="${idx}"]`).catch(()=>{});
      } else await page.click('[data-act="cancel"]').catch(()=>{});
      await page.waitForTimeout(40);
    }
    await page.click('[data-act="fight"]').catch(()=>{});
    await page.waitForTimeout(150);
    for(let g=0; g<40; g++){
      const skip = await page.$('[data-act="skip"]');
      if(skip){ await skip.click().catch(()=>{}); await page.waitForTimeout(120); }
      const next = await page.$('[data-act="next"]');
      if(next){ await next.click().catch(()=>{}); break; }
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(150);
    if(await page.$('[data-act="restart"]')) break;
  }

  const filled = await page.$$eval('[data-pop]', els => els.length);
  if(filled < 4) errors.push(`setup only produced ${filled} inspectable spaces`);

  // --- the reload: this is what used to restart the uid counter ---
  await page.reload();
  await page.waitForTimeout(300);
  // roll the Daycare a few times so fresh pokémon are minted post-reload
  for(let r=0; r<4; r++){
    const roll = await page.$('[data-act="rollDc"], [data-act="roll"]');
    if(!roll) break;
    await roll.click().catch(()=>{});
    await page.waitForTimeout(80);
  }

  // Seed the PC directly, including the pokémon that first showed the bug.
  await page.evaluate(() => {
    for(const id of ['wartortle', 'bulbasaur', 'pikachu', 'onix'])
      if(G.pc.length < TUNING.pcSlots) G.pc.push(makeUnit(id, 0));
    save(); render();
  });
  await page.waitForTimeout(100);

  /* Every space that can show a popup: hover it, read the popup's name, and
     compare it with the name the game itself holds for that exact location. */
  const refs = await page.$$eval('[data-pop]', els => els.map(e => e.dataset.pop));
  if(refs.length < 4) errors.push(`only ${refs.length} spaces to check after reload`);

  let checked = 0;
  for(const ref of refs){
    const expected = await page.evaluate(r => {
      const [where, n] = r.split(':'), i = +n;
      const u = where === 'team' ? teamAt(G, i)     // v34: refs are cells, not list indexes
              : where === 'pc'   ? pcAt(G, i)
              : (G.daycare[i] && !G.daycare[i].bought ? G.daycare[i].unit : null);
      return u ? u.nm : null;
    }, ref);
    if(!expected){ errors.push(`${ref}: nothing there but it offers a popup`); continue; }

    await page.click(`[data-pop="${ref}"]`).catch(()=>{});
    await page.waitForTimeout(90);
    const shown = await page.$eval('#inspect', el => (el.querySelector('.popname') || {}).textContent || null).catch(() => null);

    if(shown === null) errors.push(`${ref}: tapping showed no summary`);
    else if(!shown.trim().startsWith(expected)) errors.push(`${ref}: summary says "${shown.trim()}" but the space holds "${expected}"`);
    else checked++;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(40);
  }
  console.log(`checked ${checked} summaries after a reload`);
  if(await page.$('.popup:not([hidden])')) errors.push('a pop-up card still appears');

  // --- the pokéball markers on empty spaces ---
  const balls = await page.$$eval('.slot.empty, .cell.empty', els => els.map(e => {
    const s = getComputedStyle(e, '::before');
    return { cls: e.className, w: s.width, bg: s.backgroundImage.slice(0, 60) };
  }));
  const withBall = balls.filter(b => b.bg.includes('radial-gradient'));
  if(balls.length && !withBall.length) errors.push('empty spaces are not drawing a pokéball');
  console.log(`${withBall.length}/${balls.length} empty spaces show a pokéball`);
  await page.screenshot({ path:'shot-pokeballs.png', fullPage:true });

  await browser.close();
  if(errors.length){
    console.log('\n' + errors.length + ' FAILURES:');
    [...new Set(errors)].slice(0,20).forEach(e => console.log('  - ' + e));
    process.exit(1);
  }
  console.log('\nsummary + pokéball test passed');
})();
