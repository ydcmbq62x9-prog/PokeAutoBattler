/* 4.12.0: challenges and special badges, UI side. */
const { chromium } = require('playwright');
let fails = 0; const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport:{ width:390, height:844 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.addInitScript(() => { window.PKB_TITLE = false; });
  await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await p.waitForTimeout(700);
  await p.evaluate(() => { document.querySelectorAll('.modal').forEach(m => m.remove()); localStorage.removeItem('pkb_records'); openNewRun(); });
  check(await p.evaluate(() => ['onelife','nopc','noitems','nolegend','hardgyms','tight'].every(k => document.querySelector(`.newrun [data-mod="${k}"] svg, .newrun [data-mod="${k}"] img`))), 'New Run lists all six challenges, each with its badge');
  for(const k of ['noitems', 'hardgyms']) await p.click(`[data-mod="${k}"]`);
  check(await p.evaluate(() => /Turn on 3/.test(document.querySelector('.chgold').textContent)), 'two on: hint says 3 for gold');
  await p.click('[data-mod="tight"]');
  check(await p.evaluate(() => /Gold run/.test(document.querySelector('.chgold').textContent)), 'three on: Gold run');
  await p.click('[data-n="go"]'); await p.waitForTimeout(200);
  check(await p.evaluate(() => G.mods.noitems && G.mods.hardgyms && G.mods.tight && !G.mods.nolegend), 'the run starts with those three');
  check(await p.evaluate(() => /No Held Items/.test(modsLabel(G))), 'and they show in its label');
  // win it
  const aw = await p.evaluate(() => { G.over = 'won'; G.badges = 8; phase = 'over'; noteRunEnd(); render(); const r = records();
    return { ch: r.chal, nw: G.chNew, hist: r.history[0] }; });
  check(aw.ch.noitems.count === 1 && aw.ch.noitems.gold === 1 && aw.ch.tight.gold === 1 && aw.ch.hardgyms.count === 1, 'a gold clear: count and gold for each');
  check(aw.nw.length === 3 && aw.nw.every(x => x.isNew), 'all three are new');
  check(aw.hist.ch.length === 3 && aw.hist.chg, 'run history remembers them');
  check(await p.evaluate(() => document.querySelectorAll('.hcaward.multi .chone').length === 3), 'end screen shows the three badges');
  // a plain one-life + mono clear (not gold)
  const m = await p.evaluate(() => { newRun({ mods:{ onelife:true, mono:'Fire' } }); G.over = 'won'; G.badges = 8; phase = 'over'; noteRunEnd(); render(); const r = records(); return { hc: r.hardcore, mono: r.chal.mono, gold: G.chGold }; });
  check(m.hc.count === 1 && !m.hc.gold && m.mono.count === 1 && m.mono.types.join() === 'Fire' && !m.gold, 'two challenges: counted, not gold; Mono stamps Fire');
  check(await p.evaluate(() => { const before = records().chal.mono.count; awardChallenges(); return records().chal.mono.count === before; }), 'awarding twice does nothing');
  // a lost run earns nothing
  check(await p.evaluate(() => { newRun({ mods:{ nolegend:true } }); G.over = 'lost'; noteRunEnd(); return !(records().chal.nolegend); }), 'a lost run earns no badge');
  // trainer card
  await p.evaluate(() => { document.querySelectorAll('.modal').forEach(m => m.remove()); openTrainerCard(); });
  check(await p.evaluate(() => document.querySelectorAll('.sbt').length === 10 && document.querySelectorAll('.sbt.on').length === 5 && document.querySelectorAll('.sbt.gold').length === 3), 'Trainer Card: 10 tiles, 5 earned, 3 gold');
  await p.click('[data-sb="mono"]');
  check(await p.evaluate(() => /Mono Badge/.test(document.querySelector('.sbinfo').textContent) && document.querySelector('.sbtypes i').textContent === 'Fire'), 'tapping a tile explains it (Mono shows its types)');
  await p.click('[data-sb="red"]');
  check(await p.evaluate(() => /Not earned yet/.test(document.querySelector('.sbinfo').textContent)), 'locked tiles say how to earn them');
  // transfer merge keeps the best of both
  const mg = await p.evaluate(() => mergeChal({ mono:{ count:2, types:['Fire'], first:'2026-10-01', last:'2026-10-02' } }, { mono:{ count:1, gold:1, types:['Water'], first:'2026-09-30', last:'2026-09-30' }, tight:{ count:1, first:'2026-10-03', last:'2026-10-03' } }));
  check(mg.mono.count === 2 && mg.mono.gold === 1 && mg.mono.types.sort().join() === 'Fire,Water' && mg.mono.first === '2026-09-30' && mg.tight.count === 1, 'transfer merge keeps counts, gold and Mono types from both');
  check(await p.evaluate(() => /\+?\d*/.test(titleBadgesHtml()) && (titleBadgesHtml().match(/class="thc/g) || []).length === 4), 'title shows 4 badges (+ more)');
  check(errs.length === 0, 'no page errors ' + errs.join(' | '));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'all good'); process.exit(fails ? 1 : 0);
})();
