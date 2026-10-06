/* 5.5.0: floodlights per badge, home fields, the career board. */
const { chromium, devices } = require('playwright');
let fails = 0;
const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
(async () => {
  const br = await chromium.launch();
  for(const [tag, dev] of [['phone', devices['iPhone 13']], ['wide', { viewport: { width: 1250, height: 950 } }]]){
    const ctx = await br.newContext(dev); await ctx.addInitScript(() => { window.PKB_TITLE = false; });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await p.waitForTimeout(300);
    const r = await p.evaluate(() => {
      localStorage.removeItem('pkb_records');
      const o = {};
      G.badges = 5;
      const lit = b => { const el = stageShell(b); return [el.querySelectorAll('.lamp.on').length, [...el.querySelector('.ground').classList].join(' ')]; };
      o.trainer = lit({ kind:'trainer', boss:null });
      o.champ = lit({ kind:'champion', boss:{ id:'blue', theme:['Normal'] } });
      // home field: only trainer bouts, only when unlocked
      PREF.set('homefloor', 'Water');
      o.lockedFloor = floorOf({ kind:'trainer', boss:null });
      const r0 = records(); r0.history = [{ at:1, won:true, turn:40, badges:8, team:['pikachu','snorlax'] }, { at:2, won:false, badges:3, team:['pikachu'] }]; r0.cleared = 1; saveRecords(r0);
      o.seed = career();
      noteCareer({ kind:'gym', boss:{ theme:['Water'] }, steps:[{ p:[{ id:'pikachu' }], e:[] }] }, 'win');
      o.after = career();
      o.homeFloor = floorOf({ kind:'trainer', boss:null });
      o.gymFloor = floorOf({ kind:'gym', boss:{ theme:['Fire'] } });
      o.merge = mergeCareer({ battles:3, wins:2, used:{ a:2 }, floors:['Fire'], fastest:30, hit:{ dmg:50, id:'a' } }, { battles:5, wins:1, used:{ a:1, b:4 }, floors:['Water'], fastest:25, hit:{ dmg:80, id:'b' } });
      openTrainerCard();
      const d = document.querySelector('.modal.trainer');
      o.tiles = d.querySelectorAll('.career .ct').length;
      o.swatches = d.querySelectorAll('[data-hf]').length;
      o.cur = d.querySelector('.hf.cur').dataset.hf;
      d.querySelector('[data-hf="route"]').click(); o.picked = PREF.get('homefloor');
      d.querySelector('[data-hf="Ice"]').click(); o.lockedPick = PREF.get('homefloor');
      d.remove();
      return o;
    });
    check(r.trainer[0] === 5 && /crowd2/.test(r.trainer[1]), `${tag}: 5 badges light 5 floodlights, crowd level 2 (${r.trainer})`);
    check(r.champ[0] === 8 && /crowd4/.test(r.champ[1]) && /full/.test(r.champ[1]), `${tag}: the Champion plays to a full house`);
    check(r.lockedFloor === 'fl-route', `${tag}: a locked home field is ignored`);
    check(r.seed.gyms === 11 && r.seed.champs === 1 && r.seed.fastest === 40 && r.seed.used.pikachu === 2, `${tag}: career seeds from run history`);
    check(r.after.gyms === 12 && r.after.wins === 1 && r.after.floors.includes('Water'), `${tag}: a gym win counts and unlocks its floor`);
    check(r.homeFloor === 'fl-Water' && r.gymFloor === 'fl-Fire', `${tag}: trainer bouts use the home field, gyms keep theirs`);
    check(r.merge.battles === 5 && r.merge.used.b === 4 && r.merge.fastest === 25 && r.merge.hit.dmg === 80 && r.merge.floors.length === 2, `${tag}: careers merge on transfer`);
    check(r.tiles === 7 && r.swatches === 21 && r.cur === 'Water', `${tag}: Trainer Card shows the career board and home fields`);
    check(r.picked === 'route' && r.lockedPick === 'route', `${tag}: picking a home field, locked ones can't be picked`);
    check(!errs.length, `${tag}: no page errors ${errs.join(' | ')}`);
    await ctx.close();
  }
  await br.close();
  console.log(fails ? `${fails} FAILED` : 'all passed'); process.exit(fails ? 1 : 0);
})();
