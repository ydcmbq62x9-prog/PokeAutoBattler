/* v50: item rarities, and the item balance pass. */
const E = require('./engine.js');
const { chromium, devices } = require('playwright');
let fails = 0;
const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
const T = E.TUNING;
const all = [...Object.entries(E.ITEMS), ...Object.entries(E.HELD_ITEMS)];
const ITEMS_N = E.ITEMS, HELD_N = E.HELD_ITEMS;

check(all.every(([k, d]) => T.rarity[d.rarity]), `every item names a rarity (${all.length} items)`);
const counts = {}; all.forEach(([k, d]) => counts[d.rarity] = (counts[d.rarity] || 0) + 1);
check(counts.common && counts.uncommon && counts.rare, `common, uncommon and rare are all in use (${JSON.stringify(counts)})`);
check(T.rarity.common.weight > T.rarity.uncommon.weight && T.rarity.uncommon.weight > T.rarity.rare.weight && T.rarity.rare.weight > T.rarity.veryrare.weight,
  'each step rarer turns up less often');
check(E.rarityOf({ rare:true }) === 'rare' && E.rarityOf({}) === 'common', 'an item with no rarity is common; the old rare flag still reads as Rare');

/* the shelf follows the weights: uncommon ~0.6x a common, rare ~0.25x */
{ const held = { common:0, uncommon:0, rare:0 }, per = {};
  Object.values(E.HELD_ITEMS).forEach(d => per[d.rarity] = (per[d.rarity] || 0) + 1);
  for(let s = 1; s < 1500; s++){ const G = E.newGame(s); G.turn = 30; G.badges = 8; G.team = [E.makeUnit('abra', 0)];
    E.rollMart(G, false); for(const m of G.mart) if(m.held) held[E.HELD_ITEMS[m.id].rarity]++; }
  const each = r => held[r] / per[r];
  const u = each('uncommon') / each('common'), r = each('rare') / each('common');
  check(u > 0.5 && u < 0.72, `an uncommon held item turns up ~${T.rarity.uncommon.weight}× as often as a common one (${u.toFixed(2)}×)`);
  check(r > 0.18 && r < 0.33, `a rare one ~${T.rarity.rare.weight}× (${r.toFixed(2)}×)`); }

/* rival prizes and Gift Items use the same odds */
{ const seen = {};
  for(let s = 1; s < 1200; s++){ const G = E.newGame(s); G.badges = 8; G.turn = 30; const p = E.rivalPrize ? E.rivalPrize(G, 1) : null;
    if(p && p.item) seen[E.HELD_ITEMS[p.item].rarity] = (seen[E.HELD_ITEMS[p.item].rarity] || 0) + 1; }
  const per = {}; Object.values(E.HELD_ITEMS).forEach(d => per[d.rarity] = (per[d.rarity] || 0) + 1);
  const ok = !E.rivalPrize || (seen.rare / per.rare) < (seen.common / per.common) * 0.4;
  check(ok, `rival prizes favour common items over rare ones (${JSON.stringify(seen)})`); }

/* the balance numbers Sean picked */
check(E.HELD_ITEMS.sitrus.cost === 5 && E.HELD_ITEMS.focus.cost === 5, 'Sitrus Berry and Focus Band cost 5₽');
check(T.xItems.pct === 0.05, 'X items are +5% a use');
check(E.HELD_ITEMS.coat.cutPct === 0.15 && !E.HELD_ITEMS.coat.reduce, 'Metal Coat is a share, not a flat 2');
check(E.HELD_ITEMS.char.unresist && !E.HELD_ITEMS.char.superBoost, 'Expert Belt: resisted hits land for full damage');
check(E.HELD_ITEMS.lefto.endRoundPct === 0.12, 'Leftovers heals 12%');
check(/max HP/.test(E.HELD_ITEMS.sitrus.text) && !/round of battle EXP/.test(E.HELD_ITEMS.egg.text + E.ITEMS.expshare.text), 'the reworded texts');

(async () => {
  const b = await chromium.launch();
  for(const [tag, dev] of [['phone', devices['iPhone 13']], ['wide', { viewport: { width: 1250, height: 950 } }]]){
    const p = await (await b.newContext(dev)).newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file:///mnt/user-data/outputs/pokebattler.html'); await p.waitForTimeout(250);
    const r = await p.evaluate(() => { G.turn = 20; G.badges = 5; G.credits = 50; G.team = [makeUnit('abra', 0)];
      G.mart = [{ id:'protein', held:false }, { id:'candy', held:false }, { id:'expshare', held:false }, { id:'band', held:true }, { id:'lefto', held:true }, { id:'egg', held:true }]; render();
      const rows = [...document.querySelectorAll('.martrow')].map(r => ({ name: r.querySelector('.mtext b').firstChild.textContent.trim(),
        tag: (r.querySelector('.rar') || {}).textContent || '', inside: (() => { const t = r.querySelector('.rar'); if(!t) return true;
          const a = t.getBoundingClientRect(), c = r.getBoundingClientRect(); return a.right <= c.right + 0.5 && a.left >= c.left; })() }));
      return rows; });
    const by = Object.fromEntries(r.map(x => [x.name, x.tag]));
    check(by['Protein'] === '' && by['Muscle Band'] === '', `${tag}: common items carry no tag`);
    check(by['Rare Candy'] === 'UNCOMMON' && by['Leftovers'] === 'UNCOMMON', `${tag}: uncommon items say so`);
    check(by['Exp. Share'] === 'RARE' && by['Lucky Egg'] === 'RARE', `${tag}: rare items say so`);
    check(r.every(x => x.inside), `${tag}: the tags fit inside their rows`);
    const dex = await p.evaluate(() => { openDex(); const tags = [...document.querySelectorAll('.modal .dexrow .rar')].map(t => t.textContent);
      document.querySelectorAll('.modal').forEach(m => m.remove()); return tags; });
    { const want = r => [...Object.values(ITEMS_N), ...Object.values(HELD_N)].filter(d => d.rarity === r).length;
      check(dex.filter(t => t === 'RARE').length === want('rare') && dex.filter(t => t === 'UNCOMMON').length === want('uncommon'), `${tag}: the Pokédex item pages show the tags (${dex.length})`); }
    check(!errs.length, `${tag}: no errors${errs.length ? ' — ' + errs[0] : ''}`);
  }
  await b.close();
  console.log(fails ? `${fails} FAILED` : 'v50 passed');
  process.exit(fails ? 1 : 0);
})();
