/* v32: second moves, triggers and status conditions. */
const { chromium } = require('playwright');
const E = require('./engine.js');
const errors = [];
const check = (ok, m) => { if(!ok) errors.push(m); else console.log('… ' + m); };
const T = E.TUNING;
const mk = (id, bank) => { const u = E.makeUnit(id, E.TUNING.expForLevel2); E.growUnit(u, bank || { hp:48, atk:48, spd:24 }); return u; };
const lines = r => r.steps.flatMap(s => s.lines);

check(Object.keys(E.SPECIES).every(k => E.SPECIES[k].move2 && E.SPECIES[k].move2.name && E.SPECIES[k].move2.when()), 'every one of the 74 pokémon has a second move with a trigger');
const names = new Set(Object.values(E.SPECIES).flatMap(s => [s.move.name, s.move2.name]));
check(names.size >= 80, `the game has ${names.size} different move names now`);
for(const k of Object.keys(E.SPECIES)) for(const l of [1,2,3]){ const s = E.SPECIES[k];
  if(/undefined|NaN/.test(s.move2.text(l) + s.move.text(l))) { errors.push(`${k} move text is broken at level ${l}`); break; } }
check(true, 'every move describes itself at every level');

/* triggers */
{ const r = E.simulateBattle([mk('pidgeot')], [mk('snorlax')], 3);
  check(lines(r)[1] === 'Pidgeot used Quick Attack!', 'a priority opener goes first, even against a faster-or-slower foe'); }
{ const s = mk('snorlax'); s.spd = 400; const r = E.simulateBattle([s], [mk('pidgeot'), mk('arcanine')], 4);
  const used = lines(r).filter(l => / used /.test(l)).slice(0, 2).sort();
  check(used.join() === 'Arcanine used Extreme Speed!,Pidgeot used Quick Attack!', 'two priority movers both beat a much faster pokémon to it'); }
{ const u = mk('articuno'); const r = E.simulateBattle([u], [mk('snorlax'), mk('snorlax')], 5);
  const acts = lines(r).filter(l => /^Articuno used/.test(l));
  check(acts[3] === 'Articuno used Blizzard!' && acts[0] !== 'Articuno used Blizzard!', 'an every-4th move comes up on the 4th action'); }
{ const s = mk('dewgong'); s.hp = 300; const r = E.simulateBattle([s], [mk('machamp'), mk('golem')], 6), L = lines(r);
  const n = L.filter(l => l === 'Dewgong used Rest!').length;
  check(n === 1 && L.includes('Dewgong fell asleep.'), 'a below-half move fires once (Rest → sleeps)'); }
{ const r = E.simulateBattle([mk('machamp')], [mk('snorlax')], 7), L = lines(r);
  const i = L.indexOf('Machamp is getting pumped!');
  check(i > 0 && /^Machamp used Submission!/.test(L[i + 1]) && /^Snorlax took \d+/.test(L[i + 2]), 'a free opener (Focus Energy) still lets it attack on the same action'); }
{ const b = mk('clefable'); b.hp = 900; const hurt = mk('pidgey');
  const r = E.simulateBattle([b, mk('abra'), hurt], [mk('machamp'), mk('golem'), mk('arcanine')], 8, { hpFrac: { [hurt.uid]: 0.3 } });
  check(lines(r).some(l => /^Clefable used Light Screen!/.test(l)) && lines(r).some(l => /barrier soaked/.test(l)), 'an ally-hurt move (Light Screen) shields the team, and the barrier soaks a hit'); }

/* statuses */
{ const a = mk('charizard'); a.spd = 500; const d = mk('snorlax'); d.hp = 900;
  const L = lines(E.simulateBattle([a], [d], 9));
  check(L.some(l => /^Snorlax was burned!/.test(l)) && L.some(l => /hurt by its burn/.test(l)), 'Burn sticks and ticks'); }
{ const a = mk('charizard'); a.spd = 500; const d = mk('arcanine'); d.hp = 900; const L = lines(E.simulateBattle([a], [d], 9));
  check(!L.includes('Arcanine was burned!') && L.includes('Arcanine is unaffected.'), 'a Fire type can’t be burned'); }
{ const a = mk('jigglypuff'); a.hp = 900; a.spd = 400; const d = mk('snorlax'); d.hp = 900;
  const L = lines(E.simulateBattle([a], [d], 10));
  check(L.includes('Snorlax fell asleep!') && L.includes('Snorlax is fast asleep.') && L.filter(l => l === 'Snorlax fell asleep!').length === 1,
    'Sleep skips actions, and works only once per battle'); }
{ const a = mk('raichu'); a.hp = 900; const d = mk('pidgeot'); d.hp = 900;
  const r = E.simulateBattle([a], [d], 12), L = lines(r);
  check(L.includes('Pidgeot is paralysed! It will act less often.'), 'Thunder Wave paralyses the fastest enemy'); }
{ const a = mk('vileplume'); a.hp = 900; const b = mk('onix'); b.hp = 900; const c = mk('pidgey'); c.hp = 900;
  const L = lines(E.simulateBattle([b, c, a], [mk('charizard'), mk('bulbasaur')], 13, { hpFrac: { [c.uid]: 0.3 } }));
  check(L.some(l => l === 'Vileplume used Aromatherapy!') && L.includes('A soothing aroma filled the air.'), 'Aromatherapy cures and heals the team'); }
{ // snapshots carry status for the UI
  const a = mk('charizard'); a.spd = 500; const d = mk('snorlax'); d.hp = 900;
  const r = E.simulateBattle([a], [d], 9);
  check(r.steps.some(s => s.e.some(u => u.st === 'brn')), 'the battle replay shows who is burned'); }

/* v33: burn is a small drain plus weaker attacks; Cannons don't heal */
{ const a = mk('charizard'); a.spd = 500; const d = mk('snorlax'); d.hp = 900;
  const L = lines(E.simulateBattle([a], [d], 9));
  const tick = L.find(l => /hurt by its burn \((\d+)\)/.test(l)), n = tick ? +tick.match(/\((\d+)\)/)[1] : 0;
  const maxHp = E.effHp(d);
  check(n > 0 && Math.abs(n - Math.round(maxHp * T.status.brn.dotPct)) <= 1, `burn takes ${Math.round(T.status.brn.dotPct*100)}% a round (${n} of ${maxHp})`); }
{ const d = mk('snorlax'); d.hp = 3000; const a = mk('charizard'); a.spd = d.spd; a.hp = 3000;
  const L = lines(E.simulateBattle([a], [d], 9)); const at = L.findIndex(l => /^Snorlax was burned!/.test(l));
  const hits = (from, to) => { const out = []; for(let i = from; i < to; i++) if(L[i] === 'Snorlax used Body Slam!' && /^Charizard took (\d+)/.test(L[i+1])) out.push(+L[i+1].match(/took (\d+)/)[1]); return out; };
  const before = hits(0, at)[0], after = hits(at, L.length)[0];
  check(at > 0 && before && after && Math.abs(after / before - (1 - T.status.brn.atkCut)) < 0.05,
    `a burned pokémon hits ${Math.round(T.status.brn.atkCut*100)}% softer (Body Slam ${before} → ${after})`); }
{ const heals = Object.keys(E.SPECIES).filter(k => E.roleOf(k) === 'cannon' &&
    /[Hh]eals|Recover|\bRest\b|regain|a barrier/.test(E.SPECIES[k].move.text(2) + ' ' + E.SPECIES[k].move2.text(2)));
  check(!heals.length, `no Cannon can recover HP${heals.length ? ': ' + heals.join(', ') : ''}`); }

/* balance */
{ const out = require('child_process').execSync('node species-value.js', { env:{ ...process.env, N:'200' } }).toString();
  const vals = out.split('\n').map(l => l.match(/^(\w+)\s+\w+\s+T\d (\d+)%/)).filter(Boolean).map(m => [m[1], +m[2]]);
  const top = vals.reduce((a, b) => b[1] > a[1] ? b : a), bot = vals.reduce((a, b) => b[1] < a[1] ? b : a);
  check(top[1] <= 70 && bot[1] >= 33, `no second move made a must-buy or a dud (${bot[0]} ${bot[1]}% … ${top[0]} ${top[1]}%)`); }

/* UI */
(async () => {
  const browser = await chromium.launch();
  for(const [w, h] of [[1200, 1000], [390, 844]]){
    const page = await (await browser.newContext({ viewport:{ width:w, height:h } })).newPage();
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    await page.goto('file:///mnt/user-data/outputs/pokebattler.html'); await page.waitForTimeout(250);
    await page.evaluate(() => { G.pendingRewards = []; G.team = ['charizard','blastoise'].map(i => makeUnit(i, 2)); rollShop(G, false); save(); render(); });
    if(w > 1000){
      await page.click('[data-pop="team:0"]'); await page.waitForTimeout(250);
      const pop = await page.$$eval('#inspect .popmove', e => e.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
      check(pop.length === 2 && /Main move/.test(pop[0]) && /Every 3rd action/.test(pop[1]), `the summary shows both moves: "${(pop[1] || '').slice(0, 50)}…"`);
      await page.keyboard.press('Escape');
    }
    const j = await page.evaluate(() => {
      const m = id => { const u = makeUnit(id, 2); u.hp += 80; u.atk += 60; u.spd += 30; return u; };
      G.team = formationSort(['blastoise','clefable','charizard','butterfree','pidgeot','gengar'].map(m));
      const E2 = formationSort(['snorlax','hypno','jigglypuff','raichu','vulpix','alakazam'].map(m));
      const sim = simulateBattle(G.team, E2, 11);
      battle = { steps: sim.steps, i: 0, result: sim.result, oppName: 'Test', boss: null, kind: 'trainer', opp: { team: E2 }, sim, gauntlet: null, timer: null, exhibition: true };
      phase = 'battle';
      battle.i = sim.steps.findIndex(s => [...s.p, ...s.e].some(u => u.st) && [...s.p, ...s.e].some(u => u.shield)); render(); return battle.i; });
    await page.waitForTimeout(150);
    const chips = await page.evaluate(() => ({ st: document.querySelectorAll('.ftr .fchip[class*="st-"]').length, sh: document.querySelectorAll('.ftr .fchip.sh').length }));   // v36: the arena's chips
    check(j >= 0 && chips.st > 0 && chips.sh > 0, `${w}px: arena fighters show status (${chips.st}) and barrier (${chips.sh}) chips`);
    const sw = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    check(sw, `${w}px: no sideways scrolling`);
    await page.close();
  }
  await browser.close();
  if(errors.length){ console.log('\n' + errors.length + ' FAILURES:'); errors.forEach(e => console.log('  - ' + e)); process.exit(1); }
  console.log('\nmoves passed');
})();
