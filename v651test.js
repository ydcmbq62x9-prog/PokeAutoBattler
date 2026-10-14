/* 6.6.1: the pokémon summary names the vitamin limit each item fills. */
const E = require('./engine.js'); const { chromium } = require('playwright');
let fails = 0; const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
check(E.vitMembers('carbos').join() === 'carbos,energyroot' && E.vitMembers('hpup').join() === 'hpup,ironvit,zinc' && E.vitMembers('protein').join() === 'protein,calcium', 'each vitamin limit lists the items that fill it');
{ const G = E.newGame(4); G.credits = 99; const u = E.makeUnit('machop', 0); G.team = [u];
  for(const id of ['energyroot', 'carbos', 'carbos']){ G.mart = [{ id, held:false, reserved:false, bought:false }]; E.buyItem(G, 0, 0); }
  check(u.vit.carbos === 3 && u.vitBy.energyroot === 1 && u.vitBy.carbos === 2, 'the unit remembers which items it took'); }
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); const p = await b.newPage({ viewport:{ width:390, height:844 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(require('./pkbpaths').PAGE); await p.waitForTimeout(500);
  const r = await p.evaluate(() => { newRun({ gens:[1] }); const u = makeUnit('machop', 0); u.vit = { carbos:3, protein:2 }; u.vitBy = { energyroot:1, carbos:2, calcium:2 }; u.manuals = 1; G.badges = 2;
    const old = makeUnit('onix', 0); old.vit = { hpup:4 };
    return { a: vitLineHtml(u).replace(/<[^>]+>/g, '|').replace(/\|+/g, '|'), b: vitLineHtml(old).replace(/<[^>]+>/g, '|').replace(/\|+/g, '|'), t: vitLimitText('energyroot'), t2: vitLimitText('protein') }; });
  console.log(r);
  check(/Speed vitamins 3\/10/.test(r.a) && /Carbos ×2, Energy Root ×1/.test(r.a) && !/Carbos 3\/10/.test(r.a), 'Energy Root + Carbos show as one Speed limit, with each item');
  check(/Attack vitamins 2\/10/.test(r.a) && /Calcium ×2/.test(r.a), 'Calcium shows as an Attack vitamin');
  check(/Training Manuals 1\/2/.test(r.a), 'Training Manuals show against the badge-based limit');
  check(/HP vitamins 4\/10/.test(r.b) && !/\(/.test(r.b), 'an older pokémon with only a total still shows cleanly');
  check(/Speed vitamin limit of 10 per pokémon, shared with Carbos/.test(r.t) && /Attack vitamin limit of 10 per pokémon, shared with Calcium/.test(r.t2), 'the item description says which limit it shares');
  check(errs.length === 0, 'no page errors' + (errs[0] ? ': ' + errs[0] : ''));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
})();
