const E = require('./engine.js');
const grownBy = (u, d) => E.growUnit(JSON.parse(JSON.stringify(u)), d);
let fails = [];
const check = (cond, msg) => { if(!cond) fails.push(msg); };
const txt = st => (st.lines||[]).join(' ');

/* ---- 1. every move fires at every level without crashing ---- */
for(const id of Object.keys(E.SPECIES)){
  const sp = E.SPECIES[id];
  check(!!sp.move, `${id}: no move`);
  check(typeof sp.move.text === 'function', `${id}: move has no text()`);
  check(!!E.TYPES[sp.type], `${id}: unknown type ${sp.type}`);
  check(sp.hp > 0 && sp.atk >= 0 && sp.spd > 0, `${id}: bad base stats`);
  check(sp.legendary ? sp.tier === undefined : sp.tier >= 1 && sp.tier <= 6, `${id}: tier out of range`);   // 2.1.0: legendaries have no tier
  for(const l of [1,2,3]){ try{ sp.move.text(l); }catch(e){ fails.push(`${id}: text(${l}) threw ${e.message}`); } }

  for(const exp of [0,2,5]){
    const mine   = [E.makeUnit(id, exp), E.makeUnit('caterpie',0), E.makeUnit('onix',0)];
    const theirs = [E.makeUnit('geodude',0), E.makeUnit('pikachu',0), E.makeUnit('gastly',0), E.makeUnit('lapras',0)];
    try{
      const r = E.simulateBattle(mine, theirs, 42 + exp);
      check(['win','lose','draw'].includes(r.result), `${id}: bad result`);
      check(r.steps.length > 0, `${id}: no steps`);
      for(const s of r.steps) for(const u of s.p.concat(s.e)){
        check(Number.isFinite(u.hp) && Number.isFinite(u.atk) && Number.isFinite(u.spd), `${id}: NaN stat`);
        check(u.hp >= 0 && u.atk >= 0 && u.spd >= 0, `${id}: negative displayed stat`);
        check(u.hp <= u.maxHp, `${id}: hp above maxHp`);
      }
    }catch(e){ fails.push(`${id} exp${exp}: battle threw ${e.message}\n${e.stack}`); }
  }
}

/* ---- 2. evolution data is coherent ---- */
/* 4.0.0: checked once per mix of gens, over the species that mix can meet. Two exceptions
   the Gen 2 pack brings: a baby evolves into a Gen 1 pokémon that is still sold on its own
   (Pichu → Pikachu), and Hitmontop is sold like its brothers though Tyrogue can become it.
   A Gen 2 evolution of a Gen 1 pokémon may change type (Onix → Steelix), as in the games. */
for(const gens of [[1], [2], [1, 2]]){
  E.setActiveGens(gens);
  const ids = Object.keys(E.SPECIES).filter(k => E.inGens(k));
  const targets = {};
  for(const id of ids) for(const evo of E.evoNext(id)){   // 1.3.0: every branch (Eevee)
    const branching = E.evoNext(id).length > 1;
    check(!!E.SPECIES[evo.into], `${id}: evolves into unknown ${evo.into}`);
    const babyOrTop = (E.genOf(id) > E.genOf(evo.into)) || evo.into === 'hitmontop';
    check(E.SPECIES[evo.into].token === true || babyOrTop, `${evo.into} is an evolution but is still buyable`);
    check(['level','stone'].includes(evo.by), `${id}: bad evolution method ${evo.by}`);
    if(evo.by === 'stone') check(!!E.ITEMS[evo.stone], `${id}: unknown stone ${evo.stone}`);
    check(!targets[evo.into], `${evo.into} is the target of two evolutions`);
    targets[evo.into] = id;
    // an evolution should be a stat upgrade
    const a = E.SPECIES[id], b = E.SPECIES[evo.into];
    check(b.hp + b.atk + b.spd > a.hp + a.atk + a.spd, `${evo.into} is not stronger than ${id}`);
    check(a.type === b.type || branching || evo.gen2, `${id} changes type when it evolves into ${evo.into}`);
  }
  // every token is somebody's evolution — no orphans nobody can ever get
  for(const id of ids){
    if(E.SPECIES[id].token) check(!!targets[id], `${id} is a token but nothing evolves into it (gens ${gens})`);
  }
  // no cycles: evoLine terminates and starts at a buyable
  for(const id of ids){
    const line = E.evoLine(id);
    check(line.length <= 3, `${id}: evolution line longer than 3 (${line.join('→')})`);
    check(line.includes(id), `${id}: not in its own line`);
    check(!E.SPECIES[line[0]].token, `${id}: line starts at a token (${line[0]})`);
  }
}
E.setActiveGens([1]);

/* ---- 3. levelling evolves, or gives the bigger bonus ---- */
{
  const G = E.newGame(1);
  // a three-stage line evolves twice
  const c = E.makeUnit('caterpie',0); G.team=[c];
  E.addExp(G, c, 2); check(c.id === 'metapod', 'caterpie should evolve at level 2, got ' + c.id);
  E.addExp(G, c, 3); check(c.id === 'butterfree', 'metapod should evolve at level 3, got ' + c.id);
  check(c.hp > E.SPECIES.butterfree.hp, 'evolution should keep accumulated stats on top of the new base');

  // a two-stage line evolves once, then takes the flat bonus
  const r = E.makeUnit('rattata',0); G.team=[r];
  E.addExp(G, r, 2); check(r.id === 'raticate', 'rattata should evolve at level 2');
  const before = JSON.parse(JSON.stringify(r));
  E.addExp(G, r, 3);
  check(r.id === 'raticate', 'raticate has nowhere to go and should stay put');
  check(r.hp === grownBy(before, E.TUNING.levelUpBonusMax).hp, 'final forms should take the larger bonus (split by role)');

  // a non-evolver never changes species and always takes the larger bonus
  const o = E.makeUnit('onix',0); G.team=[o];
  const o0 = JSON.parse(JSON.stringify(o));
  E.addExp(G, o, 5);
  check(o.id === 'onix', 'onix should never evolve');
  check(o.hp === grownBy(grownBy(o0, E.TUNING.levelUpBonusMax), E.TUNING.levelUpBonusMax).hp, 'onix should take the larger bonus twice');

  // a stone line does NOT evolve by levelling
  const p = E.makeUnit('pikachu',0); G.team=[p];
  E.addExp(G, p, 5);
  check(p.id === 'pikachu', 'pikachu must wait for a thunder stone, got ' + p.id);
  check(E.canUseItem('thunderstone', p) === true, 'thunder stone should apply to pikachu');
  check(E.canUseItem('firestone', p) === false, 'fire stone should not apply to pikachu');
  const atkBefore = p.atk;
  E.evolveUnit(G, p);
  check(p.id === 'raichu', 'the stone should evolve pikachu');
  check(p.atk === atkBefore + (E.SPECIES.raichu.atk - E.SPECIES.pikachu.atk), 'stone evolution should carry stats');
  check(E.canUseItem('thunderstone', p) === false, 'raichu cannot evolve again');
}

/* ---- 3b. HP-granting moves are capped per battle ---- */
{
  const T = E.TUNING;
  // two pure walls must terminate, and neither may run away with HP
  const r = E.simulateBattle(
    [E.makeUnit('onix',5), E.makeUnit('metapod',5)],
    [E.makeUnit('onix',5), E.makeUnit('squirtle',5)], 1);
  check(r.rounds <= T.maxBattleRounds, 'a wall mirror must still terminate');
  let peak = 0, startMax = {};
  r.steps[0].p.concat(r.steps[0].e).forEach(u => { startMax[u.uid] = u.maxHp; });
  for(const s of r.steps) for(const u of s.p.concat(s.e)){
    const cap = startMax[u.uid] * (1 + T.moveGuardCap.hpPct);
    check(u.maxHp <= cap + 0.5, `${u.nm} blew past the move HP cap: ${u.maxHp} > ${cap}`);
    peak = Math.max(peak, u.maxHp);
  }
  check(peak < 200, 'wall HP should stay bounded, peaked at ' + peak);

  // the cap is measured off the pokémon's own HP, so item/EXP health raises it
  const grow = hpBonus => {
    const u = E.makeUnit('metapod', 0); u.hp += hpBonus;       // as if HP Up had been used
    const rr = E.simulateBattle([u], [E.makeUnit('machop',0)], 2);
    return Math.max(...rr.steps.map(s => s.p[0] ? s.p[0].maxHp : 0));
  };
  const plain = grow(0), fed = grow(40);
  check(fed > plain, 'item health should raise the cap, not be limited by it');
  check(Math.abs(fed - (E.SPECIES.metapod.hp + 40) * (1 + T.moveGuardCap.hpPct)) <= 1,
        `the fed cap should track the bigger HP pool, got ${fed}`);

  // damage reduction is capped too — that is the actual stalemate lever
  const deep = E.simulateBattle([E.makeUnit('onix',5)], [E.makeUnit('snorlax',0)], 4);
  check(deep.rounds <= T.maxBattleRounds, 'guard stacking must not outlast the round cap silently');

  // healing moves still cannot exceed max HP
  const drain = E.simulateBattle([E.makeUnit('bulbasaur',0)], [E.makeUnit('geodude',0)], 6);
  for(const s of drain.steps) for(const u of s.p) check(u.hp <= u.maxHp, 'drain healed past max HP');
}

/* ---- 3c. every pokémon has one main Gen 1 type (3.0.0: Normal/Flying counts as Flying) ---- */
{
  for(const id of Object.keys(E.SPECIES)){
    const sp = E.SPECIES[id];
    check(!!sp.gen1, `${id}: no gen1 typing recorded`);
    if(!sp.gen1) continue;
    check(E.singleTypeOf(sp.gen1) === sp.type, `${sp.name} (${sp.gen1}) is ${sp.type} but the rule gives ${E.singleTypeOf(sp.gen1)}`);
    check(!!E.TYPES[sp.type], `${sp.name}: ${sp.type} is not in the chart`);
  }
  check(E.singleTypeOf('Normal/Flying') === 'Flying' && E.singleTypeOf('Grass/Poison') === 'Grass' && E.singleTypeOf('Normal') === 'Normal', 'single-type rule');
}

/* ---- 4. the type chart (3.0.0: modern chart without Dark/Steel/Fairy, immunities become resists) ---- */
{
  const ts = Object.keys(E.TYPES);
  check(ts.length === 17, 'seventeen types (Poison added in 3.1.0, Steel and Dark in 4.0.0)');
  check(!ts.includes('Lightning') && !ts.includes('Colorless') && ts.includes('Electric'), 'Electric replaces Lightning, no Colorless');
  for(const t of ts) for(const u of ts){
    const m = E.typeMult(t, u);
    check(m === 2 || m === 1 || m === 0.5, `${t} vs ${u} is ${m}`);
    check((m === 2) === E.TYPES[u].weak.includes(t) && (m === 0.5) === E.TYPES[u].resist.includes(t), `${u} lists ${t} consistently`);
  }
  const mult = (a, d, x) => check(E.typeMult(a, d) === x, `${a} vs ${d} should be ×${x}`);
  mult('Water','Fire',2); mult('Fire','Grass',2); mult('Grass','Water',2); mult('Electric','Water',2); mult('Electric','Flying',2);
  mult('Ground','Electric',2); mult('Ice','Dragon',2); mult('Bug','Psychic',2); mult('Ghost','Psychic',2); mult('Fighting','Normal',2); mult('Rock','Fire',2);
  mult('Fire','Water',0.5); mult('Normal','Ghost',0.5); mult('Ghost','Normal',0.5); mult('Electric','Ground',0.5); mult('Ground','Flying',0.5); mult('Psychic','Psychic',0.5);
  mult('Fire','Fire',0.5); mult('Dragon','Dragon',2); mult('Normal','Normal',1); mult('Normal','Rock',0.5);
}

/* ---- 5. speed order and front-line targeting ---- */
{
  const fast = E.makeUnit('mewtwo',0), slow = E.makeUnit('snorlax',0);
  const first = r => txt(r.steps.find(s => / used /.test(txt(s))));
  check(/^Mewtwo used/.test(first(E.simulateBattle([fast],[slow],11))), 'faster should act first');
  check(/^Mewtwo used/.test(first(E.simulateBattle([slow],[fast],11))), 'speed order must not depend on side');

  const mine = [E.makeUnit('snorlax',0), E.makeUnit('machop',0), E.makeUnit('machop',0)];
  const theirs = [E.makeUnit('onix',0), E.makeUnit('onix',0)];
  const r = E.simulateBattle(mine, theirs, 3);
  const acted = new Set(r.steps.filter(s=>/ used /.test(txt(s))).map(s=>s.lines[0].split(' used ')[0]));
  check(acted.has('Machop'), 'back-rank pokémon should take turns');

  // only the front RANK may be damaged while it stands
  const W = E.TUNING.rankWidth;
  // every attacker here targets the front rank — no snipers, no sweepers,
  // so anything behind the front rank being hurt is a real bug
  const deep = E.simulateBattle(
    ['machop','vulpix','electabuzz','tauros','snorlax','hitmonlee'].map(i=>E.makeUnit(i,0)),
    ['golem','machamp','onix','geodude','machop','machoke'].map(i=>E.makeUnit(i,0)), 12);
  const start = {}; deep.steps[0].e.forEach(u => start[u.uid] = u.maxHp);
  const frontUids = deep.steps[0].e.slice(0, W).map(u => u.uid);
  for(const st of deep.steps){
    if(st.e.length < 6) break;                 // stop once the line has shifted
    for(const u of st.e.slice(W)) check(u.hp === start[u.uid],
      `${u.nm} is behind the front rank and should be untouched`);
  }
  check(frontUids.every(uid => {
    const last = deep.steps[deep.steps.length-1];
    const still = last.e.find(u => u.uid === uid);
    return !still || still.hp < start[uid];
  }), 'both front-rank pokémon should be taking hits, not just one');

  // a wider front line really does split the damage
  const spread = {};
  for(const st of deep.steps) for(const line of (st.lines||[])){
    const m = line.match(/^(\w+) took (\d+)/);
    if(m) spread[m[1]] = (spread[m[1]] || 0) + 1;
  }
  const frontNames = deep.steps[0].e.slice(0, W).map(u => u.nm);
  check(frontNames.every(n => spread[n] > 0),
        'each front-rank pokémon should get hit at least once: ' + JSON.stringify(spread));

  // rank maths: slots 1-2 front, 3-4 middle, 5-6 back
  check(E.TUNING.rankWidth === 2, 'the formation should be two abreast');
  check(E.TUNING.rankNames.length === 3, 'three ranks');
  check(E.TUNING.maxTeam === E.TUNING.rankWidth * E.TUNING.rankNames.length,
        'the party should exactly fill the formation grid');
}

/* ---- 5b. the action meter: speed IS the rate you act at ---- */
{
  const lines = r => r.steps.flatMap(st => st.lines || []);
  const actsBy = (r, nm) => lines(r).filter(l => l.startsWith(nm + ' used')).length;
  // two punchbags so the fight runs long enough to count actions
  const duel = (spdA, spdB) => {
    const a = E.makeUnit('rattata', 0), b = E.makeUnit('pidgey', 0);
    a.hp = b.hp = 600; a.atk = b.atk = 2; a.spd = spdA; b.spd = spdB;
    return [[a], [b]];
  };

  const even = E.simulateBattle(...duel(40, 40), 5);
  const eA = actsBy(even, 'Rattata'), eB = actsBy(even, 'Pidgey');
  check(Math.abs(eA - eB) <= 1, `equal speed, equal actions (${eA} v ${eB})`);

  /* The whole point of graduating from the old system: the ratio of actions is
     the ratio of speeds, at every value, with no threshold and no ceiling. */
  for(const [fast, slow, want] of [[80, 40, 2], [120, 40, 3], [90, 30, 3], [50, 40, 1.25]]){
    const r = E.simulateBattle(...duel(fast, slow), 5);
    const got = actsBy(r, 'Rattata') / Math.max(1, actsBy(r, 'Pidgey'));
    check(Math.abs(got - want) / want < 0.12,
          `${fast} vs ${slow} speed should act ${want}× as often, got ${got.toFixed(2)}×`);
  }

  // a slow pokémon still gets to act — it is rarer, not excluded
  const slowOne = E.simulateBattle(...duel(10, 90), 5);
  check(actsBy(slowOne, 'Rattata') > 0, 'even a very slow pokémon acts');

  // deterministic, because the whole replay depends on it
  const again = E.simulateBattle(...duel(80, 40), 5);
  check(actsBy(again, 'Rattata') === actsBy(E.simulateBattle(...duel(80, 40), 5), 'Rattata'),
        'the action meter is deterministic for a given seed');

  // the battle always terminates, however lopsided the speeds
  const silly = E.simulateBattle(...duel(400, 5), 5);
  check(silly.actions <= E.TUNING.maxBattleActions, 'the action cap holds');
  check(silly.rounds <= E.TUNING.maxBattleRounds, 'the round-time cap holds');

  /* Upkeep is on the clock, not the turn count, so Leftovers means the same
     thing whether the field is fast or slow. */
  const leftovers = (spd) => {
    // Rattata actually swings; Onix just Hardens, so nobody would take damage
    const a = E.makeUnit('rattata', 0), b = E.makeUnit('rattata', 0);
    a.hp = b.hp = 400; a.atk = b.atk = 6; a.spd = b.spd = spd; a.held = 'lefto';
    return lines(E.simulateBattle([a], [b], 9)).filter(l => /Leftovers/.test(l)).length;
  };
  const slowTick = leftovers(20), fastTick = leftovers(80);
  check(slowTick > 0 && fastTick > 0, 'Leftovers ticks at any speed');
  check(Math.abs(slowTick - fastTick) <= Math.max(2, slowTick * 0.35),
        `upkeep runs on the clock, not the turn count (${slowTick} v ${fastTick})`);

  // and the battle tells the UI who is queued up next
  const withQueue = E.simulateBattle(...duel(80, 40), 5);
  const queued = withQueue.steps.filter(st => Array.isArray(st.up) && st.up.length);
  check(queued.length > 0, 'steps carry the upcoming turn order');
  check(queued[0].up.length <= 6, 'and not more of it than the screen shows');
}

/* ---- 5c. the stat scales line up ---- */
{
  const mean = a => a.reduce((x,y)=>x+y,0) / a.length;
  const hp  = mean(E.BUYABLE.map(k => E.SPECIES[k].hp));
  const atk = mean(E.BUYABLE.map(k => E.SPECIES[k].atk));
  const spd = mean(E.BUYABLE.map(k => E.SPECIES[k].spd));
  check(Math.abs(hp - atk) / hp < 0.2,
        `HP and Attack sit on the same scale (${hp.toFixed(0)} vs ${atk.toFixed(0)})`);
  check(spd > atk && spd < atk * 3,
        `Speed is wider but not absurd (${spd.toFixed(0)})`);

  /* The power score is only meaningful while a point of each stat is worth
     about the same — that is what the near-1:1:1 weights encode. Measured in
     statvalue.js; asserted here so nobody quietly rescales one stat alone. */
  const a = E.makeUnit('rattata', 0), b = E.makeUnit('rattata', 0);
  b.hp += 10;
  const byHp = E.unitPower(b) - E.unitPower(a);
  const c = E.makeUnit('rattata', 0); c.atk += 10;
  const byAtk = E.unitPower(c) - E.unitPower(a);
  const d = E.makeUnit('rattata', 0); d.spd += 10;
  const bySpd = E.unitPower(d) - E.unitPower(a);
  check(Math.abs(byHp - byAtk) < 1, 'the power score values HP and Attack alike');
  check(Math.abs(bySpd - byHp * E.TUNING.spdPower) < 1,
        'and weights Speed by the measured factor, not a guess');

  // damage is anchored to the attack scale, so a rescale cannot silently
  // double every hit in the game
  const hitter = E.makeUnit('charmander', 0), sack = E.makeUnit('caterpie', 0);
  hitter.hp = sack.hp = 500;
  const dmg = E.simulateBattle([hitter], [sack], 3).steps
    .flatMap(st => st.lines || []).map(l => /^Caterpie took (\d+)/.exec(l))
    .filter(Boolean).map(m => +m[1])[0];
  const want = Math.round(E.SPECIES.charmander.atk * E.TUNING.atkPerDamage * 1.3 * E.TUNING.weakMult);
  check(dmg === want, `Ember lands for ${want} as the numbers say, not ${dmg}`);
}

/* ---- 6. edge cases ---- */
try{
  check(E.simulateBattle([], [E.makeUnit('pidgey',0)], 1).result === 'lose', 'empty player loses');
  check(E.simulateBattle([E.makeUnit('pidgey',0)], [], 1).result === 'win', 'empty enemy wins');
  check(E.simulateBattle([], [], 1).result === 'draw', 'both empty draws');
  const stall = E.simulateBattle([E.makeUnit('magikarp',0)], [E.makeUnit('onix',0)], 2);
  check(stall.rounds <= E.TUNING.maxBattleRounds, 'round cap holds');
}catch(e){ fails.push('edge battle threw ' + e.message); }

/* ---- 7. party of six ---- */
{
  check(E.TUNING.maxTeam === 6, 'party should be six');
  const G = E.newGame(3); G.credits = 999; E.rollShop(G, false);
  const ids = ['onix','scyther','lapras','tauros','snorlax','zapdos','mewtwo'];
  for(let i=0;i<ids.length;i++){
    G.daycare[0] = { unit: E.makeUnit(ids[i],0), bought:false };
    const r = E.buyPokemon(G, 0, G.team.length);
    if(i < 6) check(r.ok, `should fit pokémon ${i+1} in the party`);
    else check(!r.ok && /full/.test(r.why), 'the seventh should be refused');
  }
  check(G.team.length === 6, 'party should hold exactly six');
  const six = G.team.map(u=>E.makeUnit(u.id,0));
  const r = E.simulateBattle(six, six.map(u=>E.makeUnit(u.id,0)), 8);
  check(r.steps.length > 0, 'a 6v6 should simulate');
}

/* ---- 8. the two shops are separate ---- */
{
  const G = E.newGame(2); G.turn = 6; G.badges = 3; G.team = [E.makeUnit('machop',0)];
  E.rollShop(G, false);
  check(G.daycare.length === E.daycareSlotsFor(E.tierFor(G)), 'daycare slot count');
  check(G.mart.length === E.martSlotsFor(E.tierFor(G)) + E.heldSlotsFor(E.tierFor(G)),
        'mart slot count: medicine plus the held shelf');
  G.credits = 10;
  const marks = G.mart.map(s=>s.id).join(',');
  E.rollDaycare(G, true);
  check(G.mart.map(s=>s.id).join(',') === marks, 'rerolling the daycare must not touch the mart');
  check(G.credits === 9, 'daycare reroll costs 1');
  const dc = G.daycare.map(s=>s.unit.uid).join(',');
  E.rollMart(G, true);
  check(G.daycare.map(s=>s.unit.uid).join(',') === dc, 'rerolling the mart must not touch the daycare');
  check(G.credits === 8, 'mart reroll costs 1');
  // the daycare holds nothing any more — the PC replaced freezing
  // the daycare never stocks an evolved form
  for(let i=0;i<150;i++){ G.credits=99; E.rollDaycare(G,true);
    for(const s of G.daycare) check(!E.SPECIES[s.unit.id].token, 'daycare stocked an evolution: '+s.unit.id); }
  // the mart never stocks a stone the team cannot use
  const G2 = E.newGame(5); G2.turn = 7; G2.badges = 4; G2.team = [E.makeUnit('snorlax',0)];
  for(let i=0;i<80;i++){ E.rollMart(G2, false);
    for(const s of G2.mart){
      if(s.held){ check(!!E.HELD_ITEMS[s.id], 'a held slot names a held item: '+s.id); continue; }
      check(!E.ITEMS[s.id].eligible || E.canUseItem(s.id, G2.team[0]), 'mart stocked an unusable item: '+s.id); } }
}

/* ---- 8b. the PC ---- */
{
  const T = E.TUNING;
  const G = E.newGame(21); G.turn = 6; G.badges = 3; G.credits = 999; E.rollShop(G, false);
  const put = (i, id) => { G.daycare[i] = { unit: E.makeUnit(id, 0), bought:false }; };

  // buy straight into storage
  put(0, 'machop');
  const before = G.credits;
  check(E.buyToPc(G, 0).ok, 'should be able to buy into the PC');
  check(G.pc.length === 1 && G.pc[0].id === 'machop', 'the copy should land in the PC');
  check(G.credits === before - T.costBuy, 'buying to the PC costs the same');
  check(G.daycare[0].bought === true, 'the daycare slot should sell out');
  check(E.buyToPc(G, 0).ok === false, 'a sold slot cannot be bought again');

  // withdraw into an empty party slot
  check(E.pcToParty(G, 0, 0).ok, 'should withdraw into an empty slot');
  check(G.team.length === 1 && G.pc.length === 0, 'the unit moved, not copied');

  // bank a duplicate, then cash it in for a level up
  put(1, 'machop'); E.buyToPc(G, 1);
  put(2, 'machop'); E.buyToPc(G, 2);
  check(G.pc.length === 2, 'two spare copies banked');
  check(E.pcMergeTarget(G, 0) === 0, 'the PC copy should see its party twin');
  check(E.unitLevel(G.team[0]) === 1, 'still level 1 with copies in storage');
  E.pcToParty(G, 0, 0);
  E.pcToParty(G, 0, 0);
  check(G.pc.length === 0, 'both copies were consumed');
  check(E.unitLevel(G.team[0]) === 2, 'three copies total should be level 2');
  check(G.team[0].id === 'machoke', 'and it should have evolved, got ' + G.team[0].id);
  check(G.team.length === 1, 'merging from the PC must not add a party slot');

  // deposit, swap and release
  put(3, 'onix'); E.buyPokemon(G, 3, 1);
  check(E.partyToPc(G, 1).ok, 'should deposit a party member');
  check(G.pc.length === 1 && G.team.length === 1, 'deposit moves it out of the party');
  const r = E.pcToParty(G, 0, 0);          // onix onto machoke = different species
  check(r.ok && r.swapped, 'a different species should swap places');
  check(G.team[0].id === 'onix' && G.pc[0].id === 'machoke', 'the swap should go both ways');
  const cr = G.credits;
  const rel = E.releaseFromPc(G, 0);
  check(rel.ok && G.credits === cr + rel.refund, 'releasing from the PC refunds');
  check(G.pc.length === 0, 'released pokémon leave storage');

  // capacity
  const G2 = E.newGame(22); G2.turn = 6; G2.badges = 3; G2.credits = 9999; E.rollShop(G2, false);
  for(let i = 0; i < T.pcSlots + 3; i++){
    G2.daycare[0] = { unit: E.makeUnit('pidgey', 0), bought:false };
    E.buyToPc(G2, 0);
  }
  check(G2.pc.length === T.pcSlots, `the PC should cap at ${T.pcSlots}, got ${G2.pc.length}`);
  G2.daycare[0] = { unit: E.makeUnit('pidgey', 0), bought:false };
  const full = E.buyToPc(G2, 0);
  check(full.ok === false && /full/i.test(full.why), 'a full PC should refuse a purchase');
  G2.team = [E.makeUnit('onix', 0)];
  check(E.partyToPc(G2, 0).ok === false, 'a full PC should refuse a deposit');
  check(E.pcRoom(G2) === 0, 'pcRoom should report no space');

  // benched pokémon train at half rate, and the remainder is not lost
  const G3 = E.newGame(23);
  G3.team = [E.makeUnit('machop', 0)];
  G3.pc   = [E.makeUnit('machop', 0)];
  const startAtk = G3.pc[0].atk;
  E.grantBattleExp(G3, 'win');
  check(G3.pc[0].atk === startAtk, 'after one battle a benched pokémon has only banked half a tick');
  E.grantBattleExp(G3, 'win');
  check(G3.pc[0].atk === startAtk + T.expGainWin.atk,
        'after two battles it should have gained exactly one full tick');
  check(G3.team[0].atk === E.SPECIES.machop.atk + 2 * T.expGainWin.atk,
        'the party trains at full rate');
  check(G3.pc[0].hp < G3.team[0].hp, 'the bench should fall behind the party');
}

/* ---- 8b2. levelling inside the PC ---- */
{
  const G = E.newGame(61);
  G.pc = [E.makeUnit('squirtle',0), E.makeUnit('onix',0), E.makeUnit('squirtle',0)];

  check(E.pcTwinInBox(G, 0) === 2, 'a stored copy can see its twin in the box');
  check(E.pcTwinInBox(G, 1) === -1, 'and only a real twin');
  check(E.pcCanMerge(G, 0), 'the ＋ badge lights for a box twin');
  check(!E.pcCanMerge(G, 1), 'and not for a lone pokémon');

  const r = E.pcMerge(G, 2, 0);
  check(r.ok && r.merged, 'two stored copies combine');
  check(G.pc.length === 2, 'and the box closes up');
  check(G.pc[0].exp === 1, 'the survivor banks the copy');
  check(r.at === 0, 'and the result says where it ended up');

  // a third copy levels it, and it evolves in the box
  G.pc.push(E.makeUnit('squirtle',0));
  const r2 = E.pcMerge(G, 2, 0);
  check(r2.ok && !!r2.evolved, 'a third copy evolves it without leaving the PC');
  check(G.pc[0].id === 'wartortle', 'and the box holds the evolution');
  check(E.unitLevel(G.pc[0]) === 2, 'at level 2');

  // the things it must refuse
  check(!E.pcMerge(G, 0, 0).ok, 'a pokémon cannot merge with itself');
  G.pc.push(E.makeUnit('pikachu',0));
  const bad = E.pcMerge(G, G.pc.length - 1, 0);
  check(!bad.ok && /different/.test(bad.why || ''), 'different species refuse, with a reason');

  const maxed = E.newGame(62);
  maxed.pc = [E.makeUnit('squirtle', E.TUNING.expForLevel3), E.makeUnit('squirtle',0)];
  const full = E.pcMerge(maxed, 1, 0);
  check(!full.ok && /level 3/.test(full.why || ''), 'a level 3 pokémon takes no more copies');

  // a copy carrying an item hands it back rather than taking it to the grave
  const held = E.newGame(63);
  held.pc = [E.makeUnit('squirtle',0), E.makeUnit('squirtle',0)];
  held.pc[1].held = 'band';
  check(E.pcMerge(held, 1, 0).ok, 'a copy holding an item still merges');
  check(held.bag.includes('band'), 'and its item goes back to the Bag');

  const jammed = E.newGame(64);
  jammed.pc = [E.makeUnit('squirtle',0), E.makeUnit('squirtle',0)];
  jammed.pc[1].held = 'claw';
  jammed.bag = ['band','sitrus','lefto','coin'];
  const no = E.pcMerge(jammed, 1, 0);
  check(!no.ok && /Bag/.test(no.why || ''), 'with a full Bag the merge is refused, not silently lossy');
  check(jammed.pc.length === 2, 'and nothing was consumed');

  // the same protection on the older party route
  const viaParty = E.newGame(65);
  viaParty.team = [E.makeUnit('squirtle',0)];
  viaParty.pc = [E.makeUnit('squirtle',0)];
  viaParty.pc[0].held = 'egg';
  check(E.pcToParty(viaParty, 0, 0).ok, 'withdrawing onto a twin still merges');
  check(viaParty.bag.includes('egg'), 'and that route reclaims the item too');
}

/* ---- 11c. selling held items back ---- */
{
  const G = E.newGame(71);
  G.credits = 5;
  G.team = [E.makeUnit('squirtle',0)];
  G.pc = [E.makeUnit('abra',0)];
  G.bag = ['band','sitrus'];
  G.team[0].held = 'coin';
  G.pc[0].held = 'claw';

  for(const k of Object.keys(E.HELD_ITEMS))
    check(E.heldResale(k) >= 1 && E.heldResale(k) < E.HELD_ITEMS[k].cost,
          k + ' resells for less than it costs, but for something');

  // from the Bag
  const a = E.sellHeld(G, 'bag', 0);
  check(a.ok && a.id === 'band', 'a Bag item sells');
  check(G.credits === 5 + a.paid, 'and pays out');
  check(G.bag.length === 1 && G.bag[0] === 'sitrus', 'and leaves the Bag, without disturbing the rest');

  // off a party member and off a stored one
  const c1 = G.credits;
  const b = E.sellHeld(G, 'team', 0);
  check(b.ok && !G.team[0].held, 'an item sells straight off a party pokémon');
  check(G.credits === c1 + b.paid, 'and pays out');
  const c2 = G.credits;
  const c = E.sellHeld(G, 'pc', 0);
  check(c.ok && !G.pc[0].held, 'and off a stored one');
  check(G.credits === c2 + c.paid, 'and pays out');

  // the refusals
  check(!E.sellHeld(G, 'team', 0).ok, 'a pokémon holding nothing sells nothing');
  check(!E.sellHeld(G, 'bag', 9).ok, 'an empty Bag slot sells nothing');
  check(!E.sellHeld(G, 'team', 9).ok, 'an empty party slot sells nothing');

  /* The point of selling off a pokémon: with a full Bag you cannot take an
     item off to sell it, so the item would be stuck there forever. */
  const stuck = E.newGame(72);
  stuck.team = [E.makeUnit('squirtle',0)];
  stuck.team[0].held = 'focus';
  stuck.bag = ['band','claw','lefto','coin'];
  check(!E.unequipHeld(stuck, stuck.team[0]).ok, 'a full Bag refuses to take the item off');
  const out = E.sellHeld(stuck, 'team', 0);
  check(out.ok && !stuck.team[0].held, 'but selling it still works — the item is never trapped');
  check(stuck.bag.length === 4, 'and the Bag is untouched');
}

/* ---- 8c. freezing is gone from the Daycare; the Mart reserves ---- */
{
  const G = E.newGame(24); G.turn = 7; G.badges = 4; G.credits = 99; G.team = [E.makeUnit('machop',0)];
  E.rollShop(G, false);
  for(const slot of G.daycare) check(!('frozen' in slot), 'daycare slots should have no freeze flag');
  const uids = G.daycare.map(s => s.unit.uid).join(',');
  G.credits = 99; E.rollDaycare(G, true);
  check(G.daycare.map(s => s.unit.uid).join(',') !== uids, 'a daycare reroll should replace everything');

  const keep = G.mart[0].id;
  G.mart[0].reserved = true;
  G.credits = 99; E.rollMart(G, true);
  check(G.mart[0].id === keep, 'a reserved mart item should survive a reroll');
  check(!('frozen' in G.mart[0]), 'the mart flag should be called reserved, not frozen');
  G.mart[0].reserved = false;
}

/* ---- 9. battle items: party-wide, capped per battle, temporary ----
   X items used to add a flat, turn-scaled amount to ONE pokémon and stacked
   without limit — a dozen on Zapdos one-shot whole teams. They now boost the
   whole party by a small share of each pokémon's own stat, and each can be used
   at most TUNING.xItems.perBattle times per battle. */
{
  const X = E.TUNING.xItems;
  const G = E.newGame(9); G.turn = 5; G.badges = 2;
  G.team = [E.makeUnit('machop',0), E.makeUnit('zapdos',0), E.makeUnit('onix',0)];
  E.rollShop(G, false);
  G.credits = 40;
  const atk0 = G.team.map(u => u.atk), spd0 = G.team.map(u => u.spd);
  check(E.buyBattleItem(G, 0).ok, 'X Attack should be buyable');
  check(G.team.every((u, i) => u.tmpAtk === Math.max(1, Math.round(atk0[i] * X.pct))),
    `one X Attack boosts EVERY party member by ${X.pct*100}% of its own Attack`);
  check(G.team.every((u, i) => u.atk === atk0[i]), 'battle items must not change the permanent stat');
  for(let n = 1; n < X.perBattle; n++) E.buyBattleItem(G, 0);
  check(E.xUses(G, E.BATTLE_ITEMS[0]) === X.perBattle, `X Attack can be used ${X.perBattle} times`);
  const credits = G.credits;
  check(!E.buyBattleItem(G, 0).ok && G.credits === credits, `…and not a ${X.perBattle + 1}th time, nor charged for it`);
  check(G.team.every((u, i) => u.tmpAtk <= Math.ceil(atk0[i] * X.pct * X.perBattle) + X.perBattle),
    'no pokémon can be boosted past the cap — the Zapdos one-shot is gone');
  check(E.buyBattleItem(G, 1).ok, 'X Speed has its own allowance');
  check(G.team.every((u, i) => u.tmpSpd === Math.max(1, Math.round(spd0[i] * X.pct))), 'X Speed registers party-wide');
  // they show up in the fight
  const boosted = E.simulateBattle([G.team[0]], [E.makeUnit('onix',0)], 5);
  check(boosted.steps[0].p[0].atk === atk0[0] + G.team[0].tmpAtk, 'battle items should apply in combat');
  check(boosted.steps[0].p[0].spd === spd0[0] + G.team[0].tmpSpd, 'X Speed should apply in combat');
  // and wear off, allowance and all
  E.applyBattleResult(G, 'win'); E.nextTurn(G);
  check(G.team.every(u => u.tmpAtk === 0 && u.tmpSpd === 0), 'battle items should wear off next turn');
  check(E.xUses(G, E.BATTLE_ITEMS[0]) === 0, 'and the allowance resets for the next battle');
  // too poor, or no party
  G.credits = 0;
  check(E.buyBattleItem(G, 0).ok === false, 'should refuse when broke');
  const H = E.newGame(10); E.rollShop(H, false); H.credits = 10;
  check(!E.buyBattleItem(H, 0).ok && H.credits === 10, 'should refuse with no party to boost');
}

/* ---- 10. economy: carry-over, result bonus, streaks ---- */
{
  const T = E.TUNING;
  const mk = (credits, streak, last) => {
    const G = E.newGame(1); G.credits = credits; G.streak = streak; G.lastResult = last; return G;
  };
  check(E.incomeFor(mk(0, 0, null)).total === T.creditsPerTurn, 'base income');
  check(E.incomeFor(mk(7, 0, null)).carry === 7, 'leftover credits carry over');
  check(E.incomeFor(mk(40, 0, null)).carry === T.maxCarryOver, 'carry-over is capped');
  check(E.incomeFor(mk(0, 1, 'win')).total === T.creditsPerTurn + T.winBonus, 'a win pays more');
  check(E.incomeFor(mk(0, -1, 'lose')).total === T.creditsPerTurn + T.lossBonus, 'a loss still pays something');
  const w5 = E.incomeFor(mk(0, 5, 'win')).total, l5 = E.incomeFor(mk(0, -5, 'lose')).total;
  check(w5 > l5, 'a win streak should out-earn a loss streak');
  check(l5 > T.creditsPerTurn, 'a loss streak should still be a comeback, not a death spiral');
  check(l5 >= T.creditsPerTurn + T.costBuy - 1, `a loss streak should still afford a buy (${l5})`);
  check(E.incomeFor(mk(0, 1, 'win')).streak === 0, 'one win is not a streak yet');
  check(E.incomeFor(mk(0, 3, 'win')).streak > 0, 'three wins is a streak');

  // streak tracking through real results
  const G = E.newGame(2);
  E.applyBattleResult(G,'win');  check(G.streak === 1, 'win sets streak 1');
  E.applyBattleResult(G,'win');  check(G.streak === 2, 'win extends the streak');
  E.applyBattleResult(G,'lose'); check(G.streak === -1, 'a loss flips the streak');
  E.applyBattleResult(G,'lose'); check(G.streak === -2, 'losses extend too');
  E.applyBattleResult(G,'draw'); check(G.streak === -2, 'a draw leaves the streak alone');
  // credits actually land
  const G3 = E.newGame(3); G3.credits = 4; G3.team = [];
  E.applyBattleResult(G3,'win'); E.nextTurn(G3);
  check(G3.credits === E.incomeFor({credits:4, streak:1, lastResult:'win'}).total,
        'nextTurn should pay the advertised income, got ' + G3.credits);
}

/* ---- 11. items ---- */
{
  const G = E.newGame(6); G.turn = 9; G.badges = 5; G.team = [E.makeUnit('machop',0)]; E.rollShop(G, false);
  G.mart[0] = { id:'carbos', reserved:false, bought:false };
  const spd = G.team[0].spd;
  G.credits = 1;
  check(E.buyItem(G,0,0).ok === false, 'refuse an item you cannot afford');
  G.credits = 10;
  check(E.buyItem(G,0,0).ok === true, 'allow an affordable item');
  // read the amount off the item, so a rescale doesn't rot the test
  const carbosSpd = G.team[0].spd - spd;
  check(carbosSpd > 0 && /\+(\d+) Speed/.test(E.ITEMS.carbos.text)
        && +RegExp.$1 === carbosSpd, `carbos adds the speed it advertises (${carbosSpd})`);
  check(E.buyItem(G,0,0).ok === false, 'a used mart item sells out');
  G.mart[1] = { id:'firestone', reserved:false, bought:false };
  check(E.buyItem(G,1,0).ok === false, 'a stone refuses an ineligible pokémon');
  // rare candy can push a pokémon over a level threshold and evolve it
  const G2 = E.newGame(7); G2.turn = 9; G2.badges = 5; G2.credits = 99;
  G2.team = [E.makeUnit('bulbasaur',1)];
  E.rollShop(G2,false); G2.mart[0] = { id:'candy', reserved:false, bought:false };
  E.buyItem(G2, 0, 0);
  check(G2.team[0].id === 'ivysaur', 'rare candy should trigger the evolution, got ' + G2.team[0].id);
}

/* ---- 12. team code round trip ---- */
{
  const team = [E.makeUnit('gengar',2), E.makeUnit('onix',0)];
  team[0].atk = 31; team[0].spd = 140; team[1].hp = 90;
  const back = E.importTeam(E.exportTeam(team, 'Sean'));
  check(back && back.name === 'Sean', 'team code keeps the name');
  check(back.team.length === 2 && back.team[0].atk === 31 && back.team[0].spd === 140, 'team code keeps stats');
  check(back.team[0].exp === 2, 'team code keeps exp');
  check(E.importTeam('garbage!!!') === null, 'bad code returns null');
  check(E.importTeam('') === null, 'empty code returns null');
}

/* ---- 11b. held items: the Bag, the stats, the triggers, the economy ---- */
{
  const HI = E.HELD_ITEMS;
  const ids = Object.keys(HI);
  check(ids.length >= 8, 'there are held items to hold');
  for(const k of ids){
    const h = HI[k];
    check(!!h.name && !!h.icon && !!h.text, k + ' is fully described');
    check(['stat','trigger','economy'].includes(h.kind), k + ' has a known kind');
    check(h.tier >= 1 && h.cost > 0, k + ' is priced and tiered');
    const doesSomething = h.stat || h.pct || h.reduce || h.cutPct || h.unresist || h.dmgBoost || h.healBoost || h.noHeal || h.bell || h.helmet || h.superBoost || h.endRound ||
                          h.endRoundPct || h.berry || h.endure || h.expTick || h.income;
    check(!!doesSomething, k + ' actually does something');
    // a kind is a promise about where the effect shows up
    const u0 = E.makeUnit('squirtle', 0); u0.held = k;
    const movesStats = E.heldStats(u0).hp || E.heldStats(u0).atk || E.heldStats(u0).spd;
    check(!!(h.stat || h.pct) === !!movesStats, k + ': stat bonus and heldStats disagree');
    if(h.kind === 'economy')
      check(!movesStats && !h.reduce && !h.cutPct && !h.unresist && !h.superBoost, k + ' is economy but touches the fight');
  }

  /* --- the Bag holds four, and a swap never needs a free slot --- */
  const G = E.newGame(31);
  G.team.push(E.makeUnit('squirtle',0), E.makeUnit('onix',0));
  for(let i = 0; i < E.TUNING.bagSlots; i++) G.bag.push('band');
  check(E.bagRoom(G) === 0, 'four items fill the Bag');
  G.bag[1] = 'claw';
  const swapA = E.equipHeld(G, 1, G.team[0]);
  check(swapA.ok && G.team[0].held === 'claw', 'gave the Quick Claw');
  check(G.bag.length === E.TUNING.bagSlots - 1, 'the Bag freed a slot');
  G.bag[1] = 'sitrus';
  const swapB = E.equipHeld(G, 1, G.team[0]);
  check(swapB.ok && swapB.taken === 'claw', 'a swap hands the old item back');
  check(G.bag[1] === 'claw', 'and it lands in the slot the new one left');
  check(G.bag.length === E.TUNING.bagSlots - 1, 'a swap does not need a free slot');
  while(G.bag.length < E.TUNING.bagSlots) G.bag.push('band');
  check(!E.unequipHeld(G, G.team[0]).ok, 'a full Bag refuses an unequip');
  check(!E.sellUnit(G, 0).ok, 'and refuses to sell a pokémon holding something');
  G.bag.pop();
  check(E.sellUnit(G, 0).ok && G.bag.includes('sitrus'), 'selling reclaims the item');

  /* --- stat items, and Eviolite's gate --- */
  const s1 = E.makeUnit('squirtle', 0);
  const baseA = E.effAtk(s1);
  s1.held = 'band';
  check(E.effAtk(s1) === baseA + Math.max(1, Math.round(baseA * 0.25)),
        'Muscle Band adds a quarter of its Attack');
  s1.atk = 40;
  check(E.effAtk(s1) === 50, 'and the percentage grows with the pokémon');
  s1.held = null; s1.atk = baseA;
  check(E.effAtk(s1) === baseA, 'taking it off gives the number straight back');

  const canEvolve = E.makeUnit('squirtle', 0), cannot = E.makeUnit('blastoise', 0);
  canEvolve.held = 'evio'; cannot.held = 'evio';
  check(E.heldStats(canEvolve).hp > 0, 'Eviolite works on something that can evolve');
  check(E.heldStats(cannot).hp === 0, 'and does nothing on a final form');
  check(E.heldActive(canEvolve) && !E.heldActive(cannot), 'heldActive reports the gate');

  /* --- the battle triggers --- */
  const allLines = r => r.steps.flatMap(st => st.lines);
  const fight = (mine, theirs, seed) => E.simulateBattle(mine, theirs, seed || 99);

  // Focus Band catches one fatal hit
  const glass = E.makeUnit('caterpie', 0); glass.hp = 4; glass.held = 'focus';
  const bruiser = E.makeUnit('machop', 0);
  bruiser.atk = Math.round(40 / E.TUNING.atkPerDamage); bruiser.hp = 200;
  const rFocus = fight([glass], [bruiser]);
  check(allLines(rFocus).some(l => /hung on with its Focus Band/.test(l)),
        'Focus Band survives a fatal hit');
  const glass2 = E.makeUnit('caterpie', 0); glass2.hp = 4;
  const rNoFocus = fight([glass2], [E.makeUnit('machop',0)].map(u => { u.atk = Math.round(40 / E.TUNING.atkPerDamage); u.hp = 200; return u; }));
  check(!allLines(rNoFocus).some(l => /hung on/.test(l)), 'and only when it is held');

  // Sitrus Berry eats once, and only once
  const chewer = E.makeUnit('onix', 0); chewer.hp = 60; chewer.held = 'sitrus';
  // ~9 damage a swing, whatever the attack scale happens to be
  const poker  = E.makeUnit('rattata', 0); poker.atk = Math.round(9 / E.TUNING.atkPerDamage); poker.hp = 300;
  const rBerry = allLines(fight([chewer], [poker]));
  const eats = rBerry.filter(l => /ate its Sitrus Berry/.test(l));
  check(eats.length === 1, 'Sitrus Berry is eaten exactly once, not every round');

  // Leftovers ticks at the end of a round
  const grazer = E.makeUnit('onix', 0); grazer.hp = 90; grazer.held = 'lefto';
  const rLeft = allLines(fight([grazer], [poker]));
  check(rLeft.some(l => /restored \d+ HP with its Leftovers/.test(l)), 'Leftovers heals between rounds');
  const noLeft = E.makeUnit('onix', 0); noLeft.hp = 90;
  check(!allLines(fight([noLeft], [poker])).some(l => /Leftovers/.test(l)),
        'and only when it is held');

  // the Assault Vest (was Metal Coat) takes a share off every hit
  const dmgTo = (name, lines) => lines.filter(l => l.startsWith(name + ' took'))
    .map(l => +l.match(/took (\d+)/)[1]);
  const plain = E.makeUnit('tangela', 0); plain.hp = 120;
  const coated = E.makeUnit('tangela', 0); coated.hp = 120; coated.held = 'coat';
  const hitter = () => { const u = E.makeUnit('machop', 0);
    u.atk = Math.round(12 / E.TUNING.atkPerDamage); u.hp = 400; return u; };
  const dPlain  = dmgTo('Tangela', allLines(fight([plain],  [hitter()], 5150)));
  const dCoated = dmgTo('Tangela', allLines(fight([coated], [hitter()], 5150)));
  check(dPlain.length && dCoated.length, 'the Assault Vest test landed some hits');
  const cut = E.HELD_ITEMS.coat.cutPct;
  check(dCoated[0] === Math.max(1, Math.round(dPlain[0] * (1 - cut))), `the Assault Vest takes ${cut * 100}% off each hit (${dPlain[0]} -> ${dCoated[0]})`);
  // …and still takes the same share off a big hit late in a run (v50: it used to be a flat 2)
  const bigHitter = () => { const u = hitter(); u.atk *= 4; return u; };
  const bPlain = dmgTo('Tangela', allLines(fight([Object.assign(E.makeUnit('tangela', 0), { hp:400 })], [bigHitter()], 5150)))[0];
  const bCoat  = dmgTo('Tangela', allLines(fight([Object.assign(E.makeUnit('tangela', 0), { hp:400, held:'coat' })], [bigHitter()], 5150)))[0];
  check(bCoat <= Math.round(bPlain * (1 - cut)) + 1 && bPlain - bCoat >= 6, `…and a share of a big hit too (${bPlain} -> ${bCoat})`);

  // Expert Belt (v50): a resisted hit lands for full damage; nothing else changes
  let pair = null, dud = null, sup = null;
  for(const a of E.BUYABLE){
    for(const b of E.BUYABLE){
      const m = E.typeMult(E.SPECIES[a].type, E.SPECIES[b].type);
      if(m < 1 && !pair) pair = [a, b];
      if(m === 1 && !dud) dud = [a, b];
      if(m > 1 && !sup) sup = [a, b];
    }
  }
  check(!!pair && !!dud && !!sup, 'found a resisted pair, a neutral one and a super-effective one');
  const charTest = (atkId, defId, withItem, seed) => {
    const a = E.makeUnit(atkId, 0);
    a.atk = Math.round(20 / E.TUNING.atkPerDamage); a.hp = 500; if(withItem) a.held = 'char';
    const d = E.makeUnit(defId, 0); d.hp = 400;
    return dmgTo(E.SPECIES[defId].name, allLines(fight([a], [d], seed)))[0];
  };
  const superOff = charTest(pair[0], pair[1], false, 777);
  const superOn  = charTest(pair[0], pair[1], true,  777);
  const neutral = charTest(dud[0], dud[1], false, 777);
  check(superOn > superOff * 1.6, `Expert Belt lifts a resisted hit to full damage (${superOff} -> ${superOn})`);
  check(charTest(dud[0], dud[1], true, 777) === neutral,
        'and changes nothing on a neutral hit');
  check(charTest(sup[0], sup[1], true, 777) === charTest(sup[0], sup[1], false, 777),
        'or on a super-effective one');

  /* --- economy items --- */
  const G2 = E.newGame(88);
  const before = E.incomeFor(G2).total;
  G2.team.push(E.makeUnit('pikachu', 0));
  G2.team[0].held = 'coin';
  const coinPay = E.HELD_ITEMS.coin.income;
  check(E.incomeFor(G2).total === before + coinPay, 'Amulet Coin pays every turn');
  G2.pc.push(E.makeUnit('abra', 0)); G2.pc[0].held = 'coin';
  check(E.incomeFor(G2).items === coinPay * 2, 'and pays from the PC too');

  const G3 = E.newGame(89);
  G3.team.push(E.makeUnit('pikachu', 0), E.makeUnit('abra', 0));
  G3.team[1].held = 'egg';
  const hpBefore = [G3.team[0].hp, G3.team[1].hp];
  E.grantBattleExp(G3, 'win');
  const g = E.TUNING.expGainWin;
  { const p0 = E.makeUnit('pikachu', 0), a0 = E.makeUnit('abra', 0);
    check(G3.team[0].hp === grownBy(p0, g).hp && G3.team[0].atk === grownBy(p0, g).atk, 'a plain pokémon gets one tick');
    check(G3.team[1].atk === grownBy(grownBy(a0, g), g).atk, 'Lucky Egg doubles it to two'); }

  /* --- the Mart stocks held items, but not before its tier --- */
  check(E.heldSlotsFor(1) === 0, 'tier 1 stocks no held items');
  check(E.heldSlotsFor(6) <= E.TUNING.heldSlotsMax, 'the held shelf stays capped');
  for(let b = 0; b <= E.TUNING.badgesToWin; b++){
    const g1 = E.newGame(100 + b); g1.turn = 1 + b * 4; g1.badges = b; g1.mart = [];
    E.rollMart(g1);
    const plain = g1.mart.filter(m => !m.held).length;
    const heldN = g1.mart.filter(m => m.held).length;
    check(plain === E.martSlotsFor(E.tierFor(g1)),
          `${b} badges: held items must not eat a medicine slot (${plain})`);
    check(heldN === E.heldSlotsFor(E.tierFor(g1)), `${b} badges: held shelf is the size it claims`);
    if(E.tierFor(g1) < E.TUNING.heldFromTier)
      check(heldN === 0, `${b} badges: nothing held before tier ${E.TUNING.heldFromTier}`);
    for(const m of g1.mart)
      check(m.held ? !!E.HELD_ITEMS[m.id] : !!E.ITEMS[m.id], `${b} badges: slot names a real item`);
  }
  // a reserved held item survives a reroll, and stays in the held section
  const res = E.newGame(556); res.turn = 20; res.badges = 6; res.credits = 99; E.rollMart(res);
  const hi = res.mart.findIndex(m => m.held);
  check(hi >= 0, 'the late Mart has a held slot to reserve');
  res.mart[hi].reserved = true;
  const keptId = res.mart[hi].id;
  E.rollMart(res, true);
  check(res.mart[hi] && res.mart[hi].held && res.mart[hi].id === keptId,
        'a reserved held item survives a reroll in place');
}

/* ---- 12b. a reload must never mint a uid a saved pokémon already owns ---- */
{
  // Play a few turns so the team, PC and Daycare all hold units.
  const G = E.newGame(4242);
  for(let t = 0; t < 4; t++){
    for(let i = 0; i < G.daycare.length; i++){
      const s = G.daycare[i];
      if(!s || s.bought || G.credits < E.TUNING.costBuy) continue;
      if(G.team.length < E.TUNING.maxTeam) E.buyPokemon(G, i, G.team.length);
      else if(E.pcRoom(G) > 0) E.buyToPc(G, i);
    }
    E.applyBattleResult(G, 'win');
    if(G.over) break;
    E.nextTurn(G);
  }
  check(G.team.length > 0 && G.pc.length > 0, 'uid test set up a team and a PC');

  // A reload is a *fresh* engine: the uid counter starts back at 1 while the
  // saved game still holds the old uids. Re-require to reproduce that exactly.
  delete require.cache[require.resolve('./engine.js')];
  const E2 = require('./engine.js');
  const restored = JSON.parse(JSON.stringify(G));
  // A real save is written by a session that started at uid 1, so renumber
  // from 1 the way a player's own storage would look.
  let n = 1;
  restored.team.forEach(u => u.uid = n++);
  restored.pc.forEach(u => u.uid = n++);
  restored.daycare.forEach(s => { if(s && s.unit) s.unit.uid = n++; });
  E2.syncUid(restored);

  let checked = 0;
  for(let r = 0; r < 6; r++){
    const seen = new Map();
    const note = (u, where) => {
      if(!u) return;
      if(seen.has(u.uid))
        fails.push(`after reload, uid ${u.uid} is shared by ${seen.get(u.uid)} and ${where}`);
      seen.set(u.uid, where);
      checked++;
    };
    restored.team.forEach((u, i) => note(u, `team:${i} (${u.id})`));
    restored.pc.forEach((u, i) => note(u, `pc:${i} (${u.id})`));
    restored.daycare.forEach((s, i) => s && !s.bought && note(s.unit, `dc:${i} (${s.unit.id})`));
    E2.rollDaycare(restored);
  }
  check(checked > 40, 'uid test looked at plenty of units');
}

/* ---- 12c. the run: eight badges, then the Elite Four and the Champion ---- */
{
  const T = E.TUNING;
  const plan = E.runPlan();
  check(plan.length === E.RUN_LENGTH(), 'the plan is as long as it claims');
  check(plan.length === T.badgesToWin * (T.battlesPerBadge + 1) + T.eliteFourCount + 1,
        'the plan is badges × (trainers + gym) + elite four + champion');
  check(plan.filter(p => p.kind === 'gym').length === T.badgesToWin, 'one gym per badge');
  check(plan.filter(p => p.kind === 'elite').length === T.eliteFourCount, 'four of the Elite Four');
  check(plan[plan.length - 1].kind === 'champion', 'the Champion is last');
  // every gym in the plan is a different leader, in order
  const ids = plan.filter(p => p.kind === 'gym').map(p => p.boss.id);
  check(new Set(ids).size === ids.length, 'no leader runs two gyms');
  // the cadence: three trainers then a gym
  for(let i = 0; i < T.badgesToWin; i++){
    const at = i * (T.battlesPerBadge + 1);
    for(let j = 0; j < T.battlesPerBadge; j++)
      check(plan[at + j].kind === 'trainer', `stage ${at+j} should be a trainer battle`);
    check(plan[at + T.battlesPerBadge].kind === 'gym', `stage ${at+T.battlesPerBadge} should be a gym`);
  }

  // every boss can actually field a team, at the badge count it is met at
  for(const b of [...E.GYMS, ...E.ELITE_FOUR, E.CHAMPION]){
    check(typeof b.calib === 'number' && b.calib > 0, b.id + ' has a calibration factor');
    check(!!b.blurb && !!b.name, b.id + ' is described');
    for(const badges of [0, 3, 8]){
      const G = E.newGame(77); G.badges = badges; G.turn = 1 + badges * 4;
      const t = E.generateAiTeam({ turn:G.turn, seed:G.seed, badges, boss:b,
        kind: b.id === 'blue' ? 'champion' : E.GYMS.includes(b) ? 'gym' : 'elite',
        tier: E.tierFor(G), size: 4, ratio: 0.9 });
      check(t.team.length === 4, `${b.id} fields a full team at ${badges} badges`);
      for(const u of t.team){
        check(!!E.SPECIES[u.id], `${b.id} fielded an unknown species`);
        check(u.hp > 0 && u.atk > 0 && u.spd > 0, `${b.id} fielded a broken unit`);
      }
      // a gym leader never fields a legendary
      if(E.GYMS.includes(b))
        for(const u of t.team) check(E.SPECIES[u.id].tier < 6,
          `${b.id} fielded a tier-6 legendary (${u.id})`);
    }
    // and its theme is really its theme
    if(b.theme){
      const pool = E.themePool(b.theme);
      check(pool.length >= 2, `${b.id}'s theme has something in it (${pool.length})`);
      for(const k of pool){
        const g = (E.SPECIES[k].gen1 || '').split('/');
        check(b.theme.some(t => g.includes(t)), `${k} is not really ${b.theme.join('/')}`);
      }
    }
  }

  /* --- winning a gym takes the badge and moves the run on --- */
  {
    const G = E.newGame(41);
    G.stage = T.battlesPerBadge;                  // the first gym
    check(E.stageOf(G).kind === 'gym', 'stage lands on a gym');
    const before = G.stage;
    E.applyBattleResult(G, 'win');
    check(G.badges === 1, 'beating a gym earns a badge');
    check(G.stage === before + 1, 'and moves the run on');
    check(G.attempt === 0, 'and clears the attempt counter');
  }

  /* --- losing a gym blacks you out, and you face it again --- */
  {
    const G = E.newGame(42);
    G.stage = T.battlesPerBadge; G.credits = 20; G.lives = T.startingLives;
    const leader = E.stageOf(G).boss;
    const opp = E.opponentFor(G);
    E.applyBattleResult(G, 'lose', opp);
    check(G.badges === 0, 'losing a gym earns no badge');
    check(G.stage === T.battlesPerBadge, 'and you stay on the same gym');
    check(G.credits === 10, `a blackout costs half your credits (had 20, kept ${G.credits})`);
    check(G.blackout === 10, 'and says how much it cost');
    check(G.lives === T.startingLives, 'the first attempt costs no life');
    check(G.attempt === 1, 'the attempt is counted');
    check(!!G.scouted[leader.id], 'and you come away with a scouting report');
    check(G.scouted[leader.id].length === opp.team.length, 'the report is the whole team');

    // the free attempts run out
    for(let i = 0; i < T.freeAttempts; i++) E.applyBattleResult(G, 'lose', opp);
    check(G.lives < T.startingLives, 'past the free attempts, losing costs a life');
    check(E.nextUp(G).lifeAtRisk, 'and the game says so before you go in');
  }

  /* --- a trainer battle is pass-or-pay: you move on either way --- */
  {
    const G = E.newGame(43);
    G.stage = 0;
    E.applyBattleResult(G, 'lose');
    check(G.stage === 1, 'losing a trainer battle still moves the run on');
    check(G.lives === T.startingLives - 1, 'and costs a life');
    check(G.credits === E.newGame(43).credits, 'a trainer loss is not a blackout');
  }

  /* --- a draw is neither --- */
  {
    const G = E.newGame(44);
    G.stage = T.battlesPerBadge; G.credits = 30; G.streak = 3;
    E.applyBattleResult(G, 'draw');
    check(G.stage === T.battlesPerBadge && G.credits === 30 && G.streak === 3,
          'a draw at a gym changes nothing');
  }

  /* --- the run ends by beating the Champion, not by counting wins --- */
  {
    const G = E.newGame(45);
    G.stage = plan.length - 1; G.badges = T.badgesToWin;
    check(E.stageOf(G).kind === 'champion', 'the last stage is the Champion');
    E.applyBattleResult(G, 'win');
    check(G.over === 'won', 'beating the Champion wins the run');
  }
  {
    const G = E.newGame(46);
    G.lives = 1; G.stage = 0;
    E.applyBattleResult(G, 'lose');
    check(G.over === 'lost', 'running out of lives still ends it');
  }

  /* --- badges are the shop's clock, and the turn floor keeps a stuck
         trainer growing so a retry is worth something --- */
  {
    const a = E.newGame(47); a.badges = 0; a.turn = 1;
    const b = E.newGame(47); b.badges = 4; b.turn = 1;
    check(E.tierFor(b) > E.tierFor(a), 'badges raise the shop tier');
    const stuck = E.newGame(47); stuck.badges = 0; stuck.turn = 20;
    check(E.tierFor(stuck) > E.tierFor(a),
          'and so does sheer persistence, or a blacked-out player could never catch up');
    check(E.daycareSlotsFor(E.tierFor(b)) > E.daycareSlotsFor(E.tierFor(a)), 'badges widen the Daycare');
    check(E.martSlotsFor(E.tierFor(b)) >= E.martSlotsFor(E.tierFor(a)), 'and the Mart');
    check(E.heldSlotsFor(E.tierFor(stuck)) > 0,
          'a stuck player still gets a held-item shelf — one clock, not two');
  }

  /* --- bosses are priced against what a player is actually worth --- */
  {
    for(const turn of [4, 16, 32]){
      const G = E.newGame(48); G.turn = turn; G.badges = Math.floor(turn / 4);
      G.stage = G.badges * (T.battlesPerBadge + 1) + T.battlesPerBadge;
      if(E.stageOf(G).kind !== 'gym') continue;
      const opp = E.opponentFor(G);
      const want = E.playerPowerAt(turn) * E.stageOf(G).boss.calib *
        T.gymRatio[Math.min(E.stageOf(G).badge, T.gymRatio.length - 1)];
      const got = E.teamPower(opp.team);
      check(Math.abs(got - want) / want < 0.2,
            `turn ${turn}: gym power ${got.toFixed(0)} should be near ${want.toFixed(0)}`);
    }
  }
}

/* ---- 13. full auto-played runs ---- */
let wins=0, losses=0, draws=0, battles=0, maxSteps=0, cleared=0, evolutions=0;
let blackouts=0, badgeTotal=0, turnsTotal=0;
const bossFights={}, bossWins={}, gymSeen={}, gymBeat={}, diedAt={};
const RUNS = 300, GUARD = E.RUN_LENGTH() * 4;
for(let run=0; run<RUNS; run++){
  const G = E.newGame(run+1);
  E.rollShop(G, false);
  let guard = 0;
  while(!G.over && guard++ < GUARD){
    for(let i=0;i<G.daycare.length;i++){
      if(G.credits < E.TUNING.costBuy) break;
      const s = G.daycare[i]; if(!s || s.bought) continue;
      const dupe = G.team.findIndex(u => u.id === s.unit.id && E.unitLevel(u) < 3);
      const slot = dupe >= 0 ? dupe : G.team.length;
      if(dupe < 0 && G.team.length >= E.TUNING.maxTeam) continue;
      const before = G.team[slot] && G.team[slot].id;
      const r = E.buyPokemon(G, i, slot);
      if(r.ok && before && G.team[slot].id !== before) evolutions++;
    }
    for(let i=0;i<G.mart.length;i++){
      const s = G.mart[i]; if(!s || s.bought || !G.team.length) continue;
      const def = E.defOfSlot(s);
      if(!def || G.credits < def.cost) continue;
      if(s.held){ E.buyHeld(G, i); continue; }   // straight into the Bag
      const ok = G.team.findIndex(u => E.canUseItem(s.id, u));
      if(ok >= 0) E.buyItem(G, i, ok);
    }
    // hand out whatever is in the Bag, first come first served
    while(G.bag.length){
      const free = G.team.find(u => !u.held);
      if(!free) break;
      if(!E.equipHeld(G, 0, free).ok) break;
    }
    if(G.credits >= 6 && G.team.length) E.buyBattleItem(G, 0);
    G.team.sort((a,b) => b.hp - a.hp);
    E.endTurnEffects(G);
    const st = E.stageOf(G);
    const opp = E.opponentFor(G);
    const r = E.stageBattle(G, opp);
    maxSteps = Math.max(maxSteps, r.steps.length);
    if(r.result==='win') wins++; else if(r.result==='lose') losses++; else draws++;
    if(st.kind !== 'trainer'){
      bossFights[st.kind] = (bossFights[st.kind] || 0) + 1;
      if(r.result === 'win') bossWins[st.kind] = (bossWins[st.kind] || 0) + 1;
      if(st.boss){
        gymSeen[st.boss.id] = (gymSeen[st.boss.id] || 0) + 1;
        if(r.result === 'win') gymBeat[st.boss.id] = (gymBeat[st.boss.id] || 0) + 1;
      }
    }
    for(const u of G.team){
      if(!Number.isFinite(u.hp) || !Number.isFinite(u.atk) || !Number.isFinite(u.spd) || u.hp < 1)
        fails.push('run '+run+': corrupted unit after battle');
      if(!E.SPECIES[u.id]) fails.push('run '+run+': unit became an unknown species');
    }
    E.applyBattleResult(G, r.result, opp, r);
    if(G.blackout) blackouts++;
    battles++;
    if(G.over) break;
    E.nextTurn(G);
    if(G.credits < 0) fails.push('run '+run+': negative credits');
  }
  check(guard < GUARD, 'run ' + run + ' never ended (stage ' + G.stage + ', ' + G.badges + ' badges)');
  check(G.over === 'won' || G.over === 'lost', 'run ' + run + ' ended with over=' + G.over);
  if(G.over === 'won') cleared++;
  badgeTotal += G.badges; turnsTotal += G.turn;
  if(G.over === 'lost'){
    const k = E.stageOf(G).kind;
    diedAt[k] = (diedAt[k] || 0) + 1;
  }
  check(G.badges <= E.TUNING.badgesToWin, 'run ' + run + ' collected ' + G.badges + ' badges');
  if(G.over === 'won') check(G.badges === E.TUNING.badgesToWin,
    'a cleared run must hold every badge (had ' + G.badges + ')');
}

const pct = (a,b) => b ? (a/b*100).toFixed(0)+'%' : '—';
console.log(`\n${RUNS} auto-runs: ${wins} W / ${losses} L / ${draws} D over ${battles} battles`);
console.log(`battle win ${(wins/battles*100).toFixed(1)}%  ·  runs cleared ${cleared}/${RUNS}` +
  `  ·  avg ${(badgeTotal/RUNS).toFixed(1)} badges in ${(turnsTotal/RUNS).toFixed(0)} turns` +
  `  ·  ${blackouts} blackouts  ·  longest battle ${maxSteps} steps`);
console.log('bosses:  ' + ['gym','elite','champion']
  .map(k => `${k} ${pct(bossWins[k]||0, bossFights[k]||0)} (${bossFights[k]||0})`).join('  ·  '));
console.log('gyms:    ' + E.GYMS.map(g =>
  `${g.name.split(' ').pop()} ${pct(gymBeat[g.id]||0, gymSeen[g.id]||0)}`).join('  '));
console.log('runs end at: ' + Object.entries(diedAt).map(([k,v]) => `${k} ${v}`).join(', '));
/* trainer names never borrow a boss's name — "Champion Lance" on turn 5 */
{
  const bossNames = E.ALL_BOSSES.map(b => b.name.replace(/^Lt\. /, ''));
  for(const n of E.AI_NAMES)
    check(!bossNames.some(b => n.includes(b)) && !/Elite Four|Champion|Rival|Leader/.test(n),
      `trainer name "${n}" borrows a boss's name or title`);
  for(let t = 1; t <= E.RUN_LENGTH() + 12; t++){
    const n = E.generateAiTeam({ turn:t, seed:7 }).name;
    check(E.AI_NAMES.includes(n), `turn ${t} trainer has an unknown name "${n}"`);
  }
  check(E.trainerName(1) !== E.trainerName(E.RUN_LENGTH()), 'trainer titles should progress across the run');
}

/* shops roll from the run's seed: same seed + same choices = same shelves */
{
  const shelf = G => JSON.stringify([G.daycare.map(s => [s.unit.id, s.unit.hp, s.unit.atk, s.unit.spd]),
                                     G.mart.map(m => [m.id, !!m.held])]);
  const play = seed => {
    const G = E.newGame(seed); E.rollShop(G, false);
    const seen = [shelf(G)];
    G.credits = 99;
    for(let i = 0; i < 6; i++){ E.rollDaycare(G, true); E.rollMart(G, true); seen.push(shelf(G)); }
    for(let t = 0; t < 8; t++){ G.lastResult = 'win'; E.grantBattleExp(G, 'win'); E.nextTurn(G); seen.push(shelf(G)); }
    return { G, seen };
  };
  const a = play(4242), b = play(4242), c = play(4243);
  check(JSON.stringify(a.seen) === JSON.stringify(b.seen), 'same seed and same choices must give the same shelves');
  check(JSON.stringify(a.seen) !== JSON.stringify(c.seen), 'a different seed should give different shelves');
  // successive rolls within one run aren't repeats of each other
  check(new Set(a.seen).size >= a.seen.length - 2, 'rerolls should change the shelves');
  // a save/load mid-run continues the same sequence rather than restarting it
  const x = E.newGame(777); E.rollShop(x, false); x.credits = 99; E.rollDaycare(x, true);
  const y = JSON.parse(JSON.stringify(x));
  E.rollDaycare(x, true); E.rollMart(x, true);
  E.rollDaycare(y, true); E.rollMart(y, true);
  check(shelf(x) === shelf(y), 'a reloaded save must roll the same next shelf as the live game');
  // the roll distribution is still fair: every buyable tier-1 species turns up
  const g = E.newGame(99), counts = {};
  for(let i = 0; i < 400; i++){ E.rollDaycare(g, false); for(const s of g.daycare) counts[s.unit.id] = (counts[s.unit.id]||0) + 1; }
  const t1 = E.BUYABLE.filter(k => E.SPECIES[k].tier === 1);
  check(t1.every(k => counts[k] > 150), `every tier-1 species should roll regularly (${t1.map(k => k + ':' + (counts[k]||0)).join(' ')})`);
}

/* badge rewards (v25) */
{
  const winGym = G => { G.stage = E.runPlan().findIndex((p, i) => i >= (G.stage || 0) && p.kind === 'gym');
    E.applyBattleResult(G, 'win', E.opponentFor(G)); };
  const G = E.newGame(3131); E.rollShop(G, false);
  check(E.pcCap(G) === E.TUNING.pcSlots && E.bagCap(G) === E.TUNING.bagSlots, 'capacities start at the base');
  winGym(G);
  const off = E.pendingOffer(G);
  check(off && off.badge === 0 && off.options.length === 3 && new Set(off.options).size === 3,
    'winning a gym offers three different rewards: ' + (off && off.options));
  check(JSON.stringify(E.pendingOffer(JSON.parse(JSON.stringify(G)))) === JSON.stringify(off),
    'the offer is the same after a save and reload');
  const notOffered = E.BADGE_REWARDS.map(r => r.id).find(id => !off.options.includes(id));
  check(!E.chooseReward(G, notOffered).ok, 'a reward that was not offered is refused');
  check(E.chooseReward(G, off.options[0]).ok && !E.pendingOffer(G), 'choosing clears the offer');
  check(G.rewardLog.length === 1 && G.rewardLog[0].id === off.options[0], 'the choice is recorded');
  check(!E.chooseReward(G, off.options[1]).ok, 'nothing to choose once it is taken');

  // every reward does what it says, measured directly
  const fresh = () => { const H = E.newGame(77); E.rollShop(H, false);
    H.team = [E.makeUnit('squirtle', 0), E.makeUnit('pidgey', 0)]; H.pendingRewards = [0]; return H; };
  const take = (H, id) => { H.pendingRewards = [0]; const o = E.pendingOffer(H);
    o.options[0] = id;                                  // force the offer for the test
    const orig = E.pendingOffer; return E.chooseReward(Object.assign(H, {}), id); };
  const force = (H, id) => { H.perks = H.perks || {}; const r = E.rewardById(id);
    H.perks[id] = (H.perks[id] || 0) + E.TUNING.badgeRewards[id].amount; r.apply(H, () => 0.5); };
  let H = fresh(); force(H, 'pcRow');
  check(E.pcCap(H) === E.TUNING.pcSlots + 4 && E.pcRoom(H) === E.TUNING.pcSlots + 4, 'Storage Box adds 4 PC slots');
  H = fresh(); force(H, 'pocket');
  check(E.bagCap(H) === E.TUNING.bagSlots + 1, 'Bag Pocket adds a Bag slot');
  H = fresh(); const inc0 = E.incomeFor(H).total; force(H, 'allowance');
  check(E.incomeFor(H).total === inc0 + 1 && E.incomeFor(H).badges === 1, 'Allowance adds 1₽ to every turn');
  H = fresh(); force(H, 'piggy'); H.credits = 40;
  check(E.incomeFor(H).carry === E.TUNING.maxCarryOver + 10, 'Piggy Bank raises the carry-over cap by 10');
  H = fresh(); force(H, 'freeRoll'); H.credits = 0;
  check(E.rerollCost(H) === 0 && E.rollMart(H, true) && H.credits === 0, 'Lucky Ticket: a reroll costs nothing');
  check(E.rerollCost(H) === 1 && !E.rollMart(H, true), '…just one a turn');
  E.nextTurn(H); check(H.freeRolls === 1, '…and it comes back next turn');
  H = fresh(); let want = JSON.parse(JSON.stringify(H.team[0])); const t0 = H.trainerExp.atk; force(H, 'training');
  for(let i = 0; i < E.TUNING.badgeRewards.training.amount; i++) want = grownBy(want, E.TUNING.expGainWin);
  const g = E.TUNING.expGainWin.atk * E.TUNING.badgeRewards.training.amount;
  check(H.team[0].atk === want.atk && H.trainerExp.atk === t0 + g, 'Special Training: 4 rounds of EXP for the party and the bank');
  H = fresh(); force(H, 'gift');
  check(H.bag.length === 1 && E.HELD_ITEMS[H.bag[0]], 'Gift Item puts a real held item in the Bag');
  H = fresh(); H.bag = ['band','band','band','band'];
  check(!E.rewardAvailable(H, E.rewardById('gift')), 'no Gift Item offered when the Bag is full');
  H = fresh(); force(H, 'pcRow'); force(H, 'pcRow');
  check(!E.rewardAvailable(H, E.rewardById('pcRow')), 'a reward stops being offered at its max');

  // offers across a whole run never repeat a maxed reward and never run dry
  const R = E.newGame(555); E.rollShop(R, false);
  for(let b = 0; b < 8; b++){ winGym(R); const o = E.pendingOffer(R);
    check(o && o.options.length === 3, `badge ${b + 1} offers three rewards`);
    E.chooseReward(R, o.options[0]); }
  check(E.BADGE_REWARDS.every(r => E.timesTaken(R, r.id) <= E.TUNING.badgeRewards[r.id].max), 'no reward taken past its max');

  // the Daycare roster follows the badge clock
  const D = E.newGame(9); D.turn = 11; D.badges = 0;
  let maxTier = 0;
  for(let i = 0; i < 60; i++){ E.rollDaycare(D, false); for(const s of D.daycare) maxTier = Math.max(maxTier, E.SPECIES[s.unit.id].tier); }
  check(maxTier <= E.tierFor(D) && maxTier < 6, `on turn 11 with no badges the Daycare stops at tier ${E.tierFor(D)} (saw ${maxTier})`);
}

/* the vitamin cap (v26) — the 751-Attack Raichu */
{
  const G = E.newGame(88); G.credits = 999;
  const u = E.makeUnit('pikachu', 0); G.team = [u];
  const cap = E.TUNING.vitaminCap, a0 = u.atk;
  let took = 0;
  for(let i = 0; i < cap + 5; i++){
    G.mart = [{ id:'protein', held:false, reserved:false, bought:false }];
    if(E.buyItem(G, 0, 0).ok) took++;
  }
  check(took === cap, `a pokémon takes exactly ${cap} Proteins (took ${took})`);
  check(u.atk === a0 + 9 * cap, 'and each one counted');
  G.mart = [{ id:'protein', held:false, reserved:false, bought:false }];
  const r = E.buyItem(G, 0, 0);
  check(!r.ok && /can't take any more/.test(r.why) && G.credits === 999 - 3 * cap, 'the 11th is refused without charging');
  G.mart = [{ id:'carbos', held:false, reserved:false, bought:false }];
  check(E.buyItem(G, 0, 0).ok, 'the cap is per vitamin: Carbos still works');
  // a second pokémon can take its own ten
  const v = E.makeUnit('squirtle', 0); G.team.push(v);
  G.mart = [{ id:'protein', held:false, reserved:false, bought:false }];
  check(E.buyItem(G, 0, 1).ok, 'the cap is per pokémon');
  // merging keeps the higher count, never the sum
  const a = E.makeUnit('rattata', 0), b = E.makeUnit('rattata', 0);
  a.vit = { protein: 7 }; b.vit = { protein: 9, carbos: 2 };
  E.mergeInto(G, a, b);
  check(E.vitaminsTaken(a, 'protein') === 9 && E.vitaminsTaken(a, 'carbos') === 2, 'a merge keeps the higher vitamin count');
  // a party that is maxed stops seeing that vitamin in the Mart
  const H = E.newGame(5); H.team = [E.makeUnit('pidgey', 0)]; H.pc = []; H.team[0].vit = { protein: cap };
  let seen = false;
  for(let i = 0; i < 40; i++){ E.rollMart(H, false); if(H.mart.some(m => m.id === 'protein')) seen = true; }
  check(!seen, 'a Mart never stocks a vitamin nobody can take');
}

/* v27: Mart items onto PC pokémon, held items straight onto a pokémon */
{
  const G = E.newGame(21); G.credits = 99; G.badges = 3;
  const a = E.makeUnit('squirtle', 0), b = E.makeUnit('pidgey', 0);
  G.team = [a]; G.pc = [b];
  G.mart = [{ id:'protein', held:false, reserved:false, bought:false }];
  const atk = b.atk;
  check(E.buyItem(G, 0, 0, 'pc').ok && b.atk === atk + 9 && E.vitaminsTaken(b, 'protein') === 1,
    'a vitamin can be used on a PC pokémon');
  G.mart = [{ id:'candy', held:false, reserved:false, bought:false }];
  const ex = b.exp;
  check(E.buyItem(G, 0, 0, 'pc').ok && b.exp === ex + 1, 'a Rare Candy can be used on a PC pokémon');
  // held item straight onto a party member: nothing touches the Bag
  G.bag = [];
  G.mart = [{ id:'band', held:true, reserved:false, bought:false }];
  let r = E.buyItem(G, 0, 0);
  check(r.ok && a.held === 'band' && G.bag.length === 0, 'a held item bought onto a pokémon skips the Bag');
  // swapping onto a holder sends the old one to the Bag…
  G.mart = [{ id:'claw', held:true, reserved:false, bought:false }];
  r = E.buyItem(G, 0, 0);
  check(r.ok && a.held === 'claw' && G.bag[0] === 'band', 'the item it was holding goes to the Bag');
  // …and is refused, uncharged, when the Bag is full
  G.bag = ['coin','coin','coin','coin']; const c0 = G.credits;
  G.mart = [{ id:'lefto', held:true, reserved:false, bought:false }];
  r = E.buyItem(G, 0, 0);
  check(!r.ok && a.held === 'claw' && G.credits === c0, 'no swap onto a holder when the Bag is full');
  // a pokémon holding nothing needs no Bag room at all
  G.mart = [{ id:'lefto', held:true, reserved:false, bought:false }];
  check(E.buyItem(G, 0, 0, 'pc').ok && b.held === 'lefto', 'with a full Bag, an empty-handed PC pokémon can still take one');
}

if(fails.length){
  console.log('\n' + fails.length + ' FAILURES:');
  [...new Set(fails)].slice(0,25).forEach(f => console.log('  - ' + f));
  process.exit(1);
}
console.log('\nall engine checks passed');

/* What's new (v33): the current version must have a changelog entry */
{ const ui = require('fs').readFileSync(__dirname + '/ui.js', 'utf8');
  const v = ui.match(/const GAME_VERSION = \{ v:'([\w.]+)'/)[1];
  if(!new RegExp("\\{ v:'" + v.replace(/\./g, '\\.') + "',[^}]*?title:").test(ui)) { console.log('\nFAILURE: ' + v + ' has no entry in CHANGELOG (ui.js)'); process.exit(1); }
  // 2.3.0 (Sean): every entry is titled as what the update WAS, with a one-line summary under it
  { const TYPES = ['Visual bug fixes', 'Minor gameplay changes', 'Balance patch', 'Major gameplay update'];
    const entries = [...ui.matchAll(/\{ v:'([^']+)',[^\n]*?title:'([^']*)'(?:, sub:'([^']*)')?/g)];
    const bad = entries.filter(m => !TYPES.includes(m[2]) || !m[3]);
    if(bad.length){ console.log('\nFAILURE: CHANGELOG entries need title = one of ' + TYPES.join(' / ') + ' and a sub: summary — ' + bad.map(m => m[1] + ' ("' + m[2] + '")').join(', ')); process.exit(1); } }
  console.log('… ' + v + ' has a What’s new entry'); }
