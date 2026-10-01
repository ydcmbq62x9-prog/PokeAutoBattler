/* v28 roles, as a regression test: data, growth, the four traits, formations,
   the new pokémon, the UI, and the balance claims the design rests on. */
const { chromium } = require('playwright');
const { execSync } = require('child_process');
const E = require('./engine.js');
const errors = [];
const check = (ok, m) => { if(!ok) errors.push(m); else console.log('… ' + m); };
const mk = (id, bank) => { const u = E.makeUnit(id, 0); if(bank) E.growUnit(u, bank); return u; };

/* ---- data ---- */
const roles = Object.keys(E.ROLES);
check(Object.keys(E.SPECIES).every(k => roles.includes(E.SPECIES[k].role)), 'every species has one of the four roles');
const NEW = ['jigglypuff','wigglytuff','oddish','gloom','vileplume','clefairy','clefable','chansey','shellder','cloyster','rhyhorn','rhydon','voltorb','electrode'];
check(NEW.every(k => E.SPECIES[k]), `the fourteen new pokémon are in (${Object.keys(E.SPECIES).length} species)`);
for(const r of roles) check(E.BUYABLE.filter(k => E.roleOf(k) === r).length >= 6, `the Daycare has at least six ${r} lines`);
check(E.stoneFor('jigglypuff') === 'moonstone' && E.stoneFor('clefairy') === 'moonstone' && E.stoneFor('shellder') === 'waterstone',
  'Moon Stone evolves Jigglypuff and Clefairy; Water Stone evolves Shellder');
for(const r of roles){ const w = E.TUNING.roles[r].grow; check(Math.abs(w.hp + w.atk + w.spd - 3) < 1e-9, `${r} growth weights sum to 3`); }

/* ---- growth ---- */
const bank = { hp:40, atk:40, spd:20 };
const tk = mk('onix', bank), cn = mk('abra', bank), br = mk('machop', bank);
const gain = (u, id) => ({ hp: u.hp - E.SPECIES[id].hp, atk: u.atk - E.SPECIES[id].atk, spd: u.spd - E.SPECIES[id].spd });
check(gain(tk,'onix').hp > gain(br,'machop').hp && gain(tk,'onix').atk < gain(br,'machop').atk, 'a Tank grows more HP and less Attack than a Bruiser');
check(gain(cn,'abra').atk > gain(br,'machop').atk && gain(cn,'abra').hp < gain(br,'machop').hp, 'a Cannon grows more Attack and less HP than a Bruiser');
const frac = E.makeUnit('onix', 0); for(let i = 0; i < 10; i++) E.growUnit(frac, { hp:0, atk:0, spd:1 });
check(frac.spd - E.SPECIES.onix.spd === 6, 'fractions are banked, not rounded away (10 × 0.6 Speed = 6)');
const G = E.newGame(5); E.rollShop(G, false); G.trainerExp = { hp:30, atk:30, spd:15 };
const fresh = E.trainerCatchUp(G, E.makeUnit('clefairy', 0));
check(fresh.hp - E.SPECIES.clefairy.hp === Math.floor(30 * E.TUNING.roles.support.grow.hp), 'the trainer catch-up is split by role too');

/* ---- traits ---- */
const lvl = u => { u.hp = 400; return u; };
// Bodyguard: a Tank beside a non-Tank in the front rank takes every front hit
{ const A = [lvl(mk('geodude')), lvl(mk('machop'))], Bt = [lvl(mk('charmander'))];
  const r = E.simulateBattle(A, Bt, 3), lines = r.steps.flatMap(s => s.lines);
  const hits = lines.filter(l => /took \d+ damage/.test(l) && /^(Geodude|Graveler|Machop|Machoke)/.test(l));
  check(hits.length > 3 && hits.every(l => /^Geodude|^Graveler/.test(l)), `Bodyguard: all ${hits.length} front hits land on the Tank`); }
// Covering Fire: the same Cannon hits harder behind a Tank than in the front rank
{ const dmg = (A) => { const r = E.simulateBattle(A, [lvl(mk('snorlax'))], 9);
    const l = r.steps.flatMap(s => s.lines).find(x => /^Snorlax took (\d+)/.test(x)); return l ? +l.match(/took (\d+)/)[1] : 0; };
  const cA = mk('charmander'); cA.atk = 200; cA.spd = 500;
  const front = dmg([JSON.parse(JSON.stringify(cA))]);
  const cover = dmg([lvl(mk('geodude')), lvl(mk('onix')), JSON.parse(JSON.stringify(cA))]);
  check(Math.abs(cover / front - (1 + E.TUNING.roles.cannon.backBoost)) < 0.05, `Covering Fire: ${front} in front, ${cover} from behind a Tank`); }
// Steady: a Bruiser takes a super-effective hit at ×1.5 (and shrugs off a share)
{ const hitOn = id => { const t = lvl(mk(id)); const s = mk('pikachu'); s.atk = 300; s.spd = 900;
    const r = E.simulateBattle([s], [t], 4); const l = r.steps.flatMap(x => x.lines).find(x => /took \d+ damage/.test(x)); return +l.match(/took (\d+)/)[1]; };
  const onBruiser = hitOn('poliwag'), onSupport = hitOn('seel');   // both Water: Lightning is ×2
  const want = E.TUNING.roles.bruiser.superTaken * E.TUNING.roles.bruiser.dmgTaken / E.TUNING.weakMult;
  check(Math.abs(onBruiser / onSupport - want) < 0.05, `Steady: a Bruiser takes ${onBruiser} where a Support takes ${onSupport}`); }
// Aftercare: a Support tends its most-hurt teammate between rounds
{ const S = lvl(mk('clefable')), T = lvl(mk('onix')); T.hp = 400;
  const r = E.simulateBattle([T, S], [lvl(mk('rattata'))], 7);
  check(r.steps.some(s => s.lines.some(l => /^Clefable tended to/.test(l))), 'Aftercare: the Support tends to its team'); }

/* ---- formations ---- */
const order = E.formationSort(['abra','onix','clefairy','machop','geodude'].map(id => E.makeUnit(id,0))).map(u => E.roleOf(u));
check(order.join() === 'tank,tank,bruiser,support,cannon', `formationSort lines up tanks → bruisers → supports → cannons (${order})`);
let sorted = 0, teams = 0;
for(let t = 3; t < 40; t += 3) for(let s = 1; s < 6; s++){
  const team = E.generateAiTeam({ turn:t, seed:s }).team.map(u => E.ROLE_ORDER[E.roleOf(u)]); teams++;
  if(team.every((x, i) => i === 0 || x >= team[i-1])) sorted++; }
check(sorted === teams, `trainers line up by role (${sorted}/${teams} teams)`);
const erika = E.generateAiTeam({ turn:20, seed:3, boss:E.bossById('erika'), kind:'gym', badges:4, depth:2 });
check(erika.team.map(u => E.ROLE_ORDER[E.roleOf(u)]).every((x, i, a) => i === 0 || x >= a[i-1]), 'gym leaders line up by role too');
check(E.themePool(['Grass']).includes('vileplume') && E.themePool(['Electric']).includes('electrode') && E.themePool(['Ground']).includes('rhydon'),
  'the new pokémon join the gym themes (Erika, Lt. Surge, Giovanni…)');

/* ---- balance: the claims the design rests on ---- */
const shapes = execSync('node role-measure.js', { env:{ ...process.env, NORM:'0', N:'80' } }).toString();
const avg = name => { const l = shapes.split('\n').find(x => x.startsWith(name)); return l ? +l.match(/avg (\d+)%/)[1] : NaN; };
const mixed = avg('mixed 2T 2B 1S 1C'), monos = ['all tank','all bruiser','all cannon','all support'].map(avg);
check(monos.every(m => m < mixed), `a mixed team beats every one-role team on average (${mixed}% vs ${monos.join('/')}%)`);
check(Math.max(...shapes.split('\n').filter(x => /avg/.test(x)).map(x => +x.match(/avg (\d+)%/)[1])) < 80, 'no team shape wins 80%+ of its matchups');
const sv = execSync('node species-value.js', { env:{ ...process.env, N:'200' } }).toString();
const vals = sv.split('\n').map(l => l.match(/^(\w+)\s+\w+\s+T\d (\d+)%/)).filter(Boolean).map(m => [m[1], +m[2]]);
const top = vals.reduce((a, b) => b[1] > a[1] ? b : a), bot = vals.reduce((a, b) => b[1] < a[1] ? b : a);
check(top[1] <= 70, `no pokémon is a must-buy (top: ${top[0]} ${top[1]}%, under 70)`);
check(bot[1] >= 35, `no pokémon is dead weight (bottom: ${bot[0]} ${bot[1]}%, 35+)`);
const ra = r => +sv.match(new RegExp('avg ' + r + ' (\\d+)%'))[1];
check(Math.max(...roles.map(ra)) - Math.min(...roles.map(ra)) <= 12, `the four roles are within 12 points of each other (${roles.map(r => r + ' ' + ra(r)).join(', ')})`);

/* ---- UI ---- */
(async () => {
  const browser = await chromium.launch();
  for(const [w, h] of [[1200, 1000], [390, 844]]){
    const page = await (await browser.newContext({ viewport:{ width:w, height:h } })).newPage();
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    await page.goto('file:///mnt/user-data/outputs/pokebattler.html');
    await page.waitForTimeout(250);
    await page.evaluate(() => { G.pendingRewards = []; G.turn = 8; G.credits = 20;
      G.team = ['abra','clefairy','onix','machop'].map(i => makeUnit(i, 0)); rollShop(G, false); save(); render(); });
    await page.waitForTimeout(150);
    const badges = await page.$$eval('.formation .role', e => e.map(x => x.textContent));
    check(badges.length === 4, `${w}px: every party card wears its role badge (${badges.join(' ')})`);
    await page.click('[data-act="arrange"]'); await page.waitForTimeout(150);
    const ids = await page.evaluate(() => G.team.map(u => u.id).join());
    check(ids === 'onix,machop,clefairy,abra', `${w}px: Line up by role puts Tanks in front, Cannons at the back (${ids})`);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => /pok/i.test(k))) || '{}'));
    check(!saved.team || saved.team.map(u => u.id).join() === ids, `${w}px: the new order is saved`);
    const dc = await page.$$eval('.rchip', e => e.length);
    check(dc >= 1, `${w}px: the Daycare shows each pokémon's role`);
    const wide = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    check(wide, `${w}px: no sideways scrolling`);
    if(w > 1000){
      await page.click('[data-pop="team:0"]'); await page.waitForTimeout(250);
      const pop = await page.$eval('#inspect .poprole', e => e.textContent.replace(/\s+/g,' ').trim()).catch(() => '');
      check(/Tank · Bodyguard/.test(pop), `the summary explains the trait: "${pop.slice(0, 60)}…"`);
      await page.mouse.move(1, 1);
      await page.evaluate(() => openHelp && openHelp()).catch(() => {});
    }
    await page.close();
  }
  await browser.close();
  if(errors.length){ console.log('\n' + errors.length + ' FAILURES:'); errors.forEach(e => console.log('  - ' + e)); process.exit(1); }
  console.log('\nroles passed');
})();
