/* v43: iron out 2 — one summary (the message box), pinned on phones, party discs and pips,
   role chips, steady turn-order row, list widths, bold pixel text. */
const { chromium } = require('playwright');
const fs = require('fs');
let fails = 0;
const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
const URL = 'file:///mnt/user-data/outputs/gen2/pokebattler.html';
const setup = () => { G.pendingRewards = []; document.querySelectorAll('.modal').forEach(x => x.remove());
  G.team = ['charmeleon', 'squirtle', 'pikachu'].map((id, k) => { const u = makeUnit(id, 0); u.pos = [0, 1, 3][k]; return u; });
  G.team[0].held = 'lefto'; G.turn = 6; G.stage = 4; setSpeed(4); rollShop(G, false); save(); render(); };
(async () => {
  const html = fs.readFileSync('/mnt/user-data/outputs/gen2/pokebattler.html', 'utf8');
  check(/Barlow\+Condensed:wght@/.test(html) && /family=Nunito:/.test(html) && !/Pixelify\+Sans/.test(html), '5.4.0: the sports font replaces the pixel font, and Nunito is the reading font');
  const browser = await chromium.launch();

  /* ---- desktop ---- */
  {
    const page = await browser.newPage({ viewport: { width: 1250, height: 950 } });
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto(URL); await page.waitForTimeout(200); await page.evaluate(setup); await page.waitForTimeout(700);
    check(await page.evaluate(() => getComputedStyle(document.documentElement).fontSynthesisWeight === 'none'), 'desktop: the browser may not fake a bolder pixel font');
    await page.hover('.pfield .slot[data-i="0"] .sprite'); await page.waitForTimeout(250);
    check(!(await page.$('.popup:not([hidden])')), 'desktop: hovering a pokémon shows no pop-up card');
    await page.click('.pfield .slot[data-i="0"] .sprite'); await page.waitForTimeout(250);
    const s = await page.evaluate(() => { const b = document.querySelector('#inspect'); return { name: (b.querySelector('.popname') || {}).textContent, bars: b.querySelectorAll('.sbar').length,
      item: !!b.querySelector('.popheld'), moves: b.querySelectorAll('.popmove').length, evo: !!b.querySelector('.line'), cols: getComputedStyle(b.querySelector('.isum')).gridTemplateColumns.split(' ').length }; });
    check(s.name === 'Charmeleon' && s.bars === 3 && s.item && s.moves === 2 && s.evo, 'desktop: a tap puts the whole summary in the message box (stats, item, both moves, evolution)');
    check(s.cols === 2, 'desktop: the summary is laid out in two columns');
    await page.keyboard.press('Escape');
    await page.click('.martrow[data-act="mart"]'); await page.waitForTimeout(200);
    check(await page.evaluate(() => /₽/.test(document.querySelector('#inspect').textContent) && !document.querySelector('#inspect .isum')), 'desktop: items describe themselves in the same box');
    await page.keyboard.press('Escape');
    const chips = await page.$$eval('.drow .rchip', els => els.map(e => ({ nw: getComputedStyle(e).whiteSpace, h: e.getBoundingClientRect().height })));
    check(chips.length && chips.every(c => c.nw === 'nowrap' && c.h < 22), `desktop: Daycare role chips stay on one line (${Math.round(Math.max(...chips.map(c => c.h)))}px tall)`);
    check(await page.evaluate(() => getComputedStyle(document.querySelector('.dclist')).scrollbarGutter === 'stable'), 'desktop: the Daycare list keeps its width when the scroll bar goes');
    const pf = await page.evaluate(() => ({ ball: [...document.querySelectorAll('.pfield .slot.empty')].map(e => getComputedStyle(e, '::before').content),
      pip: (() => { const i = document.querySelector('.pfield .exp i'); const r = i.getBoundingClientRect(); return [r.width, r.height]; })() }));
    check(pf.ball.length && pf.ball.every(c => c === 'none'), 'desktop: empty party spots are only the disc, no pokéball');
    check(pf.pip[0] >= 6 && pf.pip[1] >= 6, `desktop: level pips under the party are visible (${pf.pip.join('×')}px)`);

    /* the turn order row is there at every step */
    await page.click('[data-act="endturn"]'); await page.waitForTimeout(80);
    const rows = await page.evaluate(() => new Promise(r => { const seen = []; const iv = setInterval(() => {
      const q = document.querySelector('#bqueue .queue'); seen.push(q ? Math.round(q.getBoundingClientRect().height) : 0);
      if(battle.i >= battle.steps.length - 1){ clearInterval(iv); r(seen); } }, 30); }));
    check(rows.length > 5 && rows.every(hh => hh === rows[0] && hh > 20), `desktop: the turn order row never leaves or changes height during the battle (${rows.length} samples at ${rows[0]}px)`);
    check(errs.length === 0, `desktop: no page errors ${errs.join(' | ')}`);
    await page.close();
  }

  /* ---- phone ---- */
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto(URL); await page.waitForTimeout(200); await page.evaluate(setup); await page.waitForTimeout(700);
    await page.tap('.pfield .slot[data-i="0"]'); await page.waitForTimeout(250);
    const a = await page.evaluate(() => ({ pinned: document.querySelector('#inspect').classList.contains('pinned'), name: (document.querySelector('#inspect .popname') || {}).textContent }));
    check(!a.pinned && a.name === 'Charmeleon', 'phone: tapping your party shows the summary in the box right under the field');
    await page.tap('[data-act="cancel"]'); await page.waitForTimeout(150);
    await page.evaluate(() => document.querySelector('.drow[data-act="dc"]').scrollIntoView({ block: 'center' })); await page.waitForTimeout(100);
    await page.tap('.drow[data-act="dc"]'); await page.waitForTimeout(300);
    const b = await page.evaluate(() => { const box = document.querySelector('#inspect'), carry = document.querySelector('.carry');
      return { pos: getComputedStyle(box).position, name: (box.querySelector('.popname') || {}).textContent, dc: G.daycare[0].unit.nm,
        x: !!(carry && carry.querySelector('button')), carry: !!(carry && !carry.hidden) }; });
    check(b.pos !== 'fixed' && b.name === b.dc, `phone (v44): a Daycare pokémon's summary stays in the message box — nothing floats over the screen (${b.name})`);
    check(b.carry && !b.x, 'phone (v44): the "tap a slot" tag has no ✕');
    await page.tap('[data-act="cancel"]'); await page.waitForTimeout(150);
    check(await page.evaluate(() => !sel && document.querySelector('.carry').hidden), 'phone: Cancel puts it back');
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'phone: no sideways scrolling');
    check(errs.length === 0, `phone: no page errors ${errs.join(' | ')}`);
    await ctx.close();
  }
  await browser.close();
  console.log(fails ? `${fails} FAILED` : 'iron out 2 passed');
  process.exit(fails ? 1 : 0);
})();
