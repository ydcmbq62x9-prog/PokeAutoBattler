/* v38: the title screen. */
const { chromium } = require('playwright');
let fails = 0;
const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
const URL = require('./pkbpaths').PAGE;
(async () => {
  const browser = await chromium.launch();
  for(const [w, h] of [[1250, 950], [390, 844]]){
    const tag = w + 'px';
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if(m.type() === 'error') errs.push(m.text()); });

    /* test runs skip it unless asked */
    await page.goto(URL); await page.waitForTimeout(200);
    check(!(await page.$('#title')) && !!(await page.$('.dock')), `${tag}: browser tests load straight into the shop`);
    await page.evaluate(() => { localStorage.clear(); });
    await ctx.addInitScript(() => { window.PKB_TITLE = true; });

    /* fresh start: nothing to continue, START goes straight in */
    await page.reload(); await page.waitForTimeout(300);
    const t0 = await page.evaluate(() => { const t = document.querySelector('#title');
      return t && { txt: t.textContent.replace(/\s+/g, ' '), img: !!t.querySelector('.tmon img[src^="data:"]'), alt: t.querySelector('.tmon img').alt,
        menu: t.querySelector('.tmenu').hidden, v: GAME_VERSION.v, sub: t.querySelector('.tsub').textContent, top: document.elementFromPoint(innerWidth / 2, innerHeight / 2).closest('#title') !== null }; });
    check(t0 && /Poké/.test(t0.txt) && /Arena/.test(t0.txt) && /Tap to play/.test(t0.txt), `${tag}: title shows the logo and TAP TO PLAY`);
    check(t0 && t0.img && ['Bulbasaur', 'Charmander', 'Squirtle', 'Pikachu'].includes(t0.alt), `${tag}: with no partner yet it shows a starter (${t0 && t0.alt})`);
    check(t0 && t0.menu && t0.top, `${tag}: covers the game, no menu until START`);
    check(t0 && t0.txt.includes(t0.v) && !/Best:/.test(t0.txt), `${tag}: version at the bottom, no best run on a fresh device`);
    check(t0 && t0.sub === 'A Pokémon Auto Battler', `${tag}: subtitle reads "${t0 && t0.sub}"`);
    /* 2.0.0: with the Daily Challenge on the menu, START always opens the menu */
    await page.mouse.click(w / 2, h - 40); await page.waitForTimeout(200);
    const fm = await page.evaluate(() => [...document.querySelectorAll('#title .tmi')].map(b => b.dataset.t).join());
    check(fm === 'new,daily,dex,trainer,options', `${tag}: a tap anywhere opens NEW RUN / DAILY CHALLENGE / TRAINER CARD / OPTIONS (${fm})`);
    await page.click('[data-t="new"]'); await page.waitForTimeout(80);
    await page.click('.modal.newrun [data-n="go"]'); await page.waitForTimeout(700);
    check(!(await page.$('#title')) && !!(await page.$('.dock')), `${tag}: NEW RUN → Start run starts a fresh run`);

    /* a run in progress: CONTINUE / NEW RUN / OPTIONS */
    await page.evaluate(() => { PREF.set('name', 'Sean'); localStorage.setItem('pkb_records', JSON.stringify({ runs: 2, cleared: 1, best: 14 }));
      G.pendingRewards = []; G.turn = 9; G.stage = 6; G.badges = 2; G.lives = 4;
      const u = makeUnit('charizard', 4); u.pos = 0; G.team = [u]; G.rec = { fought: { [u.uid]: 5 }, hit: null }; save(); });
    await page.reload(); await page.waitForTimeout(300);
    const t1 = await page.evaluate(() => ({ alt: document.querySelector('.tmon img').alt, txt: document.querySelector('#title').textContent.replace(/\s+/g, ' ') }));
    check(t1.alt === 'Charizard', `${tag}: shows the partner — the pokémon that fought most (${t1.alt})`);
    check(/Welcome back, Sean!/.test(t1.txt) && /Best: .*Erika.*1 cleared/.test(t1.txt), `${tag}: greets you by name and shows your best run`);
    await page.keyboard.press('Enter'); await page.waitForTimeout(80);
    const m = await page.evaluate(() => ({ items: [...document.querySelectorAll('.tmi')].map(b => b.textContent.replace(/\s+/g, ' ').trim()),
      cur: document.querySelector('.tmi.cur').dataset.t, press: document.querySelector('.tpress').hidden }));
    check(m.press && m.items.length === 6 && /^Continue ?Turn 9 · 2 badges · 4 lives$/.test(m.items[0]) && /^New run/.test(m.items[1]) && /^Daily challenge/.test(m.items[2]) && /^Pok.dex/.test(m.items[3]) && /^Trainer card/.test(m.items[4]) && m.items[5] === 'Options',
      `${tag}: START opens CONTINUE (Turn 9 · 2 badges · 4 lives) / NEW RUN / DAILY CHALLENGE / TRAINER CARD / OPTIONS`);
    check(m.cur === 'continue', `${tag}: cursor starts on CONTINUE`);
    for(let k = 0; k < 6; k++) await page.keyboard.press('ArrowDown');
    check(await page.evaluate(() => document.querySelector('.tmi.cur').dataset.t) === 'continue', `${tag}: arrows wrap round the menu`);
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await page.waitForTimeout(60);
    const yn = await page.evaluate(() => { const md = document.querySelector('.modal.newrun'); return { shown: !!md, warn: md && (md.querySelector('.warn') || {}).textContent, turn: G.turn }; });
    check(yn.shown && /ends your current run \(turn 9/.test(yn.warn || '') && yn.turn === 9, `${tag}: NEW RUN warns first (“${yn.warn}”)`);
    await page.click('.modal.newrun [data-n="close"]'); await page.waitForTimeout(40);
    check(await page.evaluate(() => !document.querySelector('.modal') && G.turn === 9 && !!document.querySelector('.tmi[data-t="continue"]')),
      `${tag}: Cancel keeps the run and the menu`);

    /* OPTIONS opens over the title; Skip turns it off */
    await page.click('[data-t="options"]'); await page.waitForTimeout(40);
    const op = await page.evaluate(() => { const md = document.querySelector('.modal.options'); if(!md) return null; const r = md.querySelector('.box').getBoundingClientRect();
      return { onTop: document.elementFromPoint(r.left + r.width / 2, r.top + 20).closest('.modal') !== null, row: /Title screen/.test(md.textContent) }; });
    check(op && op.onTop && op.row, `${tag}: OPTIONS opens on top of the title, with a Title screen row`);
    await page.keyboard.press('Enter');   // must not act on the title while Options is open
    check(await page.evaluate(() => !!document.querySelector('#title') && G.turn === 9), `${tag}: keys go to Options, not the title behind it`);
    await page.click('[data-o="title"][data-v="off"]'); await page.click('.modal.options [data-m="close"]'); await page.waitForTimeout(40);
    await page.click('[data-t="continue"]'); await page.waitForTimeout(600);
    check(!(await page.$('#title')) && await page.evaluate(() => G.turn === 9), `${tag}: CONTINUE picks the run up where it was`);
    await page.reload(); await page.waitForTimeout(300);
    check(!(await page.$('#title')), `${tag}: Title screen: Skip goes straight to the game next time`);
    await page.evaluate(() => PREF.set('title', 'on'));

    /* NEW RUN → YES starts over and counts the old run */
    await page.reload(); await page.waitForTimeout(300);
    await page.keyboard.press('Enter'); await page.click('[data-t="new"]'); await page.click('.modal.newrun [data-n="go"]'); await page.waitForTimeout(700);
    const nr = await page.evaluate(() => ({ t: !!document.querySelector('#title'), turn: G.turn, runs: JSON.parse(localStorage.getItem('pkb_records')).runs }));
    check(!nr.t && nr.turn === 1 && nr.runs === 3, `${tag}: YES starts a new run at turn 1 and counts the old one (${nr.runs} runs)`);

    /* partner remembered after a run, reward picker waits for the title */
    await page.evaluate(() => { const u = makeUnit('gyarados', 3); u.pos = 0; G.team = [u];
      noteBattle({ steps: [{ p: [u], e: [] }] }); G.turn = 5; G.stage = 3; G.pendingRewards = [0]; save(); });
    check(await page.evaluate(() => PREF.get('partner', '')) === 'gyarados', `${tag}: a battle remembers the partner for the title`);
    await page.reload(); await page.waitForTimeout(300);
    const rp = await page.evaluate(() => ({ modal: !!document.querySelector('.modal'), alt: document.querySelector('.tmon img').alt }));
    check(!rp.modal && rp.alt === 'Gyarados', `${tag}: an owed badge reward waits behind the title`);
    await page.keyboard.press('Enter'); await page.keyboard.press('Enter'); await page.waitForTimeout(600);
    check(await page.evaluate(() => !document.querySelector('#title') && !!document.querySelector('.modal')), `${tag}: …and opens once you CONTINUE`);
    await page.evaluate(() => { document.querySelectorAll('.modal').forEach(x => x.remove()); G.pendingRewards = []; save(); });

    /* reduced motion and dark */
    await page.evaluate(() => { PREF.set('motion', 'reduced'); PREF.set('theme', 'dark'); });
    await page.reload(); await page.waitForTimeout(150);
    const rd = await page.evaluate(() => ({ still: document.querySelector('#title').classList.contains('still'), dark: document.documentElement.classList.contains('dark'),
      bg: getComputedStyle(document.querySelector('#title')).backgroundColor, ov: document.documentElement.scrollWidth > innerWidth + 1 }));
    check(rd.still && rd.dark && !/255, 255, 255|233, 227, 204/.test(rd.bg), `${tag}: reduced motion holds it still; dark theme darkens it (${rd.bg})`);
    check(!rd.ov, `${tag}: no sideways scrolling`);
    await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
    check(await page.evaluate(() => !document.querySelector('#title')), `${tag}: with reduced motion it leaves instantly`);
    await page.evaluate(() => { PREF.set('motion', 'device'); PREF.set('theme', 'light'); });
    check(errs.length === 0, `${tag}: no console errors ${errs.slice(0, 2).join(' | ')}`);
    await ctx.close();
  }
  await browser.close();
  console.log(fails ? `${fails} FAILED` : 'title screen passed');
  process.exit(fails ? 1 : 0);
})();
