/* v42: iron out — stacked numbers, steady queue row, log fade, Run Over fits, Pokédex chips. */
const { chromium } = require('playwright');
let fails = 0;
const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
(async () => {
  const browser = await chromium.launch();
  for(const [w, h] of [[1250, 950], [390, 844]]){
    const tag = w + 'px';
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if(m.type() === 'error') errs.push(m.text()); });
    await page.goto('file:///mnt/user-data/outputs/pokebattler.html'); await page.waitForTimeout(200);
    await page.evaluate(() => { localStorage.removeItem('pkb_motion'); G.pendingRewards = []; document.querySelectorAll('.modal').forEach(x => x.remove());
      G.team = ['charizard', 'blastoise', 'venusaur', 'pikachu', 'geodude', 'clefairy'].map((id, k) => { const u = makeUnit(id, 3); u.pos = k; return u; });
      G.stage = 1; G.turn = 2; setSpeed(1); save(); render(); });

    /* the queue row is there from the start */
    await page.click('[data-act="endturn"]'); await page.waitForTimeout(80);
    const q0 = await page.evaluate(() => { const q = document.querySelector('#bqueue .queue'); return { i: battle.i, h: q ? q.getBoundingClientRect().height : 0, cells: document.querySelectorAll('#bqueue .qmon:not(.ghost)').length }; });
    await page.waitForTimeout(2600);
    const q1 = await page.evaluate(() => { const q = document.querySelector('#bqueue .queue'); return { i: battle.i, h: q ? q.getBoundingClientRect().height : 0 }; });
    check(q0.i === 0 && q0.cells > 0 && q0.h > 20, `${tag}: during the intro the turn-order row already shows who moves first (${q0.cells} up)`);
    check(q1.i > 0 && Math.abs(q1.h - q0.h) <= 1, `${tag}: and it doesn't change height when the order fills in (${Math.round(q0.h)} → ${Math.round(q1.h)})`);

    /* two numbers on the same pokémon stack */
    const st = await page.evaluate(() => new Promise(r => { const S = battle.stage; const F = [...S.f.values()][0];
      floatText(S, F, '−31', ''); setTimeout(() => { floatText(S, F, '−8', ''); floatText(S, F, 'Burned!', 'note');
        const els = [...S.fx.querySelectorAll('.num')].slice(-3).map(e => parseFloat(e.style.top)); r(els); }, 120); }));
    const gaps = [Math.abs(st[0] - st[1]), Math.abs(st[1] - st[2]), Math.abs(st[0] - st[2])];
    check(st.length === 3 && Math.min(...gaps) >= 14, `${tag}: numbers landing close together start at different heights (${st.map(Math.round).join(', ')})`);

    /* the log fades its top edge */
    const fade = await page.evaluate(() => { const b = getComputedStyle(document.querySelector('#blog'), '::before'); return b.content !== 'none' && b.position === 'sticky'; });
    check(fade, `${tag}: the battle log fades its top line`);
    await page.click('[data-act="skip"]'); await page.waitForTimeout(200);
    const fin = await page.evaluate(() => { const q = document.querySelector('#bqueue .queue'); const st = battle.steps[battle.steps.length - 1];
      return { lbl: q && q.querySelector('.qlbl').textContent, n: q ? q.querySelectorAll('.qmon:not(.ghost)').length : -1, alive: [...st.p, ...st.e].filter(u => u.hp > 0).length, h: q ? q.getBoundingClientRect().height : 0 }; });
    check(fin.lbl === 'Standing' && fin.n === fin.alive && Math.abs(fin.h - q0.h) <= 1, `${tag}: at the end the row stays and shows who is standing (${fin.n}/${fin.alive})`);

    /* Run Over fits */
    await page.evaluate(() => { battle = null; G.over = 'lost'; G.lives = 0; phase = 'over'; render(); });
    const ov = await page.evaluate(() => [...document.querySelectorAll('.overteam .slot')].map(e => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; }));
    check(ov.length === 6 && ov.every(Boolean), `${tag}: Run Over shows all six pokémon on screen`);
    const btn = await page.evaluate(() => [...document.querySelectorAll('.shopbar .btn')].map(b => b.getBoundingClientRect().height));
    check(btn.every(hh => hh < 56), `${tag}: Run Over buttons stay on one line`);

    /* Pokédex chips */
    await page.evaluate(() => { G.over = null; G.lives = 3; phase = 'shop'; render(); openDex(); });
    const chip = await page.evaluate(() => { const t = document.querySelector('.dexrow .tag'); const c = getComputedStyle(t); return { pad: parseFloat(c.paddingLeft), rad: parseFloat(c.borderTopLeftRadius) }; });
    check(chip.pad >= 4 && chip.rad >= 3, `${tag}: Pokédex type chips have padding and rounded corners`);
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${tag}: no sideways scrolling`);
    check(errs.length === 0, `${tag}: no console errors ${errs.slice(0, 2).join(' | ')}`);
    await page.close();
  }
  await browser.close();
  console.log(fails ? `${fails} FAILED` : 'iron out passed');
  process.exit(fails ? 1 : 0);
})();
