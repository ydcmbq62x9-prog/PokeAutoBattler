/* Every pokémon, item, held item and leader has artwork (v29). A missing file
   only falls back to a placeholder, so nothing else would notice. */
const fs = require('fs'); const E = require('./engine.js');
const SPRITES = new Function(fs.readFileSync('sprites.js', 'utf8') + '; return SPRITES;')();
const want = { pokémon: Object.keys(E.SPECIES), items: Object.keys(E.ITEMS), held: Object.keys(E.HELD_ITEMS),
  'battle items': E.BATTLE_ITEMS.map(b => b.id), leaders: [...(E.EVERY_BOSS || E.ALL_BOSSES), ...(E.RIVAL2 ? [E.RIVAL2] : [])].map(b => b.id) };   // 4.0.0: every gen's leaders
/* Sean supplies the artwork from his Sprites folder; until then these show a two-letter placeholder. */
const AWAITING_ART = [];
let bad = 0;
for(const [k, ids] of Object.entries(want)){
  const miss = ids.filter(id => !SPRITES[id] && !AWAITING_ART.includes(id));
  console.log(`${miss.length ? '✗' : '…'} ${k}: ${ids.length - miss.length}/${ids.length}${miss.length ? ' — missing ' + miss.join(', ') : ''}`);
  bad += miss.length;
}
const html = fs.readFileSync(require('./pkbpaths').PAGE_FILE, 'utf8');
const inBuild = Object.keys(SPRITES).every(k => html.includes(`"${k}": "data:image`));
console.log((inBuild ? '…' : '✗') + ' every sprite made it into the built game');
if(bad || !inBuild){ console.log('\nFAILED'); process.exit(1); }
console.log('\nsprites passed');
