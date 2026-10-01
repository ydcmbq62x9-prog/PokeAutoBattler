/* Held items, round 2: the item orbits the sprite, and the Bag moves into the
   dead space at the bottom of the PC panel. Three ways to fit it there. */
const E = require('./engine.js');
const fs = require('fs');

const SPRITES = new Function(fs.readFileSync('sprites.js','utf8') + '; return SPRITES;')();
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const S   = id => E.SPECIES[id];
const col = id => E.TYPES[S(id).type].color;
const img = (id, cls) => `<img class="s ${cls||''}" src="${SPRITES[id]}" alt="${esc(S(id).name)}">`;

const PARTY = ['wartortle','pikachu','machoke','onix','butterfree','gengar'];
const HELD_ON = { wartortle:'band', machoke:'focus', gengar:'coin' };

const HELD = [
  { id:'band',    n:'Muscle Band',  e:'🎽', c:'#ff7a5c', k:'stat',    t:'+3 Attack while held.' },
  { id:'claw',    n:'Quick Claw',   e:'🪝', c:'#6fc3ff', k:'stat',    t:'+20 Speed while held.' },
  { id:'lefto',   n:'Leftovers',    e:'🍎', c:'#5ad17a', k:'trigger', t:'Heals 3 HP at the end of each round.' },
  { id:'sitrus',  n:'Sitrus Berry', e:'🍒', c:'#ff6f9c', k:'trigger', t:'Once per battle, below half HP, heals 25%.' },
  { id:'focus',   n:'Focus Band',   e:'🥋', c:'#ffc447', k:'trigger', t:'Once per battle, survives a fatal hit at 1 HP.' },
  { id:'egg',     n:'Lucky Egg',    e:'🥚', c:'#c9a9ff', k:'economy', t:'+1 EXP tick after every battle.' },
  { id:'coin',    n:'Amulet Coin',  e:'🪙', c:'#ffd76a', k:'economy', t:'+1₽ at the start of each turn.' },
  { id:'evio',    n:'Eviolite',     e:'💠', c:'#7de0ff', k:'stat',    t:'+8 HP, but only if it can still evolve.' },
  { id:'coat',    n:'Metal Coat',   e:'🛡️', c:'#a9b6cc', k:'stat',    t:'Every hit against it deals 1 less damage.' },
  { id:'char',    n:'Charcoal',     e:'🔥', c:'#ff9b4a', k:'stat',    t:'+50% damage when it already hits for ×2.' },
];
const H = Object.fromEntries(HELD.map(h => [h.id, h]));

const tile = (h, cls) => h
  ? `<span class="itile ${cls||''}" style="--ic:${h.c}" title="${esc(h.n)}"><i>${h.e}</i></span>`
  : `<span class="itile empty ${cls||''}"></span>`;

/* the party card — orbit badge, the treatment you picked */
function card(id, heldId, extra){
  const s = S(id), h = heldId ? H[heldId] : null;
  return `<div class="pcard ${extra||''}" style="--c:${col(id)}" data-pk="${id}">
    <div class="cart">${img(id)}${h ? `<span class="cring">${tile(h)}</span>` : ''}</div>
    <b class="cname">${esc(s.name)}</b>
    <div class="cstats"><span class="a">◆${s.atk}</span><span class="h">♥${s.hp}</span><span class="p">»${s.spd}</span></div>
  </div>`;
}
const formation = () => `<div class="form">
  ${[4,2,0,5,3,1].map(i => card(PARTY[i], HELD_ON[PARTY[i]])).join('')}
</div>`;

/* ---------- the PC box, in three bag arrangements ---------------------- */
const PCMON = ['charmeleon','staryu','geodude','vulpix'];
const boxCells = (n) => PCMON.map(id => `<span class="wcell">${img(id,'w')}</span>`).join('')
  + Array.from({length:n-PCMON.length}, () => '<span class="wcell empty"></span>').join('');
const BAG = ['claw','lefto',null,'sitrus'];
const bagCells = cls => BAG.map(id =>
  `<button class="bcell ${cls||''}" data-item="${id||''}">${tile(id?H[id]:null)}</button>`).join('');

const pcTray = `
<div class="panel sm pc v1">
  <h3>PC <span class="hint">4 / 12</span></h3>
  <div class="wall">${boxCells(12)}</div>
  <h3 class="bagttl">BAG <span class="hint">3 / 4 held</span></h3>
  <div class="wall bag">${bagCells()}</div>
</div>`;

const pcFloors = `
<div class="panel sm pc v2">
  <h3>PC <span class="hint">4 / 12 · 3 / 4 held</span></h3>
  <div class="wall onebox">
    ${boxCells(12)}
    <div class="divider"><span>HELD ITEMS</span></div>
    ${bagCells('inbox')}
  </div>
</div>`;

const pcBelt = `
<div class="panel sm pc v3">
  <h3>PC <span class="hint">4 / 12</span></h3>
  <div class="wall">${boxCells(12)}</div>
  <div class="belt">
    <span class="beltlabel">BAG</span>
    ${bagCells('sm')}
    <span class="belthint">3/4</span>
  </div>
</div>`;

const daycare = `
<div class="panel sm">
  <h3>DAYCARE <span class="hint">3₽ · three copies to evolve</span></h3>
  <div class="dlist">${['squirtle','machop','dratini','seel','abra','magnemite'].map(id =>
    `<div class="drow" style="--c:${col(id)}"><span class="dball"></span>${img(id,'d')}<b>${S(id).name}</b><span class="dp">3₽</span></div>`).join('')}</div>
</div>`;

const mart = `
<div class="panel sm">
  <h3>POKÉMART <span class="hint">tier 4</span></h3>
  <div class="mlist">
    <div class="mhead">HELD — STAYS ON UNTIL YOU MOVE IT</div>
    ${['band','focus','egg'].map(k => `<div class="mrow">${tile(H[k])}<div><b>${H[k].n}</b><i>${H[k].t}</i></div><span class="mp">4₽</span></div>`).join('')}
    <div class="mhead">MEDICINE &amp; STONES — USE NOW</div>
    <div class="mrow"><span class="itile" style="--ic:#ff7a5c"><i>💊</i></span><div><b>Protein</b><i>+3 Attack, permanently.</i></div><span class="mp">3₽</span></div>
    <div class="mrow"><span class="itile" style="--ic:#6fc3ff"><i>💧</i></span><div><b>Water Stone</b><i>Evolves Staryu.</i></div><span class="mp">4₽</span></div>
  </div>
</div>`;

const screen = (variant, cls) => `
<div class="screen ${cls||''}" data-v="${variant}">
  <div class="panel">
    <h3>YOUR PARTY <span class="hint">the front rank takes the hits · fastest acts first</span></h3>
    ${formation()}
  </div>
  <div class="msgbox">Give <b>Muscle Band</b> to Wartortle?<i>tap a pokémon · Esc to cancel</i></div>
  <div class="shelves">
    ${variant === 1 ? pcTray : variant === 2 ? pcFloors : pcBelt}
    ${daycare}
    ${mart}
  </div>
</div>`;

const itemTable = `
<table class="tbl">
  <thead><tr><th></th><th>Item</th><th>Kind</th><th>Effect</th></tr></thead>
  <tbody>${HELD.map(h => `<tr><td>${tile(h)}</td><td><b>${h.n}</b></td>
    <td><span class="kind ${h.k}">${h.k}</span></td><td>${h.t}</td></tr>`).join('')}</tbody>
</table>`;

const html = `<title>PokéBattler Bag Layout</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Silkscreen:wght@400;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<style>
:root{
  --bg:#0f1420; --panel:#1c2437; --panel2:#232d44; --line:#2e3a55; --line2:#3d4b6b;
  --text:#e8edf7; --muted:#93a0bd; --dim:#65718f;
  --gold:#ffc447; --hp:#5ad17a; --atk:#ff7a5c; --spd:#6fc3ff;
  --pix:'Silkscreen',ui-monospace,monospace;
  --body:'IBM Plex Sans',system-ui,sans-serif;
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font-family:var(--body);line-height:1.5}
.wrap{max-width:1080px;margin:0 auto;padding:26px 16px 70px}
h1{font-family:var(--pix);font-size:clamp(18px,3.4vw,26px);margin:0 0 10px;color:var(--gold);letter-spacing:.5px}
.lede{color:var(--muted);max-width:68ch;margin:0 0 4px;font-size:15px}
.rules{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0 0}
.rule{font-size:12px;border:1px solid var(--line2);border-radius:8px;padding:6px 10px;color:var(--muted);background:var(--panel)}
.rule b{color:var(--text)}
.rule.on{border-color:#4a7a5c;color:#9ee0b6}
.opt{margin-top:36px;border-top:1px solid var(--line);padding-top:18px}
.opt h2{font-family:var(--pix);font-size:13.5px;letter-spacing:.6px;margin:0 0 5px}
.opt .sub{color:var(--muted);font-size:13.5px;margin:0 0 12px;max-width:72ch}
.tags{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 12px}
.tag{font-size:10.5px;border:1px solid var(--line2);color:var(--muted);border-radius:20px;padding:2px 9px}
.tag.good{color:#7de0aa;border-color:#245140}
.tag.bad{color:#ff9d9d;border-color:#5e2d33}
.tiny{font-size:11px;color:var(--dim);margin:8px 0 0;line-height:1.45}
img.s{image-rendering:pixelated;display:block}

/* ---- game chrome. container queries so the phone frame is honest ---- */
.screen{background:#121828;border:1px solid var(--line);border-radius:14px;padding:11px;
  display:grid;gap:9px;container-type:inline-size}
.panel{background:var(--panel);border:1px solid var(--line2);border-radius:12px;padding:10px}
.panel h3{font-family:var(--pix);font-size:10px;letter-spacing:.7px;color:var(--muted);
  margin:0 0 8px;display:flex;align-items:center;gap:8px}
.hint{font-family:var(--body);font-weight:400;letter-spacing:0;color:var(--dim);font-size:11px}
.shelves{display:grid;gap:9px;grid-template-columns:1fr;align-items:start}
@container (min-width:780px){ .shelves{grid-template-columns:1.05fr 1fr .95fr} }
.msgbox{background:#151c2c;border:1px solid var(--line);border-radius:10px;padding:8px 11px;font-size:12.5px}
.msgbox i{font-style:normal;color:var(--dim);display:block;font-size:11px}

/* ---- party ---- */
.form{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}
.pcard{background:linear-gradient(180deg,var(--panel2),#1a2135);border:1px solid var(--line2);
  border-radius:11px;padding:6px 3px 5px;display:flex;flex-direction:column;align-items:center;
  gap:2px;position:relative;min-height:102px}
.cart{width:48px;height:48px;display:flex;align-items:center;justify-content:center;position:relative;
  border-radius:9px;background:color-mix(in srgb,var(--c) 22%,#151c2c);
  border:1px solid color-mix(in srgb,var(--c) 45%,#151c2c)}
.cart img{width:40px;height:40px;object-fit:contain}
.cname{font-size:11.5px}
.cstats{display:flex;gap:5px;font-size:10px;font-weight:700}
.cstats .a{color:var(--atk)} .cstats .h{color:var(--hp)} .cstats .p{color:var(--spd)}
.cring{position:absolute;right:-7px;bottom:-5px}
.cring .itile{box-shadow:0 0 0 2px #1a2135, 0 2px 5px rgba(0,0,0,.5)}

/* ---- item tile ---- */
.itile{width:22px;height:22px;border-radius:7px;display:inline-flex;align-items:center;justify-content:center;
  background:color-mix(in srgb,var(--ic,#5aa9ff) 26%,#0f1420);
  border:1px solid color-mix(in srgb,var(--ic,#5aa9ff) 60%,#0f1420);font-size:12px;line-height:1}
.itile i{font-style:normal}
.itile.empty{background:#141a29;border:1px dashed var(--line2)}

/* ---- boxes ---- */
.wall{display:grid;grid-template-columns:repeat(4,1fr);gap:2px;padding:8px;border-radius:9px;
  background:#16324a;
  background-image:radial-gradient(circle at 50% 50%, rgba(255,255,255,.07) 2px, transparent 2px),
    linear-gradient(180deg,#1b3a54,#13293d);
  background-size:20px 20px,100% 100%}
.wall.bag{background-image:radial-gradient(circle at 50% 50%, rgba(255,214,106,.10) 2px, transparent 2px),
    linear-gradient(180deg,#3a3050,#241f38)}
.wcell,.bcell{min-height:48px;border:0;background:transparent;border-radius:8px;cursor:pointer;
  display:flex;align-items:center;justify-content:center;position:relative;padding:3px}
.wcell img{width:34px;height:34px;object-fit:contain}
.wcell.empty::before{content:'';width:16px;height:16px;border-radius:50%;opacity:.4;position:absolute;
  background:radial-gradient(circle closest-side,#eef3f8 0 38%,#0d1018 38% 57%,transparent 57%),
             linear-gradient(180deg,#d8504a 0 44%,#0d1018 44% 56%,#e7edf5 56% 100%);
  box-shadow:inset 0 0 0 1.5px #0d1018}
.bcell .itile{width:30px;height:30px;font-size:15px}
.bcell.sm{min-height:34px}
.bcell.sm .itile{width:26px;height:26px;font-size:13px}
.bcell.on,.bcell:hover{background:rgba(255,196,71,.16)}
.bagttl{margin:9px 0 6px !important}

/* v2: one box, a divider, items on the bottom floor */
.wall.onebox{grid-template-columns:repeat(4,1fr)}
.wall.onebox .divider{grid-column:1/-1;display:flex;align-items:center;gap:8px;margin:5px 2px 3px;
  font-family:var(--pix);font-size:8px;letter-spacing:.7px;color:#ffe3a6}
.wall.onebox .divider::before,.wall.onebox .divider::after{content:'';flex:1;height:1px;
  background:linear-gradient(90deg,transparent,rgba(255,214,106,.55),transparent)}
.wall.onebox .bcell.inbox{background:rgba(58,48,80,.55);border:1px solid rgba(255,214,106,.22)}

/* v3: belt across the panel base */
.belt{display:flex;align-items:center;gap:5px;margin-top:8px;padding:5px 8px;border-radius:10px;
  background:linear-gradient(180deg,#2b2440,#1d1a2c);border:1px solid #453a63}
.beltlabel{font-family:var(--pix);font-size:9px;color:#c8b6ff;letter-spacing:.6px}
.belthint{font-size:10.5px;color:var(--dim);margin-left:auto}

/* ---- lists ---- */
.dlist,.mlist{display:flex;flex-direction:column;gap:4px}
.drow{display:flex;align-items:center;gap:7px;padding:5px 8px;border-radius:9px;border:1px solid var(--line);
  background:linear-gradient(90deg,color-mix(in srgb,var(--c) 22%,#151c2c),#151c2c 66%);font-size:12px}
.dball{width:11px;height:11px;border-radius:50%;flex:0 0 auto;
  background:radial-gradient(circle closest-side,#eef3f8 0 38%,#0d1018 38% 57%,transparent 57%),
             linear-gradient(180deg,#d8504a 0 44%,#0d1018 44% 56%,#e7edf5 56% 100%);
  box-shadow:inset 0 0 0 1.5px #0d1018}
.drow img{width:28px;height:28px;object-fit:contain}
.dp,.mp{margin-left:auto;color:var(--gold);font-weight:700;font-size:11.5px}
.mhead{font-family:var(--pix);font-size:8px;letter-spacing:.6px;color:var(--dim);margin:6px 0 1px}
.mrow{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:9px;
  border:1px solid var(--line);background:#151c2c}
.mrow b{font-size:12px;display:block}
.mrow i{font-style:normal;font-size:10.5px;color:var(--dim);display:block;line-height:1.35}

/* ---- side-by-side compare + phone frame ---- */
.three{display:grid;gap:12px;grid-template-columns:1fr}
@media(min-width:760px){ .three{grid-template-columns:repeat(3,1fr)} }
.three .vlabel{font-size:12px;color:var(--muted);font-weight:600;margin-bottom:7px}
.three .vlabel b{color:var(--gold);font-family:var(--pix);font-size:10px;margin-right:6px}
.phonewrap{display:flex;gap:18px;flex-wrap:wrap;align-items:flex-start}
.phone{width:392px;max-width:100%;flex:0 0 auto}
.phone .screen{border-radius:20px;border-width:3px}
.pcap{font-size:11px;color:var(--dim);margin:6px 0 0;text-align:center}

/* ---- table ---- */
.tbl{width:100%;border-collapse:collapse;font-size:13px;margin-top:6px}
.tbl th{text-align:left;font-family:var(--pix);font-size:9px;letter-spacing:.6px;color:var(--dim);
  padding:6px 8px;border-bottom:1px solid var(--line)}
.tbl td{padding:7px 8px;border-bottom:1px solid var(--line);vertical-align:middle}
.tbl td:last-child{color:var(--muted)}
.kind{font-size:10px;border-radius:20px;padding:2px 8px;border:1px solid var(--line2);color:var(--muted)}
.kind.stat{color:#ffb39c;border-color:#5e3a33}
.kind.trigger{color:#9ee0b6;border-color:#245140}
.kind.economy{color:#ffd76a;border-color:#5a4a1e}
</style>

<div class="wrap">
<h1>The Bag, tucked under the PC</h1>
<p class="lede">You were right about the space — the PC shelf is three rows of four while the
Daycare beside it runs six rows, so on a wide screen the PC column ends about 120px short of
its neighbours. That's a free home for four item slots. Here are three ways to sit it there.</p>

<div class="rules">
  <span class="rule on">Item <b>orbits the sprite</b> ✓</span>
  <span class="rule"><b>One</b> held item per pokémon</span>
  <span class="rule">Bag holds <b>4</b></span>
  <span class="rule">Stats <b>and</b> battle triggers</span>
  <span class="rule">Top-bar button parked for <b>later</b></span>
</div>

<section class="opt">
  <h2>The three arrangements, side by side</h2>
  <p class="sub">Only the PC panel differs — everything else on the screen stays exactly as it is now.</p>
  <div class="three">
    <div><div class="vlabel"><b>1</b>Separate tray</div>${pcTray}
      <p class="tiny">Its own heading and its own purple wallpaper under the box. Unmistakably a
      different kind of storage, and the count reads on its own line.</p></div>
    <div><div class="vlabel"><b>2</b>One box, two floors</div>${pcFloors}
      <p class="tiny">One cabinet, gold rule, items on the bottom floor. Tightest of the three and
      the most "PC" — but a glance can read it as four more pokémon slots.</p></div>
    <div><div class="vlabel"><b>3</b>Belt across the base</div>${pcBelt}
      <p class="tiny">A slim strip pinned to the bottom edge. Costs the least height, so the PC
      column still finishes shorter than the Daycare.</p></div>
  </div>
</section>

<section class="opt">
  <h2>In context — the whole shop screen</h2>
  <p class="sub">Same board, the three arrangements swapped in. This is the real column
  proportion (<code>1.05fr 1fr .95fr</code>), so the fit you see here is the fit you'll get.</p>
  <div class="tags"><span class="tag good">no fourth shelf</span><span class="tag good">items live beside the pokémon storage, which is where you'll look for them</span><span class="tag bad">on a phone the shelves stack, so the Bag lands under the PC either way</span></div>
  <div id="ctx">${screen(1, 'ctxscreen')}</div>
  <div class="tags" id="swap" style="margin-top:10px">
    <button class="tag" data-v="1">1 · separate tray</button>
    <button class="tag" data-v="2">2 · two floors</button>
    <button class="tag" data-v="3">3 · belt</button>
  </div>
</section>

<section class="opt">
  <h2>On a phone</h2>
  <p class="sub">At 392px the shelves stack into one column, so the Bag follows the PC down the
  page. Arrangement 1 keeps its label and stays obvious; the belt nearly disappears.</p>
  <div class="phonewrap">
    <div class="phone">${screen(1)}<p class="pcap">1 · separate tray</p></div>
    <div class="phone">${screen(3)}<p class="pcap">3 · belt</p></div>
  </div>
</section>

<section class="opt">
  <h2>The orbit badge up close</h2>
  <p class="sub">Bottom-right of the art box, overlapping the frame, with a dark ring so it reads
  against any type colour. It sits outside the sprite's square, so nothing had to shrink.</p>
  <div class="three">
    <div>${card('wartortle','band')}</div>
    <div>${card('onix','coat')}</div>
    <div>${card('gengar','coin')}</div>
  </div>
  <p class="tiny">Tapping the badge takes the item off and drops it back in the Bag. If the Bag is
  full, the swap is refused and the message box says so.</p>
</section>

<section class="opt">
  <h2>Ten candidate held items</h2>
  <p class="sub">Emoji are placeholders — drop <code>muscle-band.png</code>, <code>sitrus-berry.png</code>
  and friends into <code>Desktop\\Sprites</code> and the build picks them up.</p>
  ${itemTable}
</section>
</div>

<script>
(function(){
  var ctx = document.getElementById('ctx');
  var screens = { 1: ctx.innerHTML };
  var swap = document.getElementById('swap');
  var cache = ${JSON.stringify({1: screen(1,'ctxscreen'), 2: screen(2,'ctxscreen'), 3: screen(3,'ctxscreen')})};
  swap.addEventListener('click', function(e){
    var b = e.target.closest('button[data-v]'); if(!b) return;
    swap.querySelectorAll('button').forEach(function(x){ x.classList.remove('good'); });
    b.classList.add('good');
    ctx.innerHTML = cache[b.dataset.v];
  });
  swap.querySelector('button').classList.add('good');
})();
</script>
`;

fs.writeFileSync('artifact-bag.html', html);
console.log('bag layout page written,', Math.round(html.length/1024), 'KB');
