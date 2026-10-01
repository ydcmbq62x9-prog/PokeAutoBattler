/* 3.8.0: nineteen new pokémon, three new Mono types, wording for legendaries. */
const E = require('./engine.js'); const S = E.SPECIES; const fs = require('fs');
let fails = 0; const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
const NEW = ['weedle','kakuna','beedrill','spearow','fearow','doduo','dodrio','diglett','dugtrio','sandshrew','sandslash','nidoranf','nidorina','nidoqueen','nidoranm','nidorino','nidoking','farfetchd','porygon'];
check(NEW.every(k => S[k]), 'all nineteen new pokémon exist');
check(E.evoLine('weedle').join() === 'weedle,kakuna,beedrill' && E.evoLine('nidoranf').join() === 'nidoranf,nidorina,nidoqueen' && E.evoLine('nidoranm').join() === 'nidoranm,nidorino,nidoking', 'Weedle and Nidoran lines evolve in order');
check(E.evoNext('nidorina')[0].by === 'stone' && E.evoNext('nidorina')[0].stone === 'moonstone' && E.evoNext('nidorino')[0].stone === 'moonstone', 'Nidorina and Nidorino need a Moon Stone');
check(/Nidorina/.test(E.ITEMS.moonstone.text) && /Nidorino/.test(E.ITEMS.moonstone.text), 'the Moon Stone text lists them');
check(['farfetchd','porygon'].every(k => !E.evoNext(k).length), "Farfetch'd and Porygon do not evolve");
check(E.BUYABLE.includes('weedle') && !E.BUYABLE.includes('kakuna') && E.BUYABLE.includes('porygon'), 'bases are buyable, evolved forms are not');
check(['spearow','fearow','doduo','dodrio','farfetchd'].every(k => S[k].type === 'Flying'), 'the birds are Flying (Normal/Flying counts as Flying)');
check(S.nidoking.type === 'Poison' && S.diglett.type === 'Ground' && S.sandshrew.type === 'Ground' && S.beedrill.type === 'Bug', 'Nidoran Poison, Diglett and Sandshrew Ground, Weedle Bug');
for(const id of NEW){ const n = E.evoNext(id)[0]; if(n) check(S[n.into].hp + S[n.into].atk + S[n.into].spd > S[id].hp + S[id].atk + S[id].spd, `${id} → ${n.into} is an upgrade`); }
for(const t of ['Flying','Poison','Ground']){ check(E.MONO_TYPES.includes(t), `${t} is a Mono type`); check(typeof E.TUNING.mods.monoFoes[t] === 'number' && E.TUNING.mods.monoFoes[t] > 0.6 && E.TUNING.mods.monoFoes[t] < 1.3, `${t} has a measured Mono factor`); }
check(S.nidoqueen.role === 'tank' && S.nidoking.role === 'cannon' && S.dodrio.role === 'bruiser' && S.porygon.role === 'support', 'roles: Nidoqueen Tank, Nidoking Cannon, Dodrio Bruiser, Porygon Support');
check(Object.values(S).every(sp => !sp.move2 || sp.move2.name), 'every second move is named');
const pool = id => E.themePool(E.bossById(id));
check(!pool('giovanni').includes('fearow') && pool('lance').includes('fearow') && pool('koga').includes('beedrill') && pool('koga').includes('nidoking'), 'Lance keeps the birds, Koga gets Beedrill and Nidoking');
check(E.ALL_BOSSES.every(b => (b.guards || []).every(g => S[g])), 'every bodyguard id exists');
const ui = fs.readFileSync('ui.js', 'utf8');
check(/yours to keep once recruited/.test(ui) && !/leaves after the next battle/.test(ui), 'the legendary card says a recruited legendary is kept');
console.log(fails ? fails + ' FAILED' : 'v380 passed'); process.exit(fails ? 1 : 0);
