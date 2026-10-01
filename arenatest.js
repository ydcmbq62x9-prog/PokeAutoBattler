/* v36: the arena battle screen, its intro/outro, and the shop's animations. */
const { chromium } = require('playwright');
let fails = 0;
const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
(async () => {
  const browser = await chromium.launch();
  for(const [w, h] of [[1250, 950], [390, 844]]){
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if(m.type() === 'error') errs.push(m.text()); });
    await page.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await page.waitForTimeout(250);
    await page.evaluate(() => { G.pendingRewards = []; G.credits = 20; const m = (id, pos) => { const u = makeUnit(id, 4); u.pos = pos; return u; };
      G.team = [m('charizard', 0), m('blastoise', 1), m('pidgeot', 4), m('clefable', 2)]; rollShop(G, false); save(); render();
      document.querySelectorAll('.modal').forEach(x => x.remove()); });

    /* ---- shop polish ---- */
    await page.click('.drow[data-act="dc"][data-i="0"]'); await page.waitForTimeout(80);
    await page.click('.slot[data-act="team"][data-i="3"]'); await page.waitForTimeout(80);
    const landed = await page.evaluate(() => ({ land: !!document.querySelector('.slot[data-i="3"] .unit.fx-land'),
      spend: !!document.querySelector('.stat.credits.fx-spend'), float: [...document.querySelectorAll('.sfloat')].map(e => e.textContent) }));
    check(landed.land, `${w}px: a pokémon bought into the party lands with the pokéball pop`);
    check(landed.spend && landed.float.some(t => /−3₽/.test(t)), `${w}px: spending ticks the money (${landed.float.join(', ')})`);
    await page.click('[data-act="rolldc"]'); await page.waitForTimeout(80);
    check(await page.evaluate(() => document.querySelectorAll('.dclist .drow.fx-deal').length > 0), `${w}px: a reroll deals the Daycare in`);
    await page.click('.slot[data-act="team"][data-i="0"]'); await page.waitForTimeout(60);
    await page.click('[data-act="cancel"]'); await page.waitForTimeout(60);
    check(await page.evaluate(() => !document.querySelector('.fx-land,.dclist .fx-deal')), `${w}px: a tap that changes nothing animates nothing`);

    /* ---- the arena ---- */
    await page.evaluate(() => document.querySelector('[data-act="endturn"]').click());
    await page.waitForTimeout(250);
    const start = await page.evaluate(() => {
      const st = battle.steps[0], stage = document.querySelector('.bstage'), r = stage.getBoundingClientRect();
      const mid = r.left + r.width / 2;
      const f = [...document.querySelectorAll('.ftr')].map(e => ({ side: e.classList.contains('p') ? 'p' : 'e', x: e.getBoundingClientRect().left + e.getBoundingClientRect().width / 2 }));
      return { n: f.length, want: st.p.length + st.e.length, left: f.filter(x => x.side === 'p').every(x => x.x < mid), right: f.filter(x => x.side === 'e').every(x => x.x > mid),
               intro: !!document.querySelector('.introban'), introTxt: (document.querySelector('.introban') || {}).textContent || '' };
    });
    check(start.n === start.want, `${w}px: every pokémon stands on the field (${start.n} of ${start.want})`);
    check(start.left && start.right, `${w}px: your side on the left, theirs on the right`);
    check(start.intro && /wants to battle|blocks the way/.test(start.introTxt), `${w}px: the intro says "${start.introTxt.replace(/\s+/g, ' ').trim().slice(0, 40)}"`);
    await page.waitForTimeout(2200);
    check(await page.evaluate(() => !document.querySelector('.introban')), `${w}px: the intro clears before the fight`);
    const seen = await page.evaluate(() => new Promise(res => {
      let nums = 0, shots = 0; const keep = document.querySelector('.bstage');
      const mo = new MutationObserver(ms => { for(const m of ms) for(const n of m.addedNodes){ if(n.classList && n.classList.contains('num')) nums++;
        if(n.classList && (n.classList.contains('shot') || n.classList.contains('slash') || n.classList.contains('punch') || n.classList.contains('ring'))) shots++; } });
      mo.observe(keep, { childList: true, subtree: true });
      setTimeout(() => { mo.disconnect(); res({ nums, shots, same: document.querySelector('.bstage') === keep, i: battle.i }); }, 3500);
    }));
    check(seen.nums > 0, `${w}px: damage numbers float off the pokémon (${seen.nums} in 3.5s)`);
    check(seen.shots > 0, `${w}px: attacks fly across the field (${seen.shots})`);
    check(seen.same, `${w}px: the field is kept between steps, not redrawn`);
    if(await page.$('.sp[data-i="2"]')){ await page.click('.sp[data-i="2"]'); await page.waitForTimeout(100); }
    check(await page.evaluate(() => !!document.querySelector('#stageslot .bstage')), `${w}px: changing speed keeps the field on screen`);
    if(await page.$('[data-act="skip"]')) await page.click('[data-act="skip"]');
    await page.waitForTimeout(1600);     // a faint that was mid-animation finishes
    const end = await page.evaluate(() => {
      const last = battle.steps[battle.steps.length - 1];
      const alive = new Set([...last.p.map(u => 'p' + u.uid), ...last.e.map(u => 'e' + u.uid)]);
      const f = [...document.querySelectorAll('.ftr')];
      const downOk = battle.stage && [...battle.stage.f.entries()].every(([k, F]) => F.el.classList.contains('down') === !alive.has(k.replace(':', '')));
      const bad = battle.stage ? [...battle.stage.f.entries()].filter(([k, F]) => F.el.classList.contains('down') === alive.has(k.replace(':', ''))).map(([k, F]) => `${k} ${F.nm} down=${F.el.classList.contains('down')} F.down=${F.down}`) : [];
      return { downOk, bad, at: battle.stage.at, n: battle.steps.length, ribbon: (document.querySelector('.big.ribbon') || {}).textContent || '', result: battle.result,
               fx: document.querySelectorAll('.fxl > *').length, sw: document.documentElement.scrollWidth <= innerWidth + 1 };
    });
    check(end.downOk, `${w}px: after a skip, exactly the fainted pokémon are down ${end.bad.join('; ')} at=${end.at}/${end.n}`);
    check(end.result === 'win' ? /VICTORY|BADGE|BEATEN|FALLS|CHAMPION/.test(end.ribbon) : end.ribbon.trim().length > 0, `${w}px: the result ribbon reads "${end.ribbon.trim()}" (${end.result})`);
    check(end.sw, `${w}px: no sideways scrolling`);
    await page.click('[data-act="afterbattle"]'); await page.waitForTimeout(300);
    await page.evaluate(() => document.querySelectorAll('.modal').forEach(x => x.remove()));
    const back = await page.evaluate(() => ({ phase, stage: !!document.querySelector('.bstage') }));
    check(back.phase === 'shop' && !back.stage, `${w}px: back to the shop (${JSON.stringify(back)})`);
    check(!errs.length, `${w}px: no console errors ${errs.join(' | ')}`);
    await ctx.close();
  }

  /* ---- 4× all the way, and reduced motion ---- */
  for(const [label, opts] of [['4×', {}], ['reduced motion', { reducedMotion: 'reduce' }]]){
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, ...opts });
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await page.waitForTimeout(250);
    await page.evaluate(() => { G.pendingRewards = []; setSpeed(4); const m = (id, pos) => { const u = makeUnit(id, 20); u.pos = pos; return u; };
      G.team = [m('onix', 0), m('pikachu', 5), m('gengar', 4)]; save(); render(); document.querySelectorAll('.modal').forEach(x => x.remove()); });
    await page.evaluate(() => document.querySelector('[data-act="endturn"]').click());
    const t0 = Date.now();
    await page.waitForFunction(() => battle && battle.i >= battle.steps.length - 1, null, { timeout: 90000 }).catch(() => {});
    await page.waitForTimeout(900);
    const r = await page.evaluate(() => ({ done: battle && battle.i >= battle.steps.length - 1, ribbon: !!document.querySelector('.big.ribbon'),
      left: document.querySelectorAll('.fxl > *').length, steps: battle.steps.length }));
    check(r.done && r.ribbon, `${label}: a ${r.steps}-step fight plays out to the ribbon in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    check(r.left < 8, `${label}: effects clean up after themselves (${r.left} left)`);
    check(!errs.length, `${label}: no errors ${errs.join(' | ')}`);
    await ctx.close();
  }
  await browser.close();
  console.log(fails ? `\n${fails} arena check(s) FAILED` : '\narena passed');
  process.exit(fails ? 1 : 0);
})();
