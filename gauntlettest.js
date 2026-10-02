/* The Elite Four gauntlet.
   Five fights in a row: damage carries, fainted pokémon sit out, the shops are
   shut, the PC is the bench, and a loss anywhere sends you back to Lorelei with
   the whole gauntlet counting as one attempt. Plus the scouting fix it depends
   on: a rematch fields exactly the team the report showed. */
const { chromium } = require('playwright');
const E = require('./engine.js');
const errors = [];
const check = (ok, m) => { if(!ok) errors.push(m); else console.log('… ' + m); };

const START = E.gauntletStart();
function strongGame(seed, boost){
  const G = E.newGame(seed); E.rollShop(G, false);
  G.stage = START; G.turn = 34; G.badges = 8; G.credits = 30;
  G.team = ['alakazam','gyarados','snorlax','machamp','arcanine','dragonite'].map(i => E.makeUnit(i, 0));
  for(const u of G.team){ u.hp += boost; u.atk += boost; u.spd += boost / 2; }
  return G;
}
/** Find a seed where Lorelei falls but costs the team something. */
function woundedAfterLorelei(){
  // strong enough to win, not so strong it wins clean — the gauntlet's pricing
  // makes Lorelei soft on purpose, so this is well below a late-game team
  for(let seed = 1; seed < 400; seed++){
    const G = strongGame(seed, 160);
    const opp = E.opponentFor(G), sim = E.stageBattle(G, opp);
    if(sim.result !== 'win') continue;
    const last = sim.steps[sim.steps.length - 1].p;
    if(last.length < G.team.length && last.some(c => c.hp < c.maxHp)) return { G, opp, sim };
  }
  return null;
}

/* ---------------- engine ---------------- */
const w = woundedAfterLorelei();
check(!!w, 'found a Lorelei win that fainted one pokémon and hurt another');
{
  const { G, opp, sim } = w;
  const before = {}; for(const u of G.team) before[u.uid] = E.effHp(u);
  const credits = G.credits, turn = G.turn;
  G.team[0].tmpAtk = 30;
  E.applyBattleResult(G, sim.result, opp, sim);
  E.nextTurn(G);

  check(E.inGauntlet(G), 'beating Lorelei starts the gauntlet');
  check(G.stage === START + 1, 'and moves on to Bruno');
  check(G.turn === turn, 'the clock does not move between fights');
  check(G.credits === credits, 'nobody is paid between fights');
  check(G.team[0].tmpAtk === 0, 'an X item still only lasts the one battle');

  // wounds are what the fight left, measured BEFORE EXP raised anyone's max
  const last = {}; for(const c of sim.steps[sim.steps.length - 1].p) last[c.uid] = c.hp;
  let exact = true, fainted = 0;
  for(const u of G.team){
    const want = last[u.uid] == null ? 0 : Math.min(1, last[u.uid] / before[u.uid]);
    if(Math.abs(E.hpFracOf(G, u) - want) > 1e-9) exact = false;
    if(E.hpFracOf(G, u) === 0) fainted++;
  }
  check(exact, 'every survivor keeps exactly the share of HP the fight left it');
  check(fainted > 0 && E.fightersOf(G).length === G.team.length - fainted,
    `${fainted} fainted pokémon sit out; ${E.fightersOf(G).length} can fight`);

  // the next fight starts them where they were
  const opp2 = E.opponentFor(G), sim2 = E.stageBattle(G, opp2);
  const open = sim2.steps[0].p;
  const hurt = G.team.find(u => { const f = E.hpFracOf(G, u); return f > 0 && f < 1; });
  const hurtOpen = open.find(c => c.uid === hurt.uid);
  check(hurtOpen && hurtOpen.hp === Math.max(1, Math.round(E.effHp(hurt) * E.hpFracOf(G, hurt))),
    `${hurt.nm} starts Bruno on ${hurtOpen && hurtOpen.hp} of ${E.effHp(hurt)} HP`);
  check(open.length === E.fightersOf(G).length && open.every(c => E.canFight(G, G.team.find(u => u.uid === c.uid))),
    'fainted pokémon are not in the fight');

  // the shops are shut, and the engine enforces it (so the bots obey too)
  const c0 = G.credits;
  check(!E.buyPokemon(G, 0, 0).ok && !E.buyToPc(G, 0).ok && !E.buyItem(G, 0, 0).ok &&
        !E.buyBattleItem(G, 0, 0).ok, 'nothing can be bought between fights');
  check(!E.rollMart(G, true) && !E.rollDaycare(G, true) && G.credits === c0, 'and nothing can be rerolled');

  // the PC is the bench: a stored pokémon comes in at full health
  const fresh = E.makeUnit('tauros', 0); fresh.hp += 300; fresh.atk += 300;
  G.pc.push(fresh);
  const deadSlot = G.team.findIndex(u => E.hpFracOf(G, u) === 0);
  check(E.pcToParty(G, G.pc.length - 1, deadSlot).ok && E.hpFracOf(G, G.team[deadSlot]) === 1,
    'a pokémon swapped in from the PC fights at full health');
  check(E.hpFracOf(G, G.pc[G.pc.length - 1]) === 0,
    'and the fainted one it replaced stays fainted on the bench');

  // lose at Bruno: back to Lorelei, healed, one attempt spent — not reset by beating Lorelei
  const attempt = G.attempt, lives = G.lives, money = G.credits;
  E.applyBattleResult(G, 'lose', opp2, sim2);
  check(G.stage === START, 'losing at Bruno sends you back to Lorelei');
  check(!E.inGauntlet(G) && G.team.every(u => E.hpFracOf(G, u) === 1), 'with everyone healed');
  check(G.attempt === attempt + 1, 'the whole gauntlet counted as one attempt');
  check(G.blackout === Math.floor(money * E.TUNING.blackoutPct), 'you black out like any boss');
  check(G.lives === lives, 'the first failure is free');

  // the rematch is the team you saw — for Lorelei, who you BEAT, as well as Bruno
  E.nextTurn(G);
  const lore = E.opponentFor(G).team.map(u => u.id).sort().join();
  const seen = G.scouted[E.stageOf(G).boss.id].map(u => u.id).sort().join();
  check(lore === seen, `Lorelei's rematch is the team you beat (${lore})`);
}

// lives: every failure after the free ones costs one, however far in you got
{
  const G = strongGame(5, 0);
  G.stage = START + 3;  G.gauntlet = { hpFrac: {} };
  const opp = E.opponentFor(G);
  const lives = G.lives;
  for(let i = 0; i < E.TUNING.freeAttempts + 1; i++){
    G.stage = START + 3; G.gauntlet = { hpFrac: {} };
    E.applyBattleResult(G, 'lose', opp);
  }
  check(G.lives === lives - 1, `${E.TUNING.freeAttempts} free gauntlet failures, then a life each`);
}

// resting on the bench: the hurt recover, the fainted don't, the party doesn't
{
  const G = strongGame(21, 0);
  G.stage = START + 1; G.gauntlet = { hpFrac: {} };
  const hurtBench = E.makeUnit('lapras', 0), downBench = E.makeUnit('tauros', 0), fullBench = E.makeUnit('seel', 0);
  G.pc = [hurtBench, downBench, fullBench];
  G.gauntlet.hpFrac[hurtBench.uid] = 0.40;
  G.gauntlet.hpFrac[downBench.uid] = 0;
  G.gauntlet.hpFrac[G.team[0].uid] = 0.40;
  E.nextTurn(G);                       // the interlude after a fight
  const r = E.TUNING.benchRest;
  check(Math.abs(E.hpFracOf(G, hurtBench) - (0.40 + r)) < 1e-9,
    `a hurt pokémon resting in the PC recovers ${r*100}% after the fight it sat out`);
  check(E.hpFracOf(G, downBench) === 0, 'a fainted one resting there stays down — rest heals, it does not revive');
  check(E.hpFracOf(G, G.team[0]) === 0.40, 'a pokémon in the party does not rest');
  check(E.hpFracOf(G, fullBench) === 1, 'and nothing heals past full');
  for(let i = 0; i < 5; i++) E.nextTurn(G);
  check(E.hpFracOf(G, hurtBench) === 1, 'enough rest brings it back to full, and no further');
}

// a draw mid-gauntlet keeps you there and still costs what it cost
{
  const G = strongGame(9, 0); G.stage = START + 2; G.gauntlet = { hpFrac: {} };
  const opp = E.opponentFor(G), sim = E.stageBattle(G, opp);
  E.applyBattleResult(G, 'draw', opp, sim);
  check(G.stage === START + 2 && E.inGauntlet(G), 'a draw leaves you at the same member, still in the gauntlet');
}

// the Champion ends it
{
  const G = strongGame(3, 0); G.redFlag = null; G.stage = START + 4; G.gauntlet = { hpFrac: {} };
  E.applyBattleResult(G, 'win', E.opponentFor(G));
  check(G.over === 'won' && !E.inGauntlet(G), 'beating the Champion wins the run');
}

// the scouting fix, at a gym: 60 blackouts, 60 truthful reports
{
  let stale = 0;
  for(let s = 1; s <= 60; s++){
    const G = E.newGame(s); E.rollShop(G, false);
    G.stage = 3 * (E.TUNING.battlesPerBadge + 1) - 1; G.turn = 8 + s % 5; G.badges = 2;
    const opp = E.opponentFor(G);
    E.applyBattleResult(G, 'lose', opp); E.nextTurn(G);
    const a = G.scouted[opp.boss.id].map(u => u.id + (u.held || '')).sort().join();
    const b = E.opponentFor(G).team.map(u => u.id + (u.held || '')).sort().join();
    if(a !== b) stale++;
  }
  check(stale === 0, 'a gym rematch fields exactly the team the scouting report showed (60/60)');
}

/* ---------------- browser ---------------- */
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 1100 } });
  ctx.setDefaultTimeout(8000);
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html');
  await page.waitForTimeout(250);

  const setup = async (stageOff, gauntlet) => page.evaluate(([off, gt]) => {
    localStorage.setItem('pkb_speed', '4');
    G.seed = 4242; G.stage = gauntletStart() + off; G.badges = 8; G.turn = 34; G.credits = 30;
    G.team = ['alakazam','gyarados','snorlax','machamp','arcanine','dragonite'].map(i => makeUnit(i, 0));
    for(const u of G.team){ u.hp += 400; u.atk += 400; u.spd += 200; }
    G.pc = []; G.gauntlet = gt ? { hpFrac: {} } : null;
    rollShop(G, false); save(); render();
  }, [stageOff, gauntlet]);

  // the turn before Lorelei says it is the last shop
  await setup(0, false);
  const warn = await page.$eval('.nextup .nrule', e => e.textContent.replace(/\s+/g, ' ').trim()).catch(() => '');
  check(/Last chance to shop/.test(warn) && /damage carries over/.test(warn),
    'the turn before Lorelei warns that it is the last shop');
  check(await page.$('.stat.next') !== null, 'and still shows next turn\'s pay');

  // beat Lorelei: the result screen says what comes next
  await page.reload(); await page.waitForTimeout(250);
  await setup(0, false);
  await page.click('[data-act="endturn"]');
  await page.waitForTimeout(250);
  const tag = await page.$eval('.bosstag', e => e.textContent.replace(/\s+/g, ' ').trim()).catch(() => '');
  check(/fight 1 of 5/.test(tag), `the fight is labelled "${tag}"`);
  await page.click('[data-act="skip"]'); await page.waitForTimeout(300);
  const big = await page.$eval('.big', e => e.textContent.trim()).catch(() => '');
  const note = await page.$eval('.gnote', e => e.textContent.replace(/\s+/g, ' ').trim()).catch(() => '');
  check(/LORELEI FALLS/.test(big) && /Next: Bruno/.test(note) && /nobody heals/.test(note),
    `the win reads "${big}" — "${note}"`);

  // continue into the interlude
  await page.click('[data-act="afterbattle"]'); await page.waitForTimeout(300);
  const inter = await page.evaluate(() => ({
    running: inGauntlet(G), stage: G.stage - gauntletStart(),
    closed: document.querySelectorAll('.closed').length,
    rerolls: [...document.querySelectorAll('[data-act="rolldc"],[data-act="rollmart"]')].every(b => b.disabled),
    pay: document.querySelectorAll('.stat.next').length,
    down: [...document.querySelectorAll('.gmem.down b')].map(e => e.textContent),
    now: (document.querySelector('.gmem.now b') || {}).textContent,
    cta: document.querySelector('[data-act="endturn"]').textContent.trim(),
  }));
  check(inter.running && inter.stage === 1, 'Continue lands between fights, facing Bruno');
  check(inter.closed === 2 && inter.rerolls, 'the Daycare and the Mart are shut, rerolls disabled');
  check(inter.pay === 0, 'no "next turn" pay is promised between fights');
  check(inter.down.join() === 'Lorelei' && inter.now === 'Bruno', 'the strip shows Lorelei down and Bruno next');
  check(/Challenge Bruno/.test(inter.cta), `the button reads "${inter.cta}"`);

  // wounds and faints are visible, on the card and in the summary
  await page.evaluate(() => {
    G.gauntlet.hpFrac[G.team[0].uid] = 0;
    G.gauntlet.hpFrac[G.team[1].uid] = 0.3;
    save(); render();
  });
  await page.waitForTimeout(200);
  const cards = await page.evaluate(() => ({
    fainted: document.querySelectorAll('.formation .unit.fainted').length,
    bars: document.querySelectorAll('.formation .unit .hpbar').length,
  }));
  check(cards.fainted === 1 && cards.bars >= 1, 'a fainted pokémon is greyed out and a hurt one shows its HP');
  await page.click('[data-pop="team:1"]'); await page.waitForTimeout(250);
  const wound = await page.$eval('#inspect .popwound', e => e.textContent.trim()).catch(() => '');
  check(/HP — carried from the last fight/.test(wound), `its summary says "${wound}"`);
  await page.keyboard.press('Escape');   // v43: the tap picked it up — put it down

  // nobody able to fight: the button says what to do instead
  await page.evaluate(() => { for(const u of G.team) G.gauntlet.hpFrac[u.uid] = 0; save(); render(); });
  await page.waitForTimeout(200);
  const stuck = await page.$eval('[data-act="endturn"]', b => ({ off: b.disabled, t: b.textContent.trim() }));
  check(stuck.off && /swap someone in from the PC/.test(stuck.t), `with everyone down the button reads "${stuck.t}"`);

  // …and swapping a fresh pokémon in from the PC fixes it
  await page.evaluate(() => { G.pc = [makeUnit('lapras', 0)]; save(); render(); });
  await page.waitForTimeout(150);
  await page.click('[data-act="pc"][data-i="0"]'); await page.waitForTimeout(120);
  await page.click('.formation [data-act="team"][data-i="0"]'); await page.waitForTimeout(200);
  const after = await page.evaluate(() => ({
    id: G.team[0].id, frac: hpFracOf(G, G.team[0]),
    ok: !document.querySelector('[data-act="endturn"]').disabled }));
  check(after.id === 'lapras' && after.frac === 1 && after.ok, 'a fresh pokémon from the PC puts you back in the fight');

  // a save from before the gauntlet, parked at Agatha, must load INTO the gauntlet
  await page.evaluate(() => {
    const old = JSON.parse(JSON.stringify(G));
    delete old.gauntlet;
    old.stage = gauntletStart() + 2;
    localStorage.setItem('pokebattler.save.v3', JSON.stringify({ G: old, phase: 'shop' }));
  });
  await page.reload(); await page.waitForTimeout(300);
  const mig = await page.evaluate(() => ({
    running: inGauntlet(G), at: G.stage - gauntletStart(),
    rule: (document.querySelector('.nextup .nrule') || {}).textContent || '' }));
  check(mig.running && mig.at === 2 && /Fight 3 of 5/.test(mig.rule) && !/Last chance/.test(mig.rule),
    'an old save parked at Agatha loads into the gauntlet at fight 3, not a "last chance" turn');

  // phone width
  await page.setViewportSize({ width: 390, height: 860 }); await page.waitForTimeout(250);
  const over = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check(!over, 'the interlude fits a phone without sideways scrolling');

  await browser.close();
  if(errors.length){
    console.log('\n' + errors.length + ' FAILURES:');
    [...new Set(errors)].forEach(e => console.log('  - ' + e));
    process.exit(1);
  }
  console.log('\ngauntlet passed');
})();
