/* 1.3.0: Eevee's branching line, transfer codes, the version on the title and dates only in What's new. */
const E = require('./engine.js');
const { chromium, devices } = require('playwright');
let fails = 0;
const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
const S = E.SPECIES;
const V = require('fs').readFileSync(__dirname + '/ui.js', 'utf8').match(/GAME_VERSION = \{ v:'([\w.]+)'/)[1];

/* ---- the Eevee line ---- */
check(S.eevee && !S.eevee.token && E.BUYABLE.includes('eevee') && S.eevee.tier === 3, 'Eevee is sold in the Daycare from tier 3');
check(['vaporeon','jolteon','flareon'].every(k => S[k] && S[k].token), '…and its evolutions are never sold');
check(E.roleOf('eevee') === 'support' && E.roleOf('vaporeon') === 'tank' && E.roleOf('flareon') === 'bruiser' && E.roleOf('jolteon') === 'cannon',
  'roles: Eevee Support, Vaporeon Tank, Flareon Bruiser, Jolteon Cannon');
check(S.jolteon.hp < S.vaporeon.hp && S.jolteon.hp < S.flareon.hp && S.jolteon.atk + S.jolteon.spd > S.vaporeon.atk + S.vaporeon.spd, 'Jolteon is the glass cannon: least HP, most Attack + Speed');
check(S.vaporeon.type === 'Water' && S.jolteon.type === 'Electric' && S.flareon.type === 'Fire' && S.eevee.type === 'Normal', 'types follow the stones');
check(JSON.stringify(E.stonesFor('eevee').sort()) === JSON.stringify(['firestone','thunderstone','waterstone']), 'three stones evolve Eevee');
for(const [stone, into] of [['waterstone','vaporeon'], ['thunderstone','jolteon'], ['firestone','flareon']]){
  const G = E.newGame(3); const u = E.makeUnit('eevee', 0); G.team = [u];
  const hp0 = u.hp;
  check(E.canUseItem(stone, u), `${E.ITEMS[stone].name} can be used on Eevee`);
  E.ITEMS[stone].apply(u, { evolve: (x, s) => E.evolveUnit(G, x, s) });
  check(u.id === into && u.hp - hp0 === S[into].hp - S.eevee.hp, `…and makes ${S[into].name}, keeping what it had earned`);
}
{ const u = E.makeUnit('eevee', 0); check(!E.canUseItem('moonstone', u), 'a Moon Stone does nothing for it'); }
{ const u = E.makeUnit('vulpix', 0); const G = E.newGame(4); G.team = [u]; E.ITEMS.firestone.apply(u, { evolve: (x, s) => E.evolveUnit(G, x, s) });
  check(u.id === 'ninetales', 'single-path stones still work (Vulpix → Ninetales)'); }
{ const G = E.newGame(5); const u = E.makeUnit('eevee', 0); G.team = [u];
  E.addExp(G, u, E.TUNING.expForLevel3);
  check(u.id === 'eevee' && E.unitLevel(u) === 3, 'levelling never evolves Eevee — only a stone does'); }
check(E.evoLine('jolteon').join() === 'eevee,jolteon' && E.evoFamily('eevee').length === 4 && E.evoDepth('flareon') === 1, 'lines and families: Eevee → Jolteon, a family of four, one stage deep');
{ // the Mart stocks Eevee's stones when you own one
  let seen = new Set();
  for(let s = 1; s < 400; s++){ const G = E.newGame(s); G.turn = 14; G.badges = 4; G.team = [E.makeUnit('eevee', 0)]; E.rollMart(G, false);
    G.mart.forEach(m => seen.add(m.id)); }
  check(['waterstone','thunderstone','firestone'].every(k => seen.has(k)), 'owning an Eevee brings all three stones to the Mart'); }
{ // it fights: every form's moves fire without errors, at every level
  let ok = true;
  for(const k of ['eevee','vaporeon','jolteon','flareon']) for(const exp of [0, E.TUNING.expForLevel2, E.TUNING.expForLevel3]){
    try{ const a = E.makeUnit(k, exp), b = E.makeUnit('machop', exp); a.hp = b.hp = 300; const r = E.simulateBattle([a], [b], 11); if(!r.steps.length) ok = false; }catch(e){ ok = false; console.log(e); } }
  check(ok, 'all four fight at levels 1–3'); }

(async () => {
  const br = await chromium.launch();
  for(const [tag, dev] of [['phone', devices['iPhone 13']], ['wide', { viewport: { width: 1250, height: 950 } }]]){
    const ctx = await br.newContext({ ...dev, permissions: ['clipboard-read', 'clipboard-write'] });
    await ctx.addInitScript(() => { window.PKB_TITLE = true; });
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file:///mnt/user-data/outputs/pokebattler.html'); await p.waitForTimeout(500);

    /* the title shows the version, no date */
    const t = await p.evaluate(() => { const t = document.getElementById('title');
      return t ? { ver: (t.querySelector('.tver') || {}).textContent, foot: t.querySelector('.tfoot').textContent } : null; });
    check(t && t.ver === V && !/2026|Sep/.test(t.foot), `${tag}: the title screen shows ${V} under the logo, no date (${t && t.ver})`);
    await p.evaluate(() => { const t = document.getElementById('title'); if(t) t.remove(); document.body.classList.remove('titled'); });

    /* no dates outside What's new */
    const v = await p.evaluate(() => { const vt = document.querySelector('.vtag').textContent; openMenu();
      const sv = document.querySelector('.modal .sver').textContent; const hasX = !!document.querySelector('.smi[data-m="transfer"]');
      document.querySelectorAll('.modal').forEach(m => m.remove()); return { vt, sv, hasX }; });
    check(v.vt === 'PokéBattler ' + V && v.sv === V, `${tag}: the bottom tag and START show the version without a date (“${v.vt}”, “${v.sv}”)`);
    check(v.hasX, `${tag}: START has Transfer save`);

    /* What's new: 1.3.0, 1.2.0 (dated), then one 1.1.0 beta */
    const n = await p.evaluate(() => { localStorage.setItem('pkb_seen_version', 'v30'); openChangelog();
      const rows = [...document.querySelectorAll('.clog details')].map(d => ({ v: d.querySelector('summary b').textContent,
        date: (d.querySelector('.cdate') || {}).textContent || '', unseen: d.classList.contains('unseen'),
        split: [...d.querySelectorAll('.cnew,.cnow')].some(t => t.getClientRects().length > 1) }));
      document.querySelectorAll('.modal').forEach(m => m.remove()); return rows; });
    check(n.map(r => r.v).slice(-3).join('|') === '1.3.0|1.2.0|1.1.0 beta' && n[0].v === V && !n.some(r => /^v\d/.test(r.v)), `${tag}: What’s new lists the 1.x updates then one 1.1.0 beta (${n.map(r => r.v).join(', ')})`);
    check(n.slice(0, -1).every(r => r.date) && !n[n.length - 1].date, `${tag}: dates on every update from 1.2.0, none on the beta (“${n[0].date}”)`);
    check(!n.some(r => r.split), `${tag}: no “new to you” / “current” tag breaks across two lines (1.4.1)`);
    check(n.slice(0, -1).every(r => r.unseen) && !n[n.length - 1].unseen, `${tag}: someone last seen on a v-version sees only the new ones marked`);

    /* Eevee's summary shows the three branches */
    const sum = await p.evaluate(() => { G.team = [makeUnit('eevee', 0)]; fixSlots(G); sel = { kind:'team', idx:0 }; inspect = { kind:'unit', u:G.team[0] }; render();
      const line = document.querySelector('#inspect .line'); return { txt: line && line.textContent.replace(/\s+/g, ' '), br: document.querySelectorAll('#inspect .stage.branch').length,
        how: (document.querySelector('#inspect .line + .mu') || {}).textContent, sprite: !!SPRITES.eevee && !!SPRITES.vaporeon && !!SPRITES.jolteon && !!SPRITES.flareon }; });
    check(sum.br === 3 && /Vaporeon/.test(sum.txt) && /Jolteon/.test(sum.txt) && /Flareon/.test(sum.txt), `${tag}: Eevee’s summary shows all three evolutions (${sum.txt})`);
    check(/Stone decides/.test(sum.how || ''), `${tag}: …and says the stone decides (“${sum.how}”)`);
    check(sum.sprite, `${tag}: all four have sprites`);

    /* transfer codes: make one, change the run, load it back */
    const r = await p.evaluate(async () => {
      newRun(); G.turn = 17; G.badges = 5; G.credits = 23; G.team = [makeUnit('jolteon', 3), makeUnit('snorlax', 0)]; G.team[0].held = 'orb'; fixSlots(G);
      PREF.set('name', 'Sean'); save();
      const snap = JSON.stringify({ team: G.team.map(u => [u.id, u.exp, u.held, u.hp]), turn: G.turn, badges: G.badges, credits: G.credits });
      const code = await makeTransferCode();
      newRun(); PREF.set('name', 'Other'); render();
      const bad = await readTransferCode(code.slice(0, -10));
      const team = await readTransferCode('PKB3-abc');
      const good = await readTransferCode(code.replace(/(.{60})/g, '$1\n'));   // pasted with line breaks
      const applied = good.ok && applyTransfer(good.data);
      const now = JSON.stringify({ team: G.team.map(u => [u.id, u.exp, u.held, u.hp]), turn: G.turn, badges: G.badges, credits: G.credits });
      const stored = JSON.parse(localStorage.getItem(SAVE_KEY)).G.turn;
      return { len: code.length, prefix: code.slice(0, 9), bad: bad.ok, badWhy: bad.why, team: team.ok, teamWhy: team.why, applied, same: now === snap, name: playerName(), stored };
    });
    check(r.prefix === 'PKBSAVE-z', `${tag}: a transfer code is made, compressed (${r.len} characters)`);
    check(r.len < 3000, `${tag}: …short enough to paste in a message`);
    check(r.applied && r.same && r.stored === 17, `${tag}: loading it brings back the exact run — team, levels, items, turn, badges, ₽ — and saves it`);
    check(r.name === 'Sean', `${tag}: …and the trainer name`);
    check(!r.bad && /cut short|damaged/.test(r.badWhy), `${tag}: a code cut short is refused (“${r.badWhy}”)`);
    check(!r.team && /team code/.test(r.teamWhy), `${tag}: a team code is recognised and refused (“${r.teamWhy}”)`);

    /* the dialog, end to end */
    const ui = await p.evaluate(async () => {
      openTransfer(); const d = document.querySelector('.modal.xfer');
      d.querySelector('[data-x="make"]').click(); await new Promise(r => setTimeout(r, 300));
      const code = d.querySelector('.xcode').value;
      d.querySelector('.xin').value = code; d.querySelector('[data-x="read"]').click(); await new Promise(r => setTimeout(r, 300));
      const confirm = !d.querySelector('.xconfirm').hidden, what = d.querySelector('.xwhat').textContent.replace(/\s+/g, ' ');
      d.querySelector('[data-x="no"]').click();
      d.querySelector('.xin').value = 'nonsense'; d.querySelector('[data-x="read"]').click(); await new Promise(r => setTimeout(r, 100));
      const err = d.querySelector('.xmsg').textContent;
      d.remove(); return { code: code.startsWith('PKBSAVE-'), confirm, what, err };
    });
    check(ui.code && ui.confirm && /replaces the run on this device/.test(ui.what), `${tag}: the dialog makes a code, and asks before replacing a run (“${ui.what.slice(0, 70)}…”)`);
    check(/PKBSAVE/.test(ui.err), `${tag}: nonsense gets a clear message`);
    const over = await p.evaluate(() => { openTransfer(); const o = document.documentElement.scrollWidth > innerWidth + 1; document.querySelectorAll('.modal').forEach(m => m.remove()); return o; });
    check(!over, `${tag}: the dialog fits`);
    check(!errs.length, `${tag}: no errors${errs.length ? ' — ' + errs[0] : ''}`);
    await ctx.close();
  }
  await br.close();
  console.log(fails ? `${fails} FAILED` : '1.3.0 passed');
  process.exit(fails ? 1 : 0);
})();
