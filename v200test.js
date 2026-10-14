/* 2.0.0: Daily Challenge, run rules, legendary encounters, undo, battle recap, formations. */
const E = require('./engine.js');
const { chromium, devices } = require('playwright');
let fails = 0;
const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
const S = E.SPECIES, T = E.TUNING;

/* ---------------- engine ---------------- */
// legendaries never in the Daycare
{ let seen = new Set();
  for(let s = 1; s < 300; s++){ const G = E.newGame(s); G.badges = 8; G.turn = 34; E.rollShop(G, false); for(let k = 0; k < 4; k++){ E.rollDaycare(G, false); G.daycare.forEach(x => seen.add(x.unit.id)); } }
  check(!seen.has('zapdos') && !seen.has('mewtwo') && seen.has('snorlax'), 'Zapdos and Mewtwo are never sold in the Daycare (other tier-6 pokémon still are)'); }
// encounters
{ let offered = 0, early = 0, n = 0, ids = new Set();
  for(let s = 1; s < 400; s++){ const G = E.newGame(s); G.team = [E.makeUnit('machop', 0)];
    for(let b = 0; b < 8; b++){ G.badges = b + 1; G.turn = 4 * (b + 1); const e = E.rollEncounter(G); if(e){ ids.add(e.id); if(G.badges < T.legend.fromBadge) early++; } }
    if((G.legendsMet || []).length) offered++; n++; }
  check(early === 0, `no legendary before the ${T.legend.fromBadge}th badge`);
  check(offered / n > 0.5 && offered / n <= 1,   // 2.2.0: the 7th-gym guarantee
         `about ${Math.round(offered / n * 100)}% of runs meet at least one`);
  check(['zapdos','mewtwo','articuno','moltres'].every(k => ids.has(k)), 'all four legendaries turn up');
  const G = E.newGame(9); G.team = [E.makeUnit('machop', 0)]; G.badges = 5; G.turn = 20;
  let e = null; for(let s = 1; !e && s < 200; s++){ G.seed = s; G.legendsMet = []; e = E.rollEncounter(G); }
  const again = E.rollEncounter(G); G.encounter = e;
  check(!!e && e.turn === 21 && (!again || again.id !== e.id), 'an encounter waits for the next shop turn, and the same legendary never comes twice');
  G.turn = 21; G.credits = 5; check(!E.recruitLegend(G).ok, `too little ₽ can't recruit it (costs ${T.legend.cost}₽)`);
  G.credits = 30; const r = E.recruitLegend(G);
  check(r.ok && G.team.some(u => u.id === e.id) && G.credits === 30 - T.legend.cost && !E.encounterOpen(G), 'recruiting puts it in the party and closes the offer');
  const H = E.newGame(10); H.team = [E.makeUnit('machop', 0)]; H.encounter = { id:'zapdos', cost:12, turn:5 }; H.turn = 6;
  check(!E.encounterOpen(H), 'an offer you didn’t take is gone after the battle');
  const M = E.newGame(11, { mods: { mono:'Water' } }); M.team = [E.makeUnit('squirtle', 0)]; let any = false;
  const got = new Set(); for(let s = 1; s < 200; s++){ M.seed = s; M.legendsMet = []; M.badges = 6; const e = E.rollEncounter(M); if(e) got.add(e.id); }
  check(got.size === 0, 'a Mono-Water run meets no legendary (3.0.0: Articuno is Ice now, and there is no Mono-Ice)');
}
// rules
{ const one = E.newGame(3, { mods: { onelife: true } }); check(one.lives === 1, 'One Life starts with one life');
  const nopc = E.newGame(3, { mods: { nopc: true } }); check(E.pcCap(nopc) === 0, 'No PC: zero boxes');
  const mono = E.newGame(3, { mods: { mono: 'Fire' } }); mono.turn = 20; mono.badges = 5; let ok = true;
  for(let k = 0; k < 20; k++){ E.rollDaycare(mono, false); if(mono.daycare.some(x => S[x.unit.id].type !== 'Fire')) ok = false; }
  check(ok, 'Mono-Fire: the Daycare only sells Fire pokémon');
  const rich = E.newGame(3, { mods: { rich: true } }), plain = E.newGame(3);
  rich.credits = plain.credits = 0;
  check(E.incomeFor(rich).total === 2 * E.incomeFor(plain).total, `Rich & Ruthless: double income (${E.incomeFor(plain).total} → ${E.incomeFor(rich).total})`);
  E.rollShop(rich, false); E.rollShop(plain, false); rich.team = [E.makeUnit('machop', 0)]; plain.team = [E.makeUnit('machop', 0)];
  const a = E.opponentFor(plain), b = E.opponentFor(rich);
  check(b.team[0].hp === Math.round(a.team[0].hp * T.mods.richFoes), `…and opponents are ×${T.mods.richFoes}`);
  check(JSON.stringify(E.cleanMods({ mono:'Nope', rich:1, junk:true })) === '{"rich":true}', 'unknown rules are dropped');
}
// daily seed
{ check(E.dailySeed('2026-09-27') === E.dailySeed('2026-09-27') && E.dailySeed('2026-09-27') !== E.dailySeed('2026-09-28'), 'the daily seed is the same all day and changes the next');
  const A = E.newGame(E.dailySeed('2026-09-27'), { daily:'2026-09-27' }), B = E.newGame(E.dailySeed('2026-09-27'), { daily:'2026-09-27' });
  E.rollShop(A, false); E.rollShop(B, false);
  check(JSON.stringify(A.daycare.map(s => s.unit.id)) === JSON.stringify(B.daycare.map(s => s.unit.id)), 'two players get the same Daycare on the same day');
  const kinds = new Set(); for(let d = 1; d <= 60; d++){ const m = E.dailyMods(`2026-10-${String(d % 28 + 1).padStart(2, '0')}`); kinds.add(Object.keys(m).join() || 'none'); }
  check(kinds.size >= 4, `days vary their rule (${[...kinds].join(', ')})`); }
// recap stats
{ const a = E.makeUnit('machop', 0), b = E.makeUnit('clefairy', 0), c = E.makeUnit('rattata', 0); a.hp = b.hp = c.hp = 200;
  const r = E.simulateBattle([a, b], [c], 3), st = r.stats;
  const dealtByLog = r.steps.flatMap(s => s.lines).filter(l => /^Rattata took (\d+)/.test(l)).reduce((n, l) => n + +l.match(/took (\d+)/)[1], 0);
  const mine = st.filter(x => x.side === 'p');
  check(st.length === 3 && mine.reduce((n, x) => n + x.dealt, 0) === dealtByLog, `recap: damage dealt adds up to what the log says (${dealtByLog})`);
  check(st.find(x => x.id === 'rattata').fainted && mine.reduce((n, x) => n + x.kos, 0) === 1, 'recap: one knockout, credited to one of yours');
  check(st.find(x => x.id === 'clefairy').healed > 0, 'recap: the Support’s healing is counted'); }

/* ---------------- browser ---------------- */
(async () => {
  const br = await chromium.launch();
  for(const [tag, dev] of [['phone', devices['iPhone 13']], ['wide', { viewport:{ width:1250, height:950 } }]]){
    const ctx = await br.newContext({ ...dev, permissions: ['clipboard-read', 'clipboard-write'] });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(require('./pkbpaths').PAGE); await p.waitForTimeout(300);
    const click = sel => p.evaluate(sel => document.querySelector(sel).click(), sel);

    /* undo */
    const u = await p.evaluate(() => { newRun(); G.credits = 20; render();
      const c0 = G.credits, id = G.daycare[0].unit.id;
      document.querySelector('.drow[data-act="dc"][data-i="0"]').click();
      document.querySelector('.slot[data-act="team"][data-i="0"]').click();
      const btn = document.querySelector('.btn.undo'), label = btn && btn.textContent.replace(/\s+/g, ' ').trim();
      const bought = G.team.length === 1 && G.credits === c0 - TUNING.costBuy;
      btn.click();
      const back = G.team.length === 0 && G.credits === c0 && !G.daycare[0].bought;
      // a second buy this turn can't be undone
      document.querySelector('.drow[data-act="dc"][data-i="0"]').click(); document.querySelector('.slot[data-act="team"][data-i="0"]').click();
      const second = !document.querySelector('.btn.undo');
      return { label, bought, back, second, id }; });
    check(u.bought && /Undo/.test(u.label || '') && /\+3₽/.test(u.label), `${tag}: after a buy, Undo appears (“${u.label}”)`);
    check(u.back, `${tag}: …and puts the ₽ and the Daycare back`);
    check(u.second, `${tag}: only one undo per turn`);
    const u2 = await p.evaluate(() => { newRun(); G.credits = 20; render();
      document.querySelector('.drow[data-act="dc"][data-i="0"]').click(); document.querySelector('.slot[data-act="team"][data-i="0"]').click();
      const had = !!document.querySelector('.btn.undo');
      document.querySelector('[data-act="rolldc"]').click();
      return { had, gone: !document.querySelector('.btn.undo') }; });
    check(u2.had && u2.gone, `${tag}: a reroll clears the undo (no rewinding a reroll)`);

    /* recap */
    const rc = await p.evaluate(async () => { newRun(); G.team = [makeUnit('machop', 0), makeUnit('clefairy', 0)]; fixSlots(G); render();
      await startBattle(); await new Promise(r => setTimeout(r, 400)); finishPlayback(); render();
      const d = document.querySelector('.recap'); return d ? { rows: d.querySelectorAll('.rrow').length, mvp: !!d.querySelector('.rtag.rt-mvp'), txt: d.textContent.replace(/\s+/g, ' ').slice(0, 120) } : null; });
    check(rc && rc.rows === 2 && rc.mvp, `${tag}: the battle recap lists your pokémon with an MVP (${rc && rc.txt})`);
    await p.evaluate(() => { document.querySelector('[data-act="afterbattle"]') && afterBattle && 0; });

    /* formations */
    const fm = await p.evaluate(() => { newRun(); G.team = [makeUnit('machop', 0), makeUnit('clefairy', 0), makeUnit('onix', 0)]; G.team.forEach((u, i) => u.pos = i); fixSlots(G); render();
      openPresets(); document.querySelector('.modal [data-p="save"][data-k="0"]').click();
      const saved = JSON.stringify(G.team.map(u => [u.id, u.pos]));
      lineUpByRole(G); G.team[0].pos = 5; fixSlots(G); render();
      const moved = JSON.stringify(G.team.map(u => [u.id, u.pos]));
      openPresets(); document.querySelector('.modal [data-p="use"][data-k="0"]').click();
      const back = JSON.stringify(G.team.map(u => [u.id, u.pos]).sort((a, b) => a[1] - b[1]));
      return { saved: JSON.stringify(JSON.parse(saved).sort((a, b) => a[1] - b[1])), moved, back, btn: !!document.querySelector('[data-act="presets"]') }; });
    check(fm.btn && fm.moved !== fm.saved && fm.back === fm.saved, `${tag}: a saved formation snaps back after rearranging`);

    /* legendary panel */
    const lg = await p.evaluate(() => { newRun(); G.team = [makeUnit('machop', 0)]; fixSlots(G); G.credits = 30; G.encounter = { id:'mewtwo', cost:12, turn:G.turn }; render();
      const panel = document.querySelector('.panel.legend'); const txt = panel && panel.textContent.replace(/\s+/g, ' ');
      document.querySelector('[data-act="legend"]').click();
      return { txt, joined: G.team.some(u => u.id === 'mewtwo'), credits: G.credits, gone: !document.querySelector('.panel.legend'), undo: !!document.querySelector('.btn.undo') }; });
    check(/A wild Mewtwo appeared/.test(lg.txt || '') && /Recruit 12₽/.test(lg.txt), `${tag}: the encounter panel shows (${(lg.txt || '').slice(0, 60)}…)`);
    check(lg.joined && lg.credits === 18 && lg.gone && lg.undo, `${tag}: Recruit adds it for 12₽ (and can be undone)`);

    /* new run with rules */
    const nr = await p.evaluate(() => { openNewRun();
      const d = document.querySelector('.modal.newrun');
      d.querySelector('[data-mod="mono"]').click(); const needType = d.querySelector('[data-n="go"]').disabled;
      d.querySelector('[data-type="Fire"]').click(); d.querySelector('[data-mod="onelife"]').click();
      d.querySelector('[data-n="go"]').click();
      return { needType, mods: JSON.stringify(G.mods), lives: G.lives, bar: (document.querySelector('.modebar') || {}).textContent, balls: document.querySelectorAll('.topbar .lives .pball').length,
        onlyFire: G.daycare.every(s => SPECIES[s.unit.id].type === 'Fire') }; });
    check(nr.needType && nr.mods === '{"mono":"Fire","onelife":true}', `${tag}: New Run with Mono-type needs a type, then starts with the rules (${nr.mods})`);
    check(nr.lives === 1 && nr.balls === 1 && /Mono-Fire/.test(nr.bar) && /One Life/.test(nr.bar) && nr.onlyFire, `${tag}: one life ball, the rules bar, and a Fire-only Daycare`);
    const np = await p.evaluate(() => { newRun({ mods:{ nopc:true } }); render(); return (document.querySelector('.panel.pc .closed') || {}).textContent; });
    check(/No PC/.test(np || ''), `${tag}: No PC shows the PC as closed`);

    /* daily challenge: own save, title menu */
    const dy = await p.evaluate(async () => {
      newRun(); G.turn = 9; G.badges = 2; save();                            // a normal run in progress
      const mainSeed = G.seed;
      openDaily(); document.querySelector('.modal.daily [data-d="start"]').click();
      const daily = { d: G.daily, seed: G.seed, key: !!localStorage.getItem(DAILY_KEY), bar: (document.querySelector('.modebar') || {}).textContent };
      const mainStill = JSON.parse(localStorage.getItem(SAVE_KEY)).G;
      G.turn = 4; save();
      switchSlot(SAVE_KEY); const back = { seed: G.seed, turn: G.turn };
      switchSlot(DAILY_KEY); const again = { turn: G.turn, daily: G.daily };
      // finish it and share
      G.over = 'lost'; G.stage = 6; noteRunEnd();
      const share = dailyShareText(G.daily);
      return { daily, today: localDate(), mainStill: { seed: mainStill.seed, turn: mainStill.turn }, mainSeed, back, again, share }; });
    check(dy.daily.d === dy.today && dy.daily.key && /Daily Challenge/.test(dy.daily.bar), `${tag}: Start today’s makes a daily run in its own save (${dy.daily.d})`);
    check(dy.mainStill.seed === dy.mainSeed && dy.mainStill.turn === 9, `${tag}: …and your normal run is untouched`);
    check(dy.back.seed === dy.mainSeed && dy.back.turn === 9 && dy.again.turn === 4 && dy.again.daily === dy.today, `${tag}: switching between the two keeps both`);
    check(/^PokéArena Daily · .* — /.test(dy.share), `${tag}: a shareable result line (“${dy.share}”)`);

    /* title: the new menu */
    const tl = await p.evaluate(async () => { showTitle(afterTitle); const t = document.getElementById('title');
      t.querySelector('[data-t="start"]').click(); await new Promise(r => setTimeout(r, 50));
      const items = [...t.querySelectorAll('.tmi')].map(b => b.dataset.t);
      t.querySelector('[data-t="daily"]').click(); const dm = !!document.querySelector('.modal.daily');
      document.querySelectorAll('.modal').forEach(m => m.remove()); t.remove(); document.body.classList.remove('titled'); titleEl = null;
      return { items, dm }; });
    check(tl.items.join() === 'continue,new,daily,dex,trainer,options' && tl.dm, `${tag}: the title has Continue · New run · Daily Challenge · Trainer Card · Options (${tl.items.join(', ')})`);
    const sm = await p.evaluate(() => { openMenu(); const ids = [...document.querySelectorAll('.smi')].map(b => b.dataset.m); document.querySelectorAll('.modal').forEach(m => m.remove()); return ids; });
    check(sm.includes('title'), `${tag}: START has Title screen`);

    /* no overflow on the new screens */
    const of = await p.evaluate(() => { const o = () => document.documentElement.scrollWidth > innerWidth + 1; const r = [];
      openNewRun(); r.push(o()); document.querySelectorAll('.modal').forEach(m => m.remove());
      openDaily(); r.push(o()); document.querySelectorAll('.modal').forEach(m => m.remove());
      openPresets(); r.push(o()); document.querySelectorAll('.modal').forEach(m => m.remove()); return r; });
    check(of.every(x => !x), `${tag}: the new dialogs fit`);
    check(!errs.length, `${tag}: no errors${errs.length ? ' — ' + errs[0] : ''}`);
    await ctx.close();
  }
  await br.close();
  console.log(fails ? `${fails} FAILED` : '2.0.0 passed');
  process.exit(fails ? 1 : 0);
})();
