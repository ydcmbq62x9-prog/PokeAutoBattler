/* 6.5.0: May's sprite, role items, and a Mart that never rolls all one kind. */
const E = require('./engine.js'); const { chromium } = require('playwright');
let fails = 0; const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
const team = ['bulbasaur','charmander','squirtle','pidgey','kadabra','machop'];
const mk = (seed, turn, gens) => { const G = E.newGame(seed, { gens: gens || [1,2,3] }); G.turn = turn; G.team = team.map(i => E.makeUnit(i, 0)); return G; };
/* the mart */
let dups = 0, oneCat = 0, shelves = 0, roleBad = 0;
for(let r = 0; r < 1500; r++){
  const G = mk(r + 1, 1 + r % 30); E.rollMart(G, false);
  for(const h of [false, true]){
    const sl = G.mart.filter(s => !!s.held === h); if(sl.length < 2) continue;
    if(E.tierFor(G) === 1) continue;                       // tier 1 stocks only Protein and HP Up
    shelves++;
    if(new Set(sl.map(s => s.id)).size < sl.length) dups++;
    if(new Set(sl.map(s => E.martCatOf(s.id, h))).size < 2) oneCat++;
  }
  for(const s of G.mart){ const d = E.defOfSlot(s); if(d.role && !G.team.some(u => E.roleOf(u) === d.role)) roleBad++; }
}
check(shelves > 1000 && dups === 0, `no shelf repeats an item (${shelves} shelves)`);
check(oneCat === 0, 'no shelf of two or more is all one category (vitamin / stone / boost, or stat / trigger / economy)');
check(roleBad === 0, 'a role item is only stocked when you own a pokémon of that role');
{ const G = E.newGame(5, { gens:[1,2,3] }); G.turn = 10; G.team = []; E.rollMart(G, false); check(G.mart.length > 0, 'the mart still rolls with an empty party'); }
{ // reserved items stay put and still count
  const G = mk(7, 20); E.rollMart(G, false); G.mart[0].reserved = true; const id = G.mart[0].id;
  for(let i = 0; i < 20; i++) E.rollMart(G, false);
  check(G.mart[0].id === id, 'a reserved item survives rerolls'); }
/* role medicine */
{ const G = mk(3, 10); const t = E.makeUnit('onix', 0), c = E.makeUnit('machop', 0);
  check(E.canUseItem('ironvit', t) && !E.canUseItem('ironvit', c), 'Iron is for Tanks only'); 
  const cn = E.makeUnit('abra', 0); check(E.roleOf(cn) === 'cannon' && E.canUseItem('calcium', cn) && !E.canUseItem('calcium', t), 'Calcium is for Cannons only');
  const sp = E.makeUnit('jigglypuff', 0); check(E.roleOf(sp) === 'support' && E.canUseItem('zinc', sp), 'Zinc is for Supports');
  const br = E.makeUnit('machop', 0); check(E.roleOf(br) === 'bruiser' && E.canUseItem('energyroot', br) && !E.canUseItem('energyroot', sp), 'Energy Root is for Bruisers');
  const u = E.makeUnit('abra', 0); const before = u.atk; G.team = [u]; G.credits = 99; G.mart = [{ id:'calcium', held:false, reserved:false, bought:false }];
  const r = E.buyItem(G, 0, 0); check(r.ok && u.atk === before + 10 && u.vit.protein === 1, 'Calcium gives +10 Attack and counts toward the Protein cap');
  const w = E.makeUnit('abra', 0); w.vit = { protein: E.TUNING.vitaminCap }; check(!E.canUseItem('calcium', w) && !E.canUseItem('protein', w), 'role vitamins share the vitamin cap');
  const m = E.makeUnit('onix', 0); const hp0 = m.hp; G.team = [m]; G.mart = [{ id:'manual', held:false, reserved:false, bought:false }]; E.buyItem(G, 0, 0);
  check(m.hp > hp0 && m.manuals === 1, 'Training Manual grows a Tank mostly in HP');
  m.manuals = 3; check(!E.canUseItem('manual', m), 'at most 3 Training Manuals per pokémon'); }
/* role held items */
{ const tank = E.makeUnit('onix', 0), can = E.makeUnit('abra', 0);
  tank.held = 'plate'; can.held = 'plate';
  check(E.heldStats(tank).hp > 0 && E.heldStats(can).hp === 0, 'Bulk Plate gives a Tank HP and does nothing for a Cannon');
  can.held = 'scope'; check(E.heldStats(can).atk > 0 && E.heldStats(can).hp < 0, 'Scope Lens: more Attack, less HP for a Cannon');
  const sup = E.makeUnit('jigglypuff', 0); sup.held = 'sbell'; check(E.heldStats(sup).spd > 0, 'Soothe Bell adds Support Speed');
  const br = E.makeUnit('machop', 0); br.held = 'gi'; check(E.heldStats(br).atk > 0 && E.heldStats(br).hp > 0, 'Black Belt adds Bruiser HP and Attack');
  check(['plate','gi','sbell','scope'].every(k => E.HELD_ITEMS[k].boss === 'none'), 'role items stay off gym leaders'); }
{ const G = E.newGame(2, { gens:[1,2,3] }); let rolePrize = 0; for(let m = 0; m < 3; m++) for(let t = 0; t < 40; t++){ G.seed = t; E.rivalCore(G); G.rival = null; const l = E.rivalLineup(G, m); if(l.some(x => x.held && E.HELD_ITEMS[x.held].role)) rolePrize++; }
  check(rolePrize === 0, 'rivals never carry role items'); }
/* May */
{ const G = E.newGame(1, { gens:[3] }); check(E.rivalOf(G).id === 'may' && E.rivalOf(G).support === 'ralts', 'May is the Gen 3 rival and her Support is Ralts');
  G.team = [E.makeUnit('torchic', 0)]; G.stage = E.rivalStages(G)[0]; G.turn = 3; E.opponentFor(G);
  check(G.rival.core.includes('ralts') && G.rival.core.includes('taillow'), 'her team always has Taillow and Ralts'); }
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await p.waitForTimeout(600);
  const r = await p.evaluate(() => { const G0 = { gens:[3] }; return { sprite: !!SPRITES.may && SPRITES.may.startsWith('data:image/png'),
    lines: MAY_LINES.length === 3 && MAY_LINES.every(l => l.hi && l.lost && l.won), art: bossArt(RIVAL3, 'hero').includes('<img'),
    items: ['ironvit','calcium','zinc','energyroot','manual'].every(k => ITEMS[k]) && ['plate','gi','sbell','scope'].every(k => HELD_ITEMS[k]) }; });
  check(r.sprite, 'May has her sprite'); check(r.lines, 'May has her three meeting lines'); check(r.art, 'her portrait renders'); check(r.items, 'the new items exist in the page');
  check(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
})();
