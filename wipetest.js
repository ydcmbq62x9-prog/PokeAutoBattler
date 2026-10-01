/* v40: the pokéball wipe (rolling iris) between the shop and battles. */
const { chromium } = require('playwright');
let fails = 0;
const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
const URL = 'file:///mnt/user-data/outputs/pokebattler.html';
const setup = () => { localStorage.clear(); };
(async () => {
  const browser = await chromium.launch();
  for(const [w, h] of [[1250, 950], [390, 844]]){
    const tag = w + 'px';
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if(m.type() === 'error') errs.push(m.text()); });
    const prep = async () => page.evaluate(() => { G.pendingRewards = []; const m = (id, pos) => { const u = makeUnit(id, 4); u.pos = pos; return u; };
      G.team = [m('charizard', 0), m('blastoise', 1), m('pidgeot', 4)]; G.stage = 1; G.turn = 2; setSpeed(1); PREF.set('motion', 'device');
      rollShop(G, false); save(); render(); document.querySelectorAll('.modal').forEach(x => x.remove()); });

    /* test runs skip it unless asked */
    await page.goto(URL); await page.waitForTimeout(200); await prep();
    await page.click('[data-act="endturn"]'); await page.waitForTimeout(60);
    check(await page.evaluate(() => phase === 'battle' && !document.querySelector('.wipe')), `${tag}: browser tests go straight into the battle`);
    await ctx.addInitScript(() => { window.PKB_WIPE = true; });
    await page.reload(); await page.waitForTimeout(200); await prep();

    /* into the battle */
    await page.click('[data-act="endturn"]'); await page.waitForTimeout(250);
    const a = await page.evaluate(() => { const wp = document.querySelector('.wipe'); const c = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
      return { wipe: !!wp, ball: !!(wp && wp.querySelector('.wball svg')), iris: !!(wp && wp.querySelector('.wiris')), phase, block: !!(c && c.closest('.wipe')),
        z: wp ? +getComputedStyle(wp).zIndex : 0 }; });
    check(a.wipe && a.ball && a.iris && a.z >= 90, `${tag}: BATTLE starts the wipe — pokéball and closing circle, on top of everything`);
    check(a.phase === 'shop' && a.block, `${tag}: the shop stays underneath until the screen is closed, and taps can't get through`);
    await page.click('[data-act="endturn"]', { force: true, timeout: 500 }).catch(() => {});
    const dark = await page.evaluate(() => new Promise(r => { let min = 1e9; const t0 = performance.now();
      const iv = setInterval(() => { const i = document.querySelector('.wiris'); if(i && phase === 'shop') min = Math.min(min, i.getBoundingClientRect().width);
        if(phase === 'battle' || performance.now() - t0 > 2500){ clearInterval(iv); r(min === 1e9 ? -1 : min); } }, 10); }));
    check(dark >= 0 && dark < 40, `${tag}: the circle closes down to the ball (${Math.round(dark)}px)`);
    await page.waitForTimeout(20);
    const mid = await page.evaluate(() => ({ phase, wipe: !!document.querySelector('.wipe'), stage: !!document.querySelector('.bstage') }));
    check(mid.phase === 'battle' && mid.stage && mid.wipe, `${tag}: at full dark it swaps to the battle, then opens`);
    await page.waitForTimeout(600);
    const b = await page.evaluate(() => ({ wipe: !!document.querySelector('.wipe'), ban: !!document.querySelector('.introban'), wipes: document.querySelectorAll('.wipe').length }));
    check(!b.wipe && b.ban, `${tag}: the wipe is gone and the "wants to battle!" banner is playing`);
    check(await page.evaluate(() => battle && battle.i >= 0 && !wiping), `${tag}: a second tap during the wipe didn't start another battle`);

    /* back to the shop */
    await page.click('[data-act="skip"]'); await page.waitForTimeout(150);
    const turn0 = await page.evaluate(() => G.turn);
    await page.click('[data-act="afterbattle"]'); await page.waitForTimeout(200);
    await page.click('[data-act="afterbattle"]', { force: true, timeout: 400 }).catch(() => {});
    check(await page.evaluate(() => !!document.querySelector('.wipe') && phase === 'battle'), `${tag}: Continue wipes back, battle still showing while it closes`);
    await page.waitForTimeout(1400);
    const c = await page.evaluate(() => ({ wipe: !!document.querySelector('.wipe'), phase, turn: G.turn }));
    check(!c.wipe && c.phase === 'shop' && c.turn === turn0 + 1, `${tag}: back in the shop, one turn later (${turn0} → ${c.turn}), even after a double tap`);

    /* speed and reduced motion */
    await page.evaluate(() => setSpeed(4));
    const t4 = await page.evaluate(() => new Promise(r => { const t0 = performance.now(); document.querySelector('[data-act="endturn"]').click();
      const iv = setInterval(() => { if(phase === 'battle' && !document.querySelector('.wipe')){ clearInterval(iv); r(performance.now() - t0); } }, 10); }));
    check(t4 < 520, `${tag}: at 4× the whole wipe takes ${Math.round(t4)}ms`);
    await page.evaluate(() => { finishPlayback(); setSpeed(1); PREF.set('motion', 'reduced'); });
    await page.click('[data-act="afterbattle"]'); await page.waitForTimeout(60);
    const rm = await page.evaluate(() => { const i = document.querySelector('.wiris'), bl = document.querySelector('.wball');
      return { flat: !!(i && i.classList.contains('flat')), ball: bl ? getComputedStyle(bl).display : 'none' }; });
    await page.waitForTimeout(400);
    check(rm.flat && rm.ball === 'none' && await page.evaluate(() => phase === 'shop' && !document.querySelector('.wipe')), `${tag}: reduced motion gets a quick fade, no rolling ball`);
    await page.evaluate(() => PREF.set('motion', 'device'));

    /* friend battle in and out */
    await page.evaluate(() => { document.querySelectorAll('.modal').forEach(x => x.remove()); });
    const code = await page.evaluate(() => exportTeam(G.team, 'Pal'));
    await page.click('[data-act="menu"]'); await page.click('[data-m="versus"]');
    await page.fill('.modal textarea', code); await page.click('.modal [data-m="go"]'); await page.waitForTimeout(200);
    check(await page.evaluate(() => !!document.querySelector('.wipe')), `${tag}: a friend's team code battle wipes in too`);
    await page.waitForTimeout(1100);
    await page.click('[data-act="skip"]'); await page.waitForTimeout(100);
    await page.click('[data-act="afterbattle"]'); await page.waitForTimeout(1400);
    check(await page.evaluate(() => phase === 'shop' && !battle && !document.querySelector('.wipe')), `${tag}: and back to the shop afterwards`);
    /* v41: leaving the title uses the wipe */
    await page.evaluate(() => { PREF.set('title', 'on'); window.PKB_TITLE = true; G.turn = 5; G.stage = 3; save(); });
    await ctx.addInitScript(() => { window.PKB_TITLE = true; });
    await page.reload(); await page.waitForSelector('#title'); await page.waitForTimeout(300);
    await page.keyboard.press('Enter'); await page.waitForTimeout(60); await page.keyboard.press('Enter'); await page.waitForTimeout(250);
    const tw = await page.evaluate(() => ({ wipe: !!document.querySelector('.wipe'), title: !!document.querySelector('#title'), modal: [...document.querySelectorAll('.modal')].map(m=>m.className+':'+m.textContent.slice(0,40)), menu: !!document.querySelector('#title .tmenu:not([hidden])') }));
    if(!(tw.wipe && tw.title)) console.log(JSON.stringify(tw));
    check(tw.wipe && tw.title, `${tag}: CONTINUE on the title starts the wipe with the title still underneath`);
    await page.waitForTimeout(1300);
    check(await page.evaluate(() => !document.querySelector('.wipe') && !document.querySelector('#title') && !!document.querySelector('.dock') && !document.body.classList.contains('titled')),
      `${tag}: …and opens on the shop`);
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${tag}: no sideways scrolling`);
    check(errs.length === 0, `${tag}: no console errors ${errs.slice(0, 2).join(' | ')}`);
    await ctx.close();
  }
  await browser.close();
  console.log(fails ? `${fails} FAILED` : 'pokéball wipe passed');
  process.exit(fails ? 1 : 0);
})();
