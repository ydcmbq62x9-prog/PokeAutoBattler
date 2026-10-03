/* Generates the balance-reference page straight from engine.js, so the
   numbers on the page are always exactly the numbers in the game. */
const E = require('./engine.js');
const fs = require('fs');

const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const SPRITES = fs.existsSync('sprites.js')
  ? new Function(fs.readFileSync('sprites.js','utf8') + '; return SPRITES;')() : {};
const pic = (id, cls) => SPRITES[id]
  ? `<img class="pix ${cls||''}" src="${SPRITES[id]}" alt="">` : '';
const RING = Object.keys(E.TYPES);   // 3.0.0: the 14 real Gen 1 types
const bst = s => s.hp + s.atk + s.spd;
const VERSION = (fs.readFileSync('ui.js','utf8').match(/GAME_VERSION = \{ v:'([^']+)', date:'([^']+)'/) || [,'?','?']);

/* ---------- how the run actually plays, measured with the reference bot ----------
   Shops are seeded now, so this is exactly repeatable: same engine, same numbers. */
const B = require('./botlib.js');
const RUNS = Number(process.env.RUNS || 1000);
const plan = E.runPlan();
const measured = (() => {
  let cleared = 0, reached = 0; const endAt = {}, fell = {};
  for(let r = 0; r < RUNS; r++){
    const out = B.playRun(r * 7 + 1, { reroll:true, bench:4 });
    if(out.cleared) cleared++;
    if(out.g.reached) reached++;
    for(const [k,v] of Object.entries(out.g.fell)) fell[k] = (fell[k]||0) + v;
    if(!out.cleared){ const st = plan[Math.min(out.G.stage || 0, plan.length - 1)];
      const key = st.boss ? st.boss.id : 'trainer'; endAt[key] = (endAt[key]||0) + 1; }
  }
  return { cleared, reached, endAt, fell };
})();
const pctOf = n => Math.round(n / RUNS * 100) + '%';
const RWR = Math.round(RUNS / 2);
const clearWith = reward => { let c = 0;
  for(let r = 0; r < RWR; r++) if(B.playRun(r * 7 + 1, { reroll:true, bench:4, reward }).cleared) c++;
  return c / RWR * 100; };
const noReward = clearWith('none');
const rewardRows = E.BADGE_REWARDS.map(r => {
  const cfg = E.TUNING.badgeRewards[r.id];
  const d = clearWith('only:' + r.id) - noReward;
  return `<tr><td class="nm">${r.icon} ${esc(r.name)}</td><td>${esc(r.text())}</td>
    <td class="n">${cfg.max}</td><td class="n">${d >= 0 ? '+' : ''}${d.toFixed(0)} pt</td></tr>`;
}).join('');

/* ---------- 4.1.0: from here on the tables show every generation (the Gen 1 numbers above were measured on a Gen 1 run) ---------- */
E.setActiveGens(E.GENS_READY);
const GD = {};
for(const [key, file] of [['2', 'gens-2.json'], ['1+2', 'gens-12.json']]) if(fs.existsSync(file)){ try{ GD[key] = JSON.parse(fs.readFileSync(file, 'utf8')); }catch(e){} }

/* ---------- what changed in THIS update (Sean: whenever a balance pass touches a pokémon's stats or moves, show it, for that update only) ----------
   Diffs the live engine against `released-engine.js`, a snapshot of the engine as it was when the PREVIOUS update shipped.
   After an update is published, copy engine.js over released-engine.js so the next sheet starts clean; an update that
   changes no pokémon (a visual fix, say) then simply shows no section. */
const changes = (() => {
  if(!fs.existsSync('released-engine.js')) return null;
  const O = require('./released-engine.js');
  const mv = m => m ? { name: m.name, text: (() => { try { return m.text(1); } catch(e) { return ''; } })() } : null;
  const evo = sp => sp.evo ? (sp.evo.branches ? 'a stone picks it' : sp.evo.into + ' by ' + (sp.evo.by === 'stone' ? sp.evo.stone : 'level')) : 'none';
  const rows = [], added = [], removed = Object.keys(O.SPECIES).filter(k => !E.SPECIES[k]);
  for(const k of Object.keys(E.SPECIES)){
    const n = E.SPECIES[k], o = O.SPECIES[k];
    if(!o){ added.push(k); continue; }
    const lines = [];
    for(const [f, label] of [['hp','HP'],['atk','Attack'],['spd','Speed']]){
      if(n[f] !== o[f]) lines.push({ kind:'stat', label, from:o[f], to:n[f] });
    }
    for(const [f, label] of [['type','Type'],['role','Role'],['tier','Tier']]){
      if(n[f] !== o[f]) lines.push({ kind:'attr', label, from:o[f], to:n[f] });
    }
    for(const [f, label] of [['move','Move'],['move2','Second move']]){
      const a = mv(o[f]), b = mv(n[f]);
      if((a && a.name) !== (b && b.name) || (a && a.text) !== (b && b.text)) lines.push({ kind:'move', label, from:a, to:b });
    }
    if(evo(o) !== evo(n)) lines.push({ kind:'attr', label:'Evolves', from:evo(o), to:evo(n) });
    if(lines.length) rows.push({ k, lines });
  }
  return { rows, added, removed };
})();
const changeHtml = () => {
  if(!changes || (!changes.rows.length && !changes.added.length && !changes.removed.length)) return '';
  const nm = k => esc(E.SPECIES[k].name);
  const delta = (a, b) => { const d = b - a; return `<span class="${d > 0 ? 'up' : 'dn'}">${d > 0 ? '+' : '−'}${Math.abs(d)}</span>`; };
  const mvTxt = m => m ? `<b>${esc(m.name)}</b> — ${esc(m.text)}` : '<i>none</i>';
  const card = (k, inner) => `<div class="chg"><div class="ch">${pic(k, 'lg')}<div><b>${nm(k)}</b>
      <span class="dim">${esc(E.SPECIES[k].type)} · ${esc(E.SPECIES[k].role)} · tier ${E.SPECIES[k].tier === undefined ? '—' : E.SPECIES[k].tier}</span></div></div>${inner}</div>`;
  const cards = changes.rows.map(({ k, lines }) => card(k, `<ul>` + lines.map(l =>
    l.kind === 'stat' ? `<li><span class="lab">${l.label}</span> ${l.from} → <b>${l.to}</b> ${delta(l.from, l.to)}</li>`
    : l.kind === 'attr' ? `<li><span class="lab">${l.label}</span> ${esc(l.from)} → <b>${esc(l.to)}</b></li>`
    : `<li><span class="lab">${l.label}</span><div class="mv old">${mvTxt(l.from)}</div><div class="mv new">${mvTxt(l.to)}</div></li>`).join('') + `</ul>`)).join('');
  const fresh = changes.added.map(k => { const s = E.SPECIES[k], m2 = s.move2;
    return card(k, `<ul><li><span class="lab">New</span> HP ${s.hp} · Attack ${s.atk} · Speed ${s.spd}${s.token ? ' · evolution only' : ''}</li>
      <li><span class="lab">Move</span><div class="mv new">${mvTxt({ name:s.move.name, text:s.move.text(1) })}</div></li>
      ${m2 ? `<li><span class="lab">Second move</span><div class="mv new">${mvTxt({ name:m2.name, text:m2.text(1) })}</div></li>` : ''}</ul>`); }).join('');
  return `<h2>What changed in ${VERSION[1]} <span class="dim" style="font-size:14px;font-weight:400">— this update only</span></h2>
  <p class="note" style="margin-bottom:12px">${changes.rows.length} pokémon had stats, moves or roles changed${changes.added.length ? `, ${changes.added.length} are new` : ''}${changes.removed.length ? `, ${changes.removed.length} removed (${changes.removed.join(', ')})` : ''}.
  Green is up, red is down. The full numbers for every pokémon are in the table further down.</p>
  <div class="chgs">${cards}${fresh}</div>`;
};

/* ---------- 3.3.0: what changed for the BOSSES in this update (Sean) — pool, calibration, ratios ---------- */
const bossChanges = (() => {
  if(!fs.existsSync('released-engine.js')) return null;
  const O = require('./released-engine.js');
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const nmO = k => (E.SPECIES[k] || O.SPECIES[k]).name;
  const rows = [];
  for(const b of E.ALL_BOSSES){
    const o = O.ALL_BOSSES.find(x => x.id === b.id);
    if(!o) continue;
    const np = E.themePool(b), op = O.themePool(o);
    const inn = np.filter(k => !op.includes(k)), out = op.filter(k => !np.includes(k));
    const lines = [];
    if(inn.length || out.length) lines.push({ label:'Pool', inn, out, size:[op.length, np.length] });
    for(const [f, label] of [['theme','Theme'],['also','Also'],['exclude','Excludes'],['guards','Bodyguards'],['signature','Leads with']])
      if(!same(o[f], b[f])) lines.push({ label, from:o[f], to:b[f], f });
    if((o.calib || 1) !== (b.calib || 1)) lines.push({ label:'Calibration', from:o.calib || 1, to:b.calib || 1, num:true });
    if(o.blurb !== b.blurb) lines.push({ label:'Description', from:o.blurb, to:b.blurb, text:true });
    if(lines.length) rows.push({ b, lines });
  }
  const t = [];
  const arr = (label, a, b) => { if(!same(a, b)) t.push({ label, from:a, to:b }); };
  arr('Gym ratio ramp (badge 1–8)', O.TUNING.gymRatio, E.TUNING.gymRatio);
  arr('Elite Four / Champion ratio ramp (5 fights)', O.TUNING.gauntletRatio, E.TUNING.gauntletRatio);
  arr('Boss ratio', O.TUNING.bossRatio, E.TUNING.bossRatio);
  arr('Extra bodies', O.TUNING.bossSize, E.TUNING.bossSize);
  arr('Off-theme bodyguards', O.TUNING.bossOffTheme, E.TUNING.bossOffTheme);
  for(const k of Object.keys(E.TUNING.mods || {})) arr('Mode factor · ' + k, (O.TUNING.mods || {})[k], E.TUNING.mods[k]);
  return { rows, t, nmO };
})();
const bossChangeHtml = () => {
  if(!bossChanges || (!bossChanges.rows.length && !bossChanges.t.length)) return '';
  const fmt = v => v === undefined ? '<i>none</i>' : Array.isArray(v) ? (v.length && typeof v[0] === 'number' ? v.map(x => +(+x).toFixed(4)).join(' · ') : esc(v.map(x => E.SPECIES[x] ? E.SPECIES[x].name : x).join(', ')) || '<i>none</i>')
    : typeof v === 'object' ? esc(Object.entries(v).map(([a, b]) => a + ' ' + (typeof b === 'number' ? +b.toFixed(3) : b)).join(', ')) : esc(String(v));
  const chips = a => a.map(k => `<span class="pchip">${pic(k,'sm')}${esc(bossChanges.nmO(k))}</span>`).join('');
  const cards = bossChanges.rows.map(({ b, lines }) => `<div class="chg"><div class="ch">${pic(b.id,'lg')}<div><b>${esc(b.name)}</b> <span class="dim">${esc(b.title)}</span></div></div><ul>` +
    lines.map(l => l.label === 'Pool'
      ? `<li><span class="lab">Pool</span> ${l.size[0]} → <b>${l.size[1]}</b> species${l.inn.length ? `<div class="mv new"><b>Joins</b> ${chips(l.inn)}</div>` : ''}${l.out.length ? `<div class="mv old"><b>Leaves</b> ${chips(l.out)}</div>` : ''}</li>`
      : l.num ? `<li><span class="lab">${l.label}</span> ${l.from} → <b>${l.to}</b> <span class="${l.to > l.from ? 'up' : 'dn'}">${l.to > l.from ? '+' : '−'}${Math.abs(l.to - l.from).toFixed(2)}</span> <span class="dim">(${l.to > l.from ? 'harder' : 'easier'})</span></li>`
      : l.text ? `<li><span class="lab">${l.label}</span><div class="mv old">${esc(l.from)}</div><div class="mv new">${esc(l.to)}</div></li>`
      : `<li><span class="lab">${l.label}</span> ${fmt(l.from)} → <b>${fmt(l.to)}</b></li>`).join('') + `</ul></div>`).join('');
  const tun = bossChanges.t.length ? `<div class="chg"><div class="ch"><div><b>Difficulty dials</b> <span class="dim">the same for every boss</span></div></div><ul>` +
    bossChanges.t.map(x => `<li><span class="lab">${esc(x.label)}</span><div class="mv old">${fmt(x.from)}</div><div class="mv new">${fmt(x.to)}</div></li>`).join('') + `</ul></div>` : '';
  return `<h2>Boss changes in ${VERSION[1]} <span class="dim" style="font-size:14px;font-weight:400">— this update only</span></h2>
  <p class="note" style="margin-bottom:12px">${bossChanges.rows.length} leaders had their pool, theme, calibration or lead changed. A higher calibration or ratio makes that fight harder.
  The full pools are further down under “Who each boss can field”.</p>
  <div class="chgs">${cards}${tun}</div>`;
};

/* ---------- type matrix ---------- */
const matrix = () => {
  const head = RING.map(t => `<th><span class="tchip" style="--c:${E.TYPES[t].color}">${t.slice(0,4)}</span></th>`).join('');
  const rows = RING.map(a => {
    const cells = RING.map(d => {
      const m = E.typeMult(a, d);
      const cls = m > 1 ? 'x2' : m < 1 ? 'xh' : 'x1';
      return `<td class="${cls}">${m > 1 ? '×2' : m < 1 ? '×½' : '·'}</td>`;
    }).join('');
    return `<tr><th class="rowh"><span class="tchip" style="--c:${E.TYPES[a].color}">${a}</span></th>${cells}</tr>`;
  }).join('');
  return `<div class="scroller"><table class="matrix">
    <thead><tr><th class="corner">attacker ↓ &nbsp;/&nbsp; defender →</th>${head}</tr></thead>
    <tbody>${rows}</tbody></table></div>`;
};

/* ---------- families ---------- */
const seen = new Set(), families = [];
Object.keys(E.SPECIES).forEach(k => {
  const line = E.evoFamily(k);   // 1.3.0: every branch
  if(seen.has(line[0])) return;
  seen.add(line[0]);
  families.push(line);
});
families.sort((a,b) => E.SPECIES[a[0]].tier - E.SPECIES[b[0]].tier
  || E.SPECIES[a[0]].name.localeCompare(E.SPECIES[b[0]].name));

const stageHtml = (k, i, line) => {
  const s = E.SPECIES[k];
  const par = i > 0 ? E.evoParent(k) : null;
  const from = par ? E.evoNext(par).find(n => n.into === k) : null;
  const via = !from ? '<span class="via base">base</span>'
    : from.by === 'stone'
      ? `<span class="via stone">${E.ITEMS[from.stone].icon} ${E.ITEMS[from.stone].name}</span>`
      : `<span class="via lvl">level up</span>`;
  return `<tr class="stage ${i ? 'evo' : ''}">
    <td class="nm">${pic(k) || `<span class="dot" style="--c:${E.TYPES[s.type].color}"></span>`}${esc(s.name)}</td>
    <td>${via}</td>
    <td class="n atk">${s.atk}</td>
    <td class="n hp">${s.hp}</td>
    <td class="n spd">${s.spd}</td>
    <td class="n tot">${bst(s)}</td>
    <td class="g1">${esc(s.gen1 || '')}</td>
    <td class="rl"><span class="rchip r-${E.roleOf(k)}">${E.ROLES[E.roleOf(k)].icon} ${E.ROLES[E.roleOf(k)].name}</span></td>
    <td class="mv"><b>${esc(s.move.name)}</b> ${esc(s.move.text(1))}${s.move2 ? `<br><b>${esc(s.move2.name)}</b> <i class="dim">${esc(s.move2.when())}:</i> ${esc(s.move2.text(1))}` : ''}</td>
  </tr>`;
};

const familyHtml = line => {
  const base = E.SPECIES[line[0]];
  return `<section class="fam" data-type="${base.type}" data-tier="${base.tier}"
           data-search="${esc(line.map(k=>E.SPECIES[k].name + ' ' + E.SPECIES[k].move.name + ' ' + (E.SPECIES[k].move2 ? E.SPECIES[k].move2.name : '') + ' ' + E.ROLES[E.roleOf(k)].name).join(' ').toLowerCase())}">
    <header>
      <span class="tchip" style="--c:${E.TYPES[base.type].color}">${base.type}</span>
      ${line.map(k=>pic(k,'lineup')).join('')}
      <h3>${line.map(k=>esc(E.SPECIES[k].name)).join(' <span class="a">→</span> ')}</h3>
      <span class="tier">tier ${base.tier}${E.genOf(line[0]) > 1 ? ' · Gen 2' : line.some(k => E.genOf(k) > 1) ? ' · Gen 1 + 2' : ''}</span>
    </header>
    <div class="scroller"><table class="stats">
      <thead><tr><th>stage</th><th>from</th><th class="n">◆</th><th class="n">♥</th><th class="n">»</th><th class="n">tot</th><th>gen 1</th><th>role</th><th>moves (main, then second)</th></tr></thead>
      <tbody>${line.map((k,i)=>stageHtml(k,i,line)).join('')}</tbody>
    </table></div>
  </section>`;
};

/* ---------- items ---------- */
/* v50: every item's rarity and its odds against a common item */
const rarChip = it => { const r = E.rarityOf(it), R = E.TUNING.rarity[r];
  const col = { common:'#8a8f98', uncommon:'#2e8f5a', rare:'#3a6fc9', veryrare:'#c98a12' }[r];
  return ` <span class="rchip" style="--rc:${col}">${R.name}${r === 'common' ? '' : ' ×' + R.weight}</span>`; };
const itemRows = Object.keys(E.ITEMS).map(k => {
  const it = E.ITEMS[k];
  return `<tr><td class="nm">${pic(k) || it.icon} ${esc(it.name)}${rarChip(it)}</td><td class="n">${it.cost}₽</td>
    <td class="n">${it.tier}</td><td>${esc(it.text)}</td>
    <td>${it.eligible ? '<span class="via stone">only its own line</span>' : '<span class="via base">any pokémon</span>'}</td></tr>`;
}).join('');

const heldRows = Object.keys(E.HELD_ITEMS).map(k => {
  const it = E.HELD_ITEMS[k];
  const kindChip = `<span class="via ${it.kind === 'stat' ? 'base' : it.kind === 'trigger' ? 'lvl' : 'stone'}">${it.kind}</span>`;
  return `<tr><td class="nm">${pic(k) || it.icon} ${esc(it.name)}${rarChip(it)}</td><td class="n">${it.cost}₽</td>
    <td class="n">${it.tier}</td><td>${kindChip}</td><td>${esc(it.text)}</td></tr>`;
}).join('');

const bitemRows = E.BATTLE_ITEMS.map(it => {
  const ex = n => it.amount(it.stat === 'atk' ? { atk:n, spd:n } : { atk:n, spd:n });
  return `<tr><td class="nm">${pic(it.id) || it.icon} ${esc(it.name)}</td><td class="n">${it.cost}₽</td>
    <td class="n">${E.TUNING.xItems.perBattle}</td>
    <td>${esc(it.text())} <span class="mono">e.g. ${it.stat === 'atk' ? 'Attack' : 'Speed'} 40 → +${ex(40)} · 80 → +${ex(80)} · 120 → +${ex(120)} per use</span></td></tr>`;
}).join('');

/* ---------- the run: gyms, the Elite Four, the Champion ---------- */
const TT = E.TUNING;
const bossRows = plan.map((st, i) => ({ st, i })).filter(x => x.st.boss).map(({ st, i }) => {
  const b = st.boss;
  const ramp = st.kind === 'gym'
    ? TT.gymRatio[Math.min(st.badge || 0, TT.gymRatio.length - 1)]
    : (TT.bossRatio[st.kind] || 1) * (TT.gauntletRatio[i - E.gauntletStart()] || 1);
  const total = ramp * (b.calib || 1);
  const kindChip = st.kind === 'gym' ? `<span class="via base">gym ${st.badge + 1}</span>`
    : st.kind === 'elite' ? '<span class="via lvl">Elite Four</span>' : '<span class="via stone">Champion</span>';
  const lost = st.kind === 'gym' ? (measured.endAt[b.id] || 0) : (measured.fell[b.id] || 0);
  return `<tr><td class="nm">${esc(b.name)}</td><td>${kindChip}</td>
    <td>${b.theme ? b.theme.map(t => `<span class="mono">${esc(t)}</span>`).join(' / ') : '<span class="mono">no theme</span>'}</td>
    <td class="n">${i + 1}</td><td class="n">${ramp.toFixed(2)}</td><td class="n">×${(b.calib || 1).toFixed(2)}</td>
    <td class="n"><b>${Math.round(total * 100)}%</b></td>
    <td class="n">${st.kind === 'gym' ? pctOf(lost) + ' of runs end here' : (lost / RUNS).toFixed(2) + ' falls / run'}</td></tr>`;
}).join('');


/* ---------- 4.1.0: how each combination of generations plays ---------- */
const gensHtml = () => {
  const row = (label, c, e4, note) => `<tr><td class="nm">${label}</td><td class="n"><b>${c}</b></td><td class="n">${e4}</td><td>${note}</td></tr>`;
  const pc = v => Math.round(v * 100) + '%';
  const rows = [
    row('Gen 1', pctOf(measured.cleared), pctOf(measured.reached), 'The original game, exactly as before (' + RUNS + ' seeded runs).'),
    GD['2'] ? row('Gen 2 only', pc(GD['2'].cleared), pc(GD['2'].reachedE4), `Johto only (${GD['2'].N} seeded runs). Foes ×${E.TUNING.gensFoes['2']}.`) : '',
    GD['1+2'] ? row('Gen 1 + 2', pc(GD['1+2'].cleared), pc(GD['1+2'].reachedE4), `Both regions, bosses pooled and scaled to their slot (${GD['1+2'].N} seeded runs). Foes ×${E.TUNING.gensFoes['1+2']}.`) : '' ].join('');
  const nmB = id => { const b = E.EVERY_BOSS.find(x => x.id === id); return b ? b.name : id; };
  const bossTable = (key, home) => !GD[key] ? '' : (() => {
    const list = Object.entries(GD[key].bosses).filter(([id]) => !home || (E.EVERY_BOSS.find(x => x.id === id) || {}).gen === 2)
      .map(([id, f]) => ({ id, n: f.n, w: f.w, slots: f.slots })).sort((a, b) => a.id.localeCompare(b.id));
    const slotLine = sl => Object.keys(sl).sort((a, b) => (a[0] + a.slice(1).padStart(2, '0')).localeCompare(b[0] + b.slice(1).padStart(2, '0'))).map(k => `${k} ${Math.round(sl[k].w / sl[k].n * 100)}%`).join(' · ');
    return `<div class="scroller"><table><thead><tr><th>boss</th><th class="n">met</th><th class="n">first-try win</th><th>by slot</th></tr></thead><tbody>${
      list.map(b => `<tr><td class="nm">${pic(b.id, 'sm')} ${esc(nmB(b.id))}</td><td class="n">${b.n}</td><td class="n"><b>${Math.round(b.w / b.n * 100)}%</b></td><td>${esc(slotLine(b.slots))}</td></tr>`).join('')}</tbody></table></div>`; })();
  const g2 = Object.keys(E.SPECIES).filter(k => E.genOf(k) === 2 && !E.SPECIES[k].legendary && !E.SPECIES[k].token);
  const roles = ['tank', 'bruiser', 'cannon', 'support'];
  const roleRows = [1, 2, 3, 4, 5].map(t => `<tr><td class="nm">tier ${t}</td>${roles.map(r => `<td class="n">${g2.filter(k => E.SPECIES[k].tier === t && E.roleOf(k) === r).length}</td>`).join('')}</tr>`).join('');
  const T = E.TUNING;
  return `<h2>Generations <span class="dim" style="font-size:14px;font-weight:400">— new in 4.0.0</span></h2>
  <p class="note" style="margin-bottom:12px">New Run has a toggle per generation. Each gen has its own gym leaders, Elite Four, Champion and rival;
  with both on, 8 of the 16 gym leaders and 4 of the Elite Four are drawn and shuffled, and every boss is scaled to the slot they land in.
  The reference player clears each combination about three runs in four.</p>
  <div class="scroller"><table><thead><tr><th>generations</th><th class="n">runs cleared</th><th class="n">reach Elite Four</th><th>note</th></tr></thead><tbody>${rows}</tbody></table></div>
  <h3 style="margin-top:18px">Who is sold</h3>
  <p class="note">A Gen 1 run sells Gen 1 only. A <b>Gen 2-only</b> run sells Gen 2 pokémon plus the Gen 1 lines that one of them belongs to (Onix with Steelix, Magby with Magmar, Pichu with Pikachu), and nothing else.
  Johto's leaders can still field Gen 1 pokémon from the Johto Pokédex, but those are never sold to you. Gen 2's evolutions of Gen 1 pokémon only exist when Gen 2 is on.</p>
  <h3 style="margin-top:18px">Run Focus and the Evolution Pool <span class="dim" style="font-size:13px;font-weight:400">— runs with both gens</span></h3>
  <p class="note">A mixed run sells nearly twice the roster, so copies merge far less often (a level 3 is about three times rarer). Each run draws, from its seed:
  <b>3 Focus lines</b> (one Gen 1, one Gen 2, one either; tier ${3} or lower) that fill about ${Math.round(E.FOCUS_CHANCE * 100)}% of Daycare slots between them, and
  an <b>Evolution Pool</b> of 4 of the ${E.CROSS_EVOS.length} cross-gen evolutions (${E.CROSS_EVOS.map(k => esc(E.SPECIES[k].name)).join(', ')}); the Mart only stocks stones for the open ones.
  Single-gen and Gen 2-only runs are untouched. The Daily Challenge rotates generations by date (Gen 1 half the time, Gen 1+2 three days in ten, Gen 2 otherwise).</p>
  <h3 style="margin-top:18px">Red on Mt. Silver <span class="dim" style="font-size:13px;font-weight:400">— new in 4.1.0, Gen 2 runs only</span></h3>
  <p class="note">A seeded <b>${Math.round(E.TUNING.red.chance * 100 * 10) / 10}%</b> of runs with Gen 2 on (about one in six) hide a secret last boss. Beat the Champion and Red is next: <b>${E.RED.lineup.map(u => esc(E.SPECIES[u.id].name)).join(', ')}</b>, all level 3, each holding an item.
  Between the two fights you are healed and the shops reopen for one turn. It is <b>one fight, one chance</b>: losing costs no life and no money and the run ends as the Champion clear it was. Winning earns Red's Badge, a trophy with no effect in a run.
  He is priced on the same curve as the Champion at <b>×${E.TUNING.red.ratio['2']}</b> (Gen 2 only) or <b>×${E.TUNING.red.ratio['1+2']}</b> (Gen 1 + 2), against the Champion's ×${E.TUNING.bossRatio.champion}. The reference bot beats him about 1 time in 3 among runs that reach him (<code>node redwin.js</code>).</p>
  <h3 style="margin-top:18px">Professor Oak in Pallet Town <span class="dim" style="font-size:13px;font-weight:400">— new in 4.2.0, Gen 1 runs</span></h3>
  <p class="note">The Gen 1 twin of Red: about <b>1 run in 6</b> with Gen 1 on hides him (a run with both gens draws one secret boss, Red or Oak, at random), and he appears after the Champion. Team: <b>${E.OAK.lineup.map(u => esc(E.SPECIES[u.id].name)).join(', ')}</b>, level 3, each holding an item. One fight, no retry, nothing lost on a loss; Oak's Badge is a trophy.
  Priced at <b>×${E.TUNING.red.oakRatio['1']}</b> (Gen 1) or <b>×${E.TUNING.red.oakRatio['1+2']}</b> (Gen 1 + 2); the reference bot beats him about 1 time in 3 among runs that reach him (<code>node redwin.js 250 '[1]' oak</code>).
  <b>Porygon2</b> (Normal, Support, Tier 5, ${E.SPECIES.porygon2.hp}/${E.SPECIES.porygon2.atk}/${E.SPECIES.porygon2.spd}) is Porygon's level-up evolution when Gen 2 is on; Porygon is now the ninth cross-gen evolution in the Evolution Pool.</p>
  <h3 style="margin-top:18px">Pool fill-ins <span class="dim" style="font-size:13px;font-weight:400">— new in 4.5.0, this update only</span></h3>
  <p class="note">23 pokémon added to cover thin types and missing roles. Evolved stages are on the same tier as the first stage. They show letter placeholders until Sean draws the sprites. Because the Daycare now has more weak options, every opponent scale was eased a little: Gen 1 <b>0.99 → ${E.TUNING.gensFoes['1']}</b>, Gen 2 <b>1.004 → ${E.TUNING.gensFoes['2']}</b>, Gen 1 + 2 <b>0.913 → ${E.TUNING.gensFoes['1+2']}</b>, and the Mono factors were re-measured for all three (Rock and Psychic are new Mono types in Gen 1, Grass is new in Gen 2). Red and Oak were nudged up to stay near a one-in-three fight (×${E.TUNING.red.ratio['2']} / ×${E.TUNING.red.ratio['1+2']} for Red, ×${E.TUNING.red.oakRatio['1']} / ×${E.TUNING.red.oakRatio['1+2']} for Oak). Reference-bot clear rates after the change: about 75% in Gen 1, Gen 2 and Gen 1 + 2.</p>
  <div class="scroller"><table><thead><tr><th>Pokémon</th><th>Gen</th><th>Type</th><th>Role</th><th class="n">Tier</th><th class="n">HP</th><th class="n">Atk</th><th class="n">Spd</th><th>Move</th></tr></thead><tbody>${
    ['omanyte','omastar','kabuto','kabutops','aerodactyl','slowpoke','slowbro','mr-mime','ponyta','rapidash','cubone','marowak','sunkern','sunflora','gligar','slugma','magcargo','wobbuffet','qwilfish','chinchou','lanturn','togepi','togetic']
      .map(k => { const p = E.SPECIES[k]; return `<tr><td class="nm">${esc(p.name)}</td><td>${p.gen || 1}</td><td>${esc(p.gen1)}</td><td>${esc(E.ROLES[p.role].name)}</td><td class="n">${p.tier}</td><td class="n">${p.hp}</td><td class="n">${p.atk}</td><td class="n">${p.spd}</td><td>${esc(p.move.name)}</td></tr>`; }).join('')}</tbody></table></div>
  <h3 style="margin-top:18px">Gen 2 roster by tier and role <span class="dim" style="font-size:13px;font-weight:400">— buyable lines</span></h3>
  <div class="scroller"><table><thead><tr><th></th>${roles.map(r => `<th class="n">${E.ROLES[r].icon} ${E.ROLES[r].name}</th>`).join('')}</tr></thead><tbody>${roleRows}</tbody></table></div>
  ${GD['2'] ? `<h3 style="margin-top:18px">Johto bosses, Gen 2-only run</h3>
  <p class="note">Share of runs that beat the boss on the first try (bosses that stop a run are met less often).</p>${bossTable('2', true)}` : ''}
  ${GD['1+2'] ? `<h3 style="margin-top:18px">Every boss, Gen 1 + 2 run</h3>
  <p class="note">The same boss lands in different slots in different runs; the slot column shows how they do wherever they appear.</p>${bossTable('1+2', false)}` : ''}`;
};

/* ---------- tuning ---------- */
const T = E.TUNING;
const num = (label, value, note) =>
  `<div class="stat"><dt>${label}</dt><dd>${value}</dd>${note ? `<p>${note}</p>` : ''}</div>`;
const triple = o => `${o.atk} ◆ / ${o.hp} ♥ / ${o.spd} »`;

/* When a tier opens: the badge that unlocks it, or the turn floor for a stuck player. */
const unlockAt = t => {
  const b = E.TUNING.tierForBadge.findIndex(x => x >= t);
  const turn = Math.max(1, (t - 1) * E.TUNING.turnsPerTier);
  return b <= 0 ? 'from the start' : `badge ${b} <span class="mono">(or turn ${turn})</span>`;
};

/* ---------- tier summary (spot the outliers) ---------- */
const tierRows = [1,2,3,4,5,6].map(t => {
  const list = E.BUYABLE.filter(k => E.SPECIES[k].tier === t).map(k => E.SPECIES[k]);
  if(!list.length) return '';
  const tot = list.map(bst);
  const avg = Math.round(tot.reduce((a,b)=>a+b,0) / tot.length);
  const lo = list[tot.indexOf(Math.min(...tot))], hi = list[tot.indexOf(Math.max(...tot))];
  return `<tr><td class="n">${t}</td><td class="n">${list.length}</td><td class="n">${avg}</td>
    <td>${esc(lo.name)} <span class="mono">${bst(lo)}</span></td>
    <td>${esc(hi.name)} <span class="mono">${bst(hi)}</span></td>
    <td class="unlock">${unlockAt(t)}</td></tr>`;
}).join('');

const typeCounts = RING.map(t => {
  const n = E.BUYABLE.filter(k => E.SPECIES[k].type === t).length;
  return `<span class="tchip count" style="--c:${E.TYPES[t].color}">${t} <b>${n}</b></span>`;
}).join('');

/* =================================================================== */

/* ---------- 2.10.0: who each gym leader / Elite Four member can field (Sean) ---------- */
const bossPools = E.EVERY_BOSS.map(b => ({ b, pool: E.themePool(b) }));
const nm = k => E.SPECIES[k].name;
const overlapWith = (b, pool) => bossPools.filter(o => o.b.id !== b.id && o.b.theme && b.theme)
  .map(o => ({ id:o.b.id, name:o.b.name, n: o.pool.filter(k => pool.includes(k)).length }))
  .filter(o => o.n >= Math.ceil(pool.length * 0.6)).map(o => `${o.name} (${o.n} of ${pool.length})`);
const bossPoolHtml = bossPools.map(({ b, pool }) => {
  const finals = pool.filter(k => !E.evoNext(k).length), earlier = pool.filter(k => E.evoNext(k).length);
  const chip = k => `<span class="pchip${b.signature && b.signature.includes(k) ? ' sig' : ''}">${pic(k,'sm')}${esc(nm(k))}<i>t${E.SPECIES[k].tier}</i></span>`;
  const theme = b.theme ? b.theme.join(' + ') + (b.also ? ' + ' + b.also.map(nm).join(', ') : '') + (b.exclude ? ' (no ' + b.exclude.join(', ') + ')' : '') : 'the whole roster';
  const shared = b.theme ? overlapWith(b, pool) : [];
  return `<div class="bpool"><div class="bh">${pic(b.id,'lg')}<div><b>${esc(b.name)}</b> <span class="dim">${esc(b.title)}</span><br>
    <span class="dim">Theme: ${esc(theme)} · ${pool.length} species, ${finals.length} fully evolved</span></div></div>
    ${b.guards ? `<p class="bs"><b>Bodyguards:</b> ${b.guards.map(k => esc(nm(k))).join(', ')} <span class="dim">(about a third of the team, drawn from this list only)</span></p>` : ''}
    ${b.signature ? `<p class="bs"><b>Leads with:</b> ${b.signature.map(k => esc(nm(k))).join(' → ')} <span class="dim">(first one that fits the point in the run)</span></p>` : ''}
    <p class="bl"><b>Fully evolved</b> ${finals.map(chip).join('')}</p>
    ${earlier.length ? `<p class="bl"><b>Earlier forms</b> ${earlier.map(chip).join('')}</p>` : ''}
    ${shared.length ? `<p class="bs dim">Bench mostly shared with ${shared.join(', ')}</p>` : ''}</div>`;
}).join('');

const html = `<meta charset="utf-8">
<title>Gen 2 Balance Sheet</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;600&display=swap">
<style>
:root{
  --ink:#191a22; --ink2:#4c4f63; --ink3:#7d8096;
  --bg:#f6f5f2; --card:#ffffff; --rule:#e2e0da; --rule2:#cfcdc5;
  --accent:#4a46d6; --accent-soft:#ecebfb;
  --atk:#c2452c; --hp:#1f8a4c; --spd:#1668c4;
  --x2:#fbe6e0; --x2i:#a8351c; --xh:#e2eefb; --xhi:#1b5e9e;
  --display:'Archivo',system-ui,sans-serif;
  --body:'IBM Plex Sans',system-ui,sans-serif;
  --mono:'IBM Plex Mono',ui-monospace,Menlo,monospace;
}
@media (prefers-color-scheme: dark){ :root:not([data-theme="light"]){
  --ink:#eceef6; --ink2:#a8adc2; --ink3:#767c94;
  --bg:#12131a; --card:#1b1d27; --rule:#2b2e3c; --rule2:#3b3f51;
  --accent:#9d99ff; --accent-soft:#25244a;
  --atk:#ff8064; --hp:#5fd18c; --spd:#63aaf5;
  --x2:#3a1f19; --x2i:#ff9d80; --xh:#152a3f; --xhi:#7cb8f0;
}}
:root[data-theme="dark"]{
  --ink:#eceef6; --ink2:#a8adc2; --ink3:#767c94;
  --bg:#12131a; --card:#1b1d27; --rule:#2b2e3c; --rule2:#3b3f51;
  --accent:#9d99ff; --accent-soft:#25244a;
  --atk:#ff8064; --hp:#5fd18c; --spd:#63aaf5;
  --x2:#3a1f19; --x2i:#ff9d80; --xh:#152a3f; --xhi:#7cb8f0;
}
*{box-sizing:border-box}
body{background:var(--bg);color:var(--ink);font-family:var(--body);margin:0;line-height:1.55}
.wrap{max-width:1080px;margin:0 auto;padding-inline:16px;padding-block:28px 64px}

h1{font-family:var(--display);font-weight:700;font-size:clamp(28px,5vw,42px);
   letter-spacing:-.02em;margin:0 0 6px;text-wrap:balance}
.lede{color:var(--ink2);font-size:16px;max-width:62ch;margin:0 0 4px}
.stamp{font-family:var(--mono);font-size:12px;color:var(--ink3);margin-top:10px}

h2{font-family:var(--display);font-weight:600;font-size:13px;letter-spacing:.14em;
   text-transform:uppercase;color:var(--ink3);margin:44px 0 14px;
   padding-bottom:8px;border-bottom:1px solid var(--rule)}
h2:first-of-type{margin-top:32px}

.rchip{display:inline-block;white-space:nowrap;font-size:11.5px;font-weight:600;border-radius:6px;padding:1px 7px;
  color:var(--rc);border:1px solid var(--rc);background:color-mix(in srgb, var(--rc) 12%, transparent)}
.r-tank{--rc:#3f7fd9} .r-bruiser{--rc:#d9722f} .r-cannon{--rc:#d63a57} .r-support{--rc:#2e9e63}
.tchip{display:inline-block;background:var(--c);color:#14151c;font-family:var(--display);
  font-weight:600;font-size:11px;letter-spacing:.04em;padding:2px 8px;border-radius:5px;white-space:nowrap}
.tchip.count{font-size:12px;padding:4px 10px;margin:0 4px 6px 0}
.tchip.count b{font-family:var(--mono)}

.scroller{overflow-x:auto;-webkit-overflow-scrolling:touch}
table{border-collapse:collapse;width:100%;font-size:14px}
th,td{text-align:left;padding:7px 10px;border-bottom:1px solid var(--rule)}
thead th{font-family:var(--display);font-size:11px;letter-spacing:.09em;text-transform:uppercase;
  color:var(--ink3);font-weight:600;border-bottom:1px solid var(--rule2)}
td.n,th.n{text-align:right;font-family:var(--mono);font-variant-numeric:tabular-nums;white-space:nowrap}
.mono{font-family:var(--mono);font-size:12.5px;color:var(--ink2)}

/* type matrix */
.matrix{min-width:560px}
.matrix .corner{font-size:10.5px;color:var(--ink3);white-space:nowrap}
.matrix th.rowh{white-space:nowrap}
.matrix td{text-align:center;font-family:var(--mono);font-weight:600;font-size:13px;color:var(--ink3)}
.matrix td.x2{background:var(--x2);color:var(--x2i)}
.matrix td.xh{background:var(--xh);color:var(--xhi)}
.ringline{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:0 0 16px}
.ringline .a{color:var(--ink3);font-family:var(--mono)}

/* families */
.fam{background:var(--card);border:1px solid var(--rule);border-radius:12px;
  padding:12px 14px 4px;margin-bottom:12px}
.fam header{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px}
.fam h3{font-family:var(--display);font-weight:600;font-size:17px;margin:0;flex:1;min-width:0}
.fam h3 .a{color:var(--ink3);font-weight:400}
.fam .tier{font-family:var(--mono);font-size:11.5px;color:var(--ink3);
  border:1px solid var(--rule2);border-radius:20px;padding:1px 9px}
.fam table{font-size:13.5px}
.fam tbody tr:last-child td{border-bottom:0}
.stage.evo .nm{padding-left:22px;position:relative}
.stage.evo .nm::before{content:'↳';position:absolute;left:8px;color:var(--ink3)}
td.nm{font-weight:600;white-space:nowrap}
.dot{display:inline-block;width:9px;height:9px;border-radius:50%;background:var(--c);margin-right:7px;vertical-align:baseline}
img.pix{height:26px;width:26px;object-fit:contain;image-rendering:pixelated;
  vertical-align:middle;margin-right:6px}
img.pix.lineup{height:30px;width:30px;margin:0 -4px 0 0}
td.atk{color:var(--atk)} td.hp{color:var(--hp)} td.spd{color:var(--spd)}
td.tot{color:var(--ink3)}
td.g1{color:var(--ink3);font-family:var(--mono);font-size:11.5px;white-space:nowrap}
td.mv{color:var(--ink2);font-size:13px;min-width:280px}
td.mv b{color:var(--ink);font-weight:600}
.via{font-family:var(--mono);font-size:11px;padding:1px 7px;border-radius:5px;white-space:nowrap}
.via.base{color:var(--ink3);border:1px solid var(--rule2)}
.via.lvl{color:var(--accent);background:var(--accent-soft)}
.via.stone{color:var(--x2i);background:var(--x2)}

/* controls */
.controls{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:16px}
.controls input{flex:1;min-width:180px;font-family:var(--body);font-size:14px;padding:8px 12px;
  border:1px solid var(--rule2);border-radius:8px;background:var(--card);color:var(--ink)}
.controls input:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
.filt{font-family:var(--display);font-weight:600;font-size:11.5px;padding:5px 11px;border-radius:20px;
  border:1px solid var(--rule2);background:var(--card);color:var(--ink2);cursor:pointer}
.filt[aria-pressed="true"]{background:var(--c,var(--accent));color:#14151c;border-color:transparent}
.filt.all[aria-pressed="true"]{background:var(--accent);color:var(--bg)}
.filt:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.empty{color:var(--ink3);font-style:italic;padding:18px 0}

/* numbers */
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(176px,1fr));gap:10px}
.stat{background:var(--card);border:1px solid var(--rule);border-radius:10px;padding:11px 13px}
.stat dt{font-family:var(--display);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink3)}
.stat dd{font-family:var(--mono);font-size:19px;font-weight:600;margin:2px 0 0}
.stat p{font-size:12px;color:var(--ink3);margin:4px 0 0;line-height:1.4}
.note{color:var(--ink2);font-size:14px;max-width:70ch}
.note code{font-family:var(--mono);font-size:12.5px;background:var(--accent-soft);
  color:var(--accent);padding:1px 5px;border-radius:4px}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
.chgs{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px}
.chg{background:var(--card);border:1px solid var(--rule);border-radius:10px;padding:10px 12px}
.chg .ch{display:flex;gap:10px;align-items:center;margin-bottom:4px}
.chg .ch img.lg{width:40px;height:40px;image-rendering:pixelated}
.chg .ch .dim{display:block;font-size:11.5px}
.chg ul{list-style:none;margin:0;padding:0}
.chg li{font-size:13px;line-height:1.6;margin:3px 0}
.chg .lab{display:inline-block;min-width:78px;font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:var(--dim,#888)}
.chg .up{color:#2f9e5a;font-weight:600}.chg .dn{color:#d0533e;font-weight:600}
.chg .mv{font-size:12.5px;line-height:1.5;margin:2px 0 4px 0}
.chg .mv.old{opacity:.6;text-decoration:line-through}
.bpool{background:var(--card);border:1px solid var(--rule);border-radius:10px;padding:12px 14px;margin:0 0 10px}
.bpool .bh{display:flex;gap:10px;align-items:center;margin-bottom:6px}
.bpool p{margin:5px 0;font-size:13px;line-height:1.7}
.bpool .bl b{font-family:var(--display);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink3);margin-right:6px}
.pchip{display:inline-flex;align-items:center;gap:3px;border:1px solid var(--rule2);border-radius:999px;padding:1px 8px 1px 3px;margin:2px 4px 2px 0;font-size:12.5px;white-space:nowrap}
.pchip i{font-style:normal;font-family:var(--mono);font-size:10.5px;color:var(--ink3);margin-left:3px}
.pchip.sig{border-color:var(--accent);background:var(--accent-soft)}
.pchip img.sm{width:22px;height:22px;image-rendering:pixelated}
.bpool img.lg{width:44px;height:44px;image-rendering:pixelated}
</style>

<div class="wrap">
  <h1>PokéBattler Balance Sheet <span class="dim" style="font-size:16px;font-weight:400">· Gen 2 build</span></h1>
  <p class="lede">Every pokémon, item and type matchup currently in the game, pulled straight out of
  the engine. Move descriptions are the level-1 numbers; power scales ×${1 + T.movePowerPerLevel}
  at level 2 and ×${(1 + T.movePowerPerLevel * 2).toFixed(2)} at level 3.</p>
  <p class="stamp">game ${VERSION[1]} · ${VERSION[2]} · ${E.BUYABLE.length} buyable · ${Object.keys(E.SPECIES).length - E.BUYABLE.length} evolution-only ·
  ${Object.keys(E.ITEMS).length} mart items · ${Object.keys(E.HELD_ITEMS).length} held items ·
  ${E.BATTLE_ITEMS.length} battle items</p>

  ${changeHtml()}
  ${bossChangeHtml()}

  ${gensHtml()}

  <h2>Type chart</h2>
  <p class="note" style="margin-bottom:14px"><b>Where the types come from (3.0.0).</b> Each pokémon has <b>one</b> type:
  its first (main) Gen 1 type, except that Normal/Flying pokémon count as Flying. So Bulbasaur (Grass/Poison) is
  Grass, Scyther (Bug/Flying) is Bug, Gyarados (Water/Flying) is Water and the Pidgey line is Flying.
  Every species is checked against this rule in the test suite, so the "gen 1" column and the type chip can never disagree.</p>
  <p class="note" style="margin-bottom:14px">The chart is the modern one: Steel and Dark joined in 4.0.0 with the Gen 2 pack, and there is still no Fairy. Gen 1 pokémon keep their Gen 1 types. Where the games
  make a type immune (Ghost vs Normal, Ground vs Electric…) this game makes it <b>resist</b> (×½) instead, so an attack never does nothing.
  A type can now be weak to, or resist, several types at once.</p>
  ${matrix()}
  <p class="note" style="margin-top:14px">Read each row as an <b>attacker</b>: ×2 is a super-effective hit, ×½ a resisted one.
  Poison is not a type here (no pokémon has it as its main type).</p>
  <p class="note" style="margin-top:12px">Roster spread by type — a type with very few pokémon is hard to
  build around, which is why Mono runs are only offered for the types with enough: ${E.MONO_TYPES.join(', ')}.</p>
  <div style="margin-top:8px">${typeCounts}</div>

  <h2>Tier summary</h2>
  <div class="scroller"><table>
    <thead><tr><th class="n">tier</th><th class="n">count</th><th class="n">avg total</th>
      <th>weakest</th><th>strongest</th><th>opens at</th></tr></thead>
    <tbody>${tierRows}</tbody></table></div>
  <p class="note" style="margin-top:12px">"Total" is ◆ + ♥ + » for the base form. Since the stat rescale a point
  of each stat is worth about the same in a fight — speed a little more, which is why the power score weights it
  ×${T.spdPower} — so totals compare fairly across a tier. A low total is still fine when the pokémon evolves
  hard (Magikarp) or carries an unusually strong move. Tiers open with <b>badges</b>; the turn in brackets is
  the slow fallback that stops a player stuck on one gym from being stuck with its roster forever.</p>

  <h2>Roles <span class="dim" style="font-size:14px;font-weight:400">— new in v28</span></h2>
  <div class="scroller"><table>
    <thead><tr><th>role</th><th>trait</th><th class="n">♥ grow</th><th class="n">◆ grow</th><th class="n">» grow</th>
      <th class="n">lines</th><th>what it does</th></tr></thead>
    <tbody>${Object.keys(E.ROLES).map(r => { const R = E.ROLES[r], w = T.roles[r].grow;
      const lines = E.BUYABLE.filter(k => E.roleOf(k) === r);
      return `<tr><td><span class="rchip r-${r}">${R.icon} ${R.name}</span></td><td><b>${R.trait}</b></td>
        <td class="n hp">×${w.hp}</td><td class="n atk">×${w.atk}</td><td class="n spd">×${w.spd}</td>
        <td class="n">${lines.length}</td><td class="mv">${esc(R.text())}</td></tr>`; }).join('')}</tbody></table></div>
  <p class="note" style="margin-top:12px">The role multiplies every bit of <b>growth</b> a pokémon gets — battle
  EXP, the trainer catch-up on a new buy, level-ups and merges — so late in a run a Tank is mostly HP and a Cannon
  mostly Attack. Each set of weights sums to 3, so no role grows more in total. Medicine (Protein, HP Up, Carbos)
  is flat for everyone. A pokémon that evolves into a different role grows as its new role from then on.</p>
  <p class="note" style="margin-top:10px">Fights are ~1.7× longer than before roles (Attack → damage at
  <code>×${T.atkPerDamage}</code>), because a fight over in three rounds leaves no time for a Tank to hold or a heal
  to matter. Moves that hit every enemy land at <b>${Math.round(T.spreadBack*100)}%</b> behind the front rank, and
  Speed/Attack cuts can take at most <b>${Math.round((1-T.dropFloor)*100)}%</b> off a stat in one battle. Measured
  at equal power: a mixed team beats every one-role team, six Tanks can't finish a fight, six Cannons can't
  stand up to one. Trainers, gym leaders and the reference bot all line up Tanks → Bruisers → Supports → Cannons.</p>

  <h2>Pokémon</h2>
  <div class="controls">
    <input id="q" type="search" placeholder="Search a pokémon or a move…" aria-label="Search pokémon and moves">
    <button class="filt all" data-t="" aria-pressed="true">All</button>
    ${RING.map(t=>`<button class="filt" data-t="${t}" style="--c:${E.TYPES[t].color}" aria-pressed="false">${t}</button>`).join('')}
  </div>
  <div id="fams">${families.map(familyHtml).join('')}</div>
  <p id="none" class="empty" hidden>Nothing matches that.</p>

  <h2>Gym leaders, Elite Four &amp; Champion — who can they field?</h2>
  <p class="note">About two thirds of each team comes from the leader&rsquo;s own pool and the rest are off-type bodyguards. Their first pokémon is the
  highlighted signature, as long as it suits that point in the run: early gyms only reach the first stage of an evolution line, and
  tier limits apply. The Champion draws from everything, with his rival starter, an Eeveelution and a legendary you didn&rsquo;t recruit.</p>
  ${bossPoolHtml}

  <h2>Held items — the Bag</h2>
  <p class="note" style="margin-bottom:12px">Bought into the Bag (${T.bagSlots} slots), given to any pokémon
  in the party or the PC, <b>one each</b>, moved or taken back any turn for free. The Mart stocks them from
  tier ${T.heldFromTier}, on <b>extra</b> shelf space rather than in place of medicine — held items were
  measurably a downgrade when they competed for the same slots, because medicine stacks every turn and a held
  item does not. For the same reason the stat items are <b>percentages</b>: a flat bonus is noise by turn 20,
  a percentage keeps one item slot worth having all run.</p>
  <div class="scroller"><table>
    <thead><tr><th>item</th><th class="n">cost</th><th class="n">tier</th><th>kind</th><th>effect</th></tr></thead>
    <tbody>${heldRows}</tbody></table></div>

  <h2>PokéMart — medicine &amp; stones</h2>
  <p class="note" style="margin-bottom:12px">Spent the moment you use them, and permanent — these are what
  compound. Buying Protein every turn is the backbone of the stat curve. Since v26 a pokémon can take at most
  <b>${T.vitaminCap} of each vitamin</b>: damage grows with Attack × Speed on the same pokémon (× every enemy for a
  spread move), so pouring everything into one carry was worth far more than the boss pricing could see —
  a playtest Raichu reached 751 Attack and 485 Speed and beat every boss every time.</p>
  <div class="scroller"><table>
    <thead><tr><th>item</th><th class="n">cost</th><th class="n">tier</th><th>effect</th><th>usable on</th></tr></thead>
    <tbody>${itemRows}</tbody></table></div>

  <h2>Battle counter — next battle only</h2>
  <p class="note" style="margin-bottom:12px">Always stocked and never sells out. Each use boosts <b>your whole
  party</b> by ${Math.round(T.xItems.pct * 100)}% of each pokémon's own stat, up to <b>${T.xItems.perBattle} of each per
  battle</b>, and wears off the moment the battle ends. Between Elite Four fights the allowance resets but the
  shop is closed. They used to be a flat, turn-scaled boost to one pokémon with no limit — a dozen on Zapdos
  one-shot whole teams — which is why they are now small, shared and capped.</p>
  <div class="scroller"><table>
    <thead><tr><th>item</th><th class="n">cost</th><th class="n">max</th><th>effect</th></tr></thead>
    <tbody>${bitemRows}</tbody></table></div>

  <h2>The run</h2>
  <p class="note" style="margin-bottom:12px"><b>${T.battlesPerBadge} trainer battles, then a gym</b>, ${T.badgesToWin}
  times over, then the Elite Four and the Champion as one gauntlet — ${E.RUN_LENGTH()} battles. A boss's team is
  built from its theme and then <b>scaled to a share of what a player is worth on that turn</b>: the ramp sets how
  hard this point of the run should be, and the theme correction absorbs what a type is worth in a fight, which
  the power score can't see. "Price" is the two multiplied — 100% would be an even match for the reference
  player. "Measured" comes from the reference player below: for a gym, the share of runs that run out of lives
  there; for the gauntlet, how often each member knocks you back to Lorelei.</p>
  <div class="scroller"><table>
    <thead><tr><th>boss</th><th>stage</th><th>theme</th><th class="n">battle</th><th class="n">ramp</th>
      <th class="n">theme fix</th><th class="n">price</th><th class="n">measured</th></tr></thead>
    <tbody>${bossRows}</tbody></table></div>
  <div class="grid" style="margin-top:14px">
    ${num('Runs cleared', pctOf(measured.cleared), `Reference player, ${RUNS} seeded runs: rerolls, stocks a bench of 4, focuses medicine on its best hitter (within the cap).`)}
    ${num('Reach the Elite Four', pctOf(measured.reached))}
    ${num('Where lost runs end', `${pctOf(E.GYMS.reduce((n, g) => n + (measured.endAt[g.id] || 0), 0))} gym · ${
      pctOf(RUNS - measured.cleared - E.GYMS.reduce((n, g) => n + (measured.endAt[g.id] || 0), 0))} E4`,
      'Out of lives at a gym, or in the Elite Four.')}
  </div>
  <p class="note" style="margin-top:12px">Losing a boss <b>blacks you out</b>: you keep your team and badges and
  lose ${Math.round(T.blackoutPct * 100)}% of your credits. The first ${T.freeAttempts} attempts cost only money; after
  that a defeat costs a life as well. Losing also scouts their team, and the rematch fields exactly that team.
  In the gauntlet <b>damage carries</b> between fights, the shops are shut, a hurt pokémon resting in the PC
  recovers ${Math.round(T.benchRest * 100)}% per fight it sits out (fainted ones stay down), and losing any fight
  sends you back to the first member — the whole gauntlet is one attempt. Shop rolls come from the run's seed, so
  these measurements are exactly repeatable.</p>

  <h2>Badge rewards</h2>
  <p class="note" style="margin-bottom:12px">Every badge offers <b>three</b> of these and the player keeps one; the
  offer comes from the run's seed, and a reward stops being offered once it reaches its max. "Alone" is what the
  reward is worth to the reference player when it is the <b>only</b> reward it ever takes, against taking none
  (${noReward.toFixed(0)}% cleared) — ${RWR} seeded runs each. The bot can't use extra room or a bigger carry-over,
  so those read near zero here and are worth more to a person who plans for them.</p>
  <div class="scroller"><table>
    <thead><tr><th>reward</th><th>effect</th><th class="n">max</th><th class="n">alone</th></tr></thead>
    <tbody>${rewardRows}</tbody></table></div>

  <h2>The numbers</h2>
  <div class="grid">
    ${num('Party size', T.maxTeam)}
    ${num('Lives', T.startingLives, `Lost to a trainer defeat, or a boss defeat after ${T.freeAttempts} free tries.`)}
    ${num('Run length', E.RUN_LENGTH() + ' battles', `${T.badgesToWin} gyms, ${T.eliteFourCount} Elite Four, 1 Champion.`)}
    ${num('Income / turn', T.creditsPerTurn + '₽')}
    ${num('Carry-over cap', T.maxCarryOver + '₽', 'Unspent credits kept into next turn.')}
    ${num('Win / loss bonus', `+${T.winBonus}₽ / +${T.lossBonus}₽`)}
    ${num('Win streak', T.winStreakBonus.map(n=>'+'+n).join(' '), 'At 1, 2, 3, 4, 5+ straight wins.')}
    ${num('Loss streak', T.lossStreakBonus.map(n=>'+'+n).join(' '), 'The comeback cushion.')}
    ${num('Buy / reroll', `${T.costBuy}₽ / ${T.costRoll}₽`, 'Each shop rerolls separately.')}
    ${num('PC slots', T.pcSlots, 'To start. Storage Box adds more. Spare copies, and the Elite Four bench.')}
    ${num('Bag slots', T.bagSlots, 'To start. Bag Pocket adds more.')}
    ${num('Mart medicine slots', T.martSlots.join(' / '), 'By tier, 1 → 6.')}
    ${num('Mart held-item slots', [1,2,3,4,5,6].map(E.heldSlotsFor).join(' / '), 'By tier, extra shelf on top of the medicine.')}
    ${num('Bench rest', '+' + Math.round(T.benchRest * 100) + '% / fight', 'Elite Four only. Fainted pokémon don’t recover.')}
    ${num('PC training rate', `×${T.pcExpFraction}`, 'Benched pokémon gain battle EXP at this fraction.')}
    ${num('Formation', `${T.rankNames.length} ranks × ${T.rankWidth}`, 'Place pokémon in any cell, gaps allowed. Attacks hit the frontmost rank anyone stands in — or the Tank, if one stands there.')}
    ${num('Damage per Attack', '×' + T.atkPerDamage, 'Damage at 100% power. Lower = longer fights (v28: was ×⅓).')}
    ${num('Spread moves, behind the front', Math.round(T.spreadBack * 100) + '%', 'Share a hits-every-enemy move deals past the front rank.')}
    ${num('Stat-drop floor', Math.round(T.dropFloor * 100) + '%', 'Speed/Attack cuts never take a stat below this share of its start.')}
    ${num('Rally stacks', T.rallyMax, 'Most times one pokémon can be rallied per battle.')}
    ${Object.keys(T.status).map(k => { const S = T.status[k]; return num(S.icon + ' ' + S.name, S.rounds ? S.rounds + ' rounds' : S.actions + ' action' + (S.actions > 1 ? 's' : ''),
      S.dotPct ? `Loses ${Math.round(S.dotPct*100)}% HP a round${S.atkCut ? `, deals ${Math.round(S.atkCut*100)}% less damage` : ''}.` : S.slow ? `Acts ×1/${S.slow} as often.` : S.selfHit ? `${Math.round(S.selfHit*100)}% chance to hit itself.` : 'Skips its actions.'); }).join('')}
    ${num('Rival ambushes', T.rival.windows.length + ' a run', 'Hidden in a trainer slot during gyms ' + T.rival.windows.map(w => (w[0]+1) + '–' + (w[1]+1)).join(', ') + '. Team size ' + T.rival.size.join(' / ') + '.')}
    ${num('Rival strength', T.rival.ratio.map(x => '×' + x).join(' / '), 'Of YOUR team’s power, so he keeps pace with you. A loss costs a life.')}
    ${num('Beating your rival', T.rival.winCredits.map(x => '+' + x + '₽').join(' / '), 'Added to next turn’s pay, plus a held item (its worth in ₽ if the Bag is full).')}
    ${num('Copies to level', `${T.expForLevel2+1} → L2, ${T.expForLevel3+1} → L3`)}
    ${num('Merge bonus', triple(T.mergeBonus), 'Every time two copies combine.')}
    ${num('Level up (evolving)', triple(T.levelUpBonus), "On top of the evolution&rsquo;s own stat jump.")}
    ${num('Level up (no evolution)', triple(T.levelUpBonusMax), 'Keeps final forms and non-evolvers in the race.')}
    ${num('Battle EXP — win', triple(T.expGainWin), T.expModel === 'trainer'
      ? 'Banked by the trainer: your party gets it, and so does anything you buy later.' : 'Whole party, after every win.')}
    ${num('Battle EXP — loss', triple(T.expGainLoss))}
    ${num('Weak / resist', `×${T.weakMult} / ×${T.resistMult}`)}
    ${num('Trainer stat growth', T.aiDifficulty + '/turn', 'How fast regular trainers grow. Moves with the player curve.')}
    ${num('Trainer party pace', E.AI_PARTY_PACE, 'Turns per extra trainer pokémon — higher is easier.')}
    ${num('Player power curve', `${T.powerCurve.base} + ${T.powerCurve.perTurn}/turn`, 'Fitted to how fast a player really grows. Bosses are priced off it.')}
  </div>
  <p class="note" style="margin-top:16px">All of these live in <code>TUNING</code> at the top of the game file
  (party pace sits just above <code>generateAiTeam</code>). Change how fast the player grows and three things
  have to move together: refit <code>powerCurve</code>, move <code>aiDifficulty</code> by the same ratio, then
  re-run the boss calibration — otherwise every boss is priced for a player who no longer exists.</p>
</div>

<script>
(function(){
  var q = document.getElementById('q');
  var fams = [].slice.call(document.querySelectorAll('.fam'));
  var btns = [].slice.call(document.querySelectorAll('.filt'));
  var none = document.getElementById('none');
  var type = '';
  function apply(){
    var term = (q.value || '').trim().toLowerCase();
    var shown = 0;
    fams.forEach(function(f){
      var okT = !type || f.dataset.type === type;
      var okQ = !term || f.dataset.search.indexOf(term) !== -1;
      var ok = okT && okQ;
      f.hidden = !ok;
      if(ok) shown++;
    });
    none.hidden = shown > 0;
  }
  q.addEventListener('input', apply);
  btns.forEach(function(b){
    b.addEventListener('click', function(){
      type = b.dataset.t;
      btns.forEach(function(o){ o.setAttribute('aria-pressed', o === b ? 'true' : 'false'); });
      apply();
    });
  });
})();
</script>
`;

fs.writeFileSync('artifact-reference.html', html);
console.log('reference page written,', html.length, 'bytes,', families.length, 'families');
