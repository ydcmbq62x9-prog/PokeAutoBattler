/* The reference player, in ONE place.
   Every balance script used to carry its own copy of the bot, and they drifted:
   one rerolled and one didn't, one checked Bag room and one didn't, and a
   harness that fights the gauntlet differently from the game measures a game
   nobody plays. Scripts that tune difficulty should use this. */
const E = require('./engine.js');

/* Who gets the medicine. 'first' is the reference player: the first pokémon
   that can use it. 'stack' is the carry strategy playtesters found — pour every
   Protein and Carbos into one hitter, preferring a move that hits every enemy. */
let MED = 'first';
const carryScore = u => E.effAtk(u) * E.effSpd(u) * (/every enemy/.test(E.SPECIES[u.id].move.text(1)) ? 3 : 1);
function medTarget(G, id){
  if(MED === 'stack' && (id === 'protein' || id === 'carbos')){
    const ok = G.team.map((u, i) => [u, i]).filter(([u]) => E.canUseItem(id, u));
    if(ok.length){ ok.sort((a, b) => carryScore(b[0]) - carryScore(a[0])); return ok[0][1]; }
    return -1;
  }
  return G.team.findIndex(u => E.canUseItem(id, u));
}
/* SNOW: the snowball player Sean found in v30 testing — buys every Exp. Share
   and Lucky Egg first, and puts eggs on its best hitters. */
let SNOW = false;
const SNOWBALL = ['expshare', 'egg'];
function buyMart(G){
  if(SNOW){
    for(let i = 0; i < G.mart.length; i++){
      const s = G.mart[i]; if(!s || s.bought || !SNOWBALL.includes(s.id)) continue;
      const def = E.defOfSlot(s); if(!def || G.credits < def.cost) continue;
      if(s.held){ const t = G.team.map((u, j) => [u, j]).filter(([u]) => u.held !== 'egg')
          .sort((a, b) => carryScore(b[0]) - carryScore(a[0]))[0];
        if(t) E.buyHeldOnto(G, i, t[0]); }
      else E.buyItem(G, i, 0);
    }
  }
  for(let i = 0; i < G.mart.length; i++){
    const s = G.mart[i]; if(!s || s.bought || !G.team.length) continue;
    const def = E.defOfSlot(s); if(!def || G.credits < def.cost) continue;
    if(s.held){ if(E.bagRoom(G) > 0) E.buyHeld(G, i); continue; }
    const ok = medTarget(G, s.id);
    if(ok >= 0) E.buyItem(G, i, ok);
  }
  while(G.bag.length){ const f = G.team.find(u => !u.held); if(!f) break; if(!E.equipHeld(G, 0, f).ok) break; }
}

/** How much a pokémon is worth RIGHT NOW. Only its HP is wounded: a veteran on
    30% still hits for its full Attack at its full Speed, it just falls sooner.
    Scaling the whole power score by HP left made the bot bench strong hitters
    for weaker fresh bodies, and the bench measured as worth nothing at all. */
const worth = (G, u) => {
  const f = E.hpFracOf(G, u);
  if(f <= 0) return 0;
  return E.effHp(u) * f + E.effAtk(u) + E.TUNING.spdPower * E.effSpd(u);
};

/* The last shop before the Elite Four: stock the PC with the best bodies on
   offer. Under trainer EXP they arrive at your level, so a benched pokémon is a
   fresh full-strength fighter for the moment the party runs dry. */
function stockBench(G, max){
  let bought = 0, guard = 0;
  while(bought < max && E.pcRoom(G) > 0 && guard++ < 12){
    let best = -1;
    for(let i = 0; i < G.daycare.length; i++){
      const s = G.daycare[i]; if(!s || s.bought) continue;
      if(best < 0 || E.unitPower(s.unit) > E.unitPower(G.daycare[best].unit)) best = i;
    }
    if(best >= 0 && G.credits >= E.TUNING.costBuy){
      if(E.buyToPc(G, best).ok){ bought++; continue; }
    }
    // shelf empty or nothing affordable: a Daycare reroll for another look
    if(G.credits >= E.TUNING.costBuy + E.rerollCost(G) && E.rollDaycare(G, true)) continue;
    break;
  }
  return bought;
}

/* Between gauntlet fights: bring a fresher body in for anyone fainted or badly
   hurt. A same-species swap would MERGE rather than swap, so skip those. */
function interlude(G, margin){
  const m = margin == null ? 1.25 : margin;   // 1.0 = rotate anyone a bench body beats
  let swaps = 0;
  for(let slot = 0; slot < G.team.length; slot++){
    const u = G.team[slot];
    let best = -1;
    for(let i = 0; i < G.pc.length; i++){
      if(G.pc[i].id === u.id) continue;
      if(best < 0 || worth(G, G.pc[i]) > worth(G, G.pc[best])) best = i;
    }
    if(best >= 0 && worth(G, G.pc[best]) > worth(G, u) * m){
      if(E.pcToParty(G, best, slot).ok) swaps++;
    }
  }
  return swaps;
}

/* X items are party-wide now: 'bosses' uses every allowed use of each before a
   boss; 'stuck' does the same only when coming back to a boss that beat you. */
function useXItems(G, policy){
  if(!policy || policy === 'never' || !G.team.length) return;
  if(!E.isBoss(E.stageOf(G))) return;
  if(policy === 'stuck' && !G.attempt) return;
  for(let n = 0; n < E.TUNING.xItems.perBattle; n++)
    for(let k = 0; k < E.BATTLE_ITEMS.length; k++) E.buyBattleItem(G, k);
}

/* Badge rewards. The reference player takes them in REWARD_ORDER — the order
   measured best by reward-measure.js. `policy` may be an array (preference
   order), 'random' (seeded by the run), or 'none' (never choose: measures what
   the rewards are worth at all). */
const REWARD_ORDER = ['training', 'allowance', 'gift', 'freeRoll', 'pocket', 'piggy', 'pcRow'];
function pickRewards(G, policy){
  if(policy === 'none'){ G.pendingRewards = []; return; }
  let off, guard = 0;
  while((off = E.pendingOffer(G)) && guard++ < 20){
    if(!off.options.length){ G.pendingRewards.shift(); continue; }
    let id;
    if(typeof policy === 'string' && policy.startsWith('only:')){
      // measure one reward alone: take it when offered, otherwise pass
      const want = policy.slice(5);
      if(off.options.includes(want)) E.chooseReward(G, want); else G.pendingRewards.shift();
      continue;
    }
    if(policy === 'random'){
      id = off.options[E.mix32(G.seed, 77 + off.badge) % off.options.length];
    } else {
      const order = Array.isArray(policy) ? policy.concat(REWARD_ORDER) : REWARD_ORDER;
      id = order.find(r => off.options.includes(r)) || off.options[0];
    }
    E.chooseReward(G, id);
  }
}

/** One turn of shopping. opts: reroll (Mart rerolls), bench (PC slots to stock
    before the E4), x (X item policy: 'never' | 'bosses' | 'dump'), reward
    (badge reward policy — see pickRewards). */
function shop(G, opts){
  const { reroll = true, bench = 4, x = 'stuck', reward = REWARD_ORDER, med = 'stack', arrange = true, snow = false } = opts || {};
  SNOW = snow;
  /* v28: line the party up by role — tanks in front, cannons at the back.
     `arrange:false` is a player who leaves the party in the order it was bought. */
  const line = () => { if(arrange) E.lineUpByRole(G); };
  MED = med;
  pickRewards(G, reward);
  if(E.inGauntlet(G)){ interlude(G); line(); E.endTurnEffects(G); return; }
  /* Outside the gauntlet everyone is healthy again, so field the best six.
     Without this a bot that benched its fainted veterans mid-gauntlet retried
     Lorelei after a blackout with the bench bodies still in the party — it
     fell at the first door 109 times in 400 runs where a benchless bot fell
     twice. worth() is plain power outside the gauntlet, so the same swap
     rule does the job. */
  if(G.pc.length) interlude(G);
  // 2.0.0: a legendary is always worth it if it's affordable
  if(E.encounterOpen && E.encounterOpen(G) && G.credits >= G.encounter.cost && !opts?.noLegends) E.recruitLegend(G);
  for(let i = 0; i < G.daycare.length; i++){
    if(G.credits < E.TUNING.costBuy) break;
    const s = G.daycare[i]; if(!s || s.bought) continue;
    const d = G.team.findIndex(u => u.id === s.unit.id && E.unitLevel(u) < 3);
    const slot = d >= 0 ? d : G.team.length;
    if(d < 0 && G.team.length >= E.TUNING.maxTeam) continue;
    E.buyPokemon(G, i, slot);
  }
  buyMart(G);
  /* The bench is TOPPED UP to its target, after the fixed shelf and before
     rerolls. `lastShop` is true on every retry at Lorelei, so buying `bench`
     new bodies each time filled the PC and starved the party of medicine —
     the bot fell at Lorelei 273 times, the first fight, where a bench is no
     use at all. */
  if(bench && E.nextUp(G).lastShop){
    const have = G.pc.length;
    if(have < bench) stockBench(G, bench - have);
  }
  useXItems(G, x);
  if(reroll){
    let g = 0;
    while((G.freeRolls > 0 || G.credits >= E.TUNING.costRoll + 3) && g++ < 40){ if(!E.rollMart(G, true)) break; buyMart(G); }
  }
  line();
  E.endTurnEffects(G);
}

/** Fight whatever this stage is, exactly the way the game does. */
function fight(G){
  const st = E.stageOf(G), opp = E.opponentFor(G);
  const sim = E.stageBattle(G, opp);
  E.applyBattleResult(G, sim.result, opp, sim);
  return { st, sim, opp };
}

/** A whole run, with gauntlet telemetry. */
function playRun(seed, opts){
  const G = E.newGame(seed, opts && (opts.mods || opts.gens) ? { mods: opts.mods, gens: opts.gens } : undefined);   // 2.0.0: run modifiers; 4.0.0: gens
  E.rollShop(G, false);
  const g = { reached: false, attempts: 0, fell: {}, beaten: {} };
  let guard = 0;
  while(!G.over && guard++ < 220){
    shop(G, opts);
    const { st, sim } = fight(G);
    if(E.isGauntletStage(st)){
      g.reached = true;
      const id = st.boss.id;
      if(sim.result === 'win') g.beaten[id] = (g.beaten[id] || 0) + 1;
      if(sim.result === 'lose'){ g.fell[id] = (g.fell[id] || 0) + 1; g.attempts++; }
      if(sim.result === 'win' && st.kind === 'champion') g.attempts++;
    }
    if(G.over) break;
    E.nextTurn(G);
  }
  return { G, cleared: G.over === 'won', badges: G.badges, turns: G.turn, g };
}

module.exports = { REWARD_ORDER, pickRewards, buyMart, stockBench, interlude, shop, fight, playRun, worth, useXItems };
