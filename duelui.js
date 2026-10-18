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
/** 6.20.0: what a saved item shows on its card; run-economy items say they are switched off in duels. */
const itemLine = id => !id ? '<span class="dim">no item</span>' : duelItem(id) ? '🎒 ' + esc(itemName(id))
  : `<span class="dim" title="Only helps during a run, so it is switched off in duels">🎒 <s>${esc(itemName(id))}</s> off</span>`;
const cardOf = (s, extra) => { const u = thawUnit(s); u.uid = 'd' + s.bid;
  return `<div class="slot dcard ${extra && extra.cls || ''}" ${extra && extra.attr || ''} style="border-style:solid">${unitHtml(u, { held:false })}
    ${extra && extra.noitem ? '' : `<div class="dcard-item">${itemLine(s.held)}</div>`}${extra && extra.foot || ''}</div>`; };

/* ---------------- live link (WebRTC, no server) ----------------
   One player hosts and gets a 4-letter code; the other types it. The free PeerJS matchmaking server only introduces the
   two phones (it never sees teams); after that they talk directly (WebRTC). Teams are exchanged on lock-in (a fingerprint
   first, the team only once both are locked), then both press Fight and a 3-2-1 starts the same battle on both screens.
   Inside the claude.ai preview page neither is reachable, so the page's own live room carries the same code instead.
   If the link drops, connecting again picks up where the set left off (6.17.0: the long copy-and-paste codes are gone). */
const LIVE = { pc:null, dc:null, tr:null, cleanup:null, room:undefined, code:'', step:'idle', err:'', out:'', peer:{}, mine:{}, hook:null, go:null, starting:false };
const livePaint = () => { try{ if(LIVE.hook) LIVE.hook(); }catch(e){} };
const liveOn = () => LIVE.step === 'on' && !!LIVE.tr && LIVE.tr.ok();
const liveSend = o => { try{ if(liveOn()) LIVE.tr.send(JSON.stringify(o)); }catch(e){} };
/** Can this window make a direct (WebRTC) link? The preview page on claude.ai blocks it, so test by really trying. */
let _rtc;
const liveRtcOk = () => { if(_rtc === undefined){ try{ const t = new RTCPeerConnection(); t.close(); _rtc = true; }catch(e){ _rtc = false; } } return _rtc; };
/** Fallback inside the preview page: the page's own live room (needs the viewer signed in with access to the page). */
async function liveProbe(){
  if(LIVE.room !== undefined) return; LIVE.room = null;
  try{ if(window.claude && typeof claude.use === 'function') LIVE.room = (await claude.use('room')) || null; }catch(e){}
  livePaint();
}
const liveCommit = code => hash32(code).toString(36) + '.' + hash32('live|' + code).toString(36);
function liveReset(keepErr){
  const pc = LIVE.pc, dc = LIVE.dc, cl = LIVE.cleanup; LIVE.pc = LIVE.dc = LIVE.tr = LIVE.cleanup = null; LIVE.code = '';
  try{ cl && cl(); }catch(e){} try{ dc && dc.close(); }catch(e){} try{ pc && pc.close(); }catch(e){}
  LIVE.step = 'idle'; LIVE.out = ''; LIVE.peer = {}; LIVE.mine = {}; LIVE.starting = false; if(!keepErr) LIVE.err = '';
}
function liveAttach(dc){
  LIVE.dc = dc; LIVE.tr = { send:s => dc.send(s), ok:() => dc.readyState === 'open', close:() => dc.close() };
  dc.onopen = () => { if(LIVE.dc !== dc) return; try{ if(LIVE.cleanup) LIVE.cleanup(); }catch(e){} LIVE.cleanup = null; LIVE.step = 'on'; LIVE.err = ''; LIVE.out = ''; LIVE.peer = {}; LIVE.mine = {}; liveSync(); livePaint(); };
  dc.onclose = () => { if(LIVE.dc !== dc) return; const was = LIVE.step === 'on'; liveReset(true); if(was) LIVE.err = 'The live link dropped. Connect again to keep playing.'; livePaint(); };
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
    if(p.err || liveCommit(p.raw) !== LIVE.peer.commit){ LIVE.err = 'Your friend’s team did not match what they locked in. Connect again.'; LIVE.peer = {}; }
    else LIVE.peer.code = p.raw;
  }
  else if(m.t === 'ready' && LIVE.peer.code){ LIVE.peer.ready = true; if(LIVE.mine.ready && !LIVE.starting && LIVE.go){ LIVE.starting = true; LIVE.go(); return; } }
  else if(m.t === 'unready'){ LIVE.peer.ready = false; }
  livePaint();
}
async function liveRoom(code){
  const room = LIVE.room; if(!room) throw new Error('Live rooms are not available in this window.');
  liveReset(); LIVE.step = 'rwait'; LIVE.code = code; livePaint();
  const nr = await room.join('pkd-' + String(code).toLowerCase()), me = Math.random().toString(36).slice(2, 10);
  let peer = null, seen = 0, iv = 0, unsub = () => {};
  const emit = d => { try{ nr.emit('m', Object.assign({ id:me }, d)).catch(() => {}); }catch(e){} };
  const tr = { send:s => emit({ to:peer, m:s }), ok:() => !!peer, close:() => cleanup() };
  const cleanup = () => { clearInterval(iv); try{ unsub(); }catch(e){} try{ nr.leave().catch(() => {}); }catch(e){} };
  LIVE.cleanup = cleanup;
  const pair = id => { peer = id; seen = Date.now(); LIVE.tr = tr; LIVE.step = 'on'; LIVE.err = ''; LIVE.peer = {}; LIVE.mine = {}; liveSync(); livePaint(); };
  unsub = nr.on('m', msg => {
    const d = msg && msg.data; if(!d || msg.isMe || typeof d.id !== 'string') return;
    if(d.hi){        // the first one to say hello is the only one ever heard; replies are addressed so a stranger can't pick them up
      if(d.id === peer){ seen = Date.now(); if(d.needy) emit({ hi:1, to:peer }); return; }
      if(!peer && (d.needy || d.to === me)){ pair(d.id); if(d.needy) emit({ hi:1, to:d.id }); }
      return; }
    if(d.id !== peer || d.to !== me) return; seen = Date.now();
    if(d.hb) return; if(typeof d.m === 'string') liveMsg(d.m);
  });
  iv = setInterval(() => {
    if(!peer) emit({ hi:1, needy:1 });
    else { emit({ hb:1, to:peer }); if(Date.now() - seen > 12000){ liveReset(true); LIVE.err = 'Your friend left the room. Connect again to keep playing.'; livePaint(); } }
  }, 1500);
  emit({ hi:1, needy:1 });
}

const LIVE_ICE = [{ urls:'stun:stun.l.google.com:19302' }, { urls:'stun:stun1.l.google.com:19302' }];
const liveBroker = () => window.__peerBroker || { host:'0.peerjs.com', port:443, secure:true, path:'/peerjs', key:'peerjs' };
const LIVE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const liveNewCode = () => Array.from({ length:4 }, () => LIVE_CHARS[Math.floor(Math.random() * LIVE_CHARS.length)]).join('');
const liveId = code => 'pkarena-' + String(code).toLowerCase();
/** Open the matchmaking socket under `id`. Rejects 'taken' (id in use) or 'blocked' (unreachable). */
function liveSignal(id){
  return new Promise((res, rej) => {
    const B = liveBroker(); let ws, hb = 0, done = false;
    const sig = { send:(type, dst, payload) => { try{ ws.send(JSON.stringify({ type, dst, payload:Object.assign({ from:id }, payload) })); }catch(e){} }, onmsg:null, close:() => { clearInterval(hb); try{ ws.close(); }catch(e){} } };
    const fail = why => { if(done) return; done = true; clearTimeout(t); sig.close(); rej(new Error(why)); };
    const t = setTimeout(() => fail('blocked'), 7000);
    try{ ws = new WebSocket(`${B.secure ? 'wss' : 'ws'}://${B.host}:${B.port}${B.path}?key=${B.key}&id=${id}&token=${Math.random().toString(36).slice(2)}`); }catch(e){ return fail('blocked'); }
    ws.onmessage = e => { let m; try{ m = JSON.parse(e.data); }catch(_){ return; } if(!m) return;
      if(m.type === 'OPEN' && !done){ done = true; clearTimeout(t); hb = setInterval(() => { try{ ws.send('{"type":"HEARTBEAT"}'); }catch(_){} }, 5000); res(sig); }
      else if(m.type === 'ID-TAKEN') fail('taken');
      else if(m.type === 'INVALID-KEY' || m.type === 'ERROR') fail('blocked');
      else if(sig.onmsg){ m.src = m.src || (m.payload && m.payload.from); sig.onmsg(m); } };
    ws.onerror = () => fail('blocked'); ws.onclose = () => fail('blocked');
  });
}
/** One side of the direct link. `remote` is the other phone's id on the matchmaking server. */
function liveNewPc(sig, remote){
  const pc = new RTCPeerConnection({ iceServers:LIVE_ICE }), pend = []; pc._ready = false;
  pc.onicecandidate = e => { if(e.candidate) sig.send('CANDIDATE', remote, { candidate:e.candidate }); };
  pc.onconnectionstatechange = () => { if(LIVE.pc !== pc || pc.connectionState !== 'failed') return; liveReset(true); LIVE.err = 'Could not link directly (some phone networks block it). Try again, or on another network.'; livePaint(); };
  pc._cand = c => { if(pc._ready) pc.addIceCandidate(c).catch(() => {}); else pend.push(c); };
  pc._flush = () => { pc._ready = true; pend.splice(0).forEach(c => pc.addIceCandidate(c).catch(() => {})); };
  return pc;
}
/* Our own relay (6.16.0). The Cloudflare copy of the game carries a tiny room per code at <its address>/relay/<CODE>
   (relay/worker.js). Both phones talk to it like loading a page, so it works on networks that block the direct link.
   It is tried first; where it isn't there (GitHub Pages, a file) the direct link above is used as before. */
/* 6.21.0: every copy talks to the one relay on Sean's Cloudflare account, so the GitHub Pages app links up too (the relay lets in
   only PokéArena's own sites; relay/worker.js). A page opened as a file has none, so it uses the direct link; tests set window.__relay. */
const LIVE_RELAY = 'wss://pokeautobattler.ydcmbq62x9.workers.dev/relay/';
const liveRelayUrl = () => window.__relay || (/^https?:$/.test(location.protocol) ? LIVE_RELAY : '');
/** Open the relay room for `code`. Resolves once the relay says 'wait' (host) or 'peer' (join); rejects 'taken', 'nobody', 'full' or 'blocked'. */
function liveRelay(code, role){
  return new Promise((res, rej) => {
    let ws, done = false, peer = false, pong = Date.now(), iv = 0;
    const tr = { send:s => ws.send(s), ok:() => peer && ws.readyState === 1, close:() => { clearInterval(iv); try{ ws.close(); }catch(e){} } };
    const mine = () => LIVE.cleanup === tr.close;
    const fail = why => { if(done) return; done = true; clearTimeout(t); if(mine()) LIVE.cleanup = null; tr.close(); rej(new Error(why)); };
    const t = setTimeout(() => fail('blocked'), 5000);
    const up = () => { if(done) return; done = true; clearTimeout(t); res(tr);
      iv = setInterval(() => { if(Date.now() - pong > 15000) return tr.close(); try{ ws.send('ping'); }catch(e){} }, 5000); };
    const lost = msg => { if(!mine()) return; liveReset(true); LIVE.err = msg; livePaint(); };
    LIVE.cleanup = tr.close;
    try{ ws = new WebSocket(liveRelayUrl() + code + '?role=' + role); }catch(e){ return fail('blocked'); }
    ws.onmessage = e => {
      if(e.data === 'pong'){ pong = Date.now(); return; }
      let m = null; try{ m = JSON.parse(e.data); }catch(_){}
      if(m && typeof m._ === 'string'){
        if(m._ === 'wait') up();
        else if(m._ === 'peer'){ up(); if(!mine()) return; peer = true; LIVE.tr = tr; LIVE.code = code; LIVE.step = 'on'; LIVE.err = ''; LIVE.out = ''; LIVE.peer = {}; LIVE.mine = {}; liveSync(); livePaint(); }
        else if(m._ === 'left') lost('The live link dropped (your friend left). Connect again to keep playing.');
        else fail(m._);
        return; }
      if(peer) liveMsg(e.data);
    };
    ws.onerror = () => fail('blocked');
    ws.onclose = () => { clearInterval(iv); if(!done) return fail('blocked');
      lost(peer ? 'The live link dropped. Connect again to keep playing.' : 'Lost the connection while waiting. Host again.'); };
  });
}
/** The shared code for both transports: hosts wait on it, joiners type it. */
async function liveHost(){
  liveReset(); LIVE.step = 'making'; livePaint();
  if(liveRelayUrl()) for(let i = 0; i < 6; i++){
    const code = liveNewCode();
    try{ await liveRelay(code, 'host'); if(LIVE.step !== 'on'){ LIVE.step = 'rwait'; LIVE.code = code; livePaint(); } return; }
    catch(e){ if(LIVE.step !== 'making') return; if(e.message !== 'taken') break; }
  }
  if(!liveRtcOk()){ if(!LIVE.room) throw new Error('Live link is not available in this window. Open the game in your browser or the installed app.'); return liveRoom(liveNewCode()); }
  let sig = null, code = '';
  for(let i = 0; i < 6 && !sig; i++){
    code = liveNewCode();
    try{ sig = await liveSignal(liveId(code)); }
    catch(e){ if(e.message !== 'taken'){ if(LIVE.room) return liveRoom(liveNewCode()); throw new Error('Could not reach the matchmaking server. Check your connection and try again.'); } }
  }
  if(!sig) throw new Error('Could not get a free code. Try again.');
  let accepted = null, pc = null, timer = 0;
  LIVE.cleanup = () => { clearTimeout(timer); sig.close(); };
  LIVE.step = 'rwait'; LIVE.code = code; livePaint();
  sig.onmsg = async m => {
    try{
      if(m.type === 'OFFER' && !accepted){
        accepted = m.src; pc = liveNewPc(sig, accepted); LIVE.pc = pc;
        pc.ondatachannel = e => { liveAttach(e.channel); clearTimeout(timer); };
        timer = setTimeout(() => { if(!liveOn()){ try{ pc.close(); }catch(e){} accepted = null; LIVE.pc = null; } }, 20000);   // a stranger who never completes frees the seat
        await pc.setRemoteDescription(m.payload.sdp); pc._flush();
        await pc.setLocalDescription(await pc.createAnswer()); sig.send('ANSWER', accepted, { sdp:pc.localDescription });
      } else if(m.type === 'CANDIDATE' && m.src === accepted && pc) pc._cand(m.payload.candidate);
    }catch(e){}
  };
}
async function liveJoin(code){
  code = String(code).trim().toUpperCase();
  if(!/^[A-Z0-9]{4}$/.test(code)) throw new Error('Codes are 4 letters or numbers.');
  liveReset(); LIVE.step = 'connecting'; LIVE.code = code; livePaint();
  if(liveRelayUrl()){
    try{ await liveRelay(code, 'join'); return; }
    catch(e){ if(LIVE.step !== 'connecting') return; if(e.message === 'full') throw new Error(code + ' already has two players. Check the code.'); }
    // 'nobody' falls through too: the host may be on the direct link if the relay was out of reach for them
  }
  if(!liveRtcOk()){ if(!LIVE.room) throw new Error('Live link is not available in this window. Open the game in your browser or the installed app.'); return liveRoom(code); }
  const me = 'pkj-' + Math.random().toString(36).slice(2, 10); let sig;
  try{ sig = await liveSignal(me); }catch(e){ if(LIVE.room) return liveRoom(code); throw new Error('Could not reach the matchmaking server. Check your connection and try again.'); }
  const host = liveId(code), pc = liveNewPc(sig, host); LIVE.pc = pc;
  let timer = 0; const giveUp = msg => { if(LIVE.pc === pc && !liveOn()){ liveReset(true); LIVE.err = msg; livePaint(); } };
  LIVE.cleanup = () => { clearTimeout(timer); sig.close(); };
  sig.onmsg = async m => {
    try{
      if(m.type === 'ANSWER' && m.src === host){ await pc.setRemoteDescription(m.payload.sdp); pc._flush(); }
      else if(m.type === 'CANDIDATE' && m.src === host) pc._cand(m.payload.candidate);
      else if(m.type === 'EXPIRE') giveUp('Nobody is hosting ' + code + '. Check the code.');
    }catch(e){}
  };
  timer = setTimeout(() => giveUp('Could not connect to ' + code + '. Check the code and try again.'), 15000);
  liveAttach(pc.createDataChannel('duel'));
  await pc.setLocalDescription(await pc.createOffer()); sig.send('OFFER', host, { sdp:pc.localDescription });
}
async function liveAct(a, body){
  try{
    if(a === 'host') await liveHost();
    else if(a === 'join'){ liveReset(); LIVE.step = 'rjoinin'; }
    else if(a === 'go') await liveJoin(((body.querySelector('#lk_in') || {}).value) || '');
    else if(a === 'cancel') liveReset();
  }catch(e){
    LIVE.err = (e && e.message) || 'Could not connect.';
    if(LIVE.step === 'making' || LIVE.step === 'connecting' || LIVE.step === 'rwait') liveReset(true);
  }
  livePaint();
}
function liveCardHtml(){
  const L = LIVE, err = L.err ? `<div class="dmsg">${esc(L.err)}</div>` : '';
  let h;
  if(L.step === 'on') h = `<b>● Live link on.</b> You will both watch the fight at the same moment. ${L.peer.commit ? 'Your friend has locked in.' : ''}
    <div class="btnrow tight"><button class="btn small ghost" data-l="cancel">Disconnect</button></div>`;
  else if(L.step === 'making') h = '<b>Live link</b> · getting a code…';
  else if(L.step === 'rwait') h = `<b>Your code</b><div class="dcode">${esc(L.code)}</div><p class="dim">Tell your friend this code. It links up by itself when they join.</p>
    <div class="btnrow tight"><button class="btn small ghost" data-l="cancel">Cancel</button></div>`;
  else if(L.step === 'rjoinin') h = `<b>Join a friend</b><p>Type the 4-letter code on their screen.</p><input id="lk_in" type="text" autocapitalize="characters" autocomplete="off" maxlength="4" placeholder="CODE">
    <div class="btnrow tight"><button class="btn small primary" data-l="go">Join</button><button class="btn small ghost" data-l="cancel">Cancel</button></div>`;
  else if(L.step === 'connecting') h = `<b>Live link</b> · connecting to ${esc(L.code)}…<div class="btnrow tight"><button class="btn small ghost" data-l="cancel">Cancel</button></div>`;
  else if(!liveRtcOk() && !L.room && !liveRelayUrl()) h = `<b>Live link</b><p class="dim">Not available in this window${L.room === undefined ? ' (checking…)' : ''}. Open the game in your browser or the installed app to play a friend.</p>`;
  else h = `<b>Play a friend</b><p class="dim">One of you hosts and gets a 4-letter code, the other types it. Then you both watch each fight live.</p>
    <div class="btnrow tight"><button class="btn small" data-l="host">Host</button><button class="btn small" data-l="join">Join</button></div>`;
  return `<div class="dlive">${err}${h}</div>`;
}

/* ---------------- the hub ---------------- */
function openDuels(){
  const box = duelBox(), set = getDuelSet();
  const w = set && duelWins(set);
  const d = modal(`<h3>Duels</h3>
    <p class="dim">Battle a friend with pokémon you saved from your runs. One of you hosts and gets a 4-letter code, the other types it: no accounts. Best of three, six against six, within a power budget of ${DUEL.budget}.</p>
    <div class="dstat"><b>${box.length} / ${DUEL.boxSize}</b> in your box${box.length ? '' : ' — finish a run and save a pokémon to start'}</div>
    ${set ? `<div class="dstat">${set.over ? `Set against <b>${esc(set.opp || 'a friend')}</b> finished: ${set.over === 'win' ? 'you won' : set.over === 'lose' ? 'you lost' : 'a draw'} ${w.me}–${w.opp}.`
      : `A set${set.opp ? ' against <b>' + esc(set.opp) + '</b>' : ''} is in progress · game ${set.game} of ${DUEL.games}${set.games.length ? ` · ${w.me}–${w.opp}` : ''}.`}</div>` : ''}
    <div class="btnrow dhub">
      <button class="btn primary" data-m="set" ${box.length ? '' : 'disabled'}>${set ? (set.over ? 'See the result' : 'Resume the set') : 'Start a set'}</button>
      <button class="btn" data-m="box">My box</button>
      <button class="btn" data-m="how">How it works</button>
      <button class="btn ghost" data-m="close">Close</button></div>
    ${duelDev() ? `<hr><div class="dim">Developer tools</div><div class="btnrow ddev">
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
    <p><b>Items.</b> A pokémon keeps the item it was saved with. The items on your first six are your pool for the set: from game 2 you can move those around, but a pokémon swapped in arrives without its own item.
      Items with a battle effect (Leftovers, Focus Band, Life Orb and the like) add to a pokémon's power, so they count against the budget. Lucky Egg and Amulet Coin only help during a run, so they are switched off in duels.</p>
    <p><b>Playing.</b> One of you taps Host and reads out the 4-letter code, the other taps Join and types it. Pick your team and lock it in: your friend only sees that you are locked in, never your team, until you both press Fight and watch the same battle together.</p>
    <div class="btnrow"><button class="btn primary" data-m="close">Got it</button></div>`);
  d.addEventListener('click', ev => { if(ev.target.closest('[data-m]')){ d.remove(); openDuels(); } });
}

/* ---------------- 6.18.0: box filter and sort ----------------
   One setting for the team picker and My box; it stays while the game is open. */
const BOXF = { role:'', type:'', by:'power' };
const BOX_SORTS = { power:'Power', atk:'Attack', hp:'HP', spd:'Speed', name:'Name', new:'Newest' };
const snapType = s => (SPECIES[s.id] || {}).type || '';
function boxSorted(list){
  const key = s => { const u = thawUnit(s); return BOXF.by === 'power' ? -duelPower([u]) : BOXF.by === 'atk' ? -effAtk(u) : BOXF.by === 'hp' ? -effHp(u) : BOXF.by === 'spd' ? -effSpd(u) : BOXF.by === 'new' ? -(s.at || 0) : 0; };
  return list.filter(s => (!BOXF.role || roleOf(s.id) === BOXF.role) && (!BOXF.type || snapType(s) === BOXF.type))
    .map(s => ({ s, k:key(s), n:(SPECIES[s.id] || {}).name || '' })).sort((a, b) => a.k - b.k || a.n.localeCompare(b.n)).map(x => x.s);
}
function boxFilterHtml(all, shown){
  const types = [...new Set(all.map(snapType).filter(Boolean))].sort();
  if(BOXF.type && !types.includes(BOXF.type)) BOXF.type = '';
  const on = BOXF.role || BOXF.type;
  return `<div class="dfilter" role="group" aria-label="Filter the box">
    <div class="dfroles">${[['', 'All'], ...Object.keys(ROLES).map(r => [r, `${ROLES[r].icon}<span class="dfname"> ${ROLES[r].name}</span>`])].map(([r, l]) => `<button class="btn small ${BOXF.role === r ? 'on' : 'ghost'}" data-frole="${r}" aria-pressed="${BOXF.role === r}" ${r ? `aria-label="${ROLES[r].name}" title="${ROLES[r].name}"` : ''}>${l}</button>`).join('')}</div>
    <div class="dfsel"><select data-ftype aria-label="Type"><option value="">All types</option>${types.map(t => `<option value="${t}" ${BOXF.type === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>
      <select data-fsort aria-label="Sort by">${Object.keys(BOX_SORTS).map(k => `<option value="${k}" ${BOXF.by === k ? 'selected' : ''}>Sort: ${BOX_SORTS[k]}</option>`).join('')}</select></div>
    <div class="dfcount dim">${on ? `Showing ${shown} of ${all.length}${shown ? '' : ' · <button class="linkish" data-fclear>Clear filter</button>'}` : `${all.length} pokémon`}</div></div>`;
}
/** Filter taps and choices for a window that shows the box; `redraw` paints it again. Returns true if it handled the event. */
function boxFilterAct(ev, redraw){
  const f = ev.target.closest('[data-frole],[data-fclear]');
  if(f && ev.type === 'click'){ if(f.dataset.fclear != null){ BOXF.role = BOXF.type = ''; } else BOXF.role = f.dataset.frole; redraw(); return true; }
  const sel = ev.type === 'change' && ev.target.closest('[data-ftype],[data-fsort]');
  if(sel){ if(sel.dataset.ftype != null) BOXF.type = sel.value; else BOXF.by = sel.value; redraw(); return true; }
  return false;
}

/* ---------------- the box ---------------- */
function openDuelBox(){
  const box = duelBox(), shown = boxSorted(box);
  const d = modal(`<h3>My box <span class="dim">${box.length} / ${DUEL.boxSize}</span></h3>
    <p class="dim">Frozen: nothing here grows or evolves. Tap Release to make room.</p>
    ${box.length ? boxFilterHtml(box, shown.length) : ''}
    <div class="dgrid">${shown.map(s => cardOf(s, { foot:`<button class="btn small ghost" data-rel="${s.bid}">Release</button>` })).join('') || (box.length ? '' : '<p class="dim">Empty. Finish a run and save a pokémon to fill it.</p>')}</div>
    <div class="btnrow"><button class="btn" data-m="back">Back</button></div>`); d.classList.add('duel');
  const again = () => { const y = d.querySelector('.boxscroll').scrollTop; d.remove(); const n = openDuelBox(); n.querySelector('.boxscroll').scrollTop = y; };
  d.addEventListener('change', ev => { boxFilterAct(ev, again); });
  d.addEventListener('click', ev => {
    if(boxFilterAct(ev, again)) return;
    const r = ev.target.closest('[data-rel]');
    if(r){ if(r.dataset.sure !== '1'){ r.dataset.sure = '1'; r.textContent = 'Really release?'; return; }
      saveDuelBox(duelBox().filter(s => s.bid !== r.dataset.rel)); again(); return; }
    if(ev.target.closest('[data-m]')){ d.remove(); openDuels(); }
  });
  return d;
}

/* ---------------- a set ---------------- */
let duelDraft = null;     // { picks:[{bid,item}] } while choosing a team
function openDuelSet(){
  let set = getDuelSet();
  if(!set){ set = newDuelSet(playerName(), GAME_VERSION.v); putDuelSet(set); }
  const d = modal('', true); d.classList.add('duel');
  const body = d.querySelector('.boxscroll');
  const KEEP = ['#lk_in'];
  const paint = () => {
    const kept = KEEP.map(q => { const e = body.querySelector(q); return e ? e.value : null; });
    const g0 = body.querySelector('.dgrid'), y0 = g0 && g0.getBoundingClientRect().top;
    set = getDuelSet(); body.innerHTML = setHtml(set);
    KEEP.forEach((q, i) => { const e = body.querySelector(q); if(e && kept[i] != null) e.value = kept[i]; });
    const g1 = g0 && body.querySelector('.dgrid'); if(g1) body.scrollTop += g1.getBoundingClientRect().top - y0;   // 6.17.1: the box stays put
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
  paint(); liveSync(); liveProbe();
  d.addEventListener('click', ev => {
    if(boxFilterAct(ev, paint)) return;
    const b = ev.target.closest('[data-m],[data-l],[data-pick],[data-up],[data-down],[data-drop]'); if(!b) return;
    if(b.dataset.l){ liveAct(b.dataset.l, body); return; }
    set = getDuelSet(); const box = duelBox();
    const dr = duelDraft || (duelDraft = { picks: [] });
    if(b.dataset.pick){ const i = dr.picks.findIndex(p => p.bid === b.dataset.pick);
      if(i >= 0) dr.picks.splice(i, 1);
      else if(dr.picks.length < DUEL.bring){ const s = box.find(x => x.bid === b.dataset.pick); dr.picks.push({ bid:s.bid, item: set.pool ? null : duelItem(s.held) }); }
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
    else if(m === 'fight'){
      if(!liveOn()) return;                                // 6.17.0: fights only over the live link
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
    }
  });
  d.addEventListener('change', ev => {
    if(boxFilterAct(ev, paint)) return;
    const sel = ev.target.closest('[data-item]'); if(!sel || !duelDraft) return;
    duelDraft.picks[+sel.dataset.item].item = sel.value || null; paint();
  });
  return d;
}
const toastDuel = (body, msg) => { let t = body.querySelector('.dmsg'); if(!t){ t = document.createElement('div'); t.className = 'dmsg'; body.prepend(t); } t.textContent = msg; t.scrollIntoView({ block:'nearest' }); };

function setHtml(set){
  const box = duelBox(), D = DUEL, w = duelWins(set);
  const head = `<h3>Set vs ${esc(set.opp || 'a friend')}</h3><div class="dsub dim">${set.over ? `Final score ${w.me}–${w.opp}` : `Game ${Math.min(set.game, D.games)} of ${D.games}${set.games.length ? ` · ${w.me}–${w.opp}` : ''}`}</div>`;
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
    return `${head}${hist}${live}<p><b>Your team is locked in.</b> Link up with ${esc(set.opp || 'your friend')} above (Host or Join) and the fight is ready once they lock in too.</p>
      <div class="btnrow"><button class="btn ghost" data-m="unlock">Change my team</button><button class="btn ghost" data-m="hub">Close</button></div>`;
  }
  const dr = duelDraft || { picks: [] }, pool = (set.pool || []).slice();
  const el = duelEligible(set, box), units = dr.picks.map((p, i) => { const s = box.find(x => x.bid === p.bid); return s ? thawUnit(s, i, p.item) : null; }).filter(Boolean);
  const power = Math.round(duelPower(units)), over = power > set.budget;
  const picksForCheck = dr.picks.map((p, i) => ({ bid:p.bid, item:p.item, pos:i }));
  const why = dr.picks.length ? duelCheckPicks(set, box, picksForCheck) : 'Tap pokémon in your box to pick your team.';
  const left = pool.slice(); dr.picks.forEach(p => { const i = left.indexOf(p.item); if(p.item && i >= 0) left.splice(i, 1); });
  const rw = TUNING.rankWidth, ready = boxSorted(el.ready), resting = boxSorted(el.resting);
  return `${head}${hist}${live}
    <div class="dmeter"><i style="width:${Math.min(100, power / set.budget * 100)}%" class="${over ? 'over' : ''}"></i><span>Power ${power} / ${set.budget}</span></div>
    <div class="dteam">${['Front', 'Middle', 'Back'].slice(0, Math.ceil(DUEL.bring / rw)).map((rank, r) => `<div class="drank"><div class="dpos">${rank}</div>
      ${Array.from({ length:rw }, (_, k) => teamSlot(set, box, dr, pool, r * rw + k)).join('')}</div>`).join('')}</div>
    ${set.pool ? `<p class="dim">Items you can still hand out: ${left.length ? left.map(id => esc(itemName(id))).join(', ') : 'none (all in use)'}. A pokémon brought in from the box arrives without its saved item.</p>` : '<p class="dim">Game 1: every pokémon holds the item it was saved with. Those items become your pool for the set.</p>'}
    <h4>Your box</h4><p class="dim">Tap to add or remove.${el.resting.length ? ' Pokémon that fainted last game are resting.' : ''}</p>
    ${boxFilterHtml(el.ready.concat(el.resting), ready.length + resting.length)}
    <div class="dgrid">${ready.map(s => cardOf(s, { cls: dr.picks.some(p => p.bid === s.bid) ? 'sel' : '', attr:`data-pick="${s.bid}" role="button"` })).join('')}
      ${resting.map(s => cardOf(s, { cls:'rest', foot:'<div class="dpos">Resting this game</div>' })).join('')}</div>
    <div class="dfoot"><div class="${why && dr.picks.length ? 'dmsg' : 'dim'}">${esc(why || 'Ready. Lock it in when you are happy.')}</div>
      <div class="btnrow"><button class="btn primary" data-m="lock" ${why ? 'disabled' : ''}>Lock in my team</button><button class="btn ghost" data-m="hub">Close</button></div></div>`;
}

/** 6.17.1: one of the six team places. Empty places keep their size, so the box below never moves while you pick. */
function teamSlot(set, box, dr, pool, i){
  const p = dr.picks[i], s = p && box.find(x => x.bid === p.bid);
  if(!s) return `<div class="slot empty dslot"></div>`;
  const pooled = set.pool ? `<select data-item="${i}" aria-label="Item"><option value="">no item</option>${[...new Set(pool)].map(id => `<option value="${id}" ${p.item === id ? 'selected' : ''}>${esc(itemName(id))}${pool.filter(x => x === id).length > 1 ? ' ×' + pool.filter(x => x === id).length : ''}</option>`).join('')}</select>`
    : `<div class="dcard-item">${itemLine(s.held)}</div>`;
  return cardOf(s, { cls:'picked dslot', noitem:true, foot:`${pooled}<div class="dctl"><button class="btn small" data-up="${i}" aria-label="Move forward" ${i ? '' : 'disabled'}>◀</button><button class="btn small" data-down="${i}" aria-label="Move back" ${i < dr.picks.length - 1 ? '' : 'disabled'}>▶</button><button class="btn small ghost" data-drop="${i}" aria-label="Remove">✕</button></div>` });
}

/* ---------------- the battle ---------------- */
function playDuelBattle(out, set){
  const back = { phase, title: !!titleEl };        // 6.17.0: where to go back to afterwards (the title, or the run you had open)
  if(titleEl){ const t = document.getElementById('title'); if(t) t.remove(); titleEl = null; document.body.classList.remove('titled'); }
  const sim = out.sim, flip = !out.iAmP;
  battle = { steps: sim.steps, i:0, result: flip ? (sim.result === 'win' ? 'lose' : sim.result === 'lose' ? 'win' : 'draw') : sim.result,
             oppName: set.opp, timer:null, exhibition:true, duel:true, flip,
             back, onDone: () => { if(back.title) showTitle(afterTitle); openDuelSet(); } };
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
    <div class="dgrid small">${units.map(u => `<div class="slot dcard ${mpSel.has(u.uid) ? 'sel' : ''}" data-act="mppick" data-uid="${u.uid}" role="button" style="border-style:solid">${unitHtml(u, { held:false })}<div class="dcard-item">${itemLine(u.held)}</div></div>`).join('')}</div>
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
