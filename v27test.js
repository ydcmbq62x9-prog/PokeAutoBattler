/* v27 quick fixes, in the browser: Mart items onto the PC, held items straight onto a pokémon. */
const { chromium } = require('playwright');
const errors = []; const mark = m => console.log('… ' + m);
(async () => {
  const browser = await chromium.launch();
  for(const [label, vp, touch] of [['desktop', {width:1200,height:1000}, false], ['phone', {width:390,height:844}, true]]){
    const ctx = await browser.newContext({ viewport: vp, hasTouch: touch, isMobile: touch });
    ctx.setDefaultTimeout(5000);
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(label + ' pageerror: ' + e.message));
    await page.goto(require('./pkbpaths').PAGE); await page.waitForTimeout(250);
    await page.evaluate(() => {
      G.credits = 99; G.badges = 3; G.team = [makeUnit('squirtle',0)]; G.pc = [makeUnit('pidgey',0)]; G.bag = [];
      G.mart = [{ id:'protein', held:false, reserved:false, bought:false },
                { id:'band', held:true, reserved:false, bought:false }];
      save(); render();
    });
    // Protein onto the PC pokémon
    await page.click('[data-act="mart"][data-i="0"]'); await page.waitForTimeout(100);
    const lit = await page.$$eval('.wall .cell.valid', e => e.length);
    if(lit !== 1) errors.push(`${label}: with Protein picked, the PC pokémon should light up (${lit} lit)`);
    await page.click('[data-act="pc"][data-i="0"]'); await page.waitForTimeout(100);
    const pc = await page.evaluate(() => ({ atk: G.pc[0].atk, vit: vitaminsTaken(G.pc[0], 'protein') }));
    if(pc.vit !== 1) errors.push(`${label}: Protein did not land on the PC pokémon`);
    // Muscle Band straight onto the party member
    await page.click('[data-act="mart"][data-i="1"]'); await page.waitForTimeout(100);
    const hint = await page.$eval('.ctxbar', e => e.textContent.replace(/\s+/g,' '));
    if(!/give it straight away/.test(hint)) errors.push(`${label}: no hint that a held item can go straight onto a pokémon`);
    await page.click('[data-act="team"][data-i="0"]'); await page.waitForTimeout(100);
    const held = await page.evaluate(() => ({ h: G.team[0].held, bag: G.bag.length, badge: !!document.querySelector('[data-act="team"][data-i="0"] .held') }));
    if(held.h !== 'band' || held.bag !== 0) errors.push(`${label}: Muscle Band should be on Squirtle with the Bag empty (${JSON.stringify(held)})`);
    if(!held.badge) errors.push(`${label}: the held-item badge did not appear on the card`);
    const over = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    if(over) errors.push(`${label}: sideways scroll`);
    mark(`${label}: Protein onto the PC, Muscle Band straight onto the party`);
    await ctx.close();
  }
  await browser.close();
  if(errors.length){ console.log('\nISSUES:'); errors.forEach(e => console.log('  - ' + e)); process.exit(1); }
  console.log('\nv27 quick fixes passed');
})();
