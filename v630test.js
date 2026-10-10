/* 6.3.0: Hoenn catches up with Kanto and Johto. */
const E = require('./engine.js'); const { chromium } = require('playwright');
let fails = 0; const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
const S = E.SPECIES, g3 = Object.keys(S).filter(k => S[k].gen === 3);
check(['bagon', 'shelgon', 'salamence', 'aron', 'lairon', 'aggron', 'beldum', 'metang', 'metagross'].every(k => S[k] && S[k].move && S[k].move2), 'Bagon, Aron and Beldum lines exist with two moves each');
check(g3.every(k => S[k].move && S[k].move2), 'every Gen 3 pokémon has two moves');
check(E.monoTypesFor([2, 3]).includes('Steel') && E.monoTypesFor([3]).includes('Dragon'), 'Mono-Steel (with Gen 2) and Mono-Dragon (Hoenn) are possible');
check(E.stonesFor('lombre').join() === 'waterstone' && E.stonesFor('nuzleaf').join() === 'leafstone', 'Lombre takes a Water Stone and Nuzleaf a Leaf Stone');
check(!('tier4' in S.slaking), 'Slaking has no stray tier4 field');
const seen = new Set(); for(let d = 1; d <= 200; d++) seen.add(E.dailyGens('d' + d).join());
check(['3', '1,3', '2,3', '1,2,3'].every(k => seen.has(k)), 'the daily can be Gen 3, alone or mixed');
const b3 = E.GEN_BOSSES[3], all = b3.gyms.concat(b3.elite, [b3.champion]);
check(all.every(b => b.guards && b.guards.length >= 3 && b.guards.every(k => S[k])), 'every Hoenn leader has bodyguards, all real pokémon');
check(JSON.stringify(E.TUNING.gensFoes).includes('1+2+3') && ['3', '1+3', '2+3', '1+2+3'].every(k => E.TUNING.gensFoes[k] && E.TUNING.mods.monoFoesByGens[k]), 'every Gen 3 combination has an opponent scale and Mono table');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); const p = await b.newPage();
  await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await p.waitForTimeout(600);
  const r = await p.evaluate(() => ({ sig: ['blaziken', 'gardevoir', 'metagross', 'salamence', 'kyogre', 'rayquaza', 'registeel'].every(k => SIG[k]),
    lines: ['roxanne','brawly','wattson','flannery','norman','winona','tate-liza','juan','sidney','phoebe','glacia','drake','wallace-champion','steven'].filter(id => !BOSS_LINES[id]) }));
  check(r.sig, 'Hoenn finals and legendaries have signature move effects');
  check(r.lines.length === 0, 'every Hoenn boss has an opening line' + (r.lines.length ? ' (missing ' + r.lines + ')' : ''));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
})();
