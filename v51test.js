/* v51/v52: the four Very rare trade-off items — Choice Band, Life Orb, Iron Ball (Sean's), Heart Scale (Sean's).
   v52: Choice Band locks the holder into its main move (no Speed cost), Heart Scale doubles heals for −15% Attack,
   and the Elite Four and Champion each carry one. */
const E = require('./engine.js');
const { chromium, devices } = require('playwright');
let fails = 0;
const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
const H = E.HELD_ITEMS, T = E.TUNING;
const lines = r => r.steps.flatMap(s => s.lines);
const dmgTo = (name, ls) => ls.filter(l => l.startsWith(name + ' took')).map(l => +l.match(/took (\d+)/)[1]);
const fight = (a, b, seed) => E.simulateBattle(a, b, seed || 4242);
const NEW = ['choice', 'orb', 'iron', 'scale'];

/* the catalogue */
check(NEW.every(k => H[k] && H[k].rarity === 'veryrare' && H[k].cost === 6), 'all four are Very rare and cost 6₽');
check(NEW.every(k => H[k].boss === 'elite'), '…and marked as Elite Four / Champion items');

/* Choice Band: more Attack, and locked into the main move */
{ const u = E.makeUnit('machamp', 0); u.atk = 100; u.spd = 60; u.held = 'choice';
  const s = E.heldStats(u);
  check(s.atk === 45 && s.spd === 0, `Choice Band: +45% Attack and no Speed cost (100/60 → +${s.atk} / ${s.spd})`);
  // a pokémon whose second move fires every few actions stops using it
  const sp = Object.keys(E.SPECIES).find(k => E.SPECIES[k].move2 && E.SPECIES[k].move2.trig === 'every');
  const nm = E.SPECIES[sp].name, m2 = E.SPECIES[sp].move2.name;
  const go = held => { const a = E.makeUnit(sp, 0); a.hp = 2000; a.held = held; const d = E.makeUnit('onix', 0); d.hp = 3000;
    return lines(fight([a], [d], 71)).filter(l => l === `${nm} used ${m2}!`).length; };
  check(go(null) > 0, `(control: ${nm} uses ${m2} without it — ${go(null)} times)`);
  check(go('choice') === 0, `with a Choice Band, ${nm} never uses ${m2}`); }

/* Life Orb: +50% damage, 6% HP per attacking action */
{ const mk = held => { const a = E.makeUnit('machop', 0); a.atk = Math.round(20 / T.atkPerDamage); a.hp = 300; a.held = held; return a; };
  const tgt = () => { const d = E.makeUnit('rattata', 0); d.hp = 2000; return d; };
  const plain = dmgTo('Rattata', lines(fight([mk(null)], [tgt()], 31)))[0];
  const r = fight([mk('orb')], [tgt()], 31), ls = lines(r);
  const orb = dmgTo('Rattata', ls)[0];
  check(orb >= Math.round(plain * 1.75) - 1 && orb <= Math.round(plain * 1.75) + 1, `Life Orb: 75% more damage (${plain} → ${orb})`);
  const cost = ls.filter(l => /lost \d+ HP to its Life Orb/.test(l));
  check(cost.length > 0 && cost.every(l => +l.match(/lost (\d+)/)[1] === Math.round(300 * 0.06)), `…and costs 6% of max HP per attack (${cost[0]})`);
  const attacks = ls.filter(l => /^Machop used /.test(l)).length;
  check(Math.abs(cost.length - attacks) <= 1, `…once per action, not per target (${attacks} attacks, ${cost.length} costs)`);
  const glass = mk('orb'); glass.hp = 10;
  const r2 = fight([glass], [tgt()], 31);
  check(lines(r2).some(l => /lost \d+ HP to its Life Orb/.test(l)) && r2.result !== 'win', 'it can knock out its own holder'); }

/* Iron Ball: 35% off every hit, and no healing from any pokémon */
{ const hitter = () => { const u = E.makeUnit('machop', 0); u.atk = Math.round(20 / T.atkPerDamage); u.hp = 400; return u; };
  const wall = held => { const u = E.makeUnit('tangela', 0); u.hp = 400; u.held = held; return u; };   // 3.3.0: not Onix — it opens behind a barrier now
  const a = dmgTo('Tangela', lines(fight([wall(null)], [hitter()], 51)))[0];
  const b = dmgTo('Tangela', lines(fight([wall('iron')], [hitter()], 51)))[0];
  check(Math.abs(b - a * 0.65) <= 1, `Iron Ball: 35% off each hit (${a} → ${b})`);
  // a Support's Aftercare and a heal move both pass it by
  const sup = E.BUYABLE.find(k => E.roleOf(k) === 'support');
  const team = held => { const t = wall(held); t.pos = 0; const s = E.makeUnit(sup, 0); s.hp = 400; s.pos = 1; return [t, s]; };
  const healedOnix = ls => ls.filter(l => /Tangela was healed|tended to Tangela|Tangela regained/.test(l)).length;
  const withBall = lines(fight(team('iron'), [hitter()], 52)), without = lines(fight(team(null), [hitter()], 52));
  check(healedOnix(without) > 0, `(control: without it, ${E.SPECIES[sup].name} heals Tangela ${healedOnix(without)} times)`);
  check(healedOnix(withBall) === 0, 'with an Iron Ball, nobody heals it');
  // its own recovery is blocked too
  const recoverer = Object.keys(E.SPECIES).find(k => /Heals itself/.test((E.SPECIES[k].move2 && E.SPECIES[k].move2.text(1)) || '') || /Heals itself/.test(E.SPECIES[k].move.text(1)));
  if(recoverer){
    const nm = E.SPECIES[recoverer].name, re = new RegExp(nm + ' regained [1-9]');
    const go = held => { const u = E.makeUnit(recoverer, 0); u.hp = 300; u.held = held; const h = hitter(); h.atk *= 3; return lines(fight([u], [h], 53)); };
    check(go(null).some(l => re.test(l)), `(control: ${nm} heals itself without it)`);
    check(!go('iron').some(l => re.test(l)), `not even its own ${nm} heal`);
  }
  // resting in the PC between Elite Four fights still works (nextTurn's rest step)
  { const G = E.newGame(5); E.rollShop(G, false);
    const u = E.makeUnit('onix', 0); u.held = 'iron'; u.box = 0; G.pc = [u];
    G.gauntlet = { at: 1, hpFrac: { [u.uid]: 0.4 } };
    E.nextTurn(G);
    const f = G.gauntlet.hpFrac[u.uid];
    check(Math.abs(f - (0.4 + T.benchRest)) < 1e-9, `resting in the PC still heals an Iron Ball holder (40% → ${Math.round(f * 100)}%)`); } }

/* Heart Scale: heals the holder GIVES are 70% bigger; heals it RECEIVES aren't */
{ const sup = E.BUYABLE.filter(k => E.roleOf(k) === 'support');
  const hitter = () => { const u = E.makeUnit('gastly', 0); u.atk = Math.round(150 / T.atkPerDamage); u.hp = 3000; return u; };   // hits hard, so heals aren't capped by missing HP
  const run = held => { const t = E.makeUnit('onix', 0); t.hp = 600; t.pos = 0;
    const s = E.makeUnit(sup[0], 0); s.hp = 300; s.pos = 1; s.held = held;
    const ls = lines(fight([t, s], [hitter()], 61));
    return ls.map(l => l.match(/tended to Onix \(\+(\d+) HP\)|Onix was healed \(\+(\d+) HP\)/)).filter(Boolean).map(m => +(m[1] || m[2])); };
  const a = run(null), b = run('scale');
  const avg = x => x.reduce((p, q) => p + q, 0) / Math.max(1, x.length);
  check(a.length && b.length && Math.max(...b) >= Math.max(...a) * 1.7, `Heart Scale: the Support's heals about double (${Math.max(...a)} → ${Math.max(...b)} HP at best; the rest can be capped by missing HP)`);
  const hs = (() => { const u = E.makeUnit('chansey', 0); u.atk = 100; u.held = 'scale'; return E.heldStats(u); })();
  check(hs.atk === -10, `…for −10% Attack (${hs.atk} on 100)`);
  const onixHeld = held => { const t = E.makeUnit('onix', 0); t.hp = 300; t.pos = 0; t.held = held;
    const s = E.makeUnit(sup[0], 0); s.hp = 300; s.pos = 1;
    return lines(fight([t, s], [hitter()], 61)).map(l => l.match(/tended to Onix \(\+(\d+) HP\)/)).filter(Boolean).map(m => +m[1]); };
  check(JSON.stringify(onixHeld('scale').slice(0, 2)) === JSON.stringify(onixHeld(null).slice(0, 2)), 'holding it doesn’t make heals you receive bigger'); }

/* gym leaders never field them; each Elite Four member and the Champion carries exactly one */
{ let gymSeen = 0, gymItems = 0, eliteTeams = 0, eliteOne = 0, fit = 0, fitN = 0;
  for(const b of [...E.GYMS, ...E.ELITE_FOUR, E.CHAMPION]) for(let s = 1; s < 25; s++){
    const kind = b.id === 'blue' ? 'champion' : E.GYMS.includes(b) ? 'gym' : 'elite';
    const t = E.generateAiTeam({ turn: 30, seed: s, badges: 8, boss: b, kind, tier: 6, size: 6, ratio: 1 });
    const vr = t.team.filter(u => NEW.includes(u.held));
    if(kind === 'gym'){ gymItems += t.team.filter(u => u.held).length; gymSeen += vr.length; }
    else { eliteTeams++; if(vr.length === 1) eliteOne++;
      for(const u of vr){ fitN++; const r = E.roleOf(u.id);
        if(u.held === 'scale' ? r === 'support' : u.held === 'iron' ? true : r === 'cannon' || r === 'bruiser' || u.atk === Math.max(...t.team.map(x => x.atk))) fit++; } } }
  check(gymItems > 50 && gymSeen === 0, `gym leaders never hold them (${gymItems} gym items checked)`);
  check(eliteOne === eliteTeams, `every Elite Four and Champion team carries exactly one (${eliteOne}/${eliteTeams})`);
  check(fit === fitN, `…on a pokémon it suits (${fit}/${fitN})`);
  // a rematch fields the same item
  const b = E.ELITE_FOUR[0], spec = { turn: 30, seed: 9, badges: 8, boss: b, kind: 'elite', tier: 6, size: 6, ratio: 1 };
  const one = E.generateAiTeam(spec), two = E.generateAiTeam(spec);
  check(JSON.stringify(one.team.map(u => u.held)) === JSON.stringify(two.team.map(u => u.held)), 'the same seed brings the same item (the scouting report stays true)'); }

/* they turn up on the shelf, rarely */
{ let n = 0, hits = 0, band = 0;
  for(let s = 1; s < 3000; s++){ const G = E.newGame(s); G.turn = 30; G.badges = 8; G.team = [E.makeUnit('abra', 0)]; E.rollMart(G, false);
    for(const m of G.mart) if(m.held){ n++; if(NEW.includes(m.id)) hits++; if(m.id === 'band') band++; } }
  const each = hits / 4 / band;
  check(each > 0.06 && each < 0.15, `each Very rare turns up ~${T.rarity.veryrare.weight}× as often as a Muscle Band (${each.toFixed(3)}×)`); }

(async () => {
  const br = await chromium.launch();
  for(const [tag, dev] of [['phone', devices['iPhone 13']], ['wide', { viewport: { width: 1250, height: 950 } }]]){
    const p = await (await br.newContext(dev)).newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await p.waitForTimeout(250);
    const r = await p.evaluate(() => { G.turn = 20; G.badges = 5; G.credits = 50;
      G.team = [makeUnit('machamp', 0), makeUnit('chansey', 0)]; G.team[0].held = 'choice'; G.team[1].held = 'scale'; fixSlots(G);
      G.mart = [{ id:'protein', held:false }, { id:'orb', held:true }, { id:'scale', held:true }]; render();
      const tags = [...document.querySelectorAll('.martrow')].map(r => (r.querySelector('.rar') || {}).textContent || '');
      const sprites = ['choice', 'orb', 'iron', 'scale'].every(k => !!SPRITES[k]);
      sel = { kind:'team', idx:0 }; inspect = { kind:'unit', u:G.team[0] }; render();
      const locked = document.querySelector('#inspect .popmove.m2.locked .lockby');
      const lockTxt = locked && locked.textContent;
      sel = { kind:'team', idx:1 }; inspect = { kind:'unit', u:G.team[1] }; render();
      const neg = document.querySelector('#inspect .sbon.neg'), negTxt = neg && neg.textContent;
      return { tags, sprites, negTxt, lockTxt }; });
    check(r.tags.filter(t => t === 'Very rare').length === 2, `${tag}: Very rare items carry a gold VERY RARE tag`);
    check(r.sprites, `${tag}: all four have pixel icons`);
    check(/Choice Band/.test(r.lockTxt || ''), `${tag}: the summary strikes out the locked second move (“${r.lockTxt}”)`);
    check(/^−\d+$/.test(r.negTxt || ''), `${tag}: Heart Scale's Attack cost shows as ${r.negTxt} in the summary`);
    check(!errs.length, `${tag}: no errors${errs.length ? ' — ' + errs[0] : ''}`);
  }
  await br.close();
  console.log(fails ? `${fails} FAILED` : 'v51 passed');
  process.exit(fails ? 1 : 0);
})();
