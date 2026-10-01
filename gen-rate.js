/* Ideas for showing a pokémon's RATE outside a fight.
   Built from the real engine and the real sprites so the spacing is honest. */
const E = require('./engine.js');
const fs = require('fs');

const SPRITES = new Function(fs.readFileSync('sprites.js','utf8') + '; return SPRITES;')();
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const S   = id => E.SPECIES[id];
const col = id => E.TYPES[S(id).type].color;
const img = (id, cls) => `<img class="s ${cls||''}" src="${SPRITES[id]}" alt="${esc(S(id).name)}">`;

/* A believable mid-run party: a fast glass cannon, a wall, and some middle. */
const PARTY = ['pikachu','alakazam','wartortle','machoke','onix','snorlax'];
const unit = id => { const u = E.makeUnit(id, 0); u.hp += 34; u.atk += 22; u.spd += 14; return u; };
const TEAM = PARTY.map(unit);
const spdOf = u => E.effSpd(u);
const avgSpd = TEAM.reduce((n,u) => n + spdOf(u), 0) / TEAM.length;

/* The same forward walk of the clock the battle uses, so the shop preview and
   the battle strip cannot disagree. */
function queue(team, n){
  const Q = E.TUNING.atbQuantum;
  const q = team.map(u => ({ u, at: Q / Math.max(1, spdOf(u)) }));
  const out = [];
  while(out.length < n){
    q.sort((a,b) => a.at - b.at || spdOf(b.u) - spdOf(a.u));
    out.push(q[0].u);
    q[0].at += Q / Math.max(1, spdOf(q[0].u));
  }
  return out;
}

const rate = u => spdOf(u) / avgSpd;
const PACE = [[0.75,'Sluggish','p1'],[0.95,'Steady','p2'],[1.2,'Brisk','p3'],[Infinity,'Blistering','p4']];
const paceOf = u => PACE.find(([lim]) => rate(u) < lim);

/* ---------- A. the battle queue, in the shop ---------- */
const queueStrip = (team, n = 8, mark = null) => `<div class="queue">
  <span class="qlbl">Order</span>
  ${queue(team, n).map((u, i) => `<span class="qmon ${u === mark ? 'hl' : ''} ${i===0?'now':''}"
    title="${esc(u.nm)} · ${spdOf(u)} speed">${img(u.id,'q')}</span>`).join('')}
  <span class="qmore">…</span></div>`;

const optA = `
<div class="panel">
  <h3>Your party <span class="dim">— the order they'll act in</span></h3>
  <div class="form">${TEAM.map(u => card(u)).join('')}</div>
  ${queueStrip(TEAM)}
</div>`;

function card(u, extra){
  return `<div class="pcard" style="--c:${col(u.id)}">
    <div class="cart">${img(u.id)}</div>
    <b class="cname">${esc(u.nm)}</b>
    <div class="cstats"><span class="a">◆${E.effAtk(u)}</span><span class="h">♥${E.effHp(u)}</span>
      <span class="p">»${spdOf(u)}</span></div>
    ${extra || ''}</div>`;
}

/* ---------- B. a rate line in the summary ---------- */
const bar = (label, v, max, colour, ticks) => `<div class="sb"><label>${label}</label>
  <i class="sbar"><u style="width:${Math.min(100, Math.round(v/max*100))}%;background:${colour}"></u>
  ${(ticks||[]).map(t => `<b class="tick" style="left:${Math.min(100, t/max*100)}%"></b>`).join('')}
  </i><b>${v}</b></div>`;

const summaryFor = (u, extra) => `<div class="pop">
  <div class="pophead"><div class="popart" style="--tcol:${col(u.id)}">${img(u.id)}</div>
    <div><div class="popname">${esc(u.nm)}</div>
      <span class="poptype" style="background:${col(u.id)}">${S(u.id).type}</span></div></div>
  <div class="popbars">
    ${bar('HP', E.effHp(u), 70, 'var(--hp)')}
    ${bar('ATK', E.effAtk(u), 70, 'var(--atk)')}
    ${bar('SPD', spdOf(u), 98, 'var(--spd)', extra === 'ticks' ? TEAM.filter(x=>x!==u).map(spdOf) : null)}
  </div>
  ${extra === 'line' ? `<div class="rateline">
    <span class="pacechip ${paceOf(u)[2]}">${paceOf(u)[1]}</span>
    <span>Acts <b>${rate(u).toFixed(2)}×</b> as often as your party average</span></div>` : ''}
  ${extra === 'ticks' ? `<p class="tinynote">The marks are your other party members' speeds.</p>` : ''}
</div>`;

/* ---------- D. pace chevrons on the card ---------- */
const chevrons = u => {
  const n = Math.max(1, Math.min(5, Math.round(rate(u) * 3)));
  return `<div class="chev" title="${paceOf(u)[1]} — ${rate(u).toFixed(2)}× party average">
    ${'<i></i>'.repeat(n)}${'<i class="off"></i>'.repeat(5 - n)}</div>`;
};

/* ---------- E. the pulse ---------- */
const pulseCard = u => {
  const secs = (2.2 / rate(u)).toFixed(2);
  return `<div class="pcard pulse" style="--c:${col(u.id)};--beat:${secs}s">
    <div class="cart">${img(u.id)}<span class="ring"></span></div>
    <b class="cname">${esc(u.nm)}</b>
    <div class="cstats"><span class="p">»${spdOf(u)}</span></div></div>`;
};

/* ---------- F. the Daycare row, at buying time ---------- */
const dcRow = id => {
  const u = unit(id);
  const faster = TEAM.filter(x => spdOf(x) > spdOf(u)).length;
  return `<div class="drow" style="--c:${col(id)}">
    ${img(id,'d')}
    <div class="dmain"><b>${esc(u.nm)}</b>
      <span class="dsub">would be your <b>${['fastest','2nd fastest','3rd fastest','4th fastest',
        '5th fastest','slowest'][faster]}</b> · ${rate(u).toFixed(2)}× party pace</span></div>
    <span class="dp">3₽</span></div>`;
};

const html = `<title>PokéBattler Rate Ideas</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Silkscreen:wght@400;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<style>
:root{
  --bg:#0f1420; --panel:#1c2437; --panel2:#232d44; --line:#2e3a55; --line2:#3d4b6b;
  --text:#e8edf7; --muted:#93a0bd; --dim:#65718f;
  --gold:#ffc447; --hp:#5ad17a; --atk:#ff7a5c; --spd:#6fc3ff; --info:#5aa9ff;
  --pix:'Silkscreen',ui-monospace,monospace; --body:'IBM Plex Sans',system-ui,sans-serif;
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font-family:var(--body);line-height:1.55}
.wrap{max-width:1060px;margin:0 auto;padding:26px 16px 70px}
h1{font-family:var(--pix);font-size:clamp(18px,3.4vw,26px);margin:0 0 10px;color:var(--gold)}
.lede{color:var(--muted);max-width:70ch;margin:0 0 6px;font-size:15px}
.opt{margin-top:36px;border-top:1px solid var(--line);padding-top:18px}
.opt h2{font-family:var(--pix);font-size:13.5px;letter-spacing:.6px;margin:0 0 5px}
.opt .sub{color:var(--muted);font-size:13.5px;margin:0 0 12px;max-width:72ch}
.tags{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 12px}
.tag{font-size:10.5px;border:1px solid var(--line2);color:var(--muted);border-radius:20px;padding:2px 9px}
.tag.good{color:#7de0aa;border-color:#245140}
.tag.bad{color:#ff9d9d;border-color:#5e2d33}
.dim{color:var(--dim);font-weight:400;font-size:11.5px}
.tinynote{font-size:11px;color:var(--dim);margin:7px 0 0}
img.s{image-rendering:pixelated;display:block}

.panel{background:var(--panel);border:1px solid var(--line2);border-radius:12px;padding:11px}
.panel h3{font-family:var(--pix);font-size:10px;letter-spacing:.7px;color:var(--muted);margin:0 0 9px}
.form{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}
@media(min-width:720px){ .form{grid-template-columns:repeat(6,1fr)} }
.pcard{background:linear-gradient(180deg,var(--panel2),#1a2135);border:1px solid var(--line2);
  border-radius:11px;padding:6px 3px 5px;display:flex;flex-direction:column;align-items:center;
  gap:2px;min-height:104px}
.cart{width:48px;height:48px;display:flex;align-items:center;justify-content:center;position:relative;
  border-radius:9px;background:color-mix(in srgb,var(--c) 22%,#151c2c);
  border:1px solid color-mix(in srgb,var(--c) 45%,#151c2c)}
.cart img{width:40px;height:40px;object-fit:contain}
.cname{font-size:11.5px}
.cstats{display:flex;gap:5px;font-size:10px;font-weight:700}
.cstats .a{color:var(--atk)} .cstats .h{color:var(--hp)} .cstats .p{color:var(--spd)}

/* A — the queue */
.queue{display:flex;align-items:center;gap:5px;margin-top:10px;padding:7px 10px;background:#151c2c;
  border:1px solid var(--line2);border-radius:11px;overflow-x:auto}
.qlbl{font-size:9px;letter-spacing:1.1px;text-transform:uppercase;color:var(--muted);font-weight:bold;flex:0 0 auto}
.qmon{width:34px;height:34px;border-radius:9px;flex:0 0 auto;display:flex;align-items:center;
  justify-content:center;background:#10141f;border:1px solid var(--line2)}
.qmon img{width:27px;height:27px;object-fit:contain}
.qmon.now{box-shadow:0 0 0 2px var(--gold)}
.qmon.hl{border-color:var(--spd);background:rgba(111,195,255,.16)}
.qmore{color:var(--dim);font-size:13px}

/* B / C — the summary */
.pops{display:grid;gap:12px;grid-template-columns:1fr}
@media(min-width:680px){ .pops{grid-template-columns:repeat(2,minmax(0,1fr))} }
.pop{background:var(--panel);border:1px solid var(--line2);border-radius:12px;padding:12px;max-width:320px}
.pophead{display:flex;gap:10px;align-items:center}
.popart{width:58px;height:58px;border-radius:10px;display:flex;align-items:center;justify-content:center;
  background:#10141f;border:2px solid var(--tcol)}
.popart img{width:48px;height:48px;object-fit:contain}
.popname{font-size:15px;font-weight:bold}
.poptype{font-size:9.5px;font-weight:bold;color:#10131a;border-radius:5px;padding:1px 7px}
.popbars{display:flex;flex-direction:column;gap:5px;margin-top:10px}
.sb{display:grid;grid-template-columns:28px 1fr 30px;gap:7px;align-items:center}
.sb label{font-size:8.5px;letter-spacing:.7px;color:var(--muted);font-weight:bold}
.sb > b{text-align:right;font-size:11px;font-variant-numeric:tabular-nums}
.sbar{display:block;height:7px;border-radius:4px;background:#0c1018;position:relative}
.sbar u{display:block;height:100%;text-decoration:none;border-radius:4px}
.tick{position:absolute;top:-3px;width:2px;height:13px;background:rgba(255,255,255,.55);border-radius:1px}
.rateline{display:flex;align-items:center;gap:8px;margin-top:10px;padding-top:9px;
  border-top:1px solid var(--line);font-size:12px;color:var(--muted);flex-wrap:wrap}
.rateline b{color:var(--text)}
.pacechip{font-size:9.5px;font-weight:bold;letter-spacing:.4px;border-radius:20px;padding:2px 9px;
  border:1px solid var(--line2)}
.pacechip.p1{color:#8fa0c4} .pacechip.p2{color:#9ee0b6;border-color:#245140}
.pacechip.p3{color:#7dc4ff;border-color:#24446e} .pacechip.p4{color:var(--gold);border-color:#5a4a1e}

/* D — chevrons */
.chev{display:flex;gap:2px;margin-top:2px}
.chev i{width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;
  border-bottom:6px solid var(--spd);display:block}
.chev i.off{border-bottom-color:#2b3450}

/* E — the pulse */
.pcard.pulse .ring{position:absolute;inset:-4px;border-radius:12px;border:2px solid var(--spd);
  opacity:0;animation:beat var(--beat) ease-out infinite}
@keyframes beat{ 0%{opacity:.9;transform:scale(.9)} 70%{opacity:0;transform:scale(1.15)} 100%{opacity:0} }
@media (prefers-reduced-motion:reduce){ .pcard.pulse .ring{animation:none;opacity:.35} }
.pulserow{display:flex;gap:10px;flex-wrap:wrap}
.pulserow .pcard{width:110px}

/* F — the daycare row */
.dlist{display:flex;flex-direction:column;gap:5px;max-width:420px}
.drow{display:flex;align-items:center;gap:9px;padding:6px 9px;border-radius:9px;border:1px solid var(--line);
  background:linear-gradient(90deg,color-mix(in srgb,var(--c) 20%,#151c2c),#151c2c 66%)}
.drow img{width:30px;height:30px;object-fit:contain}
.dmain b{font-size:12.5px;display:block}
.dsub{font-size:10.5px;color:var(--dim)}
.dsub b{display:inline;color:var(--spd);font-size:10.5px}
.dp{margin-left:auto;color:var(--gold);font-weight:700;font-size:11.5px}
</style>

<div class="wrap">
<h1>Showing a pokémon's rate</h1>
<p class="lede">Speed now decides <b>how often</b> a pokémon acts, and the battle shows that with the
Next strip. Outside a fight there is nothing — a card says <b>»60</b> and you have to know the roster to
know what that means. Six ways to fix it, all drawn with the real party below and the real clock.</p>

<div class="panel" style="margin-top:14px">
  <h3>The party these mockups use</h3>
  <div class="form">${TEAM.map(u => card(u)).join('')}</div>
  <p class="tinynote">Party average speed: ${avgSpd.toFixed(0)}. Pikachu runs at
  ${rate(TEAM[0]).toFixed(2)}× that, Snorlax at ${rate(TEAM[5]).toFixed(2)}×.</p>
</div>

<section class="opt">
  <h2>A · The same queue, in the shop</h2>
  <p class="sub">The battle's Next strip, built from your party alone, sitting under the formation. You
  see Pikachu twice before Snorlax once — the same picture the fight will show you, so there is one
  visual language instead of two.</p>
  <div class="tags"><span class="tag good">teaches the battle UI</span><span class="tag good">no numbers to interpret</span><span class="tag good">reuses code already written</span><span class="tag bad">another strip on a crowded screen</span></div>
  ${optA}
</section>

<section class="opt">
  <h2>B · A rate line in the summary</h2>
  <p class="sub">One sentence under the bars, in the place you already go to compare two pokémon.</p>
  <div class="tags"><span class="tag good">exact and unambiguous</span><span class="tag good">costs no space on the board</span><span class="tag bad">only visible on hover/tap</span></div>
  <div class="pops">
    ${summaryFor(TEAM[0], 'line')}
    ${summaryFor(TEAM[5], 'line')}
  </div>
</section>

<section class="opt">
  <h2>C · Marks on the speed bar</h2>
  <p class="sub">The bar answers "fast compared to what?" by drawing your other party members on it.
  Same idea as B but spatial, and it shows the whole spread rather than one ratio.</p>
  <div class="tags"><span class="tag good">shows the spread, not just a number</span><span class="tag good">no extra rows</span><span class="tag bad">fiddly at phone size</span><span class="tag bad">meaningless with one pokémon</span></div>
  <div class="pops">
    ${summaryFor(TEAM[0], 'ticks')}
    ${summaryFor(TEAM[3], 'ticks')}
  </div>
</section>

<section class="opt">
  <h2>D · Pace chevrons on the card</h2>
  <p class="sub">Three to five chevrons under the stats, bucketed against your party average. Readable
  at card size, on the board, without opening anything.</p>
  <div class="tags"><span class="tag good">always visible</span><span class="tag good">survives phone width</span><span class="tag bad">buckets hide small differences</span></div>
  <div class="panel"><div class="form">${TEAM.map(u => card(u, chevrons(u))).join('')}</div></div>
</section>

<section class="opt">
  <h2>E · The card pulses at its rate</h2>
  <p class="sub">No numbers at all — a ring flashes on each card at the speed that pokémon acts. You
  feel the difference rather than reading it.</p>
  <div class="tags"><span class="tag good">instantly understood</span><span class="tag good">genuinely charming</span><span class="tag bad">six things blinking is a lot</span><span class="tag bad">needs a reduced-motion path</span></div>
  <div class="pulserow">${[TEAM[0], TEAM[2], TEAM[5]].map(pulseCard).join('')}</div>
  <p class="tinynote">Pikachu, Wartortle and Snorlax, pulsing in proportion. Reduced-motion turns the
  ring static.</p>
</section>

<section class="opt">
  <h2>F · Rate at the moment you buy</h2>
  <p class="sub">The Daycare row answers the question you actually have while shopping: where would this
  one slot into my team?</p>
  <div class="tags"><span class="tag good">right where the decision is</span><span class="tag good">plain language</span><span class="tag bad">only helps in the Daycare</span></div>
  <div class="dlist">${['scyther','geodude','electabuzz'].map(dcRow).join('')}</div>
</section>

<section class="opt">
  <h2>What I'd ship</h2>
  <p class="sub"><b>A + F</b>, with <b>B</b> as the detail. The queue in the shop makes the battle
  legible in advance and costs nothing to learn because it is the same strip; the Daycare line answers
  the buying question in words; and the summary carries the exact ratio for anyone who wants it.
  C duplicates B in less space than it needs, D loses the precision that makes the queue useful, and
  E is lovely but six blinking cards is a lot to sit under while you shop.</p>
</section>
</div>
`;

fs.writeFileSync('artifact-rate.html', html);
console.log('rate ideas page written,', Math.round(html.length/1024), 'KB');
