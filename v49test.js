/* v49: the shop is patched in place (no flicker), toasts float, small held badge on the summary. */
const { chromium, devices } = require('playwright');
let fails = 0;
const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
const URL = 'file:///mnt/user-data/outputs/gen2/pokebattler.html';
const prep = () => { G.pendingRewards = []; document.querySelectorAll('.modal').forEach(x => x.remove());
  G.turn = 14; G.credits = 60; G.stage = 3;
  G.team = [makeUnit('wartortle', 2), makeUnit('onix', 0), makeUnit('pikachu', 0), makeUnit('machoke', 0)];
  G.pc = [makeUnit('abra', 0), makeUnit('gastly', 0)];
  G.team[0].held = 'band'; G.team[1].held = 'coat';
  G.bag = ['sitrus', 'lefto']; PREF.set('text', 'instant');
  rollShop(G, false); save(); render(); };
/* the page as a plain tree, minus the one-shot effect classes and inline delays */
const SIG = () => { const walk = n => n.nodeType === 1 && n.classList.contains('toastbox') ? '' : n.nodeType === 3 ? n.nodeValue : n.nodeType !== 1 ? '' :
    '<' + n.tagName + [...n.attributes].map(a => a.name === 'style' ? { name: 'style', value: a.value.replace(/\s*(animation-delay|--sparkdelay):[^;]*;?/g, '').replace(/\s+/g, '') } : a)
      .filter(a => a.name !== 'style' || a.value).map(a => a.name === 'style' ? 'style=' + a.value.replace(/;$/, '') : a.name === 'class' ? 'class=' + a.value.split(/\s+/).filter(c => c && !/^fx-|^reveal$/.test(c)).sort().join('.') : a.name + '=' + a.value)
      .sort().join(' ') + '>' + [...n.childNodes].map(walk).join('') + '</>';
  return walk(document.getElementById('app')); };
(async () => {
  const browser = await chromium.launch();
  for(const [tag, dev] of [['phone', devices['iPhone 13']], ['wide', { viewport: { width: 1250, height: 950 } }]]){
    const ctx = await browser.newContext(dev);
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto(URL); await page.waitForTimeout(250); await page.evaluate(prep); await page.waitForTimeout(300);
    const tap = sel => dev.hasTouch ? page.tap(sel) : page.click(sel);

    /* 1. a tap keeps the sprites it didn't change */
    await page.evaluate(() => { window.__keep = [...document.querySelectorAll('#app .pfield img, #app .cell img, #app .drow img')]; });
    await tap('.slot[data-act="team"][data-i="0"]'); await page.waitForTimeout(200);
    await page.evaluate(() => { sel = null; inspect = null; render(); }); await page.waitForTimeout(100);
    await tap('.drow'); await page.waitForTimeout(200);
    const kept = await page.evaluate(() => { const k = __keep.filter(i => i.isConnected).length; return { k, n: __keep.length }; });
    check(kept.n > 8 && kept.k / kept.n > 0.9, `${tag}: taps keep the sprites on screen instead of rebuilding them (${kept.k}/${kept.n} kept)`);

    /* 2. the patched page is exactly what a fresh draw would be — fuzzed over many taps */
    let bad = 0, steps = 0;
    for(let s = 0; s < 70; s++){
      const acts = await page.$$('#app [data-act]:not([data-act="endturn"]):not([data-act="restart"]):not([data-act="totitle"]):not([data-act="menu"]):not([disabled])');
      if(!acts.length) break;
      const el = acts[(s * 7919) % acts.length];
      if(!(await el.isVisible())) continue;
      await el.click({ force: true, timeout: 800 }).catch(() => {});
      await page.evaluate(() => { document.querySelectorAll('.modal').forEach(x => x.remove()); const t = document.getElementById('title'); if(t){ t.remove(); document.body.classList.remove('titled'); titleEl = null; } });
      steps++;
      const same = await page.evaluate(SIG => { const sig = eval(SIG); const a = sig();
        drawnPhase = null; render(); const b = sig(); if(a === b) return true;
        let i = 0; while(a[i] === b[i]) i++; return [a.slice(Math.max(0, i - 200), i + 150), b.slice(Math.max(0, i - 200), i + 150)]; }, '(' + SIG.toString() + ')');
      if(same !== true){ bad++; if(bad === 1) console.log('   diff:', JSON.stringify(same[0].slice(150,260)), '\n   vs', JSON.stringify(same[1].slice(150,260))); }
      if(await page.evaluate(() => phase !== 'shop')) await page.evaluate(() => { phase = 'shop'; render(); });
    }
    check(steps > 30 && bad === 0, `${tag}: after ${steps} random taps the patched screen matches a fresh draw (${bad} mismatches)`);

    /* 3. a message floats and leaves the summary alone */
    await page.evaluate(prep); await page.waitForTimeout(100);
    await tap('.slot[data-act="team"][data-i="0"]'); await page.waitForTimeout(150);
    const h0 = await page.evaluate(() => ({ h: document.documentElement.scrollHeight, name: document.querySelector('#inspect .popname').textContent }));
    await page.evaluate(() => say('Not enough ₽.')); await page.waitForTimeout(120);
    const t = await page.evaluate(() => { const b = document.querySelector('.toastbox'), r = b && b.getBoundingClientRect();
      return { txt: b && b.textContent, top: r && r.top, fixed: b && getComputedStyle(b).position, h: document.documentElement.scrollHeight,
        name: (document.querySelector('#inspect .popname') || {}).textContent, inside: innerWidth - (r ? r.right : 0) >= 0 && r && r.left >= 0 }; });
    check(t.txt === 'Not enough ₽.' && t.fixed === 'fixed' && t.top < 60 && t.inside, `${tag}: a message pops up at the top of the screen`);
    check(t.name === h0.name && t.h === h0.h, `${tag}: …without replacing the summary or changing the page height (${h0.h} → ${t.h})`);
    await page.waitForTimeout(2100);
    check(await page.evaluate(() => !document.querySelector('.toastbox')), `${tag}: …and goes away by itself`);

    /* 4. the held badge on the summary is a small corner badge */
    const hb = await page.evaluate(() => { sel = { kind:'team', idx:0 }; inspect = { kind:'unit', u:G.team.find(u => u.held) }; render(); const a = document.querySelector('#inspect .popart'), h = a.querySelector('.held'), i = h.querySelector('img'), s = a.querySelector(':scope > img');
      return { art: a.getBoundingClientRect().width, badge: h.getBoundingClientRect().width, icon: i.getBoundingClientRect().width, sprite: s.getBoundingClientRect().width }; });
    check(hb.badge <= 22 && hb.icon <= hb.badge && hb.icon < hb.sprite / 2, `${tag}: held-item badge on the summary is small (badge ${hb.badge}px, icon ${hb.icon}px, sprite ${hb.sprite}px)`);

    /* 5. effects still play when they happen twice in a row */
    const fx = await page.evaluate(() => { sel = null; inspect = null; render();
      const u = G.team[2]; const got = [];
      for(let k = 0; k < 2; k++){ u.exp = (u.exp || 0) + 1; render();
        const el = document.querySelector(`.slot[data-act="team"][data-i="${u.pos}"] .unit`);
        got.push(!!el && [...el.classList].some(c => /^fx-/.test(c)) && el.getAnimations().length > 0); }
      return got; });
    check(fx.every(Boolean), `${tag}: a level/EXP effect plays each time, not just the first (${fx})`);

    check(!errs.length, `${tag}: no errors${errs.length ? ' — ' + errs[0] : ''}`);
    await ctx.close();
  }
  await browser.close();
  console.log(fails ? `${fails} FAILED` : 'v49 passed');
  process.exit(fails ? 1 : 0);
})();
