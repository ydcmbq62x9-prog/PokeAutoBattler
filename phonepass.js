/* Phone pass: open every screen at several phone/tablet sizes and look for layout trouble. */
const { chromium } = require('playwright');
const SIZES = [['360x640', 360, 640], ['375x667', 375, 667], ['390x844', 390, 844], ['430x932', 430, 932], ['844x390 landscape', 844, 390], ['768x1024 tablet', 768, 1024]];
const ONLY = process.argv[2] || '';
const audit = () => {
  const vw = innerWidth, vh = innerHeight, out = [];
  const de = document.documentElement;
  if(de.scrollWidth > vw + 1) out.push(`page scrolls sideways (${de.scrollWidth} > ${vw})`);
  const desc = e => (e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '') + ' "' + (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24) + '"');
  const visible = e => { const r = e.getBoundingClientRect(); if(r.width < 1 || r.height < 1) return false; const cs = getComputedStyle(e); if(cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) return false; return true; };
  const clippedByAncestor = e => { for(let p = e.parentElement; p && p !== document.body; p = p.parentElement){ const cs = getComputedStyle(p); if(/(auto|scroll|hidden|clip)/.test(cs.overflowX)) return p; } return null; };
  const seen = new Set();
  const modal = document.querySelector('.modal:not([hidden])'); const scope = modal || document.body;
  for(const e of scope.querySelectorAll('*')){
    if(!visible(e)) continue;
    if(e.closest('.toastbox,.fxl,.sfloat,.carry,svg *,.wipe,.wiris,.wball')) continue;
    const r = e.getBoundingClientRect();
    // box leaves the screen sideways and nothing scrolls/clips it
    if((r.right > vw + 2 || r.left < -2) && !clippedByAncestor(e) && getComputedStyle(e).position !== 'fixed'){ const k = 'off:' + desc(e); if(!seen.has(k)){ seen.add(k); out.push(`off-screen ${Math.round(r.left)}..${Math.round(r.right)}: ${desc(e)}`); } }
    // text cut off inside its own box
    const cs = getComputedStyle(e);
    if(e.children.length === 0 && e.textContent.trim() && /(hidden|clip)/.test(cs.overflowX) && cs.textOverflow !== 'ellipsis' && e.scrollWidth > e.clientWidth + 2 && e.clientWidth > 0){ const k = 'cut:' + desc(e); if(!seen.has(k)){ seen.add(k); out.push(`text cut off (${e.scrollWidth}>${e.clientWidth}): ${desc(e)}`); } }
    // tiny tap targets
    if(/^(button|a)$/i.test(e.tagName) || e.matches('[data-act]:not(.slot):not(.drow):not(.martrow):not(.cell):not(.bcell)')){
      if((r.height < 28 || r.width < 28) && !e.closest('.pfield,.pcgrid,.bagrow,.held,.speech') && !e.matches('.held,.hbadge,.cready,.cdel,.roleb,.stat.badges')){ const k = 'tap:' + desc(e); if(!seen.has(k)){ seen.add(k); if(window.__tap) window.__tap.add(`${Math.round(r.width)}×${Math.round(r.height)} ${desc(e)}`); if(1) out.push(`small tap target ${Math.round(r.width)}×${Math.round(r.height)}: ${desc(e)}`); } } }
  }
  // dialogs must fit or scroll
  for(const m of document.querySelectorAll('.modal .box')){ const r = m.getBoundingClientRect(); if(r.bottom > vh + 1 || r.top < -1 || r.right > vw + 1 || r.left < -1) out.push(`dialog leaves the screen (${Math.round(r.left)},${Math.round(r.top)} → ${Math.round(r.right)},${Math.round(r.bottom)} of ${vw}×${vh})`);
    const btns = m.querySelectorAll('.btnrow .btn, .btn'); const cl = m.querySelector('.boxscroll') || m; }
  // fixed bars covering the primary action
  const dock = document.querySelector('.dock'); const fight = document.querySelector('.btn.fight');
  if(fight && visible(fight)){ const r = fight.getBoundingClientRect(); if(r.bottom > vh + 1 || r.right > vw + 1) out.push(`BATTLE button is off the screen (${Math.round(r.bottom)} / ${vh})`); }
  return out;
};
const setup = () => { newRun(); document.querySelectorAll('.modal').forEach(x => x.remove()); const t = document.getElementById('title'); if(t){ t.remove(); document.body.classList.remove('titled'); titleEl = null; }
  G.pendingRewards = []; G.credits = 40; G.turn = 22; G.badges = 5; G.stage = 24; G.trainerExp = { hp:30, atk:30, spd:15 };
  const m = (id, x) => { const u = makeUnit(id, x); return u; };
  G.team = [m('blastoise', 4), m('charizard', 4), m('machamp', 2), m('alakazam', 0), m('snorlax', 0), m('gyarados', 4)]; fixSlots(G);
  G.team[0].held = 'band'; G.team[1].held = 'coat';
  G.pc = [m('abra', 1), m('gastly', 4), m('zapdos', 0), m('eevee', 0), m('pikachu', 0)]; fixSlots(G);
  G.bag = ['sitrus', 'lefto', 'band']; PREF.set('text', 'instant'); G.encounter = { id: 'articuno', cost: 12, turn: G.turn };
  rollShop(G, false); render(); };
const SCREENS = {
  shop: async p => {},
  'shop scrolled to bottom': async p => { await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); },
  'shop with undo': async p => { await p.evaluate(() => { document.querySelector('.drow[data-act="dc"][data-i="0"]').click(); }); await p.waitForTimeout(80); await p.evaluate(() => { const s = document.querySelector('.slot.empty[data-act="team"]') || document.querySelector('.slot[data-act="team"]'); s && s.click(); }); },
  'summary (party)': async p => { await p.evaluate(() => { sel = { kind:'team', idx:0 }; inspect = { kind:'unit', u:G.team[0] }; render(); }); },
  'summary (PC legendary)': async p => { await p.evaluate(() => { const u = G.pc.find(x => x.id === 'zapdos'); sel = { kind:'pc', idx:u.box }; inspect = { kind:'unit', u }; render(); }); },
  'summary (eevee)': async p => { await p.evaluate(() => { const u = G.pc.find(x => x.id === 'eevee'); sel = { kind:'pc', idx:u.box }; inspect = { kind:'unit', u }; render(); }); },
  'start menu': async p => { await p.evaluate(() => document.querySelector('[data-act="menu"]').click()); },
  options: async p => { await p.evaluate(() => openOptions()); },
  "what's new": async p => { await p.evaluate(() => openChangelog()); },
  help: async p => { await p.evaluate(() => openHelp()); },
  pokedex: async p => { await p.evaluate(() => openDex()); },
  'new run': async p => { await p.evaluate(() => openNewRun(() => {})); },
  'new run mono': async p => { await p.evaluate(() => { openNewRun(() => {}); }); await p.waitForTimeout(80); await p.evaluate(() => { const b = document.querySelector('[data-type="Fire"]'); b && b.click(); document.querySelector('[data-mod="onelife"]').click(); }); },
  daily: async p => { await p.evaluate(() => openDaily(() => {})); },
  formations: async p => { await p.evaluate(() => openPresets()); },
  transfer: async p => { await p.evaluate(() => openTransfer()); },
  export: async p => { await p.evaluate(() => openExport()); },
  'trainer card': async p => { await p.evaluate(() => openTrainerCard()); },
  'run history': async p => { await p.evaluate(() => { const r = records(); r.history = Array.from({length:12}, (_, i) => ({ at: Date.now() - i * 3600000, won: i % 3 === 0, stage: 10, label: 'Reached Lance', team: ['charizard','blastoise','machamp','alakazam','snorlax','gyarados'], mods: i % 2 ? 'Mono-Water · One Life' : '', gens: '1+2', daily: '', sec: i % 4 === 0 ? ['red','oak'] : [] })); saveRecords(r); openHistory(); }); },
  versus: async p => { await p.evaluate(() => openVersus()); },
  'badge info': async p => { await p.evaluate(() => openBadgeInfo()); },
  'badge reward picker': async p => { await p.evaluate(() => { G.pendingRewards = [4]; openRewardPicker(); }); },
  'gauntlet shop': async p => { await p.evaluate(() => { G.stage = runPlan().findIndex(s => s.kind === 'elite'); G.badges = 8; render(); }); },
  'game over': async p => { await p.evaluate(() => { G.over = 'lost'; render(); }); },
  'run won': async p => { await p.evaluate(() => { G.over = 'won'; render(); }); },
  battle: async p => { await p.evaluate(() => { PREF.set('motion', 'device'); setSpeed(1); }); await p.click('[data-act="endturn"]'); await p.waitForTimeout(1800); },
  'battle result + recap': async p => { await p.evaluate(() => { setSpeed(4); }); await p.click('[data-act="endturn"]'); await p.waitForFunction(() => document.querySelector('.recap, .btn[data-act="continue"], [data-act="next"]'), null, { timeout: 45000 }).catch(() => {}); await p.waitForTimeout(500); },
};
(async () => { const b = await chromium.launch(); let total = 0; const report = {};
  for(const [name, w, h] of SIZES){
    if(ONLY && !name.startsWith(ONLY)) continue;
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: w < 700 });
    await ctx.addInitScript(() => { window.PKB_TITLE = false; });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await p.waitForTimeout(400);
    // title screen separately
    for(const [sname, fn] of Object.entries(SCREENS)){
      await p.evaluate(setup); await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(120);
      try { await fn(p); } catch(e) { report[`${name} · ${sname}`] = ['(could not open: ' + e.message.split('\n')[0] + ')']; continue; }
      await p.waitForTimeout(300);
      const issues = await p.evaluate(audit);
      if(issues.length){ report[`${name} · ${sname}`] = issues; total += issues.length; }
      if(process.env.SHOTS) await p.screenshot({ path: `/tmp/claude-0/pp-${name.split(' ')[0]}-${sname.replace(/[^a-z]+/gi, '_')}.png` });
    }
    if(errs.length) report[`${name} · errors`] = errs;
    await ctx.close(); }
  await b.close();
  for(const k of Object.keys(report)) { console.log('\n## ' + k); report[k].forEach(x => console.log('  - ' + x)); }
  console.log(`\n${total} findings`); })();
