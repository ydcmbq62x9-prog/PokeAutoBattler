/* 5.5.2: dark page, stat icons, the computer summary card, no gym sweep, the Champion photo hides the fainted. */
const { chromium } = require('playwright');
let fails = 0; const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
(async () => {
  const br = await chromium.launch();
  const p = await br.newPage({ viewport:{ width:1440, height:900 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.PKB_TITLE = false; });
  await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await p.waitForTimeout(400);
  const r = await p.evaluate(() => { document.querySelectorAll('.modal').forEach(m => m.remove());
    G.team = ['charizard','pikachu','snorlax'].map((id,i)=>{const u=makeUnit(id,2); u.pos=i; return u;}); fixSlots(G); render();
    const o = { icons: document.querySelectorAll('.pfield .stri').length * 3, dc: document.querySelectorAll('.dnums .si').length, pg1: getComputedStyle(document.documentElement).getPropertyValue('--pg1').trim() };
    return o; });
  check(r.icons === 9 && r.dc > 0, `stat icons on the field and in the Daycare (${r.icons}, ${r.dc})`);
  check(r.pg1 === '#0a0d15', 'the page is the dark stadium');
  await p.click('.pfield .slot[data-i="0"]'); await p.waitForTimeout(300);
  const c = await p.evaluate(() => { const i = document.querySelector('#inspect'), b = i.getBoundingClientRect(), bag = document.querySelector('.bcR .wall.bag').getBoundingClientRect();
    return { pos: getComputedStyle(i).position, top: b.top, bagBot: bag.bottom, h: b.height, left: b.left }; });
  check(c.pos === 'fixed' && c.h > 280 && c.left > 900, `computer: the summary is a card in the shop column (5.12.2: under the PC) (${Math.round(c.top)} ≥ ${Math.round(c.bagBot)}, h ${Math.round(c.h)})`);
  const v = await p.evaluate(() => { const d = document.createElement('div'); d.className = 'bstage board stadium'; d.innerHTML = '<div class="ftr down posing"><div class="fmove"><div class="fart"><img></div></div></div>';
    document.body.appendChild(d); const out = getComputedStyle(d.querySelector('.fmove')).visibility; d.remove(); return out; });
  check(v === 'hidden', 'a fainted pokémon posing for the Champion photo leaves the field');
  check(!/anim\(view, frames/.test(await p.evaluate(() => victorySweep.toString())), 'no camera sweep after a gym win');
  check(!errs.length, 'no page errors ' + errs.join(' | '));
  await br.close(); console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
})();
