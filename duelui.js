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

/* ---------------- live link (WebRTC, no server) ----------------
   Two phones swap one connection code each, once. After that the phones talk directly: teams are
   exchanged on lock-in (a fingerprint first, the team only once both are locked), then both press
   Fight and a 3-2-1 starts the same battle on both screens. If the link drops, swapping codes by hand still works. */
const LIVE = { pc:null, dc:null, step:'idle', err:'', out:'', peer:{}, mine:{}, hook:null, go:null, starting:false };
const livePaint = () => { try{ if(LIVE.hook) LIVE.hook(); }catch(e){} };
const liveOn = () => LIVE.step === 'on' && !!LIVE.dc && LIVE.dc.readyState === 'open';
const liveSend = o => { try{ if(liveOn()) LIVE.dc.send(JSON.stringify(o)); }catch(e){} };
const liveCommit = code => hash32(code).toString(36) + '.' + hash32('live|' + code).toString(36);
function liveReset(keepErr){
  const pc = LIVE.pc, dc = LIVE.dc; LIVE.pc = LIVE.dc = null;
  try{ dc && dc.close(); }catch(e){} try{ pc && pc.close(); }catch(e){}
  LIVE.step = 'idle'; LIVE.out = ''; LIVE.peer = {}; LIVE.mine = {}; LIVE.starting = false; if(!keepErr) LIVE.err = '';
}
async function livePack(desc){
  let bytes = new TextEncoder().encode(JSON.stringify({ t:desc.type, s:desc.sdp })), z = 'r';
  if(typeof CompressionStream !== 'undefined'){ try{ bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer()); z = 'z'; }catch(e){} }
  let s = ''; bytes.forEach(b => { s += String.fromCharCode(b); });
  return 'PKL1-' + z + '-' + btoa(s).replace(/=+$/, '');
}
async function liveUnpack(txt){
  const m = /^PKL1-([zr])-([A-Za-z0-9+/]+)$/.exec(String(txt).trim().replace(/\s+/g, '')); if(!m) throw new Error('That is not a link code.');
  let bytes = Uint8Array.from(atob(m[2]), c => c.charCodeAt(0));
  if(m[1] === 'z') bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
  const o = JSON.parse(new TextDecoder().decode(bytes)); if(!o || !o.s || (o.t !== 'offer' && o.t !== 'answer')) throw new Error('That link code is damaged.');
  return o;
}
const liveWaitIce = pc => new Promise(res => {
  if(pc.iceGatheringState === 'complete') return res();
  const t = setTimeout(res, 4000);
  pc.addEventListener('icegatheringstatechange', () => { if(pc.iceGatheringState === 'complete'){ clearTimeout(t); res(); } });
});
function liveNewPc(){
  const pc = new RTCPeerConnection({ iceServers:[{ urls:'stun:stun.l.google.com:19302' }] });
  pc.onconnectionstatechange = () => {
    if(LIVE.pc !== pc || pc.connectionState !== 'failed') return;
    liveReset(true); LIVE.err = 'Could not connect directly (some networks block it). Swapping codes by hand still works.'; livePaint();
  };
  return pc;
}
function liveAttach(dc){
  LIVE.dc = dc;
  dc.onopen = () => { if(LIVE.dc !== dc) return; LIVE.step = 'on'; LIVE.err = ''; LIVE.out = ''; LIVE.peer = {}; LIVE.mine = {}; liveSync(); livePaint(); };
  dc.onclose = () => { if(LIVE.dc !== dc) return; const was = LIVE.step === 'on'; liveReset(true); if(was) LIVE.err = 'The live link dropped. Swap codes by hand, or connect again.'; livePaint(); };
  dc.onmessage = e => liveMsg(e.data);
}
/** Lock-in handshake: send a fingerprint of my locked team; once I have theirs too, send the team itself. */
function liveSync(){
  if(!liveOn()) return; const set = getDuelSet(); if(!set || !set.locked) return;
  if(!LIVE.mine.commit){ LIVE.mine.commit = liveCommit(set.locked.code); liveSend({ t:'commit', h:LIVE.mine.commit }); }
  if(LIVE.peer.commit && !LIVE.mine.sent){ LIVE.mine.sent = true; liveSend({ t:'code', c:set.locked.code }); }
}
function liveMsg(raw){
  let m; try{ m = JSON.parse(raw); }catch(e){ return; } if(!m || typeof m.t !== 'string') return;
  if(m.t === 'commit' && typeof m.h === 'string' && m.h.length < 40){ if(!LIVE.peer.code){ LIVE.peer = { commit:m.h }; liveSync(); } }
  else if(m.t === 'unlock'){ if(!LIVE.peer.code) LIVE.peer = {}; }
  else if(m.t === 'code' && LIVE.peer.commit && !LIVE.peer.code && typeof m.c === 'string' && m.c.length < 4000){
    const p = duelParse(m.c);
    if(p.err || liveCommit(p.raw) !== LIVE.peer.commit){ LIVE.err = 'Your friend’s team did not match what they locked in. Swap codes by hand instead.'; LIVE.peer = {}; }
    else LIVE.peer.code = p.raw;
  }
  else if(m.t === 'ready' && LIVE.peer.code){ LIVE.peer.ready = true; if(LIVE.mine.ready && !LIVE.starting && LIVE.go){ LIVE.starting = true; LIVE.go(); return; } }
  else if(m.t === 'unready'){ LIVE.peer.ready = false; }
  livePaint();
}
async function liveAct(a, body){
  const val = id => ((body.querySelector(id) || {}).value || '');
  try{
    if(a === 'host'){
      liveReset(); LIVE.step = 'making'; livePaint();
      const pc = liveNewPc(); LIVE.pc = pc; liveAttach(pc.createDataChannel('duel'));
      await pc.setLocalDescription(await pc.createOffer()); await liveWaitIce(pc);
      if(LIVE.pc !== pc) return; LIVE.out = await livePack(pc.localDescription); LIVE.step = 'host';
    }
    else if(a === 'join'){ liveReset(); LIVE.step = 'joinin'; }
    else if(a === 'finish'){
      const o = await liveUnpack(val('#lk_in')); if(o.t !== 'answer') throw new Error('That is the host’s code. Paste the reply your friend sends back.');
      await LIVE.pc.setRemoteDescription({ type:'answer', sdp:o.s }); LIVE.step = 'connecting';
    }
    else if(a === 'mkreply'){
      const o = await liveUnpack(val('#lk_in')); if(o.t !== 'offer') throw new Error('That is a reply code. Paste the code the host sends first.');
      liveReset(); LIVE.step = 'making'; livePaint();
      const pc = liveNewPc(); LIVE.pc = pc; pc.ondatachannel = e => liveAttach(e.channel);
      await pc.setRemoteDescription({ type:'offer', sdp:o.s }); await pc.setLocalDescription(await pc.createAnswer()); await liveWaitIce(pc);
      if(LIVE.pc !== pc) return; LIVE.out = await livePack(pc.localDescription); LIVE.step = 'reply';
    }
    else if(a === 'cancel'){ liveReset(); }
    else if(a === 'copy'){ const t = body.querySelector('#lk_out'); if(t){ t.select(); try{ navigator.clipboard.writeText(t.value); }catch(e){ try{ document.execCommand('copy'); }catch(_){} } } return; }
  }catch(e){
    LIVE.err = (e && e.message) || 'Could not connect.';
    if(LIVE.step === 'making') liveReset(true);
  }
  livePaint();
}
function liveCardHtml(){
  const L = LIVE, ta = (id, v, ro, ph) => `<textarea id="${id}" rows="3" ${ro ? 'readonly' : ''} placeholder="${ph || ''}">${esc(v || '')}</textarea>`;
  const err = L.err ? `<div class="dmsg">${esc(L.err)}</div>` : '';
  let h;
  if(L.step === 'on') h = `<b>● Live link on.</b> You will both watch the fight at the same moment. ${L.peer.commit ? 'Your friend has locked in.' : ''}
    <div class="btnrow tight"><button class="btn small ghost" data-l="cancel">Disconnect</button></div>`;
  else if(L.step === 'making') h = '<b>Live link</b> · making your code…';
  else if(L.step === 'host') h = `<b>Live link: you host</b><p>1. Send this code to your friend.</p>${ta('lk_out', L.out, 1)}
    <div class="btnrow tight"><button class="btn small" data-l="copy">Copy</button></div><p>2. Paste the reply code they send back.</p>${ta('lk_in', '', 0, 'PKL1-…')}
    <div class="btnrow tight"><button class="btn small primary" data-l="finish">Connect</button><button class="btn small ghost" data-l="cancel">Cancel</button></div>`;
  else if(L.step === 'joinin') h = `<b>Live link: you join</b><p>Paste the code your friend (the host) sent you.</p>${ta('lk_in', '', 0, 'PKL1-…')}
    <div class="btnrow tight"><button class="btn small primary" data-l="mkreply">Make my reply</button><button class="btn small ghost" data-l="cancel">Cancel</button></div>`;
  else if(L.step === 'reply') h = `<b>Live link: you join</b><p>Send this reply code back to the host. It connects by itself.</p>${ta('lk_out', L.out, 1)}
    <div class="btnrow tight"><button class="btn small" data-l="copy">Copy</button><button class="btn small ghost" data-l="cancel">Cancel</button></div>`;
  else if(L.step === 'connecting') h = '<b>Live link</b> · connecting…';
  else h = `<b>Live link</b> <span class="dim">(optional)</span><p class="dim">Connect once and you both watch each fight live, with no codes to paste each game.</p>
    <div class="btnrow tight"><button class="btn small" data-l="host">I’ll host</button><button class="btn small" data-l="join">I’m joining</button></div>`;
  return `<div class="dlive">${err}${h}</div>`;
}

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
  /* the page address can't be edited inside the published page, so tapping the heading five times turns developer tools on (and off) */
  let taps = 0; d.querySelector('h3').addEventListener('click', () => { if(++taps >= 5){ try{ localStorage.setItem('pkb_dev', duelDev() ? '0' : '1'); }catch(e){} d.remove(); openDuels(); } });
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
  const KEEP = ['#lk_in', '#theircode'];
  const paint = () => {
    const kept = KEEP.map(q => { const e = body.querySelector(q); return e ? e.value : null; });
    set = getDuelSet(); body.innerHTML = setHtml(set);
    KEEP.forEach((q, i) => { const e = body.querySelector(q); if(e && kept[i] != null) e.value = kept[i]; });
  };
  const close = () => { LIVE.hook = LIVE.go = null; if(LIVE.mine.ready){ LIVE.mine.ready = false; liveSend({ t:'unready' }); } d.remove(); duelDraft = null; };
  /* checks their code and, if it's a legal move, records the game and shows the battle. Returns an error message or ''. */
  const runFight = raw => {
    set = getDuelSet(); const parsed = duelParse(raw);
    if(parsed.err) return parsed.err;
    if(parsed.raw === set.locked.code) return 'That is your own code. Paste your friend’s.';
    const why = duelCheckOpponent(set, parsed); if(why) return why;
    const out = duelSim(set, set.locked.code, parsed.raw);
    duelApply(set, out); putDuelSet(set); duelDraft = null;      // recorded now, so a reload can't replay it with a different team
    LIVE.hook = LIVE.go = null; LIVE.peer = {}; LIVE.mine = {}; LIVE.starting = false;
    d.remove(); playDuelBattle(out, set); return '';
  };
  LIVE.hook = () => { if(!d.isConnected){ LIVE.hook = LIVE.go = null; } else if(!LIVE.starting) paint(); };
  paint(); liveSync();
  d.addEventListener('click', ev => {
    const b = ev.target.closest('[data-m],[data-l],[data-pick],[data-up],[data-down],[data-drop]'); if(!b) return;
    if(b.dataset.l){ liveAct(b.dataset.l, body); return; }
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
      set.locked = { picks, code: duelCode(set, box, picks) }; putDuelSet(set); paint(); liveSync(); }
    else if(m === 'unlock'){ set.locked = null; putDuelSet(set); if(LIVE.mine.commit){ liveSend({ t:'unlock' }); LIVE.mine = {}; } paint(); }
    else if(m === 'copy'){ const t = body.querySelector('#mycode'); t.select(); try{ navigator.clipboard.writeText(t.value); }catch(e){ try{ document.execCommand('copy'); }catch(_){} } b.textContent = 'Copied'; }
    else if(m === 'fight'){
      if(liveOn()){
        if(!LIVE.peer.code || LIVE.mine.ready) return;
        const parsed = duelParse(LIVE.peer.code), why = parsed.err || duelCheckOpponent(set, parsed);
        if(why){ toastDuel(body, why); return; }
        LIVE.mine.ready = true; liveSend({ t:'ready' });
        LIVE.go = () => {                                  // 3-2-1, then the same battle on both screens
          LIVE.starting = true; let n = 3;
          const tick = () => { if(!d.isConnected) return;
            if(n === 0){ const e = runFight(LIVE.peer.code); if(e){ LIVE.starting = false; paint(); toastDuel(body, e); } return; }
            body.innerHTML = `<div class="dcount">${n}</div><p class="dim" style="text-align:center">Both screens start together…</p>`; n--; setTimeout(tick, 1000); };
          tick(); };
        if(LIVE.peer.ready){ LIVE.starting = true; LIVE.go(); } else paint();
        return;
      }
      const err = runFight(body.querySelector('#theircode').value); if(err) toastDuel(body, err);
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
  const live = liveCardHtml();
  if(set.locked && liveOn()){
    const P = LIVE.peer, who = esc(P.code ? duelParse(P.code).name : (set.opp || 'your friend'));
    const st = P.code ? `${who} is locked in${P.ready ? ' and ready' : ''}. Their team stays hidden until the fight.` : P.commit ? 'Swapping teams…' : `Waiting for ${who} to lock in…`;
    return `${head}${hist}${live}<p><b>Your team is locked in.</b> ${st}</p>
      <div class="btnrow"><button class="btn primary" data-m="fight" ${P.code && !LIVE.mine.ready ? '' : 'disabled'}>${LIVE.mine.ready ? `Waiting for ${who}…` : `Fight game ${set.game}`}</button>
      ${LIVE.mine.sent ? '' : '<button class="btn ghost" data-m="unlock">Change my team</button>'}<button class="btn ghost" data-m="hub">Close</button></div>`;
  }
  if(set.locked){
    return `${head}${hist}${live}<p><b>Your team is locked in.</b> Send this code to ${esc(set.opp || 'your friend')}, then paste theirs below.</p>
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
  return `${head}${hist}${live}
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
