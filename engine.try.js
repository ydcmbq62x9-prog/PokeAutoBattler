/* ===================================================================
   POKEBATTLER — ENGINE (pure logic, no DOM)      Gen 1 · v3
   ===================================================================
   COMBAT
   - Three stats: HP, ATTACK, SPEED.
   - A round = every living pokémon acts once, fastest first. Turn order
     is recomputed each round, so speed buffs and debuffs matter.
   - Everything targets the enemy's FRONT RANK unless its move says otherwise,
     picking one of the two at random — so a second body up front genuinely
     splits incoming damage. Ranks shift forward as pokémon faint.
   - One signature move per pokémon. No faint/hurt triggers.
   - damage = Attack x move power x type multiplier - flat reduction, min 1.

   PROGRESSION
   - Three copies of a pokémon = level 2, six = level 3.
   - Levelling EVOLVES it if its line evolves by level. Stone lines wait
     for their stone. Pokémon with nowhere left to evolve get a bigger
     flat stat bonus instead, so they are never strictly worse.

   Everything worth tuning lives in TUNING, TYPES, SPECIES, ITEMS and
   BATTLE_ITEMS.
   =================================================================== */

/* ---------------- TUNING ---------------- */
const TUNING = {
  startingLives:    5,

  /* --- the run: eight badges, then the Elite Four and the Champion ---
     The run is a SCHEDULE, not a win counter. `runPlan()` builds it from these
     numbers and every other system asks the plan what this turn is, so the
     whole shape can be re-cut by editing four values. */
  badgesToWin:      8,
  battlesPerBadge:  3,     // trainer battles before each gym
  eliteFourCount:   4,
  // Losing a boss doesn't end the run — it blacks you out, the way it does in
  // the real games. You keep your team and your badges and lose your money.
  blackoutPct:      0.5,   // share of credits lost on a boss defeat
  freeAttempts:     2,     // …after this many tries, a defeat also costs a life
  turnsPerTier:     5,     // the turn floor under the badge tier clock
  /* Boss difficulty is a SHARE OF WHAT THE PLAYER IS WORTH, not a stat
     multiplier. Measured over 250 bot runs, a player's team power grows almost
     perfectly linearly — about 94 a turn — while the themed pools a leader
     draws from range from 362 (Brock's Geodudes) to 2984 (Giovanni's Golems)
     at the same point in the run. Multiplying a pool by a constant therefore
     makes some gyms trivial and others impossible: Lt. Surge beat 75% of bots
     while every gym around him lost 75%. So each boss team is built and then
     scaled to hit a target, and the target is the one dial worth turning. */
  powerCurve:     { base:317, perTurn:103 },   // refit with fitcurve.js after ANY change to expGain*
  /* The global difficulty ramp. Re-derived with ramp.js against a player who
     REROLLS the Mart, because that is the strongest play available and a real
     player will find it. Tuned so that player clears ~34% of runs and one who
     never rerolls clears ~25% — rerolling should be worth something, not worth
     double, which is what it was worth before the Mart shelf was widened. */
  /* Eased ×0.92 when the gauntlet arrived: difficulty moved from the middle of
     the run to its end. Before, 55% of runs died at a gym and never saw the
     Elite Four at all, and the few who arrived found five ordinary turns. Now
     ~72% arrive and the gauntlet is the filter.
     v26 (vitamin cap): the reference player used to pour all its medicine into
     one pokémon, and that concentration was most of its strength — spread out,
     the same medicine cleared 0% against the old prices. Re-priced for a player
     who focuses medicine on its best hitter within the cap, at Sean's "middle"
     difficulty: that player clears ~61%, typical habits 30–42%, very casual ~9%.
     v28 (roles): re-priced after roles, longer fights and new calibs. Reference
     (lines up by role) ~76%; habits 30–50%; casual who taps "Line up by role"
     ~6%; casual who never arranges ~1%. Formation is now a real skill. */
  gymRatio:       [0.355, 0.383, 0.387, 0.413, 0.439, 0.451, 0.471, 0.483],   // v31 ×0.96 (snowball nerf), v32 ×0.97 (second moves), v34 ×0.95 (no step-up: gyms only)
  bossRatio:      { elite:0.89, champion:1.01 },
  /* The gauntlet, by position (Lorelei … Blue), on top of bossRatio. Each member
     is a full boss fight but the player arrives WOUNDED, so five standalone-
     priced bosses in a row with damage carrying is close to unwinnable. Tuned
     with gauntlet-measure.js against a player who stocks a PC bench. */
  /* Shaped, not flat. Lorelei is the one member you meet at full HP, so at a
     flat price she was the biggest wall — and falling at the first door is the
     least interesting place to fail. She now costs you HP rather than stopping
     you; Agatha and Lance grind; the Champion is the single biggest wall.
     Measured falls (400 runs): Lorelei 10% · Bruno 11% · Agatha 24% ·
     Lance 23% · Blue 31%. */
  /* v52: each member brings a Very rare item (Sean), and v53 keeps the v51
     prices on purpose: Sean wants the Elite Four harder, with the reference
     clear rate in the low 70s (was 77–78%). Scale these to move it: against the
     v51 prices, x0.975 gave 78%, x0.995 ~72%, x1.0 70% (with v53's items). */
  gauntletRatio: [0.3818, 0.4331, 0.4102, 0.4057, 0.4837],   // 3.2.0 x1.012 (stat pass, new pools); 3.0.0 x0.991 net (real type chart, re-measured; Brock eased); v51 prices x0.995; 2.2.0 x1.04 (every run now meets a legendary); 2.5.0 x1.01 (starter roles swapped, Jolteon's Thunderbolt); 2.8.0 x0.997 (Tangela); 2.10.0 x1.004 (Lorelei's Ice pool, Koga's Bug pool); 2.11.0 gyms tougher (see their calib)
  /* Between gauntlet fights, a pokémon resting in the PC recovers this share of
     its max HP for each fight it sits out. Fainted pokémon don't recover. */
  benchRest:      0.25,
  // X Attack / X Speed: party-wide, a share of each pokémon's own stat per use
  /* v28: 5% → 3%. Longer fights make every stat edge more decisive (a fight
     is less of a coin flip at the same power gap), so the full package took a
     coin-flip Champion fight up ~40 points at 5%. At 3% it is ~+33. */
  xItems:         { pct: 0.05, perBattle: 2, cost: 2 },   // v50: back to Sean's +5%; v54: 2 uses a battle (Sean)
  bossScaleClamp: [0.45, 3.0],   // never distort a pool beyond this
  bossSize:       { gym:0,    elite:1,    champion:1 },     // extra bodies
  bossHeldFrom:   { gym:2,    elite:0,    champion:0 },     // badge to start holding items
  bossOffTheme:     0.3,   // share of a themed team that is off-theme bodyguards
  /* The rival (v30): three surprise fights a run, in place of a trainer battle
     somewhere inside each window of gyms (0-based badge numbers). Priced like a
     boss, but `ratio` × YOUR team's power (not the reference curve), so he
     stays a step above a trainer and a step below the gym for every player. A loss is an ordinary trainer loss; a win pays
     `winCredits` on top of next turn's income and hands over a held item. */
  /* The snowball items (v31). Exp. Share and Lucky Egg grow a pokémon with no
     ceiling, where medicine stops at the vitamin cap. Measured in v30: the
     reference player bought ~20 Exp. Shares a run, and the game with neither
     item cleared 31% where it cleared 77%. Now:
     - both are RARE: a shop slot rolls one at `rareWeight` the odds of anything else;
     - Exp. Share trains the PARTY only — not the PC, not the trainer bank that
       new buys inherit, and it doesn't trigger Lucky Eggs;
     - a Lucky Egg gives a pokémon at most `eggCap` bonus rounds, like vitamins. */
  rareWeight:   0.25,
  /* Rarity (v50): how often a shop slot, a rival prize or a Gift Item rolls
     each item, relative to a common one. Tier says WHEN an item can appear;
     rarity says HOW OFTEN. The rule: the rarer an item, the stronger it is for
     one slot — rarity is never just an item being hard to find. Exp. Share and
     Lucky Egg keep the 0.25 they were measured at in v31. */
  rarity: {
    common:   { weight: 1,    name: 'Common' },
    uncommon: { weight: 0.6,  name: 'Uncommon' },
    rare:     { weight: 0.25, name: 'Rare' },
    veryrare: { weight: 0.1,  name: 'Very rare' },
  },
  /* Status conditions (v32), Gen 1's five plus a flinch. One at a time, and a
     pokémon suffers each one at most once per battle (flinch excepted) so a
     sleeper can't be locked down. Rounds are the upkeep clock; actions are the
     victim's own turns. */
  status: {
    brn: { name:'Burn',      icon:'🔥', short:'BRN', rounds:4, dotPct:0.03, atkCut:0.25 },   // v33: 6% → 3% a round, plus −25% damage dealt
    psn: { name:'Poison',    icon:'☠️', short:'PSN', rounds:5, dotPct:0.08 },
    par: { name:'Paralysis', icon:'⚡', short:'PAR', rounds:3, slow:1.6 },
    slp: { name:'Sleep',     icon:'💤', short:'SLP', actions:2 },
    cnf: { name:'Confusion', icon:'💫', short:'CNF', actions:3, selfHit:0.35, selfPower:0.5 },
    fln: { name:'Flinch',    icon:'😵', short:'FLN', actions:1, repeat:true },
  },
  eggCap:       10,
  /* 4.1.0: Red, the secret last boss. Roughly one run in six that clears the
     Champion (Gen 2 runs only) climbs Mt. Silver. One fight, no second try. */
  red: { chance: 1/6, ratio: { '2': 1.12, '1+2': 1.185 }, oakRatio: { '1': 1.10, '1+2': 1.19 }, exp: 5 },   // ratio by gens: ~35% of runs that reach him beat him (bot)
  rival: {
    windows:    [[0, 1], [3, 4], [6, 7]],
    size:       [3, 5, 6],
    ratio:      [0.75, 0.88, 0.84],   // × your own team: ref wins ~81/89/94%, casual ~75/75/56%
    winCredits: [4, 6, 8],
  },
  // Badges, not turns, unlock the Daycare roster — a 37-turn run would
  // otherwise have the full roster available by turn 11 and nothing new after.
  tierForBadge:   [1, 2, 2, 3, 4, 4, 5, 6, 6],
  maxTeam:          6,     // a full pokémon party
  // The battle formation: three ranks, two pokémon abreast. Party slots fill
  // it front-rank first, so 1-2 are Front, 3-4 Middle, 5-6 Back. Ranks are
  // recomputed from the LIVING line, so when a front pokémon faints the one
  // behind steps up.
  rankWidth:        2,
  rankNames: ['Front', 'Middle', 'Back'],
  // The PC: storage for pokémon you own but aren't carrying. It exists so you
  // can bank spare copies toward a level up without clogging your party or
  // tying up a Daycare slot.
  pcSlots:          8,     // two rows to start; the Storage badge reward adds more
  pcExpFraction:    0.5,   // benched pokémon train at half rate
  // The Bag: held items you own but nobody is carrying. It sits under the PC
  // box because it is the same idea — storage for things not currently in play.
  bagSlots:         4,
  /* --- badge rewards: every badge offers a choice of three ---
     Each entry is how much one pick is worth; `max` is how many times it can be
     taken in one run. Offers are drawn from the run's seed, so they are the same
     for the same run and can be measured. See BADGE_REWARDS.
     Measured one at a time with reward-measure.js: +2₽ a turn was worth more
     than everything else put together, so it is +1₽; a wider medicine shelf
     measured as a slight LOSS (more medicine, fewer pokémon), so it was cut
     rather than offered as a trap. */
  badgeRewards: {
    offer: 3,
    pcRow:     { amount: 4,  max: 2 },   // +4 PC slots
    pocket:    { amount: 1,  max: 3 },   // +1 Bag slot
    allowance: { amount: 1,  max: 3 },   // +1₽ at the start of every turn
    freeRoll:  { amount: 1,  max: 2 },   // free rerolls each turn (either shop)
    piggy:     { amount: 10, max: 2 },   // +10₽ carry-over cap
    training:  { amount: 4,  max: 3 },   // rounds of battle EXP, right now
    gift:      { amount: 1,  max: 3 },   // a held item, straight into the Bag
  },
  /* Vitamins (Protein, HP Up, Carbos) per pokémon, each — the real games' rule.
     Without it a player could pour sixty Proteins and thirty Carbos into one
     Raichu (751 Attack, 485 Speed, found in playtesting v25): damage grows with
     Attack × Speed on the same pokémon, and × every enemy for a spread move, so
     one stacked carry was worth far more than the same medicine spread out,
     and far more than the boss pricing (which adds stats up) could see. */
  vitaminCap:       10,
  martSlots:  [2, 3, 3, 4, 4, 5],   // medicine & stone slots by tier — see martSlotsFor
  heldFromTier:     2,     // the Mart starts stocking held items at this tier
  heldSlotsMax:     3,     // …and never more than this many at once

  /* --- economy --- */
  creditsPerTurn:   10,    // base income each turn
  /* 2.0.0 — run modifiers. Rich & Ruthless: income is doubled and every
     opponent's stats are multiplied by `richFoes`. */
  /* Mono-type scales opponents per type, measured so each type clears ~50% for
     the reference player (as Rich does): a Normal team has no offence and one weakness to
     exploit, a Water or Fire team meets gyms that wall it. */
  mods: { richIncome: 2, richFoes: 1.291, nopcFoes: 1.004, onelifeFoes: 1.019,     // 3.0.0: re-measured for the real type chart
          monoFoes: { Normal:1.06, Fire:0.946, Water:0.921, Electric:0.893, Grass:0.811, Fighting:0.955, Ground:0.998, Flying:1.061, Poison:0.911, Psychic:1.138, Bug:0.888, Rock:0.767 },   // 3.8.0: re-measured for the bigger roster; Flying, Poison and Ground join
          monoFoesByGens: {
            '2':   { Normal:1.038, Fire:0.786, Water:0.942, Electric:1.004, Grass:0.943, Ice:1.074, Fighting:1.055, Ground:0.86, Flying:1.04, Poison:0.991, Psychic:1.03, Bug:0.984, Dark:0.858 },   // 4.0.0: re-measured once Gen 2 sold only Gen 2 lines
            '1+2': { Normal:1.101, Fire:0.981, Water:1, Electric:0.962, Grass:0.96, Ice:1.225, Fighting:0.998, Ground:1.075, Flying:1.154, Poison:1.017, Psychic:1.077, Bug:1.061, Rock:0.865, Dark:0.88 } },
          byGens: { '2': { richFoes:1.267 }, '1+2': { richFoes:1.272, onelifeFoes:1.044 } } },   // 4.0.0: Rich / No PC / One Life scales for runs with Gen 2 on, where they differ   // 4.0.0: Mono scales for runs with Gen 2 on (Gen 1 keeps monoFoes above)
  /* 4.0.0: every opponent's scale by the gens a run plays. Gen 1 and Gen 2 are each
     tuned through their bosses' calib; a mixed run sells twice the roster, so copies
     merge less often and the same player is weaker — this brings it back to par. */
  gensFoes: { '1': 0.98, '2': 0.982, '1+2': 0.888 },   // 4.5.0: re-tuned after the 23 fill-in pokémon thinned the Daycare
  // 3.6.0: re-measured after the curated bodyguards (3.5.0: counter moves (3.4.0: the gym pass (3.3.0: tank identities and evolved Elite Four (3.2.0: stat pass and new boss pools) (only types with 3+ lines get a Mono run)
  /* 2.0.0 — legendary encounters. Zapdos and Mewtwo are no longer sold in the
     Daycare; after each gym from `fromBadge` on, one may appear for a turn. */
  legend: { fromBadge: 5, chance: 0.17, cost: 12, growth: 1.2, pityBadge: 7 },   // 2.2.0: a run that hasn't met one by the 7th gym always does
  maxCarryOver:     15,    // unspent credits kept into the next turn (cap)
  winBonus:         2,     // extra for winning the last battle
  lossBonus:        1,     // extra for losing it (keeps a comeback alive)
  // index = streak length, clamped to the last entry
  winStreakBonus:  [0, 0, 1, 2, 3, 4],
  lossStreakBonus: [0, 0, 1, 1, 2, 2],
  costBuy:          3,     // a pokémon from the Daycare
  costRoll:         1,     // reroll either shop
  sellRefundPerLevel: 1,
  itemResale:       0.5,   // share of an item's price the Mart buys it back for

  /* --- levelling --- */
  expForLevel2:     2,     // extra copies needed (3 total)
  expForLevel3:     5,     // extra copies needed (6 total)
  mergeBonus:      { hp:2, atk:3, spd:1 },   // per combine
  levelUpBonus:    { hp:4, atk:3, spd:3 },   // on levelling INTO an evolution
  levelUpBonusMax: { hp:9, atk:9, spd:6 },   // on levelling with nowhere to evolve
  movePowerPerLevel: 0.25,

  /* --- EXP from battling: the player's stat curve --- */
  /* Who the battle EXP belongs to.
     'unit'    — each pokémon banks its own, as it always has. A veteran carried
                 from turn 1 ends the run 4.4× the power of the same species
                 bought on turn 40, which is why a party locks at turn 3 and the
                 Daycare, the PC and the scouting report all go dead behind it.
     'trainer' — the TRAINER banks it, and anything you acquire is topped up to
                 that level on arrival. A fresh buy is competitive immediately,
                 so swapping and counter-drafting stay live all run. */
  aiDifficulty: 0.78,     // the AI's stat growth per turn; must move WITH the player's
  expModel:    'trainer',
  /* Cut from 3/3/2. Battle EXP was 41% of all the power gained in a run and it
     was unconditional — you got it for turning up — which left the shops with
     little to decide. At 2/2/1 purchased power rises from 66% to 74% of the
     total. Any change here needs powerCurve refitted and aiDifficulty moved
     with it, or bosses and trainers are priced for a player who no longer
     exists; expmodel2.js does both. */
  expGainWin:  { hp:2, atk:2, spd:1 },
  expGainLoss: { hp:1, atk:0, spd:0 },

  /* --- combat --- */
  // Moves that grant HP or damage reduction instead of dealing damage are
  // capped PER BATTLE, or two walls stare at each other forever. The cap is
  // measured against the pokémon's own HP at the start of the fight, so items
  // and EXP raise it too — this limits the MOVE, not the pokémon.
  moveGuardCap: {
    hpPct:          1.0,   // a move may add at most this much of starting HP
    reducePerLevel: 3,     // and at most this much flat damage reduction, per level (4 before v28's longer fights)
  },
  /* Speed buys extra actions. `scale` turns a speed ratio into banked surplus,
     `gainCap` stops one absurd matchup snowballing, `extraCap` is the most
     extra actions a single unit can take in one round. */
  /* The action meter. A pokémon's next action lands `atbQuantum / speed` later,
     so speed IS the rate at which you act — there are no rounds to be capped
     by. A "round" survives only as a unit of TIME (how long an average-speed
     pokémon takes to act once), which is what item upkeep and the battle
     length cap are measured in. */
  atbQuantum:       1000,
  maxBattleActions: 500,   // hard stop, whatever the speeds
  /* What a point of speed is worth next to a point of HP or Attack, measured
     with statvalue.js. Under the action meter speed edged ahead (1.42 against
     1.17 and 1.18), so the power score weights it up to match. Re-measure and
     update this together — it is the number that keeps the score honest. */
  spdPower:         1.2,
  /* Attack points per point of damage at 100% power. Attack was rescaled ×2 so
     it has the resolution to matter late; halving this kept every hit landing
     for exactly what it did before (1/3).
     v28: cut to 0.2 so fights last ~1.7× longer. At 1/3 a late fight was over in
     about three rounds — whoever struck first won, HP was a weak stat, a heal
     never had time to matter and a Tank was just a slower Bruiser. Roles only
     mean something if a fight lasts long enough to hold a line. Flat damage
     reduction (guard moves, the Assault Vest) was scaled down with it. */
  atkPerDamage: 0.2,
  weakMult:         2,
  resistMult:       0.5,
  maxBattleRounds:  40,

  /* --- roles (v28) ---
     Every pokémon has one of four roles. The role decides how its stats GROW
     (battle EXP, the trainer catch-up, level-ups and merges are all split by
     these weights; medicine stays flat) and gives it one trait in battle.
     Growth is what shapes a pokémon late — base stats are only 5–20% of a
     late-game pokémon — so without this a Blastoise and a Mewtwo converged on
     the same even spread. Each weight set sums to 3, so no role grows more
     than another in total, only differently. */
  roles: {
    tank:    { grow:{ hp:1.8, atk:0.6, spd:0.6 } },               // Bodyguard
    bruiser: { grow:{ hp:1.0, atk:1.0, spd:1.0 }, superTaken:1.5, dmgTaken:0.9 },// Steady
    cannon:  { grow:{ hp:0.6, atk:1.5, spd:0.9 }, backBoost:0.25 },// Covering Fire (behind a Tank/Bruiser)
    support: { grow:{ hp:1.2, atk:0.6, spd:1.2 }, careRound:0.10 },// Aftercare
  },
  rallyMax: 3,
  /* Stat drops (Speed and Attack cuts from moves) stack, but never below this
     share of what the pokémon started the battle with. Longer fights (v28) let a
     team of Supports stack Stun Spore and Sing until the other side barely moved. */
  dropFloor: 0.7,
  /* A move that hits every enemy lands at this share behind the front rank (v28).
     With Tanks holding the front, reaching the back line is the most valuable
     thing a move can do — Thunderbolt at full power was the strongest move in the
     game before roles and the only way past a Tank after them. */
  spreadBack: 0.5,             // a Rally move stacks at most this many times per ally
};

// Which tier is unlocked on a given turn (1..6)
const tierForTurn = t => Math.max(1, Math.min(6, Math.floor((t + 1) / 2)));

/* ===================================================================
   THE RUN — a schedule of battles, not a win counter
   Three trainer battles, then a gym, eight times over, then the Elite Four
   and the Champion. `G.stage` indexes this; it only advances when you clear
   the entry, so a lost gym is fought again.
   =================================================================== */
/* 4.0.0: the bosses come from the run's own plan (G.bossPlan, drawn when the run
   starts — see drawBossPlan). A run without one, or a call without a game, is
   the classic Gen 1 order: Brock … Giovanni, Lorelei … Lance, Blue. */
function runPlan(G){
  const bp = bossPlanOf(G);
  const plan = [];
  for(let b = 0; b < TUNING.badgesToWin; b++){
    for(let i = 0; i < TUNING.battlesPerBadge; i++) plan.push({ kind:'trainer', badge:b });
    plan.push({ kind:'gym', badge:b, boss:bp.gyms[b % bp.gyms.length] });
  }
  for(let i = 0; i < TUNING.eliteFourCount; i++)
    plan.push({ kind:'elite', boss:bp.elite[i % bp.elite.length] });
  plan.push({ kind:'champion', boss:bp.champion });
  if(G && G.redOpen) for(const id of (G.secrets || [null])) plan.push({ kind:'red', boss: id ? SECRETS[id] : secretOf(G) });   // 4.1.0: Mt. Silver (4.4.0: the Secret Gauntlet has two)
  return plan;
}
const RUN_LENGTH = () =>
  TUNING.badgesToWin * (TUNING.battlesPerBadge + 1) + TUNING.eliteFourCount + 1;

/** What this turn is. Past the end means the run is already won. */
function stageOf(G){
  const plan = runPlan(G);
  return plan[Math.min(G.stage || 0, plan.length - 1)];
}
const isBoss = st => !!st && st.kind !== 'trainer';

/* ===================================================================
   THE ELITE FOUR GAUNTLET
   The last five stages — the Elite Four, then the Champion — are one
   continuous challenge rather than five ordinary turns:
   - damage CARRIES between fights, and a fainted pokémon sits out the rest;
   - between fights the shops are CLOSED, but you can rearrange, swap fresh
     pokémon in from the PC and move held items — the PC is your bench;
   - lose any of them and you black out back to Lorelei, fully healed, and the
     whole gauntlet counts as ONE boss attempt for lives.
   `G.gauntlet` exists only while you are mid-way through: once at least one
   member has fallen and before you win or black out.
   =================================================================== */
const gauntletStart = () => TUNING.badgesToWin * (TUNING.battlesPerBadge + 1);
const isGauntletStage = st => !!st && (st.kind === 'elite' || st.kind === 'champion');
const inGauntlet = G => !!(G && G.gauntlet);
/** What share of its max HP a pokémon has left. Stored as a SHARE, not a number,
    so moving an HP item on or off scales the current HP with the max instead of
    fainting or healing it. Anything never tracked is at full. */
function hpFracOf(G, u){
  if(!inGauntlet(G) || !u) return 1;
  const f = G.gauntlet.hpFrac[u.uid];
  return f == null ? 1 : f;
}
const canFight = (G, u) => hpFracOf(G, u) > 0;
const fightersOf = G => (G.team || []).filter(u => canFight(G, u));
/** The one way to fight the current stage — wounds, benched fainters and all.
    Every caller (the UI and the balance bots) goes through here, so the game
    and the tuning can never be measuring two different gauntlets. */
function stageBattle(G, opp, seed){
  fixSlots(G);
  return simulateBattle(fightersOf(G), opp.team,
    seed != null ? seed : G.seed + G.turn * 977 + (G.stage || 0) * 131,
    { hpFrac: inGauntlet(G) ? G.gauntlet.hpFrac : null });
}
/** After a gauntlet fight, write down what everyone who fought has left. */
function recordWounds(G, sim){
  if(!sim || !sim.steps || !sim.steps.length) return;
  const fought = sim.steps[0].p.map(c => c.uid);
  const left = {};
  for(const c of sim.steps[sim.steps.length - 1].p) left[c.uid] = c.hp;
  const owned = ownedUnits(G);
  for(const uid of fought){
    const u = owned.find(x => x.uid === uid);
    if(!u) continue;
    // a move like Harden can lift HP past max inside a fight; it doesn't come home
    G.gauntlet.hpFrac[uid] = left[uid] == null ? 0 : Math.max(0, Math.min(1, left[uid] / effHp(u)));
  }
}
const shopClosed = () => ({ ok:false, why:'The shops are closed until the Elite Four is over.' });
/* Badges unlock the shop — but turns do too, and that matters more than it
   looks. If badges were the only clock, a player stuck on a gym would be stuck
   with the roster that lost them the gym, and the whole retry mechanic would be
   pointless. The turn floor is what lets a blacked-out trainer out-grow a wall. */
const tierFor = G => Math.max(
  TUNING.tierForBadge[Math.min(G.badges || 0, TUNING.tierForBadge.length - 1)],
  Math.min(6, 1 + Math.floor((G.turn || 1) / TUNING.turnsPerTier)));

/* ===================================================================
   GYM LEADERS, THE ELITE FOUR AND THE CHAMPION
   Themed on the REAL Gen 1 typing (`gen1`), not the card type. The card ring
   has six types and only three buyable Grass lines; the Gen 1 typings give
   fifteen, eleven of them with four or more members, so a Rock gym and a
   Fighting gym read completely differently even though the cards call them
   both Fighting. A theme is a list, because a two-type leader draws on a
   deeper bench and is harder to hard-counter with one pokémon.
   =================================================================== */
const GYMS = [
  { id:'brock',    name:'Brock',        title:'Pewter Gym',     guards:['machop','machoke','machamp','mankey','primeape','tauros','sandshrew','sandslash','diglett','dugtrio'], theme:['Rock'],
    signature:['onix', 'geodude'],
    badge:'Boulder', blurb:'Rock and Ground walls: Onix, Golem, Rhydon. Water, Grass and Fighting break them.'  , calib:1.231, mix:0.963 },
  { id:'misty',    name:'Misty',        title:'Cerulean Gym',   guards:['jigglypuff','wigglytuff','clefairy','clefable','eevee','drowzee','hypno'], theme:['Water'], exclude:['seel', 'dewgong', 'shellder', 'cloyster', 'lapras'],   // 3.2.0: the icy Waters are Lorelei's
    signature:['starmie', 'staryu', 'poliwag', 'squirtle'],
    badge:'Cascade', blurb:'A wide Water bench with Starmie in front. Electric and Grass are your friends.'  , calib:1.874, mix:1.046 },
  { id:'surge',    name:'Lt. Surge',    title:'Vermilion Gym',  guards:['pidgey','pidgeotto','pidgeot','spearow','fearow','rattata','raticate','tauros','zubat','golbat'], theme:['Electric'],
    signature:['raichu', 'pikachu'],
    badge:'Thunder', blurb:'Fast, shocking cannons behind a Magneton wall. Something sturdy up front.'  , calib:1.735, mix:0.987 },
  { id:'erika',    name:'Erika',        title:'Celadon Gym',    guards:['chansey','clefairy','clefable','eevee','pidgey','pidgeotto','pidgeot'], theme:['Grass'], exclude:['Bug'],   // 3.2.0: the Bugs are Koga's
    signature:['vileplume', 'gloom', 'oddish'],
    badge:'Rainbow', blurb:'Sleep, poison and healing on a wide Grass bench. Fire ends it quickly.'  , calib:2.193, mix:1.001 },
  { id:'koga',     name:'Koga',         title:'Fuchsia Gym',    guards:['zubat','golbat','oddish','vileplume','bellsprout','victreebel','rattata','raticate'], theme:['Bug'], also:['koffing', 'weezing', 'nidoranf', 'nidorina', 'nidoqueen', 'nidoranm', 'nidorino', 'nidoking'], exclude:['Ghost'],   // 3.2.0: Bugs plus the gas clouds (Erika keeps the Grasses)
    signature:['weezing', 'koffing', 'scyther'],
    badge:'Soul',    blurb:'Weezing leads bugs and gas clouds that wear you down. Fire and Psychic help.'  , calib:2.096, mix:0.988 },
  { id:'sabrina',  name:'Sabrina',      title:'Saffron Gym',    guards:['clefairy','clefable','jigglypuff','wigglytuff','chansey','eevee','snorlax','porygon'], theme:['Psychic'],
    signature:['alakazam', 'abra'],
    badge:'Marsh',   blurb:'Alakazam leads a team of glass cannons that hit first. Out-speed or out-bulk them.'  , calib:1.893, mix:0.921 },
  { id:'blaine',   name:'Blaine',       title:'Cinnabar Gym',   guards:['machop','machoke','machamp','mankey','primeape','tauros','snorlax'], theme:['Fire'],
    signature:['arcanine', 'growlithe'],
    badge:'Volcano', blurb:'Everything hurts, and Arcanine leads. Water walls it.'  , calib:1.968, mix:0.999 },
  { id:'giovanni', name:'Giovanni',     title:'Viridian Gym',   guards:['rattata','raticate','zubat','golbat','koffing','weezing','machop','machamp','tauros','nidoqueen','nidoking','nidorina','nidorino'], theme:['Ground','Normal'], exclude:['geodude', 'graveler', 'golem', 'onix', 'pidgey', 'pidgeotto', 'pidgeot', 'spearow', 'fearow', 'doduo', 'dodrio', 'farfetchd'],   // 3.2.0: the walls are Brock's
    signature:['rhydon', 'rhyhorn'],
    badge:'Earth',   blurb:'Muscle, not tricks: big Normal and Ground bodies, Rhydon in front. A stat check.'  , calib:2.034, mix:0.987 },
];
const ELITE_FOUR = [
  { id:'lorelei', name:'Lorelei', title:'Elite Four', guards:['starmie','hypno','alakazam','clefable','wigglytuff','chansey','porygon'], theme:['Ice'], also:['seel','shellder','vaporeon'],   // 3.3.0: + Vaporeon, so the finals are five deep
    signature:['lapras', 'dewgong', 'cloyster'],
    blurb:'Icy Water pokémon, Lapras in front. Chip her walls down before the clock does. Electric helps.'  , calib:2.402, mix:1.017 },
  { id:'bruno',   name:'Bruno',   title:'Elite Four', guards:['golem','rhydon','snorlax','tauros'], theme:['Fighting'], also:['onix'],   // 3.2.0: Mankey and Hitmonchan join; only Onix keeps his Rock
    signature:['machamp', 'primeape', 'hitmonlee'],
    blurb:'Machamp leads a Fighting crowd, with Onix holding the line. Psychic is the lever.'  , calib:1.951, mix:1.081 },
  { id:'agatha',  name:'Agatha',  title:'Elite Four', guards:['vileplume','parasect','tangela','jynx','alakazam','nidoqueen','nidoking'], theme:['Ghost'], also:['zubat', 'golbat', 'drowzee', 'hypno', 'weezing', 'victreebel'],   // 3.2.0: ghosts, bats and Dream Eaters; 3.3.0: + the poison cloud and the pitcher
    signature:['gengar', 'hypno', 'golbat'],
    blurb:'Gengar leads ghosts, bats and dream-eaters that hit hard and fall fast. Whoever moves first wins.'  , calib:1.82, mix:1.049 },
  { id:'lance',   name:'Lance',   title:'Elite Four', guards:['arcanine','ninetales','tauros','rhydon'], theme:['Dragon','Flying'], exclude:['Poison', 'Bug', 'Psychic', 'Dark', 'Steel'],   // 3.2.0: bats and bugs belong to Agatha and Koga
    signature:['dragonite', 'gyarados', 'charizard'],
    blurb:'Dragonite leads Dragon and Flying pokémon. No easy type answer.'  , calib:1.686, mix:1.093 },
];
const CHAMPION = { id:'blue', name:'Blue', title:'Champion', theme:null,
  blurb:'One of everything, all of it evolved. There is no counter-pick here.'  , calib:1.257 };

/* Your rival. Not on the schedule: he ambushes a trainer battle (see rivalStages). */
/* 4.1.0 — RED. Not on the schedule and never in the boss plan: the run decides
   from its seed whether he is up there (G.redFlag), and he only appears once the
   Champion has fallen. His team is the Mt. Silver team from Gold, Silver and
   Crystal, exactly, each at level 3 and holding something that suits it. */
const RED = { id:'red', person:'red', name:'Red', title:'Mt. Silver', place:'Mt. Silver', gen:2, theme:null, special:true,
  lineup:[
    { id:'pikachu',  exp:5, held:'claw' },
    { id:'espeon',   exp:5, held:'focus' },
    { id:'snorlax',  exp:5, held:'lefto' },
    { id:'venusaur', exp:5, held:'sitrus' },
    { id:'charizard',exp:5, held:'band' },
    { id:'blastoise',exp:5, held:'coat' },
  ],
  blurb:'He has not said a word in years. One chance, no rematch: if you fall here, the run simply ends as it would have.' };
/* 4.2.0 — PROFESSOR OAK, the Gen 1 secret boss. Gen 1 never has him battle, so his
   team is the professor's best: the three starters and three Kanto classics. */
const OAK = { id:'oak', person:'oak', name:'Oak', title:'Professor', place:'Pallet Town', gen:1, theme:null, special:true,
  lineup:[
    { id:'pikachu',   exp:5, held:'claw' },
    { id:'snorlax',   exp:5, held:'coat' },
    { id:'dragonite', exp:5, held:'band' },
    { id:'venusaur',  exp:5, held:'lefto' },
    { id:'charizard', exp:5, held:'char' },
    { id:'blastoise', exp:5, held:'sitrus' },
  ],
  blurb:'The professor has watched every trainer who ever left his lab, and he brought his best. One chance, no rematch.' };
const SECRETS = { red: RED, oak: OAK };
const RIVAL = { id:'rival', name:'Blue', title:'Rival', theme:null,
  blurb:'He turns up three times a run, always when you least expect it. His starter beats yours, and his team grows every time you meet.' };
const ALL_BOSSES = [...GYMS, ...ELITE_FOUR, CHAMPION];   // the Gen 1 bosses (balance tools and tests read this)

/* ===================================================================
   4.0.0 — THE GEN 2 BOSSES (Johto)
   Placeholder benches until the Gen 2 pack lands: themes are set, but the
   pools lean on Gen 1 pokémon and `calib` copies the Gen 1 leader in the same
   slot. `person` ties a boss to whoever plays them, so a run never meets the
   same person twice (Koga the gym leader and Koga of the Elite Four).
   =================================================================== */
const GYMS2 = [
  { id:'falkner', name:'Falkner', title:'Violet Gym',    gen:2, theme:['Flying'], exclude:['Fire','Dragon','Bug','Water','Steel'], guards:['snubbull','granbull','teddiursa','mareep','flaaffy','phanpy'],
    signature:['pidgeotto', 'noctowl', 'pidgeot', 'crobat'],
    badge:'Zephyr',  blurb:'Fast birds that strike first. Electric and Rock ground them.', calib:1.136, mix:0.946 },
  { id:'bugsy',   name:'Bugsy',   title:'Azalea Gym',    gen:2, theme:['Bug'], guards:['hoothoot','noctowl','oddish','gloom','mareep','flaaffy'],
    signature:['scyther', 'scizor', 'heracross'],
    badge:'Hive',    blurb:'Bugs that slow, sting and slice, Scyther in front. Fire, Flying and Rock clear them out.', calib:1.344, mix:1.013 },
  { id:'whitney', name:'Whitney', title:'Goldenrod Gym', gen:2, theme:['Normal'], exclude:['Flying'], guards:['marill','azumarill','oddish','gloom','tyrogue','hitmontop'],
    signature:['miltank', 'clefairy', 'clefable'],
    badge:'Plain',   blurb:'Miltank rolls over everything, with a cute Normal bench behind it. Fighting cracks them.', calib:1.459, mix:0.975 },
  { id:'morty',   name:'Morty',   title:'Ecruteak Gym',  gen:2, theme:['Ghost'], also:['drowzee', 'hypno', 'murkrow', 'natu', 'xatu', 'houndour', 'houndoom', 'smoochum', 'jynx'], guards:['zubat','golbat','umbreon','hypno'],
    signature:['gengar', 'haunter', 'misdreavus'],
    badge:'Fog',     blurb:'Ghosts and things that go bump in the night, putting you to sleep. Dark, Psychic and Ghost hit back.', calib:2.004, mix:1.06 },
  { id:'chuck',   name:'Chuck',   title:'Cianwood Gym',  gen:2, theme:['Fighting'], also:['poliwag', 'poliwhirl', 'poliwrath'], guards:['onix','steelix','geodude','graveler','ursaring'],
    signature:['poliwrath', 'primeape', 'hitmontop'],
    badge:'Storm',   blurb:'Raw Fighting power with Poliwrath in front. Psychic and Flying win it.', calib:1.934, mix:0.992 },
  { id:'jasmine', name:'Jasmine', title:'Olivine Gym',   gen:2, theme:['Steel'], also:['magnemite', 'magneton'], guards:['phanpy','donphan','larvitar','pupitar','ampharos','quagsire'],
    signature:['steelix', 'skarmory', 'magneton'],
    badge:'Mineral', blurb:'Steel walls that refuse to fall, Steelix in front. Fire, Fighting and Ground melt them.', calib:2.097, mix:1.022 },
  { id:'pryce',   name:'Pryce',   title:'Mahogany Gym',  gen:2, theme:['Ice'], guards:['phanpy','donphan','seel','shellder','quagsire'],
    signature:['piloswine', 'dewgong', 'swinub'],
    badge:'Glacier', blurb:'Icy walls that chill and sleep you, Piloswine in front. Fire, Fighting and Steel break the ice.', calib:2.141, mix:0.999 },
  { id:'clair',   name:'Clair',   title:'Blackthorn Gym', gen:2, theme:['Dragon'], also:['horsea', 'seadra', 'gyarados', 'magikarp'], bossOnly:['dratini', 'dragonair', 'dragonite'], guards:['flaaffy','ampharos','piloswine','skarmory'],
    signature:['kingdra', 'dragonair', 'dragonite'],
    badge:'Rising',  blurb:'Kingdra and a den of Dragonair, with a temper and Thunder Wave. Ice and Dragon bring them down.', calib:2.217, mix:1.055 },
];
const ELITE_FOUR2 = [
  { id:'will',  name:'Will',  title:'Elite Four', gen:2, theme:['Psychic'], guards:['jynx','wigglytuff','clefable','ampharos','blissey'],
    signature:['xatu', 'exeggutor', 'jynx'],
    blurb:'Psychics that hit first and hard, Xatu in front. Bug, Dark and Ghost outlast them.', calib:2.59, mix:1.045 },
  { id:'koga2', person:'koga', name:'Koga', title:'Elite Four', gen:2, theme:['Poison'], also:['forretress'], exclude:['Ghost','Grass'], guards:['forretress','skarmory','sneasel','ursaring'],
    signature:['crobat', 'ariados', 'weezing'],
    blurb:'Koga, now of the Elite Four: poison, confusion and Crobat. Psychic and Ground cut through.', calib:1.817, mix:1.049 },
  { id:'bruno2', person:'bruno', name:'Bruno', title:'Elite Four', gen:2, theme:['Fighting'], also:['onix', 'steelix'], guards:['steelix','donphan','ursaring','miltank'],
    signature:['hitmontop', 'hitmonlee', 'hitmonchan', 'machamp'],
    blurb:'Bruno again: the three Hitmons, Steelix holding the line. Psychic is still the lever.', calib:1.772, mix:1.065 },
  { id:'karen', name:'Karen', title:'Elite Four', gen:2, theme:['Dark'], also:['gengar', 'vileplume', 'bellossom'], guards:['vileplume','bellossom','crobat'],
    signature:['umbreon', 'houndoom', 'murkrow'],
    blurb:'Dark tricks and nasty surprises, Umbreon in front. Fighting and Bug punish them.', calib:1.657, mix:0.975 },
];
const CHAMPION2 = { id:'lance2', person:'lance', name:'Lance', title:'Champion', gen:2, theme:['Dragon', 'Flying'], exclude:['Poison', 'Bug', 'Normal', 'Psychic', 'murkrow'],
  also:['charizard', 'tyranitar', 'kingdra', 'seadra'], bossOnly:['dratini', 'dragonair', 'dragonite'],
  guards:['ampharos','arcanine','piloswine'],
  signature:['dragonite', 'kingdra', 'gyarados'],
  blurb:'The Dragon master, now Champion: Dragonite after Dragonite. Ice and Dragon, and nerve.', calib:1.647 };
const RIVAL2 = { id:'silver', name:'Silver', title:'Rival', gen:2, theme:null, bird:'zubat', support:null,
  starters:{ Grass:'chikorita', Fire:'cyndaquil', Water:'totodile' },
  blurb:'He stole his starter, and it beats yours. Three times a run, getting meaner each time.' };
RIVAL.bird = 'pidgey'; RIVAL.support = 'eevee'; RIVAL.person = 'blue'; CHAMPION.person = 'blue';
for(const b of [...GYMS, ...ELITE_FOUR, CHAMPION, RIVAL]) b.gen = b.gen || 1;
/** Every boss of every gen, for lookups. ALL_BOSSES stays Gen 1. */
const EVERY_BOSS = [...ALL_BOSSES, ...GYMS2, ...ELITE_FOUR2, CHAMPION2];
const bossById = id => EVERY_BOSS.find(b => b.id === id) || [RIVAL, RIVAL2].find(b => b.id === id) || null;
const GEN_BOSSES = {
  1: { gyms: GYMS,  elite: ELITE_FOUR,  champion: CHAMPION,  rival: RIVAL },
  2: { gyms: GYMS2, elite: ELITE_FOUR2, champion: CHAMPION2, rival: RIVAL2 },
};
const personOf = b => b.person || b.id;
/** The boss line-up for a new run. One gen: that gen's leaders in their own
    order. Several: the champion is drawn first, then the rival (never the same
    person), then the Elite Four and the gyms from what's left, shuffled — so
    each person appears at most once. Pure: seed and gens only. */
function drawBossPlan(seed, gens){
  gens = cleanGens(gens);
  const ids = x => x.map(b => b.id);
  if(gens.length === 1){ const g = GEN_BOSSES[gens[0]];
    return { gyms: ids(g.gyms), elite: ids(g.elite), champion: g.champion.id, rival: g.rival.id }; }
  const r = makeRng(mix32(((seed || 1) ^ 0x6e2b1f3d) >>> 0, 404));
  const shuffle = a => { a = a.slice(); for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const used = new Set(), take = b => { used.add(personOf(b)); return b; };
  const free = arr => arr.filter(b => !used.has(personOf(b)));
  const champion = take(shuffle(gens.map(g => GEN_BOSSES[g].champion))[0]);
  const rival = take(shuffle(free(gens.map(g => GEN_BOSSES[g].rival)))[0]);
  const draw = (pool, n) => { const out = []; for(const b of shuffle(pool)){ if(out.length >= n) break; if(!used.has(personOf(b))) out.push(take(b)); } return out; };
  const elite = draw(gens.flatMap(g => GEN_BOSSES[g].elite), TUNING.eliteFourCount);   // the Elite Four first, so Koga or Bruno there leaves the gyms
  const gyms = draw(gens.flatMap(g => GEN_BOSSES[g].gyms), TUNING.badgesToWin);
  return { gyms: ids(gyms), elite: ids(elite), champion: champion.id, rival: rival.id };
}
/** The run's bosses as objects. No game, or an old save: the classic Gen 1 run. */
function bossPlanOf(G){
  const p = (G && G.bossPlan) || null;
  if(!p) return { gyms: GYMS, elite: ELITE_FOUR, champion: CHAMPION, rival: RIVAL };
  return { gyms: p.gyms.map(bossById), elite: p.elite.map(bossById), champion: bossById(p.champion), rival: bossById(p.rival) || RIVAL };
}
const rivalOf = G => bossPlanOf(G).rival;
/** The leader whose badge is the b-th of this run (badge names, the badge case). */
const gymAt = (G, b) => { const g = bossPlanOf(G).gyms; return g[b % g.length]; };
/** Where a boss sits in its own gen: { kind, slot }. */
function homeOf(b){
  for(const g of [1, 2]){ const set = GEN_BOSSES[g];
    let i = set.gyms.indexOf(b); if(i >= 0) return { kind:'gym', slot:i };
    i = set.elite.indexOf(b); if(i >= 0) return { kind:'elite', slot:i };
    if(set.champion === b) return { kind:'champion', slot:0 }; }
  return null;
}
/** 4.0.0: a boss's correction for the slot it fights in. At home (a single-gen
    run, or a mixed run that happens to put them in their own slot) it is their
    own `calib`, so Gen 1 plays exactly as before. Moved, it is the average calib
    of the bosses who live in that slot, times the boss's own `mix` factor —
    Brock in slot 8 is priced like an eighth gym, not like a first. */
function bossCalib(G, st){
  const b = st && st.boss; if(!b) return 1;
  const slot = st.kind === 'gym' ? (st.badge || 0) : st.kind === 'elite' ? Math.max(0, (G.stage || 0) - gauntletStart()) : 0;
  const home = homeOf(b);
  if(!home || (home.kind === st.kind && home.slot === slot)) return b.calib || 1;
  const gens = cleanGens(G && G.gens);
  const key = st.kind === 'gym' ? 'gyms' : st.kind === 'elite' ? 'elite' : 'champion';
  const refs = gens.map(g => key === 'champion' ? GEN_BOSSES[g].champion : GEN_BOSSES[g][key][slot]).filter(Boolean);
  const base = refs.length ? refs.reduce((s, x) => s + (x.calib || 1), 0) / refs.length : (b.calib || 1);
  return base * (b.mix || 1);
}
/** The species a themed leader can draw on. No theme = the whole roster. */
function themePool(themeOrBoss){
  /* 2.10.0: takes a leader too. `also` adds named species that the typing alone
     misses (Seel and Shellder for Lorelei's Ice), `exclude` drops a Gen 1 type
     so two leaders don't share a bench (Koga leaves the Ghosts to Agatha). */
  const boss = themeOrBoss && !Array.isArray(themeOrBoss) ? themeOrBoss : null;
  const theme = boss ? boss.theme : themeOrBoss;
  const all = Object.keys(SPECIES).filter(k => !SPECIES[k].legendary && (boss ? inBossPool(k) || !!(boss.bossOnly && boss.bossOnly.includes(k)) : inGens(k)));   // 2.1.0: no trainer fields a legendary; 4.0.0: a leader draws on the run's whole region, the Daycare only on what's sold
  if(!theme) return all;
  const types = k => (SPECIES[k].gen1 || '').split('/');
  return all.filter(k => {
    if(boss && boss.exclude && boss.exclude.some(t => t === k || types(k).includes(t))) return false;   // 3.2.0: an entry can also be a species id
    return theme.some(t => types(k).includes(t)) || !!(boss && boss.also && boss.also.includes(k));
  });
}
/* Slot counts. These run off the same effective tier as the roster, not off
   badges alone — a player stuck on a gym was getting tier-5 pokémon in the
   Daycare and no held-item shelf to equip them from. One clock, everywhere. */
const daycareSlotsFor = tier => (tier < 2 ? 4 : tier < 4 ? 5 : 6);
/* Medicine & stones, by tier. This is a TABLE rather than a formula because it
   is the real throttle on how fast a player can grow: measured over 250 runs, a
   fixed 3-slot shelf absorbed only ~11₽ of a ~30₽ turn from turn 8 on, and the
   surplus either evaporated over the carry cap or went into rerolling — which
   was a 1₽ bypass around this very limit and doubled the clear rate. Widening
   the shelf gives the income somewhere honest to go. Sweep it with econ7.js. */
const martSlotsFor = tier =>
  TUNING.martSlots[Math.max(0, Math.min(TUNING.martSlots.length - 1, tier - 1))];
/* Held items are EXTRA shelf, not a share of it. Taking a consumable slot away
   to make room for them measurably weakened the player — medicine stacks every
   turn, so losing a slot of it costs compounding stats. The Mart grows instead. */
function heldSlotsFor(tier){
  if(tier < TUNING.heldFromTier) return 0;
  return Math.min(TUNING.heldSlotsMax, 1 + Math.floor((tier - TUNING.heldFromTier) / 2));
}

/* ===================================================================
   TYPES — the real Gen 1 types (3.0.0, Sean), one type per pokémon.
   A pokémon's type is its MAIN type (its `gen1` string keeps the full Gen 1
   typing, which leaders still theme on). The one exception is Normal/Flying,
   which counts as Flying. Fourteen types have members; Poison has no main-type
   member, so it is left out.

   The matchups are the standard chart without Dark, Steel and Fairy. Where the
   games give ×0 (Ghost vs Normal, Ground vs Flying, Electric vs Ground, and
   Normal / Fighting vs Ghost) the game uses a resist (×½), so no attack ever
   does nothing. Each type can be weak to and resist several types; the two
   lists are derived from this one table so they can never disagree.
   =================================================================== */
const TYPE_CHART = {
  //          strong against                        not very effective against
  Normal:   { strong:[],                               notVery:['Rock','Ghost','Steel'] },
  Fire:     { strong:['Grass','Ice','Bug','Steel'],    notVery:['Fire','Water','Rock','Dragon'] },
  Water:    { strong:['Fire','Ground','Rock'],         notVery:['Water','Grass','Dragon'] },
  Electric: { strong:['Water','Flying'],               notVery:['Electric','Grass','Dragon','Ground'] },
  Grass:    { strong:['Water','Ground','Rock'],        notVery:['Fire','Grass','Poison','Flying','Bug','Dragon','Steel'] },
  Ice:      { strong:['Grass','Ground','Flying','Dragon'], notVery:['Fire','Water','Ice','Steel'] },
  Fighting: { strong:['Normal','Ice','Rock','Steel','Dark'], notVery:['Flying','Poison','Psychic','Bug','Ghost'] },
  Ground:   { strong:['Fire','Electric','Poison','Rock','Steel'], notVery:['Grass','Bug','Flying'] },
  Flying:   { strong:['Grass','Fighting','Bug'],       notVery:['Electric','Rock','Steel'] },
  Poison:   { strong:['Grass'],                        notVery:['Poison','Ground','Rock','Ghost','Steel'] },   // 3.1.0
  Psychic:  { strong:['Fighting','Poison'],            notVery:['Psychic','Steel','Dark'] },
  Bug:      { strong:['Grass','Psychic','Dark'],       notVery:['Fire','Fighting','Poison','Flying','Ghost','Steel'] },
  Rock:     { strong:['Fire','Ice','Flying','Bug'],    notVery:['Fighting','Ground','Steel'] },
  Ghost:    { strong:['Psychic','Ghost'],              notVery:['Normal','Dark','Steel'] },
  Dragon:   { strong:['Dragon'],                       notVery:['Steel'] },
  /* 4.0.0 — the Gen 2 types. No Gen 1 pokémon has either, so Gen 1 matchups are unchanged.
     Gen 2's immunities (Psychic vs Dark, Poison vs Steel) are resists here, like the rest. */
  Steel:    { strong:['Ice','Rock'],                   notVery:['Fire','Water','Electric','Steel'] },
  Dark:     { strong:['Psychic','Ghost'],              notVery:['Fighting','Dark','Steel'] },
};
const TYPE_COLORS = { Normal:'#a9a79b', Fire:'#f2622e', Water:'#3d8bf0', Electric:'#e8c020', Grass:'#57b85f', Ice:'#7fd0e0',
  Fighting:'#c1452f', Ground:'#d8b460', Flying:'#8fa3f0', Psychic:'#b04fc4', Poison:'#d05fae', Bug:'#a2c034', Rock:'#b8a038', Ghost:'#6a5a9a', Dragon:'#7050e8', Steel:'#9aa3b5', Dark:'#6b5648' };
/** { color, weak:[types that deal ×2 to it], resist:[types it takes ×½ from] } for each type. */
const TYPES = {};
for(const d of Object.keys(TYPE_CHART)){
  TYPES[d] = { color: TYPE_COLORS[d],
    weak:   Object.keys(TYPE_CHART).filter(a => TYPE_CHART[a].strong.includes(d)),
    resist: Object.keys(TYPE_CHART).filter(a => TYPE_CHART[a].notVery.includes(d)) };
}
/** The single type a pokémon gets from its Gen 1 typing: the first type, or Flying for Normal/Flying. */
const singleTypeOf = gen1 => {
  const g = String(gen1 || '').split('/');
  return g.includes('Normal') && g.includes('Flying') ? 'Flying' : g[0];
};
/** Kept for the tests: the type a pokémon should have from its Gen 1 typing. */
const tcgTypeFor = id => { const sp = SPECIES[id]; return sp && sp.gen1 ? singleTypeOf(sp.gen1) : null; };

function typeMult(atkType, defType){
  const d = TYPES[defType];
  if(!d) return 1;
  if(d.weak.includes(atkType))   return TUNING.weakMult;
  if(d.resist.includes(atkType)) return TUNING.resistMult;
  return 1;
}

/* ---- roles ----
   Display data for the four roles. Numbers live in TUNING.roles. */
const ROLES = {
  tank:    { name:'Tank',    icon:'🛡️', trait:'Bodyguard',
             text:() => 'Soaks hits. Grows mostly HP. Bodyguard: an attack aimed at its front rank always lands on it.' },
  bruiser: { name:'Bruiser', icon:'👊', trait:'Steady',
             text:() => `Even all-rounder. Grows evenly. Steady: takes ${Math.round((1 - TUNING.roles.bruiser.dmgTaken)*100)}% less from every hit, and super-effective hits deal ×${TUNING.roles.bruiser.superTaken} to it, not ×${TUNING.weakMult}.` },
  cannon:  { name:'Cannon',  icon:'💥', trait:'Covering Fire',
             text:() => `Glass cannon. Grows mostly Attack. Covering Fire: +${Math.round(TUNING.roles.cannon.backBoost*100)}% damage while it stands behind your front rank and a Tank or Bruiser holds it.` },
  support: { name:'Support', icon:'✚', trait:'Aftercare',
             text:() => `Keeps the team going. Grows HP and Speed. Aftercare: every round it heals its most-hurt teammate ${Math.round(TUNING.roles.support.careRound*100)}% of that pokémon's HP.` },
};
const ROLE_ORDER = { tank:0, bruiser:1, support:2, cannon:3 };
/** A pokémon's role, from its species (so it changes if it evolves into another). */
const roleOf = x => {
  const id = typeof x === 'string' ? x : x && x.id;
  return (SPECIES[id] && SPECIES[id].role) || 'bruiser';
};
/* Add stat growth to a pokémon, split by its role. `d` is the even amount
   ({hp,atk,spd}) the old flat rules gave; each stat is multiplied by the role's
   weight. Fractions are banked on the unit (u.gf) rather than rounded away, so
   a Tank's 0.6 × 1 Speed is a point every few battles, not never. */
function growUnit(u, d){
  const w = (TUNING.roles[roleOf(u)] || TUNING.roles.bruiser).grow;
  const lg = SPECIES[u.id] && SPECIES[u.id].legendary ? TUNING.legend.growth : 1;   // 2.1.0
  u.gf = u.gf || { hp:0, atk:0, spd:0 };
  for(const k of ['hp','atk','spd']){
    const x = (d[k] || 0) * w[k] * lg + (u.gf[k] || 0);
    const n = Math.floor(x + 1e-9);
    u[k] += n; u.gf[k] = x - n;
  }
  return u;
}
/** The order a sensible trainer lines up in: tanks, bruisers, supports, cannons.
    Stable within a role, so a player's own order among equals is kept. */
/** Line a party up by role, filling the formation front-first (the button). */
function lineUpByRole(G){
  const order = formationSort(G.team);
  order.forEach((u, i) => { u.pos = i; });
  G.team.splice(0, G.team.length, ...order);
  return G;
}
function formationSort(team){
  return team.map((u, i) => ({ u, i }))
    .sort((a, b) => ROLE_ORDER[roleOf(a.u)] - ROLE_ORDER[roleOf(b.u)] || a.i - b.i)
    .map(x => x.u);
}

/* ---- scaling + display helpers ---- */
const pw  = (base, l) => base * (1 + TUNING.movePowerPerLevel * ((l || 1) - 1));
const pct = (base, l) => Math.round(pw(base, l) * 100) + '%';
const sc  = (base, l) => Math.round(base * (1 + 0.5 * ((l || 1) - 1)));
/* A share (0.08 = 8%) that grows with level like sc(), and its label. */
const sf  = (f, l) => f * (1 + 0.5 * ((l || 1) - 1));
const sfp = (f, l) => Math.round(sf(f, l) * 100) + '%';

/* ===================================================================
   MOVE FACTORIES
   Every move in the game is one of these shapes. To rebalance a pokémon
   change the numbers in its SPECIES line; to invent a new KIND of move,
   add a factory here.
   =================================================================== */
const M = {
  /* plain damage to the enemy front */
  hit: (name, p) => ({ name, text:l=>`Deals ${pct(p,l)} damage.`,
    fn:(u,B,l)=>{ const t=B.front(u); if(t) B.hit(u,t,pw(p,l)); } }),

  /* hits every enemy */
  all: (name, p) => ({ name,
    text:l=>`Hits every enemy: ${pct(p,l)} to the front rank, ${pct(p*TUNING.spreadBack,l)} to everyone behind it.`,
    fn:(u,B,l)=>{ B.enemies(u).forEach(t=>B.hit(u,t,pw(p,l) * (B.isFront(t) ? 1 : TUNING.spreadBack))); } }),

  /* hits the two frontmost enemies */
  two: (name, p) => ({ name, text:l=>`Hits the enemy's whole front rank for ${pct(p,l)} each.`,
    fn:(u,B,l)=>{ B.frontRank(u).forEach(t=>B.hit(u,t,pw(p,l))); } }),

  /* several hits on the front enemy */
  multi: (name, p, n) => ({ name, text:l=>`Strikes the front rank ${n} times for ${pct(p,l)} each.`,
    fn:(u,B,l)=>{ for(let i=0;i<n;i++){ const t=B.front(u); if(t) B.hit(u,t,pw(p,l)); } } }),

  /* snipes past the front line */
  fast: (name, p) => ({ name, text:l=>`Deals ${pct(p,l)} to the FASTEST enemy, ignoring the front line.`,
    fn:(u,B,l)=>{ const t=B.fastest(u); if(t) B.hit(u,t,pw(p,l)); } }),

  big: (name, p) => ({ name, text:l=>`Deals ${pct(p,l)} to the enemy with the most HP, ignoring the front line.`,
    fn:(u,B,l)=>{ const t=B.biggest(u); if(t) B.hit(u,t,pw(p,l),{ignoreResist:true}); } }),

  /* damage that ignores resistance / all type matchups */
  pierce: (name, p) => ({ name, text:l=>`Deals ${pct(p,l)} damage that is never resisted.`,
    fn:(u,B,l)=>{ const t=B.front(u); if(t) B.hit(u,t,pw(p,l),{ignoreResist:true}); } }),

  trueHit: (name, p) => ({ name, text:l=>`Deals ${pct(p,l)} damage, ignoring type matchups entirely.`,
    fn:(u,B,l)=>{ const t=B.front(u); if(t) B.hit(u,t,pw(p,l),{noType:true}); } }),

  /* lifesteal */
  drain: (name, p, frac) => ({ name,
    text:l=>`Deals ${pct(p,l)} damage and heals itself for ${Math.round(frac*100)}% of it.`,
    fn:(u,B,l)=>{ const t=B.front(u); if(!t) return; const d=B.hit(u,t,pw(p,l)); B.heal(u,Math.ceil(d*frac),u); } }),

  /* damage + speed debuff */
  slow: (name, p, n) => ({ name,
    text:l=>`Deals ${pct(p,l)} damage and cuts the target's Speed by ${sc(n,l)}.`,
    fn:(u,B,l)=>{ const t=B.front(u); if(!t) return; B.hit(u,t,pw(p,l)); B.slow(t,sc(n,l)); } }),

  /* damage + attack debuff */
  weaken: (name, p, n) => ({ name,
    text:l=>`Deals ${pct(p,l)} damage and cuts the target's Attack by ${sc(n,l)}.`,
    fn:(u,B,l)=>{ const t=B.front(u); if(!t) return; B.hit(u,t,pw(p,l));
      B.boost(t,{atk:-sc(n,l)}); B.log(`${t.nm}'s Attack fell.`); } }),

  /* big damage, hurts itself */
  recoil: (name, p, n) => ({ name, text:l=>`Deals ${pct(p,l)} damage and takes ${n} recoil.`,
    fn:(u,B,l)=>{ const t=B.front(u); if(!t) return; B.hit(u,t,pw(p,l)); B.recoil(u,n); } }),

  /* ramps its own attack every turn */
  ramp: (name, p, n) => ({ name,
    text:l=>`Deals ${pct(p,l)} damage, then gains +${sc(n,l)} Attack for the rest of the battle.`,
    fn:(u,B,l)=>{ const t=B.front(u); if(t) B.hit(u,t,pw(p,l)); B.boost(u,{atk:sc(n,l)}); } }),

  /* pure defence, stacking */
  guard: (name, hp, red) => ({ name,
    text:l=>`No damage. Gains +${sc(hp,l)} HP and blocks ${sc(red,l)} more damage per hit, stacking — `
      + `up to +${Math.round(TUNING.moveGuardCap.hpPct*100)}% HP and ${TUNING.moveGuardCap.reducePerLevel*l} blocked per battle.`,
    fn:(u,B,l)=>{ B.fortify(u, sc(hp,l), sc(red,l)); } }),

  /* damage + heals your own front pokémon by a share of ITS max HP.
     (A flat number until v28 — 9 HP was a lot on turn 3 and nothing on turn 30.) */
  heal: (name, p, f) => ({ name,
    text:l=>`Deals ${pct(p,l)} damage and heals your front pokémon ${sfp(f,l)} of its HP.`,
    fn:(u,B,l)=>{ const t=B.front(u); if(t) B.hit(u,t,pw(p,l));
      const a=B.ownFront(u); if(a && a.hp < a.maxHp){ const n=B.heal(a, Math.max(1, Math.round(a.maxHp*sf(f,l))), u);
        if(n) B.log(`${a.nm} was healed (+${n} HP).`); } } }),

  /* SUPPORT: damage + heals whichever teammate is most hurt (itself included) */
  mend: (name, p, f) => ({ name,
    text:l=>`Deals ${pct(p,l)} damage, then heals your most-hurt pokémon ${sfp(f,l)} of its HP.`,
    fn:(u,B,l)=>{ const t=B.front(u); if(t) B.hit(u,t,pw(p,l));
      const a=B.mostHurt(u); if(a){ const n=B.heal(a, Math.max(1, Math.round(a.maxHp*sf(f,l))), u);
        if(n) B.log(`${a.nm} was healed (+${n} HP).`); } } }),

  /* SUPPORT: damage + raises the whole team's Attack by a share of each one's own */
  rally: (name, p, f) => ({ name,
    text:l=>`Deals ${pct(p,l)} damage and raises your whole team's Attack by ${sfp(f,l)} — `
      + `up to ${TUNING.rallyMax} times per battle for each pokémon.`,
    fn:(u,B,l)=>{ const t=B.front(u); if(t) B.hit(u,t,pw(p,l));
      let n=0;
      for(const a of B.teams[u.side]){
        if(a.dead || (a.rallies||0) >= TUNING.rallyMax) continue;
        a.rallies = (a.rallies||0) + 1; n++;
        B.boost(a, { atk: Math.max(1, Math.round(a.atk0 * sf(f,l))) });
      }
      if(n) B.log(`Your team's Attack rose!`); } }),

  /* SUPPORT: a weak hit on EVERY enemy that also cuts each one's Speed */
  hush: (name, p, n) => ({ name,
    text:l=>`Hits every enemy for ${pct(p,l)} and cuts each one's Speed by ${sc(n,l)}.`,
    fn:(u,B,l)=>{ B.enemies(u).forEach(t=>{ B.hit(u,t,pw(p,l)); if(!t.dead) B.slow(t,sc(n,l)); }); } }),

  /* does nothing but grows */
  grow: (name, n) => ({ name, text:l=>`Does nothing at all — but permanently gains +${sc(n,l)} Attack.`,
    fn:(u,B,l)=>{ B.log('Nothing happened… yet.'); B.boost(u,{atk:sc(n,l)}); } }),

  /* a heavy move on a cooldown, with a weak filler in between */
  charge: (name, p, basicName, basicP) => ({ name, every:2, basic:{ name:basicName, mult:basicP },
    text:l=>`Every 2nd turn: ${pct(p,l)} damage. Otherwise ${basicName}, ${pct(basicP,l)}.`,
    fn:(u,B,l)=>{ const t=B.front(u); if(t) B.hit(u,t,pw(p,l)); } }),

  /* rewards being the front pokémon */
  wall: (name, p, pFront) => ({ name,
    text:l=>`Deals ${pct(p,l)} damage — ${pct(pFront,l)} while it stands in your front rank.`,
    fn:(u,B,l)=>{ const t=B.front(u); if(!t) return; B.hit(u,t, B.isFront(u) ? pw(pFront,l) : pw(p,l)); } }),

  /* ---- v32: status, targeting and team moves ---- */
  /* damage (or none) plus a chance of a status, on a chosen target */
  afflict: (name, p, st, chance, target) => ({ name,
    text:l=>`${p ? `Deals ${pct(p,l)} damage to ${TARGET_TEXT[target||'front']}` : `Aims at ${TARGET_TEXT[target||'front']}`}${
      chance >= 1 ? ` and ${STATUS_VERB[st]}.` : ` — ${Math.round(chance*100)}% chance to ${STATUS_VERB[st].replace(/^(\w+)s /, '$1 ')}.`}`,
    fn:(u,B,l)=>{ const t=B.pickTarget(u, target||'front'); if(!t) return; if(p) B.hit(u,t,pw(p,l)); B.inflict(t, st, chance); } }),
  /* the enemy with the least HP left — a finisher */
  weakest: (name, p) => ({ name, text:l=>`Deals ${pct(p,l)} to the enemy with the least HP left, wherever it stands.`,
    fn:(u,B,l)=>{ const t=B.pickTarget(u,'weakest'); if(t) B.hit(u,t,pw(p,l)); } }),
  /* the back-most enemy */
  back: (name, p) => ({ name, text:l=>`Deals ${pct(p,l)} to the enemy furthest back.`,
    fn:(u,B,l)=>{ const t=B.pickTarget(u,'back'); if(t) B.hit(u,t,pw(p,l)); } }),
  /* any enemy at random */
  random: (name, p) => ({ name, text:l=>`Deals ${pct(p,l)} to a random enemy, front or back.`,
    fn:(u,B,l)=>{ const t=B.pickTarget(u,'random'); if(t) B.hit(u,t,pw(p,l)); } }),
  /* a barrier that soaks damage: on itself, the most-hurt ally, or the whole team */
  shield: (name, f, who) => ({ name,
    text:l=>`No damage. ${who === 'team' ? 'Your whole team gets' : who === 'hurt' ? 'Your most-hurt pokémon gets' : 'Gets'} a barrier worth ${sfp(f,l)} of ${who === 'team' ? 'each one’s' : 'its'} HP that soaks up hits.`,
    fn:(u,B,l)=>{ const ts = who === 'team' ? B.teams[u.side].filter(x=>!x.dead) : [who === 'hurt' ? (B.mostHurt(u) || u) : u];
      for(const t of ts) B.barrier(t, Math.max(1, Math.round(t.maxHp * sf(f,l)))); } }),
  /* 3.3.0: shatters the target's barrier, then hits — the answer to Iron Defense and Reflect */
  breaker: (name, p) => ({ name, text:l=>`Deals ${pct(p,l)} damage and shatters the target's barrier first, so nothing is soaked.`,
    fn:(u,B,l)=>{ const t=B.front(u); if(!t) return;
      if(t.shield > 0){ B.log(`${u.nm} broke ${t.nm}'s barrier!`); t.shield = 0; }
      B.hit(u,t,pw(p,l)); } }),
  /* 3.4.0: more answers, like Brick Break. Each one hits, then takes away something the target was counting on. */
  haze: (name, p) => ({ name, text:l=>`Deals ${pct(p,l)} damage and wipes the target's Attack gains, Focus and stacked blocking.`,
    fn:(u,B,l)=>{ const t=B.front(u); if(!t) return; B.hit(u,t,pw(p,l));
      if(t.dead) return;
      if(t.atk > t.atk0 || t.focus || t.reduce){ t.atk = Math.min(t.atk, t.atk0); t.focus = 0; t.reduce = 0; B.log(`${u.nm} cleared ${t.nm}'s boosts!`); B.fx(t,'hit'); } } }),
  disable: (name, p) => ({ name, text:l=>`Deals ${pct(p,l)} damage and seals the target's second move for the rest of the battle.`,
    fn:(u,B,l)=>{ const t=B.front(u); if(!t) return; B.hit(u,t,pw(p,l));
      if(t.dead || t.sealed) return; const m2 = move2Of(t);
      if(m2){ t.sealed = true; B.log(`${u.nm} sealed ${t.nm}'s ${m2.name}!`); B.fx(t,'hit'); } } }),
  knock: (name, p) => ({ name, text:l=>`Deals ${pct(p,l)} damage and knocks the target's held item away for the rest of the battle.`,
    fn:(u,B,l)=>{ const t=B.front(u); if(!t) return; B.hit(u,t,pw(p,l));
      if(!t.dead && t.held){ B.log(`${u.nm} knocked off ${t.nm}'s ${(heldOf(t) || {}).name || 'item'}!`); t.held = null; t.itemReduce = 0; t.itemCut = 0; B.fx(t,'hit'); } } }),
  /* its next hit lands harder */
  focus: (name, f) => ({ name, text:l=>`No damage. Its next hit deals +${sfp(f,l)}.`,
    fn:(u,B,l)=>{ u.focus = Math.max(u.focus || 0, sf(f,l)); B.fx(u,'buff'); B.log(`${u.nm} is getting pumped!`); } }),
  /* heal itself */
  recover: (name, f, sleeps) => ({ name,
    text:l=>`No damage. Heals itself ${sfp(f,l)} of its HP${sleeps ? ', then falls asleep for 2 actions' : ''}.`,
    fn:(u,B,l)=>{ const n = B.heal(u, Math.round(u.maxHp * sf(f,l)), u); if(n || !heldOf(u) || !heldOf(u).noHeal) B.log(`${u.nm} regained ${n} HP.`);
      if(sleeps){ u.st = { id:'slp', left:2 }; B.log(`${u.nm} fell asleep.`); } } }),
  /* cure the team's statuses, and heal them a little */
  cleanse: (name, f) => ({ name, text:l=>`No damage. Cures your whole team's status conditions and heals each ${sfp(f,l)}.`,
    fn:(u,B,l)=>{ for(const a of B.teams[u.side]){ if(a.dead) continue; if(a.st){ a.st = null; } B.heal(a, Math.round(a.maxHp * sf(f,l)), u); }
      B.log('A soothing aroma filled the air.'); } }),
  /* move itself to the back of the formation */
  teleport: (name) => ({ name, text:()=>`No damage. Moves itself to the back of your formation.`,
    fn:(u,B)=>{ const arr = B.teams[u.side], used = new Set(arr.map(x => x.pos));
      let to = -1; for(let p = TUNING.maxTeam - 1; p > u.pos; p--) if(!used.has(p)){ to = p; break; }
      if(to < 0){ B.log('But there was nowhere further back to go.'); return; }
      u.pos = to; arr.sort((a, b) => a.pos - b.pos); B.fx(u,'buff'); B.log(`${u.nm} teleported to the back!`); } }),
};

/* 2.5.0: every move remembers what KIND of effect it is (`kind`, plus a status and
   target for afflicting moves) as `sig`. One move name must mean one effect on
   every pokémon that has it; only the percentages may differ. movenames.js checks it. */
for(const k of Object.keys(M)){
  const f = M[k];
  M[k] = (...a) => Object.assign(f(...a), { kind:k, sig: k === 'afflict' ? `afflict:${a[2]}:${a[4] || 'front'}` : k });
}

/* A second move fires INSTEAD of the main move when its trigger is met:
     open    — its first action of the battle (priority: before anyone else)
     every   — every nth action
     low     — once, the first time it drops below half HP
     allyLow — when a teammate is below half HP (not twice in a row)          */
const TRIGGER_TEXT = {
  open:    m => m.priority ? 'First, before anyone moves' : m.free ? 'At the start, for free' : 'Its first action',
  every:   m => `Every ${m.n}${m.n === 2 ? 'nd' : m.n === 3 ? 'rd' : 'th'} action`,
  low:     () => 'Once, below half HP',
  allyLow: () => 'When a teammate is below half HP',
};
const on = (trig, move, extra) => ({ ...move, trig, ...(extra || {}),
  when: function(){ return TRIGGER_TEXT[trig](this); } });
const TARGET_TEXT = { biggest:'the enemy with the most HP', front:'the enemy front', random:'a random enemy', fastest:'the fastest enemy', back:'the enemy furthest back', weakest:'the weakest enemy' };
const STATUS_VERB = { brn:'burns it', psn:'poisons it', par:'paralyses it', slp:'puts it to sleep', cnf:'confuses it', fln:'makes it flinch' };

/* ===================================================================
   SPECIES — Gen 1, organised by evolution line.
   -------------------------------------------------------------------
   hp/atk/spd : base stats
   evo        : { into, by:'level' }            evolves on level up
                { into, by:'stone', stone:id }  needs that evolution stone
                { by:'stone', branches:{ stone:into, … } }  (1.3.0) the stone
                                                 picks the evolution — Eevee
   token      : true -> never sold in the Daycare (evolved forms only)
   -------------------------------------------------------------------
   A pokémon with no `evo` left gets TUNING.levelUpBonusMax on level up
   instead of an evolution, so final forms and non-evolvers keep pace.
   =================================================================== */
/* 2.5.0: the starter lines swapped jobs — Bulbasaur's is a Tank now, Squirtle's a
   Bruiser. [hp, atk, spd] for the base, middle and final form of each. */
const BULB   = { b:[18, 12, 29], i:[28, 21, 39], v:[56, 41, 52] };   // 3.2.0: Venusaur +4 HP, +2 Attack; 3.4.0: +6 HP
const PARAS  = { b:[26, 25, 32], e:[54, 64, 46] };    // 2.6.0
const TANGELA = [70, 44, 38];   // 2.8.0; 3.4.0: sturdier and it hits harder from the front
const MANKEY = { b:[16, 24, 44], e:[32, 45, 58] };   // 3.1.0
const ZUBAT  = { b:[18, 18, 48], e:[50, 42, 62] };
const KOFF   = { b:[26, 16, 26], e:[50, 30, 32] };
const BELL   = { b:[16, 26, 32], m:[28, 46, 44], e:[42, 64, 52] };   // 2.6.1
const EGG    = { b:[22, 32, 36], e:[52, 76, 54] };
const SQUIRT = { b:[16, 12, 30], w:[26, 24, 40], l:[42, 46, 53] };   // 3.2.0: Blastoise +4 Attack
const WEED   = { b:[12, 18, 40], m:[36, 12, 24], e:[28, 50, 60] };   // 3.8.0
const SPEAR  = { b:[12, 17, 52], e:[26, 36, 60] };
const DODU   = { b:[18, 20, 48], e:[38, 28, 60] };
const DIG    = { b:[10, 19, 58], e:[22, 36, 66] };
const SAND   = { b:[22, 17, 28], e:[42, 44, 44] };
const NIDF   = { b:[26, 14, 26], m:[38, 24, 32], e:[50, 40, 38] };
const NIDM   = { b:[14, 20, 44], m:[26, 34, 52], e:[38, 63, 58] };
const FARF   = [34, 38, 54];
const PORY   = [46, 40, 48];
/* 4.0.0 — Gen 2 stat blocks: [hp, atk, spd] for each stage. */
const CHIK = { b:[16, 11, 30], m:[28, 20, 38], e:[50, 36, 50] };
const CYND = { b:[14, 16, 44], m:[24, 30, 54], e:[38, 50, 66] };
const TOTO = { b:[18, 14, 32], m:[30, 26, 40], e:[54, 50, 52] };
const HOOT = { b:[18, 10, 30], e:[64, 46, 58] };
const LEDY = { b:[14, 8, 32],  e:[34, 24, 50] };
const SPIN = { b:[14, 18, 24], e:[48, 56, 48] };
const MARI = { b:[20, 10, 30], e:[56, 46, 44] };
const MARE = { b:[18, 16, 26], m:[28, 28, 32], e:[56, 54, 46] };
const NATU = { b:[16, 18, 40], e:[56, 56, 70] };
const WOOP = { b:[24, 14, 16], e:[56, 40, 30] };
const SNUB = { b:[22, 22, 22], e:[60, 64, 44] };
const MURK = [32, 44, 60];
const TEDD = { b:[20, 24, 34], e:[56, 64, 46] };
const SWIN = { b:[22, 16, 20], e:[76, 60, 40] };
const PHAN = { b:[26, 20, 20], e:[58, 48, 32] };
const PINE = { b:[26, 18, 14], e:[56, 40, 26] };
const HOUN = { b:[14, 20, 40], e:[32, 48, 62] };
const GIRA = [60, 58, 62];
const MISD = [44, 54, 62];
const MILT = [60, 42, 50];
const SNEA = [26, 36, 64];
const SKAR = [46, 34, 44];
const HTOP = [34, 36, 54];
const HERA = [38, 52, 52];
const LARV = { b:[20, 22, 30], m:[36, 28, 24], e:[60, 62, 46] };
const MAGM = [30, 34, 62];
const HORS = { b:[14, 20, 46], m:[36, 42, 60], e:[42, 44, 58] };
const CROB = [53, 43, 74];
const BLIS = [76, 14, 44];
const PORY2 = [50, 42, 48];
const STLX = [54, 36, 30];
const SCIZ = [48, 60, 54];
const POLT = [52, 42, 46];
const BELO = [52, 40, 48];
const ESPE = [26, 42, 68];
const UMBR = [66, 34, 46];
const JOLT_TB = 0.5; const JOLT_N = 3;   // Jolteon's Thunderbolt: the front rank's share; the ranks behind take half (M.all)
/* 4.5.0 — the pool fill-ins: [hp, atk, spd] per stage. */
const OMAN = { b:[18, 24, 20], e:[56, 66, 36] };
const KABU = { b:[18, 24, 28], e:[42, 60, 50] };
const AERO = [34, 44, 66];
const SLOW = { b:[28, 16, 12], e:[64, 44, 22] };
const CELE = [68, 46, 86];   // 4.10.0: Celebi, a Support legendary (hp, atk, spd)
const SLOWK = [66, 42, 46];
const MIME = [38, 42, 58];
const PONY = { b:[18, 24, 46], e:[38, 48, 64] };
const CUBO = { b:[20, 20, 26], e:[48, 50, 34] };
const SUNK = { b:[20, 12, 26], e:[48, 52, 34] };
const GLIG = [40, 44, 54];
const SLUG = { b:[24, 18, 14], e:[52, 44, 22] };
const WOBB = [70, 10, 34];
const QWIL = [46, 54, 50];
const CHIN = { b:[26, 18, 24], e:[60, 42, 50] };
const TOGE = { b:[20, 10, 28], e:[50, 32, 54] };
const SPECIES = {

  /* ============ TIER 1 — starters and early routes ============ */
  caterpie:   { name:'Caterpie',   type:'Bug', gen1:'Bug', tier:1, role:'support', hp:14, atk:9,  spd:30,
                evo:{into:'metapod', by:'level'},    move:M.slow('String Shot', 1, 5) },
  metapod:    { name:'Metapod',    type:'Bug', gen1:'Bug', tier:1, role:'tank', hp:32, atk:12,  spd:20, token:true,
                evo:{into:'butterfree', by:'level'}, move:M.guard('Harden', 5, 1) },
  butterfree: { name:'Butterfree', type:'Bug', gen1:'Bug/Flying', tier:1, role:'support', hp:34, atk:34, spd:47, token:true,
                move:M.hush('Silver Wind', 0.5, 6) },

  bulbasaur:  { name:'Bulbasaur',  type:'Grass', gen1:'Grass/Poison', tier:1, role:'tank', hp:BULB.b[0], atk:BULB.b[1],  spd:BULB.b[2],
                evo:{into:'ivysaur', by:'level'},    move:M.drain('Absorb', 1.1, 0.5) },
  ivysaur:    { name:'Ivysaur',    type:'Grass', gen1:'Grass/Poison', tier:1, role:'tank', hp:BULB.i[0], atk:BULB.i[1],  spd:BULB.i[2], token:true,
                evo:{into:'venusaur', by:'level'},   move:M.drain('Mega Drain', 1.2, 0.5) },
  venusaur:   { name:'Venusaur',   type:'Grass', gen1:'Grass/Poison', tier:1, role:'tank', hp:BULB.v[0], atk:BULB.v[1], spd:BULB.v[2], token:true,
                move:M.drain('Giga Drain', 1.8, 1.0) },   // 3.4.0: a full-lifesteal Giga Drain

  charmander: { name:'Charmander', type:'Fire', gen1:'Fire',  tier:1, role:'cannon', hp:14, atk:15,  spd:43,
                evo:{into:'charmeleon', by:'level'}, move:M.hit('Ember', 1.3) },
  charmeleon: { name:'Charmeleon', type:'Fire', gen1:'Fire',  tier:1, role:'cannon', hp:24, atk:27,  spd:53, token:true,
                evo:{into:'charizard', by:'level'},  move:M.hit('Flamethrower', 1.5) },
  charizard:  { name:'Charizard',  type:'Fire', gen1:'Fire/Flying',  tier:1, role:'cannon', hp:44, atk:51, spd:67, token:true,
                move:M.charge('Fire Blast', 2.1, 'Slash', 1.0) },

  squirtle:   { name:'Squirtle',   type:'Water', gen1:'Water', tier:1, role:'bruiser', hp:SQUIRT.b[0], atk:SQUIRT.b[1],  spd:SQUIRT.b[2],
                evo:{into:'wartortle', by:'level'},  move:M.hit('Water Gun', 1.05) },
  wartortle:  { name:'Wartortle',  type:'Water', gen1:'Water', tier:1, role:'bruiser', hp:SQUIRT.w[0], atk:SQUIRT.w[1],  spd:SQUIRT.w[2], token:true,
                evo:{into:'blastoise', by:'level'},  move:M.hit('Water Gun', 1.2) },
  blastoise:  { name:'Blastoise',  type:'Water', gen1:'Water', tier:1, role:'bruiser', hp:SQUIRT.l[0], atk:SQUIRT.l[1], spd:SQUIRT.l[2], token:true,
                move:M.all('Surf', 0.9) },   // 3.3.0: Blastoise floods the whole field instead of charging one Hydro Pump

  pidgey:     { name:'Pidgey',     type:'Flying', gen1:'Normal/Flying', tier:1, role:'bruiser', hp:12, atk:12,  spd:37,
                evo:{into:'pidgeotto', by:'level'},  move:M.two('Gust', 0.7) },
  pidgeotto:  { name:'Pidgeotto',  type:'Flying', gen1:'Normal/Flying', tier:1, role:'bruiser', hp:22, atk:24,  spd:47, token:true,
                evo:{into:'pidgeot', by:'level'},    move:M.two('Wing Attack', 0.9) },
  pidgeot:    { name:'Pidgeot',    type:'Flying', gen1:'Normal/Flying', tier:1, role:'bruiser', hp:34, atk:34, spd:56, token:true,
                move:M.two('Sky Attack', 1.2) },

  rattata:    { name:'Rattata',    type:'Normal', gen1:'Normal', tier:1, role:'cannon', hp:12, atk:18,  spd:48,
                evo:{into:'raticate', by:'level'},   move:M.hit('Hyper Fang', 1.2) },
  raticate:   { name:'Raticate',   type:'Normal', gen1:'Normal', tier:1, role:'cannon', hp:24, atk:33, spd:65, token:true,
                move:M.recoil('Super Fang', 1.8, 3) },

  /* ============ TIER 2 ============ */
  geodude:    { name:'Geodude',    type:'Rock', gen1:'Rock/Ground', tier:2, role:'tank', hp:22, atk:15,  spd:13,
                evo:{into:'graveler', by:'level'},   move:M.wall('Rock Throw', 1.0, 1.7) },
  graveler:   { name:'Graveler',   type:'Rock', gen1:'Rock/Ground', tier:2, role:'tank', hp:34, atk:27,  spd:23, token:true,
                evo:{into:'golem', by:'level'},      move:M.wall('Rock Slide', 1.1, 1.8) },
  golem:      { name:'Golem',      type:'Rock', gen1:'Rock/Ground', tier:2, role:'tank', hp:56, atk:48, spd:30, token:true,
                move:M.wall('Earthquake', 1.3, 2.2) },

  machop:     { name:'Machop',     type:'Fighting', gen1:'Fighting', tier:2, role:'bruiser', hp:18, atk:21,  spd:23,
                evo:{into:'machoke', by:'level'},    move:M.hit('Karate Chop', 1.4) },
  machoke:    { name:'Machoke',    type:'Fighting', gen1:'Fighting', tier:2, role:'bruiser', hp:30, atk:33, spd:30, token:true,
                evo:{into:'machamp', by:'level'},    move:M.hit('Seismic Toss', 1.6) },
  machamp:    { name:'Machamp',    type:'Fighting', gen1:'Fighting', tier:2, role:'bruiser', hp:44, atk:51, spd:37, token:true,
                move:M.recoil('Submission', 2.0, 5) },

  poliwag:    { name:'Poliwag',    type:'Water', gen1:'Water', tier:2, role:'bruiser', hp:18, atk:15,  spd:60,
                evo:{into:'poliwhirl', by:'level'},  move:M.slow('Bubble', 1.0, 9) },
  poliwhirl:  { name:'Poliwhirl',  type:'Water', gen1:'Water', tier:2, role:'bruiser', hp:28, atk:24,  spd:60, token:true,
                evo:{into:'poliwrath', by:'level'},  move:M.multi('Doubleslap', 0.75, 2) },
  poliwrath:  { name:'Poliwrath',  type:'Water', gen1:'Water/Fighting', tier:2, role:'bruiser', hp:50, atk:50, spd:48, token:true,
                move:M.multi('Double Kick', 1.0, 2) },

  magikarp:   { name:'Magikarp',   type:'Water', gen1:'Water', tier:2, role:'bruiser', hp:12, atk:6,  spd:53,
                evo:{into:'gyarados', by:'level'},   move:M.grow('Splash', 3) },
  gyarados:   { name:'Gyarados',   type:'Water', gen1:'Water/Flying', tier:2, role:'bruiser', hp:52, atk:58, spd:58, token:true,
                move:M.charge('Hydro Pump', 2.2, 'Bite', 1.0) },

  pikachu:    { name:'Pikachu',    type:'Electric', gen1:'Electric', tier:2, role:'cannon', hp:14, atk:18,  spd:60,
                evo:{into:'raichu', by:'stone', stone:'thunderstone'},
                move:M.all('Thunder Shock', 0.42) },
  raichu:     { name:'Raichu',     type:'Electric', gen1:'Electric', tier:2, role:'cannon', hp:28, atk:36, spd:67, token:true,
                move:M.all('Thunderbolt', 0.6) },

  vulpix:     { name:'Vulpix',     type:'Fire', gen1:'Fire', tier:2, role:'cannon', hp:16, atk:18,  spd:43,
                evo:{into:'ninetales', by:'stone', stone:'firestone'},
                move:M.hit('Ember', 1.4) },
  ninetales:  { name:'Ninetales',  type:'Fire', gen1:'Fire', tier:2, role:'cannon', hp:32, atk:36, spd:67, token:true,
                move:M.hit('Flamethrower', 1.9) },

  /* ============ TIER 3 ============ */
  abra:       { name:'Abra',       type:'Psychic', gen1:'Psychic', tier:3, role:'cannon', hp:12, atk:21,  spd:60,
                evo:{into:'kadabra', by:'level'},    move:M.fast('Confusion', 1.0) },
  kadabra:    { name:'Kadabra',    type:'Psychic', gen1:'Psychic', tier:3, role:'cannon', hp:20, atk:33, spd:70, token:true,
                evo:{into:'alakazam', by:'level'},   move:M.fast('Confusion', 1.1) },
  alakazam:   { name:'Alakazam',   type:'Psychic', gen1:'Psychic', tier:3, role:'cannon', hp:28, atk:37, spd:70, token:true,
                move:M.fast('Psychic', 1.2) },

  gastly:     { name:'Gastly',     type:'Ghost', gen1:'Ghost/Poison', tier:3, role:'cannon', hp:12, atk:27,  spd:53,
                evo:{into:'haunter', by:'level'},    move:M.trueHit('Night Shade', 1.0) },
  haunter:    { name:'Haunter',    type:'Ghost', gen1:'Ghost/Poison', tier:3, role:'cannon', hp:20, atk:36, spd:63, token:true,
                evo:{into:'gengar', by:'level'},     move:M.trueHit('Lick', 1.2) },
  gengar:     { name:'Gengar',     type:'Ghost', gen1:'Ghost/Poison', tier:3, role:'cannon', hp:30, atk:44, spd:70, token:true,
                move:M.pierce('Shadow Ball', 1.35) },

  magnemite:  { name:'Magnemite',  type:'Electric', gen1:'Electric', tier:3, role:'tank', hp:18, atk:21,  spd:30,
                evo:{into:'magneton', by:'level'},   move:M.guard('Barrier', 4, 1) },
  magneton:   { name:'Magneton',   type:'Electric', gen1:'Electric', tier:3, role:'tank', hp:34, atk:38, spd:47, token:true,
                move:M.wall('Flash Cannon', 1.1, 1.8) },

  growlithe:  { name:'Growlithe',  type:'Fire', gen1:'Fire', tier:3, role:'bruiser', hp:22, atk:24,  spd:40,
                evo:{into:'arcanine', by:'stone', stone:'firestone'},
                move:M.recoil('Flame Wheel', 1.6, 3) },
  arcanine:   { name:'Arcanine',   type:'Fire', gen1:'Fire', tier:3, role:'bruiser', hp:38, atk:40, spd:60, token:true,
                move:M.hit('Flamethrower', 1.7) },

  staryu:     { name:'Staryu',     type:'Water', gen1:'Water', tier:3, role:'cannon', hp:20, atk:21,  spd:57,
                evo:{into:'starmie', by:'stone', stone:'waterstone'},
                move:M.pierce('Swift', 1.15) },
  starmie:    { name:'Starmie',    type:'Water', gen1:'Water/Psychic', tier:3, role:'cannon', hp:32, atk:31, spd:68, token:true,
                move:M.pierce('Swift', 1.5) },

  onix:       { name:'Onix',       type:'Rock', gen1:'Rock/Ground', tier:3, role:'tank', hp:48, atk:22, spd:47,
                move:M.wall('Rock Throw', 1.1, 1.9) },

  /* ============ TIER 4 ============ */
  seel:       { name:'Seel',       type:'Water', gen1:'Water', tier:4, role:'support', hp:30, atk:21,  spd:30,
                evo:{into:'dewgong', by:'level'},    move:M.weaken('Aurora Beam', 1.1, 11) },
  dewgong:    { name:'Dewgong',    type:'Water', gen1:'Water/Ice', tier:4, role:'support', hp:44, atk:36, spd:47, token:true,
                move:M.hush('Powder Snow', 0.4, 8) },

  drowzee:    { name:'Drowzee',    type:'Psychic', gen1:'Psychic', tier:4, role:'support', hp:24, atk:24,  spd:28,
                evo:{into:'hypno', by:'level'},      move:M.mend('Dream Eater', 1.1, 0.08) },
  hypno:      { name:'Hypno',      type:'Psychic', gen1:'Psychic', tier:4, role:'support', hp:46, atk:50, spd:46, token:true,
                move:M.mend('Dream Eater', 1.4, 0.12) },

  dratini:    { name:'Dratini',    type:'Dragon', gen1:'Dragon', tier:4, role:'bruiser', hp:20, atk:21,  spd:33,
                evo:{into:'dragonair', by:'level'},  move:M.hit('Wrap', 1.3) },
  dragonair:  { name:'Dragonair',  type:'Dragon', gen1:'Dragon', tier:4, role:'bruiser', hp:32, atk:36, spd:47, token:true,
                evo:{into:'dragonite', by:'level'},  move:M.hit('Dragon Breath', 1.6) },
  dragonite:  { name:'Dragonite',  type:'Dragon', gen1:'Dragon/Flying', tier:4, role:'bruiser', hp:50, atk:57, spd:53, token:true,
                move:M.charge('Hyper Beam', 2.4, 'Slam', 1.0) },

  scyther:    { name:'Scyther',    type:'Bug', gen1:'Bug/Flying', tier:4, role:'cannon', hp:24, atk:30, spd:70,
                move:M.ramp('Fury Cutter', 1.2, 12) },

  /* ============ TIER 5 — no evolutions, strong as they are ====== */
  hitmonlee:  { name:'Hitmonlee',  type:'Fighting', gen1:'Fighting', tier:5, role:'cannon', hp:26, atk:35, spd:54,
                move:M.recoil('Hi Jump Kick', 1.9, 4) },
  lapras:     { name:'Lapras',     type:'Water', gen1:'Water/Ice', tier:5, role:'support', hp:50, atk:35, spd:45,
                move:M.rally('Ice Beam', 1.3, 0.1) },
  electabuzz: { name:'Electabuzz', type:'Electric', gen1:'Electric', tier:5, role:'cannon', hp:28, atk:31, spd:66,
                move:M.hit('Thunder Punch', 1.5) },
  tauros:     { name:'Tauros',     type:'Normal', gen1:'Normal', tier:5, role:'bruiser', hp:38, atk:42, spd:73,
                move:M.hit('Take Down', 1.5) },


  /* ============ v28 — fourteen more Gen 1 pokémon, mostly Tanks and Supports ====
     The roster was built as fighters; these give the Tank and Support roles
     real depth, and each gym leader who had them in Gen 1 now fields them. */
  jigglypuff: { name:'Jigglypuff', type:'Normal', gen1:'Normal', tier:1, role:'support', hp:22, atk:9, spd:20,
                evo:{into:'wigglytuff', by:'stone', stone:'moonstone'}, move:M.hit('Pound', 0.9) },
  wigglytuff: { name:'Wigglytuff', type:'Normal', gen1:'Normal', tier:1, role:'support', hp:56, atk:38, spd:42, token:true,
                move:M.hush('Hyper Voice', 0.55, 7) },

  oddish:     { name:'Oddish',     type:'Grass', gen1:'Grass/Poison', tier:2, role:'support', hp:18, atk:15, spd:28,
                evo:{into:'gloom', by:'level'},      move:M.mend('Heal Pulse', 1.0, 0.07) },
  gloom:      { name:'Gloom',      type:'Grass', gen1:'Grass/Poison', tier:2, role:'support', hp:28, atk:24, spd:36, token:true,
                evo:{into:'vileplume', by:'level'},  move:M.mend('Floral Healing', 1.1, 0.09) },
  vileplume:  { name:'Vileplume',  type:'Grass', gen1:'Grass/Poison', tier:2, role:'support', hp:48, atk:44, spd:46, token:true,
                move:M.mend('Petal Dance', 1.3, 0.12) },

  voltorb:    { name:'Voltorb',    type:'Electric', gen1:'Electric', tier:2, role:'cannon', hp:16, atk:15, spd:63,
                evo:{into:'electrode', by:'level'},  move:M.hit('Sonic Boom', 1.3) },
  electrode:  { name:'Electrode',  type:'Electric', gen1:'Electric', tier:2, role:'cannon', hp:26, atk:22, spd:72, token:true,
                move:M.charge('Explosion', 1.8, 'Tackle', 0.9) },

  clefairy:   { name:'Clefairy',   type:'Normal', gen1:'Normal', tier:3, role:'support', hp:24, atk:18, spd:35,
                evo:{into:'clefable', by:'stone', stone:'moonstone'}, move:M.rally('Metronome', 0.8, 0.05) },
  clefable:   { name:'Clefable',   type:'Normal', gen1:'Normal', tier:3, role:'support', hp:42, atk:36, spd:52, token:true,
                move:M.rally('Metronome', 1.0, 0.07) },

  shellder:   { name:'Shellder',   type:'Water', gen1:'Water', tier:3, role:'tank', hp:26, atk:18, spd:33,
                evo:{into:'cloyster', by:'stone', stone:'waterstone'}, move:M.guard('Withdraw', 5, 1) },
  cloyster:   { name:'Cloyster',   type:'Water', gen1:'Water/Ice', tier:3, role:'tank', hp:50, atk:44, spd:52, token:true,
                move:M.wall('Spike Cannon', 1.2, 2.2) },

  rhyhorn:    { name:'Rhyhorn',    type:'Ground', gen1:'Ground/Rock', tier:4, role:'tank', hp:32, atk:27, spd:20,
                evo:{into:'rhydon', by:'level'},     move:M.wall('Horn Attack', 1.0, 1.7) },
  rhydon:     { name:'Rhydon',     type:'Ground', gen1:'Ground/Rock', tier:4, role:'tank', hp:54, atk:48, spd:30, token:true,
                move:M.wall('Horn Drill', 1.3, 2.2) },

  chansey:    { name:'Chansey',    type:'Normal', gen1:'Normal', tier:5, role:'tank', hp:64, atk:12, spd:40,   // v35: a Tank that supports — huge HP, heals and shields
                move:M.mend('Softboiled', 0.6, 0.25) },

  /* ============ TIER 6 ============ */
  snorlax:    { name:'Snorlax',    type:'Normal', gen1:'Normal', tier:6, role:'tank', hp:72, atk:42, spd:26,
                move:M.wall('Body Slam', 1.4, 2.1) },
  /* ============ LEGENDARIES (2.1.0) ============
     Encounter only. A legendary has NO tier and NEVER levels up — no copies,
     no Rare Candy, no evolution. It pays for that up front with a higher base
     stat total than any regular pokémon, and grows TUNING.legend.growth times
     as fast from every EXP source (battles, Exp. Share, the trainer's bank). */
  zapdos:     { name:'Zapdos',     type:'Electric', gen1:'Electric/Flying', role:'cannon', hp:62, atk:75, spd:106, legendary:true,
                move:M.all('Thunder', 0.55) },
  mewtwo:     { name:'Mewtwo',     type:'Psychic', gen1:'Psychic', role:'cannon', hp:66, atk:86, spd:112, legendary:true,
                move:M.big('Psystrike', 1.6) },
  articuno:   { name:'Articuno',   type:'Ice', gen1:'Ice/Flying', role:'tank', hp:102, atk:62, spd:88, legendary:true,
                move:M.wall('Icicle Crash', 1.2, 1.8) },
  moltres:    { name:'Moltres',    type:'Fire', gen1:'Fire/Flying', role:'bruiser', hp:80, atk:86, spd:94, legendary:true,
                move:M.hit('Air Slash', 1.5) },

  /* ============ 1.3.0 — Eevee and three of its evolutions (Sean) ============
     The first BRANCHING line: the stone you use decides what it becomes, and
     each evolution plays a different role. Eevee itself is a Support. */
  eevee:      { name:'Eevee',      type:'Normal', gen1:'Normal', tier:3, role:'support', hp:22, atk:18, spd:40,
                evo:{ by:'stone', branches:{ waterstone:'vaporeon', thunderstone:'jolteon', firestone:'flareon' } },
                move:M.rally('Helping Hand', 0.8, 0.05) },
  vaporeon:   { name:'Vaporeon',   type:'Water', gen1:'Water', tier:3, role:'tank', hp:56, atk:33, spd:46, token:true,
                move:M.wall('Waterfall', 1.0, 1.7) },
  jolteon:    { name:'Jolteon',    type:'Electric', gen1:'Electric', tier:3, role:'cannon', hp:24, atk:28, spd:64, token:true,
                move:M.multi('Pin Missile', 0.6, 3) },
  flareon:    { name:'Flareon',    type:'Fire', gen1:'Fire', tier:3, role:'bruiser', hp:42, atk:48, spd:60, token:true,
                move:M.ramp('Rage', 1.5, 12) },

  /* ============ 2.6.0 — two more Grass lines (Sean) ============
     Grass had four lines, nothing at tier 3, and no Bruiser once Bulbasaur became
     a Tank. Paras is the Grass Bruiser; Exeggcute is a slow Cannon that evolves
     with the new Leaf Stone and sits happily behind Bulbasaur or Parasect. */
  paras:      { name:'Paras',      type:'Bug', gen1:'Bug/Grass', tier:2, role:'bruiser', hp:PARAS.b[0], atk:PARAS.b[1], spd:PARAS.b[2],
                evo:{into:'parasect', by:'level'},    move:M.hit('Scratch', 1.3) },
  parasect:   { name:'Parasect',   type:'Bug', gen1:'Bug/Grass', tier:2, role:'bruiser', hp:PARAS.e[0], atk:PARAS.e[1], spd:PARAS.e[2], token:true,
                move:M.hit('Slash', 1.9) },
  exeggcute:  { name:'Exeggcute',  type:'Grass', gen1:'Grass/Psychic', tier:3, role:'cannon', hp:EGG.b[0], atk:EGG.b[1], spd:EGG.b[2],
                evo:{into:'exeggutor', by:'stone', stone:'leafstone'}, move:M.multi('Barrage', 0.6, 3) },
  exeggutor:  { name:'Exeggutor',  type:'Grass', gen1:'Grass/Psychic', tier:3, role:'cannon', hp:EGG.e[0], atk:EGG.e[1], spd:EGG.e[2], token:true,
                move:M.charge('Solar Beam', 2.9, 'Egg Bomb', 1.1) },

  /* 2.7.0 — the Bellsprout line (Sean): a poisoning Grass Cannon. Weepinbell
     evolves by level, Victreebel takes a Leaf Stone (like the games). */
  bellsprout: { name:'Bellsprout', type:'Grass', gen1:'Grass/Poison', tier:3, role:'cannon', hp:BELL.b[0], atk:BELL.b[1], spd:BELL.b[2],
                evo:{into:'weepinbell', by:'level'}, move:M.hit('Vine Whip', 1.3) },
  weepinbell: { name:'Weepinbell', type:'Grass', gen1:'Grass/Poison', tier:3, role:'cannon', hp:BELL.m[0], atk:BELL.m[1], spd:BELL.m[2], token:true,
                evo:{into:'victreebel', by:'stone', stone:'leafstone'}, move:M.hit('Razor Leaf', 1.5) },
  victreebel: { name:'Victreebel', type:'Grass', gen1:'Grass/Poison', tier:3, role:'cannon', hp:BELL.e[0], atk:BELL.e[1], spd:BELL.e[2], token:true,
                move:M.hit('Razor Leaf', 1.85) },

  /* 2.8.0 — Tangela (Sean): the Grass Tank at Tier 3, a single stage like Onix. */
  tangela:    { name:'Tangela',    type:'Grass', gen1:'Grass', tier:3, role:'tank', hp:TANGELA[0], atk:TANGELA[1], spd:TANGELA[2],
                move:M.wall('Bind', 1.4, 2.3) },

  /* 3.1.0 — five new lines (Sean): the Poison type arrives with Zubat and Koffing, Fighting gets Mankey and
     Hitmonchan, and Jynx is the first (and only) Ice pokémon. */
  mankey:     { name:'Mankey',     type:'Fighting', gen1:'Fighting', tier:3, role:'bruiser', hp:MANKEY.b[0], atk:MANKEY.b[1], spd:MANKEY.b[2],
                evo:{into:'primeape', by:'level'},    move:M.multi('Fury Swipes', 0.5, 3) },
  primeape:   { name:'Primeape',   type:'Fighting', gen1:'Fighting', tier:3, role:'bruiser', hp:MANKEY.e[0], atk:MANKEY.e[1], spd:MANKEY.e[2], token:true,
                move:M.ramp('Rage', 1.3, 10) },
  hitmonchan: { name:'Hitmonchan', type:'Fighting', gen1:'Fighting', tier:5, role:'bruiser', hp:32, atk:36, spd:54,
                move:M.multi('Comet Punch', 0.65, 3) },
  zubat:      { name:'Zubat',      type:'Poison', gen1:'Poison/Flying', tier:2, role:'support', hp:ZUBAT.b[0], atk:ZUBAT.b[1], spd:ZUBAT.b[2],
                evo:{into:'golbat', by:'level'},       move:M.drain('Leech Life', 1.0, 0.5) },
  golbat:     { name:'Golbat',     type:'Poison', gen1:'Poison/Flying', tier:2, role:'support', hp:ZUBAT.e[0], atk:ZUBAT.e[1], spd:ZUBAT.e[2], token:true,
                move:M.drain('Leech Life', 1.5, 0.6) },
  koffing:    { name:'Koffing',    type:'Poison', gen1:'Poison', tier:3, role:'tank', hp:KOFF.b[0], atk:KOFF.b[1], spd:KOFF.b[2],
                evo:{into:'weezing', by:'level'},      move:M.afflict('Smog', 0.7, 'psn', 0.5, 'front') },
  weezing:    { name:'Weezing',    type:'Poison', gen1:'Poison', tier:3, role:'tank', hp:KOFF.e[0], atk:KOFF.e[1], spd:KOFF.e[2], token:true,
                move:M.afflict('Sludge', 1.0, 'psn', 0.6, 'front') },
  jynx:       { name:'Jynx',       type:'Ice', gen1:'Ice/Psychic', tier:4, role:'support', hp:50, atk:47, spd:58,
                move:M.hit('Ice Punch', 1.9) },

  /* ============ 3.8.0 — nineteen more Gen 1 pokémon (Sean) ============
     Weedle, Spearow, Doduo, Diglett, Sandshrew, the two Nidorans, Farfetch'd and Porygon. Flying, Poison and
     Ground each reach three lines, so they each get a Mono run too. */
  weedle:     { name:'Weedle',     type:'Bug', gen1:'Bug/Poison', tier:1, role:'cannon', hp:WEED.b[0], atk:WEED.b[1], spd:WEED.b[2],
                evo:{into:'kakuna', by:'level'},      move:M.afflict('Poison Sting', 0.8, 'psn', 0.5, 'random') },
  kakuna:     { name:'Kakuna',     type:'Bug', gen1:'Bug/Poison', tier:1, role:'tank', hp:WEED.m[0], atk:WEED.m[1], spd:WEED.m[2], token:true,
                evo:{into:'beedrill', by:'level'},    move:M.guard('Harden', 6, 1) },
  beedrill:   { name:'Beedrill',   type:'Bug', gen1:'Bug/Poison', tier:1, role:'cannon', hp:WEED.e[0], atk:WEED.e[1], spd:WEED.e[2], token:true,
                move:M.multi('Twineedle', 0.8, 2) },

  spearow:    { name:'Spearow',    type:'Flying', gen1:'Normal/Flying', tier:1, role:'cannon', hp:SPEAR.b[0], atk:SPEAR.b[1], spd:SPEAR.b[2],
                evo:{into:'fearow', by:'level'},      move:M.hit('Peck', 1.35) },
  fearow:     { name:'Fearow',     type:'Flying', gen1:'Normal/Flying', tier:1, role:'cannon', hp:SPEAR.e[0], atk:SPEAR.e[1], spd:SPEAR.e[2], token:true,
                move:M.hit('Drill Peck', 1.7) },

  doduo:      { name:'Doduo',      type:'Flying', gen1:'Normal/Flying', tier:2, role:'bruiser', hp:DODU.b[0], atk:DODU.b[1], spd:DODU.b[2],
                evo:{into:'dodrio', by:'level'},      move:M.multi('Fury Attack', 0.5, 3) },
  dodrio:     { name:'Dodrio',     type:'Flying', gen1:'Normal/Flying', tier:2, role:'bruiser', hp:DODU.e[0], atk:DODU.e[1], spd:DODU.e[2], token:true,
                move:M.multi('Tri Attack', 0.5, 3) },

  diglett:    { name:'Diglett',    type:'Ground', gen1:'Ground', tier:2, role:'cannon', hp:DIG.b[0], atk:DIG.b[1], spd:DIG.b[2],
                evo:{into:'dugtrio', by:'level'},     move:M.hit('Mud-Slap', 1.3) },
  dugtrio:    { name:'Dugtrio',    type:'Ground', gen1:'Ground', tier:2, role:'cannon', hp:DIG.e[0], atk:DIG.e[1], spd:DIG.e[2], token:true,
                move:M.charge('Dig', 2.3, 'Mud-Slap', 1.0) },

  sandshrew:  { name:'Sandshrew',  type:'Ground', gen1:'Ground', tier:2, role:'bruiser', hp:SAND.b[0], atk:SAND.b[1], spd:SAND.b[2],
                evo:{into:'sandslash', by:'level'},   move:M.hit('Scratch', 1.2) },
  sandslash:  { name:'Sandslash',  type:'Ground', gen1:'Ground', tier:2, role:'bruiser', hp:SAND.e[0], atk:SAND.e[1], spd:SAND.e[2], token:true,
                move:M.multi('Fury Swipes', 0.55, 3) },

  nidoranf:   { name:'Nidoran♀',   type:'Poison', gen1:'Poison', tier:2, role:'tank', hp:NIDF.b[0], atk:NIDF.b[1], spd:NIDF.b[2],
                evo:{into:'nidorina', by:'level'},    move:M.wall('Body Slam', 0.8, 1.5) },
  nidorina:   { name:'Nidorina',   type:'Poison', gen1:'Poison', tier:2, role:'tank', hp:NIDF.m[0], atk:NIDF.m[1], spd:NIDF.m[2], token:true,
                evo:{into:'nidoqueen', by:'stone', stone:'moonstone'}, move:M.wall('Body Slam', 1.0, 1.8) },
  nidoqueen:  { name:'Nidoqueen',  type:'Poison', gen1:'Poison/Ground', tier:2, role:'tank', hp:NIDF.e[0], atk:NIDF.e[1], spd:NIDF.e[2], token:true,
                move:M.wall('Body Slam', 1.3, 2.2) },

  nidoranm:   { name:'Nidoran♂',   type:'Poison', gen1:'Poison', tier:2, role:'cannon', hp:NIDM.b[0], atk:NIDM.b[1], spd:NIDM.b[2],
                evo:{into:'nidorino', by:'level'},    move:M.hit('Peck', 1.3) },
  nidorino:   { name:'Nidorino',   type:'Poison', gen1:'Poison', tier:2, role:'cannon', hp:NIDM.m[0], atk:NIDM.m[1], spd:NIDM.m[2], token:true,
                evo:{into:'nidoking', by:'stone', stone:'moonstone'}, move:M.multi('Double Kick', 0.65, 2) },
  nidoking:   { name:'Nidoking',   type:'Poison', gen1:'Poison/Ground', tier:2, role:'cannon', hp:NIDM.e[0], atk:NIDM.e[1], spd:NIDM.e[2], token:true,
                move:M.ramp('Thrash', 1.4, 10) },

  farfetchd:  { name:"Farfetch'd", type:'Flying', gen1:'Normal/Flying', tier:3, role:'bruiser', hp:FARF[0], atk:FARF[1], spd:FARF[2],
                move:M.hit('Slash', 1.8) },
  porygon:    { name:'Porygon',    type:'Normal', gen1:'Normal', tier:4, role:'support', hp:PORY[0], atk:PORY[1], spd:PORY[2],
                move:M.rally('Conversion', 1.4, 0.07) },

  /* ============ 4.0.0 — THE GEN 2 PACK (Johto) ============
     `gen:2` pokémon only exist in runs with Gen 2 switched on. Babies evolve into
     Gen 1 pokémon by level; the Gen 2 evolutions of Gen 1 pokémon (Crobat,
     Steelix…) hang off those species as `evo2` (see below the table). */
  chikorita:  { name:'Chikorita',  type:'Grass', gen1:'Grass', gen:2, tier:1, role:'support', hp:CHIK.b[0], atk:CHIK.b[1], spd:CHIK.b[2],
                evo:{into:'bayleef', by:'level'},     move:M.mend('Synthesis', 0.9, 0.07) },
  bayleef:    { name:'Bayleef',    type:'Grass', gen1:'Grass', gen:2, tier:1, role:'support', hp:CHIK.m[0], atk:CHIK.m[1], spd:CHIK.m[2], token:true,
                evo:{into:'meganium', by:'level'},    move:M.mend('Synthesis', 1.0, 0.09) },
  meganium:   { name:'Meganium',   type:'Grass', gen1:'Grass', gen:2, tier:1, role:'support', hp:CHIK.e[0], atk:CHIK.e[1], spd:CHIK.e[2], token:true,
                move:M.mend('Petal Dance', 1.3, 0.12) },
  cyndaquil:  { name:'Cyndaquil',  type:'Fire', gen1:'Fire', gen:2, tier:1, role:'cannon', hp:CYND.b[0], atk:CYND.b[1], spd:CYND.b[2],
                evo:{into:'quilava', by:'level'},     move:M.hit('Ember', 1.3) },
  quilava:    { name:'Quilava',    type:'Fire', gen1:'Fire', gen:2, tier:1, role:'cannon', hp:CYND.m[0], atk:CYND.m[1], spd:CYND.m[2], token:true,
                evo:{into:'typhlosion', by:'level'},  move:M.hit('Flamethrower', 1.5) },
  typhlosion: { name:'Typhlosion', type:'Fire', gen1:'Fire', gen:2, tier:1, role:'cannon', hp:CYND.e[0], atk:CYND.e[1], spd:CYND.e[2], token:true,
                move:M.charge('Fire Blast', 2.3, 'Ember', 1.0) },
  totodile:   { name:'Totodile',   type:'Water', gen1:'Water', gen:2, tier:1, role:'bruiser', hp:TOTO.b[0], atk:TOTO.b[1], spd:TOTO.b[2],
                evo:{into:'croconaw', by:'level'},    move:M.hit('Water Gun', 1.1) },
  croconaw:   { name:'Croconaw',   type:'Water', gen1:'Water', gen:2, tier:1, role:'bruiser', hp:TOTO.m[0], atk:TOTO.m[1], spd:TOTO.m[2], token:true,
                evo:{into:'feraligatr', by:'level'},  move:M.hit('Bite', 1.4) },
  feraligatr: { name:'Feraligatr', type:'Water', gen1:'Water', gen:2, tier:1, role:'bruiser', hp:TOTO.e[0], atk:TOTO.e[1], spd:TOTO.e[2], token:true,
                move:M.hit('Crunch', 1.8) },

  hoothoot:   { name:'Hoothoot',   type:'Flying', gen1:'Normal/Flying', gen:2, tier:1, role:'tank', hp:HOOT.b[0], atk:HOOT.b[1], spd:HOOT.b[2],
                evo:{into:'noctowl', by:'level'},     move:M.hit('Tackle', 1.0) },
  noctowl:    { name:'Noctowl',    type:'Flying', gen1:'Normal/Flying', gen:2, tier:1, role:'tank', hp:HOOT.e[0], atk:HOOT.e[1], spd:HOOT.e[2], token:true,
                move:M.fast('Confusion', 1.3) },
  ledyba:     { name:'Ledyba',     type:'Bug', gen1:'Bug/Flying', gen:2, tier:1, role:'support', hp:LEDY.b[0], atk:LEDY.b[1], spd:LEDY.b[2],
                evo:{into:'ledian', by:'level'},      move:M.multi('Comet Punch', 0.5, 2) },
  ledian:     { name:'Ledian',     type:'Bug', gen1:'Bug/Flying', gen:2, tier:1, role:'support', hp:LEDY.e[0], atk:LEDY.e[1], spd:LEDY.e[2], token:true,
                move:M.multi('Comet Punch', 0.55, 3) },
  spinarak:   { name:'Spinarak',   type:'Bug', gen1:'Bug/Poison', gen:2, tier:1, role:'cannon', hp:SPIN.b[0], atk:SPIN.b[1], spd:SPIN.b[2],
                evo:{into:'ariados', by:'level'},     move:M.afflict('Poison Sting', 0.9, 'psn', 0.5, 'random') },
  ariados:    { name:'Ariados',    type:'Bug', gen1:'Bug/Poison', gen:2, tier:1, role:'cannon', hp:SPIN.e[0], atk:SPIN.e[1], spd:SPIN.e[2], token:true,
                move:M.multi('Pin Missile', 0.55, 3) },
  marill:     { name:'Marill',     type:'Water', gen1:'Water', gen:2, tier:1, role:'bruiser', hp:MARI.b[0], atk:MARI.b[1], spd:MARI.b[2],
                evo:{into:'azumarill', by:'level'},   move:M.hit('Water Gun', 1.05) },
  azumarill:  { name:'Azumarill',  type:'Water', gen1:'Water', gen:2, tier:1, role:'bruiser', hp:MARI.e[0], atk:MARI.e[1], spd:MARI.e[2], token:true,
                move:M.recoil('Double-Edge', 1.8, 4) },

  mareep:     { name:'Mareep',     type:'Electric', gen1:'Electric', gen:2, tier:2, role:'cannon', hp:MARE.b[0], atk:MARE.b[1], spd:MARE.b[2],
                evo:{into:'flaaffy', by:'level'},     move:M.all('Thunder Shock', 0.38) },
  flaaffy:    { name:'Flaaffy',    type:'Electric', gen1:'Electric', gen:2, tier:2, role:'cannon', hp:MARE.m[0], atk:MARE.m[1], spd:MARE.m[2], token:true,
                evo:{into:'ampharos', by:'level'},    move:M.all('Thunder Shock', 0.45) },
  ampharos:   { name:'Ampharos',   type:'Electric', gen1:'Electric', gen:2, tier:2, role:'cannon', hp:MARE.e[0], atk:MARE.e[1], spd:MARE.e[2], token:true,
                move:M.all('Thunderbolt', 0.66) },
  natu:       { name:'Natu',       type:'Psychic', gen1:'Psychic/Flying', gen:2, tier:2, role:'cannon', hp:NATU.b[0], atk:NATU.b[1], spd:NATU.b[2],
                evo:{into:'xatu', by:'level'},        move:M.fast('Confusion', 0.95) },
  xatu:       { name:'Xatu',       type:'Psychic', gen1:'Psychic/Flying', gen:2, tier:2, role:'cannon', hp:NATU.e[0], atk:NATU.e[1], spd:NATU.e[2], token:true,
                move:M.fast('Psychic', 1.15) },
  wooper:     { name:'Wooper',     type:'Water', gen1:'Water/Ground', gen:2, tier:1, role:'tank', hp:WOOP.b[0], atk:WOOP.b[1], spd:WOOP.b[2],
                evo:{into:'quagsire', by:'level'},    move:M.wall('Body Slam', 0.8, 1.5) },
  quagsire:   { name:'Quagsire',   type:'Water', gen1:'Water/Ground', gen:2, tier:1, role:'tank', hp:WOOP.e[0], atk:WOOP.e[1], spd:WOOP.e[2], token:true,
                move:M.wall('Earthquake', 1.2, 2.0) },
  snubbull:   { name:'Snubbull',   type:'Normal', gen1:'Normal', gen:2, tier:2, role:'bruiser', hp:SNUB.b[0], atk:SNUB.b[1], spd:SNUB.b[2],
                evo:{into:'granbull', by:'level'},    move:M.hit('Bite', 1.3) },
  granbull:   { name:'Granbull',   type:'Normal', gen1:'Normal', gen:2, tier:2, role:'bruiser', hp:SNUB.e[0], atk:SNUB.e[1], spd:SNUB.e[2], token:true,
                move:M.hit('Crunch', 1.8) },
  murkrow:    { name:'Murkrow',    type:'Dark', gen1:'Dark/Flying', gen:2, tier:2, role:'cannon', hp:MURK[0], atk:MURK[1], spd:MURK[2],
                move:M.pierce('Faint Attack', 1.25) },

  teddiursa:  { name:'Teddiursa',  type:'Normal', gen1:'Normal', gen:2, tier:3, role:'bruiser', hp:TEDD.b[0], atk:TEDD.b[1], spd:TEDD.b[2],
                evo:{into:'ursaring', by:'level'},    move:M.multi('Fury Swipes', 0.5, 3) },
  ursaring:   { name:'Ursaring',   type:'Normal', gen1:'Normal', gen:2, tier:3, role:'bruiser', hp:TEDD.e[0], atk:TEDD.e[1], spd:TEDD.e[2], token:true,
                move:M.recoil('Double-Edge', 2.0, 4) },
  swinub:     { name:'Swinub',     type:'Ice', gen1:'Ice/Ground', gen:2, tier:3, role:'tank', hp:SWIN.b[0], atk:SWIN.b[1], spd:SWIN.b[2],
                evo:{into:'piloswine', by:'level'},   move:M.wall('Body Slam', 0.8, 1.5) },
  piloswine:  { name:'Piloswine',  type:'Ice', gen1:'Ice/Ground', gen:2, tier:3, role:'tank', hp:SWIN.e[0], atk:SWIN.e[1], spd:SWIN.e[2], token:true,
                move:M.wall('Earthquake', 1.2, 2.0) },
  phanpy:     { name:'Phanpy',     type:'Ground', gen1:'Ground', gen:2, tier:3, role:'tank', hp:PHAN.b[0], atk:PHAN.b[1], spd:PHAN.b[2],
                evo:{into:'donphan', by:'level'},     move:M.ramp('Rollout', 1.0, 8) },
  donphan:    { name:'Donphan',    type:'Ground', gen1:'Ground', gen:2, tier:3, role:'tank', hp:PHAN.e[0], atk:PHAN.e[1], spd:PHAN.e[2], token:true,
                move:M.ramp('Rollout', 1.2, 12) },
  pineco:     { name:'Pineco',     type:'Bug', gen1:'Bug', gen:2, tier:3, role:'tank', hp:PINE.b[0], atk:PINE.b[1], spd:PINE.b[2],
                evo:{into:'forretress', by:'level'},  move:M.charge('Self-Destruct', 1.6, 'Tackle', 0.8) },
  forretress: { name:'Forretress', type:'Bug', gen1:'Bug/Steel', gen:2, tier:3, role:'tank', hp:PINE.e[0], atk:PINE.e[1], spd:PINE.e[2], token:true,
                move:M.wall('Rapid Spin', 1.0, 1.8) },
  houndour:   { name:'Houndour',   type:'Dark', gen1:'Dark/Fire', gen:2, tier:3, role:'cannon', hp:HOUN.b[0], atk:HOUN.b[1], spd:HOUN.b[2],
                evo:{into:'houndoom', by:'level'},    move:M.hit('Ember', 1.3) },
  houndoom:   { name:'Houndoom',   type:'Dark', gen1:'Dark/Fire', gen:2, tier:3, role:'cannon', hp:HOUN.e[0], atk:HOUN.e[1], spd:HOUN.e[2], token:true,
                move:M.charge('Fire Blast', 2.2, 'Crunch', 1.0) },
  girafarig:  { name:'Girafarig',  type:'Normal', gen1:'Normal/Psychic', gen:2, tier:3, role:'bruiser', hp:GIRA[0], atk:GIRA[1], spd:GIRA[2],
                move:M.fast('Confusion', 1.15) },
  misdreavus: { name:'Misdreavus', type:'Ghost', gen1:'Ghost', gen:2, tier:3, role:'cannon', hp:MISD[0], atk:MISD[1], spd:MISD[2],
                move:M.pierce('Shadow Ball', 1.3) },

  miltank:    { name:'Miltank',    type:'Normal', gen1:'Normal', gen:2, tier:4, role:'tank', hp:MILT[0], atk:MILT[1], spd:MILT[2],
                move:M.ramp('Rollout', 1.1, 12) },
  sneasel:    { name:'Sneasel',    type:'Dark', gen1:'Dark/Ice', gen:2, tier:4, role:'cannon', hp:SNEA[0], atk:SNEA[1], spd:SNEA[2],
                move:M.pierce('Faint Attack', 1.3) },
  skarmory:   { name:'Skarmory',   type:'Steel', gen1:'Steel/Flying', gen:2, tier:4, role:'tank', hp:SKAR[0], atk:SKAR[1], spd:SKAR[2],
                move:M.wall('Steel Wing', 1.0, 1.8) },

  hitmontop:  { name:'Hitmontop',  type:'Fighting', gen1:'Fighting', gen:2, tier:5, role:'bruiser', hp:HTOP[0], atk:HTOP[1], spd:HTOP[2],
                move:M.two('Rolling Kick', 1.0) },
  heracross:  { name:'Heracross',  type:'Bug', gen1:'Bug/Fighting', gen:2, tier:5, role:'bruiser', hp:HERA[0], atk:HERA[1], spd:HERA[2],
                move:M.hit('Megahorn', 1.9) },
  larvitar:   { name:'Larvitar',   type:'Rock', gen1:'Rock/Ground', gen:2, tier:5, role:'bruiser', hp:LARV.b[0], atk:LARV.b[1], spd:LARV.b[2],
                evo:{into:'pupitar', by:'level'},     move:M.hit('Bite', 1.3) },
  pupitar:    { name:'Pupitar',    type:'Rock', gen1:'Rock/Ground', gen:2, tier:5, role:'tank', hp:LARV.m[0], atk:LARV.m[1], spd:LARV.m[2], token:true,
                evo:{into:'tyranitar', by:'level'},   move:M.guard('Harden', 6, 1) },
  tyranitar:  { name:'Tyranitar',  type:'Rock', gen1:'Rock/Dark', gen:2, tier:5, role:'bruiser', hp:LARV.e[0], atk:LARV.e[1], spd:LARV.e[2], token:true,
                move:M.charge('Hyper Beam', 2.4, 'Crunch', 1.0) },

  /* babies: bought cheap and early, they grow into a Gen 1 pokémon by level */
  pichu:      { name:'Pichu',      type:'Electric', gen1:'Electric', gen:2, tier:1, role:'cannon', hp:10, atk:12, spd:52,
                evo:{into:'pikachu', by:'level'},     move:M.all('Thunder Shock', 0.3) },
  igglybuff:  { name:'Igglybuff',  type:'Normal', gen1:'Normal', gen:2, tier:1, role:'support', hp:18, atk:7, spd:16,
                evo:{into:'jigglypuff', by:'level'},  move:M.hit('Pound', 0.8) },
  cleffa:     { name:'Cleffa',     type:'Normal', gen1:'Normal', gen:2, tier:2, role:'support', hp:18, atk:12, spd:28,
                evo:{into:'clefairy', by:'level'},    move:M.rally('Metronome', 0.6, 0.04) },
  tyrogue:    { name:'Tyrogue',    type:'Fighting', gen1:'Fighting', gen:2, tier:3, role:'bruiser', hp:22, atk:20, spd:30,
                evo:{ by:'level', byStat:{ atk:'hitmonlee', hp:'hitmonchan', spd:'hitmontop' } }, move:M.hit('Tackle', 1.1) },
  smoochum:   { name:'Smoochum',   type:'Ice', gen1:'Ice/Psychic', gen:2, tier:3, role:'support', hp:20, atk:22, spd:36,
                evo:{into:'jynx', by:'level'},        move:M.hit('Pound', 1.0) },
  elekid:     { name:'Elekid',     type:'Electric', gen1:'Electric', gen:2, tier:3, role:'cannon', hp:16, atk:20, spd:50,
                evo:{into:'electabuzz', by:'level'},  move:M.hit('Thunder Punch', 1.2) },
  magby:      { name:'Magby',      type:'Fire', gen1:'Fire', gen:2, tier:3, role:'cannon', hp:16, atk:22, spd:46,
                evo:{into:'magmar', by:'level'},      move:M.hit('Ember', 1.3) },
  /* …and the Gen 1 line that Kingdra finishes (Clair's ace): a Water Cannon that takes a Dragon Scale */
  horsea:     { name:'Horsea',     type:'Water', gen1:'Water', tier:2, role:'cannon', hp:HORS.b[0], atk:HORS.b[1], spd:HORS.b[2],
                evo:{into:'seadra', by:'level'},      move:M.hit('Water Gun', 1.3) },
  seadra:     { name:'Seadra',     type:'Water', gen1:'Water', tier:2, role:'cannon', hp:HORS.m[0], atk:HORS.m[1], spd:HORS.m[2], token:true,
                move:M.hit('Water Gun', 2.0) },
  kingdra:    { name:'Kingdra',    type:'Water', gen1:'Water/Dragon', gen:2, tier:2, role:'cannon', hp:HORS.e[0], atk:HORS.e[1], spd:HORS.e[2], token:true,
                move:M.charge('Hydro Pump', 2.1, 'Dragon Breath', 1.0) },
  /* …and the Gen 1 pokémon Magby grows into, in Blaine's line of work */
  magmar:     { name:'Magmar',     type:'Fire', gen1:'Fire', tier:5, role:'cannon', hp:MAGM[0], atk:MAGM[1], spd:MAGM[2],
                move:M.hit('Fire Punch', 1.6) },

  /* Gen 2 evolutions of Gen 1 pokémon (reached through `evo2`, only with Gen 2 on) */
  crobat:     { name:'Crobat',     type:'Poison', gen1:'Poison/Flying', gen:2, tier:2, role:'support', hp:CROB[0], atk:CROB[1], spd:CROB[2], token:true,
                move:M.drain('Leech Life', 1.6, 0.6) },
  blissey:    { name:'Blissey',    type:'Normal', gen1:'Normal', gen:2, tier:5, role:'tank', hp:BLIS[0], atk:BLIS[1], spd:BLIS[2], token:true,
                move:M.mend('Softboiled', 0.7, 0.3) },
  porygon2:   { name:'Porygon2',   type:'Normal', gen1:'Normal', gen:2, tier:5, role:'support', hp:PORY2[0], atk:PORY2[1], spd:PORY2[2], token:true,
                move:M.rally('Download', 1.5, 0.08) },
  steelix:    { name:'Steelix',    type:'Steel', gen1:'Steel/Ground', gen:2, tier:3, role:'tank', hp:STLX[0], atk:STLX[1], spd:STLX[2], token:true,
                move:M.wall('Iron Tail', 1.3, 2.1) },
  scizor:     { name:'Scizor',     type:'Bug', gen1:'Bug/Steel', gen:2, tier:4, role:'bruiser', hp:SCIZ[0], atk:SCIZ[1], spd:SCIZ[2], token:true,
                move:M.hit('Metal Claw', 1.7) },
  politoed:   { name:'Politoed',   type:'Water', gen1:'Water', gen:2, tier:2, role:'support', hp:POLT[0], atk:POLT[1], spd:POLT[2], token:true,
                move:M.rally('Rain Dance', 1.2, 0.08) },
  bellossom:  { name:'Bellossom',  type:'Grass', gen1:'Grass', gen:2, tier:2, role:'support', hp:BELO[0], atk:BELO[1], spd:BELO[2], token:true,
                move:M.mend('Petal Dance', 1.2, 0.14) },
  espeon:     { name:'Espeon',     type:'Psychic', gen1:'Psychic', gen:2, tier:3, role:'cannon', hp:ESPE[0], atk:ESPE[1], spd:ESPE[2], token:true,
                move:M.fast('Psychic', 1.25) },
  umbreon:    { name:'Umbreon',    type:'Dark', gen1:'Dark', gen:2, tier:3, role:'tank', hp:UMBR[0], atk:UMBR[1], spd:UMBR[2], token:true,
                move:M.wall('Mean Look', 1.0, 1.9) },

  /* Gen 2 legendaries: encounters, like Zapdos and Mewtwo */
  raikou:     { name:'Raikou',     type:'Electric', gen1:'Electric', gen:2, role:'cannon', hp:64, atk:78, spd:108, legendary:true,
                move:M.all('Thunderbolt', 0.55) },
  entei:      { name:'Entei',      type:'Fire', gen1:'Fire', gen:2, role:'bruiser', hp:78, atk:78, spd:92, legendary:true,
                move:M.hit('Flamethrower', 1.6) },
  suicune:    { name:'Suicune',    type:'Water', gen1:'Water', gen:2, role:'tank', hp:94, atk:58, spd:86, legendary:true,
                move:M.wall('Waterfall', 1.2, 1.9) },
  lugia:      { name:'Lugia',      type:'Psychic', gen1:'Psychic/Flying', gen:2, role:'tank', hp:92, atk:60, spd:92, legendary:true,
                move:M.wall('Aeroblast', 1.3, 2.0) },
  'ho-oh':    { name:'Ho-Oh',      type:'Fire', gen1:'Fire/Flying', gen:2, role:'bruiser', hp:82, atk:76, spd:90, legendary:true,
                move:M.afflict('Sacred Fire', 1.6, 'brn', 0.5, 'front') },
  /* 4.10.0: the first healer legendary */
  celebi:     { name:'Celebi',     type:'Psychic', gen1:'Psychic/Grass', gen:2, role:'support', hp:CELE[0], atk:CELE[1], spd:CELE[2], legendary:true,
                move:M.mend('Life Dew', 1.0, 0.10) },

  /* ============ 4.5.0 — POOL FILL-INS ============ */
  omanyte:    { name:'Omanyte',    type:'Rock', gen1:'Rock/Water', tier:3, role:'cannon', hp:OMAN.b[0], atk:OMAN.b[1], spd:OMAN.b[2],
                evo:{into:'omastar', by:'level'},     move:M.hit('Constrict', 1.25) },
  omastar:    { name:'Omastar',    type:'Rock', gen1:'Rock/Water', tier:3, role:'cannon', hp:OMAN.e[0], atk:OMAN.e[1], spd:OMAN.e[2], token:true,
                move:M.charge('Skull Bash', 2.2, 'Constrict', 1.1) },
  kabuto:     { name:'Kabuto',     type:'Rock', gen1:'Rock/Water', tier:3, role:'bruiser', hp:KABU.b[0], atk:KABU.b[1], spd:KABU.b[2],
                evo:{into:'kabutops', by:'level'},    move:M.hit('Aqua Jet', 1.2) },
  kabutops:   { name:'Kabutops',   type:'Rock', gen1:'Rock/Water', tier:3, role:'bruiser', hp:KABU.e[0], atk:KABU.e[1], spd:KABU.e[2], token:true,
                move:M.multi('Aqua Slash', 0.95, 2) },
  aerodactyl: { name:'Aerodactyl', type:'Rock', gen1:'Rock/Flying', tier:5, role:'bruiser', hp:AERO[0], atk:AERO[1], spd:AERO[2],
                move:M.fast('Ancient Power', 1.3) },
  slowpoke:   { name:'Slowpoke',   type:'Water', gen1:'Water/Psychic', tier:3, role:'tank', hp:SLOW.b[0], atk:SLOW.b[1], spd:SLOW.b[2],
                evo:{into:'slowbro', by:'level'},     move:M.wall('Headbutt', 0.8, 1.5) },
  slowbro:    { name:'Slowbro',    type:'Water', gen1:'Water/Psychic', tier:3, role:'tank', hp:SLOW.e[0], atk:SLOW.e[1], spd:SLOW.e[2], token:true,
                move:M.wall('Headbutt', 1.1, 1.9) },
  slowking:   { name:'Slowking',   type:'Water', gen1:'Water/Psychic', gen:2, tier:3, role:'support', hp:SLOWK[0], atk:SLOWK[1], spd:SLOWK[2], token:true,
                move:M.mend('Heal Pulse', 1.2, 0.12) },
  'mr-mime':  { name:'Mr. Mime',   type:'Psychic', gen1:'Psychic', tier:4, role:'support', hp:MIME[0], atk:MIME[1], spd:MIME[2],
                move:M.mend('Meditate', 1.1, 0.12) },
  ponyta:     { name:'Ponyta',     type:'Fire', gen1:'Fire', tier:2, role:'bruiser', hp:PONY.b[0], atk:PONY.b[1], spd:PONY.b[2],
                evo:{into:'rapidash', by:'level'},    move:M.hit('Flame Charge', 1.3) },
  rapidash:   { name:'Rapidash',   type:'Fire', gen1:'Fire', tier:2, role:'bruiser', hp:PONY.e[0], atk:PONY.e[1], spd:PONY.e[2], token:true,
                move:M.recoil('Flare Blitz', 2.2, 4) },
  cubone:     { name:'Cubone',     type:'Ground', gen1:'Ground', tier:3, role:'bruiser', hp:CUBO.b[0], atk:CUBO.b[1], spd:CUBO.b[2],
                evo:{into:'marowak', by:'level'},     move:M.hit('Bone Club', 1.2) },
  marowak:    { name:'Marowak',    type:'Ground', gen1:'Ground', tier:3, role:'bruiser', hp:CUBO.e[0], atk:CUBO.e[1], spd:CUBO.e[2], token:true,
                move:M.multi('Bonemerang', 0.85, 2) },
  sunkern:    { name:'Sunkern',    type:'Grass', gen1:'Grass', gen:2, tier:2, role:'cannon', hp:SUNK.b[0], atk:SUNK.b[1], spd:SUNK.b[2],
                evo:{into:'sunflora', by:'stone', stone:'sunstone'}, move:M.hit('Seed Bomb', 1.2) },
  sunflora:   { name:'Sunflora',   type:'Grass', gen1:'Grass', gen:2, tier:2, role:'cannon', hp:SUNK.e[0], atk:SUNK.e[1], spd:SUNK.e[2], token:true,
                move:M.hit('Seed Bomb', 1.8) },
  gligar:     { name:'Gligar',     type:'Ground', gen1:'Ground/Flying', gen:2, tier:3, role:'bruiser', hp:GLIG[0], atk:GLIG[1], spd:GLIG[2],
                move:M.hit('X-Scissor', 1.7) },
  slugma:     { name:'Slugma',     type:'Fire', gen1:'Fire', gen:2, tier:3, role:'tank', hp:SLUG.b[0], atk:SLUG.b[1], spd:SLUG.b[2],
                evo:{into:'magcargo', by:'level'},    move:M.wall('Lava Plume', 0.9, 1.5) },
  magcargo:   { name:'Magcargo',   type:'Fire', gen1:'Fire/Rock', gen:2, tier:3, role:'tank', hp:SLUG.e[0], atk:SLUG.e[1], spd:SLUG.e[2], token:true,
                move:M.wall('Lava Plume', 1.2, 2.0) },
  wobbuffet:  { name:'Wobbuffet',  type:'Psychic', gen1:'Psychic', gen:2, tier:4, role:'tank', hp:WOBB[0], atk:WOBB[1], spd:WOBB[2],
                move:M.wall('Counter', 0.6, 1.4) },
  qwilfish:   { name:'Qwilfish',   type:'Water', gen1:'Water/Poison', gen:2, tier:3, role:'bruiser', hp:QWIL[0], atk:QWIL[1], spd:QWIL[2],
                move:M.afflict('Poison Sting', 1.0, 'psn', 0.6, 'random') },
  chinchou:   { name:'Chinchou',   type:'Water', gen1:'Water/Electric', gen:2, tier:2, role:'support', hp:CHIN.b[0], atk:CHIN.b[1], spd:CHIN.b[2],
                evo:{into:'lanturn', by:'level'},     move:M.mend('Aqua Ring', 0.9, 0.07) },
  lanturn:    { name:'Lanturn',    type:'Water', gen1:'Water/Electric', gen:2, tier:2, role:'support', hp:CHIN.e[0], atk:CHIN.e[1], spd:CHIN.e[2], token:true,
                move:M.mend('Aqua Ring', 1.2, 0.12) },
  togepi:     { name:'Togepi',     type:'Flying', gen1:'Normal/Flying', gen:2, tier:2, role:'support', hp:TOGE.b[0], atk:TOGE.b[1], spd:TOGE.b[2],
                evo:{into:'togetic', by:'level'},     move:M.mend('Sweet Kiss', 0.8, 0.06) },
  togetic:    { name:'Togetic',    type:'Flying', gen1:'Normal/Flying', gen:2, tier:2, role:'support', hp:TOGE.e[0], atk:TOGE.e[1], spd:TOGE.e[2], token:true,
                move:M.mend('Sweet Kiss', 1.1, 0.12) },
};

/* ===================================================================
   4.0.0 — GENERATIONS
   Every species belongs to a gen (`gen`, 1 unless set). A run plays the gens it
   was started with (G.gens). Gen 1 sells the Kanto roster; Gen 2 sells the
   Johto Pokédex — its own pokémon plus the Gen 1 ones that live in Johto, so
   KANTO_ONLY lists the Gen 1 pokémon a Gen 2-only run leaves out. `evo2` on a
   species is an evolution that only exists with Gen 2 on (Golbat → Crobat).
   Engine helpers read ACTIVE_GENS; setActiveGens / useGens(G) switch it, and
   BUYABLE and MONO_TYPES are refilled in place so every reader follows.
   =================================================================== */
const GENS = { 1: { name:'Gen 1', region:'Kanto' }, 2: { name:'Gen 2', region:'Johto' } };
/** The gens a player can switch on today. Gen 2 joins when its pack is complete. */
const GENS_READY = [1, 2];   // gen2 branch: Gen 2 is playable here (placeholder benches until the pack lands)
/* Sean: bosses of a Gen 2 run may also field the Gen 1 pokémon of the Johto Pokédex (Morty's
   Gengar, Pryce's Dewgong, Clair's Dragonair) — everything but these Kanto-only ones — though
   none of them is ever sold in a Gen 2-only run. */
const KANTO_ONLY = ['bulbasaur', 'ivysaur', 'venusaur', 'charmander', 'charmeleon', 'charizard', 'squirtle', 'wartortle', 'blastoise',
  'farfetchd', 'porygon', 'tangela', 'zapdos', 'articuno', 'moltres', 'mewtwo'];
/** Can a boss of this run field it? The run's gens, or the Johto Pokédex when Gen 2 is on. */
const inBossPool = (id, gens) => { gens = gens || ACTIVE_GENS;
  return inGens(id, gens) || (gens.includes(2) && genOf(id) === 1 && !KANTO_ONLY.includes(id)); };
/* Sean: a Gen 2 run plays ONLY Gen 2 pokémon — plus any Gen 1 line that a Gen 2 pokémon
   belongs to (Onix → Steelix, Magby → Magmar, Pichu → Pikachu…), the whole line. */
let GEN2_LINKED = null;
function gen2Linked(id){
  if(!GEN2_LINKED){
    const nb = {};   // the evolution graph with every gen's edges, both directions
    const link = (a, b) => { (nb[a] = nb[a] || []).push(b); (nb[b] = nb[b] || []).push(a); };
    for(const k of Object.keys(SPECIES)) for(const e of [...evoOpts(SPECIES[k].evo), ...evoOpts(SPECIES[k].evo2)]) link(k, e.into);
    GEN2_LINKED = new Set();
    for(const k of Object.keys(SPECIES)){
      const seen = new Set([k]), todo = [k];
      while(todo.length){ const x = todo.pop(); for(const y of nb[x] || []) if(!seen.has(y)){ seen.add(y); todo.push(y); } }
      if([...seen].some(x => (SPECIES[x].gen || 1) >= 2)) GEN2_LINKED.add(k);
    }
  }
  return GEN2_LINKED.has(id);
}
let ACTIVE_GENS = [1];
let ACTIVE_POOL = null;   // 4.1.0: the run's open cross-gen evolutions (null = all of them)
const cleanGens = g => { const out = Object.keys(GENS).map(Number).filter(n => Array.isArray(g) && g.includes(n)); return out.length ? out : [1]; };
const genOf = id => (SPECIES[id] && SPECIES[id].gen) || 1;
/** Is this species part of a run that plays these gens? */
function inGens(id, gens){
  const sp = SPECIES[id]; if(!sp) return false;
  gens = gens || ACTIVE_GENS;
  if((sp.gen || 1) >= 2) return gens.includes(sp.gen);
  return gens.includes(1) || (gens.includes(2) && gen2Linked(id));
}
const buyableFor = gens => Object.keys(SPECIES).filter(k => !SPECIES[k].token && !SPECIES[k].legendary && inGens(k, gens));
const BUYABLE = buyableFor([1]);
/** 3.0.0: the types a Mono run can pick — only those with enough buyable lines for the Daycare to be worth visiting. */
const MONO_MIN_LINES = 3;   // 3.0.0: a Mono run needs at least three buyable lines (Fighting, Psychic and Rock have two)
/* 4.6.0 (Sean): a dual-type pokémon belongs to the pool of each of its types (Geodude is Rock and Ground), for Mono runs and Mono legends. */
const inTypePool = (k, t) => { const sp = SPECIES[k]; return !!sp && (sp.type === t || String(sp.gen1 || '').split('/').includes(t)); };
const monoTypesFor = gens => { const b = buyableFor(cleanGens(gens)); return Object.keys(TYPES).filter(t => b.filter(k => inTypePool(k, t)).length >= MONO_MIN_LINES); };
const MONO_TYPES = monoTypesFor([1]);
function setActiveGens(gens){
  ACTIVE_GENS = cleanGens(gens);
  ACTIVE_POOL = null;
  BUYABLE.splice(0, BUYABLE.length, ...buyableFor(ACTIVE_GENS));
  MONO_TYPES.splice(0, MONO_TYPES.length, ...monoTypesFor(ACTIVE_GENS));
  return ACTIVE_GENS;
}
/** Make the engine follow this run's gens (cheap when they already match). */
function useGens(G){ const g = cleanGens(G && G.gens); if(g.join() !== ACTIVE_GENS.join()) setActiveGens(g); ACTIVE_POOL = (G && G.evoPool) || null; return ACTIVE_GENS; }
/** 2.1.0: a legendary has no tier and never levels. */
const isLegend = u => !!(u && SPECIES[typeof u === 'string' ? u : u.id] && SPECIES[typeof u === 'string' ? u : u.id].legendary);
/* Second moves (v32), kept apart from the species table so the main moves stay
   readable. Each fires instead of the main move when its trigger is met. */
const MOVE2 = {
  // ---- tier 1
  caterpie:   on('every', M.random('Bug Bite', 0.9), { n:3 }),
  metapod:    on('low',   M.shield('Iron Defense', 0.3, 'self')),
  butterfree: on('every', M.afflict('Sleep Powder', 0, 'slp', 1, 'random'), { n:3 }),
  bulbasaur:  on('every', M.afflict('Poison Powder', 0.3, 'psn', 1, 'front'), { n:3 }),
  ivysaur:    on('every', M.afflict('Poison Powder', 0.4, 'psn', 1, 'front'), { n:3 }),
  venusaur:   on('every', M.afflict('Poison Powder', 0.5, 'psn', 1, 'front'), { n:3 }),
  charmander: on('every', M.afflict('Fire Spin', 0.6, 'brn', 0.7, 'front'), { n:3 }),
  charmeleon: on('every', M.afflict('Fire Spin', 0.7, 'brn', 0.8, 'front'), { n:3 }),
  charizard:  on('every', M.afflict('Fire Spin', 0.8, 'brn', 1, 'front'), { n:3 }),
  squirtle:   on('every', M.slow('Bubble', 0.9, 6), { n:3 }),
  wartortle:  on('every', M.slow('Bubble', 1.0, 8), { n:3 }),
  blastoise:  on('every', M.slow('Bubble', 1.1, 10), { n:3 }),
  pidgey:     on('open',  M.hit('Quick Attack', 0.7), { priority:true }),
  pidgeotto:  on('open',  M.hit('Quick Attack', 0.8), { priority:true }),
  pidgeot:    on('open',  M.hit('Quick Attack', 0.9), { priority:true }),
  rattata:    on('every', M.weakest('Pursuit', 1.0), { n:3 }),
  raticate:   on('every', M.weakest('Pursuit', 1.3), { n:3 }),
  jigglypuff: on('every', M.afflict('Sing', 0, 'slp', 1, 'front'), { n:3 }),
  wigglytuff: on('every', M.afflict('Sing', 0, 'slp', 1, 'front'), { n:3 }),
  // ---- tier 2
  geodude:    on('low',   M.shield('Defense Curl', 0.25, 'self')),
  graveler:   on('low',   M.shield('Defense Curl', 0.3, 'self')),
  golem:      on('open',  M.shield('Defense Curl', 0.5, 'self'), { free:true }),   // 3.3.0: curls up before the first hit, not after
  machop:     on('open',  M.focus('Focus Energy', 0.3), { free:true }),
  machoke:    on('open',  M.focus('Focus Energy', 0.4), { free:true }),
  machamp:    on('open',  M.focus('Focus Energy', 0.5), { free:true }),
  poliwag:    on('every', M.afflict('Hypnosis', 0, 'slp', 0.6, 'front'), { n:3 }),
  poliwhirl:  on('every', M.afflict('Hypnosis', 0, 'slp', 0.7, 'front'), { n:3 }),
  poliwrath:  on('every', M.breaker('Brick Break', 1.5), { n:3 }),   // 3.3.0
  magikarp:   on('every', M.hit('Tackle', 0.7), { n:3 }),
  gyarados:   on('open',  M.trueHit('Dragon Rage', 1.1)),
  pikachu:    on('every', M.afflict('Thunder Wave', 0, 'par', 1, 'fastest'), { n:3 }),
  raichu:     on('every', M.afflict('Thunder Wave', 0, 'par', 1, 'fastest'), { n:3 }),
  vulpix:     on('every', M.afflict('Confuse Ray', 0, 'cnf', 1, 'random'), { n:3 }),
  ninetales:  on('every', M.afflict('Confuse Ray', 0, 'cnf', 1, 'random'), { n:3 }),
  oddish:     on('every', M.afflict('Poison Sting', 0.3, 'psn', 1, 'random'), { n:3 }),
  gloom:      on('every', M.afflict('Stun Spore', 0.3, 'par', 1, 'random'), { n:3 }),
  vileplume:  on('allyLow', M.cleanse('Aromatherapy', 0.15)),
  voltorb:    on('open',  M.afflict('Spark', 0.5, 'par', 0.3, 'front'), { priority:true }),
  electrode:  on('open',  M.afflict('Spark', 0.6, 'par', 0.3, 'front'), { priority:true }),
  // ---- tier 3
  abra:       on('low',   M.teleport('Teleport')),
  kadabra:    on('low',   M.teleport('Teleport')),
  alakazam:   on('every', M.disable('Disable', 1.2), { n:3 }),   // 3.4.0: seals a second move   // v33: Cannons don't heal
  gastly:     on('every', M.afflict('Dark Void', 0, 'slp', 0.6, 'random'), { n:3 }),
  haunter:    on('every', M.afflict('Dark Void', 0, 'slp', 0.7, 'random'), { n:3 }),
  gengar:     on('every', M.afflict('Dark Void', 0, 'slp', 0.8, 'random'), { n:3 }),
  magnemite:  on('every', M.afflict('Thunder Wave', 0, 'par', 1, 'fastest'), { n:3 }),
  magneton:   on('every', M.afflict('Thunder Wave', 0, 'par', 1, 'fastest'), { n:3 }),
  growlithe:  on('every', M.afflict('Fire Spin', 0.6, 'brn', 0.5, 'front'), { n:3 }),
  arcanine:   on('open',  M.hit('Extreme Speed', 1.2), { priority:true }),
  staryu:     on('every', M.hit('Water Gun', 1.3), { n:3 }),
  starmie:    on('every', M.haze('Haze', 1.0), { n:3 }),   // 3.4.0: wipes buffs
  onix:       on('open',  M.shield('Iron Defense', 0.55, 'self'), { free:true }),   // 3.3.0: a rock wall from the first turn
  clefairy:   on('allyLow', M.shield('Light Screen', 0.1, 'team')),
  clefable:   on('allyLow', M.shield('Light Screen', 0.16, 'team')),
  shellder:   on('every', M.afflict('Supersonic', 0, 'cnf', 0.8, 'front'), { n:3 }),
  cloyster:   on('open',  M.shield('Iron Defense', 0.28, 'self'), { free:true }),   // 3.3.0: shuts its shell first
  // ---- tier 4
  seel:       on('low',   M.recover('Rest', 0.6, true)),
  dewgong:    on('low',   M.recover('Rest', 0.7, true)),
  drowzee:    on('every', M.afflict('Hypnosis', 0, 'slp', 0.8, 'front'), { n:3 }),
  hypno:      on('every', M.afflict('Hypnosis', 0, 'slp', 1, 'front'), { n:3 }),
  dratini:    on('every', M.afflict('Thunder Wave', 0, 'par', 1, 'fastest'), { n:3 }),
  dragonair:  on('every', M.afflict('Thunder Wave', 0, 'par', 1, 'fastest'), { n:3 }),
  dragonite:  on('every', M.afflict('Thunder Wave', 0, 'par', 1, 'fastest'), { n:3 }),
  scyther:    on('every', M.knock('Knock Off', 1.6), { n:3 }),   // 3.4.0: strips held items
  rhyhorn:    on('every', M.afflict('Stomp', 0.8, 'fln', 0.3, 'front'), { n:3 }),
  rhydon:     on('open',  M.shield('Iron Defense', 0.6, 'self'), { free:true }),   // 3.3.0: thick hide from the first turn
  // ---- tier 5-6
  hitmonlee:  on('every', M.breaker('Brick Break', 1.6), { n:3 }),   // 3.3.0: the answer to an opening barrier
  lapras:     on('every', M.afflict('Sing', 0, 'slp', 1, 'front'), { n:3 }),
  electabuzz: on('every', M.disable('Disable', 1.4), { n:3 }),   // 3.4.0
  tauros:     on('every', M.afflict('Stomp', 1.0, 'fln', 0.3, 'front'), { n:3 }),
  chansey:    on('allyLow', M.shield('Light Screen', 0.12, 'team')),
  snorlax:    on('open',  M.shield('Reflect', 0.27, 'team'), { free:true }),   // 3.3.0: the whole team shelters behind it
  zapdos:     on('every', M.afflict('Zap Cannon', 2.0, 'par', 0.7, 'biggest'), { n:4 }),   // 2.2.0 (Sean)
  articuno:   on('every', M.all('Blizzard', 0.45), { n:4 }),
  moltres:    on('every', M.afflict('Sacred Fire', 1.6, 'brn', 1, 'front'), { n:3 }),
  mewtwo:     on('every', M.trueHit('Psyshock', 1.5), { n:3 }),
  // 1.3.0 — the Eevee line
  eevee:      on('every', M.afflict('Sand Attack', 0, 'cnf', 0.5, 'front'), { n:3 }),
  vaporeon:   on('open',  M.shield('Acid Armor', 0.3, 'self'), { free:true }),   // 3.4.0: armour up before the first hit
  jolteon:    on('every', M.all('Thunderbolt', JOLT_TB), { n:JOLT_N }),
  flareon:    on('every', M.afflict('Fire Spin', 1.4, 'brn', 1, 'front'), { n:3 }),
  // 2.6.0 — Paras and Exeggcute
  paras:      on('every', M.afflict('Stun Spore', 0.3, 'par', 1, 'random'), { n:3 }),
  parasect:   on('every', M.afflict('Spore', 0, 'slp', 1, 'front'), { n:2 }),
  exeggcute:  on('every', M.afflict('Hypnosis', 0, 'slp', 0.6, 'front'), { n:3 }),
  exeggutor:  on('every', M.afflict('Hypnosis', 0, 'slp', 0.8, 'front'), { n:3 }),
  // 2.7.0 — Bellsprout line
  bellsprout: on('every', M.afflict('Poison Powder', 0.3, 'psn', 1, 'front'), { n:3 }),
  weepinbell: on('every', M.afflict('Poison Powder', 0.4, 'psn', 1, 'front'), { n:3 }),
  victreebel: on('every', M.afflict('Poison Powder', 0.5, 'psn', 1, 'front'), { n:3 }),
  // 2.8.0 — Tangela
  tangela:    on('every', M.afflict('Stun Spore', 0.3, 'par', 1, 'random'), { n:3 }),
  // 3.1.0 — Mankey, Hitmonchan, Zubat, Koffing, Jynx
  mankey:     on('open',  M.focus('Focus Energy', 0.25), { free:true }),
  primeape:   on('open',  M.focus('Focus Energy', 0.3), { free:true }),
  hitmonchan: on('open',  M.grow('Bulk Up', 5), { free:true }),
  zubat:      on('every', M.afflict('Supersonic', 0, 'cnf', 0.7, 'front'), { n:3 }),
  golbat:     on('every', M.afflict('Supersonic', 0, 'cnf', 1, 'front'), { n:3 }),
  koffing:    on('every', M.afflict('Poison Gas', 0, 'psn', 1, 'random'), { n:3 }),
  weezing:    on('every', M.afflict('Poison Gas', 0, 'psn', 1, 'random'), { n:3 }),
  jynx:       on('every', M.afflict('Lovely Kiss', 0, 'slp', 0.9, 'front'), { n:3 }),
  // 3.8.0 — Weedle, Spearow, Doduo, Diglett, Sandshrew, the Nidorans, Farfetch'd, Porygon
  weedle:     on('every', M.slow('String Shot', 0.8, 4), { n:3 }),
  kakuna:     on('low',   M.shield('Iron Defense', 0.3, 'self')),
  beedrill:   on('every', M.afflict('Poison Sting', 0.5, 'psn', 1, 'random'), { n:3 }),
  spearow:    on('every', M.weakest('Pursuit', 0.9), { n:3 }),
  fearow:     on('every', M.weakest('Pursuit', 1.2), { n:3 }),
  doduo:      on('open',  M.focus('Focus Energy', 0.3), { free:true }),
  dodrio:     on('open',  M.focus('Focus Energy', 0.5), { free:true }),
  diglett:    on('open',  M.afflict('Sand Attack', 0, 'cnf', 0.6, 'front'), { free:true }),
  dugtrio:    on('open',  M.afflict('Sand Attack', 0, 'cnf', 0.8, 'front'), { free:true }),
  sandshrew:  on('low',   M.shield('Defense Curl', 0.25, 'self')),
  sandslash:  on('open',  M.shield('Defense Curl', 0.3, 'self'), { free:true }),
  nidoranf:   on('every', M.afflict('Poison Sting', 0.3, 'psn', 1, 'random'), { n:3 }),
  nidorina:   on('every', M.afflict('Poison Sting', 0.4, 'psn', 1, 'random'), { n:3 }),
  nidoqueen:  on('every', M.afflict('Poison Sting', 0.5, 'psn', 1, 'random'), { n:3 }),
  nidoranm:   on('every', M.afflict('Poison Sting', 0.3, 'psn', 1, 'random'), { n:3 }),
  nidorino:   on('every', M.afflict('Poison Sting', 0.4, 'psn', 1, 'random'), { n:3 }),
  nidoking:   on('every', M.afflict('Poison Sting', 0.5, 'psn', 1, 'random'), { n:3 }),
  farfetchd:  on('open',  M.grow('Swords Dance', 8), { free:true }),
  porygon:    on('low',   M.recover('Recover', 0.5)),
  // 4.0.0 — the Gen 2 pack
  chikorita:  on('allyLow', M.shield('Light Screen', 0.08, 'team')),
  bayleef:    on('allyLow', M.shield('Light Screen', 0.1, 'team')),
  meganium:   on('allyLow', M.shield('Light Screen', 0.14, 'team')),
  cyndaquil:  on('every', M.afflict('Smokescreen', 0, 'cnf', 0.5, 'random'), { n:3 }),
  quilava:    on('every', M.afflict('Smokescreen', 0, 'cnf', 0.6, 'random'), { n:3 }),
  typhlosion: on('every', M.afflict('Smokescreen', 0, 'cnf', 0.7, 'random'), { n:3 }),
  totodile:   on('every', M.weaken('Screech', 0.7, 8), { n:3 }),
  croconaw:   on('every', M.weaken('Screech', 0.8, 10), { n:3 }),
  feraligatr: on('every', M.weaken('Screech', 0.9, 12), { n:3 }),
  hoothoot:   on('every', M.afflict('Hypnosis', 0, 'slp', 0.6, 'front'), { n:3 }),
  noctowl:    on('every', M.afflict('Hypnosis', 0, 'slp', 0.8, 'front'), { n:3 }),
  ledyba:     on('allyLow', M.shield('Light Screen', 0.08, 'team')),
  ledian:     on('open',  M.shield('Reflect', 0.14, 'team'), { free:true }),
  spinarak:   on('every', M.slow('String Shot', 0.8, 4), { n:3 }),
  ariados:    on('every', M.slow('String Shot', 1.0, 6), { n:3 }),
  marill:     on('low',   M.recover('Rest', 0.5, true)),
  azumarill:  on('low',   M.recover('Rest', 0.6, true)),
  mareep:     on('every', M.slow('Cotton Spore', 0.4, 6), { n:3 }),
  flaaffy:    on('every', M.slow('Cotton Spore', 0.5, 8), { n:3 }),
  ampharos:   on('every', M.slow('Cotton Spore', 0.6, 10), { n:3 }),
  natu:       on('every', M.afflict('Confuse Ray', 0, 'cnf', 0.7, 'random'), { n:3 }),
  xatu:       on('every', M.afflict('Confuse Ray', 0, 'cnf', 1, 'random'), { n:3 }),
  wooper:     on('low',   M.shield('Amnesia', 0.2, 'self')),
  quagsire:   on('open',  M.shield('Amnesia', 0.3, 'self'), { free:true }),
  snubbull:   on('open',  M.weaken('Charm', 0, 8), { free:true }),
  granbull:   on('open',  M.weaken('Charm', 0, 12), { free:true }),
  murkrow:    on('every', M.weakest('Pursuit', 1.0), { n:3 }),
  teddiursa:  on('open',  M.grow('Swords Dance', 3), { free:true }),
  ursaring:   on('open',  M.grow('Swords Dance', 6), { free:true }),
  swinub:     on('every', M.hush('Powder Snow', 0.3, 6), { n:3 }),
  piloswine:  on('every', M.hush('Powder Snow', 0.45, 8), { n:3 }),
  phanpy:     on('low',   M.shield('Defense Curl', 0.25, 'self')),
  donphan:    on('open',  M.shield('Defense Curl', 0.4, 'self'), { free:true }),
  pineco:     on('low',   M.shield('Protect', 0.25, 'self')),
  forretress: on('open',  M.shield('Protect', 0.35, 'self'), { free:true }),
  houndour:   on('every', M.weakest('Pursuit', 0.9), { n:3 }),
  houndoom:   on('every', M.weakest('Pursuit', 1.2), { n:3 }),
  girafarig:  on('every', M.afflict('Stomp', 0.8, 'fln', 0.3, 'front'), { n:3 }),
  misdreavus: on('every', M.afflict('Confuse Ray', 0, 'cnf', 1, 'random'), { n:3 }),
  miltank:    on('low',   M.recover('Milk Drink', 0.5)),
  sneasel:    on('open',  M.hit('Quick Attack', 0.8), { priority:true }),
  skarmory:   on('open',  M.all('Spikes', 0.15), { free:true }),
  hitmontop:  on('open',  M.hit('Quick Attack', 0.8), { priority:true }),
  heracross:  on('open',  M.focus('Focus Energy', 0.4), { free:true }),
  larvitar:   on('every', M.afflict('Sand Attack', 0, 'cnf', 0.5, 'front'), { n:3 }),
  pupitar:    on('low',   M.shield('Iron Defense', 0.3, 'self')),
  tyranitar:  on('open',  M.all('Sandstorm', 0.25), { free:true }),
  pichu:      on('every', M.afflict('Thunder Wave', 0, 'par', 1, 'fastest'), { n:3 }),
  igglybuff:  on('every', M.afflict('Sing', 0, 'slp', 0.8, 'front'), { n:3 }),
  cleffa:     on('allyLow', M.shield('Light Screen', 0.07, 'team')),
  tyrogue:    on('open',  M.focus('Focus Energy', 0.2), { free:true }),
  smoochum:   on('every', M.afflict('Lovely Kiss', 0, 'slp', 0.6, 'front'), { n:3 }),
  elekid:     on('every', M.afflict('Thunder Wave', 0, 'par', 1, 'fastest'), { n:3 }),
  magby:      on('every', M.afflict('Smokescreen', 0, 'cnf', 0.5, 'random'), { n:3 }),
  magmar:     on('every', M.afflict('Fire Spin', 0.8, 'brn', 1, 'front'), { n:3 }),
  horsea:     on('every', M.afflict('Smokescreen', 0, 'cnf', 0.5, 'random'), { n:3 }),
  seadra:     on('every', M.afflict('Smokescreen', 0, 'cnf', 0.6, 'random'), { n:3 }),
  kingdra:    on('open',  M.focus('Focus Energy', 0.4), { free:true }),
  crobat:     on('every', M.afflict('Confuse Ray', 0, 'cnf', 1, 'random'), { n:3 }),
  blissey:    on('allyLow', M.shield('Light Screen', 0.15, 'team')),
  porygon2:   on('low',   M.recover('Recover', 0.5)),
  steelix:    on('open',  M.shield('Iron Defense', 0.55, 'self'), { free:true }),
  scizor:     on('open',  M.grow('Swords Dance', 6), { free:true }),
  politoed:   on('every', M.afflict('Hypnosis', 0, 'slp', 0.8, 'front'), { n:3 }),
  bellossom:  on('every', M.afflict('Sleep Powder', 0, 'slp', 1, 'random'), { n:3 }),
  espeon:     on('every', M.afflict('Psybeam', 0.8, 'cnf', 0.5, 'front'), { n:3 }),
  umbreon:    on('every', M.afflict('Confuse Ray', 0, 'cnf', 1, 'random'), { n:3 }),
  raikou:     on('every', M.afflict('Spark', 1.2, 'par', 0.5, 'front'), { n:3 }),
  entei:      on('every', M.afflict('Fire Spin', 1.0, 'brn', 1, 'front'), { n:3 }),
  suicune:    on('every', M.haze('Haze', 1.0), { n:3 }),
  lugia:      on('low',   M.recover('Recover', 0.5)),
  'ho-oh':    on('low',   M.recover('Recover', 0.5)),
  celebi:     on('allyLow', M.cleanse('Aromatherapy', 0.08)),
  omanyte:    on('every', M.slow('Bubble', 0.5, 6), { n:3 }),
  omastar:    on('every', M.slow('Bubble', 0.65, 8), { n:3 }),
  kabuto:     on('open',  M.grow('Swords Dance', 3), { free:true }),
  kabutops:   on('open',  M.grow('Swords Dance', 5), { free:true }),
  aerodactyl: on('open',  M.hit('Quick Attack', 0.8), { priority:true }),
  slowpoke:   on('low',   M.recover('Slack Off', 0.4)),
  slowbro:    on('low',   M.recover('Slack Off', 0.5)),
  slowking:   on('every', M.afflict('Confuse Ray', 0, 'cnf', 0.8, 'random'), { n:3 }),
  'mr-mime':  on('allyLow', M.shield('Reflect', 0.12, 'team')),
  ponyta:     on('every', M.afflict('Fire Spin', 0.6, 'brn', 0.6, 'front'), { n:3 }),
  rapidash:   on('every', M.afflict('Fire Spin', 0.7, 'brn', 0.7, 'front'), { n:3 }),
  cubone:     on('open',  M.focus('Focus Energy', 0.3), { free:true }),
  marowak:    on('open',  M.focus('Focus Energy', 0.4), { free:true }),
  sunkern:    on('open',  M.grow('Growth', 2), { free:true }),
  sunflora:   on('open',  M.grow('Growth', 4), { free:true }),
  gligar:     on('every', M.afflict('Sand Attack', 0, 'cnf', 0.6, 'front'), { n:3 }),
  slugma:     on('every', M.afflict('Will-O-Wisp', 0, 'brn', 0.7, 'front'), { n:3 }),
  magcargo:   on('every', M.afflict('Will-O-Wisp', 0, 'brn', 0.9, 'front'), { n:3 }),
  wobbuffet:  on('open',  M.shield('Safeguard', 0.35, 'self'), { free:true }),
  qwilfish:   on('open',  M.all('Spikes', 0.12), { free:true }),
  chinchou:   on('every', M.slow('Electroweb', 0.5, 6), { n:3 }),
  lanturn:    on('every', M.slow('Electroweb', 0.65, 8), { n:3 }),
  togepi:     on('allyLow', M.shield('Wish', 0.08, 'team')),
  togetic:    on('allyLow', M.shield('Wish', 0.14, 'team')),
};
Object.keys(MOVE2).forEach(k => { if(SPECIES[k]) SPECIES[k].move2 = MOVE2[k]; });
/* 4.0.0: Gen 2 evolutions of Gen 1 pokémon. They only exist in runs with Gen 2 on
   (evoNext reads `evo2` only then), so a Gen 1 run plays exactly as before. */
Object.assign(SPECIES.golbat,    { evo2:{ into:'crobat', by:'level' } });
Object.assign(SPECIES.seadra,    { evo2:{ into:'kingdra', by:'stone', stone:'dragonscale' } });
Object.assign(SPECIES.chansey,   { evo2:{ into:'blissey', by:'level' } });
Object.assign(SPECIES.porygon,   { evo2:{ into:'porygon2', by:'level' } });
Object.assign(SPECIES.onix,      { evo2:{ into:'steelix', by:'stone', stone:'metalcoat' } });
Object.assign(SPECIES.scyther,   { evo2:{ into:'scizor', by:'stone', stone:'metalcoat' } });
Object.assign(SPECIES.poliwhirl, { evo2:{ into:'politoed', by:'stone', stone:'kingsrock' } });
Object.assign(SPECIES.slowpoke,  { evo2:{ into:'slowking', by:'stone', stone:'kingsrock' } });   // 4.8.0: Slowpoke chooses: Slowbro on a level up, Slowking with a King's Rock
Object.assign(SPECIES.gloom,     { evo2:{ into:'bellossom', by:'stone', stone:'sunstone' } });
Object.assign(SPECIES.eevee,     { evo2:{ branches:{ sunstone:'espeon', moonstone:'umbreon' } } });

/** Every evolution a species can take next: [] · [one] · several for a
    branching line (1.3.0, Eevee), each { into, by, stone }. */
/* 4.0.0: an evo entry can also be { by:'level', byStat:{ atk:id, hp:id, spd:id } }
   (Tyrogue: its highest stat picks the evolution), and `evo2` adds options that
   only exist with Gen 2 on — Gloom can level into Vileplume OR take a Sun Stone. */
function evoOpts(e){
  if(!e) return [];
  if(e.branches) return Object.keys(e.branches).map(stone => ({ into: e.branches[stone], by:'stone', stone }));
  if(e.byStat) return Object.keys(e.byStat).map(stat => ({ into: e.byStat[stat], by:'level', stat }));
  return [e];
}
function evoNext(id){
  const sp = SPECIES[id];
  if(!sp) return [];
  const out = evoOpts(sp.evo);
  if(sp.evo2 && ACTIVE_GENS.includes(2) && (!ACTIVE_POOL || ACTIVE_POOL.includes(id))) out.push(...evoOpts(sp.evo2).map(n => ({ ...n, gen2:true })));
  return out.filter(n => SPECIES[n.into]);
}
/** 4.7.0 (Sean): can this species still evolve into something that exists in this run? Unlike evoNext
    it counts a Gen 2 evolution whenever Gen 2 is on, even if a mixed run has not opened it in its Evolution Pool. */
const canStillEvolve = id => { const sp = SPECIES[id]; return !!sp && (evoNext(id).length > 0 || (!!sp.evo2 && ACTIVE_GENS.includes(2) && evoOpts(sp.evo2).some(n => SPECIES[n.into]))); };
/** What a species evolved from, or null. */
const evoParent = id => Object.keys(SPECIES).find(k => inGens(k) && evoNext(k).some(n => n.into === id)) || null;
/** Which of several level-up evolutions a pokémon takes: the one matching its highest stat. */
function pickLevelEvo(u, opts){
  if(opts.length <= 1) return opts[0] || null;
  const withStat = opts.filter(n => n.stat);
  if(!withStat.length) return opts[0];
  return withStat.slice().sort((a, b) => (u[b.stat] || 0) - (u[a.stat] || 0))[0];
}

/** The evolution line a species sits on, base form first. A branching line
    stays linear here — Eevee alone is ['eevee'], Jolteon is ['eevee','jolteon']
    — so "the line" always means one path; evoFamily() has every branch. */
function evoLine(id){
  let base = id, guard = 0, prev = evoParent(base);
  while(prev && guard++ < 8){ base = prev; prev = evoParent(base); }
  const line = [base];
  let cur = base; guard = 0;
  while(guard++ < 8){
    const nx = evoNext(cur);
    if(nx.length === 1){ cur = nx[0].into; line.push(cur); continue; }
    if(nx.length > 1){ const on = nx.find(n => evoLine0(n.into, id)); if(on){ cur = on.into; line.push(cur); continue; } }
    break;
  }
  return line;
}
/* does the path from `from` onward pass through `id`? (for picking the branch) */
function evoLine0(from, id){
  let cur = from, guard = 0;
  while(cur && guard++ < 8){ if(cur === id) return true; const nx = evoNext(cur); cur = nx.length === 1 ? nx[0].into : null; }
  return false;
}
/** The whole family, base first, every branch included. */
function evoFamily(id){
  const base = evoLine(id)[0], out = [base];
  for(let i = 0; i < out.length; i++) for(const n of evoNext(out[i])) if(!out.includes(n.into)) out.push(n.into);
  return out;
}

/* ===================================================================
   ITEMS — Gen 1. Two shelves in the PokéMart:

   ITEMS        rolled each turn, permanent effects, sell out when used.
   BATTLE_ITEMS two fixed slots that are ALWAYS stocked and never sell
                out, whose effect lasts only for the coming battle.

   `eligible(u)` gates the tap target and also keeps a stone nobody can
   use out of the shop entirely.
   =================================================================== */
const ITEMS = {
  protein:      { name:'Protein', icon:'💊', tier:1, cost:3, vitamin:true, rarity:'common', text:'+9 Attack, permanently.',
                  eligible:u => vitaminsTaken(u, 'protein') < TUNING.vitaminCap,
                  apply:(u,G)=>G.boost(u,{atk:9}) },
  hpup:         { name:'HP Up',   icon:'🧃', tier:1, cost:3, vitamin:true, rarity:'common', text:'+8 HP, permanently.',
                  eligible:u => vitaminsTaken(u, 'hpup') < TUNING.vitaminCap,
                  apply:(u,G)=>G.boost(u,{hp:8}) },
  carbos:       { name:'Carbos',  icon:'🥤', tier:2, cost:3, vitamin:true, rarity:'common', text:'+10 Speed, permanently.',
                  eligible:u => vitaminsTaken(u, 'carbos') < TUNING.vitaminCap,
                  apply:(u,G)=>G.boost(u,{spd:10}) },
  candy:        { name:'Rare Candy', icon:'🍬', tier:3, cost:4, rarity:'uncommon',
                  text:'Counts as one extra copy of the pokémon: a step toward its next level, and maybe an evolution.',
                  eligible:u => !isLegend(u),   // 2.1.0: a legendary never levels
                  apply:(u,G)=>G.addExp(u,1) },
  expshare:     { name:'Exp. Share', icon:'📿', tier:4, cost:6, rarity:'rare',
                  text:'Everyone in your party gets EXP as if they had just won a fight. (Not the PC, and not pokémon you buy later.)',
                  apply:(u,G)=>G.shareExp() },
  thunderstone: { name:'Thunder Stone', icon:'⚡', tier:3, cost:4, rarity:'common', text:'Evolves Pikachu, or Eevee into Jolteon.',
                  eligible:u => stonesFor(u.id).includes('thunderstone'), apply:(u,G)=>G.evolve(u, 'thunderstone') },
  firestone:    { name:'Fire Stone', icon:'🔥', tier:3, cost:4, rarity:'common', text:'Evolves Vulpix or Growlithe, or Eevee into Flareon.',
                  eligible:u => stonesFor(u.id).includes('firestone'), apply:(u,G)=>G.evolve(u, 'firestone') },
  moonstone:    { name:'Moon Stone', icon:'🌙', tier:2, cost:4, rarity:'common', text:'Evolves Jigglypuff, Clefairy, Nidorina or Nidorino (and, with Gen 2 on, Eevee into Umbreon).',
                  eligible:u => stonesFor(u.id).includes('moonstone'), apply:(u,G)=>G.evolve(u, 'moonstone') },
  waterstone:   { name:'Water Stone', icon:'💧', tier:3, cost:4, rarity:'common', text:'Evolves Staryu or Shellder, or Eevee into Vaporeon.',
                  eligible:u => stonesFor(u.id).includes('waterstone'), apply:(u,G)=>G.evolve(u, 'waterstone') },
  leafstone:    { name:'Leaf Stone', icon:'🍃', tier:3, cost:4, rarity:'common', text:'Evolves Exeggcute or Weepinbell.',
                  eligible:u => stonesFor(u.id).includes('leafstone'), apply:(u,G)=>G.evolve(u, 'leafstone') },
  /* 4.0.0 — Gen 2 evolution items. Nobody can use them in a Gen 1 run, so the Mart never stocks them there. */
  sunstone:     { name:'Sun Stone', icon:'☀️', tier:2, cost:4, rarity:'common', text:'Evolves Gloom into Bellossom, or Eevee into Espeon.',
                  eligible:u => stonesFor(u.id).includes('sunstone'), apply:(u,G)=>G.evolve(u, 'sunstone') },
  kingsrock:    { name:"King's Rock", icon:'👑', tier:2, cost:4, rarity:'common', text:'Evolves Poliwhirl into Politoed, or Slowpoke into Slowking.',
                  eligible:u => stonesFor(u.id).includes('kingsrock'), apply:(u,G)=>G.evolve(u, 'kingsrock') },
  dragonscale:  { name:'Dragon Scale', icon:'🐉', tier:2, cost:4, rarity:'common', text:'Evolves Seadra into Kingdra.',
                  eligible:u => stonesFor(u.id).includes('dragonscale'), apply:(u,G)=>G.evolve(u, 'dragonscale') },
  metalcoat:    { name:'Metal Coat', icon:'🔩', tier:3, cost:4, rarity:'common', text:'Evolves Onix into Steelix, or Scyther into Scizor.',
                  eligible:u => stonesFor(u.id).includes('metalcoat'), apply:(u,G)=>G.evolve(u, 'metalcoat') },
};

/** How many of a vitamin this pokémon has had. */
const vitaminsTaken = (u, id) => (u && u.vit && u.vit[id]) || 0;

/** The stone a line needs (the first one, for a branching line). */
const stoneFor = id => { const s = stonesFor(id); return s.length ? s[0] : null; };
/** Every stone that evolves this species (1.3.0: Eevee takes three). */
const stonesFor = id => evoNext(id).filter(n => n.by === 'stone').map(n => n.stone);

/* The two always-stocked shelves: X Attack and X Speed. One use boosts EVERY
   pokémon in your party by a share of its own stat for the next battle, and
   each can be used at most `xItems.perBattle` times per battle.

   History, because every part of this is a fix. X items used to add a flat
   amount to ONE pokémon that grew with the turn (+9 +2.7/turn Attack) and
   stacked without limit: by turn 24 one X Attack was +73 Attack — a 70% boost
   for 2₽ — and a dozen on Zapdos, whose Thunder hits every enemy, one-shot
   whole teams (measured: an 82% gym fight became 95%). Capping it at once per
   pokémon stopped the one-shot but not the purchase: one of each on all six
   still took that gym to 98%, because close fights turn on small margins and
   the cap only moved the power from one pokémon to six. So now: party-wide
   (nothing to stack on a carry), a SMALL share per use (it lands six times),
   and a hard cap on uses (the total is bounded, not just the spread). A
   percentage can't outgrow the pokémon it boosts, which is why held items
   made the same change. Add a third entry here and the UI picks it up. */
const xBoost = (u, def) => Math.max(1, Math.round((def.stat === 'atk' ? u.atk : u.spd) * TUNING.xItems.pct));
/** How many times this X item has been used for the coming battle. */
const xUses = (G, def) => (G && G.xUses && G.xUses[def.id]) || 0;
const pctText = () => Math.round(TUNING.xItems.pct * 100);
const BATTLE_ITEMS = [
  { id:'xattack', name:'X Attack', icon:'⚔️', stat:'atk', get cost(){ return TUNING.xItems.cost; },
    amount: u => xBoost(u, BATTLE_ITEMS[0]),
    text: () => `+${pctText()}% Attack for your whole party, next battle only. Up to ${TUNING.xItems.perBattle} per battle.`,
    apply: G => { for(const u of G.team) u.tmpAtk = (u.tmpAtk || 0) + xBoost(u, BATTLE_ITEMS[0]); } },
  { id:'xspeed', name:'X Speed', icon:'👟', stat:'spd', get cost(){ return TUNING.xItems.cost; },
    amount: u => xBoost(u, BATTLE_ITEMS[1]),
    text: () => `+${pctText()}% Speed for your whole party, next battle only. Up to ${TUNING.xItems.perBattle} per battle.`,
    apply: G => { for(const u of G.team) u.tmpSpd = (u.tmpSpd || 0) + xBoost(u, BATTLE_ITEMS[1]); } },
];

/* ===================================================================
   HELD ITEMS
   A pokémon holds at most one, and keeps it until you move it. Unequipped
   items live in the Bag (TUNING.bagSlots). Three flavours:
     stat     — a flat bonus while held; `when` gates it (Eviolite)
     trigger  — fires during the battle; `once` spends the item's one use
     economy  — pays off between rounds, handled in incomeFor / grantBattleExp
   Nothing here inflicts a status effect: every effect is a number.
   =================================================================== */
/* Stat held items are PERCENTAGES, not flat numbers. Medicine is flat and
   stacks — buy Protein every turn and it compounds — so a flat held item is
   strictly worse than the consumable it competes with on the shelf, and by
   turn 20 it is noise. A percentage keeps one item slot worth having all run,
   and it means a held item is a multiplier on a pokémon you have invested in
   rather than a substitute for investing. */
const HELD_ITEMS = {
  band:   { name:'Muscle Band',  icon:'🎽', tier:2, cost:4, kind:'stat', rarity:'common',
            text:'+25% Attack while held.', pct:{ atk:0.25 } },
  claw:   { name:'Quick Claw',   icon:'🪝', tier:2, cost:4, kind:'stat', rarity:'common',
            text:'+20% Speed while held.', pct:{ spd:0.20 } },
  evio:   { name:'Eviolite',     icon:'💠', tier:3, cost:5, kind:'stat', rarity:'uncommon',
            text:'+50% HP, but only while it can still evolve.',   // 4.7.0: was +25%; and every Gen 2 evolution counts when Gen 2 is on, open in this run\u2019s pool or not
            pct:{ hp:0.50 }, when:u => canStillEvolve(u.id),
            offText:'No effect — this one has nowhere left to evolve.' },
  coat:   { name:'Assault Vest', icon:'🦺', tier:4, cost:5, kind:'stat', rarity:'uncommon',   // 4.0.0 (Sean): was Metal Coat, which is now Gen 2's evolution item; same effect, same id so saves keep it
            text:'Takes 15% less damage from every hit.', cutPct:0.15 },
  char:   { name:'Expert Belt',  icon:'🎗️', tier:4, cost:5, kind:'stat', rarity:'uncommon',
            text:'+20% Attack, and its hits are never resisted: a “not very effective” hit deals full damage instead.', pct:{ atk:0.20 }, unresist:true },   // 4.8.0: was the unresist alone
  lefto:  { name:'Leftovers',    icon:'🍎', tier:3, cost:5, kind:'trigger', rarity:'uncommon',
            text:'Heals 22% of its max HP on a steady beat, all fight long.', endRoundPct:0.22 },   // 4.8.0: was 12%
  sitrus: { name:'Sitrus Berry', icon:'🍒', tier:2, cost:5, kind:'trigger', rarity:'uncommon',
            text:'Once per battle, when it drops below half HP, heals 35% of its max HP.', berry:0.35 },
  focus:  { name:'Focus Band',   icon:'🥋', tier:4, cost:5, kind:'trigger', rarity:'uncommon',
            text:'Once per battle, a hit that would knock it out leaves it on 1 HP instead.', endure:true },
  egg:    { name:'Lucky Egg',    icon:'🥚', tier:3, cost:5, kind:'economy', rarity:'rare',
            text:`After every fight it gets bonus EXP, as if it had fought twice — up to ${TUNING.eggCap} times per pokémon.`, expTick:1,
            when:u => (u.eggTicks || 0) < TUNING.eggCap,
            offText:`Fully trained — this pokémon has had all ${TUNING.eggCap} bonus rounds. Pass the egg on.` },
  coin:   { name:'Amulet Coin',  icon:'🪙', tier:2, cost:5, kind:'economy', rarity:'uncommon',
            text:'+2₽ at the start of each turn.', income:2 },
  /* v53 — two items for the two ends of a formation. `boss:'none'` keeps them
     off gym leaders, whose difficulty was measured with the older list. */
  bell:   { name:'Shell Bell',   icon:'🐚', tier:3, cost:5, kind:'trigger', rarity:'rare', boss:'none',
            text:'35% of the damage it deals heals your most-hurt pokémon (itself included).', bell:0.35 },
  helmet: { name:'Rocky Helmet', icon:'🪖', tier:3, cost:5, kind:'trigger', rarity:'rare', boss:'none',
            text:'Anything that hits it takes 10% of its own max HP.', helmet:0.10 },
  /* v51 — the trade-off items (Very rare). Each is a big number with a real
     cost attached, so where you put it is a decision. Two are Sean's (Iron
     Ball, Heart Scale). `boss:'elite'`: gym leaders never hold them, but each
     Elite Four member and the Champion carries one (v52, Sean) — see
     generateAiTeam. */
  /* v52 (Sean): like the real item, it locks the holder into one move — the
     second move never fires — instead of costing Speed. */
  choice: { name:'Choice Band',  icon:'🎀', tier:4, cost:6, kind:'stat', rarity:'veryrare', boss:'elite',
            text:'+30% Attack, but −5% HP, and it only ever uses its main move — its second move never fires.', pct:{ atk:0.30, hp:-0.05 }, lockMain:true },
  orb:    { name:'Life Orb',     icon:'🔮', tier:4, cost:6, kind:'trigger', rarity:'veryrare', boss:'elite',
            text:'Its attacks deal 50% more damage, but each attack that lands costs it 6% of its max HP.',
            dmgBoost:0.50, orbCost:0.06 },
  iron:   { name:'Iron Ball',    icon:'⚫', tier:4, cost:6, kind:'stat', rarity:'veryrare', boss:'elite',
            text:'Takes 35% less damage from every hit, but nothing can heal it for the whole battle — not even its own moves. (Resting in the PC still works.)',
            cutPct:0.35, noHeal:true },
  scale:  { name:'Heart Scale',  icon:'💗', tier:3, cost:6, kind:'trigger', rarity:'veryrare', boss:'elite',
            text:'Every heal it gives is doubled (its healing moves, and a Support’s Aftercare), but −15% Attack.', healBoost:1.0, pct:{ atk:-0.15 } },
};

const heldOf = u => (u && u.held && HELD_ITEMS[u.held]) || null;
/** Is a gated stat item (Eviolite) actually doing anything on this pokémon? */
const heldActive = u => { const h = heldOf(u); return !!h && (!h.when || h.when(u)); };
/** The stat bonus a held item is currently granting, in whole points.
    `stat` is flat, `pct` is a share of the pokémon's own number. */
function heldStats(u){
  const out = { hp:0, atk:0, spd:0 };
  const h = heldOf(u);
  if(!h || (h.when && !h.when(u))) return out;
  if(h.stat){ out.hp += h.stat.hp||0; out.atk += h.stat.atk||0; out.spd += h.stat.spd||0; }
  if(h.pct){
    const base = { hp:u.hp, atk:u.atk + (u.tmpAtk||0), spd:u.spd + (u.tmpSpd||0) };
    for(const k of ['hp','atk','spd'])
      if(h.pct[k]) out[k] += h.pct[k] > 0 ? Math.max(1, Math.round(base[k] * h.pct[k]))
                                          : Math.min(-1, Math.round(base[k] * h.pct[k]));   // Choice Band's cost (v51)
  }
  return out;
}
/* Effective stats: base + EXP/levels (already baked into u.*) + X items + held.
   Held bonuses are NOT baked in, so taking the item off simply removes them. */
const effHp  = u => Math.max(1, u.hp + heldStats(u).hp);
const effAtk = u => Math.max(0, u.atk + (u.tmpAtk || 0) + heldStats(u).atk);
const effSpd = u => Math.max(1, u.spd + (u.tmpSpd || 0) + heldStats(u).spd);

/* How long one pokémon waits between actions. The battle's clock and the
   shop's preview both read this: if each computed the gap itself they would
   drift apart on the next tuning change and the preview would quietly start
   lying about the fight. Battle units already carry effSpd baked into .spd,
   so the primitive takes a NUMBER and each caller supplies the speed it has. */
const intervalFor = spd => TUNING.atbQuantum / Math.max(1, spd);
const actionInterval = u => intervalFor(effSpd(u));

/* The order a group of pokémon would act in, walked forward on that clock.
   Pure — it never touches the units it is given. */
function previewOrder(units, n = 8){
  const q = units.filter(Boolean).map((u, i) => ({ u, i, at: actionInterval(u) }));
  const out = [];
  while(out.length < n && q.length){
    q.sort((a, b) => a.at - b.at || effSpd(b.u) - effSpd(a.u) || a.i - b.i);
    out.push(q[0].u);
    q[0].at += actionInterval(q[0].u);
  }
  return out;
}

/* A pokémon's rate as a multiple of the party's — the number that answers
   "is 61 speed fast?", which the raw stat never could. Null with no party to
   compare against, because 1.00x against yourself alone says nothing. */
function paceVs(u, team){
  const live = (team || []).filter(Boolean);
  if(!live.length) return null;
  const avg = live.reduce((n, x) => n + effSpd(x), 0) / live.length;
  if(!(avg > 0)) return null;
  return effSpd(u) / avg;
}

/* Where it would slot in: 0 = fastest on the team. */
function paceRank(u, team){
  const live = (team || []).filter(Boolean).filter(x => x !== u);
  return live.filter(x => effSpd(x) > effSpd(u)).length;
}
/** Everything the player owns, party and PC alike — both can hold items. */
const ownedUnits = G => [...(G.team || []), ...(G.pc || [])];

/* ===================================================================
   RNG — seedable so battles can be replayed / verified server-side
   =================================================================== */
function makeRng(seed){
  let s = (seed >>> 0) || 1;
  return function(){ s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

/* ===================================================================
   UNITS
   =================================================================== */
let _uid = 1;
/** Restore the uid counter above everything a saved game already holds.
    Without this a reload restarts the counter at 1 and freshly rolled
    pokémon collide with the uids of the team and PC that were loaded from
    storage — which silently swaps them anywhere uid is used as a key. */
function syncUid(G){
  let max = 0;
  const see = u => { if(u && u.uid > max) max = u.uid; };
  (G.team || []).forEach(see);
  (G.pc || []).forEach(see);
  (G.daycare || []).forEach(s => s && see(s.unit));
  if(max >= _uid) _uid = max + 1;
  return _uid;
}
const levelFromExp = exp =>
  exp >= TUNING.expForLevel3 ? 3 : exp >= TUNING.expForLevel2 ? 2 : 1;

function makeUnit(id, exp){
  const sp = SPECIES[id];
  return { uid:_uid++, id, nm:sp.name, hp:sp.hp, atk:sp.atk, spd:sp.spd, exp:exp||0,
           tmpAtk:0, tmpSpd:0, rest:0 };
}
const unitLevel = u => isLegend(u) ? 1 : levelFromExp(u.exp);

function expPipsToNext(u){
  if(isLegend(u)) return { have:0, need:0 };   // 2.1.0: no levels, no pips
  const l = levelFromExp(u.exp || 0);
  if(l === 3) return { have:0, need:0 };
  const base = l === 1 ? 0 : TUNING.expForLevel2;
  const next = l === 1 ? TUNING.expForLevel2 : TUNING.expForLevel3;
  return { have: (u.exp||0) - base, need: next - base };
}
const moveOf = u => SPECIES[u.id].move;
const move2Of = u => SPECIES[u.id].move2 || null;

/* ===================================================================
   BATTLE SIMULATOR
   Records one step per ACTION (all of that action's log lines plus a
   snapshot of both teams), so the UI can replay it at any speed.
   =================================================================== */
function simulateBattle(playerTeam, enemyTeam, seed, opts){
  const rnd = makeRng(seed || 12345);

  const clone = (u, side, idx) => {
    const sp = SPECIES[u.id];
    const h = heldOf(u), hp = effHp(u);
    // in the Elite Four a pokémon starts where its last fight left it
    const f = side === 'p' && opts && opts.hpFrac ? opts.hpFrac[u.uid] : null;
    const start = f == null ? hp : Math.max(1, Math.round(hp * f));
    return { uid:u.uid, id:u.id, nm:sp.name, type:sp.type,
      pos: Number.isInteger(u.pos) ? u.pos : idx,
      hp:start, maxHp:hp,
      atk:effAtk(u),                    // X Attack / X Speed apply here and
      spd:effSpd(u),                    // are cleared when the turn ends
      exp:u.exp||0, lvl:unitLevel(u), side, dead:false, turns:0, reduce:0, init:rnd(),
      role:roleOf(u), atk0:effAtk(u), spd0:effSpd(u), rallies:0,
      st:null, stHad:{}, shield:0, focus:0,
      // the held item rides along: its flat reduction, and one use of a trigger
      held:u.held || null, itemUsed:false, itemReduce:(h && h.reduce) || 0, itemCut:(h && h.cutPct) || 0,
      moveHp:0, moveHpCap: Math.max(1, Math.round(hp * TUNING.moveGuardCap.hpPct)) };
  };

  const byPos = (a, b) => a.pos - b.pos;
  const B = { teams: { p: playerTeam.map((u, i)=>clone(u,'p',i)).sort(byPos), e: enemyTeam.map((u, i)=>clone(u,'e',i)).sort(byPos) },
              steps: [], rnd };
  const everyone = [...B.teams.p, ...B.teams.e];   // 2.0.0: kill() removes the fallen, the recap needs them all

  const other = s => (s === 'p' ? 'e' : 'p');
  B.enemies  = u => B.teams[other(u.side)].slice();
  B.allies   = u => B.teams[u.side].filter(x => x !== u);
  /* The frontmost living rank on the far side, and one of its members at
     random — two bodies up front halve each attack's chance of landing on
     either. Seeded, so the fight still replays identically. */
  /* Ranks come from where each pokémon STANDS (pos / rankWidth). The front is
     the frontmost rank anyone is still standing in: nobody shuffles forward when
     a pokémon faints — the rank behind only becomes the front once the whole
     rank ahead of it is down. (v34; before, the line closed up one by one.) */
  const rankNo = u => Math.floor(u.pos / TUNING.rankWidth);
  const frontNo = side => { const t = B.teams[side]; return t.length ? Math.min(...t.map(rankNo)) : 0; };
  B.frontRank = u => { const s = other(u.side), f = frontNo(s); return B.teams[s].filter(x => rankNo(x) === f); };
  /* Bodyguard: a Tank in the rank takes the hit. Two Tanks share it. */
  B.front    = u => { const all = B.frontRank(u); if(!all.length) return null;
    const tanks = all.filter(x => x.role === 'tank');
    const r = tanks.length ? tanks : all;
    return r[Math.floor(rnd() * r.length)]; };
  /* Covering Fire: behind its own front rank, with a Tank or Bruiser in it */
  B.covered  = u => { if(B.isFront(u)) return false; const f = frontNo(u.side);
    return B.teams[u.side].some(x => !x.dead && rankNo(x) === f && (x.role === 'tank' || x.role === 'bruiser')); };
  // an Iron Ball holder can't be healed, so healers look past it (v51)
  B.mostHurt = u => B.teams[u.side].filter(x => !x.dead && x.hp < x.maxHp && !(heldOf(x) && heldOf(x).noHeal))
    .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || a.init - b.init)[0] || null;
  B.ownFront = u => B.teams[u.side][0] || null;
  B.isFront  = u => rankNo(u) === frontNo(u.side);
  B.rankOf   = u => rankNo(u);
  B.fastest  = u => B.enemies(u).slice().sort((a,b)=>b.spd-a.spd || b.init-a.init)[0] || null;
  B.biggest  = u => B.enemies(u).slice().sort((a,b)=>b.hp-a.hp   || b.init-a.init)[0] || null;

  let pendingFx = [], lines = [];
  const cap = u => ({ uid:u.uid, id:u.id, nm:u.nm, hp:Math.max(0,u.hp), maxHp:u.maxHp,
                      atk:Math.max(0,u.atk), spd:Math.max(0,u.spd), exp:u.exp, lvl:u.lvl,
                      st: u.st ? u.st.id : null, shield: u.shield || 0, pos: u.pos });
  B.log = text => { lines.push(text); };
  B.fx  = (u, kind) => { pendingFx.push({ uid:u.uid, side:u.side, kind }); };   // v36: side, so the arena can't mix up equal uids
  B.snap = actorUid => {
    if(!lines.length && !pendingFx.length) return;
    B.steps.push({ lines, actor: actorUid || null,
      p: B.teams.p.map(cap), e: B.teams.e.map(cap), fx: pendingFx });
    lines = []; pendingFx = [];
  };

  B.hit = (src, tgt, mult, opts) => {
    opts = opts || {};
    if(!tgt || tgt.dead) return 0;
    let m = 1;
    if(!opts.noType){
      m = typeMult(src.type, tgt.type);
      if(m < 1 && opts.ignoreResist) m = 1;
      // Expert Belt (v50): the holder's hits are never resisted
      if(m < 1 && heldOf(src) && heldOf(src).unresist) m = 1;
      // Steady: a Bruiser takes super-effective hits at a reduced multiplier
      if(m > 1 && tgt.role === 'bruiser') m = TUNING.roles.bruiser.superTaken;
    }
    // Covering Fire: a Cannon hits harder while a Tank or Bruiser holds its front rank
    if(src.role === 'cannon' && B.covered(src)) mult *= 1 + TUNING.roles.cannon.backBoost;
    // …and a Bruiser shrugs a share of every hit off
    if(tgt.role === 'bruiser') mult *= TUNING.roles.bruiser.dmgTaken || 1;
    const srcItem = heldOf(src);
    // (the old Expert Belt, before v50: a bonus on hits that were already super effective)
    const boost = (srcItem && srcItem.superBoost && m > 1) ? 1 + srcItem.superBoost : 1;
    // Assault Vest (v50, was Metal Coat) / Iron Ball (v51): a share off every hit, so it still matters late in a run
    if(tgt.itemCut) mult *= 1 - tgt.itemCut;
    // Life Orb (v51): harder hits, paid for once per action in act()
    if(srcItem && srcItem.dmgBoost && src !== tgt){ mult *= 1 + srcItem.dmgBoost; src.orbHit = true; }
    // a burned pokémon hits softer (v33) — like the real games' halved Attack, but gentler
    if(src.st && src.st.id === 'brn' && src !== tgt) mult *= 1 - TUNING.status.brn.atkCut;
    // Focus Energy and friends: the next hit lands harder, then it's spent
    if(src.focus && src !== tgt){ mult *= 1 + src.focus; src.focusSpent = true; }
    let dealt = Math.max(1,
      Math.round(src.atk * TUNING.atkPerDamage * mult * m * boost)
        - (tgt.reduce || 0) - (tgt.itemReduce || 0));
    const note = m > 1 ? " It's super effective!" : m < 1 ? " It's not very effective…" : '';
    // a barrier soaks the hit first
    if(tgt.shield > 0){
      const soak = Math.min(tgt.shield, dealt);
      tgt.shield -= soak; dealt -= soak;
      B.log(`${tgt.nm}'s barrier soaked ${soak}${tgt.shield ? '' : ' and broke'}.`);
    }
    tgt.hp -= dealt;
    // 2.0.0: the recap's numbers
    if(src !== tgt){ src.rDealt = (src.rDealt || 0) + dealt; tgt.rTaken = (tgt.rTaken || 0) + dealt;
      if(tgt.hp <= 0 && !tgt.dead) src.rKos = (src.rKos || 0) + 1; }
    B.fx(tgt, m > 1 ? 'crit' : 'hit');
    if(dealt || !note) B.log(`${tgt.nm} took ${dealt} damage.${note}`);
    itemOnDamaged(tgt);
    if(tgt.hp <= 0) kill(tgt);
    // v53: Shell Bell turns a share of the damage it deals into healing for
    // whichever teammate is most hurt (itself included) — a back-row hitter
    // rarely needs the HP itself, so it rings for the front line
    if(srcItem && srcItem.bell && src !== tgt && src.side !== tgt.side && dealt > 0 && !src.dead){
      const a = B.mostHurt(src);
      const n = a ? B.heal(a, Math.max(1, Math.round(dealt * srcItem.bell)), src) : 0;
      if(n) B.log(`${src.nm}'s ${srcItem.name} rang: ${a === src ? 'itself' : a.nm} +${n} HP.`);
    }
    // …and a Rocky Helmet hurts whoever hits its holder
    const tgtItem = heldOf(tgt);
    if(tgtItem && tgtItem.helmet && src !== tgt && src.side !== tgt.side && !src.dead){
      const n = Math.max(1, Math.round(src.maxHp * tgtItem.helmet));
      src.hp -= n; B.fx(src, 'hit'); B.log(`${src.nm} was hurt by ${tgt.nm}'s ${tgtItem.name} (${n}).`);
      if(src.hp <= 0) kill(src);
    }
    return dealt;
  };

  /* ---- v32 helpers ---- */
  B.pickTarget = (u, how) => {
    const foes = B.enemies(u).filter(x => !x.dead);
    if(!foes.length) return null;
    if(how === 'random')  return foes[Math.floor(rnd() * foes.length)];
    if(how === 'fastest') return B.fastest(u);
    if(how === 'back')    return foes[foes.length - 1];
    if(how === 'biggest') return B.biggest(u);
    if(how === 'weakest') return foes.slice().sort((a, b) => a.hp - b.hp || b.init - a.init)[0];
    return B.front(u);
  };
  B.barrier = (t, n) => {
    if(!t || t.dead) return;
    if(n > (t.shield || 0)){ t.shield = n; B.fx(t,'buff'); B.log(`${t.nm} is protected by a barrier (${n}).`); }
    else B.log(`${t.nm}'s barrier is already as strong.`);
  };
  /* Inflict a status. One at a time; each (but flinch) at most once a battle;
     Fire can't burn, Electric can't be paralysed, Poison types can't be poisoned. */
  B.inflict = (t, id, chance) => {
    const S = TUNING.status[id];
    if(!t || t.dead || !S || t.st) return false;
    if(!S.repeat && t.stHad[id]) return false;
    const g1 = (SPECIES[t.id].gen1 || '').split('/');
    if((id === 'brn' && t.type === 'Fire') || (id === 'par' && t.type === 'Electric') || (id === 'psn' && g1.includes('Poison'))){
      B.log(`${t.nm} is unaffected.`); return false; }
    if(chance < 1 && rnd() >= chance) return false;
    t.st = { id, left: S.rounds || S.actions }; t.stHad[id] = true;
    B.fx(t,'hit');
    B.log(`${t.nm} ${{ brn:`was burned! Its attacks are ${Math.round(S.atkCut*100)}% weaker.`, psn:'was poisoned!', par:'is paralysed! It will act less often.',
      slp:'fell asleep!', cnf:'became confused!', fln:'flinched!' }[id]}`);
    return true;
  };

  /* Every in-battle heal from a pokémon goes through here (v51: with its source).
     Heart Scale makes the healer's heals bigger; Iron Ball refuses them. */
  B.heal = (t, n, src) => { if(!t || t.dead) return 0;
    const th = heldOf(t);
    if(th && th.noHeal){ if(!t.ironSaid){ t.ironSaid = true; B.log(`${t.nm}'s ${th.name} stops it from being healed for the rest of this battle.`); } return 0; }
    const sh = src && heldOf(src);
    if(sh && sh.healBoost) n = Math.round(n * (1 + sh.healBoost));
    const was = t.hp;
    t.hp = Math.min(t.maxHp, t.hp + n); if(t.hp > was) B.fx(t,'buff');
    if(src && t.hp > was) src.rHealed = (src.rHealed || 0) + (t.hp - was);   // 2.0.0: recap
    return t.hp - was; };
  B.boost = (t, d) => {
    if(!t || t.dead) return;
    // a drop can take at most TUNING.dropFloor off the stat it started the battle with
    if(d.atk) t.atk = d.atk < 0 ? Math.max(Math.round(t.atk0 * TUNING.dropFloor), t.atk + d.atk) : t.atk + d.atk;
    if(d.spd) t.spd = Math.max(1, t.spd + d.spd);
    if(d.hp){ t.maxHp += d.hp; t.hp += d.hp; }
    B.fx(t, (d.atk < 0 || d.spd < 0) ? 'hit' : 'buff');
  };
  /* HP / damage reduction granted BY A MOVE, clamped to this battle's
     allowance. Item and EXP health is already baked into u.hp before the
     fight, so it raises the allowance rather than being limited by it. */
  B.fortify = (u, hp, reduce) => {
    if(!u || u.dead) return;
    const hpGain = Math.max(0, Math.min(hp, u.moveHpCap - u.moveHp));
    if(hpGain){ u.moveHp += hpGain; u.maxHp += hpGain; u.hp += hpGain; }
    const rCap = TUNING.moveGuardCap.reducePerLevel * u.lvl;
    const rGain = Math.max(0, Math.min(reduce, rCap - u.reduce));
    if(rGain) u.reduce += rGain;
    if(hpGain || rGain){
      B.fx(u, 'buff');
      B.log(`${u.nm} braced${hpGain ? ` (+${hpGain} HP)` : ''}${rGain ? `, blocking ${u.reduce}` : ''}.`);
    } else {
      B.log(`${u.nm} can't harden any further.`);
    }
  };

  B.slow = (t, n) => {
    if(!t || t.dead) return;
    const floor = Math.max(1, Math.round(t.spd0 * TUNING.dropFloor));
    if(t.spd <= floor){ B.log(`${t.nm}'s Speed won't go any lower.`); return; }
    t.spd = Math.max(floor, t.spd - n);
    B.fx(t,'hit'); B.log(`${t.nm}'s Speed fell to ${t.spd}.`);
  };
  B.recoil = (u, n) => {
    if(!u || u.dead) return;
    u.hp -= n; B.fx(u,'hit'); B.log(`${u.nm} is hurt by recoil (${n}).`);
    if(u.hp <= 0) kill(u);
  };

  /* A held item's one reaction to taking damage: Focus Band catches a fatal
     hit, Sitrus Berry catches the drop below half. Each spends the item. */
  function itemOnDamaged(u){
    const h = heldOf(u);
    if(!h || u.itemUsed || u.dead) return;
    if(h.endure && u.hp <= 0){
      u.hp = 1; u.itemUsed = true;
      B.fx(u,'buff'); B.log(`${u.nm} hung on with its ${h.name}!`);
      return;
    }
    if(h.berry && u.hp > 0 && u.hp <= u.maxHp / 2){
      const heal = Math.max(1, Math.round(u.maxHp * h.berry));
      u.hp = Math.min(u.maxHp, u.hp + heal);
      u.itemUsed = true;
      B.fx(u,'buff'); B.log(`${u.nm} ate its ${h.name} (+${heal} HP).`);
    }
  }
  /* End-of-round upkeep: Leftovers and anything else that ticks. */
  function itemUpkeep(){
    let any = false;
    // burns and poison hurt; round-counted statuses wear off
    for(const u of [...B.teams.p, ...B.teams.e]){
      if(u.dead || !u.st) continue;
      const S = TUNING.status[u.st.id];
      if(!S.rounds) continue;
      if(S.dotPct){
        const n = Math.max(1, Math.round(u.maxHp * S.dotPct));
        u.hp -= n; B.fx(u,'hit'); B.log(`${u.nm} is hurt by its ${S.name.toLowerCase()} (${n}).`); any = true;
        if(u.hp <= 0){ kill(u); continue; }
      }
      if(--u.st.left <= 0){ B.log(`${u.nm} is no longer ${{ brn:'burned', psn:'poisoned', par:'paralysed' }[u.st.id]}.`); u.st = null; any = true; }
    }
    // Aftercare: each Support tends its most-hurt teammate
    for(const u of [...B.teams.p, ...B.teams.e]){
      if(u.dead || u.role !== 'support') continue;
      const a = B.mostHurt(u); if(!a) continue;
      const n = B.heal(a, Math.max(1, Math.round(a.maxHp * TUNING.roles.support.careRound)), u);
      if(n){ B.log(`${u.nm} tended to ${a === u ? 'itself' : a.nm} (+${n} HP).`); any = true; }
    }
    for(const u of [...B.teams.p, ...B.teams.e]){
      const h = heldOf(u);
      if(!h || !(h.endRound || h.endRoundPct) || u.dead || u.hp >= u.maxHp) continue;
      const want = h.endRound || Math.max(1, Math.round(u.maxHp * h.endRoundPct));
      const heal = Math.min(want, u.maxHp - u.hp);
      u.hp += heal; B.fx(u,'buff');
      B.log(`${u.nm} restored ${heal} HP with its ${h.name}.`);
      any = true;
    }
    if(any) B.snap(null);
  }

  function kill(u){
    if(u.dead) return;
    u.dead = true;
    const arr = B.teams[u.side];
    const i = arr.indexOf(u);
    if(i >= 0) arr.splice(i, 1);
    B.fx(u,'faint');
    B.log(`${u.nm} fainted!`);
  }

  /* Does this pokémon's second move fire on this action? */
  function secondFires(u, m2){
    if(!m2) return false;
    if(m2.trig === 'open')  return u.turns === 1;
    if(m2.trig === 'every') return u.turns % m2.n === 0;
    if(m2.trig === 'low'){ if(u.m2used || u.hp > u.maxHp / 2) return false; u.m2used = true; return true; }
    if(m2.trig === 'allyLow'){
      if(u.turns - (u.m2last || -9) < 2) return false;
      if(!B.teams[u.side].some(a => a !== u && !a.dead && a.hp < a.maxHp / 2)) return false;
      u.m2last = u.turns; return true;
    }
    return false;
  }
  function act(u){
    if(u.dead) return;
    // status that costs the action
    if(u.st && (u.st.id === 'slp' || u.st.id === 'fln')){
      B.log(u.st.id === 'slp' ? `${u.nm} is fast asleep.` : `${u.nm} flinched and couldn't move!`);
      if(--u.st.left <= 0){ if(u.st.id === 'slp') B.log(`${u.nm} woke up!`); u.st = null; }
      B.fx(u, 'hit'); B.snap(u.uid); return;
    }
    if(u.st && u.st.id === 'cnf'){
      const S = TUNING.status.cnf;
      const left = --u.st.left; if(left <= 0) u.st = null;
      if(rnd() < S.selfHit){
        B.log(`${u.nm} is confused! It hurt itself in its confusion!`);
        B.hit(u, u, pw(S.selfPower, u.lvl), { noType:true });
        if(!u.st && !u.dead) B.log(`${u.nm} snapped out of confusion.`);
        B.snap(u.uid); return;
      }
      if(!u.st) B.log(`${u.nm} snapped out of confusion.`);
    }
    u.turns++;
    // Choice Band (v52): locked into the main move, so the second never fires
    const m2 = (heldOf(u) && heldOf(u).lockMain) || u.sealed ? null : move2Of(u);
    if(secondFires(u, m2)){
      B.log(`${u.nm} used ${m2.name}!`);
      m2.fn(u, B, u.lvl);
      if(m2.free) actMain(u);        // a free move (Focus Energy) doesn't cost the action
    } else {
      actMain(u);
    }
    if(u.focusSpent){ u.focus = 0; u.focusSpent = false; }
    // Life Orb: the cost of an action that hit something
    if(u.orbHit){ u.orbHit = false; const h = heldOf(u);
      if(h && h.orbCost && !u.dead){ const n = Math.max(1, Math.round(u.maxHp * h.orbCost));
        u.hp -= n; B.fx(u, 'hit'); B.log(`${u.nm} lost ${n} HP to its ${h.name}.`); if(u.hp <= 0) kill(u); } }
    B.fx(u, 'act');
    B.snap(u.uid);
  }
  function actMain(u){
    const mv = moveOf(u);
    if(!mv.every || (u.turns % mv.every === 0)){
      B.log(`${u.nm} used ${mv.name}!`);
      mv.fn(u, B, u.lvl);
    } else {
      const basic = mv.basic || { name:'Tackle', mult:1 };
      B.log(`${u.nm} used ${basic.name}!`);
      const t = B.front(u);
      if(t) B.hit(u, t, pw(basic.mult, u.lvl));
    }
  }

  /* ---------------- the action meter ----------------
     Rounds are gone as a unit of action. Every pokémon's next action lands
     `Q / speed` later on a shared clock, so speed is simply the rate at which
     you act: twice the speed is twice the actions, at every value, with no
     threshold and no cap. A slow pokémon is not merely last any more — it
     genuinely acts less often, which is what makes speed a real stat and a
     real cost to skip.

     A "round" survives only as a quantum of TIME — how long a pokémon of the
     battle's average speed takes to act once. Item upkeep (Leftovers) ticks on
     that clock rather than on a turn count, so it means the same thing it
     always did however fast the field is. */
  const Q = TUNING.atbQuantum;
  const interval = u => intervalFor(u.spd);   // .spd is already effective here
  const allUnits = () => [...B.teams.p, ...B.teams.e];

  // a priority opener (Quick Attack…) goes before anybody's first action
  const prio = u => { const m = move2Of(u); return !!(m && m.trig === 'open' && m.priority); };
  for(const u of allUnits()) u.next = interval(u) * (prio(u) ? 0.05 : 1);
  const startSpeeds = allUnits().map(u => Math.max(1, u.spd));
  const refSpeed = startSpeeds.reduce((a, b) => a + b, 0) / Math.max(1, startSpeeds.length);
  const roundTime = Q / refSpeed;

  /* Who acts next, and after that — the battle screen shows this so a player
     can see speed working instead of inferring it. Pure: it walks a copy. */
  B.upcoming = (n) => {
    const q = allUnits().filter(u => !u.dead).map(u => ({ u, at: u.next }));
    const out = [];
    while(out.length < n && q.length){
      q.sort((a, b) => a.at - b.at || b.u.spd - a.u.spd || b.u.init - a.u.init);
      const head = q[0];
      out.push(head.u.uid);
      head.at += interval(head.u);
    }
    return out;
  };

  B.log('Battle start!'); B.snap(null);
  let rounds = 0, actions = 0, now = 0, nextUpkeep = roundTime;
  while(B.teams.p.length && B.teams.e.length
        && rounds < TUNING.maxBattleRounds && actions < TUNING.maxBattleActions){
    const living = allUnits().filter(u => !u.dead);
    if(!living.length) break;
    // the earliest action on the clock; ties go to the faster pokémon
    let turn = living[0];
    for(const u of living)
      if(u.next < turn.next
         || (u.next === turn.next && (u.spd > turn.spd || (u.spd === turn.spd && u.init > turn.init))))
        turn = u;

    // upkeep happens on the clock, not between turns
    if(nextUpkeep <= turn.next){
      now = nextUpkeep; nextUpkeep += roundTime; rounds++;
      itemUpkeep();
      continue;
    }

    now = turn.next;
    act(turn);
    turn.next = now + interval(turn) * (turn.st && turn.st.id === 'par' ? TUNING.status.par.slow : 1);
    actions++;
    // tell the last step who is queued up behind this action
    const last = B.steps[B.steps.length - 1];
    if(last && last.actor === turn.uid) last.up = B.upcoming(6);
  }

  let result = 'draw';
  if(B.teams.p.length && !B.teams.e.length) result = 'win';
  else if(!B.teams.p.length && B.teams.e.length) result = 'lose';
  B.log(result === 'win' ? 'You win!' : result === 'lose' ? 'You lost the battle.' : "It's a draw!");
  B.snap(null);

  const stats = everyone.map(u => ({ uid:u.uid, id:u.id, side:u.side, dealt:u.rDealt || 0, taken:u.rTaken || 0,
    healed:u.rHealed || 0, kos:u.rKos || 0, fainted:!!u.dead }));
  return { result, steps:B.steps, rounds, actions, stats };
}

/* ===================================================================
   AI OPPONENT BUILDER
   =================================================================== */
/* Kept in TUNING so it can be swept: a change to how the PLAYER grows has to be
   matched here or trainer battles silently become a different game. */
const AI_DIFFICULTY = 0.95;  // stat growth per turn — lower = easier run (see TUNING.aiDifficulty)
/* How fast the AI fills its party. This is the dial the longer run broke: at
   1.2 the AI fielded six pokémon by turn 6, which was fair over an 11-turn run
   and crushing over a 37-turn one, because the player's money buys a team at
   the same rate it always did. Keep it roughly runLength / 11. */
const AI_PARTY_PACE = 3.4;   // higher = easier run
/* Ordinary trainers only, roughly easiest to toughest. No gym leader, Elite
   Four member or Champion may appear here — the list used to end in "Elite
   Four Agatha" and "Champion Lance", so a random turn-10 team was billed as the
   final boss. test.js checks that no name here contains a boss's name. The list
   is spread across the whole run, so the titles get tougher as you go. */
const AI_NAMES = ['Youngster Joey','Bug Catcher Rick','Lass Mira','Camper Theo','Picnicker Tess',
  'Hiker Dale','Sailor Dwayne','Fisherman Wade','Swimmer Luca','Gambler Rico',
  'Super Nerd Kip','Juggler Quinn','Bird Keeper Ash','Beauty Selene','Black Belt Kenji',
  'Psychic Iris','Scientist Morrow','Cooltrainer Nia','Veteran Kell','Ace Trainer Rowan'];
const trainerName = turn =>
  AI_NAMES[Math.max(0, Math.min(AI_NAMES.length - 1,
    Math.floor((turn - 1) / Math.max(1, RUN_LENGTH() / AI_NAMES.length))))] || 'Trainer';

/* One builder for every opponent in the game. A gym leader is this function
   with a themed pool, a stat multiplier and a couple of held items — which is
   why the signature is a spec and not a turn number. */
function generateAiTeam(spec){
  const { turn = 1, seed = 1, badges = 0 } = spec || {};
  const boss = spec && spec.boss ? spec.boss : null;
  const kind = (spec && spec.kind) || 'trainer';
  const rnd = makeRng((seed || 1) * 7919 + turn * 104729 + (boss ? hashId(boss.id) : 0));

  const maxTier = spec && spec.tier ? spec.tier : tierForTurn(turn);
  /* A rematch fields the SAME pokémon. The picks below are seeded with the
     turn, and a blackout moves the turn on, so without this a rematch re-rolled
     its whole lineup — measured, the scouting report was wrong about the rematch
     in 59 of 60 cases. A known lineup keeps who they are and still re-prices
     them to the current turn: they train too, but they are the same team. */
  const lineup = spec && spec.lineup && spec.lineup.length ? spec.lineup : null;
  const size = lineup ? lineup.length : Math.max(1, Math.min(TUNING.maxTeam,
    (spec && spec.size) || Math.floor(turn / AI_PARTY_PACE) + 1 + (rnd() < 0.35 ? 1 : 0)));

  /* A trainer draws from the buyable base forms and evolves some of them.
     A boss draws from its theme INCLUDING evolved forms, so its line-up looks
     like a team someone built rather than a shop roll — but how far up the
     lines it may reach is gated on badges, or Brock fields Golem. */
  const maxDepth = spec && spec.depth !== undefined ? spec.depth
    : badges < 2 ? 0 : badges < 5 ? 1 : 2;
  // Legendaries are endgame property — a gym leader never fields one.
  const openTier = kind === 'gym' || kind === 'trainer' ? 5 : 6;
  const base = boss ? themePool(boss) : BUYABLE;
  const fits = k => SPECIES[k].tier <= Math.min(maxTier, openTier)
                 && (!boss || evoDepth(k) <= maxDepth);
  let pool = base.filter(fits);
  /* Bodyguards. A pure mono-type leader is a coin flip on whether you happened
     to draft its counter — Lt. Surge beat 21% of the bots that reached him and
     every other gym beat 60–95%, because the roster is Water-heavy and
     Electric eats Water. Real gym leaders keep a couple of off-type bodies for
     exactly this reason, so a share of the team comes from outside the theme. */
  /* 3.3.0 (Sean): the Elite Four field FULLY EVOLVED pokémon. A Seel or a Dratini
     in the last five fights read as a shop roll, not a champion-tier trainer.
     Only where the bench has at least three finals — otherwise it keeps its
     earlier forms rather than repeating the same body. */
  const finalsOnly = kind === 'elite' && boss && boss.theme;
  const isFinal = k => !evoNext(k).length;
  /* 3.5.1 (Sean): bodyguards are a curated list per leader (`guards`), not anything
     that happens to be off-theme — Onix has no business in Lt. Surge's gym. Flying
     types cover Surge's Ground weakness, Team Rocket's Rattata and Koffing back
     Giovanni, and so on. A species that evolves is allowed once the run is far
     enough along for this leader to field evolved forms. */
  let offPool = boss && boss.theme
    ? (boss.guards || []).filter(k => SPECIES[k] && inBossPool(k) && !base.includes(k) && SPECIES[k].tier <= Math.min(maxTier, openTier)
        && evoDepth(k) <= maxDepth)
    : [];
  if(finalsOnly){ const f = offPool.filter(isFinal); if(f.length >= 2) offPool = f; }
  const offSlots = boss && boss.theme && offPool.length
    ? Math.max(1, Math.round(size * TUNING.bossOffTheme)) : 0;
  // A themed pool is small, so give a boss room before it starts repeating.
  if(pool.length < 3)
    pool = base.filter(k => SPECIES[k].tier <= Math.min(openTier, maxTier + 2)
                         && evoDepth(k) <= maxDepth);
  if(!pool.length) pool = base.filter(k => evoDepth(k) <= maxDepth);
  if(!pool.length) pool = base.slice();
  if(!pool.length) pool = BUYABLE.slice();
  if(finalsOnly){ const f = pool.filter(isFinal); if(f.length >= 3) pool = f; }

  const team = [];
  const usedSrc = new Set();    // species drawn out of the pool
  const usedFinal = new Set();  // …and what they turned into after levelling
  for(let i = 0; i < size; i++){
    /* A boss uses everything in its theme before doubling up — picking from
       the high-tier slice first and only then falling back is what gave Erika
       four Scythers. Unused species win, whatever their tier. */
    // the last `offSlots` bodies are the bodyguards, drawn from outside the theme
    const table = ((offSlots && i >= size - offSlots) ? offPool : pool)
      .filter(k => !(spec && spec.ace2 && evoFamily(spec.ace2).includes(k)));   // 1.4.0: his one Eeveelution — no spare Eevee or second Eeveelution
    const pick = () => {
      /* 2.9.0: a leader's first pokémon is their signature — Blaine leads with
         Arcanine, Lance with Dragonite. The first one that suits this point in
         the run (tier and evolution depth) wins; otherwise it's a normal pick. */
      if(i === 0 && boss && boss.signature){
        const sig = boss.signature.find(k => table.includes(k));
        if(sig) return sig;
      }
      const unused = boss ? table.filter(k => !usedSrc.has(k)) : table;
      const from = unused.length ? unused : table;
      const weighted = from.filter(k => SPECIES[k].tier >= Math.max(1, maxTier - 1));
      const src = (rnd() < 0.7 && weighted.length) ? weighted : from;
      return src[Math.floor(rnd() * src.length)];
    };
    let u = null, srcId = null;
    if(!lineup && i === 0 && spec && spec.ace && SPECIES[spec.ace]){
      u = makeUnit(spec.ace, 0); u.exp = TUNING.expForLevel3; srcId = spec.ace;
      usedSrc.add(spec.ace); usedFinal.add(spec.ace);
    } else if(!lineup && i === 1 && spec && spec.ace2 && SPECIES[spec.ace2] && !usedFinal.has(spec.ace2)){
      // 1.4.0: the Champion's second fixed member (his Eeveelution)
      u = makeUnit(spec.ace2, 0); u.exp = TUNING.expForLevel3; srcId = spec.ace2;
      usedSrc.add(spec.ace2); usedFinal.add(spec.ace2);
      const base = evoLine(spec.ace2)[0]; usedSrc.add(base); usedFinal.add(base);   // no second Eevee beside it
    } else if(!lineup && i === 2 && spec && spec.ace3 && SPECIES[spec.ace3]){
      // 2.2.0: the Champion's legendary — level 1 forever, like yours
      u = makeUnit(spec.ace3, 0); srcId = spec.ace3; usedSrc.add(spec.ace3); usedFinal.add(spec.ace3);
    } else if(lineup){
      u = makeUnit(lineup[i].id, 0);
      u.exp = lineup[i].exp || 0;
    } else {
      let exp = 0;
      if(turn >= 5 && rnd() < 0.45) exp = TUNING.expForLevel2;
      if(turn >= 9 && rnd() < 0.30) exp = TUNING.expForLevel3;
      if(boss && rnd() < 0.5) exp = Math.max(exp, TUNING.expForLevel2);

      /* Levelling evolves, so two different picks can land on the same pokémon —
         a Bulbasaur and an Ivysaur both become Venusaur. Dedupe on what the
         unit ENDS as, or Agatha fields three identical Venusaurs. */
      for(let tries = 0; tries < 6; tries++){
        const src = pick();
        const cand = makeUnit(src, 0);
        if(exp) aiLevelTo(cand, levelFromExp(exp));
        u = cand; srcId = src;
        if(!boss || !usedFinal.has(cand.id)) break;
      }
      usedSrc.add(srcId); usedFinal.add(u.id);
    }
    const lv = unitLevel(u);
    // the AI grows along its pokémon's roles exactly like the player's do
    growUnit(u, { hp:  Math.floor(turn * TUNING.aiDifficulty * 2)   + lv * TUNING.levelUpBonus.hp,
                  atk: Math.floor(turn * TUNING.aiDifficulty * 3)   + lv * TUNING.levelUpBonus.atk,
                  spd: Math.floor(turn * TUNING.aiDifficulty * 1.3) + lv * TUNING.levelUpBonus.spd });
    team.push(u);
  }

  // Bosses hold items too — the same ones you can buy, so nothing is unfair.
  const heldFrom = TUNING.bossHeldFrom[kind];
  if(lineup){
    team.forEach((u, i) => { u.held = lineup[i].held && HELD_ITEMS[lineup[i].held] ? lineup[i].held : null; });
  } else if(boss && heldFrom !== undefined && badges >= heldFrom){
    const ids = Object.keys(HELD_ITEMS).filter(k => !HELD_ITEMS[k].boss);
    const howMany = Math.min(team.length, 1 + Math.floor((badges - heldFrom) / 3) + (kind === 'trainer' ? 0 : 1));
    for(let i = 0; i < howMany; i++) team[i].held = ids[Math.floor(rnd() * ids.length)];
    /* v52 (Sean): the Elite Four and the Champion each bring one Very rare
       item, on the pokémon it suits — a Choice Band or Life Orb on their
       hardest hitter, an Iron Ball on their sturdiest, a Heart Scale on a
       Support. Its own seeded roll, so the rest of the team is unchanged. */
    if(kind === 'elite' || kind === 'champion') bossSignatureItem(team, boss, seed);
  }

  /* Price the boss against the player curve. Building first and scaling second
     is what keeps a themed team's shape — Brock still fields rocks, they are
     just worth what a fourth-turn team can beat. */
  const ratio = spec && spec.ratio;
  if(boss && ratio){
    const target = playerPowerAt(turn) * ratio;
    const actual = teamPower(team);
    if(actual > 0){
      const [lo, hi] = TUNING.bossScaleClamp;
      const k = Math.max(lo, Math.min(hi, target / actual));
      for(const u of team){
        u.hp  = Math.max(1, Math.round(u.hp  * k));
        u.atk = Math.max(1, Math.round(u.atk * k));
        u.spd = Math.max(1, Math.round(u.spd * k));
      }
    }
  }

  /* Line up by role — tanks in front, cannons at the back — and the sturdiest
     first within a role, like a human would. */
  team.sort((a,b) => ROLE_ORDER[roleOf(a)] - ROLE_ORDER[roleOf(b)] || effHp(b) - effHp(a));
  const name = boss ? boss.name
    : trainerName(turn);
  return { name, team, boss: boss || null, kind };
}

/* ---------------- power score ----------------
   A single number for "how strong is this team", used to make bosses
   comparable. It used to need lopsided weights (atk ×4, spd ×0.35) because the
   three stats were on wildly different scales and worth wildly different
   amounts per point. Since the rescale a point of each is worth about the same
   in a fight — measured at 1.25 / 1.25 / 1.12 percentage points of win rate —
   so the weights are near 1:1:1 and a plain stat total finally means something
   to a player as well as to the tuner. Re-derive with statvalue.js. */
const unitPower = u => effHp(u) + effAtk(u) + TUNING.spdPower * effSpd(u);
const teamPower = team => (team || []).reduce((n, u) => n + unitPower(u), 0);
/** What a player's team is worth on this turn, measured not guessed. */
const playerPowerAt = t =>
  TUNING.powerCurve.base + TUNING.powerCurve.perTurn * Math.max(1, t);

/** How many evolutions deep a species sits in its own line. */
function evoDepth(id){
  let d = 0, p = evoParent(id), guard = 0;
  while(p && guard++ < 8){ d++; p = evoParent(p); }
  return d;
}

/** A stable small number from a boss id, so each leader rolls differently. */
function hashId(id){
  let h = 0;
  for(let i = 0; i < String(id).length; i++) h = (h * 31 + String(id).charCodeAt(i)) % 100003;
  return h;
}

/** The opponent for whatever stage the game is on. */
/** 2.0.0: Rich & Ruthless makes every opponent tougher. */
/** 4.0.0: a Mono run's opponent scale depends on the gens too — a Gen 2 Ice team is not a Gen 1 one.
    Gen 1 reads TUNING.mods.monoFoes as before; other mixes read monoFoesByGens['2'] / ['1+2']. */
/** 4.0.0: a run rule's opponent scale, overridden per gens where measured (TUNING.mods.byGens). */
function modFoes(G, key){
  const o = (TUNING.mods.byGens || {})[cleanGens(G && G.gens).join('+')] || {};
  return o[key] !== undefined ? o[key] : TUNING.mods[key];
}
function monoFoesFor(G, type){
  const key = cleanGens(G && G.gens).join('+');
  const table = key === '1' ? TUNING.mods.monoFoes : ((TUNING.mods.monoFoesByGens || {})[key] || {});
  return table[type] || 1;
}
function opponentFor(G){
  const o = opponentFor0(G);
  const k = (G.mods && G.mods.rich ? modFoes(G, 'richFoes') : 1) * (G.mods && G.mods.mono ? monoFoesFor(G, G.mods.mono) : 1)
          * (G.mods && G.mods.nopc ? modFoes(G, 'nopcFoes') : 1)   // 2.2.0
          * (G.mods && G.mods.onelife ? modFoes(G, 'onelifeFoes') : 1)   // 2.11.0: One Life has its own knob
          * (TUNING.gensFoes[cleanGens(G && G.gens).join('+')] || 1);   // 4.0.0: a mixed roster is thinner, so its opponents are scaled to match
  if(k !== 1 && o && o.team){
    for(const u of o.team){ u.hp = Math.round(u.hp * k); u.atk = Math.round(u.atk * k); u.spd = Math.round(u.spd * k); }
  }
  return o;
}
function opponentFor0(G){
  useGens(G);
  const st = stageOf(G);
  const m = rivalMeeting(G);
  if(m >= 0){
    const opp = generateAiTeam({ turn: G.turn, seed: G.seed, badges: G.badges || 0, kind:'rival', boss: rivalOf(G),
      lineup: rivalLineup(G, m),
      /* Priced against YOUR team, not the reference curve: a rival keeps pace
         with you. Off the curve, a player who was behind met a rival built for
         a player who wasn't and lost the late meetings ~90% of the time. */
      ratio: (TUNING.rival.ratio[m] || 1) * Math.max(0.5, teamPower(fightersOf(G)) / playerPowerAt(G.turn)) });
    opp.meeting = m;
    return opp;
  }
  if(st.kind === 'red'){
    // 4.1.0: priced on the curve like the Champion; the team is fixed, never rerolled
    const sb = secretOf(G), gk = cleanGens(G.gens).join('+');
    return generateAiTeam({ turn: G.turn, seed: G.seed, badges: G.badges || 0, kind:'red', boss: sb,
      lineup: sb.lineup.map(u => ({ ...u, exp: TUNING.red.exp })),
      ratio: (sb.id === 'oak' ? TUNING.red.oakRatio : TUNING.red.ratio)[gk] || 1.1 });
  }
  const boss = st.boss || null;
  const kind = st.kind;
  const seen = boss && G.scouted ? G.scouted[boss.id] : null;
  const rivalChamp = kind === 'champion' && boss && personOf(boss) === personOf(rivalOf(G));   // 4.0.0: only Blue-as-champion is your rival
  return generateAiTeam({
    // the Champion is your rival — if you've met, his starter leads, fully evolved
    ace: rivalChamp && G.rival && G.rival.starter
      ? evoLine(G.rival.starter)[evoLine(G.rival.starter).length - 1] : null,
    // 1.4.0: and, like in the games, an Eeveelution — the one his Eevee became
    ace2: rivalChamp ? rivalEevo(G) : null,
    // 2.2.0: …and a legendary you didn't recruit — his last surprise
    ace3: kind === 'champion' ? championLegend(G) : null,
    turn: G.turn, seed: G.seed, badges: G.badges || 0, kind, boss,
    lineup: seen ? seen.filter(u => u && SPECIES[u.id]) : null,
    tier: kind === 'elite' || kind === 'champion' ? Math.min(6, tierFor(G) + 1) : tierFor(G),
    size: boss ? Math.min(TUNING.maxTeam,
      Math.max(3, Math.floor(G.turn / AI_PARTY_PACE) + 1 + (TUNING.bossSize[kind] || 0))) : undefined,
    /* `calib` is the per-leader correction. The badge ramp sets how hard this
       point in the run should be; calib absorbs what a theme is worth in a
       fight, which is not something the power score can see — Erika's Grass
       almost never scores a ×2 while Lt. Surge's Electric eats the Water half
       of the roster. Re-derive them with `node calibrate.js --tune`. */
    ratio: !boss ? 0
      : bossCalib(G, st) * (kind === 'gym'
        ? TUNING.gymRatio[Math.min(st.badge || 0, TUNING.gymRatio.length - 1)]
        : (TUNING.bossRatio[kind] || 1)
          * (TUNING.gauntletRatio[(G.stage || 0) - gauntletStart()] || 1)),
  });
}

/* ===================================================================
   THE RIVAL
   Three ambushes a run. WHERE is fixed by the run's seed (one trainer slot in
   each of TUNING.rival.windows) but never shown — the next-up strip says
   "Trainer battle" right up until he walks in. WHO he fields is decided the
   first time you meet: his starter is the type that beats the type your party
   has most of, like picking second in Oak's lab, and the rest of his core team
   is drawn once and kept, evolving each time you meet.
   =================================================================== */
const RIVAL_STARTERS = { Grass:'bulbasaur', Fire:'charmander', Water:'squirtle', Electric:'pikachu', Fighting:'machop',
  Psychic:'abra', Flying:'pidgey', Rock:'geodude', Ground:'rhyhorn', Bug:'caterpie', Ghost:'gastly', Dragon:'dratini',
  Normal:'rattata' };
/** The stage indexes where the rival ambushes this run. Pure: seed only. */
function rivalStages(G){
  const plan = runPlan(G), rnd = makeRng(mix32((G.seed || 1) ^ 0x2c1b3c6d, 77));
  return TUNING.rival.windows.map(([a, b]) => {
    const slots = plan.map((p, i) => ({ p, i }))
      .filter(x => x.p.kind === 'trainer' && x.p.badge >= a && x.p.badge <= b && x.i > 0).map(x => x.i);
    return slots[Math.floor(rnd() * slots.length)];
  });
}
/** Which meeting this stage is (0, 1, 2), or -1 if it's an ordinary battle. */
const rivalMeeting = G => inGauntlet(G) ? -1 : rivalStages(G).indexOf(G.stage || 0);
const isRivalStage = G => rivalMeeting(G) >= 0;
/** The type most of your party is, front-most breaking ties. */
function partyType(G){
  const n = {};
  (G.team || []).forEach((u, i) => { const t = SPECIES[u.id].type; n[t] = (n[t] || 0) + 10 - i * 0.1; });
  return Object.keys(n).sort((a, b) => n[b] - n[a])[0] || null;
}
/* 1.4.0: Blue raises an Eevee, as in the games. It evolves into whichever
   Eeveelution covers his starter's weakness (a Charmander's Blue gets
   Vaporeon, a Squirtle's Jolteon, a Bulbasaur's Flareon), or a seeded pick
   when no Eeveelution covers it. The Champion fields the same one. */
const EEVOS = { Water:'vaporeon', Electric:'jolteon', Fire:'flareon' };
/** 2.2.0: the Champion's legendary — seeded, never one you recruited or own. */
function championLegend(G){
  const mine = new Set([...(G.legendsCaught || []), ...[...(G.team || []), ...(G.pc || [])].filter(isLegend).map(u => u.id)]);
  const pool = LEGENDS().filter(k => !mine.has(k));
  return pool.length ? pool[mix32((G.seed || 1) ^ 0x2545f491, 9) % pool.length] : null;
}
function rivalEevo(G){
  if(G.rival && G.rival.eevo) return G.rival.eevo;
  const starter = G.rival && G.rival.starter;
  const weak = starter && TYPES[SPECIES[starter].type] ? TYPES[SPECIES[starter].type].weak : [];
  const cover = ['Water', 'Electric', 'Fire'].find(t => weak.includes(t));   // 3.0.0: a type can be weak to several
  return EEVOS[cover] || ['vaporeon', 'jolteon', 'flareon'][mix32((G.seed || 1) ^ 0x3b9ac9ff, 5) % 3];
}
/** Decide the rival's team the first time you meet, and keep it. */
function rivalCore(G){
  if(G.rival && G.rival.core) return G.rival;
  const rnd = makeRng(mix32((G.seed || 1) ^ 0x51ed270b, 3));
  const yours = partyType(G);
  /* 3.0.0: a type is weak to several, so he picks the one that suits a starter
     best — a Grass, Fire or Water starter if any of them beats you. */
  const weakTo = yours && TYPES[yours] ? TYPES[yours].weak : [];
  const who0 = rivalOf(G), STARTS = who0.starters ? { ...RIVAL_STARTERS, ...who0.starters } : RIVAL_STARTERS;   // 4.0.0: Silver steals a Johto starter
  const counter = weakTo.find(t => ['Grass', 'Fire', 'Water'].includes(t)) || weakTo.find(t => STARTS[t]);
  const starter = STARTS[counter] || [STARTS.Grass, STARTS.Fire, STARTS.Water][Math.floor(rnd() * 3)];
  const take = [starter];
  const who = rivalOf(G), bird = who.bird || 'pidgey';
  if(starter !== bird && SPECIES[bird]) take.push(bird);        // he always has his bird (Silver: his Zubat)
  const pickRole = (role, maxTier) => {
    const pool = BUYABLE.filter(k => roleOf(k) === role && SPECIES[k].tier <= maxTier && !take.includes(k)
      && SPECIES[k].type !== SPECIES[starter].type);
    if(pool.length) take.push(pool[Math.floor(rnd() * pool.length)]);
  };
  // early members come from what the Daycare has early; later ones from further up
  pickRole('tank', 2);
  if(who.support) take.push(who.support);                      // 1.4.0: Blue's Support is always Eevee
  else pickRole('support', 3);
  pickRole('cannon', 4); pickRole('bruiser', 5);
  G.rival = { core: take, starter, versus: yours, met: 0, beaten: 0 };
  G.rival.eevo = rivalEevo(G);
  return G.rival;
}
/** What he fields at meeting m: the first `size` of his core, evolved m times. */
function rivalLineup(G, m){
  const R = rivalCore(G), size = TUNING.rival.size[m];
  const rnd = makeRng(mix32((G.seed || 1) ^ 0x7f4a7c15, 10 + m));
  const held = Object.keys(HELD_ITEMS).filter(k => HELD_ITEMS[k].kind !== 'economy');   // no Amulet Coins in a fight
  return R.core.slice(0, size).map((base, i) => {
    // his Eevee stays an Eevee the first time, then evolves (1.4.0)
    const line = base === 'eevee' ? ['eevee', 'eevee', R.eevo || rivalEevo(G)] : evoLine(base);
    const id = line[Math.min(line.length - 1, m)];
    // his starter always holds something once you've met; one more item a meeting
    const holds = m > 0 && i < m + 1;
    return { id, exp: m >= 2 ? TUNING.expForLevel3 : m === 1 ? TUNING.expForLevel2 : 0,
             held: holds ? held[Math.floor(rnd() * held.length)] : null };
  });
}
/** What beating him pays at meeting m: credits next turn and a held item. Pure. */
function rivalPrize(G, m){
  const pool = heldPool(G), rnd = makeRng(mix32((G.seed || 1) ^ 0x1b873593, 20 + m));
  return { credits: TUNING.rival.winCredits[m] || 0, item: pool.length ? pickWeighted(pool, HELD_ITEMS, rnd()) : null };
}

function bossSignatureItem(team, boss, seed){
  if(!team.length) return null;
  const r = makeRng(mix32(((seed || 1) ^ 0x2c1b3c6d) >>> 0, hashId(boss.id)));
  const pool = Object.keys(HELD_ITEMS).filter(k => HELD_ITEMS[k].boss === 'elite');
  const byAtk = team.slice().sort((a, b) => b.atk - a.atk);
  const byHp  = team.slice().sort((a, b) => b.hp - a.hp);
  const pick = k => k === 'scale' ? team.find(u => roleOf(u.id) === 'support')
    : k === 'iron' ? (byHp.find(u => roleOf(u.id) === 'tank') || byHp[0])
    : (byAtk.find(u => roleOf(u.id) === 'cannon' || roleOf(u.id) === 'bruiser') || byAtk[0]);
  const order = pool.slice().sort(() => r() - 0.5);
  for(const k of order){ const u = pick(k); if(u){ u.held = k; return k; } }
  return null;
}

/* ===================================================================
   2.0.0 · LEGENDARY ENCOUNTERS
   After each gym from TUNING.legend.fromBadge on, a legendary you haven't met
   this run may appear (seeded, so a reload can't re-roll it). It waits in the
   shop for one turn — recruit it for TUNING.legend.cost or let it go.
   =================================================================== */
const LEGENDS = () => Object.keys(SPECIES).filter(k => SPECIES[k].legendary && inGens(k));   // 4.0.0: this run's gens only
function rollEncounter(G){
  G.encounter = null;
  if(G.badges < TUNING.legend.fromBadge) return null;
  const met = G.legendsMet || [];
  const mono = G.mods && G.mods.mono;
  const pool = LEGENDS().filter(k => !met.includes(k) && (!mono || inTypePool(k, mono)));
  const r = makeRng(mix32(((G.seed || 1) ^ 0x6a09e667) >>> 0, 40 + G.badges));
  const pity = G.badges === TUNING.legend.pityBadge && !met.length;   // 2.2.0: never a run without one
  if(!pool.length || (r() >= TUNING.legend.chance && !pity)) return null;
  const id = pool[Math.floor(r() * pool.length)];
  G.encounter = { id, cost: TUNING.legend.cost, turn: G.turn + 1 };
  G.legendsMet = [...met, id];
  makeGameApi(G).log(`A wild ${SPECIES[id].name} appeared!`);
  return G.encounter;
}
const encounterOpen = G => !!(G.encounter && G.encounter.turn === G.turn && !G.encounter.taken && !inGauntlet(G));
/** Recruit the waiting legendary: into the party if there's room, else the PC. */
function recruitLegend(G, pos){
  if(!encounterOpen(G)) return { ok:false, why:'Nothing is waiting.' };
  const e = G.encounter;
  if(G.credits < e.cost) return { ok:false, why:`Not enough pokecredits (it costs ${e.cost}₽).` };
  fixSlots(G);
  const u = trainerCatchUp(G, makeUnit(e.id, 0));
  if(G.team.length < TUNING.maxTeam){
    u.pos = Number.isInteger(pos) && !teamAt(G, pos) && pos < TUNING.maxTeam ? pos : freePos(G);
    G.team.push(u);
  } else if(pcRoom(G) > 0){
    u.box = freeBox(G); G.pc.push(u);
  } else return { ok:false, why:'Your party and PC are full.' };
  G.credits -= e.cost; e.taken = true; fixSlots(G);
  G.legendsCaught = [...(G.legendsCaught || []), e.id];   // 2.2.0: the Champion brings one you didn't
  makeGameApi(G).log(`${u.nm} joined your team!`);
  return { ok:true, unit:u };
}

/** Level an AI unit up, evolving it the same way the player's would. */
function aiLevelTo(u, level){
  const target = level === 3 ? TUNING.expForLevel3 : TUNING.expForLevel2;
  while(unitLevel(u) < level){
    u.exp = unitLevel(u) === 1 ? TUNING.expForLevel2 : target;
    applyLevelUp(null, u);
  }
}

/* ===================================================================
   NETWORK SEAM — swap this out for real online PvP.
   The game only ever talks to Net; replace these bodies with fetch()
   calls and nothing else changes.
   =================================================================== */
const Net = {
  mode: 'local-ai',
  endpoint: '',
  playerId: null,
  async findOpponent(state){
    if(this.mode === 'online' && !isRivalStage(state)){   // your rival is always yours
      // const r = await fetch(`${this.endpoint}/matchmake`, {method:'POST',
      //   headers:{'content-type':'application/json'},
      //   body: JSON.stringify({playerId:this.playerId, turn:state.turn, badges:state.badges})});
      // return await r.json();   // -> { name, team:[{id,hp,atk,spd,exp}] }
      // Online play only ever replaces the TRAINER battles — the gyms, the
      // Elite Four and the Champion are the run's spine and stay local.
    }
    return opponentFor(state);
  },
  async submitTeam(state){ /* POST exportTeam(state.team) when online */ },
  async reportResult(state, result){ /* POST the result when online */ },
};

/* ===================================================================
   TEAM CODES
   =================================================================== */
function exportTeam(team, label){
  const payload = { v:3, n:label || 'Trainer', t:team.map(u => [u.id, u.hp, u.atk, u.spd, u.exp, Number.isInteger(u.pos) ? u.pos : null]) };
  const json = JSON.stringify(payload);
  const b64 = (typeof btoa !== 'undefined')
    ? btoa(unescape(encodeURIComponent(json)))
    : Buffer.from(json, 'utf8').toString('base64');
  return 'PKB3-' + b64.replace(/=+$/, '');
}
function importTeam(code){
  try{
    const b64 = String(code).trim().replace(/^PKB\d-/, '');
    const json = (typeof atob !== 'undefined')
      ? decodeURIComponent(escape(atob(b64)))
      : Buffer.from(b64, 'base64').toString('utf8');
    const p = JSON.parse(json);
    if(!p || !Array.isArray(p.t)) return null;
    const team = p.t.map(r => {
      if(!SPECIES[r[0]]) return null;
      const u = makeUnit(r[0], r[4] | 0);
      u.hp  = Math.max(1, r[1] | 0);
      u.atk = Math.max(0, r[2] | 0);
      u.spd = Math.max(1, r[3] | 0);
      if(Number.isInteger(r[5]) && r[5] >= 0 && r[5] < TUNING.maxTeam) u.pos = r[5];   // where they stood (v34)
      return u;
    }).filter(Boolean).slice(0, TUNING.maxTeam);
    return team.length ? { name: p.n || 'Trainer', team } : null;
  }catch(e){ return null; }
}

/* ===================================================================
   GAME STATE
   =================================================================== */
/* 2.0.0 — run modifiers, chosen at New Run (the daily challenge draws one):
     mono:     'Fire' …  the Daycare only sells that type
     nopc:     true      no PC at all — just the six you carry
     rich:     true      double income, opponents ×TUNING.mods.richFoes
     onelife:  true      one life
   G.daily is the date ('2026-09-27') when this is a daily-challenge run. */
const MOD_INFO = {
  mono:    { name: t => `Mono-${t}`, text: t => `The Daycare only sells ${t} pokémon. Opponents are tuned so every type is about as hard.` },
  nopc:    { name: () => 'No PC', text: () => 'No PC box: just the six you carry, no bench.' },
  rich:    { name: () => 'Rich & Ruthless', text: () => `Double income, but every opponent is ${Math.round((TUNING.mods.richFoes - 1) * 100)}% stronger.` },
  secrets: { name: () => 'Secret Gauntlet', text: () => 'Red and Professor Oak both wait after the Champion, back to back, one try each. Needs Gen 1 and Gen 2, and costs a Red ticket and an Oak ticket. Beat both for the Gauntlet Badge.' },
  onelife: { name: () => 'One Life', text: () => 'One life. Lose any battle — trainer, gym leader or Elite Four, no free rematches — and the run is over.' },
};
/** 4.0.0: a run that isn't plain Gen 1 is labelled by its gens ("Gen 2", "Gen 1+2") and keeps its own records, like a rule. */
const genLabel = G => { const g = cleanGens(G && G.gens); return g.join() === '1' ? '' : 'Gen ' + g.join('+'); };
const genText = G => { const g = cleanGens(G && G.gens);
  return g.length > 1 ? `Leaders, Elite Four and pokémon from ${g.map(n => GENS[n].region).join(' and ')}, drawn and shuffled. Each boss is scaled to the slot they land in.`
    : `${GENS[g[0]].region} leaders, Elite Four and pokémon.`; };
const modList = G => { const m = (G && G.mods) || {}; return [...(genLabel(G) ? ['gens'] : []), ...Object.keys(MOD_INFO).filter(k => m[k])]; };
const modName = (G, k) => k === 'gens' ? genLabel(G) : MOD_INFO[k].name(G.mods[k]);
const modText = (G, k) => k === 'gens' ? genText(G) : MOD_INFO[k].text(G.mods[k]);
const modsLabel = G => modList(G).map(k => modName(G, k)).join(' · ');
function cleanMods(m){
  const out = {};
  if(m && m.mono && MONO_TYPES.includes(m.mono)) out.mono = m.mono;
  for(const k of ['nopc', 'rich', 'onelife', 'secrets']) if(m && m[k]) out[k] = true;
  return out;
}
/** The daily challenge: one seed and one modifier per calendar day, the same for everyone. */
function dailySeed(date){ let h = 2166136261; for(const c of 'pkb-daily-' + date){ h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return (h % 999999937) + 1; }
/** 4.1.0: which generations the daily plays: Gen 1 half the time, Gen 1+2 three days in ten, Gen 2 the rest. */
function dailyGens(date){
  const x = makeRng((dailySeed(date) ^ 0x2545f491) >>> 0)();
  return x < 0.5 ? [1] : x < 0.8 ? [1, 2] : [2];
}
function dailyMods(date){
  const r = makeRng(dailySeed(date) ^ 0x9e3779b9), x = r();
  if(x < 0.35) return {};
  if(x < 0.55){ const t = monoTypesFor(dailyGens(date)); return { mono: t[Math.floor(r() * t.length)] }; }
  if(x < 0.70) return { nopc: true };
  if(x < 0.85) return { rich: true };
  return { onelife: true };
}

/* ===================================================================
   4.1.0 — RUN FOCUS and the EVOLUTION POOL (runs that play more than one gen)
   A mixed run sells nearly twice the roster, so copies merge far less often.
   Each such run draws, from its seed alone:
     · three FOCUS lines — the Daycare shows them more often, so there is always
       something to build around (one Gen 1, one Gen 2, one from either), and
     · an EVOLUTION POOL — only some of the cross-gen evolutions (Onix → Steelix,
       Golbat → Crobat…) are open that run; the Mart stocks stones for those.
   Single-gen runs and Gen 2-only runs are untouched: nothing here applies.
   =================================================================== */
const CROSS_EVOS = ['poliwhirl', 'onix', 'scyther', 'gloom', 'chansey', 'eevee', 'golbat', 'seadra', 'porygon', 'slowpoke'];   // species that carry an `evo2`
const EVO_POOL_SIZE = 4;
const FOCUS_COUNT = 3;
const FOCUS_CHANCE = 0.09;       // share of Daycare slots that show a focus line
const FOCUS_MAX_TIER = 3;
const isMixed = gens => cleanGens(gens).length > 1;
function runDraw(seed, salt){ return makeRng(mix32(((seed || 1) ^ 0x51ed270b) >>> 0, salt)); }
function drawEvoPool(seed, gens){
  if(!isMixed(gens)) return null;
  const r = runDraw(seed, 4101), a = CROSS_EVOS.slice();
  for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, EVO_POOL_SIZE).sort((x, y) => CROSS_EVOS.indexOf(x) - CROSS_EVOS.indexOf(y));
}
/** 4.1.0: is Red on Mt. Silver this run? Seeded, so a daily is the same for everyone. Gen 2 runs only. */
function drawRed(seed, gens){ return drawSecret(seed, gens) === 'red'; }
/** Which secret boss waits after the Champion this run: 'red' (Gen 2 only), 'oak' (Gen 1 only),
    a seeded one of the two when both gens are on, or null. */
function drawSecret(seed, gens){
  gens = gens || [1];
  const r = makeRng(mix32((seed || 1) ^ 0x5ed0b11, 4242));
  if(!(r() < TUNING.red.chance)) return null;
  const has1 = gens.includes(1), has2 = gens.includes(2);
  return has1 && has2 ? (r() < 0.5 ? 'red' : 'oak') : has2 ? 'red' : 'oak';
}
/** The secret boss of this run (old saves stored `true`, which was always Red). */
function secretOf(G){ if(G && G.secrets) return SECRETS[G.secrets[G.secIdx || 0]]; const f = G && G.redFlag; return !f ? null : (typeof f === 'string' && SECRETS[f]) || RED; }
function drawFocus(seed, gens){
  gens = cleanGens(gens);
  if(!isMixed(gens)) return null;
  const r = runDraw(seed, 4102);
  const lines = buyableFor(gens).filter(k => SPECIES[k].tier <= FOCUS_MAX_TIER);
  const pick = (list, taken) => { const f = list.filter(k => !taken.includes(k)); return f.length ? f[Math.floor(r() * f.length)] : null; };
  const out = [];
  const one = pick(lines.filter(k => genOf(k) === 1), out); if(one) out.push(one);
  const two = pick(lines.filter(k => genOf(k) === 2), out); if(two) out.push(two);
  while(out.length < FOCUS_COUNT){ const x = pick(lines, out); if(!x) break; out.push(x); }
  return out;
}

function newGame(seed, opts){
  const gens = setActiveGens(opts && opts.gens);   // 4.0.0: which gens this run plays
  const mods = cleanMods(opts && opts.mods);
  if(mods.secrets && !(gens.includes(1) && gens.includes(2))) delete mods.secrets;   // 4.4.0: both bosses need both gens
  seed = seed || Math.floor(Math.random() * 1e9);
  const evoPool = drawEvoPool(seed, gens);
  ACTIVE_POOL = evoPool;
  /* 4.3.0: a Secret Boss Ticket forces that boss to wait after the Champion (the boss must belong to a gen in the run) */
  const want = opts && opts.secret, ticket = want && SECRETS[want] && gens.includes(SECRETS[want].gen) ? want : null;
  return {
    seed,
    gens, bossPlan: drawBossPlan(seed, gens),
    evoPool, focus: drawFocus(seed, gens),   // 4.1.0
    redFlag: mods.secrets ? 'red' : ticket || drawSecret(seed, gens), ticketUsed: ticket, redOpen: false, redResult: null,
    ...(mods.secrets ? { secrets: ['red', 'oak'], secIdx: 0, secWon: [] } : {}),   // 4.4.0   // 4.1.0
    mods, daily: (opts && opts.daily) || null,
    turn: 1,
    credits: TUNING.creditsPerTurn,
    lives: mods.onelife ? 1 : TUNING.startingLives,
    stage: 0,               // index into runPlan() — the run's schedule
    badges: 0,
    attempt: 0,             // consecutive defeats at the current boss
    scouted: {},            // boss id -> the team you saw, revealed by losing
    blackout: 0,            // credits the last defeat cost, for the UI to say so
    streak: 0,              // >0 win streak, <0 loss streak
    lastResult: null,
    income: null,           // breakdown of this turn's pay, for the UI
    trainerExp: { hp:0, atk:0, spd:0 },   // TUNING.expModel === 'trainer'
    gauntlet: null,         // mid-Elite-Four: { hpFrac: { uid: 0..1 } }
    team: [],               // index 0 = front rank; fills the formation grid
    pc: [],                 // owned but not carried — spare copies live here
    daycare: [],            // { unit, bought }
    mart: [],               // { id, held, reserved, bought }
    bag: [],                // held items you own but nobody is carrying
    log: [],
    over: null,
    rolls: 0,
    shopRolls: 0,           // how far through the seed's shop sequence we are
    perks: {},              // badge rewards taken: { id: amount so far }
    rewardLog: [],          // [{ badge, id }] — which reward each badge bought
    pendingRewards: [],     // badges won whose reward hasn't been chosen yet
    freeRolls: 0,           // free rerolls left this turn (badge reward)
  };
}

function makeGameApi(G){
  return {
    log: txt => { G.log.push(txt); if(G.log.length > 60) G.log.shift(); },
    team: () => G.team,
    boost: (u, d) => {
      if(!u) return;
      if(d.atk) u.atk = Math.max(0, u.atk + d.atk);
      if(d.hp)  u.hp  = Math.max(1, u.hp  + d.hp);
      if(d.spd) u.spd = Math.max(1, u.spd + d.spd);
    },
    addExp: (u, n) => addExp(G, u, n),
    evolve: (u, stone) => evolveUnit(G, u, stone),
    teamExp: () => grantBattleExp(G, 'win'),
    shareExp: () => shareExp(G),
    addCredits: n => { G.credits += n; },
  };
}

/** Apply one level's worth of growth: evolve if the line evolves by level,
    otherwise take the larger flat bonus. */
function applyLevelUp(G, u){
  if(G) useGens(G);
  const sp = SPECIES[u.id];
  if(sp.legendary) return { evolved:false };
  const lv = pickLevelEvo(u, evoNext(u.id).filter(n => n.by === 'level'));   // 4.0.0: may be one of several (Tyrogue)
  if(lv){
    const next = SPECIES[lv.into];
    u.hp  += next.hp  - sp.hp;
    u.atk += next.atk - sp.atk;
    u.spd += next.spd - sp.spd;
    const was = u.nm;
    u.id = lv.into; u.nm = next.name;
    growUnit(u, TUNING.levelUpBonus);      // grows as what it has become
    if(G) makeGameApi(G).log(`What? ${was} is evolving… into ${next.name}!`);
    return { evolved:true, from:was, into:next.name };
  }
  growUnit(u, TUNING.levelUpBonusMax);
  return { evolved:false };
}

/** Grant exp; crossing a threshold levels up (and may evolve). */
function addExp(G, u, n){
  if(isLegend(u)) return { leveled:false, level:1, evolved:null };   // 2.1.0: legendaries never level
  const before = unitLevel(u);
  u.exp += n;
  const after = unitLevel(u);
  let evolved = null;
  for(let i = before; i < after; i++){
    const r = applyLevelUp(G, u);
    if(r.evolved) evolved = r;
  }
  if(after > before && G) makeGameApi(G).log(`${u.nm} reached level ${after}!`);
  return { leveled: after > before, level:after, evolved };
}

/** Evolution stone: evolve now, regardless of level. */
function evolveUnit(G, u, stone){
  if(G) useGens(G);   // 4.0.0
  const sp = SPECIES[u.id];
  const opts = evoNext(u.id);
  if(!opts.length) return false;
  // a branching line goes where the stone says; otherwise its one evolution
  const pick = (stone && opts.find(n => n.stone === stone)) || (opts.length === 1 ? opts[0] : null);
  if(!pick) return false;
  const next = SPECIES[pick.into];
  if(!next) return false;
  u.hp  += next.hp  - sp.hp;
  u.atk += next.atk - sp.atk;
  u.spd += next.spd - sp.spd;
  const was = u.nm;
  u.id = pick.into; u.nm = next.name;
  if(G) makeGameApi(G).log(`What? ${was} is evolving… into ${next.name}!`);
  return true;
}

function canUseItem(itemId, u){
  const def = ITEMS[itemId];
  if(!def || !u) return false;
  return def.eligible ? def.eligible(u) : true;
}

/* ===================================================================
   BADGE REWARDS
   Every badge offers three rewards and you keep one. They are the run's
   choices about SHAPE — room, money, rerolls, growth — rather than a flat stat
   bump, so two players with the same badges end up with different runs.
   `amount` and `max` live in TUNING.badgeRewards; the text reads them.
   =================================================================== */
const perk = (G, id) => (G && G.perks && G.perks[id]) || 0;
const carryCap = G => TUNING.maxCarryOver + perk(G, 'piggy');
const rewardCfg = id => TUNING.badgeRewards[id];
const timesTaken = (G, id) => Math.round(perk(G, id) / rewardCfg(id).amount);

const BADGE_REWARDS = [
  { id:'pcRow',     name:'Storage Box',  icon:'📦',
    text: () => `+${rewardCfg('pcRow').amount} PC slots.` ,
    now: G => `PC ${pcCap(G)} → ${pcCap(G) + rewardCfg('pcRow').amount}`,
    apply: G => {} },
  { id:'pocket',    name:'Bag Pocket',   icon:'🎒',
    text: () => `+${rewardCfg('pocket').amount} Bag slot for held items.`,
    now: G => `Bag ${bagCap(G)} → ${bagCap(G) + rewardCfg('pocket').amount}`,
    apply: G => {} },
  { id:'allowance', name:'Allowance',    icon:'💰',
    text: () => `+${rewardCfg('allowance').amount}₽ at the start of every turn.`,
    now: G => perk(G, 'allowance') ? `+${perk(G, 'allowance')}₽ → +${perk(G, 'allowance') + rewardCfg('allowance').amount}₽ a turn` : '',
    apply: G => {} },
  { id:'freeRoll',  name:'Lucky Ticket', icon:'🎟️',
    text: () => `${rewardCfg('freeRoll').amount} free reroll every turn, in either shop.`,
    apply: G => { G.freeRolls = (G.freeRolls || 0) + rewardCfg('freeRoll').amount; } },
  { id:'piggy',     name:'Piggy Bank',   icon:'🐷',
    text: () => `Carry over up to ${rewardCfg('piggy').amount}₽ more between turns.`,
    now: G => `carry-over ${carryCap(G)}₽ → ${carryCap(G) + rewardCfg('piggy').amount}₽`,
    apply: G => {} },
  { id:'training',  name:'Special Training', icon:'🏋️',
    text: () => `${rewardCfg('training').amount} rounds of battle EXP right now — your party, and everything you buy after.`,
    apply: G => { for(let n = 0; n < rewardCfg('training').amount; n++) grantBattleExp(G, 'win', true); } },
  { id:'gift',      name:'Gift Item',    icon:'🎁',
    text: () => 'A random held item from the current shop tier, straight into your Bag.',
    ok: G => bagRoom(G) > 0 && heldPool(G).length > 0,
    apply: (G, rnd) => { const pool = heldPool(G);
      const id = pickWeighted(pool, HELD_ITEMS, rnd ? rnd() : 0);
      G.bag.push(id); G.lastGift = id; } },
];
const rewardById = id => BADGE_REWARDS.find(r => r.id === id) || null;
const heldPool = G => Object.keys(HELD_ITEMS).filter(k =>
  HELD_ITEMS[k].tier <= Math.max(TUNING.heldFromTier, tierFor(G)));
const rewardAvailable = (G, r) => timesTaken(G, r.id) < rewardCfg(r.id).max && (!r.ok || r.ok(G));

/** The three rewards on offer for a badge. Drawn from the run's seed and the
    badge number, so the offer is fixed — reloading can't re-roll it. */
function rewardOffer(G, badge){
  const rnd = makeRng(mix32((G.seed || 1) ^ 0x5bd1e995, 1000 + badge));
  const pool = BADGE_REWARDS.filter(r => rewardAvailable(G, r));
  const out = [];
  while(out.length < TUNING.badgeRewards.offer && pool.length)
    out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0].id);
  return out;
}
/** What the player is being asked to choose right now, if anything. */
function pendingOffer(G){
  const q = G.pendingRewards || [];
  if(!q.length) return null;
  return { badge: q[0], options: rewardOffer(G, q[0]) };
}
/** Take reward `id` for the badge at the front of the queue. */
function chooseReward(G, id){
  const off = pendingOffer(G);
  if(!off) return { ok:false, why:'No badge reward waiting.' };
  if(!off.options.includes(id)) return { ok:false, why:'That reward is not on offer.' };
  const r = rewardById(id), cfg = rewardCfg(id);
  G.perks = G.perks || {};
  G.perks[id] = (G.perks[id] || 0) + cfg.amount;
  r.apply(G, makeRng(mix32((G.seed || 1) ^ 0x68e31da4, 2000 + off.badge)));
  G.pendingRewards.shift();
  (G.rewardLog = G.rewardLog || []).push({ badge: off.badge, id });
  makeGameApi(G).log(`${gymAt(G, off.badge).badge} Badge reward: ${r.name}.`);
  return { ok:true, id, gift: id === 'gift' ? G.lastGift : null };
}

/* ---------------- the two shops ---------------- */
/* Shop rolls come from the RUN'S OWN SEED, not Math.random(). Every roll takes
   the next number in a sequence the save remembers (`G.shopRolls`), so the same
   seed and the same choices always produce the same shelves. Two reasons:
   - balance sweeps compare like with like. Unseeded, the exact same measurement
     run five times cleared anywhere from 36% to 44% — wider than most of the
     changes it was being used to judge;
   - a run can be replayed, and friends can play the same run.
   Reloading doesn't re-roll anything: the counter is saved after every action,
   so the next roll after a reload is the one you would have had anyway. */
function mix32(a, b){
  let h = (Math.imul((a >>> 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b >>> 0) + 0x632be5ab, 0xc2b2ae35)) >>> 0;
  h ^= h >>> 16; h = Math.imul(h, 0x7feb352d) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 0x846ca68b) >>> 0;
  h ^= h >>> 16;
  return h >>> 0 || 1;
}
function shopRng(G){
  G.shopRolls = (G.shopRolls || 0) + 1;
  return makeRng(mix32(G.seed || 1, G.shopRolls));
}

/** Pay for a reroll: a free one from the badge reward first, then credits. */
function payReroll(G){
  if((G.freeRolls || 0) > 0){ G.freeRolls--; G.rolls++; return true; }
  if(G.credits < TUNING.costRoll) return false;
  G.credits -= TUNING.costRoll; G.rolls++;
  return true;
}
const rerollCost = G => (G.freeRolls || 0) > 0 ? 0 : TUNING.costRoll;

function rollDaycare(G, payCost){
  useGens(G);   // 4.0.0
  if(payCost && inGauntlet(G)) return false;
  if(payCost && !payReroll(G)) return false;
  const rnd = shopRng(G);
  /* The roster follows the BADGE clock (with its slow turn floor), as the
     TUNING comment always said it did. Until v25 this read tierForTurn, which
     opened the whole roster — Mewtwo included — by turn 11 whatever your badges. */
  const maxTier = tierFor(G);
  // 2.0.0: legendaries only come as encounters; Mono-type sells one type
  const mono = G.mods && G.mods.mono;
  // (one tier ahead for Mono-type, or tier 1 would offer a single line)
  let pool = BUYABLE.filter(k => SPECIES[k].tier <= maxTier + (mono ? 1 : 0) && !SPECIES[k].legendary && (!mono || inTypePool(k, mono)));
  if(!pool.length) pool = BUYABLE.filter(k => !SPECIES[k].legendary && (!mono || inTypePool(k, mono)));
  const n = daycareSlotsFor(tierFor(G));
  // Nothing is held here — if you want to keep a pokémon, buy it and park it
  // in the PC. That is what the PC is for.
  const next = [];
  for(let i = 0; i < n; i++){
    const weighted = pool.filter(k => SPECIES[k].tier >= Math.max(1, maxTier - 1));
    const src = (rnd() < 0.55 && weighted.length) ? weighted : pool;
    let id = src[Math.floor(rnd() * src.length)];
    // 4.1.0: a mixed run's focus lines show up more often
    const foc = (G.focus || []).filter(k => pool.includes(k));
    if(foc.length && rnd() < FOCUS_CHANCE) id = foc[Math.floor(rnd() * foc.length)];
    next.push({ unit: trainerCatchUp(G, makeUnit(id, 0)),
                bought:false });
  }
  G.daycare = next;
  return true;
}

/** Pick from a list of item ids, a rare one at TUNING.rareWeight the odds. */
const rarityOf = def => (def && (def.rarity || (def.rare ? 'rare' : 'common'))) || 'common';
const itemWeight = def => { const r = TUNING.rarity[rarityOf(def)]; return r ? r.weight : 1; };
function pickWeighted(ids, defs, r){
  const total = ids.reduce((n, k) => n + itemWeight(defs[k]), 0);
  let x = r * total;
  for(const k of ids){ x -= itemWeight(defs[k]); if(x < 0) return k; }
  return ids[ids.length - 1];
}
function rollMart(G, payCost){
  if(payCost && inGauntlet(G)) return false;
  if(payCost && !payReroll(G)) return false;
  const rnd = shopRng(G);
  const maxTier = tierFor(G);
  // never stock a stone nobody you own can use
  const owned = ownedUnits(G);
  const pool = Object.keys(ITEMS).filter(k =>
    ITEMS[k].tier <= maxTier && (!ITEMS[k].eligible || owned.some(u => canUseItem(k, u))
      // vitamins are for anyone until someone owns a pokémon that has maxed them
      || (ITEMS[k].vitamin && !owned.length)));
  const heldPool = Object.keys(HELD_ITEMS).filter(k => HELD_ITEMS[k].tier <= maxTier);
  /* The shelf is [consumables…, held…]. Consumables keep the indices they have
     always had, and held slots are appended, so a reserved item stays put. */
  const plan = [];
  for(let i = 0; i < martSlotsFor(tierFor(G)); i++) plan.push(false);
  for(let i = 0; i < heldSlotsFor(tierFor(G)); i++) plan.push(true);
  const next = [];
  plan.forEach((wantHeld, i) => {
    const prev = G.mart[i];
    if(prev && prev.reserved && !prev.bought && !!prev.held === wantHeld){ next.push(prev); return; }
    const src = wantHeld ? heldPool : pool;
    if(!src.length) return;
    next.push({ id: pickWeighted(src, wantHeld ? HELD_ITEMS : ITEMS, rnd()),
                held: wantHeld, reserved:false, bought:false });
  });
  G.mart = next;
  return true;
}

/* ---------------- the Bag ---------------- */
const bagCap   = G => TUNING.bagSlots + perk(G, 'pocket');
const bagRoom  = G => Math.max(0, bagCap(G) - (G.bag || []).length);
const defOfSlot = s => s && (s.held ? HELD_ITEMS[s.id] : ITEMS[s.id]);

/** Buy a held item off the Mart shelf. It goes into the Bag, not onto a
    pokémon — giving it out is a separate, free, reversible move. */
function buyHeld(G, idx){
  if(inGauntlet(G)) return shopClosed();
  const s = G.mart[idx];
  if(!s || s.bought || !s.held) return { ok:false, why:'Nothing to buy there.' };
  const def = HELD_ITEMS[s.id];
  if(!def) return { ok:false, why:'Nothing to buy there.' };
  if(G.credits < def.cost) return { ok:false, why:'Not enough pokecredits.' };
  if(bagRoom(G) <= 0) return { ok:false, why:'Your Bag is full.' };
  G.credits -= def.cost; s.bought = true;
  G.bag.push(s.id);
  makeGameApi(G).log(`Bought ${def.name}.`);
  return { ok:true, id:s.id };
}

/** Buy a held item straight onto a pokémon, skipping the Bag. Whatever it was
    holding goes back to the Bag, so that needs room; a pokémon holding nothing
    needs no Bag space at all. */
function buyHeldOnto(G, idx, u){
  if(inGauntlet(G)) return shopClosed();
  const s = G.mart[idx];
  if(!s || s.bought || !s.held) return { ok:false, why:'Nothing to buy there.' };
  const def = HELD_ITEMS[s.id];
  if(!def) return { ok:false, why:'Nothing to buy there.' };
  if(!u) return { ok:false, why:'Pick a pokémon first.' };
  if(G.credits < def.cost) return { ok:false, why:'Not enough pokecredits.' };
  if(u.held && bagRoom(G) <= 0)
    return { ok:false, why:`Your Bag is full — ${u.nm}'s ${HELD_ITEMS[u.held].name} would have nowhere to go.` };
  G.credits -= def.cost; s.bought = true;
  const was = u.held || null;
  u.held = s.id;
  if(was) G.bag.push(was);
  makeGameApi(G).log(`Bought ${def.name} for ${u.nm}.`);
  return { ok:true, id:s.id, given:s.id, taken:was, unit:u };
}

/** Give a Bag item to a pokémon. Whatever it was holding goes back to the Bag,
    so a swap never needs a free slot and never loses an item. */
function equipHeld(G, bagIdx, u){
  const id = (G.bag || [])[bagIdx];
  if(!id || !HELD_ITEMS[id]) return { ok:false, why:'No such item.' };
  if(!u) return { ok:false, why:'Pick a pokémon first.' };
  if(u.held === id) return { ok:false, why:`${u.nm} is already holding that.` };
  const was = u.held || null;
  G.bag.splice(bagIdx, 1);
  u.held = id;
  if(was) G.bag.splice(bagIdx, 0, was);        // the swap lands in the same slot
  return { ok:true, given:id, taken:was };
}

/** Take an item off a pokémon. Needs a free Bag slot. */
function unequipHeld(G, u){
  if(!u || !u.held) return { ok:false, why:'Nothing to take.' };
  if(bagRoom(G) <= 0) return { ok:false, why:'Your Bag is full.' };
  const id = u.held;
  u.held = null;
  G.bag.push(id);
  return { ok:true, id };
}

/** What the Mart pays for a held item you no longer want. */
const heldResale = id => {
  const d = HELD_ITEMS[id];
  return d ? Math.max(1, Math.round(d.cost * TUNING.itemResale)) : 0;
};

/* Sell a held item back. Straight from the Bag, or straight off a pokémon —
   the second matters, because with a full Bag you could not take an item off
   to sell it, and the thing you want to sell is often the one in the way. */
function sellHeld(G, where, i){
  let id = null;
  if(where === 'bag'){
    id = (G.bag || [])[i];
    if(!id || !HELD_ITEMS[id]) return { ok:false, why:'Nothing to sell.' };
    G.bag.splice(i, 1);
  } else {
    const u = where === 'pc' ? (G.pc || [])[i] : (G.team || [])[i];
    if(!u || !u.held || !HELD_ITEMS[u.held]) return { ok:false, why:'Nothing to sell.' };
    id = u.held; u.held = null;
  }
  const paid = heldResale(id);
  G.credits += paid;
  makeGameApi(G).log(`Sold ${HELD_ITEMS[id].name} for ${paid}₽.`);
  return { ok:true, id, paid };
}

/** Selling or releasing a pokémon must not silently bin its item. */
function reclaimHeld(G, u){
  if(!u || !u.held) return { ok:true };
  if(bagRoom(G) <= 0) return { ok:false, why:`Your Bag is full — take ${u.nm}'s ${HELD_ITEMS[u.held].name} off first.` };
  G.bag.push(u.held); u.held = null;
  return { ok:true, reclaimed:true };
}

function rollShop(G, payCost){ // both shelves, used at the start of a turn
  useGens(G);   // 4.0.0
  const a = rollDaycare(G, payCost);
  const b = rollMart(G, false);
  return a && b;
}

/* Bring a pokémon up to the trainer's level.
   Applied when the Daycare is ROLLED, not when a pokémon is bought. Two reasons.
   It is not done inside effHp/effAtk/effSpd because those are called for enemy
   units too and have no idea whose pokémon they are holding. And it is not done
   at purchase because the Daycare row shows a pokémon's own stats — topping it
   up on the way out of the shop would mean the shelf advertised one number and
   sold you another. Rolling happens after the bank has been paid, so the stats
   on the shelf are exactly what arrives. */
function trainerCatchUp(G, u){
  if(TUNING.expModel !== 'trainer' || !u) return u;
  const t = G.trainerExp;
  if(!t) return u;
  growUnit(u, t);          // the bank, split by this pokémon's role
  return u;
}

function buyPokemon(G, idx, slot, pos){
  if(inGauntlet(G)) return shopClosed();
  fixSlots(G);
  const s = G.daycare[idx];
  if(!s || s.bought) return { ok:false, why:'That slot is empty.' };
  if(G.credits < TUNING.costBuy) return { ok:false, why:'Not enough pokecredits.' };
  const target = G.team[slot];
  if(target){
    if(target.id !== s.unit.id) return { ok:false, why:'That slot is taken.' };
    if(unitLevel(target) >= 3)  return { ok:false, why:`${target.nm} is already level 3.` };
    G.credits -= TUNING.costBuy; s.bought = true;
    const r = mergeInto(G, target, s.unit);
    return { ok:true, merged:true, unit:target, evolved:r.evolved };
  }
  if(G.team.length >= TUNING.maxTeam) return { ok:false, why:'Your party is full.' };
  G.credits -= TUNING.costBuy; s.bought = true;
  const u = s.unit;
  // an empty cell the player picked, or else the first free one (front first)
  u.pos = Number.isInteger(pos) && !teamAt(G, pos) && pos < TUNING.maxTeam ? pos : freePos(G);
  G.team.push(u); fixSlots(G);
  makeGameApi(G).log(`Bought ${u.nm} for ${TUNING.costBuy}₽.`);
  return { ok:true, unit:u };
}

/** Combine two copies: better of each stat, plus the merge bonus, plus exp. */
function mergeInto(G, dst, src){
  // stats combine as the better of the two, so the vitamins they carry do too
  for(const k of ['protein','hpup','carbos']){
    const n = Math.max(vitaminsTaken(dst, k), vitaminsTaken(src, k));
    if(n){ dst.vit = dst.vit || {}; dst.vit[k] = n; }
  }
  // …and so do the Lucky Egg rounds it has already had
  if(src.eggTicks || dst.eggTicks) dst.eggTicks = Math.max(dst.eggTicks || 0, src.eggTicks || 0);
  dst.hp  = Math.max(dst.hp,  src.hp);
  dst.atk = Math.max(dst.atk, src.atk);
  dst.spd = Math.max(dst.spd, src.spd);
  growUnit(dst, TUNING.mergeBonus);
  return addExp(G, dst, (src.exp || 0) + 1);
}

/** A copy about to be absorbed hands its held item back first — a merge must
    never quietly bin one. Refuses if the Bag has no room, like selling does. */
function consumeCopy(G, src){
  return reclaimHeld(G, src);
}

/* ===================================================================
   SLOTS (v34)
   Where a pokémon STANDS is its own fact, not its place in the list. Party
   members carry `pos` (0-5: rank = pos / rankWidth, so 0-1 front, 2-3 middle,
   4-5 back) and PC pokémon carry `box` (0 … pcCap-1), so a player can leave
   gaps and arrange things their own way. G.team and G.pc stay plain lists,
   kept sorted by slot — every function that takes an INDEX still works, and a
   party with no gaps has index === pos, exactly as before.
   =================================================================== */
const teamAt  = (G, pos) => (G.team || []).find(u => u.pos === pos) || null;
const pcAt    = (G, box) => (G.pc || []).find(u => u.box === box) || null;
const teamIdx = (G, pos) => (G.team || []).findIndex(u => u.pos === pos);
const pcIdx   = (G, box) => (G.pc || []).findIndex(u => u.box === box);
const firstFree = (used, max) => { for(let i = 0; i < max; i++) if(!used.has(i)) return i; return -1; };
/** Give every pokémon a slot (old saves, bots and tests add them bare), fix any
    clash, and keep both lists sorted by slot. Idempotent; call after changes. */
function fixSlots(G){
  const place = (arr, key, max) => {
    const used = new Set();
    for(const u of arr){                       // keep good slots, first come first served
      if(Number.isInteger(u[key]) && u[key] >= 0 && u[key] < max && !used.has(u[key])) used.add(u[key]);
      else u[key] = null;
    }
    for(const u of arr) if(u[key] == null){ u[key] = firstFree(used, Math.max(max, arr.length)); used.add(u[key]); }
    arr.sort((a, b) => a[key] - b[key]);
  };
  place(G.team || (G.team = []), 'pos', TUNING.maxTeam);
  place(G.pc || (G.pc = []), 'box', Math.max(pcCap(G), (G.pc || []).length));
  for(const u of G.team) delete u.box;
  for(const u of G.pc) delete u.pos;
  return G;
}
const freePos = G => firstFree(new Set(G.team.map(u => u.pos)), TUNING.maxTeam);
const freeBox = G => firstFree(new Set(G.pc.map(u => u.box)), pcCap(G));

/* ===================================================================
   THE PC
   Owned pokémon that aren't in the party. Spare copies wait here until you
   cash them in for a level up, so keeping one no longer means freezing a
   Daycare slot. Benched pokémon train at TUNING.pcExpFraction.
   =================================================================== */
const pcCap  = G => (G.mods && G.mods.nopc) ? 0 : TUNING.pcSlots + perk(G, 'pcRow');   // 2.0.0: No PC
const pcRoom = G => pcCap(G) - (G.pc ? G.pc.length : 0);

/** Buy straight from the Daycare into storage. */
function buyToPc(G, idx, box){
  if(inGauntlet(G)) return shopClosed();
  const s = G.daycare[idx];
  if(!s || s.bought) return { ok:false, why:'That slot is empty.' };
  if(G.credits < TUNING.costBuy) return { ok:false, why:'Not enough pokecredits.' };
  fixSlots(G);
  /* v35: dropped onto a stored copy of the same pokémon, it combines with it
     right there, like it would in the party. Levels don't have to match — the
     only thing that stops it is the stored one already being level 3. */
  const there = Number.isInteger(box) ? pcAt(G, box) : null;
  if(there){
    if(there.id !== s.unit.id) return { ok:false, why:'That box is taken.' };
    if(unitLevel(there) >= 3) return { ok:false, why:`${there.nm} is already level 3.` };
    G.credits -= TUNING.costBuy; s.bought = true;
    const r = mergeInto(G, there, s.unit);
    makeGameApi(G).log(`${s.unit.nm} joined the ${there.nm} in the PC.`);
    return { ok:true, merged:true, unit:there, evolved:r.evolved };
  }
  if(pcRoom(G) <= 0) return { ok:false, why:'The PC is full.' };
  G.credits -= TUNING.costBuy; s.bought = true;
  fixSlots(G);
  s.unit.box = Number.isInteger(box) && !pcAt(G, box) && box < pcCap(G) ? box : freeBox(G);
  G.pc.push(s.unit); fixSlots(G);
  makeGameApi(G).log(`${s.unit.nm} was sent to the PC.`);
  return { ok:true, unit:s.unit };
}

/** Withdraw: merge onto a matching party member, fill an empty slot, or swap. */
function pcToParty(G, pcIdx, slot, pos){
  fixSlots(G);
  const u = G.pc[pcIdx];
  if(!u) return { ok:false };
  const t = G.team[slot];
  if(t){
    if(t.id === u.id && unitLevel(t) < 3){
      const keep = consumeCopy(G, u);
      if(!keep.ok) return keep;
      G.pc.splice(pcIdx, 1); fixSlots(G);
      const r = mergeInto(G, t, u);
      return { ok:true, merged:true, unit:t, evolved:r.evolved };
    }
    if(t.id === u.id) return { ok:false, why:`${t.nm} is already level 3.` };
    // straight swap: each takes the other's spot
    const p = t.pos, b = u.box;
    G.pc[pcIdx] = t; G.team[slot] = u; u.pos = p; t.box = b; fixSlots(G);
    makeGameApi(G).log(`Swapped ${u.nm} in for ${t.nm}.`);
    return { ok:true, swapped:true, unit:u };
  }
  if(G.team.length >= TUNING.maxTeam) return { ok:false, why:'Your party is full.' };
  G.pc.splice(pcIdx, 1);
  u.pos = Number.isInteger(pos) && !teamAt(G, pos) && pos < TUNING.maxTeam ? pos : freePos(G);
  G.team.push(u); fixSlots(G);
  makeGameApi(G).log(`Withdrew ${u.nm} from the PC.`);
  return { ok:true, unit:u };
}

/** Deposit a party member into storage. */
function partyToPc(G, slot, box){
  fixSlots(G);
  const u = G.team[slot];
  if(!u) return { ok:false };
  if(pcRoom(G) <= 0) return { ok:false, why:'The PC is full.' };
  G.team.splice(slot, 1);
  u.box = Number.isInteger(box) && !pcAt(G, box) && box < pcCap(G) ? box : freeBox(G);
  G.pc.push(u); fixSlots(G);
  makeGameApi(G).log(`${u.nm} was deposited in the PC.`);
  return { ok:true, unit:u };
}

function releaseFromPc(G, pcIdx){
  const u = G.pc[pcIdx];
  if(!u) return { ok:false };
  const keep = reclaimHeld(G, u);
  if(!keep.ok) return keep;
  const refund = unitLevel(u) * TUNING.sellRefundPerLevel;
  G.pc.splice(pcIdx, 1); fixSlots(G);
  G.credits += refund;
  makeGameApi(G).log(`Released ${u.nm} for ${refund}₽.`);
  return { ok:true, refund };
}

/** Is there a party member this stored copy could be merged into? */
function pcMergeTarget(G, pcIdx){
  const u = G.pc[pcIdx];
  if(!u) return -1;
  return G.team.findIndex(t => t.id === u.id && unitLevel(t) < 3);
}

/** …and is there another copy in the box itself? */
function pcTwinInBox(G, pcIdx){
  const u = G.pc[pcIdx];
  if(!u) return -1;
  return (G.pc || []).findIndex((t, i) =>
    i !== pcIdx && t && t.id === u.id && unitLevel(t) < 3);
}

/** Anywhere at all — what the ＋ badge on a box sprite means. */
const pcCanMerge = (G, i) => pcMergeTarget(G, i) >= 0 || pcTwinInBox(G, i) >= 0;

/** Combine two stored copies without going through the party. Levelling up
    in the box is the whole point of keeping spares there. */
function pcMerge(G, fromIdx, toIdx){
  if(fromIdx === toIdx) return { ok:false };
  const src = G.pc[fromIdx], dst = G.pc[toIdx];
  if(!src || !dst) return { ok:false };
  if(src.id !== dst.id) return { ok:false, why:`${src.nm} and ${dst.nm} are different pokémon.` };
  if(unitLevel(dst) >= 3) return { ok:false, why:`${dst.nm} is already level 3.` };
  const keep = consumeCopy(G, src);
  if(!keep.ok) return keep;
  G.pc.splice(fromIdx, 1);
  const r = mergeInto(G, dst, src); fixSlots(G);
  makeGameApi(G).log(`Combined two ${dst.nm} in the PC.`);
  return { ok:true, merged:true, unit:dst, evolved:r.evolved,
           // the box closes up when a slot empties, so the target may have moved
           at: G.pc.indexOf(dst) };
}

function sellUnit(G, slot){
  const u = G.team[slot];
  if(!u) return { ok:false };
  const keep = reclaimHeld(G, u);
  if(!keep.ok) return keep;
  const refund = unitLevel(u) * TUNING.sellRefundPerLevel;
  G.team.splice(slot, 1); fixSlots(G);
  G.credits += refund;
  makeGameApi(G).log(`Released ${u.nm} for ${refund}₽.`);
  return { ok:true, refund };
}

/** Old index-based rearrange, kept for the bots and tests: from and to are
    list indexes, and the two pokémon trade places (or merge, if twins). */
function moveUnit(G, from, to){
  fixSlots(G);
  if(from === to) return { ok:false };
  const u = G.team[from];
  if(!u) return { ok:false };
  const dst = G.team[to];
  return placeUnit(G, from, dst ? dst.pos : Math.min(to, TUNING.maxTeam - 1));
}
/** Put party member `idx` on formation cell `pos`: an empty cell just moves it;
    a twin that can still level merges; anyone else trades places with it. */
function placeUnit(G, idx, pos){
  fixSlots(G);
  const u = G.team[idx];
  if(!u || !Number.isInteger(pos) || pos < 0 || pos >= TUNING.maxTeam || u.pos === pos) return { ok:false };
  const dst = teamAt(G, pos);
  if(dst && dst.id === u.id && unitLevel(dst) < 3){
    const keep = consumeCopy(G, u); if(!keep.ok) return keep;
    G.team.splice(idx, 1);
    const r = mergeInto(G, dst, u); fixSlots(G);
    return { ok:true, merged:true, unit:dst, evolved:r.evolved };
  }
  if(dst) dst.pos = u.pos;
  u.pos = pos; fixSlots(G);
  return { ok:true, swapped:!!dst };
}
/** The same for the PC: move stored pokémon `idx` to box `box`, swapping with
    whoever is there. (Twins merge through pcMerge, which the UI calls first.) */
function placeInBox(G, idx, box){
  fixSlots(G);
  const u = G.pc[idx];
  if(!u || !Number.isInteger(box) || box < 0 || box >= pcCap(G) || u.box === box) return { ok:false };
  const dst = pcAt(G, box);
  if(dst) dst.box = u.box;
  u.box = box; fixSlots(G);
  return { ok:true, swapped:!!dst };
}

/** Use a Mart item on a pokémon — in the party (`where` 'team', the default)
    or in the PC ('pc'). A held item given this way goes straight onto it. */
function buyItem(G, idx, slot, where){
  if(inGauntlet(G)) return shopClosed();
  const s = G.mart[idx];
  if(!s || s.bought) return { ok:false, why:'Already used.' };
  const u = where === 'pc' ? (G.pc || [])[slot] : G.team[slot];
  if(s.held) return u ? buyHeldOnto(G, idx, u) : buyHeld(G, idx);
  const def = ITEMS[s.id];
  if(G.credits < def.cost) return { ok:false, why:'Not enough pokecredits.' };
  if(!u) return { ok:false, why:'Pick a pokémon first.' };
  if(!canUseItem(s.id, u)) return { ok:false, why: def.vitamin
    ? `${u.nm} can't take any more ${def.name} (${TUNING.vitaminCap} is the most per pokémon).`
    : `${def.name} does nothing for ${u.nm}.` };
  G.credits -= def.cost; s.bought = true;
  const api = makeGameApi(G);
  def.apply(u, api);
  if(def.vitamin){ u.vit = u.vit || {}; u.vit[s.id] = vitaminsTaken(u, s.id) + 1; }
  api.log(`Used ${def.name} on ${u.nm}.`);
  return { ok:true };
}

/** The always-stocked shelf. Boosts the whole party; wears off after the
    battle; at most `xItems.perBattle` uses of each per battle. Any extra
    arguments (older callers passed a party slot) are ignored. */
function buyBattleItem(G, idx){
  if(inGauntlet(G)) return shopClosed();
  const def = BATTLE_ITEMS[idx];
  if(!def) return { ok:false, why:'No such item.' };
  if(!G.team.length) return { ok:false, why:'You need a party first.' };
  if(xUses(G, def) >= TUNING.xItems.perBattle)
    return { ok:false, why:`That's all ${TUNING.xItems.perBattle} ${def.name} for this battle.` };
  if(G.credits < def.cost) return { ok:false, why:'Not enough pokecredits.' };
  G.credits -= def.cost;
  def.apply(G);
  G.xUses = G.xUses || {};
  G.xUses[def.id] = xUses(G, def) + 1;
  makeGameApi(G).log(`Used ${def.name} (${xUses(G, def)}/${TUNING.xItems.perBattle}) — ${def.text()}`);
  return { ok:true, uses: xUses(G, def) };
}

/** Hook kept for the UI; nothing happens between rounds in this model. */
function endTurnEffects(G){ /* no shop-phase abilities */ }

/** Exp. Share: one round of battle EXP for the PARTY only. No trainer bank (so
    it doesn't compound into every future buy), no PC, no Lucky Egg bonus. */
function shareExp(G){
  for(const u of G.team) growUnit(u, TUNING.expGainWin);
  makeGameApi(G).log('Your party gained a round of EXP from the Exp. Share.');
}

/** After a battle every pokémon gains EXP — the player's stat curve. */
function grantBattleExp(G, result, quiet){
  const g = result === 'win' ? TUNING.expGainWin : TUNING.expGainLoss;
  // the trainer's own bank, always kept so the model can be switched
  G.trainerExp = G.trainerExp || { hp:0, atk:0, spd:0 };
  G.trainerExp.hp += g.hp; G.trainerExp.atk += g.atk; G.trainerExp.spd += g.spd;
  const tick = u => growUnit(u, g);
  // a Lucky Egg's bonus rounds count toward TUNING.eggCap, like vitamins
  const bonusTicks = u => { const h = heldOf(u); if(!h || !h.expTick) return 0;
    const n = Math.min(h.expTick, Math.max(0, TUNING.eggCap - (u.eggTicks || 0)));
    u.eggTicks = (u.eggTicks || 0) + n; return n; };
  for(const u of G.team){ tick(u); for(let n = bonusTicks(u); n > 0; n--) tick(u); }
  // Benched pokémon train at a fraction of the rate. The remainder is banked
  // on the unit rather than rounded away, so at 0.5 a stored pokémon gains a
  // full tick every second battle instead of nothing at all.
  let trained = 0;
  for(const u of (G.pc || [])){
    u.rest = (u.rest || 0) + TUNING.pcExpFraction;
    while(u.rest >= 1 - 1e-9){ u.rest -= 1; tick(u); trained++; }
    for(let n = bonusTicks(u); n > 0; n--){ tick(u); trained++; }
  }
  const api = makeGameApi(G);
  if(quiet) return;
  if(G.team.length) api.log(
    `Your party gained EXP — each pokémon grows along its role.`);
  if(trained) api.log(`${trained} pokémon in the PC trained too.`);
}

/* The run advances by clearing schedule entries.
   A trainer battle is pass-or-pay: win or lose, you move on, and a loss costs
   a life. A boss is a gate: you stay on it until you beat it, and losing
   blacks you out — you keep your team and your badges and lose your money.
   Two attempts are free; from the third, a defeat costs a life as well, so a
   wall you cannot climb still ends the run. */
function applyBattleResult(G, result, opp, sim){
  const st = stageOf(G);
  const meeting = rivalMeeting(G);
  const boss = st.boss || null;
  const gauntlet = isGauntletStage(st);
  /* Wounds are read BEFORE the battle EXP lands. They are stored as a share of
     max HP and EXP raises max HP, so reading afterwards would quietly round every
     survivor up toward full. A draw mid-gauntlet still costs you what it cost. */
  if(gauntlet && sim && (result === 'win' || (result === 'draw' && inGauntlet(G)))){
    G.gauntlet = G.gauntlet || { hpFrac: {} };
    recordWounds(G, sim);
  }
  grantBattleExp(G, result);
  G.lastResult = result;
  G.blackout = 0;

  if(st.kind === 'red'){
    /* 4.1.0: one chance. Win or lose (a draw is a loss — he simply walks away),
       the run ends as a clear; only the badge differs. */
    G.redResult = result === 'win' ? 'won' : 'lost';
    G.lastResult = result;
    G.stage = (G.stage || 0) + 1;
    if(result === 'win'){ G.secWon = [...(G.secWon || []), secretOf(G).id]; }
    G.gauntlet = null;
    /* 4.4.0: in the Secret Gauntlet a win sends you on to the next boss (healed, one turn in the shop) */
    if(result === 'win' && G.secrets && (G.secIdx || 0) < G.secrets.length - 1){ G.secIdx = (G.secIdx || 0) + 1; G.attempt = 0; G.redResult = null; return G.over; }
    G.over = 'won';
    return G.over;
  }
  if(result === 'draw'){
    // nobody advances and nobody pays; the streak is left alone
    return G.over;
  }
  if(meeting >= 0){
    const R = rivalCore(G);
    R.met = meeting + 1;
    G.lastRival = { meeting, result, credits:0, item:null, sold:0 };
    if(result === 'win'){
      R.beaten = (R.beaten || 0) + 1;
      const prize = rivalPrize(G, meeting);
      G.rivalPay = (G.rivalPay || 0) + prize.credits;       // lands with next turn's income
      G.lastRival.credits = prize.credits;
      if(prize.item && bagRoom(G) > 0){ G.bag.push(prize.item); G.lastRival.item = prize.item; }
      else if(prize.item){                                   // full Bag: he pays its worth instead
        const worth = heldResale(prize.item); G.rivalPay += worth; G.lastRival.sold = worth; G.lastRival.item = prize.item;
      }
      makeGameApi(G).log(`You beat your rival! +${prize.credits}₽ next turn${prize.item ? ` and a ${HELD_ITEMS[prize.item].name}` : ''}.`);
    }
  }
  if(result === 'win'){
    G.streak = G.streak > 0 ? G.streak + 1 : 1;
    if(st.kind === 'gym'){
      G.badges++; G.lastBadge = boss ? boss.badge : null;
      (G.pendingRewards = G.pendingRewards || []).push(G.badges - 1);   // pick one of three
      rollEncounter(G);                                                 // 2.0.0: maybe a legendary
    }
    /* Beating Lorelei is not a fresh start. The gauntlet as a whole is the
       attempt, or a player who can always beat the first member would never pay
       a life for falling at the fourth. */
    if(!gauntlet) G.attempt = 0;
    // you will face them again if you fall further in, so remember what they fielded
    if(gauntlet && boss && opp) scout(G, boss, opp);
    G.stage = (G.stage || 0) + 1;
    if(st.kind === 'champion'){
      G.gauntlet = null;
      if(G.redFlag && !G.redOpen){ G.redOpen = true; G.attempt = 0; }   // 4.1.0: he was waiting up on Mt. Silver
      else G.over = 'won';
    }
  } else {
    G.streak = G.streak < 0 ? G.streak - 1 : -1;
    if(isBoss(st)){
      G.attempt = (G.attempt || 0) + 1;
      const lost = Math.floor(G.credits * TUNING.blackoutPct);
      G.credits -= lost;
      G.blackout = lost;
      // you lose, but you learn: the rematch shows you exactly what they field
      if(boss && opp) scout(G, boss, opp);
      if(G.attempt > freeAttemptsFor(G)) G.lives--;
      // fall anywhere in the gauntlet and it starts again from Lorelei, healed
      if(gauntlet){ G.stage = gauntletStart(); G.gauntlet = null; }
      makeGameApi(G).log(`You blacked out! Lost ${lost}₽.`);
    } else {
      G.lives--;
      G.stage = (G.stage || 0) + 1;
    }
  }
  if(!G.over && G.lives <= 0) G.over = 'lost';
  return G.over;
}

/** Remember a boss's team. A rematch is rebuilt from this, so it is the truth. */
/** 2.2.1 (Sean): One Life means every lost battle takes the life — the free boss
    rematches don't apply, so a first defeat by a gym leader ends the run too. */
function freeAttemptsFor(G){ return G && G.mods && G.mods.onelife ? 0 : TUNING.freeAttempts; }
function scout(G, boss, opp){
  G.scouted = G.scouted || {};
  G.scouted[boss.id] = opp.team.map(u => ({
    id:u.id, nm:u.nm, hp:u.hp, atk:u.atk, spd:u.spd, exp:u.exp || 0, held:u.held || null }));
}

/** Everything the UI needs to describe what happens next, in one call. */
function nextUp(G){
  const st = stageOf(G);
  const plan = runPlan(G);
  const boss = st.boss || null;
  const untilGym = (() => {
    for(let i = G.stage || 0; i < plan.length; i++) if(plan[i].kind !== 'trainer') return i - (G.stage || 0);
    return 0;
  })();
  return {
    kind: st.kind, boss, badge: st.badge,
    stage: (G.stage || 0) + 1, total: plan.length, untilGym,
    attempt: G.attempt || 0,
    lifeAtRisk: isBoss(st) && (G.attempt || 0) >= freeAttemptsFor(G),
    scouted: boss ? (G.scouted || {})[boss.id] || null : null,
    gauntlet: isGauntletStage(st) ? {
      at: (G.stage || 0) - gauntletStart(),
      members: plan.slice(gauntletStart()).map(p => p.boss),
      running: inGauntlet(G),
    } : null,
    // the shop turn before Lorelei is the last one until the gauntlet is over
    lastShop: isGauntletStage(st) && !inGauntlet(G),
  };
}

/** What next turn's pay packet looks like. Shown in the UI, so it lives here. */
function incomeFor(G){
  const carry = Math.min(Math.max(0, G.credits), carryCap(G));
  const base = TUNING.creditsPerTurn;
  const result = G.lastResult === 'win' ? TUNING.winBonus
               : G.lastResult === 'lose' ? TUNING.lossBonus : 0;
  const tbl = G.streak > 0 ? TUNING.winStreakBonus : TUNING.lossStreakBonus;
  const streak = Math.abs(G.streak) >= 2
    ? tbl[Math.min(Math.abs(G.streak), tbl.length - 1)] : 0;
  // held items that pay — an Amulet Coin earns wherever the pokémon is kept
  const items = ownedUnits(G).reduce((n, u) => {
    const h = heldOf(u); return n + ((h && h.income) || 0); }, 0);
  const badges = perk(G, 'allowance');
  const rival = G.rivalPay || 0;                   // beating your rival pays next turn
  // 2.0.0: Rich & Ruthless doubles everything earned (not what you carried over)
  const rich = G.mods && G.mods.rich ? (TUNING.mods.richIncome - 1) * (base + result + streak + items + badges + rival) : 0;
  return { carry, base, result, streak, items, badges, rival, rich,
           total: carry + base + result + streak + items + badges + rival + rich };
}

function nextTurn(G){
  useGens(G);   // 4.0.0
  /* Between Elite Four fights: no pay, no restock, and the clock doesn't move
     (so the next member is priced against the same turn). But "next battle
     only" still means the next battle, or one X Attack before Lorelei would
     last all five fights. */
  if(inGauntlet(G)){
    for(const u of ownedUnits(G)){ u.tmpAtk = 0; u.tmpSpd = 0; }
    G.xUses = null;
    /* Resting on the bench. Anything that sat the last fight out in the PC
       recovers a share of its max HP. A FAINTED pokémon stays fainted — rest
       heals the hurt, it doesn't revive — or a full rotation would bring the
       whole team back and attrition would mean nothing. Applied here, straight
       after the fight, so it counts the fight a pokémon actually sat out. */
    for(const u of G.pc || []){
      const f = hpFracOf(G, u);
      if(f > 0 && f < 1) G.gauntlet.hpFrac[u.uid] = Math.min(1, f + TUNING.benchRest);
    }
    return;
  }
  G.turn++;
  const inc = incomeFor(G);
  G.income = inc;
  G.credits = inc.total;
  G.rivalPay = 0;
  for(const u of ownedUnits(G)){ u.tmpAtk = 0; u.tmpSpd = 0; }   // X items wear off
  G.xUses = null;
  G.mart.forEach(s => { if(s.bought) s.reserved = false; });
  G.freeRolls = perk(G, 'freeRoll');
  rollShop(G, false);
}

/* ---- export for node-based testing ---- */
if(typeof module !== 'undefined' && module.exports){
  module.exports = { M, teamAt, pcAt, teamIdx, pcIdx, fixSlots, freePos, freeBox, placeUnit, placeInBox, lineUpByRole, MOVE2, move2Of, on, TRIGGER_TEXT, TARGET_TEXT, STATUS_VERB, ROLES, ROLE_ORDER, roleOf, growUnit, formationSort, sf, TUNING, TYPES, TYPE_CHART, singleTypeOf, inTypePool, canStillEvolve, MONO_TYPES, tcgTypeFor, SPECIES, ITEMS, BATTLE_ITEMS, HELD_ITEMS,
    heldOf, heldActive, heldStats, effHp, effAtk, effSpd, ownedUnits,
    intervalFor, actionInterval, previewOrder, paceVs, paceRank,
    heldSlotsFor, bagRoom, defOfSlot, buyHeld, equipHeld, unequipHeld, reclaimHeld, sellHeld, heldResale, BUYABLE, M, typeMult,
    tierForTurn, tierFor, runPlan, RUN_LENGTH, stageOf, isBoss, nextUp, opponentFor,
    GYMS, ELITE_FOUR, CHAMPION, ALL_BOSSES, RIVAL, GYMS2, ELITE_FOUR2, CHAMPION2, RIVAL2, EVERY_BOSS, GEN_BOSSES, GENS, GENS_READY, gen2Linked, KANTO_ONLY, inBossPool, cleanGens, genOf, inGens, buyableFor, monoTypesFor, setActiveGens, useGens, drawBossPlan, drawEvoPool, drawFocus, drawRed, drawSecret, secretOf, RED, OAK, SECRETS, CROSS_EVOS, FOCUS_CHANCE, bossPlanOf, rivalOf, gymAt, homeOf, bossCalib, personOf, evoOpts, pickLevelEvo,  RIVAL_STARTERS, rivalStages, rivalMeeting, isRivalStage, partyType, rivalCore, rivalLineup, rivalPrize, rivalEevo, bossById, themePool, evoDepth, unitPower, teamPower, playerPowerAt,
    daycareSlotsFor, martSlotsFor, AI_DIFFICULTY, AI_PARTY_PACE, AI_NAMES, trainerName, makeUnit, unitLevel, isLegend, freeAttemptsFor, championLegend,
    expPipsToNext, levelFromExp, moveOf, MOD_INFO, monoFoesFor, modFoes, modList, modName, modText, genLabel, genText, modsLabel, cleanMods, dailySeed, dailyMods, dailyGens, LEGENDS, rollEncounter, encounterOpen, recruitLegend, opponentFor0, evoLine, evoNext, evoParent, evoFamily, stoneFor, stonesFor, syncUid, pw, pct, sc, simulateBattle,
    generateAiTeam, Net, exportTeam, importTeam, newGame, rollShop, rollDaycare, rollMart,
    buyPokemon, buyToPc, pcToParty, partyToPc, releaseFromPc, pcMergeTarget, pcTwinInBox, pcCanMerge, pcMerge, pcRoom,
    sellUnit, moveUnit, buyItem, buyBattleItem, canUseItem, endTurnEffects,
    applyBattleResult, grantBattleExp, incomeFor, nextTurn, mergeInto, addExp, applyLevelUp,
    trainerCatchUp, shareExp, pickWeighted, itemWeight, rarityOf, xUses, shopRng, mix32, vitaminsTaken, buyHeldOnto, BADGE_REWARDS, rewardById, rewardOffer, pendingOffer,
    chooseReward, perk, pcCap, bagCap, carryCap, rerollCost, timesTaken, rewardAvailable, gauntletStart, isGauntletStage, inGauntlet, hpFracOf, canFight,
    fightersOf, stageBattle, recordWounds, scout,
    evolveUnit, makeGameApi };
}
