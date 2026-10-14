/* Trainer EXP: the trainer banks it, and anything you acquire arrives at that
   level. The thing that must never break is that the Daycare shows the stats
   you will actually receive — a shop that advertises one number and sells
   another is worse than the problem this replaced. */
const { chromium } = require('playwright');
const E = require('./engine.js');
const errors = [];
const check = (ok, m) => { if(!ok) errors.push(m); else console.log('… ' + m); };

/* ---------- engine ---------- */
check(E.TUNING.expModel === 'trainer', 'the engine banks EXP on the trainer');

const G = E.newGame(11);
E.rollShop(G, false);
check(G.trainerExp && G.trainerExp.hp === 0, 'a new run starts with an empty bank');

const g = E.TUNING.expGainWin;
for(let i = 0; i < 12; i++) E.grantBattleExp(G, 'win');
check(G.trainerExp.hp === g.hp * 12 && G.trainerExp.atk === g.atk * 12,
  `twelve wins bank +${g.hp*12} HP / +${g.atk*12} Attack`);

/* the shelf must show what it sells */
E.rollDaycare(G, false);
const shown = { ...G.daycare[0].unit };
E.buyPokemon(G, 0, 0);
const got = G.team[0];
check(got.hp === shown.hp && got.atk === shown.atk && got.spd === shown.spd,
  'the Daycare sells exactly the pokémon it displayed');

/* and it must be worth the same as a veteran of the same species */
const vet = E.makeUnit(got.id, 0);
// v28: both grow along the species' role; the bank is paid in one go, the veteran
// battle by battle, so fractional carry can differ by a point
for(let i = 0; i < 12; i++) E.growUnit(vet, g);
check(Math.abs(E.unitPower(vet) - E.unitPower(got)) <= 2,
  `a turn-12 buy matches a veteran of the same species (${Math.round(E.unitPower(got))} vs ${Math.round(E.unitPower(vet))})`);

/* the PC gets the same deal */
E.rollDaycare(G, false);
const pcShown = { ...G.daycare[0].unit };
G.credits = 20;
E.buyToPc(G, 0);
check(G.pc[0].atk === pcShown.atk, 'a pokémon bought into the PC arrives at the same level');

/* nothing may leak onto the opponent */
const opp = E.opponentFor(G);
const bare = E.makeUnit(opp.team[0].id, 0);
check(opp.team.every(u => u.hp > 0), 'the opponent still builds a team');
check(E.trainerCatchUp({ trainerExp: null }, bare) === bare, 'no bank, no bonus');

/* 'unit' mode must still behave exactly as before */
E.TUNING.expModel = 'unit';
const H = E.newGame(12); E.rollShop(H, false);
for(let i = 0; i < 12; i++) E.grantBattleExp(H, 'win');
E.rollDaycare(H, false);
const plain = H.daycare[0].unit, base = E.SPECIES[plain.id];
check(plain.hp === base.hp && plain.atk === base.atk,
  "'unit' mode still sells pokémon at their base stats");
E.TUNING.expModel = 'trainer';

/* ---------- browser ---------- */
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport:{width:1200,height:1000} })).newPage();
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto(require('./pkbpaths').PAGE);
  await page.waitForTimeout(250);

  await page.evaluate(() => {
    G.turn = 20; G.credits = 40;
    G.trainerExp = { hp: 40, atk: 40, spd: 20 };
    G.team = [makeUnit('onix',0)];
    rollDaycare(G, false); save(); render();
  });
  await page.waitForTimeout(200);

  const sub = await page.$eval('.panel h2 .sub', () => null).catch(()=>null);
  const dcHead = await page.$$eval('.panel h2', els =>
    els.map(e => e.textContent.replace(/\s+/g,' ').trim()).find(t => /Daycare/.test(t)));
  if(!/arrives at your level/.test(dcHead || ''))
    errors.push('the Daycare does not say pokémon arrive at your level: ' + dcHead);
  else console.log('… the Daycare header explains the rule: "' + dcHead + '"');

  // the numbers on the row are the caught-up ones, not the species' base stats
  const row = await page.evaluate(() => {
    const u = G.daycare[0].unit;
    const txt = document.querySelector('.drow .dnums').textContent.replace(/\s+/g,'');
    return { txt, atk:u.atk, base: SPECIES[u.id].atk };
  });
  if(!row.txt.includes(String(row.atk)))
    errors.push(`the Daycare row shows ${row.txt}, not the unit's ${row.atk}`);
  else if(row.atk <= row.base)
    errors.push('the shelf is not showing a caught-up pokémon');
  else console.log(`… the row shows ${row.txt} — caught up from a base of ${row.base}`);

  // and buying it hands over that exact pokémon
  const same = await page.evaluate(() => {
    const before = { ...G.daycare[0].unit };
    buyPokemon(G, 0, G.team.length);
    const after = G.team[G.team.length - 1];
    return before.hp === after.hp && before.atk === after.atk && before.spd === after.spd;
  });
  check(same, 'buying it in the browser hands over that exact pokémon');

  /* A save from the version before trainer EXP must not load into a run that
     banks from zero on turn 20 — its buys would be runts for the rest of it. */
  await page.evaluate(() => {
    const old = JSON.parse(JSON.stringify(G));
    delete old.trainerExp;
    old.turn = 20;
    old.team = [makeUnit('alakazam',0), makeUnit('onix',0)];
    old.daycare = [{ unit: makeUnit('pidgey',0), bought:false }];
    localStorage.setItem('pokebattler.save.v3', JSON.stringify({ G: old, phase:'shop' }));
  });
  await page.reload();
  await page.waitForTimeout(300);
  const mig = await page.evaluate(() => ({
    bank: G.trainerExp, turn: G.turn,
    pidgeyAtk: G.daycare[0] && G.daycare[0].unit.atk, base: SPECIES.pidgey.atk,
    per: TUNING.expGainWin.atk }));
  check(mig.bank && mig.bank.atk === mig.per * (mig.turn - 1),
    `an old turn-20 save gets a back-filled bank (+${mig.bank && mig.bank.atk} Attack)`);
  check(mig.pidgeyAtk === mig.base + mig.bank.atk,
    'and the shelf it was looking at is brought up to that level');

  await browser.close();
  if(errors.length){
    console.log('\n' + errors.length + ' FAILURES:');
    [...new Set(errors)].forEach(e => console.log('  - ' + e));
    process.exit(1);
  }
  console.log('\ntrainer EXP passed');
})();
