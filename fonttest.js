/* v45: two fonts — Nunito for reading, Pixelify for the Game Boy display bits. */
const { chromium } = require('playwright');
let fails = 0;
const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1250, height: 950 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('file:///mnt/user-data/outputs/pokebattler.html'); await page.waitForTimeout(200);
  await page.evaluate(() => { G.pendingRewards = []; document.querySelectorAll('.modal').forEach(x => x.remove());
    G.team = [makeUnit('rattata', 0)]; G.team[0].pos = 0; rollShop(G, false); save(); render(); });
  await page.click('.pfield .slot[data-i="0"] .sprite'); await page.waitForTimeout(200);
  const f = await page.evaluate(() => { const ff = sel => { const e = document.querySelector(sel); if(!e) return 'MISSING ' + sel; const c = getComputedStyle(e); return c.fontFamily.split(',')[0].replace(/['"]/g, '').trim() + ' ' + c.fontWeight; };
    return { body: ff('body'), move: ff('#inspect .popmove p'), moveName: ff('#inspect .popmove b'), dcName: ff('.drow b'), dcStat: ff('.drow .dstats, .drow'), martText: ff('.mtext span'),
      name: ff('#inspect .popname'), h2: ff('.panel h2'), btn: ff('.btn'), cta: ff('[data-act="endturn"]'), top: ff('.topbar .stat'), rank: ff('.rankhead span'), dock: ff('.speech .say b'), chip: ff('.rchip') }; });
  const read = ['body', 'move', 'moveName', 'dcName', 'martText', 'chip'], pix = ['name', 'h2', 'btn', 'cta', 'top', 'rank', 'dock'];
  for(const k of read) check(f[k].startsWith('Nunito'), `reading text uses Nunito: ${k} → ${f[k]}`);
  for(const k of pix) check(f[k].startsWith('Pixelify') && !/ (6|7|8|9)00$/.test(f[k]), `display text uses the pixel font at 500 or lighter: ${k} → ${f[k]}`);
  await page.click('[data-act="menu"]'); await page.waitForTimeout(200);
  check(await page.evaluate(() => getComputedStyle(document.querySelector('.smi')).fontFamily.startsWith('"Pixelify')), 'the START menu stays pixel');
  check(errs.length === 0, `no page errors ${errs.join(' | ')}`);
  await browser.close();
  console.log(fails ? `${fails} FAILED` : 'fonts passed');
  process.exit(fails ? 1 : 0);
})();
