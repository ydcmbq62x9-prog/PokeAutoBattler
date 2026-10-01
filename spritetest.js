/* Every pokémon, item, held item and leader has artwork (v29). A missing file
   only falls back to a placeholder, so nothing else would notice. */
const fs = require('fs'); const E = require('./engine.js');
const SPRITES = new Function(fs.readFileSync('sprites.js', 'utf8') + '; return SPRITES;')();
const want = { pokémon: Object.keys(E.SPECIES), items: Object.keys(E.ITEMS), held: Object.keys(E.HELD_ITEMS),
  'battle items': E.BATTLE_ITEMS.map(b => b.id), leaders: E.ALL_BOSSES.map(b => b.id) };
/* Sean supplies the artwork from his Sprites folder; until then these show a two-letter placeholder. */
const AWAITING_ART = [];   // 3.8.1: all art delivered.   // 3.1.2: all art delivered.   // 2.7.1: all art delivered. Add ids here while a new pokémon waits for its sprite.
let bad = 0;
for(const [k, ids] of Object.entries(want)){
  const miss = ids.filter(id => !SPRITES[id] && !AWAITING_ART.includes(id));
  console.log(`${miss.length ? '✗' : '…'} ${k}: ${ids.length - miss.length}/${ids.length}${miss.length ? ' — missing ' + miss.join(', ') : ''}`);
  bad += miss.length;
}
const html = fs.readFileSync('/mnt/user-data/outputs/pokebattler.html', 'utf8');
const inBuild = Object.keys(SPRITES).every(k => html.includes(`"${k}": "data:image`));
console.log((inBuild ? '…' : '✗') + ' every sprite made it into the built game');
if(bad || !inBuild){ console.log('\nFAILED'); process.exit(1); }
console.log('\nsprites passed');
