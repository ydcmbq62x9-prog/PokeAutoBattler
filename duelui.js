/* ===================================================================
   DUELS — screens (6.13.0, multiplayer branch)
   The rules live in engine.js (duel*). This file is the box, the team picker, the
   code exchange and the run-over save picker. Everything is a modal over whatever
   screen you came from, so a duel never touches the run you have going.
   =================================================================== */
const DUEL_BOX_KEY = 'pkb_duel_box', DUEL_SET_KEY = 'pkb_duel_set';
const duelJSON = (k, d) => { try{ const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; }catch(e){ return d; } };
const duelBox = () => duelJSON(DUEL_BOX_KEY, []).filter(s => s && SPECIES[s.id]);
const saveDuelBox = b => { try{ localStorage.setItem(DUEL_BOX_KEY, JSON.stringify(b)); }catch(e){} };
const getDuelSet = () => duelJSON(DUEL_SET_KEY, null);
const putDuelSet = s => { try{ if(s) localStorage.setItem(DUEL_SET_KEY, JSON.stringify(s)); else localStorage.removeItem(DUEL_SET_KEY); }catch(e){} };
const duelDev = () => { try{ if(location.hash === '#dev') localStorage.setItem('pkb_dev', '1'); return localStorage.getItem('pkb_dev') === '1'; }catch(e){ return false; } };
const DUEL = TUNING.duel;
const itemName = id => (HELD_ITEMS[id] || {}).name || '';
const cardOf = (s, extra) => { const u = thawUnit(s); u.uid = 'd' + s.bid;
  return `<div class="slot dcard ${extra && extra.cls || ''}" ${extra && extra.attr || ''} style="border-style:solid">${unitHtml(u, { held:false })}
    ${extra && extra.noitem ? '' : `<div class="dcard-item">${s.held ? '🎒 ' + esc(itemName(s.held)) : '<span class="dim">no item</span>'}</div>`}${extra && extra.foot || ''}</div>`; };

/* ---------------- the hub ---------------- */
function openDuels(){
  const box = duelBox(), set = getDuelSet();
  const w = set && duelWins(set);
  const d = modal(`<h3>Duels</h3>
    <p class="dim">Battle a friend with pokémon you saved from your runs. Swap codes to play: no accounts, no server. Best of three, six against six, within a power budget of ${DUEL.budget}.</p>
    <div class="dstat"><b>${box.length} / ${DUEL.boxSize}</b> in your box${box.length ? '' : ' — finish a run and save a pokémon to start'}</div>
    ${set ? `<div class="dstat">${set.over ? `Set against <b>${esc(set.opp || 'a friend')}</b> finished: ${set.over === 'win' ? 'you won' : set.over === 'lose' ? 'you lost' : 'a draw'} ${w.me}–${w.opp}.`
      : `A set${set.opp ? ' against <b>' + esc(set.opp) + '</b>' : ''} is in progress · game ${set.game} of ${DUEL.games}${set.games.length ? ` · ${w.me}–${w.opp}` : ''}.`}</div>` : ''}
    <div class="btnrow">
      <button class="btn primary" data-m="set" ${box.length ? '' : 'disabled'}>${set ? (set.over ? 'See the result' : 'Resume the set') : 'Start a set'}</button>
      <button class="btn" data-m="box">My box</button>
      <button class="btn" data-m="how">How it works</button>
      <button class="btn ghost" data-m="close">Close</button></div>
    ${duelDev() ? `<hr><div class="dim">Developer tools</div><div class="btnrow">
      <select id="devsp">${Object.keys(SPECIES).filter(k => !SPECIES[k].legendary && SPRITES[k] && evoLine(k)[evoLine(k).length - 1] === k).sort().map(k => `<option value="${k}">${esc(SPECIES[k].name)}</option>`).join('')}</select>
      <button class="btn" data-m="devadd">Add maxed</button><button class="btn" data-m="devfill">Fill the box</button>
      <button class="btn ghost" data-m="devclear">Clear box + set</button></div>` : ''}`);
  d.addEventListener('click', ev => {
    const b = ev.target.closest('[data-m]'); if(!b) return; const m = b.dataset.m;
    if(m === 'close') d.remove();
    else if(m === 'box'){ d.remove(); openDuelBox(); }
    else if(m === 'how'){ d.remove(); openDuelHow(); }
    else if(m === 'set'){ d.remove(); openDuelSet(); }
    else if(m === 'devadd'){ const k = d.querySelector('#devsp').value; saveDuelBox(duelBoxAdd(duelBox().slice(0, DUEL.boxSize - 1), [maxedSnap(k)]).box); d.remove(); openDuels(); }
    else if(m === 'devfill'){ const have = duelBox(), ks = Object.keys(SPECIES).filter(k => !SPECIES[k].legendary && SPRITES[k] && evoLine(k)[evoLine(k).length - 1] === k).sort(() => Math.random() - .5);
      const add = []; for(const k of ks){ if(have.length + add.length >= DUEL.boxSize) break; add.push(maxedSnap(k)); } saveDuelBox(have.concat(add)); d.remove(); openDuels(); }
    else if(m === 'devclear'){ saveDuelBox([]); putDuelSet(null); d.remove(); openDuels(); }
  });
  return d;
}
/** Dev only: a finished pokémon at level 3 with every vitamin taken. */
function maxedSnap(id){ const u = makeUnit(id, TUNING.expForLevel3 + 1); const cap = TUNING.vitaminCap;
  u.hp += 8 * cap; u.atk += 9 * cap; u.spd += 10 * cap; return snapUnit(u, undefined, 'dev'); }
function openDuelHow(){
  const d = modal(`<h3>How duels work</h3>
    <p><b>Your box.</b> It holds ${DUEL.boxSize} pokémon, saved exactly as they were: their level, stats and held item are frozen. At the end of a run you save up to ${DUEL.saveWin} from a win, or ${DUEL.saveLoss} from a loss.</p>
    <p><b>A set.</b> Best of ${DUEL.games}: first to two wins. Each game you bring up to ${DUEL.bring} from your box, and the team has to fit the power budget (${DUEL.budget}).</p>
    <p><b>Fainting.</b> A pokémon that faints sits out the next game only, so you need about twelve usable.</p>
    <p><b>Items.</b> A pokémon keeps the item it was saved with. The items on your first six are your pool for the set: from game 2 you can move those around, but a pokémon swapped in arrives without its own item.</p>
    <p><b>Playing.</b> Pick your team and lock it in to get your code. Send it to your friend, paste theirs, and you both see the same battle. You can only open their code after you have locked yours, so nobody can peek and counter-pick.</p>
    <div class="btnrow"><button class="btn primary" data-m="close">Got it</button></div>`);
  d.addEventListener('click', ev => { if(ev.target.closest('[data-m]')){ d.remove(); openDuels(); } });
}

/* ---------------- the box ---------------- */
function openDuelBox(){
  const box = duelBox();
  const d = modal(`<h3>My box <span class="dim">${box.length} / ${DUEL.boxSize}</span></h3>
    <p class="dim">Frozen: nothing here grows or evolves. Tap Release to make room.</p>
    <div class="dgrid">${box.map(s => cardOf(s, { foot:`<button class="btn small ghost" data-rel="${s.bid}">Release</button>` })).join('') || '<p class="dim">Empty. Finish a run and save a pokémon to fill it.</p>'}</div>
    <div class="btnrow"><button class="btn" data-m="back">Back</button></div>`);
  d.addEventListener('click', ev => {
    const r = ev.target.closest('[data-rel]');
    if(r){ if(r.dataset.sure !== '1'){ r.dataset.sure = '1'; r.textContent = 'Really release?'; return; }
      saveDuelBox(duelBox().filter(s => s.bid !== r.dataset.rel)); d.remove(); openDuelBox(); return; }
    if(ev.target.closest('[data-m]')){ d.remove(); openDuels(); }
  });
}

/* ---------------- a set ---------------- */
let duelDraft = null;     // { picks:[{bid,item}] } while choosing a team
function openDuelSet(){
  let set = getDuelSet();
  if(!set){ set = newDuelSet(playerName(), GAME_VERSION.v); putDuelSet(set); }
  const d = modal('', true);
  const body = d.querySelector('.boxscroll');
  const paint = () => { set = getDuelSet(); body.innerHTML = setHtml(set); };
  const close = () => { d.remove(); duelDraft = null; };
  paint();
  d.addEventListener('click', ev => {
    const b = ev.target.closest('[data-m],[data-pick],[data-up],[data-down],[data-drop]'); if(!b) return;
    set = getDuelSet(); const box = duelBox();
    const dr = duelDraft || (duelDraft = { picks: [] });
    if(b.dataset.pick){ const i = dr.picks.findIndex(p => p.bid === b.dataset.pick);
      if(i >= 0) dr.picks.splice(i, 1);
      else if(dr.picks.length < DUEL.bring){ const s = box.find(x => x.bid === b.dataset.pick); dr.picks.push({ bid:s.bid, item: set.pool ? null : (s.held || null) }); }
      paint(); return; }
    if(b.dataset.up){ const i = +b.dataset.up; if(i > 0){ [dr.picks[i - 1], dr.picks[i]] = [dr.picks[i], dr.picks[i - 1]]; } paint(); return; }
    if(b.dataset.down){ const i = +b.dataset.down; if(i < dr.picks.length - 1){ [dr.picks[i + 1], dr.picks[i]] = [dr.picks[i], dr.picks[i + 1]]; } paint(); return; }
    if(b.dataset.drop){ dr.picks.splice(+b.dataset.drop, 1); paint(); return; }
    const m = b.dataset.m;
    if(m === 'hub'){ close(); openDuels(); }
    else if(m === 'finish'){ putDuelSet(null); close(); openDuels(); }
    else if(m === 'lock'){
      const picks = dr.picks.map((p, i) => ({ bid:p.bid, item:p.item, pos:i }));
      const why = duelCheckPicks(set, box, picks); if(why){ toastDuel(body, why); return; }
      set.locked = { picks, code: duelCode(set, box, picks) }; putDuelSet(set); paint(); }
    else if(m === 'unlock'){ set.locked = null; putDuelSet(set); paint(); }
    else if(m === 'copy'){ const t = body.querySelector('#mycode'); t.select(); try{ navigator.clipboard.writeText(t.value); }catch(e){ try{ document.execCommand('copy'); }catch(_){} } b.textContent = 'Copied'; }
    else if(m === 'fight'){
      const txt = body.querySelector('#theircode').value, parsed = duelParse(txt);
      if(parsed.err){ toastDuel(body, parsed.err); return; }
      if(parsed.raw === set.locked.code){ toastDuel(body, 'That is your own code. Paste your friend’s.'); return; }
      const why = duelCheckOpponent(set, parsed); if(why){ toastDuel(body, why); return; }
      const out = duelSim(set, set.locked.code, parsed.raw);
      duelApply(set, out); putDuelSet(set); duelDraft = null;      // recorded now, so a reload can't replay it with a different team
      d.remove(); playDuelBattle(out, set);
    }
  });
  d.addEventListener('change', ev => {
    const sel = ev.target.closest('[data-item]'); if(!sel || !duelDraft) return;
    duelDraft.picks[+sel.dataset.item].item = sel.value || null; paint();
  });
  return d;
}
const toastDuel = (body, msg) => { let t = body.querySelector('.dmsg'); if(!t){ t = document.createElement('div'); t.className = 'dmsg'; body.prepend(t); } t.textContent = msg; t.scrollIntoView({ block:'nearest' }); };

function setHtml(set){
  const box = duelBox(), D = DUEL, w = duelWins(set);
  const head = `<h3>Set vs ${esc(set.opp || 'a friend')} <span class="dim">game ${Math.min(set.game, D.games)} of ${D.games}${set.games.length ? ` · ${w.me}–${w.opp}` : ''}</span></h3>`;
  const hist = set.games.length ? `<div class="dhist">${set.games.map((g, i) => `<span class="dres ${g.result}">Game ${i + 1}: ${g.result === 'win' ? 'won' : g.result === 'lose' ? 'lost' : 'drawn'}</span>`).join('')}</div>` : '';
  if(set.over){
    return `${head}${hist}<div class="dverdict ${set.over}">${set.over === 'win' ? 'You won the set!' : set.over === 'lose' ? 'You lost the set.' : 'The set is a draw.'} <span class="dim">${w.me}–${w.opp}</span></div>
      <p class="dim">Everything goes back to how it was: the pokémon in your box are unchanged.</p>
      <div class="btnrow"><button class="btn primary" data-m="finish">Finish set</button></div>`;
  }
  if(set.locked){
    return `${head}${hist}<p><b>Your team is locked in.</b> Send this code to ${esc(set.opp || 'your friend')}, then paste theirs below.</p>
      <textarea id="mycode" readonly rows="3">${esc(set.locked.code)}</textarea>
      <div class="btnrow"><button class="btn" data-m="copy">Copy my code</button><button class="btn ghost" data-m="unlock">Change my team</button></div>
      <p><b>Their code</b> <span class="dim">(you can open it because yours is locked)</span></p>
      <textarea id="theircode" rows="3" placeholder="PKD1-…"></textarea>
      <div class="btnrow"><button class="btn primary" data-m="fight">Fight game ${set.game}</button><button class="btn ghost" data-m="hub">Close</button></div>`;
  }
  const dr = duelDraft || { picks: [] }, pool = (set.pool || []).slice();
  const el = duelEligible(set, box), units = dr.picks.map((p, i) => { const s = box.find(x => x.bid === p.bid); return s ? thawUnit(s, i, p.item) : null; }).filter(Boolean);
  const power = Math.round(duelPower(units)), over = power > set.budget;
  const picksForCheck = dr.picks.map((p, i) => ({ bid:p.bid, item:p.item, pos:i }));
  const why = dr.picks.length ? duelCheckPicks(set, box, picksForCheck) : 'Pick your team from the box below.';
  const left = pool.slice(); dr.picks.forEach(p => { const i = left.indexOf(p.item); if(p.item && i >= 0) left.splice(i, 1); });
  const rw = TUNING.rankWidth;
  return `${head}${hist}
    <div class="dmeter"><i style="width:${Math.min(100, power / set.budget * 100)}%" class="${over ? 'over' : ''}"></i><span>Power ${power} / ${set.budget}</span></div>
    <div class="dteam">${dr.picks.map((p, i) => { const s = box.find(x => x.bid === p.bid); if(!s) return '';
      const pooled = set.pool ? `<select data-item="${i}"><option value="">no item</option>${[...new Set(pool)].map(id => `<option value="${id}" ${p.item === id ? 'selected' : ''}>${esc(itemName(id))}${pool.filter(x => x === id).length > 1 ? ' ×' + pool.filter(x => x === id).length : ''}</option>`).join('')}</select>` : (s.held ? `<div class="dcard-item">🎒 ${esc(itemName(s.held))}</div>` : '<div class="dcard-item dim">no item</div>');
      return cardOf(s, { cls:'picked', noitem:true, foot:`<div class="dpos">${i < rw ? 'Front' : i < rw * 2 ? 'Middle' : 'Back'}</div>${pooled}
        <div class="btnrow tight"><button class="btn small" data-up="${i}" aria-label="Move forward">◀</button><button class="btn small" data-down="${i}" aria-label="Move back">▶</button><button class="btn small ghost" data-drop="${i}">Remove</button></div>` }); }).join('')}</div>
    ${set.pool ? `<p class="dim">Items you can still hand out: ${left.length ? left.map(id => esc(itemName(id))).join(', ') : 'none (all in use)'}. A pokémon brought in from the box arrives without its saved item.</p>` : '<p class="dim">Game 1: every pokémon holds the item it was saved with. Those items become your pool for the set.</p>'}
    <div class="${why && dr.picks.length ? 'dmsg' : 'dim'}">${esc(why || 'Ready. Lock it in when you are happy.')}</div>
    <div class="btnrow"><button class="btn primary" data-m="lock" ${why ? 'disabled' : ''}>Lock in my team</button><button class="btn ghost" data-m="hub">Close</button></div>
    <h4>Your box</h4><p class="dim">Tap to add or remove. Pokémon that fainted last game are resting.</p>
    <div class="dgrid">${el.ready.map(s => cardOf(s, { cls: dr.picks.some(p => p.bid === s.bid) ? 'sel' : '', attr:`data-pick="${s.bid}" role="button"` })).join('')}
      ${el.resting.map(s => cardOf(s, { cls:'rest', foot:'<div class="dpos">Resting this game</div>' })).join('')}</div>`;
}

/* ---------------- the battle ---------------- */
function playDuelBattle(out, set){
  if(titleEl){ const t = document.getElementById('title'); if(t) t.remove(); titleEl = null; document.body.classList.remove('titled'); }
  const sim = out.sim, flip = !out.iAmP;
  battle = { steps: sim.steps, i:0, result: flip ? (sim.result === 'win' ? 'lose' : sim.result === 'lose' ? 'win' : 'draw') : sim.result,
             oppName: set.opp, timer:null, exhibition:true, duel:true, flip,
             onDone: () => openDuelSet() };
  sessionBattles++;
  transition(() => { phase = 'battle'; render(); window.scrollTo(0, 0); }, beginPlayback);
}

/* ---------------- run over: save to the box ---------------- */
let mpSel = new Set();
function duelSaveHtml(){
  if(!G || !G.over) return '';
  const won = G.over === 'won', n = duelSavesFor(won), box = duelBox();
  if(G.mpSaved) return `<div class="panel dsave"><b>Saved to your duel box.</b> <button class="btn small" data-act="mpbox">Open box</button></div>`;
  const units = G.team.concat(G.pc || []).filter(Boolean);
  const room = DUEL.boxSize - box.length;
  return `<div class="panel dsave"><h3 style="margin:0 0 4px">Save to your duel box</h3>
    <p class="dim">${won ? 'You won' : 'You lost'}: pick up to <b>${n}</b>. They are saved exactly as they are now and never change. ${room < n ? `Your box has room for ${room}; release some to fit more.` : ''}</p>
    <div class="dgrid small">${units.map(u => `<div class="slot dcard ${mpSel.has(u.uid) ? 'sel' : ''}" data-act="mppick" data-uid="${u.uid}" role="button" style="border-style:solid">${unitHtml(u, { held:false })}<div class="dcard-item">${u.held ? '🎒 ' + esc(itemName(u.held)) : '<span class="dim">no item</span>'}</div></div>`).join('')}</div>
    <div class="btnrow"><button class="btn primary" data-act="mpsave" ${mpSel.size && mpSel.size <= Math.min(n, room) ? '' : 'disabled'}>Save ${mpSel.size || ''} to my box</button>
      <button class="btn ghost" data-act="mpskip">Skip</button></div></div>`;
}
function duelSaveAct(act, el){
  const won = G.over === 'won', n = duelSavesFor(won);
  if(act === 'mppick'){ const uid = +el.dataset.uid; if(mpSel.has(uid)) mpSel.delete(uid); else if(mpSel.size < n) mpSel.add(uid); render(); return true; }
  if(act === 'mpsave'){
    const snaps = G.team.concat(G.pc || []).filter(u => u && mpSel.has(u.uid)).map(u => snapUnit(u, undefined, won ? 'win' : 'loss'));
    const r = duelBoxAdd(duelBox(), snaps); if(!r.ok){ say(r.why); return true; }
    saveDuelBox(r.box); G.mpSaved = true; mpSel = new Set(); save(); SFX.play('levelup'); render(); return true; }
  if(act === 'mpskip'){ G.mpSaved = true; mpSel = new Set(); save(); render(); return true; }
  if(act === 'mpbox'){ openDuelBox(); return true; }
  return false;
}
