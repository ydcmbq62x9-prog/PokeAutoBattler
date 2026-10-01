/* 2.4.0: the Hardcore Badge — earned by clearing a One Life run. */
const { chromium } = require('playwright');
let fails = 0; const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
const URL = 'file:///mnt/user-data/outputs/gen2/pokebattler.html';
(async () => {
  const browser = await chromium.launch();
  for(const [w, h] of [[1250, 950], [390, 844], [360, 640]]){
    const tag = w + 'px';
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if(m.type() === 'error') errs.push(m.text()); });
    await page.goto(URL); await page.waitForTimeout(200);
    await page.evaluate(() => localStorage.clear());
    await ctx.addInitScript(() => { window.PKB_TITLE = true; window.PKB_WIPE = true; });

    /* fresh device: no badge, but the Trainer Card is on the title menu and shows the empty slot */
    await page.reload(); await page.waitForTimeout(300);
    check(!(await page.$('.twho .hcb')), `${tag}: no badge on the title before you earn it`);
    await page.mouse.click(w / 2, h - 30); await page.waitForTimeout(250);
    const items = await page.evaluate(() => [...document.querySelectorAll('#title .tmi')].map(b => b.dataset.t).join());
    check(items === 'new,daily,trainer,options', `${tag}: title menu is NEW RUN / DAILY / TRAINER CARD / OPTIONS (${items})`);
    await page.click('#title [data-t="trainer"]'); await page.waitForTimeout(200);
    const c0 = await page.evaluate(() => { const m = document.querySelector('.modal.trainer'); return m && { txt: m.textContent.replace(/\s+/g, ' '), locked: !!m.querySelector('.hcrow:not(.on) .hcb.locked'),
      facts: [...m.querySelectorAll('.facts span')].map(x => x.textContent).join() }; });
    check(c0 && c0.locked && /Not earned yet\. Clear a run on One Life/.test(c0.txt), `${tag}: the card shows a locked Hardcore slot and how to earn it`);
    check(c0 && !/Money|Streak/.test(c0.facts), `${tag}: from the title with no run going, the card shows no run stats (${c0 && c0.facts})`);
    const fit = await page.evaluate(() => { const b = document.querySelector('.modal.trainer .box') || document.querySelector('.modal.trainer'); const r = b.getBoundingClientRect(); return r.right <= innerWidth + 1 && r.left >= -1; });
    check(fit, `${tag}: the card fits the screen width`);
    await page.click('.modal.trainer [data-m="close"]'); await page.waitForTimeout(100);
    check(!!(await page.$('#title')) && !(await page.$('.modal')), `${tag}: closing the card returns to the title`);

    /* winning on One Life awards it, once; a plain win does not */
    const r1 = await page.evaluate(() => {
      G.mods = {}; G.over = 'won'; noteRunEnd(); const plain = records().hardcore || null;
      G = newGame(7, { mods: { onelife: true } }); G.over = 'won'; noteRunEnd(); noteRunEnd();
      const h1 = records().hardcore; const isNew = G.hcNew;
      G = newGame(8, { mods: { onelife: true, nopc: true } }); G.over = 'won'; noteRunEnd();
      const h2 = records().hardcore, again = G.hcNew;
      G = newGame(9, { mods: { onelife: true } }); G.over = 'lost'; noteRunEnd();
      return { plain, h1, isNew, h2, again, lost: records().hardcore.count }; });
    check(r1.plain === null, `${tag}: a normal win does not award it`);
    check(r1.h1 && r1.h1.count === 1 && r1.isNew === true && !!r1.h1.first, `${tag}: a One Life win awards it once (calling twice doesn't double count), flagged as new`);
    check(r1.h2.count === 2 && r1.again === false && r1.h2.first === r1.h1.first, `${tag}: a second win (with another rule) makes it 2, not new, first date kept`);
    check(r1.lost === 2, `${tag}: a lost One Life run doesn't count`);

    /* everywhere it should show */
    await page.evaluate(() => { G = newGame(7, { mods: { onelife: true } }); G.over = 'won'; G.hcNew = false; phase = 'over'; render(); });
    await page.waitForTimeout(150);
    const win = await page.evaluate(() => { const a = document.querySelector('.hcaward'); return a && a.textContent.replace(/\s+/g, ' '); });
    check(win && /HARDCORE BADGE/.test(win) && /Another One Life clear/.test(win), `${tag}: victory screen shows the badge (${win})`);
    await page.evaluate(() => { G = newGame(7, { mods: {} }); G.over = 'won'; phase = 'over'; render(); });
    check(!(await page.$('.hcaward')), `${tag}: a plain win shows no badge panel`);

    await page.evaluate(() => { G = newGame(3); phase = 'shop'; render(); });
    await page.evaluate(() => openMenu()); await page.waitForTimeout(150);
    check(!!(await page.$('.startmenu .smi[data-m="trainer"] .hcb')), `${tag}: the START menu marks Trainer once you have the badge`);
    await page.evaluate(() => document.querySelector('.startmenu .smi[data-m="trainer"]').click()); await page.waitForTimeout(150);
    const c1 = await page.evaluate(() => { const m = document.querySelector('.modal.trainer'); return m && { on: !!m.querySelector('.hcrow.on .hcb:not(.locked)'), txt: m.textContent.replace(/\s+/g, ' ') }; });
    check(c1 && c1.on && /2 clears · first/.test(c1.txt), `${tag}: the card shows it earned, with count and first date`);
    await page.evaluate(() => document.querySelector('.modal.trainer [data-m="close"]').click());

    /* title */
    await page.reload(); await page.waitForTimeout(400);
    const tt = await page.evaluate(() => ({ badge: !!document.querySelector('.twho .thc .hcb'), sub: document.querySelector('#title [data-t="trainer"] small') ? '' : '' }));
    await page.mouse.click(w / 2, h - 30); await page.waitForTimeout(250);
    const tsub = await page.evaluate(() => { const t = document.querySelector('#title [data-t="trainer"] small'); return t && t.textContent; });
    check(tt.badge, `${tag}: the title shows the badge beside your name`);
    check(tsub && /Hardcore Badge · 2 clears/.test(tsub), `${tag}: the title's Trainer Card line mentions it (${tsub})`);
    const tvis = await page.evaluate(() => { const t = document.querySelector('#title .tscreen'); const e = document.querySelector('#title [data-t="options"]').getBoundingClientRect(); return e.bottom <= innerHeight + 1; });
    check(tvis, `${tag}: all five title-menu lines are on screen`);
    await page.evaluate(() => document.querySelector('#title [data-t="trainer"]').click()); await page.waitForTimeout(150);
    const c2 = await page.evaluate(() => { const m = document.querySelector('.modal.trainer'); return m && m.querySelector('.hcrow.on') !== null; });
    check(c2, `${tag}: Trainer Card opens from the title with the badge earned`);
    await page.evaluate(() => document.querySelector('.modal.trainer [data-m="close"]').click());

    /* daily */
    const d = await page.evaluate(() => { const day = localDate();
      G = newGame(dailySeed(day), { mods: { onelife: true }, daily: day }); G.over = 'won'; G.badges = 8; noteRunEnd();
      const t = dailyResults()[day]; return { hc: t.hardcore, cleared: t.cleared, share: dailyShareText(day) }; });
    check(d.hc === true && d.cleared && /Champion! 🏆 · Hardcore/.test(d.share), `${tag}: a One Life daily win is marked Hardcore and the share line says so (${d.share})`);
    const d2 = await page.evaluate(() => { const day = '2026-01-02'; G = newGame(dailySeed(day), { mods: {}, daily: day }); G.over = 'won'; noteRunEnd(); return dailyShareText(day); });
    check(!/Hardcore/.test(d2), `${tag}: a plain daily win doesn't say Hardcore`);

    /* transfer merges the best of both devices */
    const m = await page.evaluate(() => JSON.stringify(mergeHardcore({ count: 2, first: '2026-09-28', last: '2026-09-28' }, { count: 5, first: '2026-08-01', last: '2026-09-01' })));
    check(m === JSON.stringify({ count: 5, first: '2026-08-01', last: '2026-09-28' }), `${tag}: merging saves keeps the higher count and the earliest first date`);

    /* replaceable art */
    const svg = await page.evaluate(() => hcBadge().startsWith('<svg'));
    check(svg, `${tag}: placeholder art is a drawn SVG (SPRITES.hardcore replaces it)`);
    check(errs.length === 0, `${tag}: no page errors ${errs.join(' | ')}`);
    await ctx.close();
  }
  await browser.close();
  console.log(fails ? `${fails} FAILED` : 'v240 passed'); process.exit(fails ? 1 : 0);
})();
