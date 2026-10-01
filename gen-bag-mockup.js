/* Held-item HUD brainstorm page. Real sprites and real species data so the
   layouts are honest about how much room a held item actually needs. */
const E = require('./engine.js');
const fs = require('fs');

const SPRITES = new Function(fs.readFileSync('sprites.js','utf8') + '; return SPRITES;')();
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const S   = id => E.SPECIES[id];
const col = id => E.TYPES[S(id).type].color;
const img = (id, cls) => `<img class="s ${cls||''}" src="${SPRITES[id]}" alt="${esc(S(id).name)}">`;

/* the party used in every mockup, in formation order (front rank last) */
const PARTY = ['wartortle','pikachu','machoke','onix','butterfree','gengar'];

/* candidate held items — one per pokémon, stats and battle triggers */
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

/* ---------------- the party card, in three badge treatments -------------- */
function card(id, heldId, style, extra){
  const s = S(id), h = heldId ? H[heldId] : null;
  const badge =
    style === 'corner' ? (h ? `<span class="cbadge">${tile(h)}</span>` : '')
  : style === 'socket' ? `<span class="csocket ${h?'':'open'}">${tile(h)}</span>`
  : style === 'ring'   ? (h ? `<span class="cring">${tile(h)}</span>` : '')
  : '';
  return `<div class="pcard ${style} ${extra||''}" style="--c:${col(id)}">
    <div class="cart">${img(id)}${style==='ring'?badge:''}</div>
    <b class="cname">${esc(s.name)}</b>
    <div class="cstats"><span class="a">◆${s.atk}</span><span class="h">♥${s.hp}</span><span class="p">»${s.spd}</span></div>
    ${style==='ring'?'':badge}
  </div>`;
}

const formation = (style, held) => `<div class="form">
  ${[4,2,0,5,3,1].map((i,n) => card(PARTY[i], held[i], style)).join('')}
</div>`;

/* ================= LAYOUT A — the Bag as a fourth shelf ================== */
const bagCells = ['band','sitrus',null,'coin'].map((id,i) =>
  `<button class="bcell" data-item="${id||''}">${tile(id?H[id]:null)}</button>`).join('');

const layoutA = `
<div class="screen">
  <div class="panel">
    <h3>YOUR PARTY <span class="hint">the front rank takes the hits · fastest acts first</span></h3>
    ${formation('corner', {0:'band',1:null,2:'sitrus',3:null,4:null,5:'coin'})}
  </div>
  <div class="shelves four">
    <div class="panel sm">
      <h3>PC <span class="hint">4/12</span></h3>
      <div class="wall">${['charmeleon','staryu','geodude','vulpix'].map(id=>`<span class="wcell">${img(id,'w')}</span>`).join('')}
        ${Array.from({length:8},()=>'<span class="wcell empty"></span>').join('')}</div>
    </div>
    <div class="panel sm bagpanel">
      <h3>BAG <span class="hint">3/4 held items</span></h3>
      <div class="wall bag">${bagCells}</div>
      <p class="tiny">Tap an item, then tap a pokémon to give it. Tap the badge on a card to take it back.</p>
    </div>
    <div class="panel sm">
      <h3>DAYCARE <span class="hint">3₽</span></h3>
      <div class="dlist">${['squirtle','machop','dratini'].map(id=>`<div class="drow" style="--c:${col(id)}"><span class="dball"></span>${img(id,'d')}<b>${S(id).name}</b><span class="dp">3₽</span></div>`).join('')}</div>
    </div>
    <div class="panel sm">
      <h3>POKÉMART <span class="hint">tier 4</span></h3>
      <div class="mlist">
        <div class="mhead">HELD — STAYS ON UNTIL YOU MOVE IT</div>
        ${['lefto','focus'].map(k=>`<div class="mrow">${tile(H[k])}<div><b>${H[k].n}</b><i>${H[k].t}</i></div><span class="mp">4₽</span></div>`).join('')}
        <div class="mhead">MEDICINE — USE NOW</div>
        <div class="mrow"><span class="itile" style="--ic:#ff7a5c"><i>💊</i></span><div><b>Protein</b><i>+3 Attack, permanently.</i></div><span class="mp">3₽</span></div>
      </div>
    </div>
  </div>
</div>`;

/* ================= LAYOUT B — the belt under the party ================== */
const layoutB = `
<div class="screen">
  <div class="panel">
    <h3>YOUR PARTY</h3>
    ${formation('corner', {0:'band',1:'claw',2:'sitrus',3:null,4:null,5:null})}
    <div class="belt">
      <span class="beltlabel">BAG</span>
      ${['lefto','coin',null,null].map(id=>`<button class="bcell sm">${tile(id?H[id]:null)}</button>`).join('')}
      <span class="belthint">drag onto a pokémon</span>
    </div>
  </div>
  <div class="shelves three">
    <div class="panel sm"><h3>PC <span class="hint">4/12</span></h3>
      <div class="wall">${['charmeleon','staryu','geodude','vulpix'].map(id=>`<span class="wcell">${img(id,'w')}</span>`).join('')}
      ${Array.from({length:8},()=>'<span class="wcell empty"></span>').join('')}</div></div>
    <div class="panel sm"><h3>DAYCARE</h3>
      <div class="dlist">${['squirtle','machop','dratini'].map(id=>`<div class="drow" style="--c:${col(id)}"><span class="dball"></span>${img(id,'d')}<b>${S(id).name}</b><span class="dp">3₽</span></div>`).join('')}</div></div>
    <div class="panel sm"><h3>POKÉMART</h3>
      <div class="mlist">${['band','sitrus','egg'].map(k=>`<div class="mrow">${tile(H[k])}<div><b>${H[k].n}</b><i>${H[k].t}</i></div><span class="mp">4₽</span></div>`).join('')}</div></div>
  </div>
</div>`;

/* ================= LAYOUT C — sockets + a bag button ==================== */
const layoutC = `
<div class="screen">
  <div class="topbar">
    <span class="chip">TURN 7</span><span class="chip gold">₽ 12</span>
    <span class="chip">LIVES ♥♥♥</span>
    <button class="chip bagbtn">🎒 BAG <b>3</b>/4</button>
  </div>
  <div class="panel">
    <h3>YOUR PARTY <span class="hint">every slot has a socket</span></h3>
    ${formation('socket', {0:'band',1:null,2:'sitrus',3:'coat',4:null,5:null})}
  </div>
  <div class="bagpop">
    <div class="popttl">BAG <span class="x">✕</span></div>
    <div class="wall bag wide">${['band','sitrus','coat',null].map(id=>`<button class="bcell">${tile(id?H[id]:null)}</button>`).join('')}</div>
    <p class="tiny">Opens over the board from the top bar. Nothing permanent on screen, but giving an item is two taps plus an open.</p>
  </div>
</div>`;

/* ================= LAYOUT D — one storage panel, two tabs =============== */
const layoutD = `
<div class="screen">
  <div class="panel">
    <h3>YOUR PARTY</h3>
    ${formation('ring', {0:'band',1:null,2:'sitrus',3:null,4:'focus',5:null})}
  </div>
  <div class="shelves three">
    <div class="panel sm">
      <div class="tabs"><button class="tab on">POKÉMON <i>4/12</i></button><button class="tab">ITEMS <i>3/4</i></button></div>
      <div class="wall">${['charmeleon','staryu','geodude','vulpix'].map(id=>`<span class="wcell">${img(id,'w')}</span>`).join('')}
        ${Array.from({length:8},()=>'<span class="wcell empty"></span>').join('')}</div>
    </div>
    <div class="panel sm">
      <div class="tabs"><button class="tab">POKÉMON <i>4/12</i></button><button class="tab on">ITEMS <i>3/4</i></button></div>
      <div class="wall bag tall">${['band','sitrus','coat',null].map(id=>`<button class="bcell">${tile(id?H[id]:null)}</button>`).join('')}</div>
      <p class="tiny">The same shelf, flipped. One box, two pockets — exactly how the games do it.</p>
    </div>
    <div class="panel sm"><h3>POKÉMART</h3>
      <div class="mlist">${['claw','lefto','evio'].map(k=>`<div class="mrow">${tile(H[k])}<div><b>${H[k].n}</b><i>${H[k].t}</i></div><span class="mp">4₽</span></div>`).join('')}</div></div>
  </div>
</div>`;

/* ================= badge treatments side by side ======================== */
const badges = `
<div class="badgerow">
  <div class="bcol"><div class="blabel">Corner badge</div>${card('wartortle','band','corner')}
    <p class="tiny">Smallest footprint, reads at a glance, never moves the card. Can collide with the level badge.</p></div>
  <div class="bcol"><div class="blabel">Socket under the stats</div>${card('wartortle','band','socket')}
    <p class="tiny">Always visible, even empty — so you can see who has a free slot. Costs ~18px of card height.</p></div>
  <div class="bcol"><div class="blabel">Orbiting the sprite</div>${card('wartortle','band','ring')}
    <p class="tiny">Most "pokémon holding something". Overlaps the art, so it needs the sprite shrunk a touch.</p></div>
</div>`;

/* ================= the item table ======================================= */
const itemTable = `
<table class="tbl">
  <thead><tr><th></th><th>Item</th><th>Kind</th><th>Effect</th></tr></thead>
  <tbody>${HELD.map(h => `<tr><td>${tile(h)}</td><td><b>${h.n}</b></td>
    <td><span class="kind ${h.k}">${h.k}</span></td><td>${h.t}</td></tr>`).join('')}</tbody>
</table>`;

const html = `<title>PokéBattler Held Items</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Silkscreen:wght@400;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<style>
:root{
  --bg:#0f1420; --panel:#1c2437; --panel2:#232d44; --line:#2e3a55; --line2:#3d4b6b;
  --text:#e8edf7; --muted:#93a0bd; --dim:#65718f;
  --gold:#ffc447; --hp:#5ad17a; --atk:#ff7a5c; --spd:#6fc3ff; --info:#5aa9ff;
  --pix:'Silkscreen',ui-monospace,monospace;
  --body:'IBM Plex Sans',system-ui,sans-serif;
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font-family:var(--body);line-height:1.5}
.wrap{max-width:1080px;margin:0 auto;padding:26px 16px 70px}
h1{font-family:var(--pix);font-size:clamp(19px,3.6vw,27px);margin:0 0 10px;color:var(--gold);letter-spacing:.5px}
.lede{color:var(--muted);max-width:68ch;margin:0 0 10px;font-size:15px}
.rules{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0 0}
.rule{font-size:12px;border:1px solid var(--line2);border-radius:8px;padding:6px 10px;color:var(--muted);background:var(--panel)}
.rule b{color:var(--text)}
.opt{margin-top:38px;border-top:1px solid var(--line);padding-top:18px}
.opt h2{font-family:var(--pix);font-size:14px;letter-spacing:.6px;margin:0 0 5px}
.opt .sub{color:var(--muted);font-size:13.5px;margin:0 0 12px;max-width:72ch}
.tags{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 14px}
.tag{font-size:10.5px;border:1px solid var(--line2);color:var(--muted);border-radius:20px;padding:2px 9px}
.tag.good{color:#7de0aa;border-color:#245140}
.tag.bad{color:#ff9d9d;border-color:#5e2d33}
img.s{image-rendering:pixelated;display:block}

/* ---- shared game chrome ---- */
.screen{background:#121828;border:1px solid var(--line);border-radius:14px;padding:12px;display:grid;gap:10px}
.panel{background:var(--panel);border:1px solid var(--line2);border-radius:12px;padding:10px}
.panel h3{font-family:var(--pix);font-size:10.5px;letter-spacing:.7px;color:var(--muted);
  margin:0 0 9px;display:flex;align-items:center;gap:8px}
.hint{font-family:var(--body);font-weight:400;letter-spacing:0;color:var(--dim);font-size:11px}
.shelves{display:grid;gap:10px;grid-template-columns:1fr}
@media(min-width:860px){
  .shelves.three{grid-template-columns:1.05fr 1fr .95fr}
  .shelves.four{grid-template-columns:1fr .62fr .9fr 1.05fr}
}
.tiny{font-size:11px;color:var(--dim);margin:8px 0 0;line-height:1.45}

/* ---- party formation ---- */
.form{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}
.pcard{background:linear-gradient(180deg,var(--panel2),#1a2135);border:1px solid var(--line2);
  border-radius:11px;padding:5px 3px 4px;display:flex;flex-direction:column;align-items:center;
  gap:2px;position:relative;min-height:104px}
.cart{width:46px;height:46px;display:flex;align-items:center;justify-content:center;position:relative;
  border-radius:9px;background:color-mix(in srgb,var(--c) 22%,#151c2c);border:1px solid color-mix(in srgb,var(--c) 45%,#151c2c)}
.cart img{width:40px;height:40px;object-fit:contain}
.cname{font-size:11.5px}
.cstats{display:flex;gap:5px;font-size:10px;font-weight:700}
.cstats .a{color:var(--atk)} .cstats .h{color:var(--hp)} .cstats .p{color:var(--spd)}
.cbadge{position:absolute;top:3px;right:3px}
.csocket{margin-top:2px;display:block}
.csocket.open .itile{opacity:.45}
.cring{position:absolute;right:-6px;bottom:-4px}

/* ---- the item tile ---- */
.itile{width:22px;height:22px;border-radius:7px;display:inline-flex;align-items:center;justify-content:center;
  background:color-mix(in srgb,var(--ic,#5aa9ff) 26%,#0f1420);
  border:1px solid color-mix(in srgb,var(--ic,#5aa9ff) 60%,#0f1420);font-style:normal;font-size:12px;line-height:1}
.itile i{font-style:normal}
.itile.empty{background:#141a29;border:1px dashed var(--line2)}
.itile.big{width:30px;height:30px;font-size:16px;border-radius:9px}

/* ---- boxes ---- */
.wall{display:grid;grid-template-columns:repeat(4,1fr);gap:2px;padding:8px;border-radius:9px;
  background:#16324a;
  background-image:radial-gradient(circle at 50% 50%, rgba(255,255,255,.07) 2px, transparent 2px),
    linear-gradient(180deg,#1b3a54,#13293d);
  background-size:20px 20px,100% 100%}
.wall.bag{grid-template-columns:repeat(4,1fr);
  background-image:radial-gradient(circle at 50% 50%, rgba(255,214,106,.09) 2px, transparent 2px),
    linear-gradient(180deg,#3a3050,#241f38)}
.wall.bag.tall{grid-template-columns:repeat(2,1fr)}
.wcell,.bcell{min-height:46px;border:0;background:transparent;border-radius:8px;cursor:pointer;
  display:flex;align-items:center;justify-content:center;position:relative;padding:3px}
.wcell img{width:34px;height:34px;object-fit:contain}
.wcell.empty::before{content:'';width:16px;height:16px;border-radius:50%;opacity:.4;
  background:radial-gradient(circle closest-side,#eef3f8 0 38%,#0d1018 38% 57%,transparent 57%),
             linear-gradient(180deg,#d8504a 0 44%,#0d1018 44% 56%,#e7edf5 56% 100%);
  box-shadow:inset 0 0 0 1.5px #0d1018;position:absolute}
.bcell .itile{width:30px;height:30px;font-size:15px}
.bcell.sm .itile{width:26px;height:26px;font-size:13px}
.bcell.on{background:rgba(255,196,71,.18);box-shadow:0 0 0 2px var(--gold) inset}

/* ---- belt ---- */
.belt{display:flex;align-items:center;gap:6px;margin-top:8px;padding:6px 8px;border-radius:10px;
  background:linear-gradient(180deg,#2b2440,#1d1a2c);border:1px solid #453a63}
.beltlabel{font-family:var(--pix);font-size:9.5px;color:#c8b6ff;letter-spacing:.6px}
.belthint{font-size:10.5px;color:var(--dim);margin-left:auto}

/* ---- top bar / popover ---- */
.topbar{display:flex;gap:6px;flex-wrap:wrap}
.chip{font-family:var(--pix);font-size:10px;border:1px solid var(--line2);background:var(--panel);
  color:var(--muted);border-radius:9px;padding:6px 9px}
.chip.gold{color:var(--gold);border-color:#5a4a1e}
.bagbtn{color:#e9dcff;border-color:#5a4a86;background:#2b2440;cursor:pointer}
.bagbtn b{color:#fff}
.bagpop{background:#241f38;border:1px solid #4a3f6e;border-radius:12px;padding:10px;max-width:330px;
  box-shadow:0 14px 34px rgba(0,0,0,.5)}
.popttl{font-family:var(--pix);font-size:10px;color:#c8b6ff;display:flex;justify-content:space-between;margin-bottom:8px}
.x{color:var(--dim)}

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
.mhead{font-family:var(--pix);font-size:8.5px;letter-spacing:.6px;color:var(--dim);margin:6px 0 1px}
.mrow{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:9px;
  border:1px solid var(--line);background:#151c2c}
.mrow b{font-size:12px;display:block}
.mrow i{font-style:normal;font-size:10.5px;color:var(--dim);display:block;line-height:1.35}

/* ---- tabs ---- */
.tabs{display:flex;gap:4px;margin-bottom:8px}
.tab{flex:1;font-family:var(--pix);font-size:9px;letter-spacing:.5px;padding:7px 4px;border-radius:8px 8px 0 0;
  border:1px solid var(--line2);border-bottom:0;background:#151c2c;color:var(--dim);cursor:pointer}
.tab i{font-style:normal;color:var(--line2);margin-left:4px}
.tab.on{background:var(--panel2);color:var(--text)}
.tab.on i{color:var(--gold)}

/* ---- badge comparison ---- */
.badgerow{display:grid;gap:14px;grid-template-columns:1fr}
@media(min-width:680px){ .badgerow{grid-template-columns:repeat(3,1fr)} }
.bcol .pcard{max-width:130px}
.blabel{font-size:11.5px;color:var(--muted);margin-bottom:7px;font-weight:600}

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
<h1>Held items — where does the Bag go?</h1>
<p class="lede">Four places the Bag could live, three ways a held item could show on a
pokémon, and ten candidate items. Everything below is built from the real engine
data and the real sprites, so the spacing is honest.</p>

<div class="rules">
  <span class="rule"><b>One</b> held item per pokémon</span>
  <span class="rule">Bag holds <b>4</b>, like a small PC</span>
  <span class="rule">Items do <b>stats and battle triggers</b></span>
  <span class="rule">Medicine and stones stay, <b>rarer as tiers rise</b></span>
  <span class="rule">Swap and remove <b>any turn, free</b></span>
</div>

<section class="opt">
  <h2>A · The Bag as a fourth shelf</h2>
  <p class="sub">A small 4-cell box sitting between the PC and the Daycare, with its own
  wallpaper so it never reads as pokémon storage. Give an item exactly the way you
  move a pokémon now — tap it, tap a party member — so there's no new interaction to learn.</p>
  <div class="tags"><span class="tag good">reuses the carry cursor</span><span class="tag good">everything visible at once</span><span class="tag bad">four shelves is a lot on a phone</span></div>
  ${layoutA}
  <p class="tiny">Try it: tap an item in the Bag, then tap a party member.</p>
</section>

<section class="opt">
  <h2>B · A belt strapped under the party</h2>
  <p class="sub">The Bag becomes a horizontal strip welded to the bottom of the party panel.
  Items sit inches from the pokémon they're going on, which matters a lot on a phone
  where the shelves are a scroll away.</p>
  <div class="tags"><span class="tag good">shortest possible trip</span><span class="tag good">keeps three shelves</span><span class="tag bad">crowds the party panel</span><span class="tag bad">only fits 4, never more</span></div>
  ${layoutB}
</section>

<section class="opt">
  <h2>C · Sockets on every card, Bag in the top bar</h2>
  <p class="sub">Each party slot draws an item socket whether it's filled or not, so you can
  always see who's got a free hand. The Bag itself is a button up in the HUD that opens a
  popover over the board.</p>
  <div class="tags"><span class="tag good">free slots are obvious</span><span class="tag good">costs no shelf space</span><span class="tag bad">an extra tap every time</span><span class="tag bad">taller party cards</span></div>
  ${layoutC}
</section>

<section class="opt">
  <h2>D · One storage panel, two pockets</h2>
  <p class="sub">The PC grows a tab bar: <b>POKÉMON</b> and <b>ITEMS</b>. Same shelf, same
  box furniture, flip between them. This is closest to how the real games file things,
  and it's the only option that scales if the Bag ever holds more than four.</p>
  <div class="tags"><span class="tag good">no new shelf</span><span class="tag good">room to grow</span><span class="tag bad">can't see both at once</span><span class="tag bad">a tab is easy to forget about</span></div>
  ${layoutD}
</section>

<section class="opt">
  <h2>How the item reads on the card</h2>
  <p class="sub">Independent of where the Bag lives — pick one of these for the party card.</p>
  ${badges}
</section>

<section class="opt">
  <h2>Ten candidate held items</h2>
  <p class="sub">Three flavours: flat <b>stat</b> boosts, in-battle <b>triggers</b>, and
  <b>economy</b> items that pay off between rounds. Triggers are all numeric — no status
  effects, per the combat rules. Emoji are placeholders; drop real sprites in
  <code>Desktop\\Sprites</code> named <code>muscle-band.png</code>, <code>sitrus-berry.png</code>
  and so on and they'll get picked up automatically.</p>
  ${itemTable}
</section>

<section class="opt">
  <h2>What the PokéMart becomes</h2>
  <p class="sub">Two labelled sections on the same shelf: <b>HELD</b> (stays on until you move
  it) above <b>MEDICINE &amp; STONES</b> (use it now, it's gone). Held items appear from tier 2,
  and the medicine share of the roll drops as tiers rise, so late-game rolls are mostly
  held items — which is where the interesting decisions are.</p>
  <div class="tags"><span class="tag">held items cost 4–6₽</span><span class="tag">reserve still works on both</span><span class="tag">selling a pokémon drops its item back in the Bag</span></div>
</section>
</div>

<script>
(function(){
  // Layout A is live so you can feel the two-tap give.
  var bag = document.querySelector('.bagpanel .wall.bag');
  var party = document.querySelector('.screen .form');
  if(!bag || !party) return;
  var held = null;
  bag.addEventListener('click', function(e){
    var b = e.target.closest('.bcell'); if(!b) return;
    if(!b.dataset.item){ return; }
    bag.querySelectorAll('.bcell').forEach(function(c){ c.classList.remove('on'); });
    if(held === b){ held = null; return; }
    b.classList.add('on'); held = b;
  });
  party.addEventListener('click', function(e){
    var card = e.target.closest('.pcard'); if(!card) return;
    var badge = card.querySelector('.cbadge');
    if(!held){
      if(badge){ badge.remove(); }   // tap a badge-bearing card to take the item off
      return;
    }
    var tile = held.querySelector('.itile').cloneNode(true);
    if(badge) badge.remove();
    var wrap = document.createElement('span');
    wrap.className = 'cbadge'; wrap.appendChild(tile);
    card.appendChild(wrap);
    held.innerHTML = '<span class="itile empty"></span>';
    held.dataset.item = '';
    held.classList.remove('on');
    held = null;
  });
})();
</script>
`;

fs.writeFileSync('artifact-bag.html', html);
console.log('bag mockup written,', Math.round(html.length/1024), 'KB');
