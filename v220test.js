/* 2.2.0: 7th-gym legendary guarantee, the Champion's legendary, Zap Cannon, EXP pips on the summary. */
const E = require('./engine.js'); const T = E.TUNING, S = E.SPECIES;
let fails = 0; const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
// guarantee
let forced = 0, n = 0;
for(let s = 1; s <= 200; s++){ const G = E.newGame(s); G.team = [E.makeUnit('machop', 0)]; G.legendsMet = []; G.badges = T.legend.pityBadge; G.turn = 28;
  n++; if(E.rollEncounter(G)) forced++; }
check(forced === n, `a run that hasn't met a legendary always meets one at the ${T.legend.pityBadge}th gym (${forced}/${n})`);
let again = 0;
for(let s = 1; s <= 200; s++){ const G = E.newGame(s); G.legendsMet = ['zapdos']; G.badges = T.legend.pityBadge; if(E.rollEncounter(G)) again++; }
check(again > 0 && again < 100, `…but one that has met one only gets the normal chance (${again}/200)`);
// champion legendary
const G = E.newGame(42); G.team = [E.makeUnit('zapdos', 0)]; G.legendsCaught = ['mewtwo'];
const pick = E.championLegend(G);
check(!!pick && pick !== 'zapdos' && pick !== 'mewtwo' && S[pick].legendary, `the Champion's legendary is one you neither own nor recruited (${pick})`);
const H = E.newGame(43); H.legendsCaught = ['zapdos','mewtwo','articuno','moltres'];
check(E.championLegend(H) === null, 'if you recruited all four he brings none');
let champs = 0, withLeg = 0;
for(let s = 1; s <= 40; s++){ const K = E.newGame(s); K.team = [E.makeUnit('machop', 0), E.makeUnit('onix', 0)]; K.turn = 38; K.badges = 8;
  const plan = E.runPlan(K); const ci = plan.findIndex(p => p.kind === 'champion'); if(ci < 0) continue; K.stage = ci;
  const o = E.opponentFor(K); champs++; const legs = o.team.filter(u => S[u.id].legendary);
  if(legs.length === 1 && E.unitLevel(legs[0]) === 1) withLeg++; }
check(champs > 30 && withLeg === champs, `every Champion fields exactly one legendary, at level 1 (${withLeg}/${champs})`);
// Zap Cannon
const m2 = S.zapdos.move2;
check(!!m2 && m2.n === 4 && /Zap Cannon/.test(m2.name || m2.move && m2.move.name || JSON.stringify(Object.keys(m2))), 'Zapdos’s second move is Zap Cannon every 4th action');
const txt = (m2.text ? m2.text(1) : m2.move.text(1));
check(/200%/.test(txt) && /most HP/.test(txt) && /70%/.test(txt) && /paralyse/.test(txt), `Zap Cannon text: "${txt}"`);
// in battle: it hits the biggest foe, even in the back
let hitBig = 0, tries = 0, par = 0;
for(let s = 1; s <= 30; s++){ const z = E.makeUnit('zapdos', 0); z.spd = 300;
  const B = E.formationSort([E.makeUnit('onix', 0), E.makeUnit('pikachu', 0), E.makeUnit('abra', 0)]); B.forEach(u => { u.hp *= 20; });
  B.find(u => u.id === 'abra').hp *= 5;   // the back-row Abra has the most HP
  const r = E.simulateBattle([z], B, s);
  for(const st of r.steps){ const i = st.lines.findIndex(l => /Zapdos used Zap Cannon/.test(l));
    if(i >= 0){ tries++; if(/Abra/.test(st.lines[i + 1] || '')) hitBig++; if(st.lines.some(l => /Abra.*paraly/i.test(l))) par++; break; } } }
check(tries > 20 && hitBig === tries, `Zap Cannon aims at the enemy with the most HP, even in the back (${hitBig}/${tries})`);
check(par > tries * 0.4 && par < tries, `…and paralyses it about 70% of the time (${par}/${tries})`);
console.log(fails ? `${fails} FAILED` : 'v220 passed'); process.exit(fails ? 1 : 0);
