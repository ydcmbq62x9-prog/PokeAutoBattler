/* X items, old rules against new, on the reference player. The OLD rules are
   restored by monkeypatching the exported item objects and lifting the cap, so
   both run on the same engine and the same seeds. */
const E = require('./engine.js');
const B = require('./botlib.js');
const RUNS = Number(process.env.RUNS || 250);

const NEW = E.BATTLE_ITEMS.map(d => d.apply);
const OLD = [ (u, t) => { u.tmpAtk = (u.tmpAtk||0) + 9 + Math.floor(t*2.7); },
              (u, t) => { u.tmpSpd = (u.tmpSpd||0) + 10 + Math.floor(t*1.3); } ];
function rules(which){
  E.BATTLE_ITEMS.forEach((d, i) => d.apply = which === 'old' ? OLD[i] : NEW[i]);
  E.TUNING.xItems.perMon = which === 'old' ? 999 : 1;
}
function measure(opts){
  let cleared = 0, reached = 0, badges = 0;
  for(let r = 0; r < RUNS; r++){
    const out = B.playRun(r * 7 + 1, opts);
    if(out.cleared) cleared++; if(out.g.reached) reached++; badges += out.badges;
  }
  return `cleared ${(cleared/RUNS*100).toFixed(0).padStart(3)}%   reach E4 ${(reached/RUNS*100).toFixed(0).padStart(3)}%   badges ${(badges/RUNS).toFixed(1)}`;
}
const base = { reroll:true, bench:4 };
console.log('player                                         ' );
rules('new');
console.log('never uses X items                            ' + measure({ ...base, x:'never' }));
rules('old');
console.log('OLD rules · one of each before bosses         ' + measure({ ...base, x:'bosses' }));
console.log('OLD rules · dump it all on a spread attacker  ' + measure({ ...base, x:'dump' }));
rules('new');
console.log('NEW rules · one of each before bosses         ' + measure({ ...base, x:'bosses' }));
console.log('NEW rules · tries the dump (cap stops it)     ' + measure({ ...base, x:'dump' }));
