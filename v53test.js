/* v53: Shell Bell, Rocky Helmet, Choice Band's HP cost, and the Elite Four's price. */
const E = require('./engine.js');
const { chromium, devices } = require('playwright');
let fails = 0;
const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
const H = E.HELD_ITEMS, T = E.TUNING;
const lines = r => r.steps.flatMap(s => s.lines);
const fight = (a, b, seed) => E.simulateBattle(a, b, seed || 808);

check(H.bell.rarity === 'rare' && H.helmet.rarity === 'rare' && H.bell.cost === 5 && H.helmet.cost === 5, 'Shell Bell and Rocky Helmet are Rare, 5₽');
check(H.bell.boss === 'none' && H.helmet.boss === 'none', '…and bosses don’t hold them');

/* Choice Band: +30% Attack, −5% HP, still locked */
{ const u = E.makeUnit('machamp', 0); u.atk = 100; u.hp = 100; u.held = 'choice'; const s = E.heldStats(u);
  check(s.atk === 45 && s.hp === -5 && s.spd === 0 && H.choice.lockMain, `Choice Band: +45% Attack, −5% HP, main move only (${s.atk}/${s.hp}/${s.spd})`); }

/* Shell Bell: 35% of the damage dealt heals the most-hurt teammate */
{ const hitter = held => { const u = E.makeUnit('abra', 0); u.atk = Math.round(30 / T.atkPerDamage); u.hp = 500; u.pos = 1; u.held = held; return u; };
  const front = () => { const u = E.makeUnit('onix', 0); u.hp = 500; u.pos = 0; return u; };
  const foe = () => { const u = E.makeUnit('machop', 0); u.atk = Math.round(25 / T.atkPerDamage); u.hp = 3000; return u; };
  const ls = lines(fight([front(), hitter('bell')], [foe()], 91));
  const rings = ls.map((l, i) => { const m = l.match(/Shell Bell rang: (.+) \+(\d+) HP/); if(!m) return null;
    const hit = ls.slice(0, i).reverse().find(x => /^Machop took (\d+) damage/.test(x)); return { who: m[1], n: +m[2], dealt: hit ? +hit.match(/took (\d+)/)[1] : 0 }; }).filter(Boolean);
  check(rings.length > 0, `Shell Bell rings when its holder deals damage (${rings.length} times)`);
  check(rings.every(r => r.n <= Math.round(r.dealt * 0.35) && r.n >= 1), `…healing up to 35% of the hit (${rings[0] && rings[0].dealt} dealt → +${rings[0] && rings[0].n})`);
  check(rings.some(r => r.who === 'Onix'), '…and it goes to the hurt front-liner, not the holder');
  const none = lines(fight([front(), hitter(null)], [foe()], 91));
  check(!none.some(l => /Shell Bell/.test(l)), '(control: nothing rings without it)');
  // it can't heal an Iron Ball holder
  const f2 = front(); f2.held = 'iron';
  const ls2 = lines(fight([f2, hitter('bell')], [foe()], 91));
  check(!ls2.some(l => /rang: Onix/.test(l)), 'it looks past an Iron Ball holder'); }

/* Rocky Helmet: whoever hits the holder takes 10% of its own max HP */
{ const wall = held => { const u = E.makeUnit('tangela', 0); u.hp = 800; u.held = held; return u; };   // 3.3.0: not Onix — its opening barrier soaks the hits
  const foe = () => { const u = E.makeUnit('machop', 0); u.atk = Math.round(10 / T.atkPerDamage); u.hp = 200; return u; };
  const ls = lines(fight([wall('helmet')], [foe()], 92));
  const hurt = ls.filter(l => /Machop was hurt by Tangela's Rocky Helmet \((\d+)\)/.test(l)).map(l => +l.match(/\((\d+)\)/)[1]);
  const hits = ls.filter(l => /^Tangela took \d+ damage/.test(l)).length;
  check(hurt.length > 0 && hurt.every(n => n === 20), `Rocky Helmet: each hit costs the attacker 10% of its max HP (${hurt[0]} of 200)`);
  check(Math.abs(hurt.length - hits) <= 1, `…once per hit (${hits} hits, ${hurt.length} jolts)`);
  { const w = wall('helmet'); w.hp = 20000; w.atk = 1; const f = foe(); f.atk = 1;
    const r = fight([w], [f], 93), n = lines(r).filter(l => /Rocky Helmet/.test(l)).length;
    check(r.result === 'win' && n >= 8, `…and it wears the attacker down to a knockout (${n} jolts, ${r.result})`); }
  const ctrl = lines(fight([wall(null)], [foe()], 92));
  check(!ctrl.some(l => /Rocky Helmet/.test(l)), '(control: nothing without it)');
  }

/* bosses: gyms still hold none of the new items; the gauntlet is at its v53 price */
{ let seen = 0;
  for(const b of [...E.GYMS, ...E.ELITE_FOUR, E.CHAMPION]) for(let s = 1; s < 20; s++){
    const kind = b.id === 'blue' ? 'champion' : E.GYMS.includes(b) ? 'gym' : 'elite';
    for(const u of E.generateAiTeam({ turn: 30, seed: s, badges: 8, boss: b, kind, tier: 6, size: 6, ratio: 1 }).team)
      if(u.held === 'bell' || u.held === 'helmet') seen++; }
  check(seen === 0, 'no boss holds a Shell Bell or Rocky Helmet');
  check(T.gauntletRatio.length === 5 && T.gauntletRatio.every((x, k) => k === 0 || x > T.gauntletRatio[k - 1] * 0.9) && T.gauntletRatio[4] > T.gauntletRatio[3], `the Elite Four ratios exist and the Champion is the toughest (${T.gauntletRatio.join(', ')}; exact values pinned in v300test)`); }

(async () => {
  const br = await chromium.launch();
  for(const [tag, dev] of [['phone', devices['iPhone 13']], ['wide', { viewport: { width: 1250, height: 950 } }]]){
    const p = await (await br.newContext(dev)).newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(require('./pkbpaths').PAGE); await p.waitForTimeout(250);
    const r = await p.evaluate(() => { G.turn = 20; G.badges = 5; G.credits = 50;
      G.mart = [{ id:'protein', held:false }, { id:'bell', held:true }, { id:'helmet', held:true }]; render();
      return { tags: [...document.querySelectorAll('.martrow .rar')].map(t => t.textContent), sprites: !!SPRITES.bell && !!SPRITES.helmet }; });
    check(r.tags.filter(t => t === 'Rare').length === 2, `${tag}: both show a blue RARE tag`);
    check(r.sprites, `${tag}: both have pixel icons`);
    check(!errs.length, `${tag}: no errors${errs.length ? ' — ' + errs[0] : ''}`);
  }
  await br.close();
  console.log(fails ? `${fails} FAILED` : 'v53 passed');
  process.exit(fails ? 1 : 0);
})();
