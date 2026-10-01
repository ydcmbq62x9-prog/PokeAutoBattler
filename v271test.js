/* 2.7.1: real artwork for the Paras, Exeggcute and Bellsprout lines and the Leaf Stone. */
const fs = require('fs'); const E = require('./engine.js');
const SPRITES = new Function(fs.readFileSync('sprites.js', 'utf8') + '; return SPRITES;')();
let fails = 0; const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
for(const id of ['paras', 'parasect', 'exeggcute', 'exeggutor', 'bellsprout', 'weepinbell', 'victreebel', 'leafstone'])
  check(/^data:image\/png;base64,/.test(SPRITES[id] || ''), id + ' has a sprite');
check(!!E.ITEMS.leafstone, 'the Leaf Stone item exists');
console.log(fails ? `${fails} FAILED` : 'v271 passed'); process.exit(fails ? 1 : 0);
