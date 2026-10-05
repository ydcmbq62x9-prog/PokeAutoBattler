/* v47: smooth START menu, sound effects, quick wipes after 3 battles. */
const { chromium } = require('playwright');
let fails = 0;
const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
const URL = 'file:///mnt/user-data/outputs/gen2/pokebattler.html';
const prep = () => { G.pendingRewards = []; document.querySelectorAll('.modal').forEach(x => x.remove());
  const m = (id, pos) => { const u = makeUnit(id, 4); u.pos = pos; return u; };
  G.team = [m('charizard', 0), m('blastoise', 1), m('pidgeot', 4)]; G.stage = 1; G.turn = 2; G.credits = 20;
  setSpeed(4); PREF.set('motion', 'device'); rollShop(G, false); save(); render(); };
(async () => {
  const browser = await chromium.launch();
  for(const [w, h] of [[1250, 950], [390, 844]]){
    const tag = w + 'px';
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: w < 500 });
    await ctx.addInitScript(() => { window.PKB_SOUND = true; });
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto(URL); await page.waitForTimeout(250); await page.evaluate(prep); await page.waitForTimeout(300);
    const logSince = async n => page.evaluate(n => SFX.log.slice(n), n);
    const mark = async () => page.evaluate(() => SFX.log.length);

    /* ---- START menu ---- */
    let n = await mark();
    const t = await page.evaluate(() => { const s = performance.now(); document.querySelector('[data-act="menu"]').click(); return performance.now() - s; });
    const m = await page.evaluate(() => { const b = document.querySelector('.modal.startmenu .box'); const cs = getComputedStyle(b);
      return { name: cs.animationName, fn: cs.animationTimingFunction, dur: parseFloat(cs.animationDuration), wc: cs.willChange,
        focusedNow: !!document.activeElement.closest('.startmenu') }; });
    check(m.name === 'smin2' && !/steps/.test(m.fn) && m.dur <= 0.2, `${tag}: START slides in smoothly (${m.name}, ${m.fn}, ${m.dur}s) — no stepped frames`);
    check(/transform/.test(m.wc), `${tag}: the menu slides on its own layer (will-change: ${m.wc})`);
    check(t < 8, `${tag}: opening START takes ${t.toFixed(1)}ms of script — nothing forces a full-page layout`);
    check(!m.focusedNow, `${tag}: the cursor doesn't grab focus mid-slide`);
    await page.waitForTimeout(350);
    if(w > 500){
      check(await page.evaluate(() => !!document.activeElement.closest('.startmenu')), `${tag}: …it moves into the menu once the slide has finished`);
      await page.keyboard.press('ArrowDown'); await page.waitForTimeout(60);
      check(await page.evaluate(() => document.querySelector('.smi.cur').dataset.m === 'dex'), `${tag}: arrow keys still move the ▶ cursor`);
    }
    check(await page.evaluate(() => getComputedStyle(document.querySelector('#inspect'), '::after').animationPlayState === 'paused'),
      `${tag}: the page's looping animations pause behind the menu`);
    let got = await logSince(n);
    check(got[0] === 'open' && (w < 500 || got.includes('move')), `${tag}: sounds — START opens with a chime${w > 500 ? ', the cursor blips' : ''} (${got.join(', ')})`);
    n = await mark();
    if(w > 500) await page.keyboard.press('Escape'); else await page.click('.smi[data-m="close"]');
    await page.waitForTimeout(80);
    got = await logSince(n);
    check(!(await page.$('.modal')) && got.includes('back'), `${tag}: ${w > 500 ? 'Escape' : 'EXIT'} closes it with a back blip`);

    /* ---- shop sounds ---- */
    await page.evaluate(prep); await page.waitForTimeout(100);
    n = await mark();
    await page.click('.drow[data-act="dc"]'); await page.waitForTimeout(60);
    got = await logSince(n);
    check(got.join() === 'tap', `${tag}: picking up a Daycare pokémon taps (${got.join(', ')})`);
    n = await mark();
    await page.click('.pfield .slot.empty'); await page.waitForTimeout(80);
    got = await logSince(n);
    check(got.length === 1 && got[0] === 'land', `${tag}: dropping it in plays one sound, the pokéball pop (${got.join(', ')})`);
    n = await mark();
    await page.evaluate(() => { G.credits = 0; G.freeRolls = 0; render(); });
    await page.click('[data-act="rolldc"]', { force: true }).catch(() => {});
    await page.evaluate(() => handle('rolldc'));
    await page.waitForTimeout(60);
    got = await logSince(n);
    check(got.includes('error'), `${tag}: a reroll you can't afford buzzes (${got.join(', ')})`);
    await page.evaluate(() => { G.credits = 10; render(); });
    n = await mark(); await page.evaluate(() => handle('rolldc')); await page.waitForTimeout(60);
    got = await logSince(n);
    check(got.join() === 'deal', `${tag}: a reroll deals the new stock with a shuffle (${got.join(', ')})`);
    n = await mark();
    await page.evaluate(() => { const u = G.team[0]; u.id = 'charmander'; u.exp = 0; render(); u.id = 'charmeleon'; u.exp = 2; render(); });
    got = await logSince(n);
    check(got.includes('evolve'), `${tag}: an evolution in the shop gets its jingle (${got.join(', ')})`);

    /* ---- Options: sound off, volume ---- */
    await page.evaluate(() => openOptions()); await page.waitForTimeout(100);
    const rows = await page.$$eval('.optrow > span', e => e.map(x => x.textContent));
    check(['Volume', 'Transitions'].every(r => rows.includes(r)), `${tag}: Options has Volume and Transitions`);
    const tr = await page.$$eval('[data-o="wipe"]', e => e.map(x => x.textContent + (x.classList.contains('on') ? '*' : '')));
    check(tr.join() === 'Auto*,Full,Quick,Off', `${tag}: Transitions offers ${tr.join(' / ')} (Auto by default)`);
    const fit = await page.evaluate(() => { const b = document.querySelector('.modal .box').getBoundingClientRect();
      return [...document.querySelectorAll('.optrow .sp')].every(x => { const r = x.getBoundingClientRect(); return r.right <= b.right + 1 && r.left >= b.left - 1; }); });
    check(fit, `${tag}: every Options button fits inside the box`);
    await page.click('[data-o="volume"][data-v="off"]'); await page.waitForTimeout(60);
    n = await mark();
    await page.click('[data-m="close"]'); await page.evaluate(() => { handle('rolldc'); SFX.play('win'); });
    got = await logSince(n);
    check(got.length === 0 && await page.evaluate(() => PREF.get('sound') === 'off'), `${tag}: Sound Off silences everything`);
    await page.evaluate(() => { PREF.set('sound', 'on'); PREF.set('volume', 'mid'); });

    /* every sound actually plays through Web Audio without an error */
    const played = await page.evaluate(async () => { const c = SFX.ensure(); for(const k of SFX.names){ SFX.play(k); await new Promise(r => setTimeout(r, 60)); }
      return { state: c && c.state, n: SFX.names.length, has: typeof AudioContext }; });
    check(played.n >= 25 && played.state && errs.length === 0, `${tag}: all ${played.n} sounds play through Web Audio (${played.state}) with no errors`);

    /* ---- battle sounds + wipes ---- */
    await page.evaluate(() => { window.PKB_WIPE = true; sessionBattles = 0; PREF.set('wipe', 'auto'); });
    await page.evaluate(prep); await page.evaluate(() => setSpeed(1));
    const durs = [], modes = [];
    for(let k = 0; k < 4; k++){
      n = await mark();
      const r = await page.evaluate(() => new Promise(res => { let mode = null; const t0 = performance.now(); document.querySelector('[data-act="endturn"]').click();
        const iv = setInterval(() => { const wp = document.querySelector('.wipe'); if(wp) mode = wp.dataset.mode;
          if(phase === 'battle' && !wp){ clearInterval(iv); res({ ms: performance.now() - t0, mode }); } }, 8); }));
      durs.push(Math.round(r.ms)); modes.push(r.mode);
      await page.waitForTimeout(150);
      await page.evaluate(() => finishPlayback()); await page.waitForTimeout(700);
      got = await logSince(n);
      if(k === 0) check(got.includes('wipeIn') && got.includes('wipeOut') && got.includes('encounter') && (got.includes('win') || got.includes('lose') || got.includes('badge')),
        `${tag}: a battle plays the wipe, the encounter sting and a result jingle (${[...new Set(got)].join(', ')})`);
      await page.evaluate(() => { const c = document.querySelector('[data-act="afterbattle"]'); c && c.click(); });
      await page.waitForFunction(() => phase === 'shop' && !document.querySelector('.wipe'), null, { timeout: 4000 });
      await page.evaluate(() => { document.querySelectorAll('.modal').forEach(x => x.remove()); G.pendingRewards = []; if(G.over){ G.over = null; G.lives = 5; phase = 'shop'; } render(); });
    }
    check(modes.slice(0, 3).every(m => m === 'full') && modes[3] === 'quick', `${tag}: Auto — battles 1–3 get the full wipe, battle 4 the quick one (${modes.join(', ')})`);
    check(durs[3] < 650 && durs[0] > 900, `${tag}: the quick wipe takes ${durs[3]}ms against ${durs[0]}ms for the full one`);
    await page.evaluate(() => PREF.set('wipe', 'full'));
    check(await page.evaluate(() => wipeMode()) === 'full', `${tag}: Transitions → Full keeps the rolling ball all session`);
    await page.evaluate(() => PREF.set('wipe', 'off'));
    const off = await page.evaluate(() => new Promise(res => { let seen = false; document.querySelector('[data-act="endturn"]').click();
      const iv = setInterval(() => { if(document.querySelector('.wipe')) seen = true; if(phase === 'battle'){ clearInterval(iv); setTimeout(() => res(seen || !!document.querySelector('.wipe')), 100); } }, 5); }));
    check(!off, `${tag}: Transitions → Off goes straight into the battle`);
    await page.evaluate(() => PREF.set('wipe', 'auto'));

    /* hits in a fight make sounds */
    await page.evaluate(() => { finishPlayback(); handle('afterbattle'); });
    await page.waitForFunction(() => phase === 'shop' && !wiping, null, { timeout: 4000 });
    await page.evaluate(() => { document.querySelectorAll('.modal').forEach(x => x.remove()); G.pendingRewards = []; if(G.over){ G.over = null; G.lives = 5; phase = 'shop'; render(); } setSpeed(4); });
    n = await mark();
    await page.evaluate(() => startBattle());
    await page.waitForFunction(() => battle && battle.i >= battle.steps.length - 1, null, { timeout: 20000 });
    await page.waitForTimeout(600);
    got = await logSince(n);
    check(got.includes('hit') || got.includes('crit'), `${tag}: blows in battle land with a hit sound (${[...new Set(got)].join(', ')})`);
    check(errs.length === 0, `${tag}: no page errors${errs.length ? ' — ' + errs.join(' | ') : ''}`);
    await ctx.close();
  }
  await browser.close();
  console.log(fails ? `${fails} FAILED` : 'v47 passed');
  process.exit(fails ? 1 : 0);
})();
