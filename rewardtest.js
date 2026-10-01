/* Badge rewards in the browser: old saves are owed their rewards, the picker
   fits a phone, free rerolls show and cost nothing, the badge screen adds up. */
const { chromium } = require('playwright');
const URL = 'file:///mnt/user-data/outputs/gen2/pokebattler.html';
const errors = [];
const mark = m => console.log('… ' + m);
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport:{width:390,height:844}, hasTouch:true, isMobile:true });
  ctx.setDefaultTimeout(6000);
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto(URL); await page.waitForTimeout(250);

  // 1. an old save with two badges and no reward fields
  await page.evaluate(() => {
    G.badges = 2; G.stage = 2 * (TUNING.battlesPerBadge + 1); G.turn = 9;
    delete G.perks; delete G.rewardLog; delete G.pendingRewards; delete G.freeRolls;
    localStorage.setItem('pokebattler.save.v3', JSON.stringify({ G, phase:'shop' }));
  });
  await page.reload(); await page.waitForTimeout(300);
  let t = await page.$eval('.modal.reward', m => m.textContent.replace(/\s+/g, ' ')).catch(() => null);
  if(!t) errors.push('an old save with badges was not offered its rewards');
  else {
    if(!/Boulder Badge/.test(t) || !/1 more/.test(t)) errors.push('the first owed reward should be Boulder, with 1 more to come: ' + t.slice(0, 90));
    const over = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    if(over) errors.push('the reward picker scrolls sideways on a phone');
    await page.screenshot({ path:'shot-reward-phone.png' });
    await page.click('.modal.reward .rcard >> nth=0'); await page.waitForTimeout(200);
    t = await page.$eval('.modal.reward h3', h => h.textContent).catch(() => null);
    if(!/Cascade/.test(t || '')) errors.push('the second owed reward should be Cascade: ' + t);
    await page.click('.modal.reward .rcard >> nth=0'); await page.waitForTimeout(200);
    const left = await page.evaluate(() => ({ modal: !!document.querySelector('.modal.reward'), log: G.rewardLog.length }));
    if(left.modal || left.log !== 2) errors.push(`after both picks: modal ${left.modal}, ${left.log} logged`);
    mark('an old two-badge save chose two owed rewards, one after the other');
  }

  // 2. free rerolls
  await page.evaluate(() => { G.perks.freeRoll = 1; G.freeRolls = 1; G.credits = 5; save(); render(); });
  await page.waitForTimeout(100);
  const btn = await page.$eval('[data-act="rollmart"]', b => b.textContent.replace(/\s+/g, ' ').trim());
  if(!/free/i.test(btn)) errors.push('the reroll button does not say it is free: ' + btn);
  await page.click('[data-act="rollmart"]'); await page.waitForTimeout(100);
  const after = await page.evaluate(() => ({ c: G.credits, f: G.freeRolls,
    b: document.querySelector('[data-act="rollmart"]').textContent.replace(/\s+/g, ' ').trim() }));
  if(after.c !== 5 || after.f !== 0) errors.push(`a free reroll cost ${5 - after.c}₽ and left ${after.f}`);
  if(!/1₽/.test(after.b)) errors.push('after the free one the button should cost 1₽ again: ' + after.b);
  mark(`free reroll: "${btn}" then "${after.b}"`);

  // 3. the badge screen
  await page.click('.stat.badges'); await page.waitForTimeout(150);
  const info = await page.$eval('.modal .box', b => b.textContent.replace(/\s+/g, ' '));
  if(!/Boulder Badge/.test(info) || !/free reroll/.test(info)) errors.push('the badge screen is missing badges or totals: ' + info.slice(0, 160));
  await page.screenshot({ path:'shot-badges-phone.png' });
  mark('badge screen: ' + info.slice(0, 100));

  await browser.close();
  if(errors.length){ console.log('\nISSUES:'); errors.forEach(e => console.log('  - ' + e)); process.exit(1); }
  console.log('\nbadge rewards passed');
})();
