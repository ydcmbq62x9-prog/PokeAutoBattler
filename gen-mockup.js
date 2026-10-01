/* Builds the display-style comparison page, using the real sprites and real
   species data so the mockups are honest about how much room things need. */
const E = require('./engine.js');
const fs = require('fs');

const SPRITES = new Function(fs.readFileSync('sprites.js','utf8') + '; return SPRITES;')();
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const img = (id, cls) => `<img class="s ${cls||''}" src="${SPRITES[id]}" alt="${esc(E.SPECIES[id].name)}">`;
const col = id => E.TYPES[E.SPECIES[id].type].color;

const BOX   = ['charmeleon','pikachu','onix','staryu','machop','gastly',
               'lapras','geodude','pidgeotto','magikarp','drowzee','vulpix'];
const SHOP  = ['squirtle','machop','dratini','vulpix','lapras','seel'];

const S = id => E.SPECIES[id];

/* ---------- 1. Storage System: sprites on wallpaper, detail in a panel ---- */
const boxCells = BOX.map((id,i) =>
  `<button class="cell ${i===0?'on':''}" data-id="${id}">${img(id)}</button>`).join('');
const emptyCells = Array.from({length:4}, () => `<span class="cell empty"></span>`).join('');

const storage = `
<div class="demo">
  <div class="pcwin">
    <div class="pctitle"><span class="arw">◀</span><b>BOX 1 — Spares</b><span class="arw">▶</span></div>
    <div class="wall" id="wall">${boxCells}${emptyCells}</div>
    <div class="pcfoot"><span>12 / 12</span><span class="dim">tap a pokémon</span></div>
  </div>
  <div class="summary" id="summary"></div>
</div>`;

/* ---------- 2. Trainer Menu: the party-screen list ---------------------- */
const menuRow = (id, extra) => {
  const s = S(id);
  return `<div class="mrow" style="--c:${col(id)}">
    <span class="mball"></span>
    ${img(id,'m')}
    <div class="mmain">
      <b>${esc(s.name)}</b>
      <span class="mtype" style="background:${col(id)}">${s.type}</span>
    </div>
    <div class="mnums"><span>Lv2</span><i class="bar"><u style="width:72%"></u></i></div>
    ${extra || ''}
  </div>`;
};
const trainerMenu = `
<div class="demo">
  <div class="win">
    <div class="wintitle">PC — 12 stored</div>
    <div class="mlist">${BOX.slice(0,6).map(id => menuRow(id)).join('')}</div>
  </div>
  <div class="win">
    <div class="wintitle">Daycare</div>
    <div class="mlist">${SHOP.slice(0,5).map(id => menuRow(id, '<span class="mprice">3₽</span>')).join('')}</div>
    <div class="msg">A lively <b>Squirtle</b>. It knows Withdraw.<i class="caret">▼</i></div>
  </div>
</div>`;

/* ---------- 3. Battle Cards: type-tinted party cards -------------------- */
const battleCard = (id, price) => {
  const s = S(id);
  return `<div class="bcard" style="--c:${col(id)}">
    <div class="bart">${img(id,'b')}</div>
    <div class="binfo">
      <div class="brow"><b>${esc(s.name)}</b><span class="blv">Lv2</span></div>
      <i class="bar hp"><u style="width:78%"></u></i>
      <div class="bstats"><span>◆${s.atk}</span><span>♥${s.hp}</span><span>»${s.spd}</span></div>
    </div>
    ${price ? `<div class="btag">3₽</div>` : ''}
  </div>`;
};
const battleCards = `
<div class="demo">
  <div class="win">
    <div class="wintitle">PC</div>
    <div class="bgrid">${BOX.slice(0,6).map(id => battleCard(id)).join('')}</div>
  </div>
  <div class="win">
    <div class="wintitle">Daycare</div>
    <div class="bgrid two">${SHOP.slice(0,4).map(id => battleCard(id, true)).join('')}</div>
  </div>
</div>`;

const summaryData = JSON.stringify(Object.fromEntries(BOX.map(id => {
  const s = S(id);
  return [id, { n:s.name, t:s.type, c:col(id), hp:s.hp, atk:s.atk, spd:s.spd,
                mv:s.move.name, tx:s.move.text(1), sp:SPRITES[id],
                weak:E.TYPES[s.type].weak, res:E.TYPES[s.type].resist }];
})));

const html = `<title>PokéBattler Box Styles</title>
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
.wrap{max-width:1040px;margin:0 auto;padding-inline:16px;padding-block:26px 60px}
h1{font-family:var(--pix);font-size:clamp(19px,3.6vw,28px);margin:0 0 8px;letter-spacing:.5px;
   text-wrap:balance;color:var(--gold)}
.lede{color:var(--muted);max-width:66ch;margin:0 0 6px;font-size:15px}
.note{color:var(--dim);font-size:13px;max-width:70ch}

.opt{margin-top:34px;border-top:1px solid var(--line);padding-top:18px}
.opt h2{font-family:var(--pix);font-size:14px;letter-spacing:.6px;margin:0 0 4px;color:var(--text)}
.opt .sub{color:var(--muted);font-size:13.5px;margin:0 0 14px;max-width:70ch}
.tags{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 14px}
.tag{font-size:10.5px;border:1px solid var(--line2);color:var(--muted);
  border-radius:20px;padding:2px 9px}
.tag.good{color:#7de0aa;border-color:#245140}
.tag.bad{color:#ff9d9d;border-color:#5e2d33}

.demo{display:grid;gap:12px;grid-template-columns:1fr}
@media(min-width:780px){ .demo{grid-template-columns:1fr 1fr;align-items:start} }

img.s{image-rendering:pixelated;display:block}

/* ---- 1. storage system ---- */
.pcwin{background:var(--panel);border:1px solid var(--line2);border-radius:12px;overflow:hidden}
.pctitle{display:flex;align-items:center;justify-content:space-between;
  font-family:var(--pix);font-size:11px;padding:8px 12px;
  background:linear-gradient(180deg,#2f3d5e,#243050);border-bottom:1px solid var(--line2)}
.arw{color:var(--muted);font-size:10px}
.wall{display:grid;grid-template-columns:repeat(4,1fr);gap:2px;padding:10px;
  background:#16324a;
  background-image:radial-gradient(circle at 50% 50%, rgba(255,255,255,.07) 2px, transparent 2px),
    linear-gradient(180deg,#1b3a54,#13293d);
  background-size:22px 22px, 100% 100%}
@media(min-width:520px){ .wall{grid-template-columns:repeat(6,1fr)} }
.cell{border:0;background:transparent;padding:6px 2px;cursor:pointer;border-radius:8px;
  display:flex;align-items:center;justify-content:center;min-height:56px;position:relative}
.cell img{width:clamp(34px,9vw,46px);height:clamp(34px,9vw,46px);object-fit:contain}
.cell::after{content:'';position:absolute;bottom:6px;left:50%;transform:translateX(-50%);
  width:56%;height:5px;border-radius:50%;background:rgba(0,0,0,.28)}
.cell.empty{cursor:default}
.cell.empty::before{content:'';width:18px;height:18px;border-radius:50%;
  border:2px dashed rgba(255,255,255,.14)}
.cell.empty::after{display:none}
.cell:hover{background:rgba(255,255,255,.07)}
.cell.on{background:rgba(255,196,71,.16);box-shadow:0 0 0 2px var(--gold) inset}
.cell:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
.pcfoot{display:flex;justify-content:space-between;font-family:var(--pix);font-size:9.5px;
  padding:7px 12px;color:var(--muted);border-top:1px solid var(--line2)}
.pcfoot .dim{color:var(--dim)}

.summary{background:var(--panel);border:1px solid var(--line2);border-radius:12px;padding:14px}
.sumhead{display:flex;gap:12px;align-items:center}
.sumart{width:76px;height:76px;border-radius:10px;flex:0 0 auto;display:flex;
  align-items:center;justify-content:center;background:#10141f;border:2px solid var(--c,#666)}
.sumart img{width:64px;height:64px;object-fit:contain}
.sumname{font-family:var(--pix);font-size:15px}
.sumtype{display:inline-block;font-size:10px;font-weight:600;color:#10131a;
  border-radius:5px;padding:2px 8px;margin-top:5px}
.sumbars{margin-top:12px;display:grid;gap:6px}
.sb{display:grid;grid-template-columns:34px 1fr 30px;gap:8px;align-items:center;font-size:11px}
.sb label{font-family:var(--pix);font-size:9px;color:var(--muted)}
.sb b{text-align:right;font-variant-numeric:tabular-nums;font-size:12px}
.bar{display:block;height:7px;border-radius:4px;background:#0c1018;overflow:hidden}
.bar u{display:block;height:100%;text-decoration:none}
.summove{margin-top:12px;border-top:1px solid var(--line);padding-top:10px}
.summove b{font-family:var(--pix);font-size:11px;color:var(--spd)}
.summove p{margin:4px 0 0;font-size:12.5px;color:var(--muted)}
.summu{margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;font-size:10.5px}
.summu span{border:1px solid var(--line2);border-radius:5px;padding:1px 7px;color:var(--dim)}

/* ---- 2. trainer menu ---- */
.win{background:var(--panel);border:1px solid var(--line2);border-radius:12px;overflow:hidden}
.wintitle{font-family:var(--pix);font-size:10.5px;padding:8px 12px;color:var(--muted);
  background:#202a40;border-bottom:1px solid var(--line2)}
.mlist{padding:7px;display:flex;flex-direction:column;gap:5px}
.mrow{display:flex;align-items:center;gap:9px;padding:6px 9px;border-radius:9px;
  background:linear-gradient(90deg,color-mix(in srgb,var(--c) 22%,#151c2c),#151c2c 62%);
  border:1px solid var(--line);position:relative;cursor:pointer}
.mrow:first-child{border-color:var(--gold);box-shadow:0 0 0 1px var(--gold) inset}
.mball{width:11px;height:11px;border-radius:50%;flex:0 0 auto;
  background:linear-gradient(180deg,#e8564f 0 45%,#f2f2f2 45% 100%);
  border:1.5px solid #14161d}
.mrow img.m{width:36px;height:36px;object-fit:contain;flex:0 0 auto}
.mmain{flex:1;min-width:0}
.mmain b{display:block;font-size:13px}
.mtype{display:inline-block;font-size:9px;font-weight:700;color:#10131a;
  border-radius:4px;padding:1px 6px;margin-top:2px}
.mnums{text-align:right;flex:0 0 66px;font-family:var(--pix);font-size:9px;color:var(--muted)}
.mnums .bar{margin-top:4px}
.mnums .bar u{background:var(--hp)}
.mprice{font-family:var(--pix);font-size:11px;color:var(--gold);flex:0 0 auto;margin-left:4px}
.msg{margin:7px;padding:10px 12px;border:2px solid var(--line2);border-radius:9px;
  background:#101624;font-size:12.5px;color:var(--muted);position:relative}
.msg b{color:var(--text)}
.caret{position:absolute;right:10px;bottom:6px;color:var(--gold);font-size:9px;
  animation:blink 1s steps(2,end) infinite}
@keyframes blink{50%{opacity:0}}

/* ---- 3. battle cards ---- */
.bgrid{display:grid;grid-template-columns:1fr;gap:6px;padding:8px}
@media(min-width:420px){ .bgrid{grid-template-columns:1fr 1fr} .bgrid.two{grid-template-columns:1fr 1fr} }
.bcard{display:flex;align-items:center;gap:8px;padding:7px 9px;border-radius:10px;
  border:1px solid var(--line2);position:relative;
  background:linear-gradient(135deg,color-mix(in srgb,var(--c) 30%,#161d2e),#161d2e 70%)}
.bart{width:44px;height:44px;flex:0 0 auto;display:flex;align-items:center;justify-content:center}
.bart img{width:42px;height:42px;object-fit:contain}
.binfo{flex:1;min-width:0}
.brow{display:flex;justify-content:space-between;align-items:baseline;gap:6px}
.brow b{font-size:12.5px}
.blv{font-family:var(--pix);font-size:9px;color:var(--muted)}
.bcard .bar{margin:4px 0 3px}
.bcard .bar u{background:var(--hp)}
.bstats{display:flex;gap:7px;font-size:10.5px;font-variant-numeric:tabular-nums}
.bstats span:nth-child(1){color:var(--atk)}
.bstats span:nth-child(2){color:var(--hp)}
.bstats span:nth-child(3){color:var(--spd)}
.btag{position:absolute;top:-6px;right:6px;background:var(--gold);color:#22190a;
  font-family:var(--pix);font-size:9px;border-radius:5px;padding:1px 5px}

.verdict{margin-top:36px;border-top:1px solid var(--line);padding-top:16px}
.verdict h2{font-family:var(--pix);font-size:13px;color:var(--gold);margin:0 0 8px}
.verdict p{color:var(--muted);font-size:14px;max-width:72ch}
.verdict b{color:var(--text)}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}
</style>

<div class="wrap">
  <h1>Box Styles</h1>
  <p class="lede">Three ways the PC and Daycare could look, using the real sprites and real stats
  so the spacing is honest. Everything else in the game stays as it is.</p>
  <p class="note">The thing worth noticing first: in the actual games the PC grid shows
  <b>sprites and nothing else</b> — no names, no numbers, no card frames — and all the detail lives in a
  panel for whichever one you've picked. That's the opposite of what we do now, and it's why our
  75px cards had to shrink "Charmeleon" to 7px type to stop it truncating.</p>

  <section class="opt">
    <h2>1 · Storage System</h2>
    <p class="sub">The Gen 3–5 PC screen. Sprites sit straight on a box wallpaper with a soft shadow,
    no frame each. Selecting one fills the summary panel — big art, type, stat bars, its move.
    <b>Click a pokémon to try it.</b></p>
    <div class="tags"><span class="tag good">most like the real PC</span>
      <span class="tag good">no more cramped text</span>
      <span class="tag good">fits 12 easily, could fit 30</span>
      <span class="tag bad">must tap to see stats</span></div>
    ${storage}
  </section>

  <section class="opt">
    <h2>2 · Trainer Menu</h2>
    <p class="sub">The party screen and Mart counter: a list of rows with a pokéball bullet, sprite,
    name, type pill and HP bar, plus the bordered message box with its blinking arrow. The Daycare
    becomes a shop list, matching the PokéMart shelf we already have.</p>
    <div class="tags"><span class="tag good">everything readable at a glance</span>
      <span class="tag good">great on a phone</span>
      <span class="tag good">consistent with the Mart</span>
      <span class="tag bad">a list of 12 gets tall</span></div>
    ${trainerMenu}
  </section>

  <section class="opt">
    <h2>3 · Battle Cards</h2>
    <p class="sub">The modern in-battle party tray: compact cards tinted by type, sprite on the left,
    name, level, HP bar and the three stats. Closest to what the game has now, just dressed properly.</p>
    <div class="tags"><span class="tag good">keeps stats visible</span>
      <span class="tag good">smallest change</span>
      <span class="tag bad">still a wall of cards</span>
      <span class="tag bad">least like a real PC</span></div>
    ${battleCards}
  </section>

  <section class="verdict">
    <h2>What I'd pick</h2>
    <p><b>1 for the PC, 2 for the Daycare.</b> That's what the real games do — the box is a wallpaper
    of sprites you pick from, the shop is a list with a description box — and it happens to solve our
    actual problem, which is that twelve stat-bearing cards don't fit in a narrow shelf. The Daycare
    only ever shows four to six, so a list reads fine there and matches the PokéMart beside it.</p>
    <p style="margin-top:10px">Worth deciding separately: the <b>pixel font</b> used for headings and
    numbers here (Silkscreen). It sells the look instantly but I'd keep body text in the current sans —
    a whole move description in pixel type is rough on a phone.</p>
  </section>
</div>

<script>
(function(){
  var D = ${summaryData};
  var wall = document.getElementById('wall');
  var out = document.getElementById('summary');
  var max = { hp:62, atk:21, spd:130 };
  function draw(id){
    var d = D[id];
    var bar = function(k, c){
      var pctv = Math.round(d[k] / max[k] * 100);
      return '<div class="sb"><label>' + k.toUpperCase() + '</label>' +
        '<i class="bar"><u style="width:' + pctv + '%;background:' + c + '"></u></i>' +
        '<b>' + d[k] + '</b></div>';
    };
    out.innerHTML =
      '<div class="sumhead" style="--c:' + d.c + '">' +
        '<div class="sumart" style="--c:' + d.c + '"><img class="s" src="' + d.sp + '" alt=""></div>' +
        '<div><div class="sumname">' + d.n + '</div>' +
        '<span class="sumtype" style="background:' + d.c + '">' + d.t + '</span></div></div>' +
      '<div class="sumbars">' + bar('hp', 'var(--hp)') + bar('atk', 'var(--atk)') + bar('spd', 'var(--spd)') + '</div>' +
      '<div class="summove"><b>' + d.mv + '</b><p>' + d.tx + '</p></div>' +
      '<div class="summu"><span>weak to ' + d.weak + ' ×2</span>' +
        (d.res ? '<span>resists ' + d.res + ' ×½</span>' : '') + '</div>';
  }
  wall.addEventListener('click', function(e){
    var b = e.target.closest('.cell[data-id]');
    if(!b) return;
    wall.querySelectorAll('.cell').forEach(function(c){ c.classList.remove('on'); });
    b.classList.add('on');
    draw(b.dataset.id);
  });
  draw('${BOX[0]}');
})();
</script>
`;

fs.writeFileSync('artifact-mockup.html', html);
console.log('mockup written,', Math.round(html.length/1024), 'KB');
