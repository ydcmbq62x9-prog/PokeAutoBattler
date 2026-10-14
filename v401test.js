/* 4.0.0 (gen2 branch): the Gen 2 pack — 68 pokémon, Steel and Dark, the Johto leaders, Silver. */
const E = require('./engine.js'); const S = E.SPECIES; let MAIN; try{ MAIN = require('../engine.js'); }catch(e){ console.log('skipped: needs the old Gen 1 build at ../engine.js (a historical comparison, not in this repo)'); process.exit(0); }
let fails = 0; const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
const G2 = Object.keys(S).filter(k => S[k].gen === 2);
check(G2.length === 82 && S.magmar && (S.magmar.gen || 1) === 1 && S.horsea && !S.horsea.gen && S.kingdra.gen === 2, `82 Gen 2 pokémon (Celebi, Kingdra and Porygon2 included), plus Magmar, Horsea and Seadra for Gen 1 (${G2.length})`);
check(E.evoOpts(S.seadra.evo2)[0].stone === 'dragonscale' && E.ITEMS.dragonscale, 'Seadra takes a Dragon Scale to become Kingdra');
check(['raikou','entei','suicune','lugia','ho-oh','celebi'].every(k => S[k].legendary && S[k].gen === 2), 'the beasts, Lugia and Ho-Oh are Gen 2 legendaries');

/* Gen 1 runs see none of it */
E.setActiveGens([1]);
check(!E.BUYABLE.some(k => S[k].gen === 2) && !E.LEGENDS().some(k => S[k].gen === 2), 'a Gen 1 run never sells or meets a Gen 2 pokémon');
check(E.ALL_BOSSES.every(b => !E.themePool(b).some(k => S[k].gen === 2)), '…and no Gen 1 leader fields one');
check(E.evoNext('golbat').length === 0 && E.evoNext('eevee').length === 3 && E.evoNext('gloom').length === 1 && E.evoNext('onix').length === 0, 'Golbat, Onix stay final; Eevee has three branches; Gloom one');
check(E.evoParent('pikachu') === null && E.BUYABLE.includes('pikachu'), 'Pikachu has no baby form in Gen 1');
const g1 = Object.keys(MAIN.TYPE_CHART);
check(g1.every(a => g1.every(d => E.typeMult(a, d) === MAIN.typeMult(a, d))), 'every Gen 1 matchup is exactly as in the main game');
check(['protein','hpup','moonstone'].every(k => E.ITEMS[k]) && !['sunstone','kingsrock','metalcoat'].some(k => E.canUseItem(k, E.makeUnit('eevee', 0)) || E.canUseItem(k, E.makeUnit('onix', 0)) || E.canUseItem(k, E.makeUnit('poliwhirl', 0))), 'Gen 2 evolution items do nothing in a Gen 1 run');

/* Gen 2 on */
E.setActiveGens([1, 2]);
const nx = id => E.evoNext(id).map(n => n.into + (n.stone ? '@' + n.stone : '')).sort().join();
check(nx('golbat') === 'crobat' && nx('chansey') === 'blissey' && nx('onix') === 'steelix@metalcoat' && nx('scyther') === 'scizor@metalcoat', 'Crobat, Blissey, Steelix and Scizor join');
check(nx('poliwhirl') === 'politoed@kingsrock,poliwrath' && nx('gloom') === 'bellossom@sunstone,vileplume', 'Poliwhirl and Gloom can level up as before or take an item');
check(nx('eevee') === 'espeon@sunstone,flareon@firestone,jolteon@thunderstone,umbreon@moonstone,vaporeon@waterstone', 'Eevee has five evolutions');
check(E.evoParent('pikachu') === 'pichu' && E.BUYABLE.includes('pikachu') && E.BUYABLE.includes('pichu'), 'Pichu grows into Pikachu, and Pikachu is still sold');
check(['cleffa:clefairy','igglybuff:jigglypuff','smoochum:jynx','elekid:electabuzz','magby:magmar'].every(x => { const [a, b] = x.split(':'); return nx(a) === b; }), 'the babies grow into their Gen 1 forms');
check(nx('tyrogue') === 'hitmonchan,hitmonlee,hitmontop', 'Tyrogue can become any of the three Hitmons');
{ const G = E.newGame(3, { gens:[2] }); const u = E.makeUnit('onix', 0); G.team = [u];
  check(E.canUseItem('metalcoat', u) && E.evolveUnit(G, u, 'metalcoat') && u.id === 'steelix', 'a Metal Coat turns Onix into Steelix'); }
check(['Steel','Dark'].every(t => E.TYPES[t]) && E.typeMult('Fighting', 'Dark') === E.TUNING.weakMult && E.typeMult('Fire', 'Steel') === E.TUNING.weakMult
  && E.typeMult('Psychic', 'Dark') === E.TUNING.resistMult && E.typeMult('Dark', 'Psychic') === E.TUNING.weakMult && E.typeMult('Normal', 'Steel') === E.TUNING.resistMult, 'Steel and Dark follow the Gen 2 chart (immunities become resists)');
check(S.steelix.type === 'Steel' && S.skarmory.type === 'Steel' && S.umbreon.type === 'Dark' && S.houndoom.type === 'Dark' && S.tyranitar.type === 'Rock' && S.scizor.type === 'Bug', 'main types: Steelix and Skarmory Steel, Umbreon and Houndoom Dark, Tyranitar Rock, Scizor Bug');
check(E.monoTypesFor([2]).includes('Dark') && E.monoTypesFor([2]).includes('Ice') && !E.monoTypesFor([1]).includes('Dark'), 'Gen 2 runs can be Mono-Dark or Mono-Ice; Gen 1 runs cannot');

/* the Johto leaders */
E.setActiveGens([2]);
for(const b of [...E.GYMS2, ...E.ELITE_FOUR2, E.CHAMPION2]){
  const pool = E.themePool(b);
  check(pool.length >= 5 && b.signature.some(k => pool.includes(k)) && (b.guards || []).every(k => S[k]), `${b.name}: ${pool.length} pokémon, signature ${b.signature.find(k => pool.includes(k))}, guards real`);
}
check(!E.themePool(E.bossById('falkner')).some(k => ['dragonite','gyarados','scyther','charizard'].includes(k)), 'Falkner keeps to birds');
check(E.themePool(E.bossById('jasmine')).includes('steelix') && E.themePool(E.bossById('karen')).includes('umbreon') && E.themePool(E.bossById('whitney')).includes('miltank'), 'Jasmine has Steelix, Karen Umbreon, Whitney Miltank');
{ const G = E.newGame(21, { gens:[2] }); E.rollShop(G, false); G.team = [E.makeUnit('chikorita', 0)];
  const R = E.rivalCore(G);
  check(['chikorita','cyndaquil','totodile'].includes(R.starter) && R.core.includes('zubat') && !R.core.includes('eevee'), `Silver steals a Johto starter (${R.starter}) and brings Zubat`); }
/* the Pokédex filters (Sean): what to show, and which gen */
{ const ui = require('fs').readFileSync('ui.js', 'utf8');
  check(/data-f="sec"/.test(ui) && /\['gym','Trainers'\]/.test(ui) && /\['items','Items'\]/.test(ui) && /data-f="gen"/.test(ui) && /PREF\.set\('dexgen'/.test(ui), 'the Pokédex filters by Pokémon / Trainers / Items and by gen, and remembers the choice'); }
E.setActiveGens([1]);
console.log(fails ? fails + ' FAILED' : 'v401 passed'); process.exit(fails ? 1 : 0);
