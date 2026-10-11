/* 6.8.0: every Mart shelf carries at least one evolution stone when someone can use one. */
const E = require('./engine.js'); let bad = 0;
for (let seed = 1; seed <= 300; seed++) {
  const G = E.newGame ? E.newGame({ gens:[1,2,3], seed }) : null;
  if (!G) { console.log('no newGame'); process.exit(1); }
  G.team = ['eevee','pikachu','machop','onix'].map(i => E.makeUnit ? E.makeUnit(i, 0) : null);
  G.credits = 999; G.badges = 4; G.turn = 16;
  for (let r = 0; r < 6; r++) {
    E.rollMart(G, r > 0);
    if (!G.mart.some(s => !s.held && E.STONE_IDS.includes(s.id))) { bad++; console.log('no stone', seed, r, G.mart.map(s=>s.id)); }
  }
}
console.log(bad ? 'FAIL ' + bad : 'v680 ok'); process.exit(bad ? 1 : 0);
