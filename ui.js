/* ===================================================================
   POKEBATTLER — UI LAYER
   Tap-to-select / tap-to-place. Works identically with mouse or touch.
   =================================================================== */

/* ---- SPRITES ------------------------------------------------------
   Drop in image URLs here (or base64 data URIs) to replace the
   colored-letter placeholders. Anything missing falls back gracefully.
     const SPRITES = { pikachu:'img/pikachu.png', onix:'img/onix.png' };
   ------------------------------------------------------------------- */
const SPRITES = {};
/* Bump on every publish: testers quote this in bug reports, and the
   project's tester-checklist doc is keyed by it. */
/* Version numbers (from 1.2.0, Sean's scheme): BIG.MEDIUM.SMALL —
   BIG = a big mechanical update · MEDIUM = patches, things added or removed ·
   SMALL = very minor visual and small text fixes. Before 1.2.0 updates were
   numbered v1…v54; those entries keep their old names in the changelog. */
const GAME_VERSION = { v:'6.17.1', date:'Oct 16, 2026' };   // the date shows only in What's new (1.3.0, Sean)
const versionTag = () => `<div class="vtag">PokéArena ${GAME_VERSION.v}</div>`;

const $ = sel => document.querySelector(sel);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* v37: player settings (START → OPTIONS). Kept per device, like the speed choice. */
const PREF = {
  get(k, d){ try{ const v = localStorage.getItem('pkb_' + k); return v === null ? d : v; }catch(e){ return d; } },
  set(k, v){ try{ localStorage.setItem('pkb_' + k, String(v)); }catch(e){} },
};
const playerName = () => String(PREF.get('name', '') || '').replace(/[<>]/g, '').trim() || 'Trainer';

/* ===================================================================
   v47 · SOUND — made on the fly with Web Audio. 5.4.0: softer, rounder tones
   (triangle/sine through a gentle low-pass) instead of the Game Boy square waves
   Square and triangle waves plus a little noise, like the old sound chip:
   nothing to download. On by default; START → Options has Sound (On/Off)
   and Volume. Phones only allow sound after the first tap, so the audio
   starts on the first pointerdown/keydown. Browser test runs stay silent
   (navigator.webdriver) unless window.PKB_SOUND is set, but every sound
   the game asks for is still written to SFX.log so tests can see it.
   =================================================================== */
/* 3.7.0 · HAPTICS — a light buzz on the moments that matter (buys, level-ups,
   evolutions, knockouts, wins and losses), on phones that support vibration
   (Android; iPhones don't let web pages vibrate). START → Options → Haptics. */
const HAPTIC = (() => {
  const PAT = { select:8, coin:12, levelup:[18, 40, 22], evolve:[25, 50, 25, 50, 60], faint:30, crit:14,
    win:[30, 60, 30, 60, 90], lose:[90, 70, 90], badge:[30, 50, 30, 50, 140], sparkle2:[12, 30, 12, 30, 12], error:[15, 30, 15], encounter:[20, 40, 60] };
  let last = 0; const log = [];
  const on = () => PREF.get('haptics', 'on') !== 'off';
  function buzz(name){
    const p = PAT[name]; if(!p || !on()) return;
    const now = performance.now(); if(now - last < 60) return; last = now;
    log.push(name); if(log.length > 100) log.shift();
    if(navigator.webdriver && !window.PKB_HAPTIC) return;
    try{ if(navigator.vibrate) navigator.vibrate(p); }catch(e){}
  }
  return { buzz, log, supported: () => typeof navigator.vibrate === 'function' };
})();

const SFX = (() => {
  let ctx = null, master = null, noiseBuf = null, held = false;
  const last = {};
  const log = [];
  const VOL = { low: 0.12, mid: 0.24, high: 0.4 };
  const on = () => PREF.get('sound', 'on') !== 'off';
  const allowed = () => !navigator.webdriver || window.PKB_SOUND;
  function ensure(){
    if(!allowed()) return null;
    try{
      if(!ctx){
        const AC = window.AudioContext || window.webkitAudioContext;
        if(!AC) return null;
        ctx = new AC();
        master = ctx.createGain();
        const soft = ctx.createBiquadFilter(); soft.type = 'lowpass'; soft.frequency.value = 3600; soft.Q.value = 0.5;   // 5.4.0
        master.connect(soft); soft.connect(ctx.destination);
        noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for(let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      if(ctx.state !== 'running' && !held) ctx.resume();   // 4.17.3: iPhones also leave it 'interrupted' after a call or an app switch
      master.gain.value = VOL[PREF.get('volume', 'mid')] || VOL.mid;
    }catch(e){ return null; }
    return ctx;
  }
  // phones unlock audio only inside a user gesture. 4.17.3: also on touchend/click (some iPhones only count those),
  // and the first unlock plays one silent sample, which is what actually opens audio on iOS
  let primed = false;
  const unlock = () => { if(!on()) return; const c = ensure(); if(!c || primed) return;
    try{ const b = c.createBuffer(1, 1, c.sampleRate), src = c.createBufferSource(); src.buffer = b; src.connect(c.destination); src.start(0); primed = true; }catch(e){} };
  for(const ev of ['pointerdown', 'touchend', 'click', 'keydown']) document.addEventListener(ev, unlock, true);
  // coming back to the tab: wake the audio up again
  document.addEventListener('visibilitychange', () => { if(!document.hidden && ctx && ctx.state !== 'running' && !held) try{ ctx.resume(); }catch(e){} });

  /* one note: f in Hz, t0 seconds from now, d seconds long; o.to slides the pitch */
  function tone(f, t0, d, o){
    o = o || {};
    const t = ctx.currentTime + t0, osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type === 'square' || !o.type ? 'triangle' : o.type;   // 5.4.0: no more square waves
    osc.frequency.setValueAtTime(f, t);
    if(o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + d);
    const v = (o.v == null ? 1 : o.v) * 0.85;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + Math.min(0.012, d * 0.3));
    g.gain.setValueAtTime(v, t + Math.max(0.005, d * 0.6));
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    osc.connect(g); g.connect(master);
    osc.start(t); osc.stop(t + d + 0.02);
  }
  function noise(t0, d, o){
    o = o || {};
    const t = ctx.currentTime + t0, src = ctx.createBufferSource(), g = ctx.createGain(), fl = ctx.createBiquadFilter();
    src.buffer = noiseBuf; src.playbackRate.value = o.rate || 1;
    fl.type = o.high ? 'highpass' : 'lowpass'; fl.frequency.value = o.cut || 2200;
    const v = o.v == null ? 0.6 : o.v;
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    src.connect(fl); fl.connect(g); g.connect(master);
    src.start(t); src.stop(t + d + 0.02);
  }
  const N = n => 440 * Math.pow(2, (n - 69) / 12);          // MIDI note → Hz
  const seq = (notes, step, o) => notes.forEach((n, k) => n && tone(N(n), k * step, step * 0.95, o));

  const SOUNDS = {
    tap:     () => tone(1250, 0, 0.025, { v: 0.5 }),
    move:    () => tone(880, 0, 0.03, { v: 0.5 }),
    select:  () => { tone(988, 0, 0.04); tone(1319, 0.04, 0.06); },
    back:    () => tone(660, 0, 0.07, { to: 400 }),
    open:    () => { tone(1319, 0, 0.03, { v: 0.6 }); tone(1760, 0.03, 0.05, { v: 0.6 }); },
    error:   () => { tone(185, 0, 0.07); tone(175, 0.1, 0.1); },
    coin:    () => { tone(988, 0, 0.05); tone(1319, 0.05, 0.14); },
    gain:    () => seq([88, 91, 96], 0.045),
    land:    () => { noise(0, 0.05, { cut: 5000, v: 0.4 }); tone(420, 0.03, 0.09, { to: 950 }); },
    deal:    () => [0, 1, 2, 3].forEach(k => tone(600 + k * 110, k * 0.03, 0.022, { v: 0.4 })),
    levelup: () => seq([72, 76, 79, 84], 0.07, { type: 'square', v: 0.8 }),
    evolve:  () => { tone(260, 0, 0.45, { to: 1100, v: 0.7 }); seq([0, 0, 0, 0, 0, 0, 0, 84, 88, 91, 96], 0.06); },
    hit:     () => { noise(0, 0.08, { cut: 1600, v: 0.7 }); tone(170, 0, 0.07, { to: 60, v: 0.8 }); },
    crit:    () => { noise(0, 0.12, { cut: 3500, v: 0.9 }); tone(260, 0, 0.1, { to: 70 }); tone(1500, 0.02, 0.05, { v: 0.4 }); },
    weak:    () => noise(0, 0.05, { cut: 900, v: 0.4 }),
    cheer:   () => { noise(0, 1.1, { cut: 2800, v: 0.22, rate: 0.7 }); noise(0.12, 0.9, { cut: 1500, v: 0.18, rate: 0.5 }); noise(0.3, 0.7, { cut: 4200, v: 0.1, rate: 1.3 }); },   // 4.15.0: the crowd
    faint:   () => tone(820, 0, 0.5, { to: 90, v: 0.8 }),
    heal:    () => seq([79, 83, 86], 0.05, { type: 'triangle', v: 0.9 }),
    status:  () => [0, 1, 2].forEach(k => { tone(520, k * 0.07, 0.03); tone(700, k * 0.07 + 0.035, 0.03); }),
    shield:  () => tone(1200, 0, 0.14, { type: 'triangle', to: 1700, v: 0.9 }),
    up:      () => seq([76, 79, 83], 0.035, { v: 0.5 }),
    down:    () => seq([83, 79, 76], 0.035, { v: 0.5 }),
    encounter: () => { seq([100, 99, 98, 97, 96, 95, 94, 93], 0.032, { v: 0.6 }); noise(0.27, 0.15, { cut: 800, v: 0.6 }); tone(110, 0.27, 0.2, { to: 70 }); },
    alert:   () => { tone(1760, 0, 0.06); tone(1760, 0.09, 0.08); },
    win:     () => { seq([72, 76, 79, 84], 0.1); tone(N(79), 0.42, 0.14); tone(N(84), 0.56, 0.35); },
    lose:    () => seq([72, 71, 70, 69], 0.16, { type: 'triangle' }),
    badge:   () => { seq([79, 79, 79], 0.09); seq([0, 0, 0, 84, 88], 0.09); tone(N(91), 0.45, 0.45); },
    start:   () => { tone(N(84), 0, 0.08); tone(N(91), 0.08, 0.16); },
    // v54: a Rare / Very rare item lands on the shelf
    sparkle: () => { seq([91, 95, 98, 103], 0.045, { type: 'triangle', v: 0.7 }); tone(N(103), 0.2, 0.28, { type: 'triangle', v: 0.35 }); },
    sparkle2: () => { seq([84, 88, 91, 96, 100, 103], 0.045, { type: 'triangle', v: 0.75 });
      [0, 1, 2, 3].forEach(k => tone(N(k % 2 ? 108 : 103), 0.3 + k * 0.06, 0.05, { type: 'triangle', v: 0.3 })); },
    wipeIn:  q => tone(1100, 0, q ? 0.14 : 0.36, { to: 180, v: 0.35 }),
    wipeOut: q => tone(200, 0, q ? 0.14 : 0.26, { to: 900, v: 0.3 }),
  };

  function play(name, arg){
    HAPTIC.buzz(name);                                      // 3.7.0: felt even with the sound off
    if(!SOUNDS[name] || !on() || held) return;              // 4.3.0: a paused battle is silent
    const now = performance.now();
    if(last[name] && now - last[name] < 45) return;          // at 4× the same blip would pile up
    last[name] = now;
    log.push(name); if(log.length > 300) log.shift();
    if(!ensure()) return;
    try{ SOUNDS[name](arg); }catch(e){}
  }
  /** 4.3.0: Pause freezes whatever is still ringing and keeps new sounds out until Resume. */
  function hold(v){ held = !!v; try{ if(ctx) held ? ctx.suspend() : ctx.resume(); }catch(e){} }
  return { play, log, names: Object.keys(SOUNDS), ensure, hold, get held(){ return held; } };
})();


/* ===================================================================
   v48 · THE HOME-SCREEN APP
   The same file runs three ways: inside the claude.ai artifact, opened as a
   local file, and hosted on its own address (GitHub Pages) with a manifest,
   icons and a service worker next to it. Only the hosted copy has
   <link rel="manifest"> (build.py adds it to app/index.html), so only it
   registers the service worker and offers "Install app" in the START menu.
   Android/desktop Chrome can install straight from the menu; iPhones can't be
   prompted, so the menu explains Share → Add to Home Screen.
   =================================================================== */
const APP = (() => {
  let prompt = null;
  const hosted = () => /^https?:$/.test(location.protocol) && window.top === window && !!document.querySelector('link[rel="manifest"]');
  const standalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  const ios = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); prompt = e; });
  window.addEventListener('appinstalled', () => { prompt = null; });
  if(hosted() && 'serviceWorker' in navigator)
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  if(standalone()) document.documentElement.classList.add('standalone');
  return {
    hosted, standalone, ios,
    canInstall: () => hosted() && !standalone() && (!!prompt || ios() || window.PKB_INSTALL),
    async install(){
      if(prompt){
        const p = prompt; prompt = null;
        try{ p.prompt(); const c = await p.userChoice; if(c && c.outcome === 'accepted') say('PokéArena is on your home screen.'); }catch(e){}
        return;
      }
      const d = modal(`<h3>Install PokéArena</h3>
        ${ios() ? `<ol class="ihelp">
          <li>Tap the <b>Share</b> button <span class="ishare" aria-hidden="true">⬆︎</span> in Safari's toolbar.</li>
          <li>Scroll down and tap <b>Add to Home Screen</b>.</li>
          <li>Tap <b>Add</b>. PokéArena appears on your home screen with its own icon.</li></ol>`
        : `<ol class="ihelp"><li>Open your browser's menu (<b>⋮</b>).</li><li>Tap <b>Install app</b> or <b>Add to Home screen</b>.</li></ol>`}
        <p>Opened from the home screen it fills the whole screen, plays offline, and keeps your run on this phone.</p>
        <div class="btnrow"><button class="btn primary" data-m="close">Got it</button></div>`);
      d.classList.add('install');
      d.querySelector('[data-m="close"]').onclick = () => d.remove();
    },
  };
})();

let G = null;
let phase = 'shop';           // 'shop' | 'battle' | 'over'
let sel = null;               // { kind:'dc'|'team'|'mart'|'bitem', idx }
let inspect = null;
let battle = null;
let toast = '';

/* ---------------- persistence (best effort, never required) --------- */
const SAVE_KEY = 'pokebattler.save.v3';
/* 2.0.0: the daily challenge has its own save, so it never touches your run.
   Which slot a run lives in is a fact about the run (G.daily), not a mode. */
const DAILY_KEY = 'pokebattler.save.daily';
const slotKey = g => (g && g.daily) ? DAILY_KEY : SAVE_KEY;
/* 4.1.0: the Pokédex remembers every pokémon the Daycare has shown you or you have owned. */
const dexSeen = () => { try{ return new Set(JSON.parse(PREF.get('dexseen', '[]'))); }catch(e){ return new Set(); } };
function noteSeen(){
  if(!G) return;
  const s = dexSeen(), n = s.size;
  [...(G.team || []), ...(G.pc || []), ...(G.daycare || []).map(x => x && x.unit)].forEach(u => { if(u && u.id) s.add(u.id); });
  if(s.size !== n) PREF.set('dexseen', JSON.stringify([...s]));
}
function save(){
  if(!G) return;
  noteSeen();
  try{ localStorage.setItem(slotKey(G), JSON.stringify({ G, phase: phase === 'battle' ? 'shop' : phase })); }catch(e){}
  PREF.set('slot', G.daily ? 'daily' : 'main');
}
function load(key){
  try{
    const raw = localStorage.getItem(key || SAVE_KEY);
    if(!raw) return null;
    const d = JSON.parse(raw);
    if(!d || !d.G || !Array.isArray(d.G.team)) return null;
    d.G.team    = d.G.team.filter(u => u && SPECIES[u.id] && Number.isFinite(u.spd));
    d.G.pc      = (d.G.pc||[]).filter(u => u && SPECIES[u.id] && Number.isFinite(u.spd));
    d.G.daycare = (d.G.daycare||[]).filter(s => s && s.unit && SPECIES[s.unit.id]);
    d.G.mart    = (d.G.mart||[]).filter(s => s && (s.held ? HELD_ITEMS[s.id] : ITEMS[s.id]));
    d.G.bag     = (d.G.bag||[]).filter(id => HELD_ITEMS[id]);
    for(const u of [...(d.G.team||[]), ...(d.G.pc||[])])
      if(u.held && !HELD_ITEMS[u.held]) u.held = null;
    syncUid(d.G);      // never mint a uid a saved pokémon already owns
    /* Saves from before trainer EXP have no bank. Left alone, a run loaded on
       turn 20 would start banking from zero while its veterans carry twenty
       battles of EXP — every buy for the rest of that run would arrive a runt,
       which is exactly what trainer EXP exists to prevent. Back-fill the bank
       as if the trainer had been earning at today's rate all along, and bring
       the shelf they are looking at up to it. */
    if(!d.G.trainerExp){
      const n = Math.max(0, (d.G.turn || 1) - 1), g = TUNING.expGainWin;
      d.G.trainerExp = { hp: g.hp * n, atk: g.atk * n, spd: g.spd * n };
      for(const s of d.G.daycare) if(s && !s.bought) trainerCatchUp(d.G, s.unit);
    }
    /* Saves from before the gauntlet. Someone already past Lorelei would load
       with no gauntlet state and be told "last chance to shop — once you
       challenge Lorelei…" while standing at Agatha. Put them in the gauntlet
       where they are, at full health: the rules changed under them, so they
       get the kinder start. */
    /* Saves from before badge rewards. They keep what they have (a PC fuller
       than the new 8-slot start stays full — it just can't take more until it
       grows), and every badge already won is owed its reward: they choose them
       on load, one after another. */
    if(!('perks' in d.G)){
      d.G.perks = {}; d.G.rewardLog = []; d.G.freeRolls = 0;
      d.G.pendingRewards = Array.from({ length: d.G.badges || 0 }, (_, i) => i);
    }
    if(!('gauntlet' in d.G)){
      d.G.gauntlet = (d.G.stage || 0) > gauntletStart() && !d.G.over ? { hpFrac: {} } : null;
    }
    fixSlots(d.G);     // v34: saves from before free placement stand where they were listed
    return d;
  }catch(e){ return null; }
}
function clearSave(){ try{ localStorage.removeItem(slotKey(G)); }catch(e){} }
/** Put the run in `key` on screen (saving the current one first). */
function switchSlot(key){
  save();
  const d = load(key);
  if(!d) return false;
  G = d.G; phase = d.phase === 'over' ? 'over' : 'shop';
  sel = null; inspect = null; battle = null; shopMem = null; drawnPhase = null; toast = ''; undo = null;
  if(!G.daycare || !G.daycare.length) rollShop(G, false);
  save(); render();
  return true;
}
/** The main (non-daily) run as it stands, whether or not it's on screen. */
const mainRun = () => (G && !G.daily) ? G : ((load(SAVE_KEY) || {}).G || null);
const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const prettyDate = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString([], { month:'short', day:'numeric', year:'numeric' }); };

/* ---------------- card rendering ----------------------------------- */
const typeColor = id => (TYPES[SPECIES[id].type] || {}).color || '#8a93a8';

function spriteHtml(id, cls){
  const sp = SPECIES[id], col = typeColor(id);
  if(SPRITES[id]) return `<div class="sprite img ${cls||''}" style="--tcol:${col}"><img src="${SPRITES[id]}" alt="${esc(sp.name)}"></div>`;
  return `<div class="sprite ${cls||''}" style="--tcol:${col}">${esc(sp.name.slice(0, 2))}</div>`;
}

/** An item's artwork, falling back to its emoji when no sprite is loaded. */
function itemSpriteHtml(id, fallback, cls){
  return SPRITES[id]
    ? `<div class="sprite icon img ${cls||''}"><img src="${SPRITES[id]}" alt=""></div>`
    : `<div class="sprite icon ${cls||''}">${fallback}</div>`;
}
/* ---------------- held items --------------------------------------
   The badge orbits the sprite: bottom-right of the art, overlapping the frame,
   ringed in the card colour so it reads against any type tint. */
function heldBadge(u, where, i, cls){
  const h = heldOf(u);
  if(!h) return '';
  const off = (h.when && !h.when(u)) ? ' off' : '';   // Eviolite on a final form
  const tap = where ? `data-act="unequip" data-where="${where}" data-i="${i}"` : '';
  return `<span class="held${off} ${cls||''}" title="${esc(h.name)}${off ? ' — no effect here' : ''} · tap to take off"
    ${tap}>${itemGlyph(u.held, h.icon)}</span>`;
}

/* What your rival says, by meeting: on arrival, if you beat him, if he beats you. */
const RIVAL_LINES = [
  { hi:"Hey! Wait up! I've been looking for you. Let's see whose pokémon are better!",
    lost:"What?! I only just got this team together. Next time you won't be so lucky.",
    won:"Ha! Told you. Go collect a few more badges and try again." },
  { hi:"Oh, it's you. I've got more badges than you by now. Let me show you what real training looks like!",
    lost:"Tch. Fine. Enjoy it while it lasts — I'm going to the Elite Four.",
    won:"See? You're still one step behind me." },
  { hi:"I've been waiting for this. My team is the strongest there is — and I'm going to prove it!",
    lost:"…Hmph. Then I'll just have to beat you at the top.",
    won:"That's the difference between us. See you at the Pokémon League… if you make it." },
];

/* 4.0.0: Silver, the Johto rival, has his own (colder) lines. */
const SILVER_LINES = [
  { hi:"…You again. Out of my way. I'm going to be the strongest, and I'll start with you.",
    lost:"Tch. Weak pokémon win by luck. It won't happen twice.",
    won:"Pathetic. Don't waste my time." },
  { hi:"I don't care about friends or badges. Only power. Show me yours.",
    lost:"…Why? What do you have that I don't?",
    won:"Power is all that matters. Remember that." },
  { hi:"This time I'll crush you. My team is nothing like before.",
    lost:"…I lost. Maybe I've been doing this all wrong.",
    won:"I'm going to the top. Try and keep up." },
];
/* 6.5.0: May, the Hoenn rival: friendly, a little competitive, always smiling. */
const MAY_LINES = [
  { hi:"Hi! I was hoping we'd run into each other. Let's have a battle and see how we're both doing!",
    lost:"Wow, you're good! Okay, okay, I'll train twice as hard. Just you wait!",
    won:"Yes! We did it! Don't worry, you'll get me next time." },
  { hi:"There you are! I've been training so much with my team. Ready to see what they can do?",
    lost:"Aw, really? I thought we had it that time. But that was fun, let's go again later!",
    won:"Phew, that was close! You've got to keep up if you want to beat me to the League." },
  { hi:"This is it! I've got a team I'm proud of, and I want to show you how far we've come!",
    lost:"You win. And honestly? I'm not even sad. Let's both go as far as we can.",
    won:"We won! Thank you for a great battle. See you at the Pokémon League!" },
];
const rivalLines = (G, m) => { const id = rivalOf(G).id; const L = id === 'silver' ? SILVER_LINES : id === 'may' ? MAY_LINES : RIVAL_LINES; return L[m] || L[0]; };

/* A gym leader / Elite Four / Champion portrait, when the Sprites folder has one.
   Returns '' otherwise so every caller keeps its old look. */
function bossArt(b, cls){
  return b && SPRITES[b.id]
    ? `<span class="bossart ${cls||''}"><img src="${SPRITES[b.id]}" alt="${esc(b.name)}"></span>` : '';
}

/* The second move (v32): what triggers it, then what it does. */
function move2Html(sp, l, cls, lockedBy){
  const m = sp.move2;
  if(!m) return '';
  // v52: a Choice Band keeps the second move from ever firing — shown struck through, with why
  return `<div class="${cls || 'popmove m2'}${lockedBy ? ' locked' : ''}"><b>${esc(m.name)}</b> <i class="trig">${esc(m.when())}</i>${
    lockedBy ? `<span class="lockby">Never used — locked out by its ${esc(lockedBy)}</span>` : ''}<p>${esc(m.text(l))}</p></div>`;
}
/* A battle card's status condition and barrier, from the step snapshot. */
function statusHtml(u){
  const S = u.st && TUNING.status[u.st];
  return (S ? `<div class="stchip st-${u.st}" title="${esc(S.name)}">${S.icon}<b>${S.short}</b></div>` : '')
    + (u.shield > 0 ? `<div class="shchip" title="Barrier: soaks the next ${u.shield} damage">🛡️${u.shield}</div>` : '');
}

/* The role badge sits bottom-left of the art, opposite the held item. */
function roleBadge(id, cls){
  const r = roleOf(id), R = ROLES[r];
  return `<span class="role r-${r} ${cls||''}" title="${esc(R.name)} — ${esc(R.trait)}">${R.icon}</span>`;
}
/** A role as a readable chip: icon + name. */
const roleChip = id => { const r = roleOf(id), R = ROLES[r];
  return `<span class="rchip r-${r}">${R.icon} ${esc(R.name)}</span>`; };
/** 6.0.0 — subroles: optional flavor text for a species that blends a second
    role's growth into its own (see growUnit). Below 0.15 the blend is too
    faint to call out; 0.15–0.45 it "leans" toward the second role; above
    that it gets equal billing. Never shown as a raw percentage. */
function subroleTag(id){
  const sp = SPECIES[id], sub = sp && sp.subrole;
  if(!sub || !ROLES[sub.role] || sub.weight < 0.15) return '';
  const R2 = ROLES[sub.role];
  if(sub.weight < 0.45) return `<span class="subrole">Leans ${R2.icon} ${esc(R2.name)}</span>`;
  const R1 = ROLES[roleOf(id)];
  return `<span class="subrole">${R1.icon}${R2.icon} ${esc(R1.name)}/${esc(R2.name)}</span>`;
}

/* v50: an item's rarity as a small coloured tag. Common items get none, so the
   tag always means "this turns up less often". */
function rarityTag(def){
  const r = rarityOf(def); if(r === 'common') return '';
  const R = TUNING.rarity[r], pct = Math.round(R.weight * 100);
  return `<i class="rar r-${r}" title="${esc(R.name)} — turns up about ${pct}% as often as a common item">${esc(R.name)}</i>`;
}
/** Inline item artwork for running text (the evolution line, the inspector). */
function itemGlyph(id, fallback){
  return SPRITES[id] ? `<img class="pix" src="${SPRITES[id]}" alt="">` : fallback;
}

/* opts: { price, cls, bar, acting, frac } — `frac` is the HP a pokémon has
   left mid-gauntlet (0..1); the shop draws it the same way a battle does */
function unitHtml(u, opts){
  opts = opts || {};
  const lvl = u.lvl || unitLevel(u);
  const pips = expPipsToNext(u);
  let pipHtml = '';
  if(pips.need){
    pipHtml = '<div class="exp">';
    for(let i = 0; i < pips.need; i++) pipHtml += `<i class="${i < pips.have ? 'on' : ''}"></i>`;
    pipHtml += '</div>';
  }
  let barHtml = '';
  if(opts.bar){
    const frac = Math.max(0, Math.min(1, u.hp / Math.max(1, u.maxHp)));
    const col = frac > 0.5 ? 'var(--hp)' : frac > 0.22 ? 'var(--gold)' : 'var(--bad)';
    barHtml = `<div class="hpbar"><i style="width:${frac*100}%;background:${col}"></i></div>`;
  }
  const f = opts.frac;
  if(!opts.bar && f != null && f < 1){
    const col = f > 0.5 ? 'var(--hp)' : f > 0.22 ? 'var(--gold)' : 'var(--bad)';
    barHtml = f > 0
      ? `<div class="hpbar" title="${Math.round(f*100)}% HP left"><i style="width:${f*100}%;background:${col}"></i></div>`
      : `<div class="ko">Fainted</div>`;
  }
  const boosted = (u.tmpAtk || u.tmpSpd) ? '<div class="boosted" title="X item active">✦</div>' : '';
  const twin = opts.mergeable ? '<div class="twin" title="a party member can take this copy">＋</div>' : '';
  // X items show as the effective number, tinted, so the card reads as it will fight
  const hs = heldStats(u);
  const eA = effAtk(u), eS = effSpd(u);
  const eH = opts.bar ? Math.max(0, u.hp) : f != null && f < 1 ? Math.round(effHp(u) * f) : effHp(u);
  return `<div class="unit ${opts.cls||''} ${opts.acting?'acting':''} ${f === 0 ? 'fainted' : ''}" data-uid="${u.uid}" style="--tcol:${typeColor(u.id)}">
    ${isLegend(u) ? '<div class="lvl leg" title="Legendary — never levels up">★</div>' : lvl > 1 ? `<div class="lvl">L${lvl}</div>` : ''}${boosted}${twin}
    <div class="artwrap">${spriteHtml(u.id)}${roleBadge(u.id)}${opts.held === false ? '' : heldBadge(u, opts.where, opts.idx)}</div>
    <div class="uname">${esc(SPECIES[u.id].name)}</div>
    ${pipHtml}${barHtml}${opts.bar ? statusHtml(u) : ''}
    <div class="stats"><span class="a ${u.tmpAtk||hs.atk?'xup':''}" title="Attack">${SI('a')}${eA}</span><span class="h ${hs.hp?'xup':''}" title="HP">${SI('h')}${eH}</span></div>
    <div class="stats spd"><span class="s ${(u.tmpSpd||0) + hs.spd < 0 ? 'xdown' : u.tmpSpd||hs.spd?'xup':''}" title="Speed">${SI('s')}${eS}</span></div>
    ${(c => statTri(eA, eH, eS, c ? { cmp: c } : null))(triCmpFor(u, opts))}${TRI_BEST && u.uid === TRI_BEST && !opts.price ? '<i class="ibest" title="Gains the most from this item">★</i>' : ''}
    ${opts.price ? `<div class="price">${opts.price}₽</div>` : ''}
  </div>`;
}

/** 5.5.2: a stat's icon (sword = Attack, heart = HP, bolt = Speed), drawn in CSS in the stat's colour. */
const SI = k => `<i class="si si-${k}" aria-hidden="true"></i>`;
/** 5.6.0: the stat triangle on the field. One corner per stat (Attack up top, Speed bottom-right, HP bottom-left);
    the gold shape reaches towards a corner as far as that stat goes, so a pokémon's build shows at a glance. */
const TRI_C = 23, TRI_R = 18.5;
function triPt(k, r){ const ang = -Math.PI / 2 + k * 2 * Math.PI / 3; return (TRI_C + Math.cos(ang) * TRI_R * r).toFixed(1) + ',' + (TRI_C + Math.sin(ang) * TRI_R * r).toFixed(1); }
const triFrac = (v, m) => Math.max(.12, Math.min(1, v / m));
/* 5.8.1: the triangles scale with your team. Each corner's full length is the larger of the starting bar and 1.15× the
   best on your team (party and PC, and a Daycare pick being compared), so levelled and evolved pokémon don't all fill
   their triangles: the shapes keep showing each one's build, and stay comparable with each other on the same screen. */
let TRI_SCALE = null;
function triScale(extra){
  const sc = { atk: BAR_MAX.atk, hp: BAR_MAX.hp, spd: BAR_MAX.spd };
  const all = G ? [...(G.team || []), ...(G.pc || [])].filter(Boolean) : [];
  for(const u of all){ sc.atk = Math.max(sc.atk, effAtk(u) * 1.15); sc.hp = Math.max(sc.hp, effHp(u) * 1.15); sc.spd = Math.max(sc.spd, effSpd(u) * 1.15); }
  if(extra){ sc.atk = Math.max(sc.atk, extra.a * 1.15); sc.hp = Math.max(sc.hp, extra.h * 1.15); sc.spd = Math.max(sc.spd, extra.s * 1.15); }
  return sc;
}
/** The gold shape's points for these stats. */
const triShape = (a, h, sp) => { const S = TRI_SCALE || triScale();
  return [triPt(0, triFrac(a, S.atk)), triPt(1, triFrac(sp, S.spd)), triPt(2, triFrac(h, S.hp))].join(' '); };
/* 5.7.0: while a Daycare pokémon is picked, every party triangle also shows that pokémon's shape (dashed), to compare.
   5.8.0: the same for a vitamin or a held item: each pokémon it can go on shows its shape with the item (dashed). */
let TRI_CMP = null;
function triWithItem(u, id, held){
  if(!u) return null;
  let v = null;
  if(held){ if(!HELD_ITEMS[id] || u.held === id) return null; v = { ...u, held: id }; }
  else {
    const def = ITEMS[id]; if(!def || !def.vitamin || !canUseItem(id, u, G)) return null;
    v = { ...u }; const fake = { boost: (x, d) => { for(const k of ['hp', 'atk', 'spd']) if(d[k]) x[k] = (x[k] || 0) + d[k]; } };
    try{ def.apply(v, fake); }catch(e){ return null; }
  }
  const c = { a: effAtk(v), h: effHp(v), s: effSpd(v) };
  return c.a === effAtk(u) && c.h === effHp(u) && c.s === effSpd(u) ? null : c;
}
/* 5.8.1: Options → Item hints. With a vitamin or held item picked, the party pokémon that gains the most from it
   (measured on the triangle: each stat's gain as a share of its bar) gets a gold star. */
let TRI_BEST = null;
function bestForItem(){
  if(!G || !sel || PREF.get('itemhint', 'on') === 'off') return null;
  let id = null, held = false;
  if(sel.kind === 'mart'){ const m = G.mart[sel.idx]; if(!m || m.bought) return null; id = m.id; held = !!m.held; }
  else if(sel.kind === 'bag'){ id = G.bag[sel.idx]; held = true; }
  if(!id) return null;
  let best = null, top = 0;
  for(const u of G.team){
    const c = triWithItem(u, id, held); if(!c) continue;
    const g = (c.a - effAtk(u)) / BAR_MAX.atk + (c.h - effHp(u)) / BAR_MAX.hp + (c.s - effSpd(u)) / BAR_MAX.spd;
    if(g > top + 1e-9){ top = g; best = u.uid; }
  }
  return best;
}
function triCmpFor(u, opts){
  if(opts && opts.price) return null;
  if(TRI_CMP) return TRI_CMP;
  if(!sel || !G) return null;
  if(sel.kind === 'mart'){ const m = G.mart[sel.idx]; return m && !m.bought ? triWithItem(u, m.id, m.held) : null; }
  if(sel.kind === 'bag'){ const id = G.bag[sel.idx]; return id ? triWithItem(u, id, true) : null; }
  return null;
}
function statTri(a, h, sp, opts){
  opts = opts || {};
  const out = [triPt(0, 1), triPt(1, 1), triPt(2, 1)].join(' '), mid = [triPt(0, .5), triPt(1, .5), triPt(2, .5)].join(' ');
  const dot = (k, col, key) => { const [x, y] = triPt(k, 1).split(','); return `<circle cx="${x}" cy="${y}" r="3" fill="${col}" data-k="${key}"/>`; };
  const cmp = opts.cmp ? `<polygon points="${triShape(opts.cmp.a, opts.cmp.h, opts.cmp.s)}" class="c"/>` : '';
  const label = opts.hide ? 'Stat shape' : `Attack ${a}, HP ${h}, Speed ${sp}`;
  return `<svg class="stri${opts.cls ? ' ' + opts.cls : ''}${cmp ? ' cmp' : ''}" viewBox="0 0 46 46" role="img" aria-label="${label}">${opts.hide ? '' : `<title>Attack ${a} · HP ${h} · Speed ${sp}</title>`}
    <polygon points="${out}" class="o"/><polygon points="${mid}" class="m"/><polygon points="${triShape(a, h, sp)}" class="f"/>${cmp}${dot(0, '#ff8a70', 'a')}${dot(1, '#7fbaff', 's')}${dot(2, '#6fe39a', 'h')}</svg>`;
}
/** 5.7.0: an opponent's summary shows the shape of its stats, not the numbers. */
function enemyTriHtml(u){
  const keep = TRI_SCALE; TRI_SCALE = triScale({ a: effAtk(u), h: effHp(u), s: effSpd(u) });   // measured against your team
  const tri = statTri(effAtk(u), effHp(u), effSpd(u), { hide: true, cls: 'big' }); TRI_SCALE = keep;
  return `<div class="etri">${tri}
    <div class="etl"><span class="ca">${SI('a')} Attack</span><span class="ch">${SI('h')} HP</span><span class="cs">${SI('s')} Speed</span>
    <small>The gold shape leans towards what it’s good at, measured against your own team. Opponents’ exact numbers stay hidden.</small></div></div>`;
}
/** 5.7.0: after a battle, a triangle that grew shows its old shape shrinking away and pulses the corner that grew. */
function triGrow(el, was, now){
  const t = el && el.querySelector('.stri'); if(!t || motionOff()) return;
  const f = t.querySelector('.f'), d = { a: now.atk - was.atk, h: now.hp - was.hp, s: now.spd - was.spd };
  const cur = { a: 0, h: 0, s: 0 };   // read the drawn values back off the label: they include held items
  const m = /Attack (\d+), HP (\d+), Speed (\d+)/.exec(t.getAttribute('aria-label') || '');
  if(m){ cur.a = +m[1]; cur.h = +m[2]; cur.s = +m[3]; }
  const old = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  old.setAttribute('points', triShape(cur.a - d.a, cur.h - d.h, cur.s - d.s)); old.setAttribute('class', 'was');
  f.parentNode.insertBefore(old, f.nextSibling);
  anim(old, [{ opacity: 1 }, { opacity: 1, offset: .35 }, { opacity: 0 }], { duration: 1500, easing: 'ease-out', remove: true });
  anim(f, [{ opacity: .25 }, { opacity: .25, offset: .3 }, { opacity: 1 }], { duration: 1200, easing: 'ease-out' });
  anim(t, [{ transform: 'scale(1)' }, { transform: 'scale(1.35)', offset: .45 }, { transform: 'scale(1)' }], { duration: 1100, easing: 'cubic-bezier(.3,1.4,.5,1)' });
  for(const k of ['a', 'h', 's']) if(d[k] > 0){ const c = t.querySelector(`circle[data-k="${k}"]`);
    if(c) anim(c, [{ transform: 'scale(1)' }, { transform: 'scale(2.2)', offset: .4 }, { transform: 'scale(1)' }], { duration: 900, delay: 300, iterations: 2, easing: 'ease-in-out' }); }
}
function martHtml(s, i){
  const def = ITEMS[s.id];
  return `<div class="slot ${sel && sel.kind==='mart' && sel.idx===i ? 'selected':''}" data-act="mart" data-i="${i}">
    ${s.bought ? '' : `<div class="unit item">
      ${itemSpriteHtml(s.id, def.icon)}
      <div class="uname">${esc(def.name)}</div>
      <div class="price">${def.cost}₽</div>
    </div>${s.reserved ? '<div class="frozen"></div>' : ''}`}
  </div>`;
}

function battleItemHtml(def, i){
  return `<div class="slot fixed ${sel && sel.kind==='bitem' && sel.idx===i ? 'selected':''}" data-act="bitem" data-i="${i}">
    <div class="unit item">
      ${itemSpriteHtml(def.id, def.icon)}
      <div class="uname">${esc(def.name)}</div>
      <div class="round">this round</div>
      <div class="price">${def.cost}₽</div>
    </div></div>`;
}

/* ===================================================================
   THE FORMATION GRID
   Three ranks, two abreast, exactly as the layout sketch: the party reads
   Back | Middle | Front left to right, with the front rank nearest the enemy.
   Party index 0-1 is Front, 2-3 Middle, 4-5 Back, so these arrays are just
   the order those indices appear in a 3-column grid.
   =================================================================== */
const RANK_W = TUNING.rankWidth;                       // 2 abreast
const RANKS  = TUNING.rankNames;                       // Front / Middle / Back
// left-to-right column order for each side
const COLS_OWN   = [2, 1, 0];                          // Back, Middle, Front
const COLS_ENEMY = [0, 1, 2];                          // Front, Middle, Back
// the party index living at (column, row)
const slotAt = (rank, row) => rank * RANK_W + row;

function rankHeaderHtml(cols){
  return `<div class="rankhead">${cols.map(r =>
    `<span>${RANKS[r]}</span>`).join('')}</div>`;
}

/** Lay out six cells in a 3x2 grid. `cell(index)` renders one. */
function formationHtml(cols, cell){
  let out = '';
  for(let row = 0; row < RANK_W; row++)
    for(const rank of cols) out += cell(slotAt(rank, row));
  return `<div class="formation">${out}</div>`;
}

/* ---------------- which slots can accept the current selection ------ */
function slotClass(i){
  const u = teamAt(G, i);
  if(sel && sel.kind === 'bag') return u ? 'valid' : '';
  if(sel && sel.kind === 'dc'){
    const s = G.daycare[sel.idx];
    if(!s) return '';
    if(!u && G.team.length < TUNING.maxTeam) return 'valid';
    if(u && u.id === s.unit.id && unitLevel(u) < 3) return 'mergeable';
    return '';
  }
  if(sel && sel.kind === 'pc'){
    const src = pcAt(G, sel.idx);
    if(!src) return '';
    if(u && u.id === src.id && unitLevel(u) < 3) return 'mergeable';
    if(!u && G.team.length < TUNING.maxTeam) return 'valid';
    return u ? 'valid' : '';        // a different species swaps places
  }
  if(sel && sel.kind === 'mart'){
    const s = G.mart[sel.idx];
    if(s && s.held) return u ? 'valid' : '';   // buy it straight onto this pokémon
    return (u && s && canUseItem(s.id, u, G)) ? 'valid' : '';
  }
  if(sel && sel.kind === 'bitem') return '';   // party-wide: there is no target to pick
  if(sel && sel.kind === 'team'){
    if(sel.idx === i) return 'selected';
    const src = teamAt(G, sel.idx);
    if(u && src && u.id === src.id && unitLevel(u) < 3) return 'mergeable';
    return 'valid';
  }
  return '';
}

/* ---------------- the PC box --------------------------------------- */
function pcSlotClass(i){
  const u = pcAt(G, i);
  if(sel && sel.kind === 'bag') return u ? 'valid' : '';
  if(sel && sel.kind === 'pc'){
    if(sel.idx === i) return 'lifted';
    const src = pcAt(G, sel.idx);
    // a twin in the box can take the copy without a trip through the party
    if(u && src && u.id === src.id && unitLevel(u) < 3) return 'mergeable';
    return 'valid';                // v34: anywhere else in the box — move it, or swap
  }
  if(sel && sel.kind === 'dc'){
    const s = G.daycare[sel.idx];
    if(u && s && u.id === s.unit.id && unitLevel(u) < 3) return 'mergeable';   // v35: combine in the box
    return (!u && pcRoom(G) > 0) ? 'valid' : '';
  }
  if(sel && sel.kind === 'mart'){                // medicine, candy, stones and held items work on the PC too
    const s = G.mart[sel.idx];
    return (u && s && (s.held || canUseItem(s.id, u, G))) ? 'valid' : '';
  }
  if(sel && sel.kind === 'team') return (!u && pcRoom(G) > 0) || u ? 'valid' : '';   // store it, or swap with this one
  return '';
}

/* The box, Gen 3-5 style: sprites sit straight on the wallpaper with a soft
   shadow and no frame each. Everything else about a pokémon lives in the
   popup, which is what stops twelve of these fighting for room. */
function pcHtml(){
  let cells = '';
  const last = Math.max(pcCap(G), ...G.pc.map(u => u.box + 1));
  for(let i = 0; i < last; i++){
    const u = pcAt(G, i);
    const cls = pcSlotClass(i);
    if(!u){
      cells += `<span class="cell empty ${cls}" data-act="pc" data-i="${i}"></span>`;
      continue;
    }
    const ready = pcCanMerge(G, pcIdx(G, i));
    const f = hpFracOf(G, u);
    cells += `<button class="cell ${cls} ${ready ? 'ready' : ''} ${f === 0 ? 'fainted' : ''}" data-act="pc" data-i="${i}"
      data-pop="pc:${i}" title="${esc(u.nm)}${f === 0 ? ' — fainted' : f < 1 ? ` — ${Math.round(f*100)}% HP` : ''}">
      ${SPRITES[u.id] ? `<img src="${SPRITES[u.id]}" alt="${esc(u.nm)}">`
                      : `<span class="letters">${esc(u.nm.slice(0,2))}</span>`}
      ${isLegend(u) ? '<i class="clv leg">★</i>' : unitLevel(u) > 1 ? `<i class="clv">L${unitLevel(u)}</i>` : ''}
      ${ready ? `<i class="cready" title="${pcTwinInBox(G, pcIdx(G, i)) >= 0
        ? 'another copy is in the box' : 'a party member can take this copy'}">＋</i>` : ''}
      ${heldBadge(u, 'pc', i, 'mini')}
      ${f > 0 && f < 1 ? `<i class="cwound"><u style="width:${f*100}%"></u></i>` : ''}
    </button>`;
  }
  return `<div class="wall">${cells}</div>`;
}

/* The Bag: the same idea as the box, one floor down and a different pocket.
   Four slots, items only, and picking one up works exactly like picking up a
   pokémon — tap it, then tap whoever should carry it. */
function bagHtml(){
  let cells = '';
  for(let i = 0; i < Math.max(bagCap(G), G.bag.length); i++){
    const id = G.bag[i];
    if(!id){
      cells += `<span class="bcell empty"></span>`;
      continue;
    }
    const d = HELD_ITEMS[id];
    const on = sel && sel.kind === 'bag' && sel.idx === i;
    cells += `<button class="bcell ${on ? 'lifted' : ''}" data-act="bag" data-i="${i}"
      data-bagpop="${i}" title="${esc(d.name)}">${itemGlyph(id, d.icon)}</button>`;
  }
  return `<h2 class="sep bagttl"><span class="tg">Bag</span> <span class="sub">${G.bag.length}/${bagCap(G)} held items</span></h2>
    <div class="wall bag">${cells}</div>`;
}

/* ===================================================================
   THE SUMMARY — since v43 it is drawn only in the message box (#inspect).
   popupHtml() builds it; the old floating card and its hover/double tap are gone.
   =================================================================== */
let popupEl = null;
const wideScreen = () => window.matchMedia('(min-width: 700px)').matches;
const finePointer = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/* Popups are addressed by LOCATION ("pc:3"), not by uid. Two pokémon sharing
   a uid used to make one popup show the other; a location can only ever hold
   one of them. */
function unitAtRef(ref){
  if(!ref) return null;
  const [where, n] = String(ref).split(':');
  const i = +n;
  if(where === 'team') return teamAt(G, i);
  if(where === 'pc')   return pcAt(G, i);
  if(where === 'dc'){ const s = G.daycare[i]; return s && !s.bought ? s.unit : null; }
  return null;
}

/* Bar maxima are DERIVED from the roster, not typed in. They were typed in
   (70 / 24 / 140) and the stat rescale silently pegged every attack bar at
   100% — attack now reaches 63 — while speed bars stopped passing 62%. A
   number that has to track another number should be computed from it. */
const BAR_MAX = (() => {
  const top = stat => Math.max(...Object.keys(SPECIES).filter(k => !SPECIES[k].legendary).map(k => SPECIES[k][stat]));   // 2.1.0: a legendary's bar may run full
  return { hp: Math.round(top('hp') * 1.12),
           atk: Math.round(top('atk') * 1.12),
           spd: Math.round(top('spd') * 1.12) };
})();

function statBar(label, value, max, colour, bonus, icon){
  const w = Math.max(3, Math.min(100, Math.round(value / max * 100)));
  // the slice of the bar that comes from an item, drawn lighter on the end
  const bw = bonus > 0 ? Math.max(2, Math.min(w, Math.round(bonus / max * 100))) : 0;
  // v51: an item can cost a stat too (Choice Band's Speed) — shown in red, no hatching
  return `<div class="sb${icon ? ' sbi' : ''}" style="--c:${colour}"><label>${icon ? SI(icon) : ''}${label}</label>
    <i class="sbar"><u style="width:${w}%;background:${colour}"></u>${
      bw ? `<em style="width:${bw}%;left:${w - bw}%"></em>` : ''}</i><b>${value}${
      bonus > 0 ? `<i class="sbon">+${bonus}</i>` : bonus < 0 ? `<i class="sbon neg">−${-bonus}</i>` : ''}</b></div>`;
}

/* Speed decides how OFTEN a pokémon acts, and a raw "»61" cannot tell you
   whether that is fast — fast is only ever relative to the rest of your party.
   These three turn the stat into the sentence a player actually needs, and all
   of them read the engine's clock rather than a second copy of the maths. */
const PACE_TIERS = [[0.75,'Sluggish','p1'], [0.95,'Steady','p2'],
                    [1.2,'Brisk','p3'],     [Infinity,'Blistering','p4']];
const paceTier = r => PACE_TIERS.find(([lim]) => r < lim);
const RANK_WORD = ['fastest','2nd fastest','3rd fastest','4th fastest','5th fastest','6th fastest'];

/* The same fact, at the moment of the decision. In the Daycare the question
   is never "is 61 fast" but "where would this one slot into my team", so the
   row answers that one instead. */
function dcPaceHtml(u){
  const team = (G.team || []).filter(Boolean);
  if(!team.length) return '';
  const r = paceVs(u, team);
  if(r == null) return '';
  return `<span class="dpace ${paceTier(r)[2]}"
    title="acts ${r.toFixed(2)}\u00d7 as often as your party average">
    ${RANK_WORD[Math.min(5, paceRank(u, team))]}</span>`;
}

/* The rate line under the stat bars. Hidden with an empty party: "1.00x your
   average" compared against nothing but itself is noise, not information. */
function paceLineHtml(u){
  const team = (G.team || []).filter(Boolean);
  if(team.length < 2) return '';
  const r = paceVs(u, team);
  if(r == null) return '';
  const [, word, cls] = paceTier(r);
  const mine = team.includes(u);
  return `<div class="paceline"><span class="pacechip ${cls}">${word}</span>
    <span>Acts <b>${r.toFixed(2)}\u00d7</b> as often as your party average</span>
    ${mine ? '' : `<span class="pacerank">would be your ${RANK_WORD[Math.min(5, paceRank(u, team))]}</span>`}
  </div>`;
}

/** Mid-gauntlet only: what this pokémon has left, in words. */
function woundLineHtml(u){
  if(!inGauntlet(G)) return '';
  const f = hpFracOf(G, u);
  if(f >= 1) return '';
  const resting = (G.pc || []).includes(u);
  return f === 0
    ? `<div class="popwound ko">Fainted — out until the Elite Four is over. Resting doesn't revive.</div>`
    : `<div class="popwound">${Math.round(effHp(u) * f)} / ${effHp(u)} HP — ${resting
        ? `resting: +${Math.round(TUNING.benchRest * 100)}% for each fight it sits out.`
        : 'carried from the last fight.'}</div>`;
}

/* Vitamins taken, out of the per-pokémon cap. Only shown once it has had some. */
/** "Counts toward the Speed vitamin limit of 10 per pokémon, shared with Carbos." (6.5.2) */
function vitLimitText(id){
  const g = ITEMS[id].group || id, others = vitMembers(g).filter(k => k !== id).map(k => ITEMS[k].name);
  return ` Counts toward the ${VIT_GROUPS[g]} vitamin limit of ${TUNING.vitaminCap} per pokémon${others.length ? `, shared with ${others.join(' and ')}` : ''}.`;
}
function vitLineHtml(u){
  /* 6.5.2: one chip per vitamin LIMIT (Attack, HP, Speed), listing which items filled it, because the role vitamins
     share the limit of the vitamin they replace: Energy Root counts as a Speed vitamin, Iron and Zinc as HP, Calcium as Attack. */
  const groups = Object.keys(VIT_GROUPS).filter(k => vitaminsTaken(u, k));
  const egg = u.eggTicks || 0, man = u.manuals || 0;          // Lucky Egg rounds and Training Manuals have caps too
  if(!groups.length && !egg && !man) return '';
  const chips = groups.map(g => {
    const n = vitaminsTaken(u, g), full = n >= TUNING.vitaminCap, by = u.vitBy || {};
    const known = vitMembers(g).filter(k => by[k]);
    const sum = known.reduce((t, k) => t + by[k], 0);
    const parts = known.map(k => `${esc(ITEMS[k].name)} ×${by[k]}`).concat(n > sum ? [`${esc(ITEMS[g].name)} ×${n - sum}`] : []);   // older saves only know the total
    return `<span class="${full ? 'full' : ''}" title="${esc(VIT_GROUPS[g])} vitamins share one limit of ${TUNING.vitaminCap}: ${vitMembers(g).map(k => esc(ITEMS[k].name)).join(', ')}">${itemGlyph(g, ITEMS[g].icon)} ${esc(VIT_GROUPS[g])} vitamins ${n}/${TUNING.vitaminCap}${parts.length > 1 || (parts.length && known.length && known[0] !== g) ? ` <i class="vitby">(${parts.join(', ')})</i>` : ''}</span>`;
  });
  if(man) chips.push(`<span class="${man >= manualCap(G) ? 'full' : ''}">${itemGlyph('manual', ITEMS.manual.icon)} Training Manuals ${man}/${manualCap(G)}</span>`);
  if(egg) chips.push(`<span class="${egg >= TUNING.eggCap ? 'full' : ''}">${itemGlyph('egg', HELD_ITEMS.egg.icon)} Lucky Egg ${egg}/${TUNING.eggCap}</span>`);
  return `<div class="popvit">${chips.join('')}</div>`;
}

/* 2.2.0 (Sean): the summary shows the EXP pips too — the PC grid has no room
   for them, so this is where you check how close a stored pokémon is. */
function popPipsHtml(u){
  const l = unitLevel(u);
  if(l >= 3) return '<span class="poppips max">max</span>';
  const p = expPipsToNext(u), left = p.need - p.have;
  let h = '';
  for(let i = 0; i < p.need; i++) h += `<i class="${i < p.have ? 'on' : ''}"></i>`;
  return `<span class="poppips" title="${left} more cop${left === 1 ? 'y' : 'ies'} (or Rare Cand${left === 1 ? 'y' : 'ies'}) to reach Lv ${l + 1}">${h}</span>`;
}
function popupHtml(u, enemy){
  const sp = SPECIES[u.id], l = unitLevel(u), t = TYPES[sp.type];
  const hs = heldStats(u);
  const h = heldOf(u);
  /* The item's own share of each stat is called out on the bar, so you can see
     what you'd be giving up by taking it off. */
  const itemBlock = !h ? '' : `
    <div class="popheld ${h.when && !h.when(u) ? 'off' : ''}">
      <span class="hicon">${itemGlyph(u.held, h.icon)}</span>
      <div>
        <b>${esc(h.name)}<i class="hkind ${h.kind}">${esc(h.kind)}</i></b>
        <p>${esc(h.text)}</p>
        ${h.when && !h.when(u)
          ? `<p class="hoff">${esc(h.offText || 'No effect on this pokémon.')}</p>` : ''}
      </div>
    </div>`;
  return `<div class="pcol a"><div class="pophead">
      <div class="popart" style="--tcol:${typeColor(u.id)}">
        ${SPRITES[u.id] ? `<img src="${SPRITES[u.id]}" alt="">` : esc(sp.name.slice(0,2))}
        ${heldBadge(u, null, null, 'pop')}</div>
      <div><div class="popname">${esc(sp.name)}</div>
        <span class="poptype" style="background:${typeColor(u.id)}">${esc(sp.type)}</span>
        ${roleChip(u.id)}
        ${sp.legendary ? '<span class="poplv legend">★ Legendary</span>' : `<span class="poplv">Lv ${l}</span>${popPipsHtml(u)}`}</div>
    </div>
    ${enemy ? enemyTriHtml(u) : `<div class="popbars">
      ${statBar('Atk', effAtk(u), BAR_MAX.atk, 'var(--atk)', hs.atk + (u.tmpAtk||0), 'a')}
      ${statBar('HP',  effHp(u),  BAR_MAX.hp,  'var(--hp)',  hs.hp, 'h')}
      ${statBar('Spd', effSpd(u), BAR_MAX.spd, 'var(--spd)', hs.spd + (u.tmpSpd||0), 's')}
    </div>`}
    ${enemy ? '' : paceLineHtml(u)}
    ${woundLineHtml(u)}
    ${itemBlock}
    ${vitLineHtml(u)}
    </div><div class="pcol b">
    <div class="popmove"><b>${esc(sp.move.name)}</b> <i class="trig">Main move</i><p>${esc(sp.move.text(l))}</p></div>
    ${move2Html(sp, l, null, heldOf(u) && heldOf(u).lockMain ? heldOf(u).name : null)}
    <div class="poprole r-${roleOf(u.id)}"><b>${ROLES[roleOf(u.id)].icon} ${esc(ROLES[roleOf(u.id)].name)} · ${esc(ROLES[roleOf(u.id)].trait)}</b> ${subroleTag(u.id)}
      <p>${esc(ROLES[roleOf(u.id)].text())}</p></div>
    <div class="popmu">
      ${t.weak.length ? `<span class="bad">weak to ${t.weak.join(', ')} ×2</span>` : ''}
      ${t.resist.length ? `<span class="good">resists ${t.resist.join(', ')} ×½</span>` : ''}
    </div>
    ${evoLineHtml(u.id)}</div>`;
}

function hidePopup(){ if(popupEl) popupEl.hidden = true; }

/* 3.7.0 · FIRST-RUN TIPS — one short card at a time, each shown once, in the
   order you meet the thing it explains. START → Options → Tips hides them or
   shows them again. Browser test runs don't see them unless window.PKB_TIPS. */
const TIPS = (() => {
  const KEY = 'pkb_tipsSeen';
  const LIST = [
    { id:'shop',   when: () => true,
      title:'Welcome, Trainer!', text:'Tap a pokémon in the Daycare, then tap an empty spot in your party to buy it. You earn more ₽ after every battle.' },
    { id:'inspect', when: g => g.team.length >= 1,
      title:'Tap to inspect', text:'Tap any pokémon — yours, the Daycare’s, a scouting report’s, or either side in a battle — to see its moves, role and matchups.' },
    { id:'merge',  when: g => g.turn >= 2,
      title:'Three of a kind', text:'Three copies of the same pokémon make it level 2, six make it level 3 — and levelling up evolves it. Drop a copy onto the one you have.' },
    { id:'roles',  when: g => g.team.length >= 3,
      title:'Front rank takes the hits', text:'The badge on each picture is its role. Tanks go in front and Cannons at the back — “Line up by role” does it for you.' },
    { id:'boss',   when: g => { const n = nextUp(g); return !!(n && n.boss); },
      title:'A gym leader is next', text:'Their card shows their type and team style. Lose and you keep a scouting report of exactly what they fielded for the rematch.' },
  ];
  const seen = () => { try{ return JSON.parse(localStorage.getItem(KEY) || '[]') || []; }catch(e){ return []; } };
  const allowed = () => (!navigator.webdriver || window.PKB_TIPS) && PREF.get('tips', 'on') !== 'off';
  function current(g){
    if(!g || !allowed() || g.over) return null;
    const s = seen();
    return LIST.find(t => !s.includes(t.id) && t.when(g)) || null;
  }
  function dismiss(id){ const s = seen(); if(!s.includes(id)) s.push(id); try{ localStorage.setItem(KEY, JSON.stringify(s)); }catch(e){} }
  function reset(){ try{ localStorage.removeItem(KEY); }catch(e){} }
  function html(g){
    const t = current(g); if(!t) return '';
    return `<div class="tipcard" role="note"><span class="tipicon">💡</span><div><b>${esc(t.title)}</b><p>${esc(t.text)}</p></div>
      <button class="btn tipok" data-act="tipok" data-tip="${t.id}">Got it</button></div>`;
  }
  return { html, dismiss, reset, current, LIST };
})();

/* 3.7.0 · TAP TO INSPECT, EVERYWHERE — the same summary card for pokémon
   that aren't yours: the scouting report, both sides of a battle, and the
   team on the run-over screen. */
function openUnitCard(u, note, enemy){
  if(!u || !SPECIES[u.id]) return;
  SFX.play('open');
  const d = modal(`${note ? `<p class="ucnote">${note}</p>` : ''}<div class="isum ucard">${popupHtml(u, enemy)}</div>
    <div class="btnrow"><button class="btn primary" data-m="close">Close</button></div>`);
  d.classList.add('unitcard');
  d.querySelector('[data-m="close"]').onclick = () => { SFX.play('back'); d.remove(); };
}
function openFighterCard(F){
  if(!battle || !F) return;
  const mine = F.side === 'p';
  const src = mine ? (G.team || []).concat(G.pc || []).find(x => x && x.uid === F.uid)
                   : ((battle.opp && battle.opp.team) || []).find(x => x && x.uid === F.uid);
  const u = src || { id:F.id, exp:0, hp:F.maxHp, atk:F.atk, spd:F.spd };
  openUnitCard(u, mine ? 'Your pokémon' : esc(battle.oppName || 'Opponent'), !mine);
}

/* ===================================================================
   THE PICK-UP CURSOR
   Lifting a pokémon shows it riding the pointer on a mouse, or as a bar
   along the bottom on a touch screen where a finger would cover it.
   =================================================================== */
let carryEl = null;
function updateCarry(){
  if(!carryEl){
    carryEl = document.createElement('div');
    carryEl.className = 'carry';
    carryEl.hidden = true;
    document.body.appendChild(carryEl);
  }
  const held = heldUnit();
  const item = heldItem();
  document.body.classList.toggle('carrying', !!(held || item));
  // the contextual bar is pinned to the bottom on touch; the sheet has to
  // sit above it or the buttons you need are behind the thing describing them
  document.body.classList.toggle('picking', !!sel);
  if(!held && !item){ carryEl.hidden = true; return; }
  carryEl.hidden = false;
  carryEl.classList.toggle('pinned', !finePointer());
  // 2.2.1: start ON the pointer — never at a stale or default spot — and stay hidden
  // until the page has seen the pointer at all
  if(finePointer()) placeCarry();
  const verb = finePointer() ? 'click' : 'tap';
  const ch = held
    ? `${SPRITES[held.id] ? `<img src="${SPRITES[held.id]}" alt="">` : ''}
       <span>${esc(held.nm)}</span>
       <em>${verb} a slot</em>`
    : `<span class="carryitem">${itemGlyph(item.id, item.def.icon)}</span>
       <span>${esc(item.def.name)}</span>
       <em>${verb} a pokémon</em>`;
  if(carryEl.dataset.was !== ch){ carryEl.dataset.was = ch; carryEl.innerHTML = ch; }   // v49: no re-decode on every tap
}
/** A Bag item on the cursor, so a phone shows what it is carrying. */
function heldItem(){
  if(!sel || sel.kind !== 'bag') return null;
  const id = G.bag[sel.idx];
  return id && HELD_ITEMS[id] ? { id, def: HELD_ITEMS[id] } : null;
}
/** Whatever the cursor is currently holding, if anything. */
function heldUnit(){
  if(!sel) return null;
  if(sel.kind === 'pc')   return pcAt(G, sel.idx);
  if(sel.kind === 'team') return teamAt(G, sel.idx);
  if(sel.kind === 'dc'){ const s = G.daycare[sel.idx]; return s && !s.bought ? s.unit : null; }
  return null;
}

/* ---------------- inspector ---------------------------------------- *//* ---------------- inspector ---------------------------------------- */
function matchupHtml(type){
  const t = TYPES[type]; if(!t) return '';
  return (t.weak.length ? `<span class="mu bad">weak to ${t.weak.join(', ')} ×2</span>` : '')
       + (t.resist.length ? `<span class="mu good">resists ${t.resist.join(', ')} ×½</span>` : '');
}

/** The pokémon's whole evolution line, with the current stage marked. */
/** How `child` is reached from its parent: { by, stone } (1.3.0: branch-aware). */
const evoStep = child => { const p = evoParent(child); return p ? evoNext(p).find(n => n.into === child) : null; };
const STAT_WORD = { atk:'Attack', hp:'HP', spd:'Speed' };
/* one way a pokémon can evolve: a stone's icon, the stat that decides it, or a plain level up */
const optGlyph = n => n.by === 'stone' && ITEMS[n.stone] ? itemGlyph(n.stone, ITEMS[n.stone].icon) : n.stat ? `<small>${STAT_WORD[n.stat]}</small>` : '↑';
const optWords = n => n.by === 'stone' && ITEMS[n.stone] ? `a ${ITEMS[n.stone].name}` : n.stat ? `a level up with ${STAT_WORD[n.stat]} as its highest stat` : 'a level up';
const stageArrow = step => `<span class="arr">${step.by === 'stone' && ITEMS[step.stone] ? itemGlyph(step.stone, ITEMS[step.stone].icon) : '→'}</span>`;
function evoLineHtml(id){
  const line = evoLine(id), nx = evoNext(id);
  if(line.length < 2 && !nx.length) return '<span class="mu">does not evolve — levels up into bigger stats</span>';
  const parts = line.map((k,i) => {
    const step = i > 0 ? evoStep(k) : null;
    return (step ? stageArrow(step) : '') + `<span class="stage ${k === id ? 'now' : ''}">${esc(SPECIES[k].name)}</span>`;
  }).join('');
  // a branching line (Eevee, Tyrogue, Gloom with a Sun Stone): every way it can go, and what decides it
  const branches = nx.length > 1 ? `<span class="arr">→</span>` + nx.map(n =>
    `<span class="stage branch">${optGlyph(n)} ${esc(SPECIES[n.into].name)}</span>`).join('<span class="arr">/</span>') : '';
  const allStone = nx.length > 1 && nx.every(n => n.by === 'stone');
  const how = !nx.length ? 'final form'
    : allStone ? `a ${nx.map(n => ITEMS[n.stone].name.replace(' Stone', '')).join(', ').replace(/, ([^,]*)$/, ' or $1')} Stone decides what it becomes`
    : nx.length > 1 ? nx.map(n => `${esc(SPECIES[n.into].name)} by ${optWords(n)}`).join(' · ')
    : nx[0].by === 'stone' ? `needs a ${ITEMS[nx[0].stone].name}`
    : 'evolves on its next level up';
  return `<div class="line">${parts}${branches}</div><span class="mu">${how}</span>`;
}

/* v49: a message floats at the top of the screen instead of replacing the
   summary, so the page under it keeps its shape. */
const toastHtml = () => toast ? `<div class="toastbox" role="status"><b>${esc(toast)}</b></div>` : '';
/* 1.5.0: what a stone would do to the pokémon you own — before you buy it.
   For Eevee this is the whole point: the stone picks the evolution. */
function stonePreview(stone){
  const out = [];
  for(const [where, list] of [['party', G.team || []], ['PC', G.pc || []]]) for(const u of list){
    if(!u || !canUseItem(stone, u, G)) continue;
    const n = evoNext(u.id).find(x => x.stone === stone);
    if(n) out.push({ u, where, into: n.into });
  }
  return out;
}
const miniSprite = id => SPRITES[id] ? `<img class="pix" src="${SPRITES[id]}" alt="">` : '';
function stonePreviewHtml(stone){
  const list = stonePreview(stone);
  if(!list.length) return '';
  return `<div class="sprevs">${list.map(({ u, where, into }) => {
    const a = SPECIES[u.id], b = SPECIES[into], d = k => b[k] - a[k];
    const sign = n => (n >= 0 ? '+' : '−') + Math.abs(n);
    return `<div class="sprev">${miniSprite(u.id)}<span>${esc(u.nm)} <i class="dim">(${where})</i></span><span class="arr">→</span>${miniSprite(into)}<b>${esc(b.name)}</b>
      <span class="poptype" style="background:${TYPES[b.type].color}">${esc(b.type)}</span>${roleChip(into)}
      <span class="sdel">◆${sign(d('atk'))} ♥${sign(d('hp'))} »${sign(d('spd'))}</span></div>`; }).join('')}</div>`;
}
function inspectHtml(){
  if(inspect && inspect.kind === 'mart'){
    const d = ITEMS[inspect.id];
    return `<b>${itemGlyph(inspect.id, d.icon)} ${esc(d.name)}</b>${rarityTag(d)}<span class="tag">${d.cost}₽</span>
            <span class="tag">permanent</span><br><span class="abil">${esc(d.text)}${
              d.vitamin ? vitLimitText(inspect.id) : ''}</span>${stonePreviewHtml(inspect.id)}`;
  }
  if(inspect && inspect.kind === 'held'){
    const d = HELD_ITEMS[inspect.id];
    return `<b>${itemGlyph(inspect.id, d.icon)} ${esc(d.name)}</b>${rarityTag(d)}
            ${inspect.cost !== false ? `<span class="tag">${d.cost}₽</span>` : ''}
            <span class="tag" style="color:var(--gold)">held — ${esc(d.kind)}</span>
            <br><span class="abil">${esc(d.text)}</span>`;
  }
  if(inspect && inspect.kind === 'bitem'){
    const d = BATTLE_ITEMS[inspect.idx];
    return `<b>${itemGlyph(d.id, d.icon)} ${esc(d.name)}</b><span class="tag">${d.cost}₽</span>
            <span class="tag" style="color:var(--gold)">next battle only</span>
            <br><span class="abil">${esc(d.text())} ${xUses(G, d)} of ${TUNING.xItems.perBattle} used.</span>`;
  }
  /* v43: the message box is THE summary — the pop-up card, hover and double
     tap are gone (Sean: "there should only be one way to see a summary"). */
  if(inspect && inspect.kind === 'unit'){
    const live = unitNow(inspect.u) || inspect.u;
    return `<div class="isum">${popupHtml(live)}</div>`;
  }
  const last = G && G.log.length ? G.log[G.log.length - 1] : '';
  return `<span style="color:var(--dim)">Tap a pokémon to see its move and evolution line.</span>${last ? `<br>${esc(last)}` : ''}`;
}

/* The tapped pokémon as it is now: a merge, evolution or held item after the
   tap shouldn't leave the box describing the old one. */
function unitNow(u){
  // by identity only — matching on uid is how a summary once showed the wrong pokémon
  if(!u || !G) return null;
  return G.team.concat(G.pc).find(x => x === u) || null;
}

/* ---------------- streak + income chips ---------------------------- */
/* Take it off, or sell it where it stands. Selling from the pokémon matters:
   with a full Bag you cannot take an item off to sell it, and the thing you
   want rid of is often the one in the way. */
function heldButtons(u, where, i){
  const d = HELD_ITEMS[u.held];
  const full = bagRoom(G) <= 0;
  return `<button class="btn" data-act="unequip" data-where="${where}" data-i="${i}"
      ${full ? 'disabled title="Your Bag is full"' : ''}>Take ${esc(d.name)}</button>
    <button class="btn" data-act="sellheld" data-where="${where}" data-i="${i}"
      >Sell +${heldResale(u.held)}₽</button>`;
}

/* ---------------- what you are walking into ------------------------
   A gym has to look different from a trainer battle before you press the
   button, not after. This is the strip above the Battle button: who, what
   they run, how many tries you have had, and — once you have lost to them —
   the team you saw, so a rematch is a plan instead of a re-roll. */
function nextUpHtml(){
  const n = nextUp(G);
  if(n.kind === 'trainer'){
    return '';   // v37: the dock at the bottom says who is next
    return `<div class="nextup">
      <span class="nlabel">Next</span>
      <b>Trainer battle</b>
      <span class="ndim">${n.untilGym === 1 ? 'gym leader after this one'
        : `${n.untilGym} battles to the gym`}</span>
      <span class="nstage">${n.stage}/${n.total}</span></div>`;
  }
  const b = n.boss;
  const kindLabel = n.kind === 'gym' ? `${esc(b.title)}`
    : n.kind === 'elite' ? 'Elite Four' : 'Champion';
  const types = b.theme ? b.theme.map(t => `<span class="ntype">${esc(t)}</span>`).join('') : '';
  const scout = n.scouted ? `
    <div class="scout">
      <b>Scouting report <span class="ndim">— what ${esc(b.name)} fielded last time</span></b>
      <div class="scoutrow">${n.scouted.map(u => `
        <span class="smon" data-act="scoutcard" data-i="${n.scouted.indexOf(u)}" role="button" tabindex="0" title="${esc(u.nm)}${
          u.held && HELD_ITEMS[u.held] ? ' · ' + esc(HELD_ITEMS[u.held].name) : ''}">
          ${SPRITES[u.id] ? `<img src="${SPRITES[u.id]}" alt="${esc(u.nm)}">`
                          : esc(u.nm.slice(0,2))}
          ${u.held && HELD_ITEMS[u.held] ? `<i class="sheld">${itemGlyph(u.held, HELD_ITEMS[u.held].icon)}</i>` : ''}
        </span>`).join('')}</div>
    </div>` : '';
  /* The gauntlet: who is left, and the rules — stated at the moment they bite.
     The warning on the turn BEFORE Lorelei matters most: it is the last shop,
     and a player who doesn't know that spends it like any other turn. */
  const g = n.gauntlet;
  const strip = g ? `<div class="gauntlet">${g.members.map((m, i) => `
      <span class="gmem ${i < g.at ? 'down' : i === g.at ? 'now' : ''} ${i === g.members.length - 1 ? 'champ' : ''}">
        ${bossArt(m, 'mini') || `<i class="lbadge ${i === g.members.length - 1 ? 'champion' : 'elite'}"></i>`}<b>${esc(m.name)}</b></span>`)
      .join('<span class="garr">›</span>')}</div>` : '';
  const rule = !g ? '' : g.running
    ? `<p class="nrule">Fight ${g.at + 1} of ${g.members.length}. The shops are closed and nobody heals.
       Swap pokémon in from your PC, rearrange, move held items. Anything resting in the PC recovers
       ${Math.round(TUNING.benchRest * 100)}% HP each fight it sits out; fainted pokémon stay down.</p>`
    : `<p class="nrule hot"><b>Last chance to shop.</b> Once you challenge ${esc(g.members[0].name)},
       all ${g.members.length} fights come one after another: <b>no shopping in between, and damage
       carries over</b>. Pokémon in your PC come in fresh — that is your bench. Lose any fight and you
       start again from ${esc(g.members[0].name)}.</p>`;
  return `<div class="nextup boss ${n.kind}">
    ${bossArt(b, 'big')}
    <div class="nhead">
      <span class="nlabel">${esc(kindLabel)}</span>
      <b>${esc(b.name)}</b>
      ${types}
      ${n.kind === 'gym' ? `<span class="nbadge">${esc(b.badge)} Badge</span>` : ''}
      <span class="nstage">${n.stage}/${n.total}</span>
    </div>
    ${strip}${rule}
    <p class="nblurb">${esc(b.blurb)}</p>
    ${n.attempt ? `<p class="nwarn ${n.lifeAtRisk ? 'hot' : ''}">
      Attempt ${n.attempt + 1}. ${n.lifeAtRisk
        ? 'Losing now costs a life as well as your money.'
        : `${freeAttemptsFor(G) - n.attempt} more before a defeat costs a life.`}</p>` : ''}
    ${scout}
  </div>`;
}

/* Eight badges in a row, filled as you win them. The one thing on the screen
   that says how far through the journey you are. */
/* `count` lets the victory screen show the badge you have just won, before
   `applyBattleResult` banks it on Continue — the moment you earn a badge is the
   one moment the case has to be right. `fresh` is the pip to animate in. */
/* A reroll button: free while the Lucky Ticket reward has rerolls left. */
function rollBtn(act, closed){
  const free = (G.freeRolls || 0) > 0;
  return `<button class="btn ${free ? 'freeroll' : ''}" data-act="${act}" ${
    closed || (!free && G.credits < TUNING.costRoll) ? 'disabled' : ''}>${
    free ? `Reroll free <span class="fr">×${G.freeRolls}</span>` : `Reroll ${TUNING.costRoll}₽`}</button>`;
}

function badgeCase(count, fresh){
  const n = TUNING.badgesToWin;
  const have = count === undefined ? G.badges : count;
  let pips = '';
  for(let i = 0; i < n; i++){
    const g = gymAt(G, i);
    pips += `<i class="bdg ${badgeCls(G, i)} ${i < have ? 'on' : ''} ${i === fresh ? 'fresh' : ''}"
      title="${esc(g.badge)} Badge — ${esc(g.name)}"></i>`;
  }
  return `<div class="stat badges" data-act="badges" role="button" tabindex="0" title="${have} of ${n} badges — tap for your badge rewards">
    <span class="lbl">Badges</span><span class="pips">${pips}</span></div>`;
}

/* v37: lives as a row of pokéballs, spent ones greyed out */
function livesHtml(){
  const n = Math.max(0, G.lives), max = Math.max(G.mods && G.mods.onelife ? 1 : TUNING.startingLives, n);
  let b = '';
  for(let i = 0; i < max; i++) b += `<i class="pball ${i < n ? '' : 'off'}"></i>`;
  return `<div class="stat lives" title="${n} ${n === 1 ? 'life' : 'lives'} left"><span class="lbl">Lives</span><span class="balls">${b}</span></div>`;
}

/* v37: the next fight, pinned to the bottom of the screen like a trainer
   stepping out to challenge you, with the Battle button under it. The dots are
   the road to the next badge: its trainer battles, then the gym (or the five
   fights of the Elite Four). A rival ambush still looks like a trainer here. */
function dockHtml(closed, flowOnly){
  const n = nextUp(G), st = stageOf(G), plan = runPlan(G), at = G.stage || 0;
  const b = isBoss(st) ? st.boss : null;
  let road = '';
  if(n.gauntlet){
    road = n.gauntlet.members.map((m, i) => `<i class="${i < n.gauntlet.at ? 'done' : i === n.gauntlet.at ? 'now' : ''}"></i>`).join('');
  } else if(n.kind === 'red'){
    road = '<i class="now"></i>';
  } else {
    let prev = at - 1; while(prev >= 0 && plan[prev].kind === 'trainer') prev--;
    let nx = at; while(nx < plan.length && plan[nx].kind === 'trainer') nx++;
    for(let k = prev + 1; k < nx; k++) road += `<i class="${k < at ? 'done' : k === at ? 'now' : ''}"></i>`;
    const bi = plan[nx] ? plan[nx].badge : 0;
    if(plan[nx]) road += `<i class="bdg ${badgeCls(G, bi % 8)} ${at === nx ? 'on now' : ''}" title="${esc(gymAt(G, bi).badge)} Badge"></i>`;
  }
  const line = !b ? `${trainerName(G.turn)} wants to battle!`
    : n.kind === 'gym' ? `${b.name} wants to battle!`
    : n.kind === 'elite' ? `Elite Four ${b.name} wants to battle!`
    : n.kind === 'red' ? `${b.name} is waiting at ${b.place}.`
    : `Champion ${b.name} wants to battle!`;
  const sub = !b ? `Trainer battle · ${n.untilGym === 1 ? 'gym leader after this one' : `${n.untilGym} battles to the gym`}`
    : n.kind === 'gym' ? `${b.title} · ${b.badge} Badge`
    : n.kind === 'elite' ? `Elite Four · fight ${n.gauntlet ? n.gauntlet.at + 1 : 1} of ${n.gauntlet ? n.gauntlet.members.length : 5}`
    : n.kind === 'red' ? `${b.place} · one chance, nothing to lose`
    : 'Champion · the last fight';
  const nobody = closed && !fightersOf(G).length;
  const label = nobody ? 'Nobody can fight — swap someone in from the PC'
    : b ? `Challenge ${esc(b.name)}` : 'Battle';
  const speech = `<div class="speech ${b ? 'boss ' + n.kind : 'nextup'}">
      <span class="who">${b ? bossArt(b, 'dockart') : '<i class="pball"></i>'}</span>
      <div class="say"><b>${esc(line)}</b><span class="ssub">${esc(sub)}</span>${n.kind === 'gym' && peekEncounter(G) ? '<span class="rumour">\u2726 Rumour: something rare has been seen near this gym</span>' : ''}<span class="road">${road}</span></div>
      <span class="nstage">${n.stage}/${n.total}</span>
    </div>`;
  if(flowOnly) return speech;
  /* 4.9.1: on a phone the dock is only the Battle button (who is next sits in the page above the Daycare), so it stops covering the shop */
  const opp = b ? b.name : trainerName(G.turn);
  return `<div class="dock">
    ${undoHtml(closed)}
    ${!closed && encounterOpen(G) ? (() => { const e = G.encounter; return `<div class="legdock"><span>\u2726 <b>${esc(SPECIES[e.id].name)}</b> appeared!</span>
      <button class="btn primary" data-act="legend" ${G.credits >= e.cost ? '' : 'disabled'}>Recruit ${e.cost}\u20bd</button><button class="btn ghost" data-act="legendpass">Let it go</button></div>`; })() : ''}
    ${speech}
    <button class="btn fight big-cta ${b ? 'boss' : ''}" data-act="endturn" ${nobody ? 'disabled' : ''}>${label}${nobody ? '' : `<small class="fopp"> · ${esc(opp)} ${n.stage}/${n.total}</small>`}</button>
  </div>`;
}

function streakChip(){
  if(!G.streak) return '';
  const n = Math.abs(G.streak);
  if(n < 2) return '';
  return G.streak > 0
    ? `<div class="stat streak win"><span class="lbl">Streak</span>${n}W</div>`
    : `<div class="stat streak lose"><span class="lbl">Streak</span>${n}L</div>`;
}

/* ===================================================================
   SHOP SCREEN
   =================================================================== */
/** 4.1.0: a mixed run's Focus lines and open cross-gen evolutions, as a small note over the Daycare. */
const poolLines = g => (g && g.evoPool || []).map(src => evoOpts(SPECIES[src].evo2).map(n => `${SPECIES[src].name} → ${SPECIES[n.into].name}`).join(' / '));
function runNoteHtml(g){
  if(!g || (!(g.focus && g.focus.length) && !(g.evoPool && g.evoPool.length))) return '';
  return `<div class="runnote"><div><b>★ Focus</b> ${(g.focus || []).map(k => `${miniSprite(k)}${esc(SPECIES[k].name)}`).join(' · ')}</div>
    <div class="dim"><b>Open evolutions</b> ${poolLines(g).map(esc).join(' · ')}</div></div>`;
}
function redStripHtml(){
  const sb = secretBoss();
  return `<div class="redstrip">${bossArt(sb, 'redart')}<div><b>${esc(sb.place)}</b>
    <span>${esc(sb.name)} is here, and you are healed. This is your one turn to spend, and you only get one try: beat ${sb.id === 'oak' ? 'him' : 'him'} for ${esc(sb.name)}\u2019s Badge, lose and nothing is lost.</span></div></div>`;
}
function renderShop(){
  const maxTier = tierFor(G);
  /* Mid-gauntlet the shops are shut. The panels stay where they are — the
     layout shouldn't jump around between fights — but say so plainly. */
  const closed = inGauntlet(G);
  /* Between fights the strip saying who is next and why nobody is healing is
     the most important thing on screen, and the closed shops the least — so it
     moves up under the party instead of sitting below two dead panels, which
     on a phone put it a long scroll away. */
  const closedNote = what => `<div class="closed"><b>Closed</b>
    <span>${what} reopens when the Elite Four is over, win or lose.</span></div>`;
  const inc = incomeFor(G);

  /* --- the party, as the formation it will fight in --- */
  const partyGrid = '<div class="pfield"><div class="pfclip" data-keep aria-hidden="true"></div>' + rankHeaderHtml(COLS_OWN) + formationHtml(COLS_OWN, i => {
    const u = teamAt(G, i);
    return `<div class="slot ${u ? '' : 'empty'} ${slotClass(i)} pr${Math.floor(i / RANK_W)} pf${i % RANK_W}" data-act="team" data-i="${i}"
      ${u ? `data-pop="team:${i}"` : ''}>
      ${u ? unitHtml(u, { where:'team', idx:i, frac: inGauntlet(G) ? hpFracOf(G, u) : null }) : ''}</div>`;
  }) + '</div>';

  /* --- the order your party will act in, in the language the fight uses ---
     The battle draws this same strip. Showing it in the shop means the buying
     decision and the fight are read the same way: three Pikachus before one
     Snorlax IS what three times the rate looks like. Drawn from the engine's
     own clock, so it cannot disagree with the fight it is predicting. */
  const partyQueue = (() => {
    const team = fightersOf(G);
    if(team.length < 2) return '<div class="queue shopq ghostq" aria-hidden="true"><span class="qlbl">Order</span><span class="qmon p"></span></div>';   // 4.9.1: keeps the panel the same height with 0 or 1 pok\u00e9mon
    const cells = previewOrder(team, 8).map((u, n) =>
      `<span class="qmon p ${n === 0 ? 'now' : ''}" data-pop="team:${u.pos}"
        title="${esc(u.nm)} \u00b7 ${effSpd(u)} speed">
        ${SPRITES[u.id] ? `<img src="${SPRITES[u.id]}" alt="${esc(u.nm)}">`
                        : esc(u.nm.slice(0,2))}</span>`).join('');
    return `<div class="queue shopq"><span class="qlbl">Order</span>${cells}
      <span class="qmore">\u2026</span></div>`;
  })();

  /* --- Daycare: the party-menu list, scrollable when the board grows --- */
  const dcRows = [];
  for(let i = 0; i < TUNING.maxTeam; i++){
    const s2 = G.daycare[i];
    if(!s2){
      dcRows.push(`<div class="drow locked"><span class="dlock">🔒</span>
        <div class="dmain"><b>Slot ${i+1}</b><span class="dsub">opens at tier ${Math.ceil((i+1)/2)+2}</span></div></div>`);
      continue;
    }
    if(s2.bought){
      dcRows.push(`<div class="drow out"><div class="dmain"><b>Sold</b></div></div>`);
      continue;
    }
    const u = s2.unit, sp = SPECIES[u.id];
    // only mark it when a copy you own could still level from it — a copy
    // already at level 3 can't take another, so that isn't a merge
    const owned = G.team.some(t => t.id === u.id && unitLevel(t) < 3)
               || G.pc.some(t => t.id === u.id && unitLevel(t) < 3);
    dcRows.push(`<div class="drow ${sel && sel.kind==='dc' && sel.idx===i ? 'sel':''}"
      data-act="dc" data-i="${i}" data-pop="dc:${i}" style="--c:${typeColor(u.id)}">
      <span class="dball"></span>
      ${SPRITES[u.id] ? `<img class="dart" src="${SPRITES[u.id]}" alt="">`
                      : `<span class="dart letters">${esc(sp.name.slice(0,2))}</span>`}
      <div class="dmain">
        <b>${esc(sp.name)}${(G.focus || []).includes(u.id) ? '<i class="dfocus" title="This run\'s Focus line: it shows up more often">★</i>' : ''}${owned ? '<i class="downed" title="you have a copy that can level up from this one">●</i>' : ''}</b>
        <span class="dtype" style="background:${typeColor(u.id)}">${esc(sp.type)}</span>${roleChip(u.id)}
      </div>
      <div class="dnums">
        <span class="dstat"><span class="a" title="Attack">${SI('a')}${u.atk}</span><span class="h" title="HP">${SI('h')}${u.hp}</span><span class="s" title="Speed">${SI('s')}${u.spd}</span></span>
        ${dcPaceHtml(u)}
      </div>
      <span class="dprice">${TUNING.costBuy}₽</span>
    </div>`);
  }
  const dcList = `${runNoteHtml(G)}<div class="dclist">${dcRows.join('')}</div>`;

  /* --- PokeMart: one scrollable shelf, restock above, always-in-stock below --- */
  const martRow = (inner, cls, act, i) =>
    `<div class="martrow ${cls||''}" ${act ? `data-act="${act}" data-i="${i}"` : ''}>${inner}</div>`;

  /* The shelf is split: held items stay on a pokémon until you move them,
     medicine and stones are spent the moment you use them. */
  const martRowFor = (m, i) => {
    if(m.bought) return martRow(`<div class="mout">Sold out</div>`, 'out');
    const def = defOfSlot(m);
    if(!def) return '';
    return martRow(`
      ${itemSpriteHtml(m.id, def.icon, 'row')}
      <div class="mtext"><b>${esc(def.name)}${rarityTag(def)}</b><span>${esc(def.text)}</span>${m.held ? '' : (() => {
        // 1.5.0: a stone says what it would do to YOUR pokémon, right on the shelf
        const pv = stonePreview(m.id);
        if(!pv.length) return '';
        const groups = [];                          // two Eevees read "Eevee ×2 → Vaporeon", not twice
        for(const p of pv){ const g = groups.find(x => x.from === p.u.id && x.into === p.into); if(g) g.n++; else groups.push({ from: p.u.id, into: p.into, n: 1 }); }
        const shown = groups.slice(0, 2).map(g => `<span class="mp">${miniSprite(g.from)}${esc(SPECIES[g.from].name)}${g.n > 1 ? ` ×${g.n}` : ''} → ${miniSprite(g.into)}<b>${esc(SPECIES[g.into].name)}</b></span>`).join(' ');
        return `<span class="mprev">Yours: ${shown}${groups.length > 2 ? ` · +${groups.length - 2} more` : ''}</span>`; })()}</div>
      <div class="mprice">${def.cost}₽</div>
      ${m.reserved ? '<div class="pin">reserved</div>' : ''}`,
      sel && sel.kind==='mart' && sel.idx===i ? 'sel' : '', 'mart', i);
  };
  const heldRows = G.mart.map((m,i) => m.held ? martRowFor(m,i) : '').join('');
  const useRows  = G.mart.map((m,i) => m.held ? '' : martRowFor(m,i)).join('');
  const restock =
    (heldRows ? `<div class="mhead">Held — stays on until you move it</div>${heldRows}` : '') +
    (useRows  ? `<div class="mhead">Medicine &amp; stones — used right away</div>${useRows}` : '') ||
    `<div class="martrow out"><div class="mout">Nothing in stock</div></div>`;

  /* X items boost the whole party, so there is no target to pick: select the row
     and use it from the action bar. The pips say how many of this battle's
     uses are gone, and the row greys out at the cap. */
  const xPips = def => { const n = xUses(G, def), max = TUNING.xItems.perBattle;
    return `<span class="xpips" title="${n} of ${max} used this battle">${
      Array.from({ length: max }, (_, k) => `<i class="${k < n ? 'on' : ''}"></i>`).join('')}</span>`; };
  const counter = BATTLE_ITEMS.map((def, i) => martRow(`
      ${itemSpriteHtml(def.id, def.icon, 'row')}
      <div class="mtext"><b>${esc(def.name)} ${xPips(def)}</b><span>${esc(def.text())}</span></div>
      <div class="mprice">${def.cost}₽</div>`,
    'fixed ' + (xUses(G, def) >= TUNING.xItems.perBattle ? 'maxed ' : '')
      + (sel && sel.kind==='bitem' && sel.idx===i ? 'sel' : ''), 'bitem', i)).join('');

  /* --- contextual actions --- */
  let ctx = '';
  if(sel && sel.kind === 'dc'){
    const dcu = G.daycare[sel.idx] && G.daycare[sel.idx].unit;
    const twinPc = dcu && G.pc.some(u => u.id === dcu.id && unitLevel(u) < 3);
    ctx = `<div class="shopbar ctxbar"><span class="hintbar">Pick a party slot, or a PC box to store it${
             twinPc ? ` — or the ${esc(dcu.nm)} in the PC to combine` : ''}.</span>
           <button class="btn ghost" data-act="cancel">Cancel</button></div>`;
  } else if(sel && sel.kind === 'mart'){
    const s2 = G.mart[sel.idx];
    const d2 = defOfSlot(s2);
    const buy = s2 && s2.held
      ? `<span class="hintbar">Tap a pokémon — party or PC — to give it straight away, or put it in the Bag.</span>
         <button class="btn buy" data-act="buyheld" ${G.credits < d2.cost || bagRoom(G) <= 0 ? 'disabled' : ''}>${
           bagRoom(G) <= 0 ? 'Bag is full' : `To Bag ${d2.cost}₽`}</button>`
      : `<span class="hintbar">Pick the pokémon to use it on — in your party or the PC.</span>`;
    ctx = `<div class="shopbar ctxbar">${buy}
           <button class="btn" data-act="reserve">${s2 && s2.reserved ? 'Release hold' : 'Reserve'}</button>
           <button class="btn ghost" data-act="cancel">Cancel</button></div>`;
  } else if(sel && sel.kind === 'bag'){
    const bagId = G.bag[sel.idx];
    ctx = `<div class="shopbar ctxbar"><span class="hintbar">Tap any pokémon — in your party or the PC — to hand it over.</span>
           ${bagId ? `<button class="btn" data-act="sellheld" data-where="bag" data-i="${sel.idx}"
             >Sell +${heldResale(bagId)}₽</button>` : ''}
           <button class="btn ghost" data-act="cancel">Cancel</button></div>`;
  } else if(sel && sel.kind === 'bitem'){
    const d = BATTLE_ITEMS[sel.idx], used = xUses(G, d), max = TUNING.xItems.perBattle;
    const full = used >= max;
    ctx = `<div class="shopbar ctxbar">
           <span class="hintbar">${full ? `That's all ${max} for this battle.`
             : `Boosts your whole party for the next battle · ${used} of ${max} used.`}</span>
           <button class="btn buy" data-act="usex" ${full || G.credits < d.cost ? 'disabled' : ''}
             >Use ${esc(d.name)} — ${d.cost}₽</button>
           <button class="btn ghost" data-act="cancel">Done</button></div>`;
  } else if(sel && sel.kind === 'team'){
    const u = teamAt(G, sel.idx);
    ctx = `<div class="shopbar ctxbar">
           ${u && u.held ? heldButtons(u, 'team', sel.idx) : ''}
           <button class="btn" data-act="topc" ${pcRoom(G) <= 0 ? 'disabled':''}>Store in PC</button>
           <button class="btn danger" data-act="sell">Release +${unitLevel(u)}₽</button>
           <button class="btn ghost" data-act="cancel">Cancel</button></div>`;
  } else if(sel && sel.kind === 'pc'){
    const u = pcAt(G, sel.idx);
    const target = pcMergeTarget(G, pcIdx(G, sel.idx));
    const twin = pcTwinInBox(G, pcIdx(G, sel.idx));
    ctx = `<div class="shopbar ctxbar">
           <span class="hintbar">${
             target >= 0 && twin >= 0
               ? `Tap the other ${esc(u.nm)} — in the box or your party — to combine.`
             : target >= 0 ? `Tap ${esc(G.team[target].nm)} in your party to combine.`
             : twin >= 0   ? `Tap the other ${esc(u.nm)} in the box to combine.`
             : 'Tap a party slot to withdraw or swap, or another box to move it.'}</span>
           ${u && u.held ? heldButtons(u, 'pc', sel.idx) : ''}
           <button class="btn danger" data-act="release">Release +${unitLevel(u)}₽</button>
           <button class="btn ghost" data-act="cancel">Cancel</button></div>`;
  }

  return `
  <div class="topbar gb">
    <div class="stat credits"><span class="lbl">₽</span>${G.credits}</div>
    <div class="tcol">${livesHtml()}${badgeCase()}</div>
    <div class="tcol tright">
    <div class="stat turn"><span class="lbl">Turn</span>${G.turn}</div>
    ${streakChip()}
    ${closed ? '' : `<div class="stat next" title="carry ${inc.carry} + base ${inc.base} + result ${inc.result} + streak ${inc.streak}${inc.items ? ` + items ${inc.items}` : ''}${inc.badges ? ` + badges ${inc.badges}` : ''}${inc.rival ? ` + rival ${inc.rival}` : ''}">
      <span class="lbl">Next turn</span>+${inc.total}₽</div>`}
    </div>
    <button class="iconbtn start" data-act="menu" aria-label="Menu"><i class="burger" aria-hidden="true"></i>Menu${hasUnseen() ? '<i class="menudot" title="What’s new"></i>' : ''}</button>
  </div>

  <div class="bcwrap"><div class="bcL">
  ${modeBarHtml()}
  ${closed ? '' : encounterHtml()}
  ${TIPS.html(G)}
  <div class="panel party">
    <h2><span class="tg">Your Party</span> <span class="sub">the front rank takes the hits · speed decides how often you act</span>
      <button class="btn arrange${G.team.length > 1 ? '' : ' ghostb'}" data-act="arrange" ${G.team.length > 1 ? '' : 'tabindex="-1" aria-hidden="true"'} title="Tanks to the front, Cannons to the back">Line up by role</button>
      <button class="btn arrange${G.team.length ? '' : ' ghostb'}" data-act="presets" ${G.team.length ? '' : 'tabindex="-1" aria-hidden="true"'} title="Save a formation and snap back to it">Formations</button></h2>
    ${partyGrid}
    ${partyQueue}
  </div>

  <div class="speechflow">${dockHtml(closed, true)}</div>
  ${closed ? nextUpHtml() : ''}
  <div id="inspect">${inspectHtml()}</div><div class="inspgap" aria-hidden="true"></div>
  ${ctx}
  ${closed ? '' : G.redOpen && stageOf(G).kind === 'red' ? redStripHtml() : nextUpHtml()}
  </div>

  <div class="bcR">
  <div class="shelves">
    <section class="panel pc">
      <h2><span class="tg">PC</span> <span class="sub">${pcCap(G) ? `${G.pc.length}/${pcCap(G)} · trains at half rate` : 'closed this run'}</span></h2>
      ${pcCap(G) ? pcHtml() : '<div class="closed"><b>No PC</b><span>This run’s rule: just the six you carry.</span></div>'}
      ${bagHtml()}
    </section>

    <section class="panel">
      <h2><span class="tg">Daycare</span> <span class="sub">${TUNING.costBuy}₽ · ${TUNING.expModel === 'trainer'
        ? 'arrives at your level' : 'three copies to evolve'}</span></h2>
      ${closed ? closedNote('The Daycare') : dcList}
      <div class="shopbar">${rollBtn('rolldc', closed)}</div>
    </section>

    <section class="panel">
      <h2><span class="tg">PokéMart</span> <span class="sub">tier ${maxTier}</span></h2>
      ${closed ? closedNote('The PokéMart') : `<div class="martlist">
        ${restock}
        <div class="mhead">Always in stock — next battle only</div>
        ${counter}
      </div>`}
      <div class="shopbar">${rollBtn('rollmart', closed)}</div>
    </section>
  </div>
  ${dockHtml(closed)}
  </div></div>`;
}

/* ===================================================================
   BATTLE SCREEN
   =================================================================== */
function renderBattle(){
  const st = battle.steps[battle.i] || { p:[], e:[], fx:[], lines:[] };

  const done = battle.i >= battle.steps.length - 1;
  const r = battle.result;
  // a gym you have just beaten is a badge you already own, whatever G says
  const winningBadge = done && r === 'win' && battle.kind === 'gym';
  const shownBadges = G.badges + (winningBadge ? 1 : 0);
  const gn = battle.gauntlet;     // captured when the fight started
  const bossTag = battle.boss ? `<div class="bosstag ${battle.kind}">${bossArt(battle.boss, 'tag')}
      ${battle.kind === 'gym' ? `${esc(battle.boss.title)} · ${esc(battle.boss.badge)} Badge`
        : battle.kind === 'rival' ? `<span class="ambush ${battle.i < 1 ? 'pop' : ''}">!</span> Your rival · ambush ${battle.opp.meeting + 1} of ${TUNING.rival.windows.length}`
        : battle.kind === 'red' ? `${battle.boss.place} · one chance`
        : `${battle.kind === 'elite' ? 'Elite Four' : 'Champion'}${
          gn ? ` · fight ${gn.at + 1} of ${gn.members.length}` : ''}`}</div>` : '';
  // what winning or losing a gauntlet fight means, said on the result screen
  const next = gn && gn.members[gn.at + 1];
  const gnote = !done || !gn ? ''
    : r === 'win' && next ? `<p class="gnote">Next: <b>${esc(next.name)}</b>. The shops stay closed and nobody heals.</p>`
    : r === 'lose' ? `<p class="gnote">Back to <b>${esc(gn.members[0].name)}</b>. Everyone is healed, and the shops reopen.</p>`
    : '';
  const won = r === 'win';
  const rvl = battle.kind === 'rival' ? rivalLines(G, battle.opp.meeting) : null;
  const pz = battle.prize;
  const rivalNote = !done || !rvl ? ''
    : won ? `<div class="award rivalwin">${bossArt(battle.boss, 'hero')}
        <div><b>You beat your rival!</b>
          <span>“${esc(rvl.lost)}”</span>
          <span class="prize">+${pz.credits}₽ next turn${pz.item ? ` · ${itemGlyph(pz.item, HELD_ITEMS[pz.item].icon)} ${esc(HELD_ITEMS[pz.item].name)}${
            battle.bagFull ? ` (Bag full — he pays its worth, +${heldResale(pz.item)}₽)` : ' in your Bag'}` : ''}</span></div></div>`
    : `<div class="award rivallose">${bossArt(battle.boss, 'hero')}
        <div><b>Your rival won.</b><span>“${esc(rvl.won)}”</span>
          <span class="dim">It costs a life like any trainer battle. He'll be back.</span></div></div>`;
  /* 5.2.1: the leader hands the badge over on the field now, so no box for it — Continue goes straight to the reward */
  const award = false ? `<div class="award">
      ${bossArt(battle.boss, 'hero')}<i class="bdg ${badgeCls(G, G.badges % 8)} on fresh big"></i>
      <div><b>${esc(battle.boss.badge)} Badge</b>
        <span>${esc(battle.boss.name)} of the ${esc(battle.boss.title)} hands it over.</span>
        <span class="dim">${shownBadges} of ${TUNING.badgesToWin}${
          shownBadges === TUNING.badgesToWin ? ' — the Elite Four are next.' : ''}</span>
        <span class="dim">Continue to choose your badge reward.</span></div>
    </div>` : '';
  /* v36: the result is a ribbon across the arena's sky, so the field stays in
     view underneath it — the winners get a little victory hop. It only slides
     in the first time; a re-render (a toast, a tap) just shows it. */
  const fresh = done && !battle.ribbonShown;
  if(done) battle.ribbonShown = true;
  const ribbon = done ? `<div class="big ribbon ${won ? 'win' : r === 'lose' ? 'lose' : 'draw'} ${fresh ? 'anim' : ''} ${battle.ribbonGone ? 'gone' : ''}"><span>
      ${won ? (battle.kind === 'gym' ? `${esc(battle.boss.badge)} Badge!`
              : battle.kind === 'champion' ? 'Champion!'
              : battle.kind === 'red' ? `${esc(battle.boss.name)} beaten!`
              : battle.kind === 'elite' ? `${esc(battle.boss.name)} falls`
              : battle.kind === 'rival' ? 'Rival beaten!' : 'Victory!')
        : r === 'lose' ? (battle.boss && battle.kind !== 'rival' && battle.kind !== 'red' ? 'Blacked out' : 'Defeat') : 'Draw'}</span></div>` : '';
  const redNote = !done ? '' : battle.kind === 'red'
    ? (won ? `<div class="award redwin">${bossArt(battle.boss, 'hero')}${secretBadge(battle.boss.id, 'big')}
        <div><b>${esc(battle.boss.name)}\u2019s Badge</b><span>${G.secrets && (G.secIdx || 0) < G.secrets.length - 1 ? `${esc(SECRETS[G.secrets[(G.secIdx || 0) + 1]].name)} is next, at ${esc(SECRETS[G.secrets[(G.secIdx || 0) + 1]].place)}. You are healed and the shops are open for one turn.` : battle.boss.id === 'oak' ? 'The professor is proud of you.' : 'You beat the strongest trainer there is.'}</span></div></div>`
      : `<div class="award redlose">${bossArt(battle.boss, 'hero')}
        <div><b>${esc(battle.boss.name)} ${battle.boss.id === 'oak' ? 'smiles and shakes his head.' : 'didn\u2019t flinch.'}</b><span class="dim">Nothing is lost. Your run ends as the Champion clear it already was.</span></div></div>`)
    : battle.kind === 'champion' && won && G.redOpen
    ? `<p class="gnote">A challenger is waiting at <b>${esc(secretBoss().place)}</b>. You are healed and the shops are open for one turn.</p>` : '';
  const notes = done ? `${award}${rivalNote}${gnote}${redNote}` : '';

  return `
  <div class="topbar gb">
    <div class="tcol">${livesHtml()}${badgeCase(shownBadges, winningBadge ? G.badges : undefined)}</div>
    <div class="tcol tright"><div class="stat turn"><span class="lbl">Turn</span>${G.turn}</div>${streakChip()}</div>
    <div class="stat vs"><span class="lbl">VS</span>${esc(battle.oppName)}</div>
  </div>

  <div class="panel arena">
    ${bossTag}${notes ? `<div class="arenanotes">${notes}</div>` : ''}
    <div class="stagewrap"><div id="stageslot"></div>${ribbon}</div>
  </div>

  <div id="bqueue">${battleQueueHtml(st)}</div>
  <div class="blogbox"><div id="blog">${battleLogHtml()}</div></div>
  ${done ? recapHtml() : ''}

  <div class="shopbar">
    ${done
      ? `<button class="btn primary" data-act="afterbattle">${battle.duel ? 'Back to the set' : battle.exhibition ? 'Back to the Mart' : winningBadge ? 'Choose your reward ▶' : 'Continue ▶'}</button>`
      : `<div class="speed" role="group" aria-label="Playback speed">
           ${SPEEDS.map(v => `<button class="sp ${v === speed ? 'on' : ''}" data-act="speed" data-i="${v}"
             aria-pressed="${v === speed}">${v}×</button>`).join('')}
         </div>
         <span class="steps">${battle.i + 1}/${battle.steps.length}</span>
         <button class="btn pausebtn ${battle.paused ? 'on' : ''}" data-act="pause" aria-pressed="${!!battle.paused}" aria-label="${battle.paused ? 'Resume' : 'Pause'}">${battle.paused ? '▶' : '⏸'}</button>
         ${battle.paused ? '<button class="btn stepbtn" data-act="step" aria-label="Next step">Step ⏭</button>' : ''}
         <button class="btn" data-act="skip">Skip ⏩</button>`}
  </div>`;
}

/* The action meter is only fair if you can see it. Speed decides how often a
   pokémon acts, which is invisible in a log — so the queue is drawn: who
   moves next, and next after that, tinted by side. Three of their sprites in
   a row means three of their attacks land before you swing. */
function battleQueueHtml(st){
  /* v43: the row never disappears. A step with no order of its own (the
     intro, a status tick, the result) shows the nearest one — the next order
     before the first move, the last one after — trimmed to who is still up. */
  const S = battle ? battle.steps : [], i = battle ? battle.i : 0, done = i >= S.length - 1;
  let up = st.up;
  if(!up || !up.length){
    for(let k = i; k >= 0 && !(up && up.length); k--) up = S[k].up;
    for(let k = i + 1; k < S.length && !(up && up.length); k++) up = S[k].up;
  }
  const ghost = '<div class="queue"><span class="qlbl">Next</span><span class="qmon ghost"></span></div>';
  if(done){   // the result: who is still standing, once each
    const alive = [...(st.p || []).map(u => [u, 'p']), ...(st.e || []).map(u => [u, 'e'])].filter(([u]) => u.hp > 0);
    const cells = alive.map(([u, side]) => `<span class="qmon ${side}" title="${esc(u.nm)}">${SPRITES[u.id]
      ? `<img src="${SPRITES[u.id]}" alt="${esc(u.nm)}">` : esc(u.nm.slice(0,2))}</span>`).join('');
    return cells ? `<div class="queue over"><span class="qlbl">Standing</span>${cells}</div>` : ghost;
  }
  if(!up || !up.length) return ghost;
  const byUid = {};
  for(const u of st.p) byUid['p' + u.uid] = { u, side:'p' };
  for(const u of st.e) byUid['e' + u.uid] = { u, side:'e' };
  const cells = up.map((uid, n) => {
    const ent = byUid['p' + uid] || byUid['e' + uid];
    if(!ent || ent.u.hp <= 0) return '';
    const { u, side } = ent;
    return `<span class="qmon ${side} ${n === 0 ? 'now' : ''}" title="${esc(u.nm)}">
      ${SPRITES[u.id] ? `<img src="${SPRITES[u.id]}" alt="${esc(u.nm)}">`
                      : esc(u.nm.slice(0,2))}</span>`;
  }).filter(Boolean).join('');
  return cells ? `<div class="queue"><span class="qlbl">Next</span>${cells}</div>` : ghost;
}
function battleLogHtml(){
  return battle.steps.slice(0, battle.i + 1)
    .flatMap(s => s.lines || []).slice(-40)
    .map(t => `<div class="${/super effective/.test(t) ? 'eff' : /not very effective/.test(t) ? 'ineff'
      : /fainted/.test(t) ? 'ko' : /evolving/.test(t) ? 'evo'
      : ''}">${esc(t)}</div>`).join('');
}

/* ===================================================================
   v36 · THE ARENA
   The fight is drawn as a field instead of two grids of cards: every pokémon
   stands where its slot puts it — yours on the left facing right, theirs on
   the right — with a small HP bar over its head. The field is built ONCE per
   battle and kept between renders (renderBattle leaves an empty #stageslot
   and the field is moved into it), so an attack can travel across it rather
   than the whole screen being redrawn every step.

   Each step is read as a diff against the one before: who acted, whose HP
   moved and by how much, who picked up a status or a barrier, who fainted.
   That is all the engine already records, so the animation can never show
   something the fight didn't do.
   =================================================================== */
const motionOff = () => PREF.get('motion', 'device') === 'reduced'
  || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function applyMotion(){ document.body.classList.toggle('calm', motionOff()); }
/* Light (the default), Dark, or System — System follows the phone or computer
   and changes with it. The head of the page applies it before first paint. */
const themeDark = () => { const t = PREF.get('theme', 'light');
  return t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches); };
function applyTheme(){ document.documentElement.classList.toggle('dark', themeDark()); document.documentElement.classList.add('bc'); }
try{ window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme); }catch(e){}
const ARENA_X = { p:[38, 24, 10], e:[62, 76, 90] };   // by rank: front, middle, back (% across)
const ARENA_Y = [60, 87];                              // the two files, where the feet are (% down)
// how each card type's attacks look in flight
/* 5.9.0: every type has its own move effect (before, several types borrowed the nearest one) */
const FX_OF = { Fire:'fire', Water:'water', Electric:'elec', Grass:'grass', Psychic:'psy', Fighting:'fight', Normal:'slash',
  Ice:'ice', Poison:'sludge', Ghost:'shadow', Dragon:'dragon', Bug:'pin', Rock:'rock', Ground:'quake', Flying:'gust', Steel:'steel', Dark:'dark' };
// a gym's floor takes the colour of its speciality (Gen 1 type names)
const GEN1_COL = { Rock:'#b8a038', Ground:'#d8b460', Water:'#5a8ff0', Electric:'#f0c830', Grass:'#62b85a',
  Poison:'#a45ab8', Psychic:'#f06090', Fire:'#f07830', Ice:'#88d0e0', Fighting:'#c04830', Ghost:'#6a5a9a', Dragon:'#7050e8' };
const ST_WORD = { brn:'Burned!', psn:'Poisoned!', par:'Paralysed!', slp:'Asleep!', cnf:'Confused!', fln:'Flinched!' };

const backdropOf = b => b.kind === 'gym' ? 'gym' : (b.kind === 'elite' || b.kind === 'champion') ? 'league'
  : b.kind === 'rival' ? 'dusk' : b.kind === 'red' && b.boss && b.boss.id !== 'oak' ? 'summit' : 'route';
/* 4.14.0: the stadium floor follows the battle — a leader or Elite Four member fights on their type's floor */
const FLOOR_TYPES = ['Rock','Water','Electric','Grass','Bug','Psychic','Fire','Ground','Ice','Fighting','Ghost','Dragon','Flying','Normal','Steel','Poison','Dark'];
const floorOf = b => { const t = b.boss && b.boss.theme && b.boss.theme[0];
  if((b.kind || 'trainer') === 'trainer' && !b.boss) return 'fl-' + homeFloor();   // 5.5.0: ordinary trainer bouts play on your home field
  return (b.kind === 'gym' || b.kind === 'elite') && FLOOR_TYPES.includes(t) ? 'fl-' + t : 'fl-' + backdropOf(b); };
/* 5.5.0 · HOME FIELDS: beat a leader (or the rival, the Champion, Red) and their floor is yours to pick
   on the Trainer Card. Your ordinary trainer battles, and the shop before them, are played on it. */
const SPECIAL_FLOORS = ['route', 'dusk', 'league', 'summit'];
const ALL_FLOORS = [...SPECIAL_FLOORS, ...FLOOR_TYPES];
const floorName = f => ({ route:'The pitch', dusk:'Rival’s dusk', league:'League hall', summit:'Mt. Silver' })[f] || f + ' floor';
const floorHow = f => ({ route:'Yours from the start.', dusk:'Beat your rival.', league:'Beat the Champion.', summit:'Beat Red.' })[f]
  || `Beat a ${f}-type gym leader or Elite Four member.`;
/** The floor this win would unlock (null if it's not a boss floor). */
function floorWon(b){
  if(!b || b.exhibition) return null;
  const t = b.boss && b.boss.theme && b.boss.theme[0];
  if((b.kind === 'gym' || b.kind === 'elite') && FLOOR_TYPES.includes(t)) return t;
  if(b.kind === 'rival') return 'dusk';
  if(b.kind === 'champion') return 'league';
  if(b.kind === 'red' && b.boss && b.boss.id !== 'oak') return 'summit';
  return null;
}
function homeFloor(){ const f = PREF.get('homefloor', 'route'); return f !== 'route' && career().floors.includes(f) ? f : 'route'; }
/* 5.5.0 · the stands: eight floodlights, one more lit for every badge you hold, and a crowd that fills up as you go.
   The Elite Four, the Champion and the secret bosses play to a full house with every light on. */
const LAMP_ORDER = [0, 7, 1, 6, 2, 5, 3, 4];   // k-th badge lights lamp LAMP_ORDER[k]: from the outside in
function standsOf(b){
  const big = b.kind === 'elite' || b.kind === 'champion' || b.kind === 'red';
  const have = G ? Math.min(8, G.badges || 0) : 0;
  return { lit: big ? 8 : have, crowd: big ? 4 : 1 + Math.floor(have / 3), full: big };
}

function fighterHtml(u){
  const art = SPRITES[u.id] ? `<img src="${SPRITES[u.id]}" alt="${esc(u.nm)}" draggable="false">`
    : `<span class="fletters" style="--tcol:${typeColor(u.id)}">${esc(u.nm.slice(0, 2))}</span>`;
  /* 4.16.0: the nameplate floats over the head (inside .fbody, so it faces you on the tilted table);
     the bar has a white trail (b) and a striped barrier end (em); .stfx holds the status particles */
  return `<div class="fmove">
      <div class="fbody"><div class="fart">${art}<div class="stfx"><i></i><i></i><i></i></div></div><div class="fbarrier"></div>
        <div class="fhead"><div class="frow"><span class="fname">${esc(u.nm)}${u.lvl > 1 ? ` <i>L${u.lvl}</i>` : ''}</span><div class="fchips"></div></div>
          <div class="fhp"><b></b><i></i><em></em></div></div></div>
    </div><div class="fshadow"></div>`;
}

const lookPref = () => ['stadium', 'mini', 'paper'].includes(PREF.get('look', 'stadium')) ? PREF.get('look', 'stadium') : 'stadium';
/** 5.0.0: the empty stadium for a bout (b needs kind and boss) — the battle fills it, the shop shows it as it is. */
function stageShell(b){
  const el = document.createElement('div');
  el.className = `bstage board stadium bg-${backdropOf(b)} ${floorOf(b)} look-${lookPref()}`;   // 4.15.0: Options → Battle look   // 4.13.0 board; 4.14.0 a tilted stadium table
  const theme = b.boss && b.boss.theme && b.boss.theme[0];
  if(theme && GEN1_COL[theme]) el.style.setProperty('--gymc', GEN1_COL[theme]);
  const SD = standsOf(b);
  const lamps = Array.from({ length: 8 }, (_, k) => { const o = LAMP_ORDER.indexOf(k); return `<b class="lamp${o < SD.lit ? ' on' : ''}" data-o="${o}"></b>`; }).join('');
  el.innerHTML = `<div class="ground crowd${SD.crowd}${SD.full ? ' full' : ''}" style="--lit:${SD.lit}"><i class="stands"><i class="crowd c1"></i><i class="crowd c2"></i><i class="crowd c3"></i><i class="crowd c4"></i></i><i class="lamps">${lamps}</i><i class="lights"></i><i class="bulbs"></i></div>
    <div class="tview"><div class="table"><div class="pitch"></div><div class="midline"></div>
    ${['p', 'e'].map(s => Array.from({ length: TUNING.maxTeam }, (_, pos) =>
      `<div class="slotmark ${s} r${Math.min(2, Math.floor(pos / RANK_W))} f${pos % RANK_W}"></div>`).join('')).join('')}
    </div></div><div class="fxl"></div>`;
  return el;
}
function buildStage(){
  const b = battle, st0 = b.steps[0] || { p:[], e:[] };
  const el = stageShell(b);
  const S = { el, table: el.querySelector('.table'), fx: el.querySelector('.fxl'), f: new Map(), at: 0, gen: 0 };
  for(const side of ['p', 'e']) (st0[side] || []).forEach((u, i) => addFighter(S, u, side, i));
  markActing(S, st0);
  return S;
}
function addFighter(S, u, side, i){
  const pos = Number.isInteger(u.pos) ? u.pos : i;
  const rank = Math.min(2, Math.floor(pos / RANK_W)), file = pos % RANK_W;
  const d = document.createElement('div');
  d.className = `ftr ${side} r${rank} f${file}`;   // 4.13.0: the board places it by rank and file (CSS)
  d.innerHTML = fighterHtml(u);
  (S.table || S.el).appendChild(d);   // 4.14.0: fighters stand on the table
  const F = { el: d, side, uid: u.uid, nm: u.nm, id: u.id, hp: u.hp, maxHp: u.maxHp,
              st: null, shield: 0, atk: u.atk, spd: u.spd, down: false };
  S.f.set(side + ':' + u.uid, F);
  d.addEventListener('click', ev => { ev.stopPropagation(); openFighterCard(F); });   // 3.7.0
  paintFighter(F, u, false);
  return F;
}
/** Bring a fighter's bar, chips, barrier and sprite up to a snapshot. */
function paintFighter(F, u, pop){
  const frac = Math.max(0, Math.min(1, u.hp / Math.max(1, u.maxHp)));
  const bar = F.el.querySelector('.fhp i');
  bar.style.width = (frac * 100).toFixed(1) + '%';
  bar.className = frac > 0.5 ? '' : frac > 0.22 ? 'mid' : 'low';
  const trail = F.el.querySelector('.fhp b'), shEnd = F.el.querySelector('.fhp em');   // 4.16.0
  if(trail) trail.style.width = (frac * 100).toFixed(1) + '%';
  if(shEnd) shEnd.style.width = Math.min(60, (u.shield || 0) / Math.max(1, u.maxHp) * 100).toFixed(1) + '%';
  for(const c of [...F.el.classList]) if(c.startsWith('st-') && c !== 'st-' + u.st) F.el.classList.remove(c);
  if(u.st) F.el.classList.add('st-' + u.st);
  if(u.id !== F.id){
    F.id = u.id;
    const img = F.el.querySelector('.fart img');
    if(img && SPRITES[u.id]) img.src = SPRITES[u.id];
  }
  if(u.st !== F.st || (u.shield || 0) !== F.shield){
    const S0 = u.st && TUNING.status[u.st];
    F.el.querySelector('.fchips').innerHTML =
      (S0 ? `<span class="fchip st-${u.st} ${pop && u.st !== F.st ? 'new' : ''}" title="${esc(S0.name)}">${S0.icon}<b>${S0.short}</b></span>` : '')
      + (u.shield > 0 ? `<span class="fchip sh ${pop && !F.shield ? 'new' : ''}" title="Barrier: soaks the next ${u.shield} damage">🛡️${u.shield}</span>` : '');
  }
  F.el.querySelector('.fbarrier').classList.toggle('on', u.shield > 0);
  Object.assign(F, { hp: u.hp, maxHp: u.maxHp, st: u.st, shield: u.shield || 0, atk: u.atk, spd: u.spd });
}
const snapMap = st => { const m = new Map();
  for(const s of ['p', 'e']) for(const u of (st && st[s]) || []) m.set(s + ':' + u.uid, u);
  return m; };
function actorKey(st){
  if(st.actor == null) return null;
  const a = (st.fx || []).find(x => x.kind === 'act' && x.uid === st.actor);
  if(a && a.side) return a.side + ':' + st.actor;
  for(const s of ['p', 'e']) if((st[s] || []).some(u => u.uid === st.actor)) return s + ':' + st.actor;
  return null;
}
function markActing(S, st){
  const k = actorKey(st);
  for(const [key, F] of S.f) F.el.classList.toggle('acting', key === k && !F.down);
}

/** Jump straight to step i — after a skip, or when a render lands mid-fight. */
function syncStage(S, i){
  const st = battle.steps[i];
  if(!st) return;
  S.gen++;                                   // anything still scheduled belongs to a stale step
  S.el.getAnimations({ subtree: true }).forEach(a => a.cancel());
  S.fx.innerHTML = '';
  S.el.querySelectorAll('.introban').forEach(e => e.remove());
  const live = snapMap(st);
  for(const [k, F] of S.f){
    F.el.classList.remove('incoming');
    const u = live.get(k);
    if(u){ F.down = false; F.el.classList.remove('down'); paintFighter(F, u, false); }
    else { F.down = true; F.el.classList.add('down');   // 4.17.1: an empty bar after a skip, not the HP it last showed
      const bar = F.el.querySelector('.fhp i'), tr = F.el.querySelector('.fhp b'), sh = F.el.querySelector('.fhp em');
      if(bar){ bar.style.width = '0%'; bar.className = 'low'; } if(tr) tr.style.width = '0%'; if(sh) sh.style.width = '0%'; F.el.querySelector('.fbarrier').classList.remove('on'); }
  }
  markActing(S, st);
  S.at = i;
}

/* Put the kept field into the page the render just drew, and bring it up to
   date: animated if it is exactly one step behind, snapped otherwise. */
/* 4.13.0: a narrow field (phones) stacks the two teams top and bottom; a wide one sets them side by side */
const BOARD_VERT_BELOW = 620;
function fitBoard(S){ const w = S.el.parentNode ? S.el.parentNode.clientWidth : 0;
  const sideways = matchMedia('(orientation:landscape) and (max-height:520px) and (min-width:640px)').matches;   // 5.0.0: a phone on its side keeps the wide field
  if(w) S.el.classList.toggle('vert', w < BOARD_VERT_BELOW && !sideways); }
const isVert = el => !!(el && el.closest && el.closest('.bstage.vert'));
window.addEventListener('resize', () => { if(battle && battle.stage) fitBoard(battle.stage); });
function mountStage(){
  if(!battle || !document.getElementById('stageslot')) return;
  if(!battle.stage) battle.stage = buildStage();
  const S = battle.stage;
  layoutWorld();                             // 5.0.0: the field lives in the world behind the page, not in the page
  fitBoard(S);
  if(S.at === battle.i - 1) animateStep(S, battle.i);
  else if(S.at !== battle.i) syncStage(S, battle.i);
  if(battle.i >= battle.steps.length - 1 && !battle.outroPlayed){
    battle.outroPlayed = true;
    const r = battle.result;   // v47: a jingle for the result — a fanfare for a badge
    SFX.play(r === 'win' ? (battle.kind === 'gym' ? 'badge' : 'win') : r === 'lose' ? 'lose' : 'tap');
    setTimeout(() => stageOutro(S), motionOff() ? 0 : 450);
  }
}

/* ---------------- the little effects ---------------- */
/* ---- 5.3.2 · WHERE THINGS ARE ON THE TILTED TABLE -------------------------
   iPhones (Safari) report the boxes of things on the 3D-tilted table in the
   wrong place, which put the party's spots and the walking bosses off on
   phones. So the game works the boxes out itself from the table's geometry
   (its tilt, the perspective, the element's spot on the flat table): the
   same answer a correct browser gives, on every browser. */
function planeBox(el){   // in the stage's own px
  const table = el && el.offsetParent; if(!table || !table.classList.contains('table')) return null;
  const tview = table.parentElement, cs = getComputedStyle(table), vs = getComputedStyle(tview);
  let cos = 1, sin = 0;
  try{ if(cs.transform && cs.transform !== 'none'){ const m = new DOMMatrix(cs.transform); cos = m.m22; sin = m.m23; } }catch(e){}
  const d = parseFloat(vs.perspective) || 0, po = String(vs.perspectiveOrigin).split(' ').map(parseFloat);
  const Lt = tview.offsetLeft + table.offsetLeft, Tt = tview.offsetTop + table.offsetTop, Ht = table.offsetHeight;
  const ox = tview.offsetLeft + (po[0] || 0), oy = tview.offsetTop + (po[1] || 0);
  const P = (u, v) => { const dy = v - Ht, X = Lt + u, Y = Tt + Ht + dy * cos, Z = dy * sin, k = d ? d / (d - Z) : 1; return [ox + (X - ox) * k, oy + (Y - oy) * k]; };
  const u = el.offsetLeft, v = el.offsetTop, w = el.offsetWidth, h = el.offsetHeight;
  const pts = [P(u, v), P(u + w, v), P(u, v + h), P(u + w, v + h)], xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
  const l = Math.min(...xs), r = Math.max(...xs), t = Math.min(...ys), b = Math.max(...ys);
  return { left: l, top: t, right: r, bottom: b, width: r - l, height: b - t };
}
function planeRect(el){  // in viewport px, like getBoundingClientRect
  const bx = planeBox(el); if(!bx) return el.getBoundingClientRect();
  const stage = el.closest('.bstage'), E = stage.getBoundingClientRect(), sc = E.width / (stage.offsetWidth || E.width);
  const left = E.left + bx.left * sc, top = E.top + bx.top * sc, width = bx.width * sc, height = bx.height * sc;
  return { left, top, width, height, right: left + width, bottom: top + height };
}
/* 5.3.4: on iPhones (and any WebKit browser) the shop's field lies flat: Safari draws the tilted 3D table somewhere other
   than where it reports it, so the party's spots never lined up. Flat, it is plain 2D and exact. The battle still tilts,
   and the tilt comes in as the camera pulls back. PKB_FLAT forces it on for testing. */
const flatShop = () => IS_WEBKIT || !!window.PKB_FLAT;
const IS_WEBKIT = /iPhone|iPad|iPod/.test(navigator.userAgent) || (/AppleWebKit/.test(navigator.userAgent) && !/Chrome|Chromium|Edg|Android/.test(navigator.userAgent));
function artCentre(S, F){
  if(IS_WEBKIT && S.table){   // 5.3.2: from the tile's worked-out box (see planeBox)
    const t = planeBox(F.el); if(t){ const v = S.el.classList.contains('vert'), ah = t.height * (v ? .66 : .48);
      return { x: t.left + t.width / 2, y: t.bottom - t.height * (v ? .22 : .135) - ah / 2, w: ah }; } }
  const a = F.el.querySelector('.fart').getBoundingClientRect(), r = S.el.getBoundingClientRect();
  return { x: a.left - r.left + a.width / 2, y: a.top - r.top + a.height / 2, w: a.width };
}
function fxEl(S, cls, x, y, html){
  const e = document.createElement('div');
  e.className = 'fx ' + cls;
  e.style.left = x + 'px'; e.style.top = y + 'px';
  if(html) e.innerHTML = html;
  S.fx.appendChild(e);
  return e;
}
const anim = (el, frames, opts) => {
  const a = el.animate(frames, opts);
  if(opts && opts.remove) a.finished.then(() => el.remove(), () => el.remove());
  return a;
};
/** A number or word that rises off a pokémon and fades. */
/* 4.13.0: where a tile's sprite sits at rest (offsets ignore the lunge and intro transforms), so stacked numbers line up */
function restCentre(F){
  /* 4.14.0: the tile itself never moves (lunges move what's on it), and its box on screen already includes the table's tilt */
  const S = battle && battle.stage; if(!S) return null;
  const v = S.el.classList.contains('vert');
  if(IS_WEBKIT && S.table){ const t = planeBox(F.el); if(t) return { x: t.left + t.width / 2, y: t.top + t.height * (v ? 0.15 : 0.45), w: t.height * (v ? .66 : .48) }; }   // 5.3.2
  const t = F.el.getBoundingClientRect(), r = S.el.getBoundingClientRect(), art = F.el.querySelector('.fart');
  const w = art ? art.getBoundingClientRect().width : t.height;
  return { x: t.left - r.left + t.width / 2, y: t.top - r.top + t.height * (v ? 0.15 : 0.45), w };   // 4.16.0: it stands centred in its spot
}
function floatText(S, F, text, cls, lift){
  const c = (S.el.classList.contains('board') && restCentre(F)) || artCentre(S, F);
  /* v42 iron-out: two hits close together used to print the second number on
     top of the first (a faint "-8" behind "-31"). Each pokémon keeps the
     heights its recent numbers are still rising from; a new one takes the next
     free height up. */
  const now = performance.now(), hold = 620 / Math.max(1, speed);
  F.floats = (F.floats || []).filter(f => f.until > now);
  let y = lift || 0;
  while(y < 100 && F.floats.some(f => Math.abs(f.y - y) < 18)) y += 20;
  F.floats.push({ y, until: now + hold });
  const W = S.el.clientWidth, pad = /note/.test(cls || '') ? Math.min(64, W / 6) : 18;   // 4.13.0: keep words inside the board's edges
  const top0 = c.y - c.w * 0.35 - y;   // 4.17.1: near the top edge, further notes stack downward instead of piling up
  const e = fxEl(S, 'num ' + (cls || ''), Math.max(pad, Math.min(W - pad, c.x)), top0 < 14 ? 14 + y : top0, esc(text));
  const still = motionOff();
  anim(e, still ? [{ opacity: 0 }, { opacity: 1, offset: .15 }, { opacity: 1, offset: .75 }, { opacity: 0 }]
    : [{ opacity: 0, transform: 'translate(-50%,-30%) scale(.6)' },
       { opacity: 1, transform: 'translate(-50%,-85%) scale(1.15)', offset: .18 },
       { opacity: 1, transform: 'translate(-50%,-125%) scale(1)', offset: .7 },
       { opacity: 0, transform: 'translate(-50%,-175%) scale(1)' }],
    { duration: still ? 900 : 1050, easing: 'ease-out', remove: true });
}
/** 5.9.0: a status shown as its own particles instead of an emoji: flames rise off a burn, bubbles off poison, sparks
    crackle round paralysis, pink stars circle confusion, white stars for a flinch. Sleep keeps its drifting Zs. */
const ST_PT = { brn: { sh:'ember', c:['#fff3a0','#ff9a2a','#e0401a'], rise:1 }, psn: { sh:'bubble', c:['#e0a8ff','#b05ad0'], rise:1 },
  par: { sh:'spark', c:['#fff6a0','#ffe14a'], jitter:1 }, cnf: { sh:'glint', c:['#ffd0f0','#ff8ac8'], circle:1 }, fln: { sh:'star', c:['#ffffff','#fff2b0'], jitter:1 } };
function statusPuff(S, F, st, n){
  if(motionOff() || fxLevel() === 'off') return;
  if(fxLevel() === 'light') n = 1;
  const d = ST_PT[st]; if(!d){ puff(S, F, st === 'slp' ? 'z' : ((TUNING.status[st] || {}).icon || '•'), n); return; }
  const c = artCentre(S, F), cnt = (n || 3) + (fxLevel() === 'light' ? 1 : 3);
  for(let k = 0; k < cnt; k++){
    const e = fxEl(S, 'pt ' + d.sh, c.x + (Math.random() - .5) * c.w * .7, c.y + (Math.random() - .2) * c.w * .4); e.style.setProperty('--c', d.c[k % d.c.length]);
    const fr = d.circle ? [0, .25, .5, .75, 1].map(t => ({ transform: `translate(calc(-50% + ${Math.cos(t * 6.28 + k) * c.w * .45}px), calc(-50% - ${c.w * .45 + Math.sin(t * 6.28 + k) * c.w * .12}px)) scale(${t === 0 || t === 1 ? .4 : 1})`, opacity: t === 0 || t === 1 ? 0 : 1 }))
      : d.jitter ? [{ transform: 'translate(-50%,-50%) scale(.4)', opacity: 0 }, { transform: `translate(calc(-50% + ${(Math.random() - .5) * 12}px), calc(-50% + ${(Math.random() - .5) * 12}px)) scale(1.1) rotate(${Math.random() * 90}deg)`, opacity: 1, offset: .3 }, { transform: `translate(calc(-50% + ${(Math.random() - .5) * 18}px), calc(-50% + ${(Math.random() - .5) * 18}px)) scale(.5)`, opacity: 0 }]
      : [{ transform: 'translate(-50%,-50%) scale(.5)', opacity: 0 }, { opacity: 1, offset: .25 }, { transform: `translate(calc(-50% + ${(Math.random() - .5) * 10}px), calc(-50% - ${c.w * (.5 + Math.random() * .4)}px)) scale(.6)`, opacity: 0 }];
    anim(e, fr, { duration: (d.circle ? 1100 : 760) + Math.random() * 200, delay: k * 70, easing: 'ease-out', fill: 'backwards', remove: true });
  }
}
/** A few of a status icon drifting up — flames, bubbles, Zs. */
function puff(S, F, glyph, n){
  if(motionOff()) return;
  const c = artCentre(S, F);
  for(let k = 0; k < (n || 3); k++){
    const e = fxEl(S, 'puff', c.x + (k - 1) * c.w * 0.28, c.y, esc(glyph));
    anim(e, [{ opacity: 0, transform: 'translate(-50%,-50%) scale(.5)' },
             { opacity: 1, offset: .3 },
             { opacity: 0, transform: `translate(calc(-50% + ${(k - 1) * 6}px), calc(-50% - ${26 + k * 8}px)) scale(1.2)` }],
      { duration: 760, delay: k * 110, easing: 'ease-out', fill: 'backwards', remove: true });
  }
}
function flash(F, big, colour){
  if(motionOff()) return;
  const art = F.el.querySelector('.fart');
  anim(art, [{ filter: 'none' }, { filter: `brightness(2.6) ${colour ? `drop-shadow(0 0 6px ${colour})` : ''}` },
             { filter: 'none' }, { filter: 'brightness(2.2)' }, { filter: 'none' }], { duration: 340 });
  const dx = (F.side === 'p' ? -1 : 1) * (big ? 7 : 4);
  anim(art, [{ transform: 'translateX(0)' }, { transform: `translateX(${dx}px)` },
             { transform: `translateX(${-dx / 2}px)` }, { transform: 'translateX(0)' }], { duration: 280, composite: 'add' });
}
function glow(F, colour){
  if(motionOff()) return;
  anim(F.el.querySelector('.fart'), [{ filter: 'none' }, { filter: `drop-shadow(0 0 8px ${colour}) brightness(1.3)` }, { filter: 'none' }],
    { duration: 520 });
}
function lunge(F, towardsFoe, dur){
  if(motionOff()) return;
  const dir = F.side === 'p' ? 1 : -1, v = isVert(F.el);
  const mv = F.el.querySelector('.fmove');
  const to = v ? `translate(0,${-dir * 12}px)` : `translate(${dir * 14}px,0)`;   // 4.13.0: towards the other team, whichever way it sits
  anim(mv, towardsFoe
    ? [{ transform: 'translate(0,0)' }, { transform: to, offset: .45 }, { transform: 'translate(0,0)' }]
    : [{ transform: 'scale(1)' }, { transform: 'scale(1.06)', offset: .4 }, { transform: 'scale(1)' }],
    { duration: dur, easing: 'ease-out' });
}
/** 4.16.0: a barrier breaking shatters into pieces. */
function shatter(S, F){
  if(motionOff()) return;
  const c = artCentre(S, F);
  for(let k = 0; k < 10; k++){
    const d = fxEl(S, 'shard', c.x, c.y), a = k / 10 * Math.PI * 2, r = c.w * (0.45 + Math.random() * 0.4);
    anim(d, [{ transform: 'translate(-50%,-50%) scale(1) rotate(0deg)', opacity: 1 },
             { transform: `translate(calc(-50% + ${Math.cos(a) * r}px), calc(-50% + ${Math.sin(a) * r + c.w * 0.3}px)) scale(.4) rotate(${k * 70}deg)`, opacity: 0 }],
      { duration: 650, easing: 'ease-out', remove: true });
  }
}
/** 4.15.0: the crowd reacts to a big moment — the stands flash with camera bulbs, and they cheer (not too often). */
let lastCheer = 0;
function crowdReact(S, loud){
  const now = performance.now();
  if(loud && now - lastCheer > 1600){ lastCheer = now; setTimeout(() => SFX.play('cheer'), 90); }
  if(motionOff()) return;
  const st = S.el.querySelector('.stands'), bulbs = S.el.querySelector('.bulbs');
  if(st) anim(st, [{ filter: 'brightness(1)', transform: 'translateY(0)' }, { filter: 'brightness(1.7)', transform: 'translateY(-2px)', offset: .25 },
                   { filter: 'brightness(1.15)', transform: 'translateY(0)', offset: .6 }, { filter: 'brightness(1)', transform: 'translateY(0)' }], { duration: 700, easing: 'ease-out' });
  if(!bulbs || !st || getComputedStyle(st).display === 'none') return;
  const h = st.getBoundingClientRect().height;
  for(let k = 0; k < (loud ? 9 : 5); k++){
    const b = document.createElement('i'); b.className = 'bulb';
    b.style.left = (6 + Math.random() * 88) + '%'; b.style.top = (h * (0.15 + Math.random() * 0.7)) + 'px';
    bulbs.appendChild(b);
    anim(b, [{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'scale(1.2)', offset: .2 }, { opacity: 0, transform: 'scale(.8)' }],
      { duration: 380, delay: k * 70 + Math.random() * 90, fill: 'backwards', remove: true });
  }
}
/** 4.15.0: winning a big fight — the camera sweeps along your team, front to back, then settles; confetti falls. */
function victorySweep(S){
  if(motionOff() || !S.table) return;
  const view = S.el.querySelector('.tview'), vr = view.getBoundingClientRect();
  const mine = [...S.f.values()].filter(F => F.side === 'p' && !F.down)
    .sort((a, b) => [...a.el.classList].find(c => /^r\d/.test(c)).localeCompare([...b.el.classList].find(c => /^r\d/.test(c))));
  if(!mine.length) return;
  const at = F => { const t = F.el.getBoundingClientRect(); return `${((t.left + t.width / 2 - vr.left) / vr.width * 100).toFixed(1)}% ${((t.top + t.height / 2 - vr.top) / vr.height * 100).toFixed(1)}%`; };
  const frames = [{ transform: 'scale(1)', transformOrigin: at(mine[0]), offset: 0 }];
  mine.forEach((F, k) => frames.push({ transform: 'scale(1.22)', transformOrigin: at(F), offset: 0.1 + 0.75 * k / Math.max(1, mine.length - 1 || 1) }));
  frames.push({ transform: 'scale(1)', transformOrigin: at(mine[mine.length - 1]), offset: 1 });
  frames.forEach((f, k) => { if(k && f.offset <= frames[k - 1].offset) f.offset = Math.min(1, frames[k - 1].offset + 0.01); });
  /* 5.5.2: the camera no longer sweeps along the team (Sean: it moved around weirdly); the crowd and the confetti stay */
  crowdReact(S, true);
  const cols = ['#ffd23a', '#e0473f', '#3fa8e0', '#5ad17a', '#f06090', '#fff'];
  const W = S.el.clientWidth, H = S.el.clientHeight;
  for(let k = 0; k < 36; k++){
    const c = fxEl(S, 'confetti', Math.random() * W, -10); c.style.background = cols[k % cols.length];
    const dx = (Math.random() - 0.5) * 80, rot = (Math.random() - 0.5) * 720;
    anim(c, [{ transform: 'translate(0,0) rotate(0deg)', opacity: 1 }, { transform: `translate(${dx}px,${H * (0.7 + Math.random() * 0.4)}px) rotate(${rot}deg)`, opacity: 0.9, offset: .85 },
             { transform: `translate(${dx}px,${H + 20}px) rotate(${rot}deg)`, opacity: 0 }],
      { duration: 1800 + Math.random() * 1400, delay: Math.random() * 700, easing: 'cubic-bezier(.3,.6,.6,1)', fill: 'backwards', remove: true });
  }
}
/** 4.14.0: on a big hit the camera leans in towards whoever took it, then settles back. */
function camLean(S, F){
  if(motionOff() || !S.table) return;
  const view = S.el.querySelector('.tview').getBoundingClientRect(), t = F.el.getBoundingClientRect();
  const ox = ((t.left + t.width / 2 - view.left) / view.width * 100).toFixed(1), oy = ((t.top + t.height / 2 - view.top) / view.height * 100).toFixed(1);
  const o = `${ox}% ${oy}%`;
  anim(S.el.querySelector('.tview'), [{ transform: 'scale(1)', transformOrigin: o }, { transform: 'scale(1.1)', transformOrigin: o, offset: .3 }, { transform: 'scale(1)', transformOrigin: o }],
    { duration: 820, easing: 'ease-out' });
}
/** 4.17.0: a lobbed path — up and over, landing on the target. */
function arcFrames(dx, dy, jig){
  const lift = Math.max(26, Math.hypot(dx, dy) * 0.38) + Math.abs(jig || 0), fr = [];
  for(let k = 0; k <= 8; k++){ const t = k / 8, ease = t * t * (3 - 2 * t) * 0.25 + t * 0.75;
    fr.push({ transform: `translate(calc(-50% + ${dx * ease + (jig || 0) * Math.sin(Math.PI * t)}px), calc(-50% + ${dy * ease - Math.sin(Math.PI * t) * lift}px)) scale(${(0.6 + 0.5 * Math.sin(Math.PI * t)).toFixed(2)}) rotate(${Math.round(360 * t)}deg)` }); }
  return fr;
}
/* 4.17.0: what a hit leaves behind, by the attacker's type — embers, splashes, leaves, sparks, shards… */
const HIT_FX = {
  Fire:     { sh:'ember',   c:['#fff3a0','#ff9a2a','#e0401a'], up:true },
  Water:    { sh:'drop',    c:['#d8f0ff','#6fb8f0','#3a86d8'], fall:true },
  Grass:    { sh:'leaf',    c:['#9be07a','#5cb84a','#3e8e34'], spin:true },
  Electric: { sh:'spark',   c:['#fff6a0','#ffe14a'] },
  Ice:      { sh:'ishard',  c:['#ffffff','#bfe8f8','#8cc8e0'], fall:true },
  Rock:     { sh:'chunk',   c:['#b8a888','#8e7e62','#6e604a'], fall:true },
  Ground:   { sh:'dust',    c:['#e0c080','#c4a060'], slow:true },
  Psychic:  { sh:'glint',   c:['#ffd0f0','#f85888'], spin:true },
  Ghost:    { sh:'wisp',    c:['#b49af0','#7a5ac8'], up:true, slow:true },
  Poison:   { sh:'bubble',  c:['#e0a8ff','#b05ad0'], up:true },
  Fighting: { sh:'star',    c:['#ffe07a','#ff8a4c'] },
  Normal:   { sh:'star',    c:['#ffffff','#e8e0c8'] },
  Dragon:   { sh:'ember',   c:['#c8b0ff','#7a50f0','#4a30b0'], up:true },
  Flying:   { sh:'feather', c:['#ffffff','#dfe8f5'], spin:true, slow:true },
  Bug:      { sh:'leaf',    c:['#c8d860','#94a830'], spin:true },
  Steel:    { sh:'spark',   c:['#ffffff','#c8d0dc'] },
  Dark:     { sh:'wisp',    c:['#6a4a6a','#2a1a2a'], up:true, slow:true },
};
function hitBurst(S, F, type, big){
  if(motionOff()) return;
  const d = HIT_FX[type] || HIT_FX.Normal, c = artCentre(S, F), n = Math.round(((d.sh === 'dust' ? 5 : 8) + (big ? 6 : 0)) * (fxLevel() === 'light' ? 0.5 : 1));
  for(let k = 0; k < n; k++){
    const e = fxEl(S, 'pt ' + d.sh, c.x, c.y); e.style.setProperty('--c', d.c[k % d.c.length]);
    const a = (k / n) * Math.PI * 2 + Math.random() * 0.6, r = c.w * (0.35 + Math.random() * 0.45);
    const x = Math.cos(a) * r, y = Math.sin(a) * r * 0.75, g = d.fall ? c.w * 0.55 : d.up ? -c.w * 0.6 : 0;
    const rot = d.spin ? (Math.random() - 0.5) * 540 : d.sh === 'spark' ? (Math.random() * 360) : 0;
    anim(e, [{ transform: `translate(-50%,-50%) rotate(0deg) scale(.4)`, opacity: 1 },
             { transform: `translate(calc(-50% + ${x * 0.7}px), calc(-50% + ${y * 0.7}px)) rotate(${rot * 0.6}deg) scale(1)`, opacity: 1, offset: .35 },
             { transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y + g}px)) rotate(${rot}deg) scale(${d.sh === 'dust' ? 1.6 : 0.7})`, opacity: 0 }],
      { duration: (d.slow ? 820 : 560) + Math.random() * 160, easing: d.fall ? 'cubic-bezier(.3,.4,.7,1)' : 'ease-out', remove: true });
  }
}
/** What an attack looks like on its way over. Resolves when it lands.
    5.9.0: redone. Every type has its own look, everything is sized to the pokémon on screen (the --u scale on the
    effects layer), and shots leave a short trail. */
const fin = a => a.finished.catch(() => {});
function trail(S, a, dx, dy, dur, cls, n, arc, col){
  if(fxLevel() !== 'full') return;
  for(let k = 1; k <= n; k++){
    const t = k / (n + 1), lift = arc ? Math.sin(Math.PI * t) * Math.max(26, Math.hypot(dx, dy) * 0.38) : 0;
    const e = fxEl(S, 'pt trail ' + cls, a.x + dx * t, a.y + dy * t - lift); if(col) e.style.setProperty('--c', col);
    anim(e, [{ opacity: 0, transform: 'translate(-50%,-50%) scale(.9)' }, { opacity: .9, offset: .15 }, { opacity: 0, transform: 'translate(-50%,-50%) scale(.3)' }],
      { duration: dur * 0.9, delay: dur * t, fill: 'backwards', remove: true });
  }
}
function straightFrames(dx, dy, wob){
  const fr = [];
  for(let k = 0; k <= 6; k++){ const t = k / 6, w = (wob || 0) * Math.sin(t * Math.PI * 2);
    const nx = -dy / (Math.hypot(dx, dy) || 1), ny = dx / (Math.hypot(dx, dy) || 1);
    fr.push({ transform: `translate(calc(-50% + ${dx * t + nx * w}px), calc(-50% + ${dy * t + ny * w}px)) rotate(${Math.atan2(dy, dx)}rad)` }); }
  return fr;
}
function projectile(S, A, T, kind, dur){
  const a = artCentre(S, A), b = artCentre(S, T), col = typeColor(A.id);
  const dx = b.x - a.x, dy = b.y - a.y, ang = Math.atan2(dy, dx);
  const at = (cls, x, y) => { const e = fxEl(S, cls, x, y); e.style.setProperty('--c', col); return e; };
  const pop = (e, d, from, to) => fin(anim(e, [{ opacity: 0, transform: `translate(-50%,-50%) ${from}` }, { opacity: 1, offset: .35 }, { opacity: 0, transform: `translate(-50%,-50%) ${to}` }],
    { duration: d, delay: dur * 0.15, easing: 'ease-out', fill: 'backwards', remove: true }));
  switch(kind){
    case 'slash': case 'dark': {        // two crossing cuts at the target
      return Promise.all([0, 1].map(k => { const e = at('slash' + (kind === 'dark' ? ' dark' : ''), b.x, b.y);
        return fin(anim(e, [{ opacity: 0, transform: `translate(-50%,-50%) rotate(${k ? 120 : -70}deg) scale(.5)` }, { opacity: 1, transform: `translate(-50%,-50%) rotate(${k ? 200 : 20}deg) scale(1.05)`, offset: .55 },
          { opacity: 0, transform: `translate(-50%,-50%) rotate(${k ? 240 : 60}deg) scale(1.15)` }], { duration: dur, delay: dur * (0.15 + k * 0.25), easing: 'ease-out', fill: 'backwards', remove: true })); }));
    }
    case 'fight': return pop(at('punch', b.x, b.y), dur, 'scale(.3) rotate(-20deg)', 'scale(1.5) rotate(10deg)');
    case 'quake': {                     // the ground cracks under the target and throws up dust
      const g = at('quakering', b.x, b.y + b.w * 0.42);
      anim(T.el.querySelector('.fart') || T.el, [{ translate: '0 0' }, { translate: '0 -6px', offset: .3 }, { translate: '0 2px', offset: .6 }, { translate: '0 0' }], { duration: dur * 1.1, delay: dur * 0.3 });
      for(let k = 0; k < 4; k++){ const d = at('pt dust', b.x + (k - 1.5) * b.w * 0.3, b.y + b.w * 0.4); d.style.setProperty('--c', '#d8b878');
        anim(d, [{ opacity: 0, transform: 'translate(-50%,-50%) scale(.4)' }, { opacity: .9, offset: .3 }, { opacity: 0, transform: `translate(-50%, calc(-50% - ${b.w * 0.5}px)) scale(1.8)` }], { duration: dur * 1.6, delay: dur * (0.3 + k * 0.08), fill: 'backwards', remove: true }); }
      return pop(g, dur * 1.2, 'scale(.2,.08)', 'scale(1.6,.6)');
    }
    case 'psy': {                       // rings close in on the target, then a pink pulse
      return Promise.all([0, 1, 2].map(k => fin(anim(at('ring', b.x, b.y), [{ opacity: 0, transform: 'translate(-50%,-50%) scale(1.5)' }, { opacity: .95, offset: .3 }, { opacity: 0, transform: 'translate(-50%,-50%) scale(.25)' }],
        { duration: dur * 0.9, delay: k * dur * 0.16, easing: 'ease-in', fill: 'backwards', remove: true }))));
    }
    case 'elec': {                      // a jagged bolt flickers across, three times
      const len = Math.hypot(dx, dy), n = 7, pts = [];
      for(let k = 0; k <= n; k++){ const t = k / n, off = k === 0 || k === n ? 0 : (k % 2 ? 1 : -1) * len * 0.07 * (0.6 + Math.random() * 0.6);
        pts.push(`${(t * len).toFixed(1)},${off.toFixed(1)}`); }
      const e = fxEl(S, 'bolt', a.x, a.y);
      e.style.width = len + 'px'; e.style.transform = `translateY(-50%) rotate(${ang}rad)`;
      e.innerHTML = `<svg viewBox="0 ${-len * 0.12} ${len} ${len * 0.24}" preserveAspectRatio="none"><polyline points="${pts.join(' ')}" class="g"/><polyline points="${pts.join(' ')}" class="c"/></svg>`;
      return fin(anim(e, [{ opacity: 0 }, { opacity: 1, offset: .1 }, { opacity: .2, offset: .25 }, { opacity: 1, offset: .4 }, { opacity: .3, offset: .6 }, { opacity: 1, offset: .75 }, { opacity: 0 }],
        { duration: dur * 1.2, delay: dur * 0.1, fill: 'backwards', remove: true }));
    }
    case 'gust': {                      // three white crescents sweep across
      return Promise.all([0, 1, 2].map(k => { const e = at('crescent', a.x, a.y);
        return fin(anim(e, straightFrames(dx, dy, (k - 1) * b.w * 0.25).map((f, j, arr) => ({ ...f, opacity: j === 0 || j === arr.length - 1 ? 0 : 1 })),
          { duration: dur, delay: k * dur * 0.15, easing: 'ease-in', fill: 'both', remove: true })); }));
    }
  }
  /* everything else is a shot: what it is, how many, and the path it takes */
  const SHOT = {
    fire:   { cls: 'fireball', n: 1, path: 'straight', trail: 'ember', tn: 5, tc: '#ff8a2a' },
    dragon: { cls: 'dragonball', n: 1, path: 'straight', wob: 6, trail: 'ember', tn: 5, tc: '#9a70ff' },
    shadow: { cls: 'shadowball', n: 1, path: 'straight', wob: 8, trail: 'wisp', tn: 4, tc: '#8a6ad8' },
    water:  { cls: 'drop', n: 5, path: 'straight', gap: .09, trail: null },
    ice:    { cls: 'icicle', n: 3, path: 'straight', gap: .12, trail: 'ishard', tn: 3, tc: '#dff4ff' },
    grass:  { cls: 'leafshot', n: 3, path: 'arc', jig: 10, gap: .14, trail: null },
    pin:    { cls: 'pinshot', n: 3, path: 'straight', gap: .1, trail: null },
    steel:  { cls: 'steelshot', n: 2, path: 'straight', gap: .16, trail: 'spark', tn: 3, tc: '#e8eef6' },
    sludge: { cls: 'sludgeball', n: 2, path: 'arc', jig: 8, gap: .18, trail: 'bubble', tn: 3, tc: '#c07ae0' },
    rock:   { cls: 'rockshot', n: 2, path: 'arc', jig: 6, gap: .2, trail: null },
  }[kind] || { cls: 'fireball', n: 1, path: 'straight' };
  const shots = [];
  for(let k = 0; k < SHOT.n; k++){
    const e = at('shot ' + SHOT.cls, a.x, a.y);
    const frames = SHOT.path === 'arc' ? arcFrames(dx, dy, SHOT.jig ? (k - (SHOT.n - 1) / 2) * SHOT.jig : 0) : straightFrames(dx, dy, SHOT.wob || (SHOT.n > 1 ? (k % 2 ? 4 : -4) : 0));
    shots.push(fin(anim(e, frames, { duration: dur, delay: k * dur * (SHOT.gap || 0.14), easing: SHOT.path === 'arc' ? 'linear' : 'ease-in', fill: 'both', remove: true })));
  }
  if(SHOT.trail) trail(S, a, dx, dy, dur, SHOT.trail, SHOT.tn || 4, SHOT.path === 'arc', SHOT.tc || col);
  return Promise.all(shots).then(() => {
    if(!T.el.isConnected) return;
    const e = at('burst', b.x, b.y);
    anim(e, [{ opacity: 1, transform: 'translate(-50%,-50%) scale(.3)' }, { opacity: 0, transform: 'translate(-50%,-50%) scale(1.5)' }], { duration: 340, remove: true });
  });
}
/* ---- 5.10.0 · Options → Effects: Full / Light / Off ----
   Light keeps the shots and hits but drops trails, signature moves, field weather and half the particles; Off shows
   only the numbers (as the fastest speed does). Reduced motion still turns everything off. */
const fxLevel = () => { const v = PREF.get('fx', 'full'); return v === 'light' || v === 'off' ? v : 'full'; };

/* ---- 5.10.0 · SIGNATURE MOVES ----
   The big finals and the legendaries get their own effect when they use their main move. */
const SIG = {
  charizard:['spiral','#ff7a2a'], typhlosion:['spiral','#ff8a3a'], moltres:['spiral','#ffb03a'], 'ho-oh':['spiral','#ffc040'], entei:['spiral','#ff6a2a'], ninetales:['spiral','#ffb060'], arcanine:['spiral','#ff8a3a'], houndoom:['spiral','#ff5a3a'],
  blastoise:['beam','#5aa8ff'], feraligatr:['beam','#4a90e8'], suicune:['beam','#7ad8ff'], kingdra:['beam','#6ab0f0'], starmie:['beam','#c8a8ff'],
  venusaur:['beam','#b8f080'], meganium:['beam','#d8f8a0'], celebi:['beam','#c8ffb0'],
  lapras:['beam','#dff4ff'], articuno:['beam','#c8f0ff'], lugia:['beam','#e0e8ff'],
  dragonite:['beam','#ffd27a'], gyarados:['beam','#ff7070'], tyranitar:['shock','#c8a070'], golem:['shock','#c8b080'], snorlax:['shock','#e0c890'], steelix:['shock','#c8d0dc'],
  gengar:['vortex','#8a5ad8'], umbreon:['vortex','#e0c050'],
  alakazam:['psyburst','#f85888'], espeon:['psyburst','#ff8ad8'], mewtwo:['psyburst','#c070ff'], mew:['psyburst','#ffb0e0'],
  machamp:['combo','#ffb08a'], heracross:['combo','#8ab0ff'], scizor:['combo','#ff6a6a'],
  pikachu:['sky','#ffe14a'], raichu:['sky','#ffd23a'], jolteon:['sky','#fff070'], zapdos:['sky','#ffe860'], raikou:['sky','#ffe060'], ampharos:['sky','#ffd860'],
  /* 6.3.0: Hoenn */
  blaziken:['combo','#ff7a2a'], sceptile:['combo','#7ad850'], swampert:['shock','#5aa8d8'], camerupt:['spiral','#ff6a2a'], torkoal:['spiral','#ff9a4a'],
  gardevoir:['psyburst','#ff90c0'], jirachi:['psyburst','#ffe890'], milotic:['beam','#7ac8ff'], ludicolo:['beam','#80f0a0'], wailord:['beam','#5a98e8'],
  walrein:['beam','#c0e8ff'], glalie:['beam','#d0f0ff'], altaria:['beam','#a8c8ff'], salamence:['beam','#ff7a5a'], flygon:['shock','#e0c070'],
  metagross:['combo','#aab8d0'], aggron:['shock','#b0b8c8'], absol:['vortex','#c8d0e8'], banette:['vortex','#9a60c0'], shiftry:['vortex','#7ad060'],
  slaking:['shock','#e0c890'], manectric:['sky','#fff070'], sharpedo:['combo','#6aa8e0'], hariyama:['combo','#ffb08a'], breloom:['combo','#a8e070'],
  kyogre:['beam','#4a90ff'], groudon:['spiral','#ff5a2a'], rayquaza:['beam','#6af0a0'], regirock:['shock','#c0a080'], regice:['beam','#c0f0ff'], registeel:['shock','#c8d0dc'],
};
function sigFx(S, A, targets, sig, dur){
  const [kind, col] = sig, a = artCentre(S, A), out = [];
  const at = (cls, x, y) => { const e = fxEl(S, cls, x, y); e.style.setProperty('--c', col); return e; };
  if(kind === 'shock'){   // one shockwave rolls out from the user across the floor
    const r = at('quakering sig', a.x, a.y + a.w * 0.42);
    anim(S.el, [{ transform: 'translate(0,0)' }, { transform: 'translate(0,4px)' }, { transform: 'translate(0,-3px)' }, { transform: 'translate(0,0)' }], { duration: 320, delay: dur * 0.3 });
    out.push(fin(anim(r, [{ opacity: 1, transform: 'translate(-50%,-50%) scale(.2,.08)' }, { opacity: 0, transform: 'translate(-50%,-50%) scale(5,1.8)' }], { duration: dur * 1.5, easing: 'ease-out', remove: true })));
  }
  for(const T of targets){
    const b = artCentre(S, T), dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
    if(kind === 'beam'){        // a thick beam with a white core, from user to target
      const e = at('beam', a.x, a.y); e.style.width = len + 'px'; e.style.transform = `translateY(-50%) rotate(${ang}rad)`;
      out.push(fin(anim(e, [{ opacity: 0, transform: `translateY(-50%) rotate(${ang}rad) scaleX(0)` }, { opacity: 1, transform: `translateY(-50%) rotate(${ang}rad) scaleX(1)`, offset: .35 },
        { opacity: 1, transform: `translateY(-50%) rotate(${ang}rad) scale(1,1.3)`, offset: .7 }, { opacity: 0, transform: `translateY(-50%) rotate(${ang}rad) scale(1,.2)` }], { duration: dur * 1.5, easing: 'ease-out', remove: true })));
    } else if(kind === 'sky'){  // lightning from the sky onto the target
      const top = Math.max(0, b.y - S.el.clientHeight * 0.6), h = b.y - top, n = 8, pts = [];
      for(let k = 0; k <= n; k++){ const off = k === 0 || k === n ? 0 : (k % 2 ? 1 : -1) * h * 0.06 * (0.6 + Math.random() * 0.6); pts.push(`${(k / n * h).toFixed(1)},${off.toFixed(1)}`); }
      const e = fxEl(S, 'bolt sig', b.x, top); e.style.width = h + 'px'; e.style.transform = 'translateY(-50%) rotate(90deg)';
      e.innerHTML = `<svg viewBox="0 ${-h * 0.12} ${h} ${h * 0.24}" preserveAspectRatio="none"><polyline points="${pts.join(' ')}" class="g"/><polyline points="${pts.join(' ')}" class="c"/></svg>`;
      const fl = fxEl(S, 'skyflash', 0, 0);
      anim(fl, [{ opacity: 0 }, { opacity: .55, offset: .2 }, { opacity: 0 }], { duration: dur * 1.2, delay: dur * 0.2, fill: 'backwards', remove: true });
      out.push(fin(anim(e, [{ opacity: 0 }, { opacity: 1, offset: .15 }, { opacity: .3, offset: .3 }, { opacity: 1, offset: .45 }, { opacity: 0 }], { duration: dur * 1.3, delay: dur * 0.15, fill: 'backwards', remove: true })));
    } else if(kind === 'spiral'){   // a ring of flame closes round the target
      for(let k = 0; k < 12; k++){ const e = at('pt ember sig', b.x, b.y), a0 = k / 12 * Math.PI * 2;
        const fr = [0, .25, .5, .75, 1].map(t => { const r = b.w * (1 - t * 0.6), ang2 = a0 + t * Math.PI * 1.6;
          return { transform: `translate(calc(-50% + ${Math.cos(ang2) * r}px), calc(-50% + ${Math.sin(ang2) * r * 0.55}px)) scale(${1.4 - t * 0.6})`, opacity: t === 1 ? 0 : 1 }; });
        out.push(fin(anim(e, fr, { duration: dur * 1.4, delay: k * 18, easing: 'ease-in', fill: 'backwards', remove: true }))); }
    } else if(kind === 'vortex'){   // a dark swirl opens on the target
      const e = at('vortex', b.x, b.y);
      out.push(fin(anim(e, [{ opacity: 0, transform: 'translate(-50%,-50%) scale(.2) rotate(0deg)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1.1) rotate(220deg)', offset: .5 },
        { opacity: 0, transform: 'translate(-50%,-50%) scale(.6) rotate(480deg)' }], { duration: dur * 1.6, easing: 'ease-in-out', remove: true })));
    } else if(kind === 'psyburst'){ // the target glows, then a flash and rings burst out of it
      const g = at('psyglow', b.x, b.y);
      out.push(fin(anim(g, [{ opacity: 0, transform: 'translate(-50%,-50%) scale(.4)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: .5 }, { opacity: 0, transform: 'translate(-50%,-50%) scale(1.8)' }], { duration: dur * 1.5, remove: true })));
      [0, 1, 2].forEach(k => anim(at('ring', b.x, b.y), [{ opacity: .9, transform: 'translate(-50%,-50%) scale(.3)' }, { opacity: 0, transform: 'translate(-50%,-50%) scale(2.2)' }], { duration: dur * 1.1, delay: dur * (0.5 + k * 0.15), fill: 'backwards', remove: true }));
    } else if(kind === 'combo'){    // three quick blows
      for(let k = 0; k < 3; k++){ const e = at('punch', b.x + (k - 1) * b.w * 0.3, b.y + (k % 2 ? -1 : 1) * b.w * 0.15);
        out.push(fin(anim(e, [{ opacity: 0, transform: 'translate(-50%,-50%) scale(.3)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1.2)', offset: .5 }, { opacity: 0, transform: 'translate(-50%,-50%) scale(1.5)' }],
          { duration: dur * 0.7, delay: k * dur * 0.3, fill: 'backwards', remove: true }))); }
    }
  }
  return Promise.all(out);
}

/* ---- 5.10.0 · FIELD WEATHER ----
   A big Fire hit warms the field for a moment, a Water one leaves a puddle that dries, Ice frosts the field,
   an Electric one flashes it. */
function fieldWeather(S, type, T){
  if(fxLevel() !== 'full' || motionOff()) return;
  if(type === 'Water' && T){ const b = artCentre(S, T); for(let k = 0; k < 2; k++){ const e = fxEl(S, 'puddle', b.x + (k ? b.w * 0.35 : -b.w * 0.2), b.y + b.w * (0.42 + k * 0.06));
      anim(e, [{ opacity: 0, transform: 'translate(-50%,-50%) scale(.3,.3)' }, { opacity: .85, transform: 'translate(-50%,-50%) scale(1,1)', offset: .1 }, { opacity: .7, offset: .6 }, { opacity: 0, transform: 'translate(-50%,-50%) scale(.6,.6)' }],
        { duration: 4200, delay: k * 120, fill: 'backwards', remove: true }); } return; }
  const cls = { Fire: 'warm', Ice: 'frost', Electric: 'zap' }[type]; if(!cls) return;
  const e = fxEl(S, 'tint ' + cls, 0, 0);
  anim(e, [{ opacity: 0 }, { opacity: .65, offset: .2 }, { opacity: .5, offset: .6 }, { opacity: 0 }], { duration: cls === 'zap' ? 600 : 1800, easing: 'ease-out', remove: true });
}

/** Support moves travel too: a soft sparkle from the user to whoever it helps. */
function boon(S, A, T, dur){
  const a = artCentre(S, A), b = artCentre(S, T);
  const e = fxEl(S, 'shot boon', a.x, a.y);
  return anim(e, [{ transform: 'translate(-50%,-50%) scale(.5)', opacity: .4 },
                  { transform: `translate(calc(-50% + ${(b.x - a.x) / 2}px), calc(-50% + ${(b.y - a.y) / 2 - 22}px)) scale(1)`, opacity: 1, offset: .5 },
                  { transform: `translate(calc(-50% + ${b.x - a.x}px), calc(-50% + ${b.y - a.y}px)) scale(.8)`, opacity: .9 }],
    { duration: dur, easing: 'ease-in-out', fill: 'both', remove: true }).finished.catch(() => {});
}
function faintFx(S, F){
  const mv = F.el.querySelector('.fmove');
  F.down = true;
  F.el.classList.remove('acting');
  if(motionOff()){ F.el.classList.add('down'); return; }
  /* 4.13.0: on the board a fallen tile stays where it stood, greyed out with a cross */
  anim(mv, [{ transform: 'translate(0,0)', opacity: 1, filter: 'none' },
            { transform: 'translate(0,2px) scale(.97)', opacity: 1, filter: 'grayscale(1) brightness(1.8)', offset: .25 },
            { transform: 'translate(0,0) scale(1)', opacity: .3, filter: 'grayscale(1)' }],
    { duration: 520, easing: 'ease-in' }).finished.then(() => F.el.classList.add('down'), () => {});
}

/* ---------------- one step, animated ---------------- */
function animateStep(S, i){
  const st = battle.steps[i], prev = battle.steps[i - 1];
  if(!st || !prev){ syncStage(S, i); return; }
  S.at = i;
  const gen = S.gen;
  const beat = stepDelay();                       // how long this step is on screen
  const quick = beat < 300 || motionOff() || fxLevel() === 'off';   // at 4× there is only time for the numbers; 5.10.0: or Effects: Off
  const was = snapMap(prev), now = snapMap(st);
  const fxBy = new Map();
  for(const x of st.fx || []){
    const k = (x.side || (now.has('p:' + x.uid) || was.has('p:' + x.uid) ? 'p' : 'e')) + ':' + x.uid;
    if(!fxBy.has(k)) fxBy.set(k, new Set());
    fxBy.get(k).add(x.kind);
  }
  const lines = st.lines || [];
  const ak = actorKey(st), A = ak ? S.f.get(ak) : null;
  markActing(S, st);
  { const any = A || [...S.f.values()].find(F => !F.down);   // 5.9.0: effects are sized to the pokémon on screen
    if(any && !quick){ const w = artCentre(S, any).w; if(w > 0) S.fx.style.setProperty('--u', Math.max(.8, Math.min(2.4, w / 48)).toFixed(2)); } }

  // what happened to each pokémon on this step
  const ev = [];
  for(const [k, F] of S.f){
    if(F.down) continue;
    const w = was.get(k), n = now.get(k), kinds = fxBy.get(k) || new Set();
    if(!w && !n) continue;
    const fainted = !n || kinds.has('faint');
    const dhp = (n ? n.hp : 0) - (w ? w.hp : F.hp);
    const stNew = n && n.st && n.st !== (w && w.st) ? n.st : null;
    const shUp = n && (n.shield || 0) > ((w && w.shield) || 0);
    const dAtk = n && w ? n.atk - w.atk : 0, dSpd = n && w ? n.spd - w.spd : 0;
    const shDown = !!(n && w && (w.shield || 0) > 0 && !(n.shield > 0));
    const touched = fainted || dhp || stNew || shUp || shDown || dAtk || dSpd || kinds.has('hit') || kinds.has('crit') || kinds.has('buff');
    if(touched) ev.push({ k, F, n, w, kinds, fainted, dhp, stNew, shUp, shDown, dAtk, dSpd });
  }
  const foes = A ? ev.filter(e => e.F.side !== A.side && (e.dhp < 0 || e.fainted || e.stNew || e.kinds.has('hit') || e.kinds.has('crit'))) : [];
  const pals = A ? ev.filter(e => e.F !== A && e.F.side === A.side && (e.dhp > 0 || e.shUp || e.dAtk > 0 || e.dSpd > 0 || e.kinds.has('buff'))) : [];
  const selfBuff = A && ev.some(e => e.F === A && (e.dhp > 0 || e.shUp || e.dAtk > 0 || e.dSpd > 0));

  const lungeMs = Math.min(320, beat * 0.42);
  const flyMs = Math.min(300, beat * 0.4);
  const impactAt = quick ? 0 : Math.min(beat * 0.6, lungeMs * 0.45 + flyMs);

  if(A && !quick){
    if(foes.length) lunge(A, true, lungeMs);
    else if(pals.length || selfBuff) lunge(A, false, lungeMs);
    const kind = FX_OF[SPECIES[A.id] ? SPECIES[A.id].type : ''] || 'slash';
    setTimeout(() => {
      if(S.gen !== gen) return;
      const sp = SPECIES[A.id], sig = fxLevel() === 'full' && SIG[A.id] && sp && lines.some(l => l === `${A.nm} used ${sp.move.name}!`) ? SIG[A.id] : null;   // 5.10.0
      if(sig && foes.length) sigFx(S, A, foes.slice(0, 6).map(e => e.F), sig, flyMs);
      else foes.slice(0, 6).forEach(e => projectile(S, A, e.F, kind, flyMs));
      pals.slice(0, 6).forEach(e => boon(S, A, e.F, flyMs));
    }, lungeMs * 0.45);
  }
  // a pokémon that lost its turn says so
  if(A && lines.some(l => /is fast asleep/.test(l))) puff(S, A, 'z', 3);
  if(A && lines.some(l => /flinched and couldn't move/.test(l))) floatText(S, A, 'Flinched!', 'st-fln note');

  const land = () => {
    if(S.gen !== gen) return;
    let told = false;
    /* v47: one sound for the blow (super effective beats a plain hit beats a weak
       one) and one for anything else that happened; a faint follows its fall */
    const hurt = ev.some(e => e.dhp < 0 && e.kinds.has('crit')) ? 'crit'
      : ev.some(e => e.dhp < 0 && !lines.some(l => l.startsWith(e.F.nm + ' took') && /not very effective/.test(l))) ? 'hit'
      : ev.some(e => e.dhp < 0) ? 'weak' : null;
    const extra = ev.some(e => e.stNew) ? 'status' : ev.some(e => e.shUp) ? 'shield' : ev.some(e => e.dhp > 0) ? 'heal'
      : ev.some(e => e.dAtk > 0 || e.dSpd > 0) ? 'up' : ev.some(e => e.dAtk < 0 || e.dSpd < 0) ? 'down' : null;
    if(hurt) SFX.play(hurt);
    /* 4.13.0: a type-coloured flash where each blow lands, and the field shakes on a super-effective hit or a knockout */
    if(!quick && A){ const col = typeColor(A.id);
      const aType = SPECIES[A.id] ? SPECIES[A.id].type : 'Normal';
      for(const e of ev) if(e.dhp < 0 && e.F.side !== A.side){ hitBurst(S, e.F, aType, e.kinds.has('crit') || e.fainted); const c = artCentre(S, e.F), x = fxEl(S, 'impact', c.x, c.y); x.style.setProperty('--c', col);
        anim(x, [{ opacity: 1, transform: 'translate(-50%,-50%) scale(.3)' }, { opacity: 0, transform: 'translate(-50%,-50%) scale(1.5)' }], { duration: 360, easing: 'ease-out', remove: true }); } }
    const bigHit = ev.find(e => e.dhp < 0 && (e.kinds.has('crit') || e.fainted));
    if(bigHit && A && !quick && SPECIES[A.id]) fieldWeather(S, SPECIES[A.id].type, bigHit.F);   // 5.10.0
    if(bigHit && !quick) camLean(S, bigHit.F);
    if(bigHit) crowdReact(S, bigHit.F.side === 'e' || bigHit.fainted);
    if(!motionOff() && bigHit)
      anim(S.el, [{ transform: 'translate(0,0)' }, { transform: 'translate(-5px,3px)' }, { transform: 'translate(5px,-3px)' }, { transform: 'translate(-3px,0)' }, { transform: 'translate(0,0)' }], { duration: 280 });
    if(extra) setTimeout(() => SFX.play(extra), hurt ? 70 : 0);
    if(ev.some(e => e.fainted)) setTimeout(() => { if(S.gen === gen) SFX.play('faint'); }, quick ? 60 : 170);
    for(const e of ev){
      const F = e.F, nm = F.nm;
      if(e.n) paintFighter(F, e.n, true);
      else { const bar = F.el.querySelector('.fhp i'); bar.style.width = '0%'; bar.className = 'low'; }
      let lift = 0;
      const soak = lines.find(l => l.startsWith(nm + "'s barrier soaked"));
      if(e.dhp < 0){
        const se = e.kinds.has('crit'), weak = lines.some(l => l.startsWith(nm + ' took') && /not very effective/.test(l));
        const dot = !A && e.w && e.w.st && TUNING.status[e.w.st] && TUNING.status[e.w.st].dotPct;
        const took = e.fainted && lines.map(l => l.startsWith(nm + ' took ') && l.match(/took (\d+) damage/)).find(Boolean);
        floatText(S, F, '−' + (took ? took[1] : -e.dhp), se ? 'se' : weak ? 'weak' : dot ? 'st-' + e.w.st : '');
        if(dot) statusPuff(S, F, e.w.st, 2);
        else flash(F, se || e.fainted, se ? '#ffd166' : null);
        if(se && !told){ told = true; floatText(S, F, 'Super effective!', 'se note', 26); }
        lift = 22;
      } else if(e.dhp > 0){
        floatText(S, F, '+' + e.dhp, 'heal'); glow(F, '#5ad17a'); lift = 22;
      } else if(soak){
        flash(F, false, '#8ecbff');
      } else if(e.kinds.has('hit') && !e.stNew && !e.dAtk && !e.dSpd && F !== A){
        flash(F, false);
      }
      if(soak){ const m = soak.match(/soaked (\d+)/); if(m) floatText(S, F, '🛡️ ' + m[1], 'shield note', lift); lift += 20; }
      if(e.stNew){
        const S0 = TUNING.status[e.stNew];
        floatText(S, F, ST_WORD[e.stNew] || S0.name, 'st-' + e.stNew + ' note', lift); lift += 20;
        statusPuff(S, F, e.stNew, 3);
        glow(F, { brn:'#ff7a2e', psn:'#b05ad0', par:'#ffd93a', slp:'#9fb1d6', cnf:'#ff9bd0', fln:'#ffffff' }[e.stNew] || '#fff');
      }
      if(e.shUp){ floatText(S, F, 'Barrier', 'shield note', lift); lift += 20; }
      if(e.shDown && !e.fainted){ floatText(S, F, 'Barrier broke', 'shield note', lift); lift += 20; F.el.querySelector('.fbarrier').classList.remove('on'); shatter(S, F); }
      if(e.dAtk) { floatText(S, F, e.dAtk > 0 ? 'ATK ▲' : 'ATK ▼', (e.dAtk > 0 ? 'up' : 'down') + ' note', lift); lift += 20; }
      if(e.dSpd) { floatText(S, F, e.dSpd > 0 ? 'SPD ▲' : 'SPD ▼', (e.dSpd > 0 ? 'up' : 'down') + ' note', lift); }
      if(e.fainted) setTimeout(() => { if(S.gen === gen) faintFx(S, F); }, quick ? 60 : 170);
    }
    /* 4.2.0: a fighter nothing "happened" to on this step can still have lost its barrier or a status
       (a hit soaked whole, a status running out). It used to keep the old shell and chip until
       something else touched it. Bring every living fighter up to the snapshot. */
    for(const [k, F] of S.f){
      if(F.down) continue;
      const n = now.get(k);
      if(n && (((n.shield || 0) !== F.shield) || n.st !== F.st)) paintFighter(F, n, false);
    }
  };
  if(impactAt) setTimeout(land, impactAt); else land();
}

/* ---------------- intro and outro ---------------- */
/** "X wants to battle!" slides across, then both teams run in. Returns how long it takes. */
/* ---- 5.0.0 · THE WALK-OUT --------------------------------------------
   Before a leader, an Elite Four member, the Champion, a secret boss or your
   rival fights, they walk out onto their half of the field to a cheer, stop
   in the middle, and throw out their team: a pokéball arcs to each spot and
   the pokémon appear in a flash. Then the "wants to battle!" banner. */
const WALK_KINDS = ['gym', 'elite', 'champion', 'red', 'rival'];
/* 5.2.0: what each boss says when they reach the middle of their half */
const BOSS_LINES = {
  /* 6.3.0: Hoenn */
  roxanne: 'Preparation is half the battle. I’ve done my homework on you.', brawly: 'Time to see if you can ride the wave. Let’s go!',
  wattson: 'Wahahahah! Let’s see if I can shock you into a smile!', flannery: 'I’m new at this, but I’m not holding back. Let’s heat things up!',
  norman: 'I raised you to battle like this. Show me what you’ve learned.', winona: 'I soar the skies above. Can you keep up on the ground?',
  'tate-liza': 'We think the same thing, always. Can you read both of us?', juan: 'Behold, a battle as graceful as a fountain. Show me your elegance.',
  sidney: 'Heh! I like your face. Let’s see if you can back it up.', phoebe: 'The spirits whisper that you’ll be a good fight.',
  glacia: 'I’ve traveled far for a battle worth my time. Make it count.', drake: 'Dragons answer to those who earn them. Prove yourself.',
  'wallace-champion': 'Water is beauty in motion. Let me show you the art of a true Champion.', steven: 'A fellow collector of rare stones? Then let’s see what you’ve got.',
  brock: 'Solid as stone. Let’s see you move me.', misty: 'Hope you can swim — this is my pool.',
  surge: 'Ten-hut! Let’s see if you’ve got any spark.', erika: 'Mind the flowers. They bite back.',
  koga: 'You won’t see my next move coming.', sabrina: 'I already know how this ends.',
  blaine: 'Hot enough for you? It’s about to get hotter!', giovanni: 'Last gym, last chance. Make it count.',
  lorelei: 'A cold welcome to the League.', bruno: 'No tricks. Just strength. Ready?',
  agatha: 'Back in my day, trainers had real nerve.', lance: 'Dragons don’t hold back. Neither will I.',
  blue: 'Took you long enough. I’m the Champion now.',
  falkner: 'Clip my wings? Catch them first.', bugsy: 'I’ve studied every one of your moves. Probably.',
  whitney: 'Don’t you dare make me cry!', morty: 'I’ve seen this battle before. In a dream.',
  chuck: 'Fists up! Let’s train!', jasmine: 'Um… I’ll do my best. Steel never bends.',
  pryce: 'Patience. The ice always wins in the end.', clair: 'Dragon masters don’t lose to beginners.',
  will: 'You’ll feel my power before you move.', karen: 'Love your team and they’ll fight for you. Show me.',
  red: '…', oak: 'Show me how much you’ve grown!',
};
const RUMOURS = ['Between you and me… something rare has been spotted near here.', 'Win this, and you might meet something legendary on your way out.',
  'Strange lights over the route lately. Something rare is close.'];
const KIND_LINES = { gym: 'Let’s see if you’ve earned my badge.', elite: 'Welcome to the Elite Four.', champion: 'This is the last fight.', red: '…' };
function bossLine(b){
  if(b.kind === 'rival'){ const rv = b.opp && rivalLines(G, b.opp.meeting); return rv ? rv.hi : 'Smell ya later!'; }
  return BOSS_LINES[b.boss.id] || KIND_LINES[b.kind] || '';
}
const walkPace = () => speed >= 4 ? .45 : speed >= 2 ? .7 : 1;
/** A boss walks from the far edge onto the field and stops at `where` ('half' = the middle of their half, 'mid' = by the halfway line). */
function leaderWalk(S, b, where){
  const ms = x => x * walkPace();
  const E = S.el.getBoundingClientRect(), vert = S.el.classList.contains('vert');
  const marks = [...S.el.querySelectorAll('.slotmark.e')].map(planeRect);
  if(!marks.length) return null;
  const U = rectUnion(marks);
  const size = Math.round(Math.min(E.width * (vert ? .22 : .13), E.height * (vert ? .18 : .34)));
  let x = U.cx - E.left, y = U.cy - E.top + size * .15;
  if(where === 'mid'){ if(vert) y = U.b - E.top + size * .1; else x = U.l - E.left + size * .2; }
  const w = document.createElement('div');
  w.className = 'walkout ' + b.kind;
  w.style.cssText = `left:${x.toFixed(0)}px;top:${y.toFixed(0)}px;width:${size}px;height:${size}px`;
  w.innerHTML = `<div class="wbody"><img src="${SPRITES[b.boss.id]}" alt=""></div><span class="wname">${esc(b.boss.name)}</span><i class="wspot"></i>`;
  S.fx.appendChild(w);
  const from = vert ? `translate(-50%,-100%) translateY(${-(y + size).toFixed(0)}px)` : `translate(-50%,-100%) translateX(${(E.width - x + size).toFixed(0)}px)`;
  const at = 'translate(-50%,-100%)', walkMs = ms(where === 'mid' ? 1150 : 950);
  anim(w, [{ transform: from, opacity: 1 }, { transform: at, opacity: 1, offset: .82 }, { transform: at, opacity: 1 }], { duration: walkMs, easing: 'cubic-bezier(.3,.6,.4,1)', fill: 'both' });
  const body = w.querySelector('.wbody');
  anim(body, [{ translate: '0 0' }, { translate: '0 -7%' }, { translate: '0 0' }], { duration: ms(240), iterations: Math.ceil(walkMs * .82 / ms(240)), easing: 'ease-in-out' });
  return { w, body, x, y, size, vert, at, walkMs, ms };
}
/** A speech bubble over a walking boss. */
function leaderSay(L, text, dur){
  if(!text) return;
  const sb = document.createElement('div'); sb.className = 'wsay'; sb.textContent = text;
  document.body.classList.add('speaking'); clearTimeout(leaderSay.t); leaderSay.t = setTimeout(() => document.body.classList.remove('speaking'), dur);   // 5.3.8: the gym tag steps aside for the bubble
  L.w.appendChild(sb);
  anim(sb, [{ opacity: 0, transform: 'translate(-50%,6px) scale(.8)' }, { opacity: 1, transform: 'translate(-50%,0) scale(1)', offset: .12 },
    { opacity: 1, transform: 'translate(-50%,0) scale(1)', offset: .9 }, { opacity: 0, transform: 'translate(-50%,-4px) scale(.95)' }], { duration: dur, easing: 'ease-out', fill: 'both', remove: true });
}
/* ---- 5.1.0 · THE WALK-OUT --------------------------------------------
   Before a leader, an Elite Four member, the Champion, a secret boss or your
   rival fights, they walk out onto their half of the field to a cheer, stop
   in the middle and say their piece (5.2.0), then throw out their team: a
   pokéball arcs to each spot and the pokémon appear in a flash. Then the
   "wants to battle!" banner. */
function walkOut(S, b){
  if(!b.boss || !WALK_KINDS.includes(b.kind) || !SPRITES[b.boss.id] || motionOff()) return null;
  const L = leaderWalk(S, b, 'half'); if(!L) return null;
  const { w, body, x, y, size, vert, at, walkMs, ms } = L;
  const foes = [...S.f.values()].filter(F => F.side === 'e');
  const line = bossLine(b), holdMs = line ? Math.max(1100, ms(1500)) : ms(450), throwMs = ms(380);   // a line stays up long enough to read at any speed
  /* 5.11.0: if beating this leader will bring a legendary, they hint at it */
  const rumour = b.kind === 'gym' && G && peekEncounter(G) ? RUMOURS[(G.badges || 0) % RUMOURS.length] : null, rumourMs = rumour ? Math.max(1500, ms(1900)) : 0;
  setTimeout(() => { if(battle && battle.stage === S){ crowdReact(S, true);
    anim(body, [{ scale: '1' }, { scale: '1.12' }, { scale: '1' }], { duration: ms(360), easing: 'ease-out' });
    leaderSay(L, line, holdMs + ms(150)); } }, walkMs);
  if(rumour) setTimeout(() => { if(battle && battle.stage === S){ leaderSay(L, rumour, rumourMs); const sb = L.w.querySelector('.wsay:last-child'); if(sb) sb.classList.add('rumour'); } }, walkMs + holdMs + ms(150));
  // the throw: one ball to each spot, the leader steps back off the field
  const throwAt = walkMs + holdMs + rumourMs;
  setTimeout(() => {
    if(!battle || battle.stage !== S || !S.el.isConnected) return;
    SFX.play('move');
    const W0 = { x, y: y - size * .6 };
    for(const F of foes){
      const c = artCentre(S, F), ball = document.createElement('div');
      ball.className = 'wball2'; ball.style.left = W0.x + 'px'; ball.style.top = W0.y + 'px';
      S.fx.appendChild(ball);
      const dx = c.x - W0.x, dy = c.y - W0.y, lift = Math.max(30, Math.abs(dx) * .3 + 24);
      anim(ball, [{ transform: 'translate(-50%,-50%) rotate(0)' },
        { transform: `translate(calc(-50% + ${dx * .5}px), calc(-50% + ${dy * .5 - lift}px)) rotate(360deg)`, offset: .5 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(720deg)` }], { duration: throwMs, easing: 'linear', remove: true });
    }
    anim(w, [{ opacity: 1, transform: at }, { opacity: 0, transform: vert ? 'translate(-50%,-100%) translateY(-30%) scale(.8)' : 'translate(-50%,-100%) translateX(40%) scale(.8)' }],
      { duration: ms(520), delay: ms(120), easing: 'ease-in', fill: 'forwards', remove: true });
  }, throwAt);
  const popAt = throwAt + throwMs;
  setTimeout(() => {
    if(!battle || battle.stage !== S || !S.el.isConnected) return;
    SFX.play('land');
    for(const F of foes){ const c = artCentre(S, F); const fl = document.createElement('div'); fl.className = 'wflash';
      fl.style.left = c.x + 'px'; fl.style.top = c.y + 'px'; fl.style.width = fl.style.height = (c.w * 1.4) + 'px'; S.fx.appendChild(fl);
      anim(fl, [{ transform: 'translate(-50%,-50%) scale(.2)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(1.2)', opacity: 0 }], { duration: ms(420), easing: 'ease-out', remove: true }); }
  }, popAt);
  return { total: popAt + ms(380), popAt };
}
/* ---- 5.3.0 · WHAT BOSSES SAY WHEN IT'S OVER ------------------------------
   Win or lose, a boss walks back out to the halfway line at the end and
   says something: a line for being beaten, or a gloat when you black out. */
const DEFEAT_LINES = {
  brock: 'You cracked my defence. Well fought.', misty: 'You made a splash. Fine, you win!',
  surge: 'At ease, soldier. You earned that.', erika: 'Oh my. You wilted my garden.',
  koga: 'I never saw that coming. Impressive.', sabrina: 'I didn’t foresee this…',
  blaine: 'I’ve burnt out! You beat me fair.', giovanni: 'Hmph. You’re the real thing.',
  lorelei: 'You thawed my team. Go on.', bruno: 'My strength wasn’t enough. Move on!',
  agatha: 'Hmph! Not bad, youngster.', lance: 'You tamed my dragons… the Champion awaits.',
  blue: 'No way… I lost? You’re the Champion now.',
  falkner: 'Grounded. You fly higher than me.', bugsy: 'Note to self: you’re really good.',
  whitney: 'Waaah! That’s not fair!', morty: 'So that’s how the dream ends.',
  chuck: 'Ow! You hit harder than a waterfall!', jasmine: 'You were wonderful. Really.',
  pryce: 'The ice cracked. Well done.', clair: 'I… lost? Fine. Take it.',
  will: 'Your power beat mine. Go on.', karen: 'You really do love your team.',
  red: '…!', oak: 'Splendid! You’ve grown so much.',
};
const GLOAT_LINES = {
  brock: 'Rock beats you. Train harder!', misty: 'Washed out! Come back when you can swim.',
  surge: 'Shocked, aren’t you? Dismissed!', erika: 'Lovely try. Do come again.',
  koga: 'You never saw it coming.', sabrina: 'Just as I foresaw.',
  blaine: 'Too hot to handle? Ha!', giovanni: 'As expected. Leave my gym.',
  lorelei: 'Frozen solid. Better luck next time.', bruno: 'Train your body. Then return.',
  agatha: 'Run along home, little one.', lance: 'Dragons don’t forgive weakness.',
  blue: 'Told you. I’m the best there is!',
  falkner: 'Blown away! Ha!', bugsy: 'Just as my research predicted.',
  whitney: 'Yay, I won! Bye-bye!', morty: 'I saw this ending, too.',
  chuck: 'Hah! Do a hundred push-ups and come back!', jasmine: 'Oh… sorry. Steel doesn’t bend.',
  pryce: 'Cold, isn’t it? Patience next time.', clair: 'Told you. Dragons rule.',
  will: 'Your mind was an open book.', karen: 'Your team deserves better than that.',
  red: '…', oak: 'Come back when you’re ready!',
};
function endLine(b, won){
  if(b.kind === 'rival'){ const rv = b.opp && rivalLines(G, b.opp.meeting); return rv ? (won ? rv.lost : rv.won) : ''; }
  return (won ? DEFEAT_LINES : GLOAT_LINES)[b.boss.id] || (won ? 'Well fought.' : 'Better luck next time!');
}
function bossOutro(S){
  const b = battle;
  if(!b || b.stage !== S || !b.boss || !WALK_KINDS.includes(b.kind) || !SPRITES[b.boss.id] || motionOff()) return;
  if(b.result !== 'win' && b.result !== 'lose') return;
  const won = b.result === 'win';
  const L = leaderWalk(S, b, 'mid'); if(!L) return;
  b.leader = L;
  const ms = L.ms;
  setTimeout(() => {
    if(battle !== b || !S.el.isConnected) return;
    b.ribbonGone = true; const rb = document.querySelector('.stagewrap .big.ribbon'); if(rb) rb.classList.add('gone');   // 5.3.1: don't cover what they say
    leaderSay(L, endLine(b, won), 2000);
    anim(L.body, won ? [{ scale: '1' }, { scale: '.94' }, { scale: '1' }] : [{ translate: '0 0' }, { translate: '0 -9%' }, { translate: '0 0' }, { translate: '0 -6%' }, { translate: '0 0' }],
      { duration: ms(won ? 420 : 700), easing: 'ease-out' });
    if(!won){ crowdReact(S, false); return; }
    if(b.kind === 'gym' || b.kind === 'red') setTimeout(() => handBadge(S, b, L), 2050);
    else if(b.kind === 'champion') setTimeout(() => championPhoto(S, b, L), 2050);
  }, L.walkMs);
}
/* ---- 5.2.0 · THE BADGE CEREMONY ----------------------------------------
   After their line, a beaten gym leader (or secret boss) hands the badge
   over: it rises over them, glowing, then flies across to your side. */
function handBadge(S, b, L){
  if(battle !== b || !S.el.isConnected) return;
  const { w, body, size, ms } = L, gym = b.kind === 'gym';
  const name = gym ? `${b.boss.badge} Badge` : `${b.boss.name}’s Badge`;
  const html = gym ? `<i class="bdg ${badgeCls(G, G.badges % 8)} on big"></i>` : secretBadge(b.boss.id, 'big');
  leaderSay(L, gym ? `You’ve earned it. The ${name}!` : (b.boss.id === 'oak' ? 'Take this, with my compliments.' : '…'), 2600);
  anim(body, [{ scale: '1' }, { scale: '1.1' }, { scale: '1' }], { duration: ms(360), easing: 'ease-out' });
  const bd = document.createElement('div'); bd.className = 'wbadge'; bd.innerHTML = html + '<i class="wglow"></i>';
  w.appendChild(bd);
  SFX.play('sparkle');
  if(gym) setTimeout(() => lightLamp(S, b), ms(2300));   // 5.5.0: one more floodlight comes on for the new badge
  const mine = [...S.f.values()].filter(F => F.side === 'p' && !F.down);
  const tgt = mine.length ? artCentre(S, mine[0]) : null, me = bd.getBoundingClientRect(), E = S.el.getBoundingClientRect();   // 5.3.10: from the badge's own spot
  const dx = tgt ? tgt.x - (me.left + me.width / 2 - E.left) : -size * 2, dy = tgt ? tgt.y - (me.top + me.height / 2 - E.top) : 0;
  anim(bd, [{ transform: 'translate(-50%,0) scale(.2)', opacity: 0 }, { transform: 'translate(-50%,-40%) scale(1.25)', opacity: 1, offset: .2 },
    { transform: 'translate(-50%,-40%) scale(1)', opacity: 1, offset: .62 },
    { transform: `translate(calc(-50% + ${dx}px), calc(-40% + ${dy}px)) scale(.5)`, opacity: 1, offset: .92 },
    { transform: `translate(calc(-50% + ${dx}px), calc(-40% + ${dy}px)) scale(.2)`, opacity: 0 }], { duration: ms(2300), easing: 'cubic-bezier(.4,0,.3,1)', fill: 'both', remove: true });
  setTimeout(() => { if(battle !== b || !S.el.isConnected || !tgt) return; SFX.play('levelup');
    const fl = document.createElement('div'); fl.className = 'wflash gold'; fl.style.left = tgt.x + 'px'; fl.style.top = tgt.y + 'px';
    fl.style.width = fl.style.height = (tgt.w * 1.8) + 'px'; S.fx.appendChild(fl);
    anim(fl, [{ transform: 'translate(-50%,-50%) scale(.2)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(1.3)', opacity: 0 }], { duration: ms(520), easing: 'ease-out', remove: true }); }, ms(2120));
}
/** 5.5.0: the badge just won switches on the next floodlight. */
function lightLamp(S, b){
  if(battle !== b || !S.el.isConnected) return;
  const g = S.el.querySelector('.ground'), l = S.el.querySelector(`.lamp[data-o="${Math.min(7, G.badges || 0)}"]`);
  if(!g || !l || l.classList.contains('on')) return;
  l.classList.add('on', 'fresh'); g.style.setProperty('--lit', String(Math.min(8, (+g.style.getPropertyValue('--lit') || 0) + 1)));
  SFX.play('tap'); crowdReact(S, false);
}
/** 5.5.0: a new home field, announced on the pitch. */
function fieldBanner(S, f){
  if(!S.el.isConnected) return;
  const d = document.createElement('div'); d.className = 'fieldban';
  d.innerHTML = `<span class="fsw bstage board stadium fl-${f}"><span class="table"><span class="pitch"></span></span></span><div><small>New home field</small><b>${esc(floorName(f))}</b></div>`;
  S.el.appendChild(d);
  SFX.play('sparkle');
  anim(d, [{ opacity: 0, transform: 'translate(-50%,-12px)' }, { opacity: 1, transform: 'translate(-50%,0)', offset: .1 }, { opacity: 1, transform: 'translate(-50%,0)', offset: .88 }, { opacity: 0, transform: 'translate(-50%,-8px)' }],
    { duration: motionOff() ? 2600 : 3200, easing: 'ease-out', fill: 'both', remove: true });
}
/* ---- 5.3.0 · THE CHAMPION'S PHOTO --------------------------------------
   Beat the Champion and the Champion steps aside; your whole team (the
   fainted ones too, they get up for this) walks to centre field and lines
   up, a flash goes off, and a gold frame closes round them. The same photo
   is the top of the run's summary image. */
function championPhoto(S, b, L){
  if(battle !== b || !S.el.isConnected) return;
  const ms = L.ms, E = S.el.getBoundingClientRect(), vert = S.el.classList.contains('vert');
  anim(L.w, [{ opacity: 1 }, { opacity: 0, transform: 'translate(-50%,-100%) scale(.8)' }], { duration: ms(500), fill: 'forwards', remove: true });
  const mine = [...S.f.values()].filter(F => F.side === 'p');
  if(!mine.length) return;
  for(const F of S.f.values()) if(F.side === 'e') anim(F.el, [{ opacity: 1 }, { opacity: 0 }], { duration: ms(500), fill: 'forwards' });   // the beaten side clears the pitch
  const c0 = artCentre(S, mine.find(F => !F.down) || mine[0]);
  const size = Math.round(Math.max(36, Math.min(E.width * (vert ? .2 : .1), c0.w * 1.15)));
  const n = mine.length, back = n > 3 ? Math.ceil(n / 2) : n, front = n - back;
  const cx = E.width / 2, cy = E.height * (vert ? .5 : .55), gap = size * 1.05;
  const spots = [];
  for(let i = 0; i < back; i++) spots.push({ x: cx + (i - (back - 1) / 2) * gap, y: cy - (front ? size * .42 : 0), z: 1 });
  for(let i = 0; i < front; i++) spots.push({ x: cx + (i - (front - 1) / 2) * gap, y: cy + size * .42, z: 2 });
  const frame = document.createElement('div'); frame.className = 'photoframe';
  const fw = Math.max(back, front) * gap + size * .7, fh = (front ? size * 1.84 : size * 1.25) + 28;
  frame.style.cssText = `left:${cx}px;top:${cy + (front ? size * .3 : size * .1)}px;width:${fw}px;height:${fh}px`;
  frame.innerHTML = `<span class="phcap">Champion · ${esc(playerName())}</span>`;
  mine.forEach((F, k) => {
    const c = artCentre(S, F), img = F.el.querySelector('.fart img');
    const m = document.createElement('div'); m.className = 'phmon'; m.style.zIndex = 30 + spots[k].z;
    m.style.cssText += `;left:${c.x}px;top:${c.y}px;width:${size}px;height:${size}px`;
    m.innerHTML = `<img src="${img ? img.src : SPRITES[F.id]}" alt="">`;
    S.fx.appendChild(m);
    F.el.classList.add('posing');
    const dx = spots[k].x - c.x, dy = spots[k].y - c.y;
    anim(m, [{ transform: 'translate(-50%,-50%)' }, { transform: `translate(calc(-50% + ${dx * .5}px), calc(-50% + ${dy * .5 - size * .25}px))`, offset: .5 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))` }], { duration: ms(900), delay: ms(300 + k * 110), easing: 'ease-in-out', fill: 'both' });
  });
  const shot = ms(300 + n * 110 + 1100);
  setTimeout(() => {
    if(battle !== b || !S.el.isConnected) return;
    SFX.play('tap'); setTimeout(() => SFX.play('sparkle'), 80);
    const fl = document.createElement('div'); fl.className = 'phflash'; S.fx.appendChild(fl);
    anim(fl, [{ opacity: 0 }, { opacity: .95, offset: .12 }, { opacity: 0 }], { duration: 650, easing: 'ease-out', remove: true });
    S.fx.appendChild(frame);
    anim(frame, [{ opacity: 0, transform: 'translate(-50%,-50%) scale(1.15)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1)' }], { duration: 420, easing: 'cubic-bezier(.2,.9,.3,1.2)', fill: 'both' });
    crowdReact(S, true);
    b.photoTaken = true;
  }, shot);
}

/* ---- 5.3.0 · THE REWARD ON THE FIELD -----------------------------------
   After a gym win, Choose your reward doesn't leave the stadium: the leader
   holds out the three reward cards on the pitch. Tap one and it flies to
   your team, then the camera goes back to the shop. (The old pop-up is still
   the fallback: with the camera off, reduced motion, or a reload mid-choice.) */
let fieldPicking = false;
const fieldRewardWanted = () => !!(battle && !battle.exhibition && battle.result === 'win' && battle.kind === 'gym'
  && useCamera() && battle.stage && battle.stage.el.isConnected && WORLD.shopCam);
async function fieldReward(){
  const b = battle, S = b.stage;
  fieldPicking = true;
  document.body.classList.add('fieldpick');
  const got = await afterBattle({ keep: true });   // banks the badge and pays the turn; draws nothing yet
  if(got !== 'offer'){ fieldPicking = false; document.body.classList.remove('fieldpick'); render(); return; }
  showFieldCards(S, b.leader);
}
function leaveField(msg){
  transition(() => { fieldPicking = false; document.body.classList.remove('fieldpick'); render(); if(msg) say(msg); }, null, 'back');
}
function showFieldCards(S, L){
  const off = pendingOffer(G);
  if(!off){ leaveField(); return; }
  S.el.querySelectorAll('.fieldcards').forEach(e => e.remove());
  const left = (G.pendingRewards || []).length;
  const box = document.createElement('div'); box.className = 'fieldcards';
  box.innerHTML = `<div class="fchead"><i class="bdg ${badgeCls(G, off.badge % 8)} on"></i><div><b>${esc(rewardBadgeName(off.badge))} Badge</b>
      <span>Choose one reward to keep for the rest of the run.${left > 1 ? ` <b>${left - 1} more</b> after this.` : ''}</span></div></div>
    <div class="fcrow">${off.options.map(id => { const r = rewardById(id), taken = timesTaken(G, id), max = TUNING.badgeRewards[id].max;
      return `<button class="rcard fcard" data-r="${id}"><span class="ricon">${r.icon}</span><b>${esc(r.name)}</b><span class="rtext">${esc(r.text())}</span>${
        r.now && r.now(G) ? `<span class="rnow">${esc(r.now(G))}</span>` : ''}${taken ? `<span class="rtaken">taken ${taken} of ${max}</span>` : ''}</button>`; }).join('')}</div>`;
  S.el.appendChild(box);
  const E = S.el.getBoundingClientRect(), bx = box.getBoundingClientRect();
  let ox = 0, oy = 0;
  if(L && L.w.isConnected){ const lw = L.w.getBoundingClientRect(); ox = lw.left + lw.width / 2 - (bx.left + bx.width / 2); oy = lw.top + lw.height * .45 - (bx.top + bx.height / 2);
  }   // 5.3.10 iron-out: the cards' own header says it; a bubble only collided with it
  const ms = walkPace();
  anim(box.querySelector('.fchead'), [{ opacity: 0, transform: 'translateY(-10px)' }, { opacity: 1, transform: 'none' }], { duration: 300 * ms, delay: 250 * ms, fill: 'both' });
  box.querySelectorAll('.fcard').forEach((c, k) => {
    anim(c, [{ opacity: 0, transform: `translate(${ox}px,${oy}px) scale(.2) rotate(${(k - 1) * 18}deg)` }, { opacity: 1, transform: 'none' }],
      { duration: 480 * ms, delay: (120 + k * 110) * ms, easing: 'cubic-bezier(.2,.9,.3,1.15)', fill: 'both' });
    c.onclick = ev => {
      ev.stopPropagation();
      if(box.dataset.done) return;
      const r = chooseReward(G, c.dataset.r);
      if(!r.ok){ fail(r.why); return; }
      box.dataset.done = '1';
      save(); SFX.play('levelup');
      c.classList.add('picked');
      box.querySelectorAll('.fcard').forEach(o => { if(o !== c) anim(o, [{ opacity: 1 }, { opacity: 0, transform: 'scale(.85)' }], { duration: 260, fill: 'forwards' }); });
      const cb = c.getBoundingClientRect(), tx = E.left + E.width / 2, ty = E.top + E.height * (S.el.classList.contains('vert') ? .78 : .5);
      const tdx = S.el.classList.contains('vert') ? tx - (cb.left + cb.width / 2) : E.left + E.width * .25 - (cb.left + cb.width / 2);
      const tdy = S.el.classList.contains('vert') ? ty - (cb.top + cb.height / 2) : 0;
      anim(c, [{ transform: 'none' }, { transform: 'scale(1.12)', offset: .3 }, { transform: `translate(${tdx}px,${tdy}px) scale(.3)`, opacity: 0 }], { duration: 900, easing: 'cubic-bezier(.4,0,.3,1)', fill: 'forwards' });
      const msg = r.gift ? `Gift Item: a ${HELD_ITEMS[r.gift].name} is in your Bag.` : `${rewardById(r.id).name}: ${rewardById(r.id).text()}`;
      setTimeout(() => { if(pendingOffer(G)) showFieldCards(S, L); else { box.remove(); leaveField(msg); } }, 1000);
    };
  });
}
function playIntro(S){
  const b = battle, still = motionOff();
  const wo = walkOut(S, b);
  const introMs = still ? 700 : speed >= 4 ? 750 : speed >= 2 ? 1250 : 1900;
  const lead = wo ? wo.total : 0;                // 5.0.0: the banner waits for the walk-out
  const who = b.kind === 'gym' ? `${b.boss.name} wants to battle!`
    : b.kind === 'elite' ? `Elite Four ${b.boss.name} wants to battle!`
    : b.kind === 'champion' ? `Champion ${b.boss.name} wants to battle!`
    : b.kind === 'rival' ? `Your rival ${rivalOf(G).name} blocks the way!`
    : b.kind === 'red' ? `${b.boss.name} wants to battle!`
    : `${b.oppName} wants to battle!`;
  const sub = b.kind === 'gym' ? `${b.boss.title} · ${b.boss.badge} Badge`
    : b.kind === 'rival' ? 'An ambush!' : b.kind === 'red' ? `${b.boss.place} · the secret battle` : b.exhibition ? 'Exhibition match' : b.kind === 'trainer' ? 'Trainer battle' : b.boss ? b.boss.title : '';
  const n = (b.steps[0] && b.steps[0].e.length) || 0;
  const balls = Array.from({ length: TUNING.maxTeam }, (_, k) => `<i class="${k < n ? '' : 'out'}"></i>`).join('');
  const ban = document.createElement('div');
  ban.className = 'introban' + (b.kind !== 'trainer' && b.boss ? ' boss ' + b.kind : '');
  ban.innerHTML = `${bossArt(b.boss, 'intro')}<div><b>${esc(who)}</b><span>${esc(sub)}</span><div class="iballs">${balls}</div></div>`;
  S.el.appendChild(ban);
  const sting = () => { if(b.kind === 'rival'){ SFX.play('alert'); setTimeout(() => SFX.play('encounter'), 200); } else SFX.play('encounter'); };
  if(still){ sting(); setTimeout(() => ban.remove(), introMs); return introMs; }
  sting();                                       // the sting plays as the boss walks out
  const hold = introMs * 0.72;
  anim(ban, [{ transform: 'translate(-110%,-50%)', opacity: 0, easing: 'cubic-bezier(.2,.8,.3,1)' },
             { transform: 'translate(0,-50%)', opacity: 1, offset: .15 },
             { transform: 'translate(0,-50%)', opacity: 1, offset: .86, easing: 'ease-in' }, { transform: 'translate(110%,-50%)', opacity: 0 }],
    { duration: hold, delay: lead, fill: 'both', remove: true });
  let k = 0;
  for(const F of S.f.values()){
    if(b.camIn && F.side === 'p') continue;      // 5.0.0: the camera already has your side in place
    const mv = F.el.querySelector('.fmove'), sh = F.el.querySelector('.fshadow');
    // 5.2.0: no shadow waiting on an empty spot — it comes with the pokémon
    const arrive = wo && F.side === 'e' ? wo.popAt : lead + hold * 0.5 + (k % 6) * introMs * 0.035;
    F.el.classList.add('incoming'); setTimeout(() => F.el.classList.remove('incoming'), arrive + 60);
    if(wo && F.side === 'e'){                    // 5.0.0: thrown out by the leader — they appear in the flash
      anim(mv, [{ transform: 'scale(.15)', opacity: 0, filter: 'brightness(4)' }, { transform: 'scale(1.08)', opacity: 1, filter: 'brightness(2)', offset: .6 }, { transform: 'scale(1)', opacity: 1, filter: 'none' }],
        { duration: 380 * (speed >= 4 ? .45 : speed >= 2 ? .7 : 1), delay: wo.popAt, easing: 'ease-out', fill: 'backwards' });
      if(sh) anim(sh, [{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: wo.popAt, fill: 'backwards' });
      continue;
    }
    const v = isVert(F.el), from = v ? (F.side === 'p' ? 'translateY(40vh)' : 'translateY(-40vh)') : (F.side === 'p' ? 'translateX(-60vw)' : 'translateX(60vw)');
    anim(mv, [{ transform: from, opacity: 0 }, { transform: 'translate(0,0)', opacity: 1 }],
      { duration: introMs * 0.3, delay: lead + hold * 0.5 + (k++ % 6) * introMs * 0.035, easing: 'cubic-bezier(.2,.9,.3,1.1)', fill: 'backwards' });
    if(sh) anim(sh, [{ opacity: 0 }, { opacity: 1 }], { duration: introMs * 0.3, delay: lead + hold * 0.5, fill: 'backwards' });
  }
  return introMs + lead;
}
function stageOutro(S){
  if(!battle || battle.stage !== S || motionOff()) return;
  const r = battle.result;
  if(r !== 'win' && r !== 'lose') return;
  const side = r === 'win' ? 'p' : 'e';
  let k = 0;
  for(const F of S.f.values()){
    if(F.down || F.side !== side) continue;
    const el = S.table ? F.el.querySelector('.fart') : F.el.querySelector('.fmove');   // 4.15.0: on the stadium the pokémon itself hops up
    anim(el, S.table ? [{ translate: '0 0' }, { translate: '0 -14px', offset: .25 }, { translate: '0 0', offset: .5 }, { translate: '0 -9px', offset: .72 }, { translate: '0 0' }]
      : [{ transform: 'translateY(0)' }, { transform: 'translateY(-14px)', offset: .25 },
      { transform: 'translateY(0)', offset: .5 }, { transform: 'translateY(-9px)', offset: .72 }, { transform: 'translateY(0)' }],
      { duration: 900, delay: k++ * 90, easing: 'ease-out' });
  }
  const later = (fn, t) => setTimeout(() => { if(battle && battle.stage === S) fn(S); }, t * walkPace());
  if(r === 'win' && battle.newFloor) later(S2 => fieldBanner(S2, battle.newFloor), 500);   // 5.5.0
  if(r === 'win' && battle.boss && ['gym', 'elite', 'champion', 'red'].includes(battle.kind)){ victorySweep(S); later(bossOutro, 1300); }
  else if(r === 'win'){ crowdReact(S, true); if(battle.kind === 'rival') later(bossOutro, 900); }
  else if(battle.boss) later(bossOutro, 900);           // 5.3.0: and when you lose, they gloat
}

/* ---------------- the chrome around the field, patched per step ---------- */
function patchBattleChrome(){
  const st = battle.steps[battle.i] || {};
  const q = document.getElementById('bqueue'); if(q) q.innerHTML = battleQueueHtml(st);
  const lg = $('#blog'); if(lg){ lg.innerHTML = battleLogHtml(); lg.scrollTop = lg.scrollHeight; }
  const n = document.querySelector('.shopbar .steps'); if(n) n.textContent = `${battle.i + 1}/${battle.steps.length}`;
  const am = document.querySelector('.ambush.pop'); if(am && battle.i >= 1) am.classList.remove('pop');
}

/* ===================================================================
   v36 · SHOP POLISH
   The shop is redrawn on every tap, so it can't animate by itself. After each
   draw this compares what is on screen now with the last draw and gives the
   differences a moment: a new pokémon lands with a pokéball flash, a level-up
   or evolution glows and says so, money ticks, and a fresh Daycare or Mart
   deals its cards in. A tap that changes nothing animates nothing.
   =================================================================== */
let shopMem = null;
let shopSfx = false;   // v47: did this draw make a sound of its own?
function shopFloat(el, text, cls){
  if(!el) return;
  const r = el.getBoundingClientRect();
  const e = document.createElement('div');
  e.className = 'sfloat ' + (cls || '');
  if(/<i class="si/.test(text)) e.innerHTML = text; else e.textContent = text;   // 5.7.0: stat icons in the growth pop-up
  const slot = el.closest && el.closest('.pfield .slot');
  if(slot){   // 5.3.9: follows the party spot every frame, so it stays over the pokémon while the field settles (and survives redraws)
    const sel = `.pfield .slot[data-i="${slot.dataset.i}"] .artwrap`;
    document.body.appendChild(e);
    const follow = () => { if(!e.isConnected) return; const a = document.querySelector(sel);
      if(a){ const q = a.getBoundingClientRect(); e.style.left = (q.left + q.width / 2 + window.scrollX) + 'px'; e.style.top = (q.top + window.scrollY - 44) + 'px'; }   // above the stats line
      requestAnimationFrame(follow); };
    follow();
  } else {
    e.style.left = (r.left + r.width / 2 + window.scrollX) + 'px';
    e.style.top = (r.top + window.scrollY + Math.min(18, r.height * 0.25)) + 'px';
    document.body.appendChild(e);
  }
  const still = motionOff();
  anim(e, still ? [{ opacity: 0 }, { opacity: 1, offset: .15 }, { opacity: 1, offset: .75 }, { opacity: 0 }]
    : [{ opacity: 0, transform: 'translate(-50%,0) scale(.7)' }, { opacity: 1, transform: 'translate(-50%,-14px) scale(1.1)', offset: .2 },
       { opacity: 1, transform: 'translate(-50%,-26px) scale(1)', offset: .7 }, { opacity: 0, transform: 'translate(-50%,-40px)' }],
    { duration: 1300, easing: 'ease-out', remove: true });
}
function shopFx(){
  if(!G || phase !== 'shop') return;
  const rec = u => ({ id: u.id, lvl: unitLevel(u), exp: u.exp || 0, st: { hp: u.hp, atk: u.atk, spd: u.spd } });
  const now = {
    seed: G.seed, credits: G.credits,
    mon: new Map([...G.team, ...G.pc].map(u => [u.uid, rec(u)])),
    dc: G.daycare.map(s => s && s.unit ? s.unit.uid : '-').join(','),
    mart: G.mart.map(m => m.id).join(','),
    martIds: G.mart.map(m => m && !m.bought ? m.id : null),
  };
  const was = shopMem;
  shopMem = now;
  if(!was || was.seed !== now.seed) return;          // first draw of a run: nothing to celebrate
  const snd = new Set();
  const cardOf = u => Number.isInteger(u.box) && G.pc.includes(u)
    ? document.querySelector(`.cell[data-act="pc"][data-i="${u.box}"]`)
    : document.querySelector(`.slot[data-act="team"][data-i="${u.pos}"] .unit`);
  for(const u of [...G.team, ...G.pc]){
    const w = was.mon.get(u.uid), el = cardOf(u);
    if(!el) continue;
    const n = rec(u);
    if(!w){ replay(el, 'fx-land'); snd.add('land'); continue; }
    if(n.id !== w.id){ replay(el, 'fx-evo'); shopFloat(el, `${SPECIES[u.id].name}!`, 'evo'); snd.add('evolve'); }
    else if(n.lvl > w.lvl){ replay(el, 'fx-lvl'); shopFloat(el, `Level ${n.lvl}!`, 'lvl'); snd.add('levelup'); }
    else if(n.exp > w.exp){ replay(el, 'fx-exp'); shopFloat(el, '+EXP', 'exp'); snd.add('up'); }
    if(w.st && n.id === w.id && (n.st.hp > w.st.hp || n.st.atk > w.st.atk || n.st.spd > w.st.spd)) triGrow(el, w.st, n.st);   // 5.7.0
    if(n.id !== w.id || n.lvl > w.lvl || n.exp > w.exp){}
    else if(w.st && (n.st.hp > w.st.hp || n.st.atk > w.st.atk || n.st.spd > w.st.spd)){   // 5.3.9: battle EXP grows the stats, so say what grew
      const g = [n.st.atk > w.st.atk ? `<span class="ca">${SI('a')}+${n.st.atk - w.st.atk}</span>` : '', n.st.hp > w.st.hp ? `<span class="ch">${SI('h')}+${n.st.hp - w.st.hp}</span>` : '', n.st.spd > w.st.spd ? `<span class="cs">${SI('s')}+${n.st.spd - w.st.spd}</span>` : ''].filter(Boolean).join(' ');
      replay(el, 'fx-exp'); shopFloat(el, `+EXP ${g}`, 'exp'); snd.add('up'); }
  }
  const dc = now.credits - was.credits;
  if(dc) snd.add(dc > 0 ? 'gain' : 'coin');
  if(now.dc !== was.dc || now.mart !== was.mart) snd.add('deal');
  // one sound per draw, the most important thing that happened
  /* v54: a Rare or Very rare item that has just landed on the shelf sparkles
     (after its row has dealt in) and chimes over the ordinary deal sound. */
  if(now.mart !== was.mart) now.martIds.forEach((id, i) => {
    if(!id || (was.martIds || [])[i] === id) return;
    const slot = G.mart[i], r = rarityOf(defOfSlot(slot));
    if(r !== 'rare' && r !== 'veryrare') return;
    const el = document.querySelector(`.martrow[data-act="mart"][data-i="${i}"]`);
    if(!el) return;
    const k = [...document.querySelectorAll('.martlist .martrow:not(.fixed)')].indexOf(el);
    el.style.setProperty('--sparkdelay', (Math.max(0, k) * 55 + 320) + 'ms');
    replay(el, r === 'veryrare' ? 'fx-vrare' : 'fx-rare');
    snd.add(r === 'veryrare' ? 'sparkle2' : 'sparkle');
  });
  const pick = ['evolve', 'levelup', 'land', 'sparkle2', 'sparkle', 'gain', 'deal', 'coin', 'up'].find(k => snd.has(k));
  if(pick){ SFX.play(pick); shopSfx = true; }
  if(dc){
    const c = document.querySelector('.stat.credits');
    if(c){ replay(c, dc > 0 ? 'fx-gain' : 'fx-spend'); shopFloat(c, `${dc > 0 ? '+' : '−'}${Math.abs(dc)}₽`, dc > 0 ? 'gain' : 'spend'); }
  }
  // a new Daycare / Mart stock deals itself in, card by card
  if(now.dc !== was.dc) document.querySelectorAll('.dclist .drow').forEach((e, k) => {
    replay(e, 'fx-deal'); e.style.animationDelay = (k * 55) + 'ms'; });
  if(now.mart !== was.mart) document.querySelectorAll('.martlist .martrow:not(.fixed)').forEach((e, k) => {
    replay(e, 'fx-deal'); e.style.animationDelay = (k * 55) + 'ms'; });
}

/* ===================================================================
   GAME OVER
   =================================================================== */
/* ===================================================================
   3.7.0 · RUN SUMMARY — what each pokémon did across the whole run, an MVP,
   and a picture of it you can save or send to your friends.
   =================================================================== */
function noteRunStats(b){
  if(!G || !b || !b.sim || !b.sim.stats) return;
  const R = G.runStats || (G.runStats = { battles:0, wins:0, losses:0, mons:{} });
  R.battles++; if(b.result === 'win') R.wins++; else if(b.result === 'lose') R.losses++;
  for(const x of b.sim.stats){
    if(x.side !== 'p') continue;
    const m = R.mons[x.uid] || (R.mons[x.uid] = { id:x.id, dealt:0, taken:0, healed:0, kos:0, fights:0 });
    m.id = x.id; m.dealt += x.dealt || 0; m.taken += x.taken || 0; m.healed += x.healed || 0; m.kos += x.kos || 0; m.fights++;
  }
}
function runTop(n){
  const R = G && G.runStats; if(!R) return [];
  const idNow = uid => { const u = (G.team || []).concat(G.pc || []).find(x => x && x.uid === +uid); return u ? u.id : null; };
  return Object.entries(R.mons).map(([uid, m]) => ({ uid:+uid, ...m, id: idNow(uid) || m.id, score: m.dealt + m.healed + m.kos * 25 }))
    .filter(m => SPECIES[m.id]).sort((a, b) => b.score - a.score).slice(0, n);
}
function runSummaryHtml(){
  const R = G.runStats; const top = runTop(3);
  const plan = runPlan(G), reached = reachedStage();
  const facts = [
    ['Turns', G.turn], ['Badges', `${G.badges}/8`], ['Stage', `${Math.min(reached, plan.length)}/${plan.length}`],
    ...(R ? [['Battles', `${R.wins}W · ${R.losses}L`]] : []), ['Lives left', Math.max(0, G.lives)] ];
  const mvp = top[0];
  return `<div class="runsum">
    <div class="rsfacts">${facts.map(([k, v]) => `<span><b>${esc(String(v))}</b><i>${esc(k)}</i></span>`).join('')}</div>
    ${mvp ? `<div class="rsmvp"><span class="rsart">${SPRITES[mvp.id] ? `<img src="${SPRITES[mvp.id]}" alt="">` : ""}</span><div><i class="rtag rt-mvp">Run MVP</i>
      <b>${esc(SPECIES[mvp.id].name)}</b><span class="dim">${mvp.dealt} damage · ${mvp.kos} KO${mvp.kos === 1 ? '' : 's'}${mvp.healed ? ` · ${mvp.healed} healed` : ''} over ${mvp.fights} battle${mvp.fights === 1 ? '' : 's'}</span></div></div>` : ''}
    ${runNoteHtml(G)}
    ${top.length > 1 ? `<div class="rsrest">${top.slice(1).map((m, k) => `<span>${k === 0 ? '🥈' : '🥉'} ${miniSprite(m.id)}${esc(SPECIES[m.id].name)} <i class="dim">${m.dealt} dmg · ${m.kos} KO</i></span>`).join('')}</div>` : ''}
  </div>`;
}
/* A 3:4 card drawn on a canvas: the team, the result, the MVP. */
async function runImage(){
  try{ if(document.fonts) await Promise.race([document.fonts.load('700 24px "Barlow Condensed"'), new Promise(r => setTimeout(r, 800))]); }catch(e){}
  const W = 720, H = 960, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  const won = G.over === 'won', dark = '#2b303b', cream = '#f7f1de';
  x.fillStyle = cream; x.fillRect(0, 0, W, H);
  x.fillStyle = dark; x.fillRect(0, 0, W, 150); x.fillRect(0, H - 70, W, 70);
  x.strokeStyle = dark; x.lineWidth = 10; x.strokeRect(5, 5, W - 10, H - 10);
  const font = (px, w) => `${w >= 700 || !w ? 500 : 400} ${px}px "Barlow Condensed", Nunito, system-ui, sans-serif`;
  x.textAlign = 'center'; x.fillStyle = '#f0b830'; x.font = font(40); x.fillText('PokéArena', W / 2, 70);
  x.fillStyle = cream; x.font = font(22, 400); x.fillText(G.redResult === 'won' ? `Champion · ${secretBoss().name} defeated` : won ? 'Champion!' : `Run over · ${G.badges} badge${G.badges === 1 ? '' : 's'}`, W / 2, 118);
  x.fillStyle = dark; x.font = font(24); x.fillText(playerName(), W / 2, 205);
  x.font = font(16, 400); x.fillStyle = '#6b6f7a';
  x.fillText(`Turn ${G.turn} · ${G.badges}/8 badges${G.runStats ? ` · ${G.runStats.wins} wins` : ''}${modList(G).length ? ' · ' + modsLabel(G) : ''}`, W / 2, 240);
  const load = src => new Promise(r => { const im = new Image(); im.onload = () => r(im); im.onerror = () => r(null); im.src = src; });
  const team = (G.team || []).filter(Boolean).slice(0, 6);
  if(won && team.length){
    /* 5.3.0: a won run's summary is the team photo from centre field after the Champion */
    const px = 60, py = 262, pw = W - 120, ph = 440;
    for(let k = 0; k < 10; k++){ x.fillStyle = k % 2 ? '#43974a' : '#3a8840'; x.fillRect(px, py + k * ph / 10, pw, ph / 10 + 1); }
    x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = 4; x.beginPath(); x.arc(W / 2, py + ph * .52, 90, 0, Math.PI * 2); x.stroke();
    const g = x.createRadialGradient(W / 2, py + ph * .7, 20, W / 2, py + ph * .6, pw * .6); g.addColorStop(0, 'rgba(255,250,210,.45)'); g.addColorStop(1, 'rgba(255,250,210,0)');
    x.fillStyle = g; x.fillRect(px, py, pw, ph);
    const n = team.length, back = n > 3 ? Math.ceil(n / 2) : n, front = n - back, sz = n > 3 ? 150 : 170, gap = sz * .98;
    const spots = [];
    for(let i = 0; i < back; i++) spots.push({ cx: W / 2 + (i - (back - 1) / 2) * gap, by: py + (front ? ph * .55 : ph * .78) });
    for(let i = 0; i < front; i++) spots.push({ cx: W / 2 + (i - (front - 1) / 2) * gap, by: py + ph * .9 });
    for(let k = 0; k < n; k++){
      const u = team[k], sp = spots[k], im = SPRITES[u.id] ? await load(SPRITES[u.id]) : null;
      x.fillStyle = 'rgba(0,0,0,.28)'; x.beginPath(); x.ellipse(sp.cx, sp.by - 4, sz * .32, 12, 0, 0, Math.PI * 2); x.fill();
      if(im){ const sc = sz * .9 / Math.max(im.width, im.height); const w = Math.round(im.width * sc), h = Math.round(im.height * sc); x.drawImage(im, sp.cx - w / 2, sp.by - h, w, h); }
    }
    x.strokeStyle = '#f0b830'; x.lineWidth = 10; x.strokeRect(px, py, pw, ph);
    x.strokeStyle = dark; x.lineWidth = 4; x.strokeRect(px - 7, py - 7, pw + 14, ph + 14); x.strokeRect(px + 7, py + 7, pw - 14, ph - 14);
    x.fillStyle = dark; x.fillRect(W / 2 - 170, py + ph - 8, 340, 36); x.strokeStyle = '#f0b830'; x.lineWidth = 3; x.strokeRect(W / 2 - 170, py + ph - 8, 340, 36);
    x.fillStyle = '#f0b830'; x.font = font(18); x.fillText(`CHAMPION \u00b7 ${playerName()}`, W / 2, py + ph + 17);
    x.fillStyle = dark; x.font = font(14, 400);
    x.fillText(team.map(u => `${SPECIES[u.id].name}${SPECIES[u.id].legendary ? '' : ' L' + unitLevel(u)}`).join(' \u00b7 '), W / 2, py + ph + 58);
  }
  for(let k = 0; k < (won ? 0 : team.length); k++){
    const u = team[k], col = k % 3, row = Math.floor(k / 3), cx = 130 + col * 230, cy = 290 + row * 230;
    x.fillStyle = '#ece4c8'; x.fillRect(cx - 90, cy, 180, 190); x.strokeStyle = dark; x.lineWidth = 4; x.strokeRect(cx - 90, cy, 180, 190);
    const im = SPRITES[u.id] ? await load(SPRITES[u.id]) : null;
    if(im){ const sc = Math.floor(128 / Math.max(im.width, im.height)) || 1; const w = im.width * sc, h = im.height * sc; x.drawImage(im, cx - w / 2, cy + 12 + (128 - h) / 2, w, h); }
    x.fillStyle = dark; x.font = font(14); x.fillText(SPECIES[u.id].name, cx, cy + 160);
    x.font = font(12, 400); x.fillStyle = '#6b6f7a'; x.fillText(SPECIES[u.id].legendary ? 'Legendary' : `Lv ${unitLevel(u)}`, cx, cy + 180);
  }
  const mvp = runTop(1)[0];
  if(mvp){ x.fillStyle = dark; x.font = font(16); x.fillText(`MVP: ${SPECIES[mvp.id].name} — ${mvp.dealt} damage, ${mvp.kos} KOs`, W / 2, 790); }
  const hasF = G.focus && G.focus.length;
  if(hasF){
    x.font = font(14, 400); x.fillStyle = '#6b6f7a';
    x.fillText('\u2605 Focus: ' + G.focus.map(k => SPECIES[k].name).join(' \u00b7 '), W / 2, G.redResult ? 812 : 822);
    if(!G.redResult){
      const pl = poolLines(G); x.fillText('Open evolutions: ' + pl.slice(0, 2).join(' \u00b7 '), W / 2, 844); if(pl.length > 2) x.fillText(pl.slice(2).join(' \u00b7 '), W / 2, 864);
    }
  }
  if(G.redResult){
    const w = G.redResult === 'won', by = hasF ? 828 : 810;
    x.fillStyle = w ? '#f0b830' : '#ece4c8'; x.fillRect(60, by, W - 120, 38); x.strokeStyle = dark; x.lineWidth = 3; x.strokeRect(60, by, W - 120, 38);
    x.fillStyle = dark; x.font = font(16); x.fillText(w ? `\u26A1 ${secretBoss().name}\u2019s Badge · ${secretBoss().place} cleared` : `Faced ${secretBoss().name} in ${secretBoss().place}`, W / 2, by + 25);
  }
  x.fillStyle = cream; x.font = font(14, 400); x.fillText(`PokéArena ${GAME_VERSION.v}${G.daily ? ' · Daily ' + G.daily : ''}`, W / 2, H - 28);
  return new Promise(r => c.toBlob(r, 'image/png'));
}
let runPhoto = { key: '', url: '' };
async function fillRunPhoto(){
  const key = `${G.seed}|${G.turn}|${G.team.map(u => u.id).join(',')}`;
  if(runPhoto.key !== key){ runPhoto.key = key; runPhoto.url = '';
    try{ const blob = await runImage(); if(blob && runPhoto.key === key) runPhoto.url = URL.createObjectURL(blob); }catch(e){} }
  const im = document.querySelector('#app .runphoto'); if(im && runPhoto.url && im.src !== runPhoto.url) im.src = runPhoto.url;
}
async function shareRunImage(){
  SFX.play('select');
  try{
    const blob = await runImage(); if(!blob) throw new Error('no image');
    const file = new File([blob], 'pokebattler-run.png', { type:'image/png' });
    if(navigator.canShare && navigator.canShare({ files:[file] })){ await navigator.share({ files:[file], title:'My PokéArena run' }); return; }
    // inside the claude.ai viewer a page can only hand over a file through its downloads capability
    if(window.claude && typeof window.claude.use === 'function'){
      const dl = await window.claude.use('downloads').catch(() => null);
      if(dl){ try{ await dl.save({ filename:'pokebattler-run.png', data:blob }); say('Summary image saved.'); }
              catch(e){ if(!e || e.code !== 'declined') say('Couldn’t save the image here.'); } return; }
    }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'pokebattler-run.png';
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    say('Summary image saved.');
  }catch(e){ if(e && e.name === 'AbortError') return; say('Couldn’t make the image on this device.'); }
}

function redOverHtml(){
  const w = G.redResult === 'won', sb = secretBoss(), team = sb.lineup.map(u => SPECIES[u.id].name);
  return `<div class="redend ${w ? 'won' : 'lost'}">${bossArt(sb, 'redart')}
    <div><b>${esc(sb.place)}${w && G.redNew ? ' <i class="newdot">New</i>' : ''}</b>
    <span>${w ? `You beat ${esc(sb.name)} and his whole team: ${team.slice(0, -1).join(', ')} and ${team[team.length - 1]}.${(() => { const h = secretRec(sb.id); return h && !G.redNew ? ` That is ${h.count} in all.` : ''; })()}`
      : sb.id === 'oak' ? 'The professor smiled and sent you home. Nothing was lost.' : 'Red didn\u2019t say a word, and you walked back down. Nothing was lost.'}</span></div>
    ${w ? `<span class="rpika">${miniSprite(sb.id === 'oak' ? 'bulbasaur' : 'pikachu')}</span>${secretBadge(sb.id, 'big')}` : ''}</div>`;
}
function renderOver(){
  const won = G.over === 'won';
  return `<div class="panel" style="text-align:center;padding:26px 18px">
    <div class="big ${won ? 'win':'lose'}">${G.redResult === 'won' ? `${esc(secretBoss().name)} defeated!` : won ? 'Champion!' : 'Run over'}</div>
    ${G.redResult ? redOverHtml() : ''}
    ${won ? '' : `<div class="badgerow">${badgeCase()}</div>`}
    <p style="color:var(--muted)">${won
      ? `All ${G.badges} badges, the Elite Four, the Champion${G.redResult === 'won' ? ` and ${esc(secretBoss().name)}` : ''}, with ${G.lives} ${G.lives===1?'life':'lives'} to spare.`
      : `You ran out of lives on turn ${G.turn} with ${G.badges} badge${G.badges===1?'':'s'}` +
        `${nextUp(G).boss ? `, at ${esc(nextUp(G).boss.name)}` : ''}.`}</p>
    ${won ? `<img class="runphoto" alt="Your team photo from centre field">` : ''}
    ${won ? chalAwardsHtml() : ''}
    ${G.daily ? `<p class="dim">Daily Challenge · ${esc(prettyDate(G.daily))}${modList(G).length ? ` · ${esc(modsLabel(G))}` : ''}</p>` : modList(G).length ? `<p class="dim">Rules: ${esc(modsLabel(G))}</p>` : ''}
    ${runSummaryHtml()}
    <div class="row overteam" style="margin:14px 0">${G.team.map((u, i) => u ? `<div class="slot" style="border-style:solid" data-act="overcard" data-i="${i}" role="button">${unitHtml(u)}</div>` : '').join('')}</div>
    ${duelSaveHtml()}
    <div class="shopbar">
      ${G.daily ? `<button class="btn" data-act="runimage">Save summary image</button>
      <button class="btn" data-act="dailyshare">Copy result</button>
      <button class="btn primary" data-act="totitle">Title screen</button>`
      : `<button class="btn" data-act="runimage">Save summary image</button>
      <button class="btn primary" data-act="restart">New Run</button>`}
    </div>
  </div>`;
}

/* ===================================================================
   RENDER + EVENTS
   =================================================================== */
/* ---- v49: redraw by patching, not replacing -----------------------
   Every tap used to throw the whole screen away and build it again. On a
   phone that means every sprite image is decoded again (they blink), every
   looping bounce restarts, and the browser loses its place on the page — the
   flicker Sean saw. The shop is now patched in place: the new markup is
   parsed off-screen and only nodes that differ are touched, so an image
   whose src hasn't changed is never reloaded. */
function morphSame(a, b){
  if(a.nodeType !== b.nodeType) return false;
  if(a.nodeType !== 1) return true;
  return a.tagName === b.tagName && (a.id || '') === (b.id || '');
}
function morphNode(f, t){
  if(f.nodeType !== 1){ if(f.nodeValue !== t.nodeValue) f.nodeValue = t.nodeValue; return; }
  const fa = f.attributes, ta = t.attributes;
  for(let k = fa.length - 1; k >= 0; k--){ const n = fa[k].name; if(!t.hasAttribute(n)) f.removeAttribute(n); }
  for(let k = 0; k < ta.length; k++){ const { name, value } = ta[k]; if(f.getAttribute(name) !== value) f.setAttribute(name, value); }
  morphKids(f, t);
}
function morphKids(from, to){
  if(from.hasAttribute && from.hasAttribute('data-keep')) return;   // 5.3.7: the field the party stands on lives in here
  let f = from.firstChild, t = to.firstChild;
  while(t){
    const tn = t.nextSibling;
    if(!f){ from.appendChild(t); t = tn; continue; }
    if(morphSame(f, t)){ morphNode(f, t); f = f.nextSibling; t = tn; continue; }
    // one step of look-ahead: something was taken out, or put in
    const fn = f.nextSibling;
    if(fn && morphSame(fn, t) && !(tn && morphSame(f, tn))){ from.removeChild(f); f = fn; continue; }
    if(tn && morphSame(f, tn)){ from.insertBefore(t, f); t = tn; continue; }
    from.replaceChild(t, f); f = t.nextSibling; t = tn;
  }
  while(f){ const fn = f.nextSibling; from.removeChild(f); f = fn; }
}
function morphInto(el, html){
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  morphKids(el, tpl.content);
}
let drawnPhase = null;
/** Put an animation class back on so it plays again, even if the patch just took it off. */
function replay(el, cls){ if(el.classList.contains(cls)){ el.classList.remove(cls); void el.offsetWidth; } el.classList.add(cls); }

function render(){
  { const dc = sel && sel.kind === 'dc' && G && G.daycare && G.daycare[sel.idx], cu = dc && dc.unit;   // 5.7.0
    TRI_CMP = cu ? { a: effAtk(cu), h: effHp(cu), s: effSpd(cu) } : null; TRI_BEST = bestForItem(); TRI_SCALE = triScale(TRI_CMP); }
  if(fieldPicking) return;                   // 5.3.0: the reward cards are up on the field; the shop draws when one is picked
  if(SFX.held && !(battle && battle.paused)) SFX.hold(false);   // 4.17.3: nothing is paused, so nothing should be held
  if(G) useGens(G);   // 4.0.0: the engine follows the run's gens
  if(G) fixSlots(G);   // anything added without a slot gets the first free one
  const app = $('#app');
  document.body.dataset.phase = phase;   // 5.0.0: the wide layout is for the shop only
  document.body.classList.toggle('picking', !!sel);   // 5.12.1: set before the redraw (not after), so the page is measured in its final layout
  document.body.classList.toggle('inspecting', !!inspect);   // 5.3.1: a phone on its side opens the info box only when there is something in it
  const html = (phase === 'battle' ? renderBattle() : phase === 'over' ? renderOver() : renderShop() + toastHtml()) + versionTag();
  /* 4.9.1: Safari has no scroll anchoring, so a panel growing above what you are looking at (the message box on a
     tap) shoved the whole page down. Remember the first thing on screen and put it back where it was. */
  const anchor = phase === 'shop' && drawnPhase === 'shop' && window.scrollY > 0 ? (() => {
    for(const e of app.querySelectorAll('[data-act][data-i], .panel > h2')){
      const r = e.getBoundingClientRect(); if(r.top >= 0 && r.top < innerHeight - 100 && r.height > 0 && !e.closest('.dock,.speech'))
        return { el: e, sel: e.matches('h2') ? null : `[data-act="${e.dataset.act}"][data-i="${e.dataset.i}"]`, h: e.matches('h2') ? e.textContent.trim().slice(0, 12) : null, top: r.top }; }
    return null; })() : null;
  if(phase === 'shop' && drawnPhase === 'shop' && app.firstChild) morphInto(app, html);   // v49
  else app.innerHTML = html;
  if(anchor){
    /* 5.12.1: the same element if the redraw kept it (it usually does); otherwise the first match outside the field and the bars,
       since a picked pokémon adds look-alike targets there and the page used to jump to them */
    const e = anchor.el && anchor.el.isConnected ? anchor.el
      : anchor.sel ? [...app.querySelectorAll(anchor.sel)].find(x => !x.closest('.dock,.speech,.ctxbar,.pfield')) : [...app.querySelectorAll('.panel > h2')].find(x => x.textContent.trim().slice(0, 12) === anchor.h);
    if(e){ const d = e.getBoundingClientRect().top - anchor.top; if(Math.abs(d) > 1) window.scrollBy(0, d); } }
  drawnPhase = phase;
  const lg = $('#blog'); if(lg) lg.scrollTop = lg.scrollHeight;
  if(phase === 'battle') mountStage();       // v36: the kept arena goes back in
  else shopFx();                             // v36: what changed since the last draw gets a little life
  if(phase === 'shop') typeInspect();        // v37: the message box types itself out
  updateCarry();
  layoutWorld();
  if(phase === 'over' && G && G.over === 'won') fillRunPhoto();   // 5.3.0: the Champion photo, on the run's last screen too                             // 5.0.0: the stadium behind the page follows what was drawn
}
const selRef = () => !sel ? null : sel.kind === 'team' ? `team:${sel.idx}` : sel.kind === 'pc' ? `pc:${sel.idx}`
  : sel.kind === 'dc' ? `dc:${sel.idx}` : null;
/* v47: something that didn't work buzzes as well as saying why */
function fail(msg){ SFX.play('error'); say(msg); }
function say(msg){ toast = msg; render(); setTimeout(() => {
  if(toast === msg){ toast = ''; render(); }
  else if(!toast){ const t = document.querySelector('#app .toastbox'); if(t) t.remove(); }   // v49: a tap cleared it without a redraw
}, 1900); }

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if(!el) return;
  const act = el.dataset.act;
  pendingUndo = { act, before: G && phase === 'shop' ? JSON.stringify(G) : null, c0: G ? G.credits : 0, done: false };
  handle(act, el.dataset.i !== undefined ? +el.dataset.i : null, el.dataset);
  // usually the action's own redraw already settled it; if nothing redrew, settle and redraw once
  if(pendingUndo && !pendingUndo.done && settleUndo()) render();
  pendingUndo = null;
});

/* ---- 2.0.0 · UNDO LAST BUY ------------------------------------------
   One per shop turn. A buy (a pokémon, an item, an X item, a legendary)
   leaves a snapshot of the run from just before it; Undo puts that back, so
   the ₽ come back and the shelves are as they were. Anything else that
   changes the run (a reroll, a sale, a move) clears it — undo is for the
   tap you just made, not a way to rewind. */
let undo = null, pendingUndo = null;
const BUY_ACTS = new Set(['team', 'pc', 'buyheld', 'usex', 'legend']);
/* Decide what the tap just did, once. It runs during the action's own redraw
   (so the Undo button appears in the same frame and no second redraw wipes
   the buy's little animations). Returns whether the undo state changed. */
function settleUndo(){
  const p = pendingUndo; if(!p || p.done) return false;
  p.done = true;
  if(p.act === 'undo' || p.before === null) return false;
  if(!G || phase !== 'shop'){ const had = !!undo; undo = null; return had; }
  const now = JSON.stringify(G);
  if(now === p.before) return false;
  if(BUY_ACTS.has(p.act) && G.credits < p.c0){
    const last = (G.log || [])[G.log.length - 1] || '';
    const m = last.match(/^(?:Bought|Used) ([^.]+?)(?: for \d+₽)?\.$/);
    undo = { snap: p.before, turn: G.turn, cost: p.c0 - G.credits, label: m ? m[1] : 'your last buy' };
    return true;
  }
  const had = !!undo; undo = null; return had;
}
const undoReady = () => !!(undo && G && undo.turn === G.turn && G.undoTurn !== G.turn && phase === 'shop' && !inGauntlet(G));
function undoHtml(closed){
  if(pendingUndo && !pendingUndo.done) settleUndo();
  if(closed || !undoReady()) return '';
  return `<button class="btn undo" data-act="undo" title="One undo per turn">↶ Undo ${esc(undo.label)} <span class="dim">+${undo.cost}₽</span></button>`;
}

/* ---- 2.0.0 · BATTLE RECAP -------------------------------------------
   Who pulled their weight: damage dealt and taken, healing given and
   knockouts, for your side, with the standouts called out. */
function recapHtml(){
  const all = battle && battle.sim && battle.sim.stats;
  if(!all) return '';
  const mine = all.filter(x => x.side === 'p');
  if(!mine.length) return '';
  const top = k => { const m = Math.max(...mine.map(x => x[k])); return m > 0 ? mine.find(x => x[k] === m).uid : null; };
  const mvp = top('dealt'), wall = top('taken'), medic = top('healed');
  const maxD = Math.max(1, ...mine.map(x => x.dealt)), maxT = Math.max(1, ...mine.map(x => x.taken));
  const rows = mine.slice().sort((a, b) => b.dealt - a.dealt).map(x => {
    const tags = [x.uid === mvp ? '<i class="rtag rt-mvp">MVP</i>' : '', x.uid === wall ? '<i class="rtag rt-wall">Wall</i>' : '', x.uid === medic ? '<i class="rtag rt-medic">Medic</i>' : ''].join('');
    return `<div class="rrow ${x.fainted ? 'down' : ''}"><span class="rname">${miniSprite(x.id)}${esc(SPECIES[x.id].name)}${tags}</span>
      <span class="rbar dealt" title="damage dealt"><u style="width:${Math.round(x.dealt / maxD * 100)}%"></u><b>${x.dealt}</b></span>
      <span class="rbar taken" title="damage taken"><u style="width:${Math.round(x.taken / maxT * 100)}%"></u><b>${x.taken}</b></span>
      <span class="rnum" title="healing given">${x.healed ? '+' + x.healed : '—'}</span><span class="rnum" title="knockouts">${x.kos || '—'}</span></div>`; }).join('');
  return `<details class="panel recap" open><summary><b>Battle recap</b> <span class="dim">damage dealt · taken · healing · KOs</span></summary>
    <div class="rhead"><span></span><span>Dealt</span><span>Taken</span><span>Heal</span><span>KO</span></div>${rows}</details>`;
}

/* ---- 2.0.0 · MODE BAR --------------------------------------------- */
function modeBarHtml(){
  const bits = [];
  if(G.daily) bits.push(`<b>Daily Challenge</b> · ${esc(prettyDate(G.daily))}`);
  for(const k of modList(G)) bits.push(`<span class="modechip" title="${esc(modText(G, k))}">${esc(modName(G, k))}</span>`);
  return bits.length ? `<div class="modebar">${bits.join(' ')}</div>` : '';
}

/* ---- 2.0.0 · LEGENDARY ENCOUNTER ------------------------------------ */
let encounterSeen = null;
function encounterHtml(){
  if(!encounterOpen(G)) return '';
  const e = G.encounter, sp = SPECIES[e.id];
  const u = trainerCatchUp(G, makeUnit(e.id, 0));         // what it would arrive as
  if(encounterSeen !== G.seed + ':' + e.id){ encounterSeen = G.seed + ':' + e.id; setTimeout(() => SFX.play('alert'), 60); setTimeout(() => legendBanner(e.id), 250); }
  const can = G.credits >= e.cost;
  return `<section class="panel legend">
    <div class="legart" style="--tcol:${typeColor(e.id)}">${SPRITES[e.id] ? `<img src="${SPRITES[e.id]}" alt="">` : ''}</div>
    <div class="legtext"><b>A wild ${esc(sp.name)} appeared!</b>
      <span><span class="poptype" style="background:${typeColor(e.id)}">${esc(sp.type)}</span> ${roleChip(e.id)} <i class="rar r-veryrare">Legendary</i></span>
      <span class="legstats">${statTri(u.atk, u.hp, u.spd)}<span class="dim"><span class="ca">${SI('a')}${u.atk}</span> <span class="ch">${SI('h')}${u.hp}</span> <span class="cs">${SI('s')}${u.spd}</span> · never levels, grows +${Math.round((TUNING.legend.growth - 1) * 100)}%<br>yours to keep once recruited · the offer ends at your next battle</span></span></div>
    <div class="legbtns"><button class="btn primary" data-act="legend" ${can ? '' : 'disabled'}>Recruit ${e.cost}₽</button>
      <button class="btn ghost" data-act="legendpass">Let it go</button></div>
  </section>`;
}

/** 5.11.0: the legendary walks onto your field from the far side, stops in a flash, then steps away into its card. */
function legendWalkIn(id){
  if(motionOff() || fxLevel() === 'off' || !SPRITES[id]) return;
  const f = document.querySelector('.pfield'); if(!f) return;
  const r = f.getBoundingClientRect(); if(r.width < 40 || r.bottom < 0 || r.top > innerHeight) return;
  const size = Math.round(Math.min(150, Math.max(72, r.width * .28)));
  const x = r.left + r.width * .5, y = Math.min(innerHeight - size * .3, Math.max(size, r.top + r.height * .62));
  const w = document.createElement('div'); w.className = 'legwalk';
  w.style.cssText = `left:${x}px;top:${y}px;width:${size}px;height:${size}px`;
  w.innerHTML = `<i class="lwglow"></i><img src="${SPRITES[id]}" alt=""><i class="lwshadow"></i>`;
  document.body.appendChild(w);
  const from = `translate(-50%,-100%) translateX(${Math.max(0, Math.round(innerWidth - x - size / 2 - 4))}px)`, at = 'translate(-50%,-100%)';   // from the screen's right edge, never past it
  anim(w, [{ transform: from, opacity: 0 }, { transform: from, opacity: 1, offset: .06 }, { transform: at, opacity: 1, offset: .32 }, { transform: at, opacity: 1, offset: .78 }, { transform: 'translate(-50%,-100%) scale(.4)', opacity: 0 }],
    { duration: 3400, easing: 'ease-out', fill: 'both', remove: true });
  anim(w.querySelector('img'), [{ translate: '0 0' }, { translate: '0 -6%' }, { translate: '0 0' }], { duration: 260, iterations: 4, easing: 'ease-in-out' });
  anim(w.querySelector('.lwglow'), [{ opacity: 0, transform: 'scale(.3)' }, { opacity: 0, transform: 'scale(.3)', offset: .3 }, { opacity: 1, transform: 'scale(1.3)', offset: .38 }, { opacity: .55, transform: 'scale(1)', offset: .7 }, { opacity: 0 }],
    { duration: 3400, fill: 'both' });
  setTimeout(() => SFX.play('land'), 1100);
}
/** 5.10.1: a legendary arriving gets a moment on screen, so it can't be missed. */
function legendBanner(id){
  if(!G || phase !== 'shop' || !encounterOpen(G)) return;
  const d = document.createElement('div'); d.className = 'legban';
  d.innerHTML = `${SPRITES[id] ? `<img src="${SPRITES[id]}" alt="">` : ''}<div><small>✦ Legendary encounter</small><b>A wild ${esc(SPECIES[id].name)} appeared!</b></div>`;
  document.body.appendChild(d);
  legendWalkIn(id);
  anim(d, [{ opacity: 0, transform: 'translate(-50%,-50%) scale(.7)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1.04)', offset: .12 }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: .2 },
    { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: .85 }, { opacity: 0, transform: 'translate(-50%,-60%) scale(.96)' }], { duration: motionOff() ? 2200 : 2800, easing: 'ease-out', fill: 'both', remove: true });
  SFX.play('sparkle');
}
/* ---- 2.0.0 · FORMATION PRESETS ---------------------------------------- */
function openPresets(){
  G.presets = G.presets || [null, null, null];
  const owned = uid => G.team.find(u => u.uid === uid);
  const slotHtml = (p, k) => {
    const units = p ? Object.keys(p).map(Number).map(owned).filter(Boolean) : [];
    return `<div class="preset"><b>Formation ${k + 1}</b>
      <div class="pmons">${p ? (units.length ? units.sort((a, b) => p[a.uid] - p[b.uid]).map(u => miniSprite(u.id)).join('') : '<span class="dim">nobody from it is in your party</span>') : '<span class="dim">empty</span>'}</div>
      <div class="btnrow"><button class="btn" data-p="save" data-k="${k}">Save current</button><button class="btn primary" data-p="use" data-k="${k}" ${units.length ? '' : 'disabled'}>Use</button></div></div>`;
  };
  const d = modal(`<h3>Formations</h3><p class="dim">Save where everyone stands, then snap back to it after you rearrange. Pokémon that aren’t in a formation keep a free spot.</p>
    <div class="presets">${G.presets.map(slotHtml).join('')}</div>
    <div class="btnrow"><button class="btn ghost" data-p="close">Close</button></div>`);
  d.classList.add('presetsm');
  d.querySelectorAll('[data-p]').forEach(b => b.onclick = () => {
    const k = +b.dataset.k;
    if(b.dataset.p === 'close'){ d.remove(); return; }
    if(b.dataset.p === 'save'){ G.presets[k] = Object.fromEntries(G.team.map(u => [u.uid, u.pos])); save(); d.remove(); SFX.play('select'); say(`Formation ${k + 1} saved.`); return; }
    if(b.dataset.p === 'use'){ applyPreset(G.presets[k]); save(); d.remove(); SFX.play('select'); say(`Formation ${k + 1} set.`); }
  });
}
function applyPreset(p){
  if(!p) return;
  const want = G.team.filter(u => p[u.uid] != null), rest = G.team.filter(u => p[u.uid] == null);
  const used = new Set();
  for(const u of want){ u.pos = p[u.uid]; used.add(u.pos); }
  for(const u of rest){ if(used.has(u.pos)){ let q = 0; while(used.has(q)) q++; u.pos = q; } used.add(u.pos); }
  fixSlots(G);
}

/* ---- 2.0.0 · NEW RUN (with rules) ------------------------------------- */
function openNewRun(onStart){
  const cur = mainRun();
  const live = cur && !cur.over && ((cur.stage || 0) > 0 || cur.turn > 1);
  const pick = { mono: null, nopc: false, rich: false, onelife: false, secrets: false, ticket: null, noitems: false, nolegend: false, hardgyms: false, tight: false };
  const lastGens = cleanGens(String(PREF.get('gens', '1')).split(',').map(Number)).filter(n => GENS_READY.includes(n));
  let gens = lastGens.length ? lastGens : [1];   // 4.0.0: remembered from your last run
  const allTypes = Object.keys(TYPES);
  const d = modal(`<h3>New run</h3>
    ${live ? `<p class="warn">This ends your current run (turn ${cur.turn} · ${cur.badges} badge${cur.badges === 1 ? '' : 's'}).</p>` : ''}
    <h4>Generations <span class="dim">pick one or more</span></h4>
    <div class="gens">${Object.keys(GENS).map(Number).map(n => `<button class="gent" data-gen="${n}" ${GENS_READY.includes(n) ? '' : 'disabled'}>
      <b>${esc(GENS[n].name)}</b><span>${esc(GENS[n].region)}${GENS_READY.includes(n) ? '' : ' · coming soon'}</span></button>`).join('')}</div>
    <p class="dim gennote"></p>
    <h4>Rules <span class="dim">optional</span></h4>
    <div class="mods">
      <button class="modt" data-mod="mono"><b>${chalBadge('mono', 'sm')}Mono-type</b><span>Pick a type: the Daycare sells only that type. Opponents are tuned so every type is about as hard. Clear it for the Mono Badge.</span></button>
      <div class="monotypes" hidden>${allTypes.map(t => `<button class="ntype" data-type="${t}" style="--c:${TYPES[t].color}">${t}</button>`).join('')}</div>
      <button class="modt" data-mod="secrets"><b>${esc(MOD_INFO.secrets.name())}</b><span>${esc(MOD_INFO.secrets.text())}<em class="gneed"></em></span></button>
      <button class="modt" data-mod="rich"><b>${esc(MOD_INFO.rich.name())}</b><span>${esc(MOD_INFO.rich.text())}</span></button>
    </div>
    <h4>Challenges <span class="dim">a badge each</span></h4>
    <div class="mods">
      ${['onelife', 'nopc', ...HANDICAPS].map(k => `<button class="modt" data-mod="${k}"><b>${chalBadge(k, 'sm')}${esc(MOD_INFO[k].name())}</b><span>${esc(MOD_INFO[k].text())} Clear it for the ${esc(chalById(k).name)}.</span></button>`).join('')}
    </div>
    <p class="dim chgold"></p>
    <p class="dim">Runs with rules keep their own records on your Trainer card.</p>
    ${['red', 'oak', 'steven'].some(id => ticketCount(id)) ? `<h4>Secret Boss Ticket <span class="dim">one try, this run only</span></h4><div class="mods">
      ${['red', 'oak', 'steven'].filter(id => ticketCount(id)).map(id => `<button class="modt" data-tkt="${id}"><b>\uD83C\uDFAB ${SECRETS[id].name} \u00d7${ticketCount(id)}</b><span>${SECRETS[id].name} waits at ${esc(SECRETS[id].place)} after the Champion. Needs ${esc(GENS[SECRETS[id].gen].name)} in the run.</span></button>`).join('')}</div>` : ''}
    <div class="btnrow"><button class="btn primary" data-n="go">Start run</button><button class="btn ghost" data-n="close">Cancel</button></div>`);
  d.classList.add('newrun');
  const types$ = d.querySelector('.monotypes'), go = d.querySelector('[data-n="go"]');
  const note = d.querySelector('.gennote');
  const sync = () => {
    const types = monoTypesFor(gens);
    if(pick.mono && !types.includes(pick.mono)) pick.mono = null;
    d.querySelectorAll('.gent').forEach(b => b.classList.toggle('on', gens.includes(+b.dataset.gen)));
    d.querySelectorAll('.ntype').forEach(b => b.hidden = !types.includes(b.dataset.type));
    note.textContent = gens.length > 1 ? `8 of the ${gens.length * 8} gym leaders and 4 of the Elite Four are drawn and shuffled; each is scaled to the slot they land in. Each run also draws 3 Focus lines the Daycare shows more often, and 4 open cross-gen evolutions.`
      : `${GENS[gens[0]].region}: its own gym leaders, Elite Four and Champion.`;
    const gOk = gens.includes(1) && gens.includes(2) && ticketCount('red') > 0 && ticketCount('oak') > 0;
    if(pick.secrets && !gOk) pick.secrets = false;
    const gb = d.querySelector('[data-mod="secrets"]'); gb.classList.toggle('off', !gOk);
    gb.querySelector('.gneed').textContent = gOk ? '' : ` Locked: ${!(gens.includes(1) && gens.includes(2)) ? 'turn on Gen 1 and Gen 2' : 'needs a Red ticket and an Oak ticket'}.`;
    if(pick.secrets) pick.ticket = null;
    if(pick.ticket && !gens.includes(SECRETS[pick.ticket].gen)) pick.ticket = null;
    d.querySelectorAll('[data-tkt]').forEach(b => { const ok = gens.includes(SECRETS[b.dataset.tkt].gen); b.classList.toggle('on', pick.ticket === b.dataset.tkt); b.classList.toggle('off', !ok); b.setAttribute('aria-disabled', ok ? 'false' : 'true'); });
    d.querySelectorAll('.modt:not([data-tkt])').forEach(b => b.classList.toggle('on', b.dataset.mod === 'mono' ? !!pick.mono || !types$.hidden : !!pick[b.dataset.mod]));
    d.querySelectorAll('.ntype').forEach(b => b.classList.toggle('on', b.dataset.type === pick.mono));
    const nCh = chalActive({ mods: pick }).length, cg = d.querySelector('.chgold');   // 4.12.0
    cg.innerHTML = nCh >= GOLD_AT ? `<b class="gtxt">\u2605 Gold run:</b> ${nCh} challenges on. Clear it and every one of their badges turns gold.`
      : `Turn on ${GOLD_AT} or more challenges (Mono counts) and a clear earns the gold version of each badge.${nCh ? ` ${nCh} on now.` : ''}`;
    go.disabled = !types$.hidden && !pick.mono;
    go.textContent = go.disabled ? 'Pick a type' : 'Start run';
  };
  d.querySelectorAll('.modt:not([data-tkt])').forEach(b => b.onclick = () => {
    const k = b.dataset.mod; SFX.play('tap');
    if(k === 'secrets' && b.classList.contains('off')){ say(b.querySelector('.gneed').textContent.trim()); return; }
    if(k === 'mono'){ if(types$.hidden){ types$.hidden = false; } else { types$.hidden = true; pick.mono = null; } }
    else pick[k] = !pick[k];
    sync();
  });
  d.querySelectorAll('[data-tkt]').forEach(b => b.onclick = () => {
    const id = b.dataset.tkt; SFX.play('tap');
    if(!gens.includes(SECRETS[id].gen)){ say(`${SECRETS[id].name} needs ${GENS[SECRETS[id].gen].name} in the run.`); return; }
    pick.ticket = pick.ticket === id ? null : id; if(pick.ticket) pick.secrets = false; sync();
  });
  d.querySelectorAll('.ntype').forEach(b => b.onclick = () => { pick.mono = b.dataset.type; SFX.play('tap'); sync(); });
  d.querySelectorAll('.gent').forEach(b => b.onclick = () => {
    const n = +b.dataset.gen; SFX.play('tap');
    gens = gens.includes(n) ? (gens.length > 1 ? gens.filter(x => x !== n) : gens) : cleanGens([...gens, n]);
    sync();
  });
  d.querySelector('[data-n="close"]').onclick = () => d.remove();
  go.onclick = () => {
    d.remove();
    if(G && G.daily){ save(); const m = load(SAVE_KEY); G = m ? m.G : null; }   // the plain run is the one being replaced
    if(G && !G.daily) noteQuit();
    PREF.set('gens', gens);
    const secret = pick.ticket && gens.includes(SECRETS[pick.ticket].gen) && useTicket(pick.ticket) ? pick.ticket : null;
    if(pick.secrets && !(ticketCount('red') > 0 && ticketCount('oak') > 0)) pick.secrets = false;
    if(pick.secrets){ useTicket('red'); useTicket('oak'); }
    const { ticket: _t, ...mods } = pick;
    newRun({ mods, gens, secret });
    undo = null; drawnPhase = null; render();
    if(onStart) onStart();
  };
  sync();
}

/* ---- 2.0.0 · DAILY CHALLENGE ------------------------------------------ */
function dailyShareText(date){
  const t = dailyResults()[date]; if(!t) return '';
  const mods = dailyMods(date), gl = genLabel({ gens: dailyGens(date) }), label = [gl, Object.keys(mods).length ? modsLabel({ mods }) : (gl ? '' : 'no special rules')].filter(Boolean).join(' · ');
  return `PokéArena Daily · ${prettyDate(date)} · ${label} — ${t.cleared ? `Champion! 🏆${t.secret ? ' · Beat ' + t.secret : ''}${t.hardcore ? ' · Hardcore' : ''}` : `${bestRunLabel(t.best)} · ${t.badges || 0} badge${t.badges === 1 ? '' : 's'}`}`;
}
async function copyDailyResult(date){
  const text = dailyShareText(date || (G && G.daily) || localDate());
  if(!text){ fail('No result yet.'); return; }
  try{ navigator.clipboard ? await navigator.clipboard.writeText(text) : 0; say('Result copied — paste it to your friends.'); }catch(e){ say(text); }
}
function openDaily(onGo){
  const today = localDate(), mods = dailyMods(today);
  const saved = load(DAILY_KEY), sg = saved && saved.G;
  const res = dailyResults()[today];
  const inToday = sg && sg.daily === today && !sg.over;
  const older = sg && sg.daily !== today && !sg.over;
  const rules = Object.keys(mods).length
    ? Object.keys(mods).map(k => `<b>${esc(MOD_INFO[k].name(mods[k]))}</b> — ${esc(MOD_INFO[k].text(mods[k]))}`).join('<br>')
    : 'No special rules today.';
  const d = modal(`<h3>Daily Challenge</h3>
    <p><b>${esc(prettyDate(today))}</b> — everyone gets the same run today: the same shops, the same trainers, the same bosses. It has its own save, so your normal run is safe.</p>
    <div class="drules"><h4>Today’s rule</h4><p>${rules}</p></div>
    ${(() => { const dg = dailyGens(today), nm = dg.map(n => GENS[n].name).join(' + ');
      const fo = drawFocus(dailySeed(today), dg), po = drawEvoPool(dailySeed(today), dg);
      return `<div class="drules"><h4>Today’s generations</h4><p><b>${esc(nm)}</b>${dg.length > 1 ? ' — the gym leaders and the Elite Four are drawn from both regions.' : ''}</p>
        ${fo ? `<p><b>★ Pool of the day</b> · Focus ${fo.map(k => miniSprite(k) + esc(SPECIES[k].name)).join(' · ')}<br><span class="dim">Open evolutions: ${poolLines({ evoPool: po }).map(esc).join(' · ')}</span></p>` : ''}</div>`; })()}
    ${inToday ? `<p class="dim">Your run today: turn ${sg.turn} · ${sg.badges} badge${sg.badges === 1 ? '' : 's'}</p>` : ''}
    ${older ? `<p class="dim">Unfinished: the ${esc(prettyDate(sg.daily))} challenge, turn ${sg.turn} · ${sg.badges} badge${sg.badges === 1 ? '' : 's'}</p>` : ''}
    ${res ? `<p>Today’s best: <b>${esc(res.cleared ? 'Champion!' : bestRunLabel(res.best))}</b>${res.hardcore ? ` <span class="hcnote">${hcBadge('sm')} Hardcore</span>` : ''}</p>` : ''}
    <div class="btnrow dbtns">
      ${inToday ? '<button class="btn primary" data-d="continue">Continue today’s</button>' : ''}
      ${older ? '<button class="btn" data-d="continue">Finish the older one</button>' : ''}
      <button class="btn ${inToday ? '' : 'primary'}" data-d="start">${inToday || res ? 'Start today’s over' : 'Start today’s'}</button>
      ${res ? '<button class="btn" data-d="share">Copy result</button>' : ''}
      <button class="btn ghost" data-d="close">Back</button>
    </div>
    ${inToday || older ? '<p class="dim small">Starting today’s over replaces the daily save, not your normal run.</p>' : ''}`);
  d.classList.add('daily');
  d.querySelectorAll('[data-d]').forEach(b => b.onclick = async () => {
    const x = b.dataset.d;
    if(x === 'close'){ d.remove(); return; }
    if(x === 'share'){ await copyDailyResult(today); b.textContent = 'Copied!'; return; }
    if(x === 'continue'){ d.remove(); switchSlot(DAILY_KEY); if(onGo) onGo(); return; }
    if(x === 'start'){
      d.remove(); save();
      if(sg && sg.daily === today && !sg.over && G && G.daily === today) noteDaily();
      G = newGame(dailySeed(today), { mods, daily: today, gens: dailyGens(today) });
      rollShop(G, false);
      phase = 'shop'; sel = null; inspect = null; battle = null; shopMem = null; drawnPhase = null; undo = null;
      const all = dailyResults(); all[today] = Object.assign({ best:-1, cleared:false }, all[today], { tries: ((all[today] || {}).tries || 0) + 1 });
      try{ localStorage.setItem(DAILY_REC, JSON.stringify(all)); }catch(e){}
      save(); render();
      if(onGo) onGo();
    }
  });
}

/* v47: buttons inside pop-ups (menus, Options, rewards, the Pokédex jumps) blip too */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-m],[data-o],[data-r],[data-jump]');
  if(!b || b.disabled || b.dataset.o === 'sound' || b.dataset.o === 'volume') return;   // those play their own
  const m = b.dataset.m;
  SFX.play(m === 'close' || m === 'restart-no' ? 'back' : b.dataset.o ? 'tap' : 'select');
});

/* 2.2.1: the pointer is tracked all the time (not only while something is lifted), so
   the chip can appear exactly under it the moment you pick something up. */
const lastPtr = { x: 0, y: 0, seen: false };
function placeCarry(){
  if(!carryEl || carryEl.hidden) return;
  carryEl.style.visibility = lastPtr.seen ? '' : 'hidden';
  if(!lastPtr.seen) return;
  const w = carryEl.offsetWidth || 150, h = carryEl.offsetHeight || 40;
  carryEl.style.left = Math.max(4, Math.min(innerWidth - w - 4, lastPtr.x + 14)) + 'px';
  carryEl.style.top  = Math.max(4, Math.min(innerHeight - h - 4, lastPtr.y + 14)) + 'px';
}
const trackPtr = e => {
  if(e.pointerType === 'touch') return;
  lastPtr.x = e.clientX; lastPtr.y = e.clientY; lastPtr.seen = true;
  if(carryEl && !carryEl.hidden && finePointer()) placeCarry();
};
document.addEventListener('pointermove', trackPtr, true);
document.addEventListener('pointerdown', trackPtr, true);
document.addEventListener('keydown', e => {
  if(e.key === 'Escape'){ sel = null; hidePopup(); save(); render(); }
  // 4.2.0: Space pauses and resumes a battle (not while typing in a box)
  if(e.key === ' ' && phase === 'battle' && battle && battle.i < battle.steps.length - 1
     && !/^(INPUT|TEXTAREA|BUTTON|SELECT)$/.test((document.activeElement || {}).tagName || '') && !document.querySelector('.modal')){
    e.preventDefault(); handle('pause');
  }
});
window.addEventListener('resize', hidePopup);

function handle(act, i, data){
  toast = '';
  switch(act){

    /* ----- the Bag: pick an item up, then tap whoever should carry it ----- */
    case 'bag': {
      const id = G.bag[i];
      if(!id) return;
      inspect = { kind:'held', id, cost:false };
      sel = (sel && sel.kind === 'bag' && sel.idx === i) ? null : { kind:'bag', idx:i };
      break;
    }
    case 'sellheld': {
      const w = (data && data.where) || 'bag';
      const r = sellHeld(G, w, w === 'pc' ? pcIdx(G, i) : w === 'team' ? teamIdx(G, i) : i);
      if(!r.ok){ fail(r.why || "Can't do that."); return; }
      sel = null; inspect = null;
      say(`Sold ${HELD_ITEMS[r.id].name} for ${r.paid}₽.`);
      return;
    }
    case 'unequip': {
      const where = data && data.where;
      const u = where === 'pc' ? pcAt(G, i) : teamAt(G, i);
      const r = unequipHeld(G, u);
      if(!r.ok){ fail(r.why || "Can't do that."); return; }
      say(`Took the ${HELD_ITEMS[r.id].name} back.`);
      return;
    }

    case 'dc': {
      const s = G.daycare[i];
      if(!s || s.bought) return;
      inspect = { kind:'unit', u:s.unit };
      sel = (sel && sel.kind === 'dc' && sel.idx === i) ? null : { kind:'dc', idx:i };
      break;
    }

    case 'mart': {
      const s = G.mart[i];
      if(!s || s.bought) return;
      inspect = s.held ? { kind:'held', id:s.id } : { kind:'mart', id:s.id };
      sel = (sel && sel.kind === 'mart' && sel.idx === i) ? null : { kind:'mart', idx:i };
      break;
    }
    case 'buyheld': {
      const r = buyHeld(G, sel.idx);
      if(!r.ok){ fail(r.why || "Can't do that."); return; }
      sel = null;
      say(`${HELD_ITEMS[r.id].name} went into your Bag.`);
      return;
    }

    case 'usex': {
      if(!sel || sel.kind !== 'bitem') return;
      const d = BATTLE_ITEMS[sel.idx];
      const r = buyBattleItem(G, sel.idx);
      if(!r.ok){ fail(r.why || "Can't do that."); return; }
      save();                      // stay selected: it can be used again, up to the cap
      say(`${d.name}: your whole party is boosted (${r.uses} of ${TUNING.xItems.perBattle}).`);
      return;
    }
    case 'bitem': {
      inspect = { kind:'bitem', idx:i };
      sel = (sel && sel.kind === 'bitem' && sel.idx === i) ? null : { kind:'bitem', idx:i };
      break;
    }

    case 'team': {
      // i is a formation CELL; the engine wants list indexes for pokémon
      const here = teamAt(G, i), hereIdx = teamIdx(G, i);
      if(sel && sel.kind === 'dc'){
        const r = buyPokemon(G, sel.idx, here ? hereIdx : G.team.length, i);
        if(!r.ok){ fail(r.why || "Can't do that."); return; }
        sel = null; inspect = { kind:'unit', u:r.unit };
        if(r.evolved) say(`${r.evolved.from} evolved into ${r.evolved.into}!`);
      } else if(sel && sel.kind === 'mart'){
        const r = buyItem(G, sel.idx, hereIdx);
        if(!r.ok){ fail(r.why || "Can't do that."); return; }
        sel = null; inspect = here ? { kind:'unit', u:here } : null;
        if(r.given){ say(r.taken ? `${here.nm} is holding the ${HELD_ITEMS[r.given].name}; the ${HELD_ITEMS[r.taken].name} went to your Bag.`
                                 : `${here.nm} is holding the ${HELD_ITEMS[r.given].name}.`); return; }
      } else if(sel && sel.kind === 'bag'){
        const r = equipHeld(G, sel.idx, here);
        if(!r.ok){ fail(r.why || "Can't do that."); return; }
        sel = null; inspect = { kind:'unit', u:here };
        say(r.taken ? `Swapped for the ${HELD_ITEMS[r.taken].name}.`
                    : `${here.nm} is holding the ${HELD_ITEMS[r.given].name}.`);
        return;
      } else if(sel && sel.kind === 'pc'){
        const r = pcToParty(G, pcIdx(G, sel.idx), here ? hereIdx : G.team.length, i);
        if(!r.ok){ fail(r.why || "Can't do that."); return; }
        sel = null; inspect = r.unit ? { kind:'unit', u:r.unit } : null;
        if(r.evolved) say(`${r.evolved.from} evolved into ${r.evolved.into}!`);
        else if(r.merged) say('Copies combined.');
      } else if(sel && sel.kind === 'team'){
        if(sel.idx === i){ sel = null; }
        else {
          const r = placeUnit(G, teamIdx(G, sel.idx), i);   // any cell: move there, swap, or merge twins
          if(!r.ok && r.why){ fail(r.why); return; }
          sel = null;
          if(r.evolved) say(`${r.evolved.from} evolved into ${r.evolved.into}!`);
          else if(r.merged) say('Copies combined.');
        }
      } else {
        if(!here) return;
        inspect = { kind:'unit', u:here };
        sel = { kind:'team', idx:i };
      }
      break;
    }

    case 'cancel':  sel = null; break;
    case 'reserve': if(G.mart[sel.idx]) G.mart[sel.idx].reserved = !G.mart[sel.idx].reserved; sel = null; break;

    case 'topc': {
      const r = partyToPc(G, teamIdx(G, sel.idx));
      if(!r.ok){ fail(r.why || "Can't do that."); return; }
      sel = null; inspect = { kind:'unit', u:r.unit };
      break;
    }
    case 'release': {
      const r = releaseFromPc(G, pcIdx(G, sel.idx));
      sel = null; inspect = null;
      if(r.ok) say(`Released for ${r.refund}₽`);
      break;
    }

    /* ----- a PC cell: select a stored pokémon, or drop one in ----- */
    case 'pc': {
      const u = pcAt(G, i), ui = pcIdx(G, i);      // i is a BOX; the engine wants list indexes
      if(sel && sel.kind === 'dc' && (!u || (G.daycare[sel.idx] && u.id === G.daycare[sel.idx].unit.id))){
        const r = buyToPc(G, sel.idx, i);
        if(!r.ok){ fail(r.why || "Can't do that."); return; }
        sel = null; inspect = { kind:'unit', u:r.unit };
        if(r.evolved){ say(`${r.evolved.from} evolved into ${r.evolved.into}!`); return; }
        if(r.merged){ say(`Combined with the ${r.unit.nm} in the PC.`); return; }
      } else if(sel && sel.kind === 'team' && !u){
        const r = partyToPc(G, teamIdx(G, sel.idx), i);
        if(!r.ok){ fail(r.why || "Can't do that."); return; }
        sel = null; inspect = { kind:'unit', u:r.unit };
      } else if(sel && sel.kind === 'team' && u){
        // a party member onto a stored one: they trade places
        const r = pcToParty(G, ui, teamIdx(G, sel.idx));
        if(!r.ok){ fail(r.why || "Can't do that."); return; }
        sel = null; inspect = r.unit ? { kind:'unit', u:r.unit } : null;
        if(r.evolved) say(`${r.evolved.from} evolved into ${r.evolved.into}!`);
        else if(r.merged) say('Copies combined.');
      } else if(sel && sel.kind === 'pc' && u && sel.idx !== i
                && pcAt(G, sel.idx) && pcAt(G, sel.idx).id === u.id && unitLevel(u) < 3){
        // two of the same pokémon in the box: combine them where they stand
        const r = pcMerge(G, pcIdx(G, sel.idx), ui);
        if(!r.ok){ fail(r.why || "Can't do that."); return; }
        sel = null; inspect = { kind:'unit', u:r.unit };
        say(r.evolved ? `${r.evolved.from} evolved into ${r.evolved.into}!` : 'Copies combined.');
        return;
      } else if(sel && sel.kind === 'pc' && sel.idx !== i){
        // v34: anywhere in the box — an empty box moves it, a full one swaps
        const r = placeInBox(G, pcIdx(G, sel.idx), i);
        if(!r.ok){ fail(r.why || "Can't do that."); return; }
        sel = null;
      } else if(sel && sel.kind === 'mart' && u){
        const r = buyItem(G, sel.idx, ui, 'pc');
        if(!r.ok){ fail(r.why || "Can't do that."); return; }
        sel = null; inspect = { kind:'unit', u };
        say(r.given ? `${u.nm} is holding the ${HELD_ITEMS[r.given].name}${r.taken ? `; the ${HELD_ITEMS[r.taken].name} went to your Bag` : ''}.`
                    : `Used it on ${u.nm} in the PC.`);
        return;
      } else if(sel && sel.kind === 'bag' && u){
        const r = equipHeld(G, sel.idx, u);
        if(!r.ok){ fail(r.why || "Can't do that."); return; }
        sel = null; inspect = { kind:'unit', u };
        say(r.taken ? `Swapped for the ${HELD_ITEMS[r.taken].name}.`
                    : `${u.nm} is holding the ${HELD_ITEMS[r.given].name}.`);
        return;
      } else if(u){
        inspect = { kind:'unit', u };
        sel = (sel && sel.kind === 'pc' && sel.idx === i) ? null : { kind:'pc', idx:i };
      } else {
        sel = null;
      }
      break;
    }

    case 'sell': {
      /* 5.2.1: sel.idx is the spot on the field; sellUnit wants the place in the party list. Mixing the two
         meant Release did nothing (or let the wrong pokémon go) once the party had been moved around. */
      const r = sellUnit(G, teamIdx(G, sel.idx));
      if(!r.ok){ fail(r.why || "Can't release that pokémon."); return; }
      sel = null; inspect = null;
      say(`Released for ${r.refund}₽`);
      break;
    }

    case 'rolldc':
      if(!rollDaycare(G, true)){ fail('Not enough pokecredits.'); return; }
      sel = null; break;
    case 'rollmart':
      if(!rollMart(G, true)){ fail('Not enough pokecredits.'); return; }
      sel = null; break;

    case 'endturn': startBattle(); return;
    case 'speed': {
      setSpeed(i); SFX.play('tap');
      // restart the pending tick so the new rate takes effect on this step,
      // not the next one
      if(battle && battle.i < battle.steps.length - 1) playback();
      render();
      return;
    }
    case 'skip':    SFX.play('tap'); finishPlayback(); return;
    case 'pause': {
      if(!battle || battle.i >= battle.steps.length - 1) return;
      if(battle.paused) { battle.paused = false; SFX.hold(false); SFX.play('tap'); } else { SFX.play('tap'); battle.paused = true; SFX.hold(true); }
      clearTimeout(battle.timer);
      if(!battle.paused) playback();
      render();
      if(battle && battle.stage) battle.stage.el.classList.toggle('paused', !!battle.paused);
      return;
    }
    case 'step': {
      if(!battle || !battle.paused || battle.i >= battle.steps.length - 1) return;
      SFX.play('tap'); battle.i++; advanceView();
      if(battle && battle.i < battle.steps.length - 1) render();
      if(battle && battle.stage) battle.stage.el.classList.toggle('paused', !!battle.paused);
      return;
    }
    case 'scoutcard': { const n = nextUp(G), u = n.scouted && n.scouted[i];
      if(u) openUnitCard(u, `Scouting report · ${esc(n.boss ? n.boss.name : '')}`, true); return; }
    case 'overcard': openUnitCard(G.team[i]); return;
    case 'runimage': shareRunImage(); return;
    case 'tipok':   SFX.play('select'); TIPS.dismiss(data.tip); break;
    case 'afterbattle': if(wiping || fieldPicking) return; if(fieldRewardWanted()){ fieldReward(); return; } transition(afterBattle, null, 'back'); return;   // 5.3.0: a gym's reward is chosen on the field   // v40: the wipe carries you back
    case 'menu':    openMenu(); return;
    case 'badges':  openBadgeInfo(); return;
    case 'arrange': {
      // tanks, bruisers, supports, cannons — ties keep the order you chose
      lineUpByRole(G);
      sel = null; say('Lined up: Tanks in front, Cannons at the back.'); break;
    }
    case 'restart': openNewRun(); return;
    /* ----- 2.0.0 ----- */
    case 'undo': {
      if(!undoReady()){ fail('Nothing to undo.'); return; }
      const t = G.turn;
      G = JSON.parse(undo.snap); G.undoTurn = t; syncUid(G);
      const was = undo; undo = null; sel = null; inspect = null;
      say(`Undone: ${was.label}. ${was.cost}₽ back.`);
      return;
    }
    case 'legend': {
      const r = recruitLegend(G);
      if(!r.ok){ fail(r.why); return; }
      sel = null; inspect = { kind:'unit', u:r.unit };
      SFX.play('evolve'); shopSfx = true;
      say(`${r.unit.nm} joined your team!`);
      return;
    }
    case 'legendpass': if(G.encounter){ G.encounter.taken = 'passed'; say(`The ${SPECIES[G.encounter.id].name} flew off.`); } return;
    case 'presets': openPresets(); return;
    case 'mppick': case 'mpsave': case 'mpskip': case 'mpbox': if(duelSaveAct(act, { dataset: data })) return; break;
    case 'totitle': showTitle(afterTitle); return;
    case 'dailyshare': copyDailyResult(); return;
  }
  save();
  shopSfx = false;
  render();
  // v47: a plain tap blips; anything the shop celebrates (a buy, a level) has its own sound
  if(!shopSfx && TAP_ACTS.has(act)) SFX.play(act === 'cancel' ? 'back' : 'tap');
}
const TAP_ACTS = new Set(['bag', 'dc', 'mart', 'bitem', 'team', 'pc', 'cancel', 'reserve', 'topc', 'release', 'sell', 'arrange', 'rolldc', 'rollmart', 'undo', 'legendpass']);

/* ===================================================================
   THE POKéBALL WIPE (v40) — Sean picked "B · Rolling iris"
   A pokéball rolls to the middle of the screen while the screen closes to a
   circle around it, like the old games. At full dark `mid` runs (the screen
   swaps underneath), then the circle opens on the new screen and the ball
   pops away. Scales with battle speed; reduced motion gets a quick fade.
   Browser test runs skip it (navigator.webdriver) so the older suites keep
   their timings; wipetest.js sets window.PKB_WIPE to see it.
   =================================================================== */
const WIPE_BALL = '<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M4 50a46 46 0 0 1 92 0z" fill="#d9463f"/><path d="M4 50a46 46 0 0 0 92 0z" fill="#f4f1e6"/>' +
  '<circle cx="50" cy="50" r="46" fill="none" stroke="#22262f" stroke-width="7"/><rect x="4" y="46" width="92" height="8" fill="#22262f"/>' +
  '<circle cx="50" cy="50" r="15" fill="#f4f1e6" stroke="#22262f" stroke-width="7"/><circle cx="50" cy="50" r="7" fill="none" stroke="#c9c2ab" stroke-width="2"/></svg>';
const wipeWanted = () => !navigator.webdriver || window.PKB_WIPE;
/* v47: about 74 wipes in a full run started to drag (Sean picked "quick after 3
   battles"). On Auto the first WIPE_FULL_BATTLES battles each time the game is
   opened get the full rolling ball; after that it's a quick ~0.4s close-and-open.
   Options → Transitions can pin it to Full, Quick or Off. */
const WIPE_FULL_BATTLES = 3;
let sessionBattles = 0;
function wipeMode(){
  const p = PREF.get('wipe', 'auto');
  if(p === 'full' || p === 'quick' || p === 'off') return p;
  return sessionBattles <= WIPE_FULL_BATTLES ? 'full' : 'quick';
}
let wiping = false;
async function wipe(mid, onOpen){
  const mode = wipeMode();
  if(!wipeWanted() || mode === 'off'){ await mid(); if(onOpen) onOpen(); return; }
  if(wiping) return;
  wiping = true;
  hidePopup();
  const w = document.createElement('div');
  w.className = 'wipe'; w.setAttribute('aria-hidden', 'true');
  const iris = document.createElement('div'); iris.className = 'wiris';
  const ball = document.createElement('div'); ball.className = 'wball'; ball.innerHTML = WIPE_BALL;
  w.append(iris, ball); document.body.appendChild(w);
  const T = ms => ms / speed;
  const go = (el, frames, ms, easing, delay) =>
    el.animate(frames, { duration: T(ms), delay: T(delay || 0), easing: easing || 'linear', fill: 'both' }).finished.catch(() => {});
  w.dataset.mode = mode;
  SFX.play('wipeIn', mode === 'quick');
  try{
    if(true){   // 5.4.0: the pokéball wipe is retired; Quick (and reduced motion) is a short fade to dark
      iris.classList.add('flat'); ball.hidden = true;
      await go(iris, [{ opacity: 0 }, { opacity: 1 }], 130);
      await mid(); if(onOpen) onOpen();
      SFX.play('wipeOut', true);
      await go(iris, [{ opacity: 1 }, { opacity: 0 }], 130);
      return;
    }
    const R = Math.hypot(innerWidth, innerHeight) * 1.05;
    if(mode === 'quick'){
      // no roll: the ball pops in at the middle, the circle snaps shut and opens again
      const Q = (el, frames, ms, easing, delay) =>
        el.animate(frames, { duration: ms, delay: delay || 0, easing: easing || 'linear', fill: 'both' }).finished.catch(() => {});
      await Promise.all([
        Q(ball, [{ transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], 120, 'ease-out'),
        Q(iris, [{ width: R + 'px', height: R + 'px' }, { width: '0px', height: '0px' }], 170, 'ease-in')]);
      await mid();
      if(onOpen) onOpen();
      SFX.play('wipeOut', true);
      await Promise.all([
        Q(ball, [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(.1)', opacity: 0 }], 150),
        Q(iris, [{ width: '0px', height: '0px' }, { width: R + 'px', height: R + 'px' }], 200, 'cubic-bezier(.4,0,.6,1)', 20)]);
      return;
    }
    await Promise.all([
      go(ball, [{ transform: `translateX(${-(innerWidth / 2 + 60)}px) rotate(-540deg)` }, { transform: 'none' }], 480, 'cubic-bezier(.2,.7,.3,1)'),
      go(iris, [{ width: R + 'px', height: R + 'px' }, { width: '96px', height: '96px', offset: .7 }, { width: '0px', height: '0px' }], 560, 'ease-in', 120)]);
    await mid();
    await new Promise(r => setTimeout(r, T(90)));
    if(onOpen) onOpen();
    SFX.play('wipeOut', false);
    await Promise.all([
      go(ball, [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(1.25)', opacity: 1, offset: .3 }, { transform: 'scale(.1)', opacity: 0 }], 260),
      go(iris, [{ width: '0px', height: '0px' }, { width: R + 'px', height: R + 'px' }], 420, 'cubic-bezier(.4,0,.6,1)', 40)]);
  } finally {
    w.remove(); wiping = false;
  }
}


/* ---- 5.0.0 · THE WORLD ------------------------------------------------
   One stadium sits behind every game screen (#world), and the screens are
   layered over it. The shop is the camera close in on your half, with your
   party standing on the real battle field; a battle is the same camera
   pulled back to the whole stadium. Nothing is swapped for the transition:
   the field you were looking at is the field you fight on.

   The field is always laid out in the box the battle uses (worldBox), and
   the camera (.wcam) is a 2D transform on top of it. The party's slots stay
   in the page, flat, and are placed over the field's marks after each draw,
   so a tap always lands where it looks. */
const WORLD = { el: null, cam: null, shop: null, shopKey: '', shopCam: null, anim: false, box: null };
const WIDE_Q = '(min-width:1000px),(orientation:landscape) and (max-height:520px) and (min-width:640px)';
const wideMode = () => matchMedia(WIDE_Q).matches;
function worldEl(){
  if(!WORLD.el){ WORLD.el = document.getElementById('world'); WORLD.cam = WORLD.el && WORLD.el.querySelector('.wcam'); }
  return WORLD.el;
}
/** Who the next fight is against, in the shape the stadium needs. */
function nextBout(){
  if(!G) return { kind: 'trainer', boss: null };
  const n = nextUp(G), st = stageOf(G);
  return { kind: n.kind || 'trainer', boss: isBoss(st) ? st.boss : null };
}
/** The shop's field: the next fight's stadium, empty. Kept until the next fight changes. */
function shopStage(){
  const b = nextBout(), SD = standsOf(b), key = `${backdropOf(b)}|${floorOf(b)}|${lookPref()}|${b.boss ? b.boss.id : ''}|${SD.lit}|${SD.crowd}`;
  if(!WORLD.shop || WORLD.shopKey !== key){ WORLD.shop = stageShell(b); WORLD.shop.classList.add('shopstage'); WORLD.shopKey = key; }
  WORLD.shop.classList.toggle('flatshop', flatShop());
  return WORLD.shop;
}
/** Where the field sits: the battle's box for this screen size (page coordinates). */
function worldBox(){
  const vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight || innerHeight;   // 5.3.1: not innerHeight, which changes as a phone's browser bar slides away
  const tb = document.querySelector('#app > .topbar');
  const T = Math.round(tb ? tb.getBoundingClientRect().bottom + scrollY + (wideMode() && vh <= 520 ? 5 : 10) : 76);
  if(wideMode()){
    const land = vh <= 520, strip = land ? 58 : 118, pad = land ? 10 : 16, aspect = land ? 2.3 : 16 / 9;   // 5.3.1: a phone on its side gets a wider, flatter field
    const aw = vw - 2 * pad, ah = Math.max(150, vh - T - strip);
    const w = Math.round(Math.min(aw, ah * aspect)), h = Math.round(w / aspect);
    return { l: Math.round((vw - w) / 2), t: T, w, h, wide: true };
  }
  const w = vw - 16, h = Math.round(Math.max(w * 1.15, Math.min(w * 1.7, vh - T - 210)));
  return { l: 8, t: T, w, h, wide: false };
}
const rectUnion = rs => { let l = 1e9, t = 1e9, r = -1e9, b = -1e9;
  for(const q of rs){ l = Math.min(l, q.left); t = Math.min(t, q.top); r = Math.max(r, q.right); b = Math.max(b, q.bottom); }
  return { l, t, r, b, w: r - l, h: b - t, cx: (l + r) / 2, cy: (t + b) / 2 }; };
/** The camera for the shop: your half of the field, filling the party's space on the page. */
function shopCamera(){
  const fs = document.querySelector('.pfield .formation'), st = WORLD.cam && WORLD.cam.firstElementChild;
  if(!fs || !st) return 'none';
  WORLD.cam.style.transform = 'none';
  const marks = [...st.querySelectorAll('.slotmark.p')].map(planeRect);
  if(!marks.length) return 'none';
  const U = rectUnion(marks), mh = marks[0].height, R = fs.getBoundingClientRect(), E = WORLD.cam.getBoundingClientRect();
  const top = U.t - mh * (WORLD.box.wide ? .2 : .8), bot = U.b + mh * .12;   // room for the plates over the front row, clear of the party tag (5.3.6)
  const uw = U.w * 1.04, uh = bot - top, ucy = (top + bot) / 2;
  let s = Math.min(R.width / uw, R.height / uh);
  s = Math.max(WORLD.box.wide ? 1.12 : 1.18, Math.min(3, s));
  const cx = R.left + R.width / 2, cy = R.top + R.height / 2;
  return `translate(${(cx - (E.left + (U.cx - E.left) * s)).toFixed(1)}px,${(cy - (E.top + (ucy - E.top) * s)).toFixed(1)}px) scale(${s.toFixed(3)})`;
}
/* 5.3.8: on an upright phone everything about the shop's field is worked out from the page layout itself
   (offsetLeft/offsetTop), never from where the browser says things are on screen. iPhones report on-screen
   positions that lag behind while the page scrolls (picking a pokémon scrolls it), which dragged the party's
   spots off the field. Layout numbers don't move when you scroll, so they can't drift. */
const pageOff = el => { let x = 0, y = 0; for(let e = el; e; e = e.offsetParent){ x += e.offsetLeft; y += e.offsetTop; } return { x, y }; };
function clipCamera(){
  const fs = document.querySelector('.pfield .formation'), st = WORLD.cam && WORLD.cam.firstElementChild, C = WORLD.clipO;
  if(!fs || !st || !C) return null;
  const qs = [...st.querySelectorAll('.slotmark.p')].map(planeBox).filter(Boolean);
  if(!qs.length) return null;
  const U = { l: Math.min(...qs.map(q => q.left)), r: Math.max(...qs.map(q => q.right)), t: Math.min(...qs.map(q => q.top)), b: Math.max(...qs.map(q => q.bottom)) };
  const mh = qs[0].height, top = U.t - mh * .8, bot = U.b + mh * .12, uw = (U.r - U.l) * 1.04, uh = bot - top;
  const R = { x: fs.offsetLeft, y: fs.offsetTop, w: fs.offsetWidth, h: fs.offsetHeight };
  const s = Math.max(1.18, Math.min(3, Math.min(R.w / uw, R.h / uh)));
  const tx = R.x + R.w / 2 - C.x - s * (U.l + U.r) / 2, ty = R.y + R.h / 2 - C.y - s * (top + bot) / 2;
  return { s, tx, ty, css: `translate(${tx.toFixed(1)}px,${ty.toFixed(1)}px) scale(${s.toFixed(4)})` };
}
function placeSlotsClip(K){
  const fs = document.querySelector('.pfield .formation'), st = WORLD.cam.firstElementChild, C = WORLD.clipO, vert = st.classList.contains('vert');
  const fx = fs.offsetLeft, fy = fs.offsetTop, vw = document.documentElement.clientWidth, fsx = pageOff(fs).x;
  for(const el of fs.querySelectorAll('.slot[data-i]')){
    const i = +el.dataset.i, m = st.querySelector(`.slotmark.p.r${Math.min(2, Math.floor(i / RANK_W))}.f${i % RANK_W}`);
    const q = m && planeBox(m); if(!q) continue;
    const L = C.x + K.tx + K.s * q.left - fx, T = C.y + K.ty + K.s * q.top - fy, W = q.width * K.s, H = q.height * K.s;
    const sp = Math.round(Math.min(W * .9, H * (vert ? .66 : .48)));
    let sw = Math.min(W, Math.max(sp * 1.7, 64)), sl = L + W / 2 - sw / 2;
    sl = Math.max(2 - fsx, Math.min(vw - fsx - sw - 2, sl));
    el.style.cssText = `left:${sl.toFixed(1)}px;top:${T.toFixed(1)}px;width:${sw.toFixed(1)}px;height:${H.toFixed(1)}px;--mh:${H.toFixed(1)}px;--sp:${sp}px;--ab:${vert ? 22 : 13.5}%;--abf:${vert ? .22 : .135}`;
  }
}
/** Put each party slot (flat, in the page) over its mark on the field. */
function placeSlots(){
  const fs = document.querySelector('.pfield .formation'), st = WORLD.cam && WORLD.cam.firstElementChild;
  if(!fs || !st) return;
  /* 5.3.5: measure everything first, then place (no layout changes in between), then check each spot really landed
     where it was aimed and nudge it if not. iPhones were dropping every spot after the first one about 40px low;
     whatever the cause, a spot's own (flat) box is reported correctly, so the check catches it. */
  const F = fs.getBoundingClientRect(), vw = document.documentElement.clientWidth, vert = st.classList.contains('vert');
  const plan = [];
  for(const el of fs.querySelectorAll('.slot[data-i]')){
    const i = +el.dataset.i, m = st.querySelector(`.slotmark.p.r${Math.min(2, Math.floor(i / RANK_W))}.f${i % RANK_W}`);
    if(!m) continue;
    const r = planeRect(m);
    // the same size and footing as the fighter that will stand there (measured off the battle's own pieces)
    const sp = Math.round(Math.min(r.width * .9, r.height * (vert ? .66 : .48)));
    // a tap target around the pokémon, kept on screen where the close-up crops the field's edges
    let sw = Math.min(r.width, Math.max(sp * 1.7, 64)), sl = r.left + r.width / 2 - sw / 2;
    sl = Math.max(2, Math.min(vw - sw - 2, sl));
    plan.push({ el, x: sl, y: r.top, w: sw, h: r.height, sp });
  }
  const put = (q, dx, dy) => { q.el.style.cssText = `left:${(q.x - F.left + dx).toFixed(1)}px;top:${(q.y - F.top + dy).toFixed(1)}px;width:${q.w.toFixed(1)}px;height:${q.h.toFixed(1)}px;--mh:${q.h.toFixed(1)}px;--sp:${q.sp}px;--ab:${vert ? 22 : 13.5}%;--abf:${vert ? .22 : .135}`; };
  for(const q of plan){ q.dx = 0; q.dy = 0; put(q, 0, 0); }
  for(let pass = 0; pass < 2; pass++){
    let moved = false;
    for(const q of plan){ const b = q.el.getBoundingClientRect(), ex = q.x - b.left, ey = q.y - b.top;
      if(Math.abs(ex) > 1.5 || Math.abs(ey) > 1.5){ q.dx += ex; q.dy += ey; moved = true; } }
    if(!moved) break;
    for(const q of plan) put(q, q.dx, q.dy);
  }
}
/* 5.3.7: the page around the field takes the field's own colours (a deep shade of its floor), in the shop and in battle,
   so the surround always matches whatever stadium is showing */
const STADIUM_TONE = ['#0a0d15', '#0d111b'];
const PAGE_TONE = { route:['#3a8840','#43974a'], gym:['#3a8840','#43974a'], dusk:['#2c5a34','#326538'], league:['#241e4a','#2a2356'],
  summit:['#6f8296','#7a8ea3'], Water:['#1f4f86','#235a95'], Fire:['#3a1e18','#44241c'], Rock:['#5e5442','#685d4a'], Ground:['#7a5e32','#866838'],
  Grass:['#2f6e35','#357a3b'], Bug:['#3b5226','#435c2b'], Psychic:['#4a2556','#532a60'], Electric:['#3e4452','#454c5b'], Ice:['#4f8aa6','#5795b2'],
  Fighting:['#6e4e2e','#785634'], Ghost:['#1d1630','#221a38'], Dragon:['#24226a','#2a2776'], Flying:['#3f7aa6','#4684b2'], Normal:['#9a6e7e','#a57888'],
  Steel:['#59616d','#626a77'], Poison:['#3e2150','#45255a'], Dark:['#1a0f14','#21141a'] };
function setPageTone(stageEl){
  /* 5.5.2: the page behind the field is always the dark stadium with its crowd (Sean: black, the same on every stage) */
  const t = STADIUM_TONE, r = document.documentElement.style;
  if(r.getPropertyValue('--pg1') !== t[0]){ r.setProperty('--pg1', t[0]); r.setProperty('--pg2', t[1]); }
}
/** 5.5.2: on a computer the summary card sits over the lower shop column (the Daycare and the Mart), leaving the PC
    and the Bag above it free to tap while something is picked. */
function placeInspect(){
  const r = document.documentElement.style;
  if(!(innerWidth >= 1000 && innerHeight >= 521) || phase !== 'shop'){ r.removeProperty('--insTop'); return; }
  /* 5.12.2: just under the PC (a pokémon or item being moved never needs the Bag as a target), only as tall as what it
     shows, and never running under the Battle bar */
  const pp = document.querySelector('.bcR .wall:not(.bag)');
  const vh = document.documentElement.clientHeight, dock = document.querySelector('.bcR .dock .btn.fight') || document.querySelector('.bcR .dock');   // it may cover who's next, not the Battle button
  const bottom = dock && dock.getBoundingClientRect().top > 0 ? dock.getBoundingClientRect().top - 8 : vh - 150;
  const top = Math.max(74, pp ? Math.round(pp.getBoundingClientRect().bottom + 8) : 74);
  r.setProperty('--insTop', top + 'px'); r.setProperty('--insMax', Math.max(220, Math.round(bottom - top)) + 'px');
  document.body.classList.toggle('inscompact', bottom - top < 440);
}
document.addEventListener('scroll', e => { if(e.target && e.target.classList && e.target.classList.contains('shelves')) placeInspect(); }, true);
/* 5.12.1: on an upright phone the Battle bar is pinned to the bottom of the screen (fixed, not sticky: iPhones left a
   sticky bar stranded mid-screen after a fast scroll), and the page keeps the same room under it whatever is picked,
   so nothing jumps. A summary opens as a sheet over the shop instead of growing the page; a gap the size of the idle
   message box holds its place. */
let barObs = null;
function syncPhoneBars(){
  const r = document.documentElement.style, dock = document.querySelector('#app .dock'), ins = document.querySelector('#inspect');
  if(dock && dock.offsetHeight) r.setProperty('--dockH', dock.offsetHeight + 'px');
  if(ins && !document.body.classList.contains('inspecting') && ins.offsetHeight) r.setProperty('--inspIdle', ins.offsetHeight + 'px');
  if(window.ResizeObserver && dock && (!barObs || barObs.el !== dock)){
    if(barObs) barObs.disconnect();
    barObs = new ResizeObserver(() => { if(dock.offsetHeight) r.setProperty('--dockH', dock.offsetHeight + 'px'); }); barObs.observe(dock); barObs.el = dock; }
}
/** Lay the world out for the current screen. Runs after every draw and on resize. */
function layoutWorld(){
  placeInspect(); syncPhoneBars();
  const w = worldEl(); if(!w || fieldPicking) return;
  const on = (phase === 'shop' && !!G) || phase === 'battle';
  document.body.classList.toggle('inworld', on);
  w.hidden = !on;
  if(!on) return;
  const box = WORLD.box = worldBox();
  w.classList.toggle('wide', box.wide);
  /* 5.3.7: on an upright phone the shop's field lives inside the party panel itself (in .pfclip), so the field and the
     party's spots share one parent and can never drift apart, whatever the page or the phone does. Battles, and the
     wide layouts, keep it in #world. */
  const clip = phase === 'shop' && !box.wide ? document.querySelector('.pfield > .pfclip') : null;
  const host = clip || w;
  if(WORLD.cam.parentNode !== host) host.appendChild(WORLD.cam);
  if(clip){
    const pfe = clip.parentElement, P = pageOff(pfe), pp = document.querySelector('.panel.party'), tb = document.querySelector('#app > .topbar');
    const camTop = tb ? pageOff(tb).y + tb.offsetHeight + 10 : box.t, pBot = pp ? pageOff(pp).y + pp.offsetHeight + 6 : camTop + box.h;
    WORLD.clipO = { x: box.l - P.x, y: camTop - P.y };   // the field's top-left, in the party field's own coordinates
    Object.assign(clip.style, { left: (-P.x) + 'px', top: (-P.y) + 'px', width: document.documentElement.clientWidth + 'px', height: Math.max(0, pBot) + 'px' });
    Object.assign(WORLD.cam.style, { left: box.l + 'px', top: camTop + 'px', width: box.w + 'px', height: box.h + 'px' });
  } else
  Object.assign(WORLD.cam.style, { left: box.l + 'px', top: box.t + 'px', width: box.w + 'px', height: box.h + 'px' });
  const root = document.documentElement.style;
  root.setProperty('--sbW', box.w + 'px'); root.setProperty('--sbH', box.h + 'px');
  const stage = phase === 'battle' && battle && battle.stage ? battle.stage.el : shopStage();
  if(stage.parentNode !== WORLD.cam) WORLD.cam.replaceChildren(stage);
  setPageTone(stage);
  stage.classList.toggle('vert', box.w < BOARD_VERT_BELOW && !matchMedia('(orientation:landscape) and (max-height:520px) and (min-width:640px)').matches);
  if(!clip && !box.wide && phase === 'battle') w.style.height = (box.t + box.h + 8) + 'px';   // 5.3.7: the field may have just come out of the party panel
  if(WORLD.anim) return;                       // the camera is mid-move; it settles itself
  w.classList.toggle('shopview', phase === 'shop');
  if(clip) clip.classList.add('shopview');
  if(phase === 'shop'){
    const K = clip && clipCamera();
    if(K){ WORLD.shopCam = K.css; WORLD.cam.style.transform = K.css; placeSlotsClip(K); }
    else { WORLD.shopCam = shopCamera(); WORLD.cam.style.transform = WORLD.shopCam; placeSlots(); }
    WORLD.key = worldKey();
    const pp = document.querySelector('.panel.party');
    w.style.height = box.wide ? '' : clip ? '0px' : Math.round((pp ? pp.getBoundingClientRect().bottom + scrollY : box.t + box.h) + 6) + 'px';
  } else {
    WORLD.cam.style.transform = 'none';
    w.style.height = box.wide ? '' : (box.t + box.h + 8) + 'px';
  }
}
window.addEventListener('resize', () => { if(!WORLD.anim) layoutWorld(); });
/* 5.3.1: on phones the field is laid out once per draw, but things above the party can change height afterwards
   (the font arriving, a banner closing, the browser bar sliding away). Check a few times a second and follow. */
function worldKey(){ const f = document.querySelector('.pfield .formation'), t = document.querySelector('#app > .topbar');
  if(!f || !WORLD.cam) return '';
  if(WORLD.cam.parentNode && WORLD.cam.parentNode.classList && WORLD.cam.parentNode.classList.contains('pfclip')){   // 5.3.8: layout only
    const a = pageOff(f), b = t ? pageOff(t).y + t.offsetHeight : 0, pp = document.querySelector('.panel.party');
    return [a.x, a.y, f.offsetWidth, f.offsetHeight, b, pp ? pp.offsetHeight : 0, document.documentElement.clientWidth, document.documentElement.clientHeight].join(','); }
  const r = f.getBoundingClientRect(), q = t ? t.getBoundingClientRect() : { bottom: 0 }, w = WORLD.cam.getBoundingClientRect();
  // 5.3.2: where the party's space is relative to the field itself, so any drift of either one is caught
  return [r.left - w.left, r.top - w.top, r.width, r.height, q.bottom - w.top, document.documentElement.clientWidth, document.documentElement.clientHeight].map(v => Math.round(v)).join(','); }
setInterval(() => { if(phase !== 'shop' || WORLD.anim || fieldPicking || wiping || document.hidden) return;
  const k = worldKey(); if(k && k !== WORLD.key) layoutWorld(); }, 200);
/* turning the phone mid-game: redraw once the new size has settled */
const reflow = () => { [120, 450, 900].forEach(t => setTimeout(() => { if(WORLD.anim || fieldPicking || wiping) return;
  if(phase === 'shop') render(); else { layoutWorld(); if(battle && battle.stage) fitBoard(battle.stage); } }, t)); };
window.addEventListener('orientationchange', reflow);
if(window.visualViewport) visualViewport.addEventListener('resize', () => { clearTimeout(reflow.t); reflow.t = setTimeout(() => { if(!WORLD.anim && !fieldPicking) layoutWorld(); }, 150); });
if(document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if(!WORLD.anim) layoutWorld(); });

/* ---- 5.0.0 · THE CAMERA ------------------------------------------------
   BATTLE: the shop panels drop away, the party's flat slots hand over to the
   fighters standing on the same marks, and the camera pulls back from your
   half to the whole stadium. The stands and lights come up, the other side
   walks on, and the queue and log slide in. Continue runs it backwards.
   Options → Transitions: Camera (default), Ball, Quick, Off; reduced motion
   gets the plain fade. */
const useCamera = () => wipeWanted() && PREF.get('wipe', 'auto') === 'auto' && !motionOff();
function transition(mid, onOpen, dir){ return useCamera() ? camera(mid, onOpen, dir) : wipe(mid, onOpen); }
const shopAway = () => [...document.querySelectorAll('#app > :not(.bcwrap):not(.vtag), .bcR, .bcL > :not(.party), .panel.party > :not(.pfield)')];
const awayFrame = e => e.matches('.topbar') ? 'translateY(-36px)'
  : e.matches('.bcR') && wideMode() ? 'translateX(80px)' : 'translateY(46px)';
async function camera(mid, onOpen, dir){
  if(wiping) return;
  wiping = true;
  hidePopup();
  const k = (sessionBattles > WIPE_FULL_BATTLES ? .8 : 1) * (speed >= 4 ? .6 : speed >= 2 ? .8 : 1);
  const T = ms => ms * k;
  const go = (el, frames, ms, o) => el.animate(frames, { duration: T(ms), easing: 'cubic-bezier(.5,0,.2,1)', fill: 'both', ...(o || {}) }).finished.catch(() => {});
  const wait = ms => new Promise(r => setTimeout(r, T(ms)));
  const body = document.body.classList;
  worldEl();
  try{
    if(dir !== 'back'){
      let from = WORLD.shopCam;
      if(!from || !WORLD.cam){ wiping = false; return wipe(mid, onOpen); }
      SFX.play('wipeIn', true);
      const away = shopAway();
      if(scrollY) window.scrollTo({ top: 0, behavior: 'smooth' });   // 5.3.1: a fight always starts at the top of the page
      await Promise.all(away.map(e => go(e, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: awayFrame(e) }], 340, { easing: 'ease-in' })));
      if(scrollY) window.scrollTo(0, 0);
      { const se = WORLD.cam.firstElementChild, q = se && se.getBoundingClientRect(); WORLD.shopRect = q ? { left: q.left, top: q.top, width: q.width, height: q.height } : null; }   // 5.3.7
      body.add('cam', 'cam-hide', 'cam-foe');
      WORLD.anim = true;
      await mid();                                 // the battle draws; its field goes into the world under the same camera,
                                                   // and the fighters take over from the party's slots on the same marks
      body.remove('cam-going');
      WORLD.el.classList.remove('shopview');
      if(battle) battle.camIn = true;
      WORLD.cam.style.transform = 'none';
      { const W0 = WORLD.cam.getBoundingClientRect(), q = WORLD.shopRect;   // the battle field starts exactly where the shop's was
        if(q && W0.width) from = `translate(${(q.left - W0.left).toFixed(1)}px,${(q.top - W0.top).toFixed(1)}px) scale(${(q.width / W0.width).toFixed(4)})`; }
      const bst = battle && battle.stage && battle.stage.el;
      if(bst && flatShop()){ bst.classList.add('flatshop'); void bst.offsetWidth; requestAnimationFrame(() => bst.classList.remove('flatshop')); }   // 5.3.4: tilt in as we pull back
      const zoom = go(WORLD.cam, [{ transform: from }, { transform: from, offset: .08 }, { transform: 'none' }], 1150);
      SFX.play('wipeOut', true);
      await wait(620);
      body.remove('cam-hide');                     // the stands, the lights and the chrome come up
      await zoom;
      WORLD.cam.getAnimations().forEach(a => a.cancel());
      WORLD.anim = false;
      layoutWorld();
      body.remove('cam-foe');                      // the other side walks on (the intro brings them)
      if(onOpen) onOpen();
      setTimeout(() => body.remove('cam'), T(600));
    } else {
      let to = WORLD.shopCam;
      if(!to || !WORLD.cam || !WORLD.cam.firstElementChild || (!battle && !fieldPicking)){ wiping = false; return wipe(mid, onOpen); }
      SFX.play('wipeIn', true);
      body.add('cam');
      void document.body.offsetWidth;
      body.add('cam-hide', 'cam-foe');
      await wait(320);
      if(scrollY) window.scrollTo(0, 0);
      WORLD.anim = true;
      { const W0 = WORLD.cam.getBoundingClientRect(), q = WORLD.shopRect;   // 5.3.7: back to exactly where the shop's field was
        if(q && W0.width) to = `translate(${(q.left - W0.left).toFixed(1)}px,${(q.top - W0.top).toFixed(1)}px) scale(${(q.width / W0.width).toFixed(4)})`; }
      const bst = WORLD.cam.firstElementChild;
      if(bst && flatShop()) bst.classList.add('flatshop');   // 5.3.4: and flatten again on the way back in
      await go(WORLD.cam, [{ transform: 'none' }, { transform: to }], 820);
      WORLD.cam.style.transform = to;
      WORLD.cam.getAnimations().forEach(a => a.cancel());
      WORLD.el.classList.add('shopview');
      body.add('cam-going');
      await mid();
      window.scrollTo(0, 0);
      WORLD.anim = false;
      layoutWorld();
      body.remove('cam', 'cam-hide', 'cam-foe');
      void document.body.offsetWidth;
      body.remove('cam-going');
      if(onOpen) onOpen();
      SFX.play('wipeOut', true);
      if(phase === 'shop'){
        const back = shopAway();
        await Promise.all(back.map(e => go(e, [{ opacity: 0, transform: awayFrame(e) }, { opacity: 1, transform: 'none' }], 380, { easing: 'ease-out', fill: 'backwards' })));
      }
    }
  } finally {
    wiping = false; WORLD.anim = false;
    body.remove('cam-going');
  }
}

/* ===================================================================
   BATTLE FLOW
   =================================================================== */
async function startBattle(){
  if(wiping || phase !== 'shop') return;          // v40: a second tap during the wipe does nothing
  sel = null; inspect = null;
  if(!fightersOf(G).length){
    fail(inGauntlet(G) ? 'Nobody in your party can fight — swap someone in from the PC.'
                      : 'Buy at least one pokémon first.');
    return;
  }
  endTurnEffects(G);
  await Net.submitTeam(G);
  const opp = await Net.findOpponent(G);      // <- swap Net.mode to 'online' for real PvP
  // the one way to fight a stage: wounded pokémon start hurt, fainted ones sit out
  const sim = stageBattle(G, opp);
  // an ambush: the first thing that happens is your rival walking in
  const rv = opp.kind === 'rival' ? rivalLines(G, opp.meeting) : null;
  if(rv && sim.steps[0]) sim.steps[0].lines = [`${rivalOf(G).name}: “${rv.hi}”`, ...sim.steps[0].lines];
  battle = { steps: sim.steps, i: 0, result: sim.result, oppName: rv ? `Rival ${opp.name}` : opp.name,
             boss: opp.boss || null, kind: opp.kind || 'trainer', opp, sim,
             prize: rv ? rivalPrize(G, opp.meeting) : null, bagFull: rv ? bagRoom(G) === 0 : false,
             gauntlet: nextUp(G).gauntlet,
             timer: null, exhibition: false };
  { const f = sim.result === 'win' ? floorWon(battle) : null; battle.newFloor = f && !career().floors.includes(f) ? f : null; }   // 5.5.0
  if(opp.kind === 'red'){ const r = records(); r.met = { ...(r.met || {}), [opp.boss && opp.boss.id || secretBoss().id]: true }; saveRecords(r); }   // 4.3.0: Pokédex remembers him
  sessionBattles++;
  await transition(() => { phase = 'battle'; render(); window.scrollTo(0, 0); }, beginPlayback);   // v40 wipe; 5.0.0 the camera: the intro starts as the circle opens
}
/* v36: the intro plays, then the steps. The intro shares the step timer, so
   Skip cancels it like any other step. */
function beginPlayback(){
  if(!battle) return;                                         // 4.9.0: the run was replaced while the wipe was still playing
  /* 3.7.0: Options → Trainer battles → Skip to result. Only plain trainers —
     a leader, the Elite Four, the Champion or an ambush is always shown. */
  if(battle && battle.kind === 'trainer' && !battle.exhibition && PREF.get('autoskip', 'off') === 'on'){
    clearTimeout(battle.timer); battle.timer = setTimeout(finishPlayback, 120); return;
  }
  const S = battle && battle.stage;
  const ms = S ? playIntro(S) : 0;
  clearTimeout(battle.timer);
  battle.timer = setTimeout(playback, ms);
}

/* ---------------- playback speed -----------------------------------
   A step is one pokémon's action. The old timing solved for a fixed total
   fight length, which meant a long battle flickered past at 110ms a step —
   unreadable. Now a step gets a fixed, readable beat and the player controls
   the rate. Median battle is 18 steps, p75 is 26, so 1× runs ~13–19 seconds;
   the long tail is what ⏩ and the ×4 are for. */
const SPEEDS = [1, 2, 4];
const SPEED_KEY = 'pkb_speed';
let speed = 1;
try{ const v = +localStorage.getItem(SPEED_KEY); if(SPEEDS.includes(v)) speed = v; }catch(e){}
function setSpeed(v){
  speed = v;
  try{ localStorage.setItem(SPEED_KEY, String(v)); }catch(e){}
}

const BASE_STEP_MS = 700;
/** A beat per action, plus a little longer when a step says more than one
    thing (a hit that also faints something, or an item firing). Very long
    fights tighten up a bit on their own, but never past readable. */
function stepDelay(){
  const n = battle.steps.length;
  const base = Math.max(420, BASE_STEP_MS - Math.max(0, n - 40) * 2.5);
  const lines = (battle.steps[battle.i] || {}).lines || [];
  const extra = Math.min(3, Math.max(0, lines.length - 1)) * 90;
  return Math.max(70, Math.round((base + extra) / speed));
}

function playback(){
  if(!battle) return;
  clearTimeout(battle.timer);
  if(battle.paused) return;                                   // 4.2.0: Pause holds the next step
  if(battle.i >= battle.steps.length - 1){ render(); return; }
  battle.timer = setTimeout(() => { if(!battle) return; battle.i++; advanceView(); playback(); }, stepDelay());   // 5.3.2: the run may have been replaced meanwhile
}
/* A step no longer redraws the screen: the arena animates it, and only the
   queue, the log and the counter are patched. The last step is a full render
   — that's the result screen. */
function advanceView(){
  const S = battle.stage;
  if(battle.i >= battle.steps.length - 1 || !S || !S.el.isConnected){ render(); return; }
  animateStep(S, battle.i);
  patchBattleChrome();
}
function finishPlayback(){
  if(!battle) return;
  clearTimeout(battle.timer); battle.paused = false; SFX.hold(false);
  battle.i = battle.steps.length - 1;
  render();
}

async function afterBattle(opts){
  if(!battle) return;
  clearTimeout(battle.timer);
  if(SFX.held) SFX.hold(false);   // 4.17.3: a battle finished (or left) while paused no longer leaves the game silent
  if(battle.exhibition){ const cb = battle.onDone, back = battle.back; battle = null; phase = back && back.phase === 'over' ? 'over' : 'shop'; render(); if(cb) cb(); return; }   // 6.17.0: a duel goes back to where it started
  const result = battle.result;
  await Net.reportResult(G, result);
  const opp = battle.opp, gn = battle.gauntlet;
  noteBattle(battle);                             // v37: Trainer Card records
  noteCareer(battle, result);                     // 5.5.0: career totals and home fields
  noteRunStats(battle);                           // 3.7.0: for the run summary
  applyBattleResult(G, result, opp, battle.sim);  // badges, blackout, lives, streak, EXP, wounds
  noteProgress();
  const rivalWon = opp && opp.kind === 'rival' && result === 'win' ? G.lastRival : null;
  const lost = G.blackout;
  battle = null;
  if(G.over){ noteRunEnd(); phase = 'over'; clearSave(); render(); return; }
  nextTurn(G);                        // income — or, mid-gauntlet, just an interlude
  phase = 'shop';
  save();
  if(pendingOffer(G)){ if(opts && opts.keep) return 'offer'; render(); openRewardPicker(); return; }
  if(lost) say(`You blacked out and lost ${lost}₽. ${gn ? `Back to ${gn.members[0].name} — everyone is healed.`
    : opp && opp.boss ? opp.boss.name + ' is waiting.' : ''}`);
  else if(rivalWon) say(`Rival beaten: +${rivalWon.credits}₽ in this turn's pay${rivalWon.item
    ? rivalWon.sold ? `, and +${rivalWon.sold}₽ for the ${HELD_ITEMS[rivalWon.item].name} your full Bag couldn't hold`
    : `, and a ${HELD_ITEMS[rivalWon.item].name} in your Bag` : ''}.`);
  else render();
}

/* ===================================================================
   MENU / MODALS
   =================================================================== */
function modal(html, sticky){
  const d = document.createElement('div');
  d.className = 'modal';
  d.innerHTML = `<div class="box"><div class="boxscroll">${html}</div></div>`;   // v46: the frame doesn't scroll, so text never slides over it
  if(sticky) d.classList.add('sticky');
  else d.addEventListener('click', ev => { if(ev.target === d) d.remove(); });
  document.body.appendChild(d);
  return d;
}

/* ===================================================================
   BADGE REWARDS
   Winning a badge queues a choice of three. The picker can't be dismissed —
   it's the reward, not a pop-up — and a reload brings it straight back,
   offering the same three (they come from the run's seed).
   =================================================================== */
const rewardBadgeName = b => gymAt(G, b).badge;
/** 4.0.0: a badge's look follows its leader, not its slot — the Zephyr Badge is the Zephyr Badge wherever Falkner lands. */
const badgeCls = (G, i) => { const g = gymAt(G, i), h = homeOf(g); return ((g.gen || 1) >= 2 ? 'j' : 'g') + (h ? h.slot : i % 8); };
function openRewardPicker(){
  if(document.querySelector('.modal.reward')) return;
  const off = pendingOffer(G);
  if(!off) return;
  const left = (G.pendingRewards || []).length;
  const cards = off.options.map(id => {
    const r = rewardById(id), taken = timesTaken(G, id), max = TUNING.badgeRewards[id].max;
    return `<button class="rcard" data-r="${id}">
      <span class="ricon">${r.icon}</span>
      <b>${esc(r.name)}</b>
      <span class="rtext">${esc(r.text())}</span>
      ${r.now && r.now(G) ? `<span class="rnow">${esc(r.now(G))}</span>` : ''}
      ${taken ? `<span class="rtaken">taken ${taken} of ${max}</span>` : ''}
    </button>`;
  }).join('');
  const d = modal(`<div class="rhead">${bossArt(gymAt(G, off.badge), 'hero')}<i class="bdg ${badgeCls(G, off.badge % 8)} on big"></i>
      <div><h3>${esc(rewardBadgeName(off.badge))} Badge</h3>
      <p class="rsub">Choose one reward to keep for the rest of the run.${
        left > 1 ? ` <b>${left - 1} more</b> after this.` : ''}</p></div></div>
    <div class="rcards">${cards}</div>`, true);
  d.classList.add('reward');
  d.querySelectorAll('[data-r]').forEach(b => b.onclick = () => {
    const r = chooseReward(G, b.dataset.r);
    d.remove();
    if(!r.ok){ fail(r.why); return; }
    save();
    if(pendingOffer(G)){ render(); openRewardPicker(); return; }
    say(r.gift ? `Gift Item: a ${HELD_ITEMS[r.gift].name} is in your Bag.`
               : `${rewardById(r.id).name}: ${rewardById(r.id).text()}`);
  });
}

/** Tap the badge case: every badge you hold and the reward it bought. */
function openBadgeInfo(){
  const log = G.rewardLog || [];
  const rows = bossPlanOf(G).gyms.slice(0, TUNING.badgesToWin).map((g, i) => {
    const got = i < G.badges, e = log.find(x => x.badge === i), r = e && rewardById(e.id);
    return `<div class="brow ${got ? '' : 'locked'}"><i class="bdg ${badgeCls(G, i)} ${got ? 'on' : ''}"></i>
      <b>${esc(g.badge)} Badge</b><span class="dim">${bossArt(g, 'tiny')}${esc(g.name)}</span>
      <span class="bpick">${!got ? '—' : r ? `${r.icon} ${esc(r.name)}` : 'reward not chosen yet'}</span></div>`;
  }).join('');
  const P = id => perk(G, id);
  const totals = [
    P('pcRow') && `PC ${pcCap(G)} slots`, P('pocket') && `Bag ${bagCap(G)} slots`,
    P('allowance') && `+${P('allowance')}₽ every turn`, P('freeRoll') && `${P('freeRoll')} free reroll${P('freeRoll') > 1 ? 's' : ''} a turn`,
    P('piggy') && `carry over up to ${carryCap(G)}₽`, P('training') && `${P('training')} bonus rounds of EXP`,
    P('gift') && `${P('gift')} gift item${P('gift') > 1 ? 's' : ''}`,
  ].filter(Boolean);
  const d = modal(`<h3>Badges</h3>
    <p>Every badge offers three rewards and you keep one.</p>
    <div class="blist">${rows}</div>
    ${totals.length ? `<h4>What they add up to</h4><p>${totals.join(' · ')}</p>` : ''}
    <div class="btnrow">${pendingOffer(G) ? '<button class="btn primary" data-m="pick">Choose your reward</button>' : ''}
    <button class="btn ghost" data-m="close">Close</button></div>`);
  d.querySelectorAll('[data-m]').forEach(b => b.onclick = () => {
    d.remove(); if(b.dataset.m === 'pick') openRewardPicker();
  });
}


/* ---- WHAT'S NEW --------------------------------------------------
   One entry per published version, newest first, written for players.
   Add the new version's entry here every time GAME_VERSION is bumped —
   test.js fails if the current version has no entry. ---------------- */
const CHANGELOG = [
  { v:'6.17.1', date:'Oct 16, 2026', title:'Visual bug fixes', sub:'Duels team picker: the box no longer jumps', items:[
    'Picking a pok\u00e9mon from your duel box no longer moves the box under your finger.',
    'Your team shows as six fixed places (Front, Middle, Back) with smaller move and remove buttons.',
    'The message and Lock in button stay at the bottom of the window, always in reach.',
    'Box cards fill the width, and the Duels window is wider on a computer.',
  ] },
  { v:'6.17.0', date:'Oct 14, 2026', title:'Minor gameplay changes', sub:'Duels clean-up: live link only, and a finished duel no longer opens a run', items:[
    'A duel now goes back to where you started it: the title screen, or the run you had open. Before, finishing a duel from the title screen dropped you into a new run.',
    'Duels are played over the live link only: the long copy-and-paste codes are gone. Host gets a 4-letter code, your friend types it.',
    'Team code and Vs friend are gone from the menu (Duels replaces them).',
    'The button after a duel says Back to the set.',
  ] },
  { v:'6.16.0', date:'Oct 14, 2026', title:'Minor gameplay changes', sub:'Duels: live link works on any network', items:[
    'Live link now goes through Pok\u00e9Arena\u2019s own relay on the Cloudflare copy, so phones on mobile data or strict Wi-Fi can still link up.',
    'The direct link and swapping codes by hand still work as before when the relay can\u2019t be reached.',
  ] },
  { v:'6.15.0', date:'Oct 13, 2026', title:'Minor gameplay changes', sub:'Duels: join with a 4-letter code', items:[
    'Host taps Host and gets a 4-letter code; your friend taps Join and types it. No more long codes.',
    'A free matchmaking server only introduces the two phones; teams never pass through it.',
    'Inside the claude.ai preview the shared live room carries the same code.',
    'Swapping team codes by hand still works as a backup.',
  ] },
  { v:'6.14.1', date:'Oct 13, 2026', title:'Visual bug fixes', sub:'Live link no longer errors on the preview page', items:[
    'Direct phone links are blocked on the claude.ai preview page, so the live link now says so instead of failing.',
    'On that page you can use a shared live room instead: one player creates a room code, the other joins it.',
    'Installed app and normal browsers still use the direct link.',
  ] },
  { v:'6.14.0', date:'Oct 13, 2026', title:'Minor gameplay changes', sub:'Duels can be watched live by both players', items:[
    'Connect two phones once with a pair of link codes, no server needed.',
    'Teams swap on their own once both are locked in, and stay hidden until then.',
    'Both press Fight, a 3-2-1 runs, and the same battle plays on both screens.',
    'Swapping codes by hand still works if the link drops or your network blocks it.',
  ] },
  { v:'6.13.1', date:'Oct 13, 2026', title:'Visual bug fixes', sub:'Developer tools can be switched on by tapping the Duels heading five times', items:[
    'The #dev page address trick does not work inside the published page, so tap the Duels heading five times to show or hide the developer tools (add maxed pok\u00e9mon, fill the box, clear).',
  ] },
  { v:'6.13.0', date:'Oct 13, 2026', title:'Major gameplay update', sub:'Duels preview: save pok\u00e9mon from your runs and battle a friend by code', items:[
    'New Duels screen on the title menu and in-game menu. Finish a run and save up to 3 pok\u00e9mon from a win, or 1 from a loss, into a 30-slot duel box. Saved pok\u00e9mon are frozen: their level, stats and held item never change.',
    'A set is best of three, six against six, with each team inside a power budget of 4200. A pok\u00e9mon that faints sits out the next game only. The items on your first six are your pool for the set, and from game 2 you can move them around; a pok\u00e9mon swapped in from the box arrives without its own item.',
    'Friend codes only: lock in your team to get a code, send it, paste your friend\'s and you both watch the same battle (it is decided by a seed made from both codes, so no server is needed). You can only open their code after yours is locked, so nobody can peek and counter-pick. A code from a different game version, a damaged code or a team over budget is refused.',
    'Preview: this lives on its own branch and page while it is tested. Add #dev to the page address once to get developer tools that fill your box with maxed pok\u00e9mon.',
  ] },
  { v:'6.12.0', date:'Oct 13, 2026', title:'Balance patch', sub:'Amulet Coin halved, Lucky Egg stronger, Exp. Share cheaper', items:[
    'The money and EXP items were measured with full bot runs. Amulet Coin (+2\u20bd a turn) was worth about 9.5 points of clear rate, the strongest item in the game, so it now gives +1\u20bd a turn (about 6 points, in line with the role items).',
    'Lucky Egg was worth about 5 points for a Rare item, so each pok\u00e9mon can now take 12 bonus rounds instead of 10 (about 6.5 points).',
    'Exp. Share was worth about 2.5 points for 6\u20bd, so it now costs 5\u20bd. (Two rounds of EXP per use was tried and made Red far too easy, because the bot stacks many of them, so it stays at one round.)',
    'Checked and left alone: Rare Candy (about +3 for 4\u20bd), Training Manual (+4 to +6), the plain vitamins and the role vitamins. The vitamins are weak one at a time, but raising them lifted the bot\u2019s clear rate by 6\u20139 points, so they stay as they are. Overall clear rate is unchanged.',
  ] },
  { v:'6.11.0', date:'Oct 13, 2026', title:'Balance patch', sub:'Every held item re-measured: Scope Lens, Black Belt and two Uncommon items buffed, Soothe Bell trimmed', items:[
    'Each held item was measured on all four roles. Scope Lens (+28% Attack) added under 2 points of win rate on a Cannon and Black Belt about 4, against 6\u20138 for the other role items, so: Scope Lens +28% \u2192 +70% Attack (still \u22128% HP); Black Belt +14% \u2192 +22% HP and Attack; Soothe Bell +15% \u2192 +12% Speed (it was the strongest item in the game on a Support).',
    'Assault Vest takes 20% less damage instead of 15%, and Expert Belt gives +28% Attack instead of +20%. Both were adding about 3 points, the weakest of the Uncommon items.',
    'Focus Band was only adding about 3 points, too little for a Rare item, so it goes back to Uncommon.',
    'Each role item now adds roughly 6 points of win rate on its own role. Elite Four and Champion pok\u00e9mon are unaffected by the role items (they never hold them), but they can hold Assault Vest and Expert Belt, so those fights were re-measured.',
  ] },
  { v:'6.10.0', date:'Oct 13, 2026', title:'Balance patch', sub:'Choice Band, Life Orb and Heart Scale got stronger, to keep up with the role items', items:[
    'Measured on their best-fit holder, the Very Rare items trailed the role items (Bulk Plate and Soothe Bell add about 6\u20137 points of win rate; Choice Band and Life Orb added 2\u20134, and Heart Scale only helped Supports). Iron Ball was already on par and is unchanged.',
    'Choice Band: +30% Attack \u2192 +45% Attack (still \u22125% HP and main move only). Life Orb: 50% \u2192 75% more damage (still 6% HP per hit). Heart Scale: heals doubled \u2192 130% bigger, and the Attack penalty \u221215% \u2192 \u221210%.',
    'Each now adds roughly 6 points of win rate on its best holder. Elite Four and Champion pok\u00e9mon can hold them too, so those fights were re-measured.',
  ] },
  { v:'6.9.0', date:'Oct 11, 2026', title:'Balance patch', sub:'The four role-specific held items are now Rare', items:[
    'Bulk Plate, Black Belt, Soothe Bell and Scope Lens are now Rare instead of Uncommon, so each turns up in a shelf slot 25% as often as a Common item instead of 60%. The Pok\u00e9dex shows the new chance.',
  ] },
  { v:'6.8.0', date:'Oct 11, 2026', title:'Minor gameplay changes', sub:'Every Pok\u00e9Mart shelf now has at least one evolution stone', items:[
    'The Pok\u00e9Mart always stocks at least one evolution stone (or King\u2019s Rock, Dragon Scale, Metal Coat) when someone in your party can use one, on every refresh and reroll. A reserved item is never pushed out to make room.',
    'If nobody you own can evolve with a stone, none is stocked, as before.',
    'Rarity pass: King\u2019s Rock, Dragon Scale and Metal Coat are now Uncommon (they only help a couple of pok\u00e9mon) and Focus Band is now Rare.',
  ] },
  { v:'6.7.0', date:'Oct 10, 2026', title:'Minor gameplay changes', sub:'Hoenn bosses can field Kanto and Johto pok\u00e9mon, like Johto bosses always could', items:[
    'Hoenn leaders, the Elite Four and Wallace now field Gen 1 and Gen 2 pok\u00e9mon even when the run does not sell them. Before, a Gen 3-only run quietly dropped most of their hand-picked bodyguards (Glacia\u2019s Lapras and Jynx, Drake\u2019s Dragonite and Charizard, Brawly\u2019s Machamp, Wattson\u2019s Raichu), and a Gen 1+3 run dropped the Gen 2 ones.',
    'Each leader draws on the Gen 1 and Gen 2 pok\u00e9mon that live in Hoenn (the Zubat, Geodude, Machop, Abra, Oddish, Magikarp and Marill lines and a few more) plus the ones that leader was built around. Nobody borrows another leader\u2019s picks, so Flannery does not get a Charizard and Winona does not get a Dragonite. Legendaries stay out of trainer teams.',
    'Kanto and Johto bosses are unchanged. Re-measured across all four Gen 3 combinations: every Hoenn boss\u2019s win rate moved by 2 points or less, which is within the noise of the measurement, so no difficulty values needed re-tuning.',
  ] },
  { v:'6.6.1', date:'Oct 10, 2026', title:'Visual bug fixes', sub:'The pok\u00e9mon summary shows which vitamin limit each item fills', items:[
    'A pok\u00e9mon\u2019s summary now shows one line per vitamin limit (Attack, HP and Speed) and lists which items filled it, so Energy Root no longer appears as \u201cCarbos\u201d. Calcium counts as an Attack vitamin, Iron and Zinc as HP vitamins, and Energy Root as a Speed vitamin; the limit of 10 is unchanged.',
    'The summary also shows Training Manuals against the current limit (it grows with your badges), and a role medicine\u2019s description says which limit it shares and with whom.',
  ] },
  { v:'6.6.0', date:'Oct 10, 2026', title:'Minor gameplay changes', sub:'Training Manuals: the limit grows with your badges', items:[
    'A pok\u00e9mon can now take 1 Training Manual at the start of a run, and one more for every 2 badges you win, up to 5 with all eight. It used to be a flat 3, so early on you must choose who gets the training, and by the Elite Four you can train your main team much further.',
    'The Training Manual\u2019s description and the message you get when a pok\u00e9mon is full both show the current limit.',
  ] },
  { v:'6.5.1', date:'Oct 10, 2026', title:'Visual bug fixes', sub:'The nine new items have their own artwork', items:[
    'Iron, Calcium, Zinc, Energy Root, Training Manual, Bulk Plate, Black Belt, Soothe Bell and Scope Lens now show their own pixel art in the Mart, the Bag, the Pok\u00e9dex and on the pok\u00e9mon holding them, instead of an emoji.',
  ] },
  { v:'6.5.0', date:'Oct 10, 2026', title:'Major gameplay update', sub:'May joins as the Hoenn rival, every role gets its own items, and the Mart stops rolling all one kind', items:[
    'May is now the Gen 3 rival, with her own portrait and lines. Like Blue\u2019s Eevee, her Support is always the same pok\u00e9mon: a Ralts that grows up through Kirlia into Gardevoir, alongside her Taillow and a starter that beats yours.',
    'The Mart no longer rolls a shelf of one kind. No shelf repeats an item, and no more than half of a shelf\u2019s slots share a category: medicine splits into vitamins, evolution items and boosts, held items into stat, trigger and economy. Reserved items still stay put and count toward the mix. (The very first shelf only sells Protein and HP Up, so it is unchanged.)',
    'Four role medicines, each a stronger vitamin only that role can take: Iron (+9 HP, Tanks), Calcium (+10 Attack, Cannons), Zinc (+5 HP and +6 Speed, Supports) and Energy Root (+4 to every stat, Bruisers). They count toward the same cap of ten as the vitamin they replace, so a role vitamin makes a slot worth more but never raises the ceiling.',
    'Training Manual: trains a pok\u00e9mon a little in the way its role grows (a Tank mostly HP, a Cannon mostly Attack), up to 3 per pok\u00e9mon.',
    'Four role held items, greyed out on the wrong role like Eviolite: Bulk Plate (Tank, +25% HP and 8% less damage), Black Belt (Bruiser, +14% HP and Attack), Soothe Bell (Support, heals 50% bigger and +15% Speed) and Scope Lens (Cannon, +28% Attack, \u22128% HP).',
    'The Mart only stocks a role item if you own a pok\u00e9mon of that role. Gym leaders, Elite Four and rivals never carry them, so no boss was changed.',
  ] },
  { v:'6.4.1', date:'Oct 10, 2026', title:'Visual bug fixes', sub:'The Pok\u00e9dex uses real Pok\u00e9dex numbers and order', items:[
    'The Pok\u00e9dex now numbers every pok\u00e9mon with its real National Pok\u00e9dex number and lists them in that order, from Bulbasaur #001 through Jirachi #385, instead of numbering them by shop tier. The numbers skip the pok\u00e9mon the game doesn\u2019t have, so Ivysaur is still #002 and Pikachu is #025.' ] },
  { v:'6.4.0', date:'Oct 10, 2026', title:'Balance patch', sub:'Roselia was the weakest pok\u00e9mon in the game; now it holds its own', items:[
    'Roselia\u2019s main move was a 40% chance to paralyse, which left it winning about 31% of matchups when a typical support wins about 50%. Pok\u00e9mon whose main move only inflicts a status all measured low, and Roselia also had the lowest stats of any support. Its main move is now Magical Leaf, a light hit that slows the target, and its second move is Stun Spore, paralysing a random enemy every third action. It now measures about 51%, in line with the other supports.' ] },
  { v:'6.3.0', date:'Oct 10, 2026', title:'Balance patch', sub:'Hoenn catches up: three more lines, stone evolutions and every difficulty setting measured', items:[
    'Bagon, Aron and Beldum join Hoenn with their full lines: Salamence is a Dragon Cannon that powers up with Dragon Dance, Aggron a Steel Tank behind Iron Defense, and Metagross a Steel Cannon that opens with Focus Energy. That gives Dragon and Steel enough lines for Mono runs, so Mono-Steel is now possible in any run that includes Gen 2, and Mono-Dragon in every Hoenn run. Drake now fields Salamence, and Steven leads with Metagross and Aggron.',
    'Lombre now evolves into Ludicolo with a Water Stone, and Nuzleaf into Shiftry with a Leaf Stone, like the Kanto and Johto stone evolutions.',
    'The Daily Challenge can now be Gen 3, alone or mixed with Gen 1 and Gen 2.',
    'Every Hoenn gym leader, Elite Four member and Wallace now has a curated list of off-theme bodyguards, a line to open the fight with, and signature-move effects for the big finals and legendaries (Blaziken, Sceptile, Swampert, Gardevoir, Milotic, Salamence, Metagross, Kyogre, Groudon, Rayquaza and more).',
    'Difficulty was measured, not guessed, for every run that includes Gen 3. Gen 3 alone, Gen 1+3, Gen 2+3 and Gen 1+2+3 now clear at the same rate the older combinations do (they were up to 60 points harder or easier before), and every Mono type, No PC and One Life run was tuned for them as well. Hoenn bosses are unchanged apart from the bodyguards.' ] },
  { v:'6.2.1', date:'Oct 10, 2026', title:'Visual bug fixes', sub:'Gen 3 pok\u00e9mon are the same size as the rest', items:[
    'Hoenn pok\u00e9mon were drawn small inside a wide, mostly empty picture, so they looked tiny next to Kanto and Johto. Their art is now trimmed and sized the same way as the others, in the party, the shop, battles, the Pok\u00e9dex and trading cards.' ] },
  { v:'6.2.0', date:'Oct 10, 2026', title:'Minor gameplay changes', sub:'Every Gen 3 pok\u00e9mon now has a second move', items:[
    'Every Hoenn pok\u00e9mon, legendaries included, now has a second move like Kanto and Johto do. They reuse the same moves with the same effects: Treecko\u2019s line Sand Attack, Torchic\u2019s and Cacnea\u2019s lines Swords Dance, Mudkip\u2019s line Amnesia, Lotad\u2019s line and Roselia Aromatherapy, Ralts\u2019s line Light Screen and Reflect, and Slakoth\u2019s line Slack Off, to name a few. Kyogre has Haze, Groudon Swords Dance, Rayquaza Focus Energy, Jirachi Wish, and the three Regis each a barrier.',
    'Thirty Gen 3 moves were renamed so that a move name always means the same effect on every pok\u00e9mon (Regice\u2019s Ice Beam is now Frost Breath, Milotic\u2019s Recover is Aqua Ring, Treecko\u2019s Quick Attack is Leaf Dash, and so on). Their damage and effects did not change.',
    'The Hoenn bosses were re-measured with the new moves in place and still land where they were set, so no boss was re-tuned.' ] },
  { v:'6.1.0', date:'Oct 9, 2026', title:'Balance patch', sub:'Gen 3 bosses measured, not guessed, and four more subrole lines', items:[
    'Every Gen 3 gym leader, Elite Four member and Wallace were re-priced by actually simulating thousands of fights against a reference team at their slot, instead of borrowing a Gen 1 leader\u2019s numbers \u2014 so Hoenn\u2019s ladder now plays to the same difficulty curve Kanto and Johto already do, measured the same way.',
    'Four more lines pick up a subrole \u2014 Magnemite/Magneton, Makuhita/Hariyama, Swinub/Piloswine, and Snorunt/Glalie, all Tank leaning Bruiser, across Gen 1, Gen 2 and Gen 3. A wider sweep of the whole roster was run first and, true to the original worry, mostly came back as noise: base stats are too small a slice of a grown pok\u00e9mon to mean much on their own, so only lines where every stage agreed and the lean matched how the pok\u00e9mon actually plays made the cut. Most of the roster stays single-role \u2014 subroles are staying rare on purpose.' ] },
  { v:'6.0.0', date:'Oct 9, 2026', title:'Major gameplay update', sub:'Gen 3 (Hoenn) joins the game, with a new subrole system', items:[
    'Gen 3 is here: a curated Hoenn roster (Treecko, Torchic and Mudkip\u2019s lines, Milotic, Flygon, Gardevoir, Absol and more), Kyogre, Groudon, Rayquaza and Jirachi as encounter-only legendaries alongside Regirock, Regice and Registeel, and a full set of Hoenn bosses: Roxanne through Juan, Sidney through Drake, and Champion Wallace. Turn it on from New Run like Gen 1 and Gen 2.',
    'Steven joins Red and Oak as a secret boss: about one run in six after the Champion, Hoenn runs may find him waiting at Meteor Falls for one chance, no rematch.',
    'New: subroles. A handful of pok\u00e9mon \u2014 Milotic, Altaria, Camerupt, Walrein and Registeel \u2014 blend a touch of a second role\u2019s growth into their own (Milotic leans Tank on top of its Support growth, for instance). Their role, trait and move legality are unchanged; only how their stats grow shifts, and it shows up as a small tag on their summary and Pok\u00e9dex card. Everyone else grows exactly as before.',
    'The secret-boss draw is now data-driven instead of hardcoded to two, so Red, Oak and Steven are each offered when their gen is in the run and the odds split evenly across however many are active.' ] },
  { v:'5.12.2', date:'Oct 8, 2026', title:'Visual bug fixes', sub:'Computer: summaries fit their card without scrolling', items:[
    'On a computer, the summary card for a pok\u00e9mon or an item is now only as tall as what it shows (an item\u2019s card no longer fills the column with empty space), starts just under the PC, and is laid out tighter, so a pok\u00e9mon\u2019s whole summary fits without scrolling. On short screens the role description is trimmed to fit.' ] },
  { v:'5.12.1', date:'Oct 8, 2026', title:'Visual bug fixes', sub:'Phone: the Battle bar stays at the bottom, and picking or buying no longer makes the page jump', items:[
    'On a phone the Battle bar is now pinned to the bottom of the screen. On iPhones it could get stuck partway up the page after a fast scroll.',
    'Picking or buying something no longer makes the page jump. The game was correcting the scroll position twice on some phones (once itself, once the browser), and measured the page before the pick bar had appeared; the page also keeps the same room at the bottom whether something is picked or not.' ] },
  { v:'5.12.0', date:'Oct 7, 2026', title:'Minor gameplay changes', sub:'A new Pokédex: a full-screen numbered grid with trading cards', items:[
    'The Pok\u00e9dex opens full-screen with a progress bar for how many you\u2019ve seen. Pok\u00e9mon are a numbered grid of tiles coloured by type (families still sit together, in order), with filters by type as well as by section and gen, and search.',
    'Pok\u00e9mon you haven\u2019t seen yet are dark silhouettes marked ???, so the Pok\u00e9dex is something to fill in.',
    'Tap one and it flips open as a trading card framed in its type colour: its art, number, types and role, both moves, its stat triangle and numbers, and its tier. Its evolution line, matchups and the trainers who use it are underneath. Pok\u00e9mon with a signature move say so.' ] },
  { v:'5.11.0', date:'Oct 7, 2026', title:'Minor gameplay changes', sub:'Legendaries are hinted at before they arrive, and walk onto your field', items:[
    'A hint before a legendary: when beating the next gym leader will bring one, the leader says so as they walk out (\u201cSomething rare has been spotted near here\u201d), and the shop shows a gold \u201cRumour\u201d line under who you\u2019re fighting next. Lose the fight and it never comes.',
    'When it appears, the legendary walks onto your field from the far side, stops in a gold flash, then steps away into its offer card, along with the banner.' ] },
  { v:'5.10.1', date:'Oct 7, 2026', title:'Visual bug fixes', sub:'The legendary encounter is easier to see', items:[
    'When a legendary appears, a banner with it now flashes up in the middle of the screen, so it can\u2019t be missed.',
    'On a computer and a sideways phone, the encounter card floats over the top of your field instead of pushing the field down, so your party stays where it was.',
    'The card shows the legendary\u2019s stat triangle and stat icons instead of the old symbols, and says plainly that the offer only lasts until your next battle.' ] },
  { v:'5.10.0', date:'Oct 7, 2026', title:'Minor gameplay changes', sub:'Signature moves, field weather and an Effects setting', items:[
    'Signature moves: the big finals and the legendaries have their own effect when they use their main move. Charizard, Typhlosion, the fire dogs and birds wrap the target in a ring of flame; Blastoise, Feraligatr and the water and ice finals fire a thick beam (Venusaur and Meganium a green solar beam, Dragonite and Gyarados a hyper beam); Pikachu, Raichu, Jolteon, Zapdos, Raikou and Ampharos call lightning down from the sky; Gengar and Umbreon open a dark vortex; Alakazam, Espeon, Mew and Mewtwo make the target glow and burst; Machamp, Heracross and Scizor land a three-hit combo; Snorlax, Golem, Tyranitar and Steelix send a shockwave across the field.',
    'Field weather: a super-effective hit or a knockout warms the field for a moment if it was a Fire move, frosts it if Ice, flashes it if Electric, and a Water one leaves puddles under the target that slowly dry.',
    'Options \u2192 Effects: Full, Light or Off. Light keeps the move effects but drops trails, signature moves, weather and half the particles, for older phones. Off shows only the numbers.' ] },
  { v:'5.9.0', date:'Oct 7, 2026', title:'Minor gameplay changes', sub:'Move effects and particles redone: a look for every type, sized to the screen', items:[
    'Every type now has its own move effect. Before, several borrowed another type\u2019s. Fire throws a fireball with a trail of embers, Water a spray of droplets, Electric a jagged lightning bolt that flickers across, Grass a volley of leaves, Ice icicles, Poison lobbed sludge, Ghost a wobbling shadow ball, Dragon a purple dragon flame, Bug pins, Rock thrown rocks, Steel spinning shards, Flying three crescents of wind, Psychic rings that close in, Dark a crossing shadow slash, Normal a double slash, Fighting a punch, and Ground cracks the earth under the target and throws up dust.',
    'Effects and particles are sized to the pok\u00e9mon on screen, so they read the same on a phone and on a big monitor (on computers they were tiny).',
    'Knockouts and super-effective hits throw more particles.',
    'Status effects show as particles instead of emoji: flames rise off a burn, bubbles off poison, sparks crackle round paralysis, pink stars circle confusion and white stars flash on a flinch. Sleep keeps its Zs.' ] },
  { v:'5.8.1', date:'Oct 7, 2026', title:'Minor gameplay changes', sub:'Item hints, and stat triangles that keep their shape as your team grows', items:[
    'Pick a vitamin or a held item and the party pok\u00e9mon that gains the most from it gets a gold star beside its triangle. Turn it off in Options \u2192 Item hints.',
    'Stat triangles now scale with your team instead of a fixed cap, so pok\u00e9mon that have levelled up or evolved no longer fill their whole triangle. Each corner reaches as far as that stat goes compared with the best on your team, so you can still see each pok\u00e9mon\u2019s build (and what grew) all run long. Opponents\u2019 triangles are measured against your team too.' ] },
  { v:'5.8.0', date:'Oct 7, 2026', title:'Minor gameplay changes', sub:'Vitamins and held items show what they would do on each triangle', items:[
    'Pick a vitamin in the Mart, or a held item in the Mart or your Bag, and every pok\u00e9mon it can go on shows its triangle with the item as a dashed outline over its own shape. You can see who gains the most before you use or buy it. Pok\u00e9mon it would do nothing for (a full vitamin, the item it already holds) show no outline.',
    'Iron-out: on a computer the crowd in the stands is drawn as small, close dots instead of a grid of big circles, the Your Party header sits on a dark strip so the field\u2019s edge no longer runs through it, and the stat triangles are a little bigger. On a sideways phone the summary card is solid and its stat rows no longer squash the labels. The \u201ctap a slot\u201d pill no longer sits on top of the summary card there.' ] },
  { v:'5.7.0', date:'Oct 7, 2026', title:'Minor gameplay changes', sub:'Compare triangles when buying, triangles that grow, and opponents shown by shape', items:[
    'Pick a pok\u00e9mon in the Daycare and every party triangle also shows its shape as a dashed outline, so you can see at a glance who it beats on Attack, HP or Speed before you buy.',
    'After a battle, a pok\u00e9mon whose stats grew shows it on its triangle: the old shape fades out under the new one, the triangle pops and the corner that grew pulses.',
    'Opponents\u2019 summaries (tapping one in battle or in the scouting report) show a large stat triangle instead of exact numbers, so you can read their build without the precise figures.' ] },
  { v:'5.6.0', date:'Oct 7, 2026', title:'Minor gameplay changes', sub:'Stat triangles on the field, stat bars in the summary', items:[
    'Your party on the field now shows a small stat triangle beside each pok\u00e9mon instead of number tags. Each corner is a stat (red sword Attack at the top, green heart HP bottom-left, blue bolt Speed bottom-right) and the gold shape stretches towards what it is good at: Snorlax leans to the heart, Pikachu to the bolt. The level sits over its head.',
    'The exact numbers are one tap away: the summary now has a bar for each stat with its icon, in Attack, HP, Speed order, coloured like the triangle.' ] },
  { v:'5.5.2', date:'Oct 7, 2026', title:'Visual bug fixes', sub:'A dark stadium behind every field, stat icons, a proper summary on computers and a calmer gym win', items:[
    'The page behind the field is now the dark stadium with its crowd, and it stays the same on every stage instead of changing colour with the floor.',
    'Stats have icons: a red sword for Attack, a green heart for HP and a blue bolt for Speed, on little dark tags over your party and in the Daycare, the Pok\u00e9dex and How to play, instead of plain numbers.',
    'On a computer, a pok\u00e9mon\u2019s or item\u2019s summary opens as a full card in the shop column, under the PC and Bag (so you can still drop things there), instead of a squashed strip in the bottom-left corner.',
    'After a gym win the camera no longer sweeps around the team. The crowd still cheers and the confetti still falls.',
    'The Champion\u2019s photo: fainted pok\u00e9mon no longer stay greyed out on the field while the team lines up for the picture.' ] },
  { v:'5.5.1', date:'Oct 6, 2026', title:'Visual bug fixes', sub:'A new name, PokéArena, and no more all-caps lettering', items:[
    'The game has a new name: Pok\u00e9Arena, on the title screen, the browser tab, the share image and the home-screen app (with a PA icon). Your saves, records and Trainer Card carry over untouched.',
    'No more shouting: words keep their own capitals across the game. Menu, Tap to play, the title menu, tags, buttons, ribbons (\u201cVictory!\u201d, \u201cBoulder Badge!\u201d) and labels are written normally instead of in all caps.' ] },
  { v:'5.5.0', date:'Oct 6, 2026', title:'Minor gameplay changes', sub:'The stadium comes alive: floodlights for your badges, home fields to unlock and a career on your Trainer Card', items:[
    'The stands are back, redrawn: a dark bowl behind the field with eight floodlights along the top. One more light comes on for every badge you hold (you see it switch on as the leader hands the badge over), and the crowd fills up as you go. The Elite Four, the Champion and the secret bosses play to a full house with every light on.',
    'Home fields: beat a gym leader or Elite Four member and their floor is yours. So are your rival\u2019s dusk pitch, the League hall and Mt. Silver. Pick one on the Trainer Card and your ordinary trainer battles, and the shop before them, are played on it. Boss fights keep their own floors.',
    'The Trainer Card has a Career board: battles won, gym leaders and Elite Four beaten, Champion wins, your fastest clear, your biggest hit and your favourite pok\u00e9mon. It starts from your run history, and transfer codes carry it along.',
    'The home-screen app has a new icon: PB on the pitch, in place of the old Game Boy box.' ] },
  { v:'5.4.0', date:'Oct 6, 2026', title:'Minor gameplay changes', sub:'The last of the Game Boy style retired: a stadium look from the title to the menus', items:[
    'New lettering: headings, buttons and the scoreboard use a bold sports font instead of the pixel font. The pok\u00e9mon keep their pixel art.',
    'The title says TAP TO PLAY and fades into the stadium, and the yellow START button is now a MENU button. The menu is a clean list with a highlighted row instead of the \u25b6 cursor.',
    'Softer sounds: rounder tones replace the Game Boy beeps.',
    'The info box shows its text straight away instead of typing it out letter by letter, so Options no longer has a Text setting.',
    'The pok\u00e9ball wipe is retired: Transitions are now Camera, Quick or Off.' ] },
  { v:'5.3.10', date:'Oct 6, 2026', title:'Visual bug fixes', sub:'Iron-out: tidier boss scenes', items:[
    'The badge a leader hands over now rises beside them instead of on top of their speech bubble, and flies to your team from there.',
    'The extra \u201cPick one\u201d bubble over the reward cards is gone; the cards\u2019 own header already says it, and on a sideways phone the two overlapped.' ] },
  { v:'5.3.9', date:'Oct 6, 2026', title:'Visual bug fixes', sub:'+EXP and Level up show over your pok\u00e9mon again', items:[
    'After a battle each pok\u00e9mon shows +EXP over it again, with what grew (for example \u25c6+1 \u2665+2). Battle EXP grows a pok\u00e9mon\u2019s stats rather than its level, so the pop-up had stopped firing.', 'The +EXP, Level up and evolution pop-ups now ride on the pok\u00e9mon\u2019s own spot, so they appear right over it even while the party is settling back onto the field.' ] },
  { v:'5.3.8', date:'Oct 6, 2026', title:'Visual bug fixes', sub:'Party spots hold still on iPhone, and the camera no longer cuts off', items:[
    'On an upright phone the party\u2019s spots are now worked out from the page layout itself instead of from where the phone says things are on screen, which lags while the page scrolls. Picking a pok\u00e9mon scrolls the page, and that was dragging your party off the field.',
    'The camera move between the shop and a battle uses the whole screen, so the field is no longer cut off part-way down.',
    'For now the stadium is just its floor: the sky, stands and crowd behind it are gone while a new backdrop is worked out.' ] },
  { v:'5.3.7', date:'Oct 6, 2026', title:'Visual bug fixes', sub:'The party stays put on the field when you pick a pok\u00e9mon', items:[
    'On an upright phone the shop\u2019s field now lives inside the party\u2019s own panel instead of behind the whole page, so the field and your pok\u00e9mon move as one. Picking a pok\u00e9mon, closing a tip or scrolling can no longer slide the field out from under them.',
    'The page around the field now takes the colours of whatever stadium is showing (sky blue for Falkner, purple for the League, deep green on routes), in the shop and in battle, so the background always matches the field.' ] },
  { v:'5.3.6', date:'Oct 6, 2026', title:'Visual bug fixes', sub:'Every spot\u2019s ring sits where a pok\u00e9mon stands', items:[
    'The rings on empty party spots now sit exactly where a pok\u00e9mon\u2019s feet go, so empty and filled spots line up row by row.',
    'On phones the field sits a little lower, so the front row\u2019s numbers no longer run into the halfway line and the Formations button.' ] },
  { v:'5.3.5', date:'Oct 6, 2026', title:'Visual bug fixes', sub:'Party spots line up on iPhone', items:[
    'The party\u2019s spots are now placed all at once, then checked: if a spot did not land exactly where it was aimed, it is nudged into place. On iPhones every spot after the first was landing too low, which is why the rings sat off the grid when picking where to put a pok\u00e9mon.' ] },
  { v:'5.3.4', date:'Oct 6, 2026', title:'Visual bug fixes', sub:'Party spots on iPhone, for real this time', items:[
    'On iPhones the shop\u2019s field now lies flat, a straight-down close-up of your half. iPhones drew the tilted field somewhere other than where they reported it, so the empty-spot rings never lined up. Flat, every spot sits exactly under its ring. The field still tilts into the stadium as the camera pulls back for a battle.',
    'Phones on their side: the next trainer\u2019s picture fits its box in the BATTLE bar instead of being zoomed in.' ] },
  { v:'5.3.3', date:'Oct 6, 2026', title:'Visual bug fixes', sub:'Empty-spot rings on iPhone, and the sideways shop column', items:[
    'The party\u2019s empty-spot rings are laid out a simpler way that iPhones can\u2019t get wrong, so the rings line up when you pick a pok\u00e9mon to place.',
    'Phones on their side: a pok\u00e9mon\u2019s summary only covers the shop column while you are choosing what to do with it. Cancel or finish and the shop is back.' ] },
  { v:'5.3.2', date:'Oct 6, 2026', title:'Visual bug fixes', sub:'iPhone placement fixed, and a tidy sideways layout', items:[
    'iPhones measured the tilted field wrongly, which put your party\u2019s spots in the wrong places (most visible when picking a spot) and walked bosses off-centre. The game now works out where everything sits on the field itself, so spots and bosses line up on every phone.',
    'If anything nudges the field or the party after drawing, the spots now follow straight away.',
    'Phones on their side now match the Broadcast Wide preview. The field fills the left with the party tag and ORDER strip floating on it, and the shop is a neat column on the right with a single BATTLE bar.',
    'Sideways, a pok\u00e9mon\u2019s summary opens over the shop column instead of covering the field, the pick bar sits under the column, the tips box is hidden, and the shop rows are compact. Battles have a slimmer strip so the stadium is bigger.' ] },
  { v:'5.3.1', date:'Oct 6, 2026', title:'Visual bug fixes', sub:'A clean-up pass on phones, upright and sideways', items:[
    'Your party now stays lined up on its spots on the field. Before, a font loading in or the browser bar sliding away could leave pok\u00e9mon floating off their spots or on top of each other.',
    'A battle always starts at the top of the screen, with the scoreboard showing.',
    'The result banner steps aside when the leader speaks, so it no longer covers their line.',
    'The reward cards are centred, three across, with their text inside the card.',
    'Level tags no longer sit under the role badge; the mode tag (like Gen 2) is a small label instead of a bar across the field; the leader\u2019s picture fits inside its tag.',
    'The BATTLE bar has a backing, so the Undo button never sits on top of text.',
    'Phones on their side: iPhones no longer blow the text up, the field is wider, the top bar and boxes are slimmer, the duplicate who\u2019s-next box is gone, and the game re-lays itself out properly when you turn the phone mid-game.' ] },
  { v:'5.3.0', date:'Oct 6, 2026', title:'Minor gameplay changes', sub:'Rewards on the field, bosses have the last word, and a Champion\u2019s team photo', items:[
    'Gym rewards on the field: after a gym win, Choose your reward keeps you in the stadium. The leader holds out the three reward cards on the pitch; tap one and it flies to your team, then the camera goes back to the shop.',
    'Bosses have the last word: when the fight is over, a gym leader, Elite Four member, the Champion, a secret boss or your rival walks back out and says something. Beat them and they admit it; black out and they gloat.',
    'The Champion\u2019s team photo: beat the Champion and your whole team, fainted ones included, gathers at centre field. A flash goes off and a gold frame closes round them.',
    'That photo is now your summary image for a won run, and it shows on the run\u2019s final screen.' ] },
  { v:'5.2.1', date:'Oct 6, 2026', title:'Minor gameplay changes', sub:'Release works on any party pok\u00e9mon again, and a cleaner finish after a gym', items:[
    'Fixed: Release on a party pok\u00e9mon did nothing (or let a different one go) once your party had been moved around the field. It now always lets go of the one you tapped, and if its held item can\u2019t fit in a full Bag it tells you why.',
    'The empty spots on the battle field no longer have outlines.',
    'After a gym win the leader hands the badge over on the field, so the badge box under it is gone. Continue now reads Choose your reward and takes you straight there.' ] },
  { v:'5.2.0', date:'Oct 6, 2026', title:'Minor gameplay changes', sub:'Bosses speak when they walk out, and leaders hand over their badge on the field', items:[
    'Walk-out lines: when a gym leader, Elite Four member, the Champion, a secret boss or your rival reaches the middle of the field, they say something before throwing out their team.',
    'Badge ceremony: beat a gym leader (or a secret boss) and they walk back out to the halfway line and hand you the badge. It rises over them, glowing, and flies across to your team.',
    'A fainted pok\u00e9mon\u2019s name plate now disappears with it.',
    'No more shadows sitting on empty spots while the pok\u00e9mon are still coming in: each shadow arrives with its pok\u00e9mon.' ] },
  { v:'5.1.0', date:'Oct 6, 2026', title:'Minor gameplay changes', sub:'One stadium behind every screen, and bosses walk out before they fight', items:[
    'The game now sits on a single stadium. The shop is the camera close on your half of the real battle field, with the menus floating over it, and BATTLE pulls that same camera back to the whole stadium. Nothing is swapped: the field you set up on is the field you fight on.',
    'The field in the shop is already your next opponent\u2019s stadium: a gym leader\u2019s type floor, the League, or your rival\u2019s dusk.',
    'Boss walk-out: before a gym leader, the Elite Four, the Champion, a secret boss or your rival fights, they walk onto their half to a cheer, then throw out their team. A pok\u00e9ball flies to each spot and the pok\u00e9mon appear in a flash.',
    'On a computer or a phone turned sideways, the shop column and the Battle button float on the right of the stadium, and battles keep the turn order, commentary and controls in a strip along the bottom.' ] },
  { v:'5.0.0', date:'Oct 6, 2026', title:'Major gameplay update', sub:'The Broadcast look: the whole game is the stadium', items:[
    'The shop is now a camera close-up of your half of the stadium. Your party stands on the pitch in the formation it will fight in.',
    'Going to battle, the camera pulls back to the whole stadium: the shop drops away, the stands and lights come up and the other side walks on. Continue zooms back in. Options \u2192 Transitions: Camera, Ball, Quick or Off.',
    'New look everywhere: a scoreboard along the top, gold headings, and dark glass panels over the pitch. Light theme is a sunny day, Dark is an evening match.',
    'On a computer or a phone turned sideways, the pitch sits on the left and the shop is a column on the right with the Battle button at its foot. Battles show the full stadium with the queue, commentary and controls alongside.',
    'The title screen, menus, Pok\u00e9dex, Trainer Card and every pop-up follow the new look.' ] },
  { v:'4.17.3', date:'Oct 6, 2026', title:'Visual bug fixes', sub:'No coloured spots under pok\u00e9mon, and the sound fixed', items:[
    'The blue and red spots under the pok\u00e9mon in battle are gone; each one just casts a soft shadow.',
    'Sound fix: pausing a battle and then stepping to the end, or leaving it while paused, used to mute the game until you reloaded. It doesn\u2019t any more.',
    'Sound fix: on iPhones the sound now comes back after a phone call or switching apps, and it starts more reliably on the first tap.',
  ]},
  { v:'4.17.2', date:'Oct 6, 2026', title:'Visual bug fixes', sub:'Fainted pok\u00e9mon lose the cross and the HP bar', items:[
    'A fainted pok\u00e9mon now shows only its grey silhouette and its name: the red cross and the empty HP bar are gone.',
  ]},
  { v:'4.17.1', date:'Oct 6, 2026', title:'Visual bug fixes', sub:'Smaller pok\u00e9mon in battle and a clean-up of the battle screen', items:[
    'Pok\u00e9mon stand a little smaller again on the battle field.',
    'Fainted pok\u00e9mon are now clear grey silhouettes with a cross, instead of faint shapes that all looked alike.',
    'After Skip, fainted pok\u00e9mon show an empty HP bar and lose their barrier shell.',
    'VICTORY and DEFEAT now appear in the middle of the field instead of covering the top row\u2019s names.',
    'When several notes land near the top edge at once, they stack downward instead of piling on top of each other.',
    'Phones on their side: names fit better on the battle field, and the START menu goes two columns with bigger rows to tap.',
  ]},
  { v:'4.17.0', date:'Oct 6, 2026', title:'Minor gameplay changes', sub:'Cleaner nameplates, smaller pok\u00e9mon, hit effects for every type and attacks that arc', items:[
    'Nameplates lose their dark band: only the name and the HP bar carry a shadow now, so nothing boxes in the pok\u00e9mon.',
    'Pok\u00e9mon stand a little smaller on the field, so the rows breathe.',
    'Every type has its own hit effect: embers for Fire, splashes for Water, leaves for Grass and Bug, sparks for Electric and Steel, ice shards, rock chunks, dust clouds, psychic glints, ghostly wisps, poison bubbles, stars for Normal and Fighting, purple flames for Dragon and feathers for Flying.',
    'Shots now lob up and over in an arc onto their target. Electric bolts still zigzag straight across.',
  ]},
  { v:'4.16.0', date:'Oct 6, 2026', title:'Minor gameplay changes', sub:'Pok\u00e9mon stand free in battle, with new nameplates, HP bars, status effects and barriers', items:[
    'No more card squares: on the Stadium look each pok\u00e9mon stands free on its spot, over a soft glow, with faint rings marking empty spots.',
    'A soft nameplate floats over each pok\u00e9mon\u2019s head: its name, level and status, on a dark band that fades into the field.',
    'New HP bar: green, then yellow, then red, and a white trail shows how much a hit just took. A barrier shows as a striped blue end on the bar.',
    'Status conditions show on the pok\u00e9mon itself: flames for a burn, purple bubbles for poison, sparks for paralysis, Zs for sleep and stars circling a confused head.',
    'A barrier is now a shimmering shell around the pok\u00e9mon, and it shatters into pieces when it breaks.',
  ]},
  { v:'4.15.0', date:'Oct 6, 2026', title:'Minor gameplay changes', sub:'The crowd reacts, big wins get a victory moment, and you can pick a battle look', items:[
    'The crowd reacts: camera bulbs flash in the stands on super-effective hits and knockouts, and the crowd cheers (not every time, so it doesn\u2019t get noisy).',
    'Beat a gym leader, an Elite Four member, the Champion or a secret boss and the camera sweeps along your team from front to back while confetti falls.',
    'Your pok\u00e9mon now hop on the spot when they win, instead of sliding across the table.',
    'Options \u2192 Battle look: Stadium (squares on the floor), Miniatures (figures on round bases, with a wooden rim on the table) or Paper (pok\u00e9mon printed on white standees). The floor still follows the battle in every look.',
  ]},
  { v:'4.14.0', date:'Oct 6, 2026', title:'Minor gameplay changes', sub:'The battle board becomes a stadium, with a floor for every battle type', items:[
    'Battles now play on a tilted stadium table. Every pok\u00e9mon stands up off its square, with a gentle bob, and the crowd and floodlights sit behind.',
    'The floor follows the battle: a striped pitch for trainers, a dusk stadium for your rival, the League hall for the Champion and a snowy summit for Red.',
    'Every gym leader and Elite Four member fights on their type\u2019s floor: pool tiles for Misty, volcanic rock for Blaine, a dojo for Bruno and Chuck, ice for Lorelei and Pryce, steel plates for Jasmine, and more.',
    'On a super-effective hit or a knockout the camera leans in towards whoever took it, and the stadium shakes.',
  ]},
  { v:'4.13.0', date:'Oct 6, 2026', title:'Minor gameplay changes', sub:'A new battle screen: both teams on a board in their real formation', items:[
    'Battles now play out on a board. Every pok\u00e9mon sits on a tile in its rank (front, middle, back), with its name, HP bar and status on the tile, so you can follow the whole fight and see why positioning matters.',
    'On a phone the enemy team sits on top and yours below. On a wider screen the two teams face each other side by side, with the front ranks nearest the middle.',
    'Hits land with a flash in the attacker\u2019s type colour, and the board shakes on super-effective hits and knockouts.',
    'A fainted pok\u00e9mon stays on its tile, greyed out with a cross, so you can see who is left at a glance.',
    'Each battle type keeps its own floor: grass for trainers, dusk for your rival, the leader\u2019s colour in a gym, and the League hall.',
  ]},
  { v:'4.12.0', date:'Oct 6, 2026', title:'Minor gameplay changes', sub:'Mew joins as a protector legendary, plus challenge rules that each earn a badge', items:[
    'Mew: a new Support legendary for Gen 1 runs. Barrier Aura hits the enemy front, then shields your two lowest-HP pokémon. Once per battle, when a teammate faints, Transform copies that teammate\u2019s move and uses it for 3 actions.',
    'Challenges on New Run: No Held Items, No Legendaries, Hard Gyms (gym leaders, the Elite Four and the Champion 4% stronger) and Tight Budget (1\u20bd less income a turn). Unlike the other rules, opponents are not eased to make up for them.',
    'Every challenge has its own badge, and so do One Life (Hardcore), No PC (Lone Six) and Mono-type (Mono, which collects a stamp for each type you clear).',
    'Clear a run with 3 or more challenges on at once and each of their badges turns gold.',
    'The Trainer Card shows special badges as a grid: tap one to see how to earn it, how many times you have, and any gold clears. The title screen shows your best few by your name.',
    'Won runs in Run history show the challenge badges they earned.',
  ]},
  { v:'4.11.0', date:'Oct 6, 2026', title:'Balance patch', sub:'Supports pass: healers are faster and heal more, Porygon2 and Crobat are cut down', items:[
    'Healers that were far behind get more Speed and bigger heals: Lanturn, Togetic, Slowking and Mr. Mime now heal 12% of the most-hurt pok\u00e9mon\u2019s HP (up from 9\u201310% or 8%), and each one is quicker, so they actually get to heal. Clefable and Jynx get small boosts too, and Togetic\u2019s Wish and Clefable\u2019s Light Screen are a bit bigger.',
    'Porygon2 was far above everything else at its tier, so its stats and Download are lower. Crobat is trimmed a little.',
    'Chinchou and Togepi are slightly faster so they are not left behind by their evolutions.',
    'Mono runs were re-measured after the Supports got stronger, and a few types\u2019 opponents are nudged so each still clears about 75% of the time in bot runs.',
  ]},
  { v:'4.10.0', date:'Oct 5, 2026', title:'Minor gameplay changes', sub:'A first-run tutorial and Celebi, the first Support legendary', items:[
    'A short tutorial of five cards plays the first time you open the game. Skip it any time, and replay it from START \u2192 How to play.',
    'Celebi joins the legendaries in Gen 2 runs: a Psychic Support that heals your most-hurt pok\u00e9mon every time it acts and cures and heals the team once when a teammate drops below half HP. It is also a Grass pok\u00e9mon for Mono Grass runs. Recruit it for 12\u20bd after the 5th gym like the others.',
  ]},
  { v:'4.9.1', date:'Oct 5, 2026', title:'Visual bug fixes', sub:'Phone fixes: slimmer Battle bar, steadier screen, fuller battle scene, Mute and a visible legendary', items:[
    'On phones the Battle bar at the bottom is now just the button, with the next opponent\u2019s name on it. Their card with the road to the badge sits in the page below your party instead of covering the shop.',
    'Tapping things in the shop no longer shoves the page around on iPhone. Whatever you were looking at stays where it was when the message box opens.',
    'The battle scene now grows to fill a tall phone screen instead of leaving an empty strip at the bottom.',
    'When a legendary appears, a small Recruit / Let it go bar shows above the Battle button on phones so you can\u2019t miss it.',
    'Mute is now part of the Volume setting (Mute, Low, Mid, High) and the separate Sound row is gone.',
    'On desktop the Your Party panel keeps the same height with no pok\u00e9mon, one pok\u00e9mon or six, so the page below stops jumping.',
  ]},
  { v:'4.9.0', date:'Oct 4, 2026', title:'Minor gameplay changes', sub:'Run history, Pokédex type tags and a bigger Badges tap area', items:[
    'Run history: your last 30 runs are on the Trainer Card, each with its team, how far it got, the rules and any secret boss you beat. It travels in a transfer code.',
    'The Pokédex now shows a pok\u00e9mon\u2019s second type (Geodude also shows Ground), and the stone and item list says who evolves with each one.',
    'The little row of badges at the top is easier to tap on a phone.',
    'Mono runs were re-measured: Water and Poison in Gen 2, Psychic, Fire and Electric in Gen 1, and Dark, Ice, Grass and Electric in Gen 1 + 2 were a few points off the others, so their opponents are nudged. Every Mono type now clears about 74\u201379% of the time in bot runs.',
    'Fixed a rare crash if a run was replaced while a battle intro was still playing.',
  ]},
  { v:'4.8.1', date:'Oct 10, 2026', title:'Visual bug fixes', sub:'Slowking has its pixel art', items:[
    'Slowking now has its pixel art instead of a two-letter placeholder. All the pokémon added in 4.5.0 and 4.8.0 are drawn.',
  ]},
  { v:'4.8.0', date:'Oct 9, 2026', title:'Balance patch', sub:'Expert Belt and Leftovers are stronger, and Slowpoke can become Slowking', items:[
    'Expert Belt now gives +20% Attack on top of never being resisted. On its own the resist-ignoring effect barely moved results in testing.',
    'Leftovers now heals 22% of max HP on its beat, up from 12%. It was weaker than the other 5\u20bd items for what it gave back.',
    'Slowpoke can now become Slowking in Gen 2 runs: use a King\u2019s Rock on it instead of letting it level up into Slowbro. Slowking is a Support with a healing attack that confuses an enemy now and then, where Slowbro is a Tank. Slowpoke joins the cross-generation evolutions, so mixed runs draw four from ten. Slowking shows a letter placeholder until its sprite is added.',
    'Heart Scale was checked too and left alone: on a Support it already gains about as much as the other 5\u20136\u20bd items.',
  ]},
  { v:'4.7.0', date:'Oct 8, 2026', title:'Balance patch', sub:'Eviolite is stronger and counts every evolution', items:[
    'Eviolite now gives +50% HP while a pokémon can still evolve, up from +25%. In testing it ranked near the bottom of the 5\u20bd held items for what it gave back, and it is switched off whenever its holder is fully evolved, so it needed the lift.',
    'Eviolite now counts every Gen 2 evolution whenever Gen 2 is on. Before, in a Gen 1 + 2 run it only counted the four evolutions open in that run\u2019s Evolution Pool, so Scyther or Chansey could show no effect even though Scizor and Blissey exist in the game. Now they get the boost, pool or not. A Gen 1-only run still has no Scizor or Blissey, so Scyther and Chansey stay switched off there.',
  ]},
  { v:'4.6.0', date:'Oct 7, 2026', title:'Minor gameplay changes', sub:'Dual-type pokémon join the Mono pool of each of their types', items:[
    'In a Mono-type run the Daycare now sells every pokémon that has that type, not just the ones whose main type it is. Geodude is Rock and Ground, Pidgey is Normal and Flying, Jynx is Ice and Psychic, and so on. Mono legends follow the same rule. Gym leaders and the Elite Four already drew on both of a pokémon\u2019s types.',
    'Because the pools are bigger, Mono Ground, Flying, Poison and Psychic are now available in Gen 2-only runs, and Mono Ice and Dark are tuned for the new pools. Every Mono type was re-measured so each is still about as hard as the others.',
    'The 23 pokémon added in 4.5.0 now have their pixel art instead of letter placeholders.',
  ]},
  { v:'4.5.0', date:'Oct 6, 2026', title:'Minor gameplay changes', sub:'23 new pokémon fill the gaps in the pool, and opponents are re-tuned', items:[
    'Gen 1 gains Omanyte and Omastar, Kabuto and Kabutops, Aerodactyl, Slowpoke and Slowbro, Mr. Mime, Ponyta and Rapidash, and Cubone and Marowak. Rock and Psychic now have enough pokémon to be Mono-type runs in Gen 1, and Fire and Ground each get another bruiser.',
    'Gen 2 gains Sunkern and Sunflora, Gligar, Slugma and Magcargo, Wobbuffet, Qwilfish, Chinchou and Lanturn, and Togepi and Togetic. Gen 2-only runs now have a Grass attacker, a second Ground option, a Fire tank, a Psychic tank and a Flying support. Sunkern evolves with a Sun Stone. Slowpoke, Qwilfish, Chinchou and their evolutions count as Water, the way the games type them, and Togepi counts as Flying from the start so its line keeps one type.',
    'The new pokémon are among the weaker picks in the Daycare, which made runs a little harder, so every generation mix has its opponents eased slightly to keep clear rates near where they were. Red and Oak are a touch stronger to stay a one-in-three fight. The new pokémon show letter placeholders until their sprites are drawn.',
  ]},
  { v:'4.4.0', date:'Oct 5, 2026', title:'Minor gameplay changes', sub:'The Secret Gauntlet, a secret-boss streak, and a Gauntlet Badge', items:[
    'A new rule on the New Run screen: Secret Gauntlet. Red and Professor Oak both wait after the Champion, back to back, one try each. It needs Gen 1 and Gen 2 turned on and costs one Red ticket and one Oak ticket. You are healed and the shops open for one turn between them. Win a fight and you still earn that boss\u2019s badge and a ticket back, even if the other one beats you.',
    'Beat both in one Secret Gauntlet run and you earn the Gauntlet Badge, shown on your Trainer Card under the other secret badges.',
    'Fixed the New Run screen forgetting your generations. It was meant to remember the ones you picked last time, but a mixed Gen 1 + Gen 2 pick always came back as Gen 1.',
    'Your Trainer Card now tracks your secret-boss streak: wins in a row against Red and Oak, with your best ever. A loss to either one resets it.',
  ]},
  { v:'4.3.0', date:'Oct 4, 2026', title:'Minor gameplay changes', sub:'Secret Boss Tickets, secret bosses in the Pokédex, and sound that pauses with the fight', items:[
    'Beating a secret boss now earns a Secret Boss Ticket for that boss (you can hold up to 3 of each). On the New Run screen, tap a ticket and that boss waits for you after the Champion in that run. It still takes one try, and the generation he belongs to has to be in the run: Red needs Gen 2, Oak needs Gen 1. Tickets are not earned or spent in the Daily Challenge, and they show on your Trainer Card and travel in a transfer code.',
    'The Pokédex has a Secret bosses section under Trainers. Red and Oak stay a silhouette marked ??? until you have met them in a battle, then it shows their portrait, place, team, and whether you have their badge. The 1 in 6 chance stays pure luck, with no hints.',
    'Pausing a battle now pauses its sound too, and Resume brings it back.',
  ]},
  { v:'4.2.0', date:'Oct 3, 2026', title:'Minor gameplay changes', sub:'Professor Oak is a secret boss, Porygon2, battle pause, and a barrier fix', items:[
    'A second secret boss. In about one Gen 1 run in six, beating the Champion sends you back to Pallet Town for a fight with Professor Oak: Pikachu, Snorlax, Dragonite, Venusaur, Charizard and Blastoise. Same rules as Red: one try, nothing lost if you fall, and Oak\u2019s Badge if you win.',
    'Runs with both generations draw one secret boss between them, Red or Oak, and Gen 2-only runs still meet Red. Oak\u2019s Badge sits next to Red\u2019s on your Trainer Card and the title screen.',
    'Porygon2 is here: Porygon evolves into it on a level up when Gen 2 is on. In Gen 2-only runs the Porygon line is in the Daycare. It is a Support, and one more cross-generation evolution for a mixed run\u2019s pool to open.',
    'Battles have a Pause button. Pause holds the fight on its current beat, Step moves it on one action at a time, and Space does the same as Pause. Skip still jumps to the result.',
    'Fixed a barrier that could stay on screen after it broke. A pokémon whose barrier or status ended on a turn nothing else happened to it kept its old shell until it was hit again. It now clears at once, with a \u201cBarrier broke\u201d note.' ] },
  { v:'4.1.0', date:'Oct 2, 2026', title:'Major gameplay update', sub:'Red waits on Mt. Silver', items:[
    'In a run with Gen 2 on, about one run in six hides a secret last boss. Beat the Champion and, if he is up there, Red steps out on Mt. Silver: Pikachu, Espeon, Snorlax, Venusaur, Charizard and Blastoise, the team from the games. You will not know until the Champion falls.',
    'You get one try. Beat Red and you earn Red\u2019s Badge, which sits on your Trainer Card with a Mt. Silver ending and a Pikachu banner on the run summary. Lose and nothing is lost: it costs no life and no money, and the run ends as the Champion clear it already was.',
    'Between the Champion and Red your party is healed and the shops reopen for one turn, so you can spend before the climb. Red is built a good deal stronger than the Champion; a good team wins roughly one fight in three.',
    'Red\u2019s Badge is a trophy only. It has no effect in a run, and it travels with your transfer code like the Hardcore Badge.' ] },
  { v:'4.0.1', date:'Oct 2, 2026', title:'Visual bug fixes', sub:'Tyrogue, Gloom and Poliwhirl cards open again, and the Pokédex opens fast', items:[
    'Tapping Tyrogue (or Gloom or Poliwhirl) in a run with Gen 2 on no longer breaks. Their cards now say how they evolve: by level, by a stone, or by their highest stat.',
    'The Pokédex opens about ten times faster, which was most of the lag in runs with both generations on. A pokémon\u2019s card is built when you tap it.' ] },
  { v:'4.0.0', date:'Oct 1, 2026', title:'Major gameplay update', sub:'The Gen 2 pack: Johto, 68 new pokémon, and runs that mix both generations', items:[
    'New Run now has a toggle for each generation. Gen 1 plays exactly as before. Gen 2 is Johto: Falkner to Clair, then Will, Koga, Bruno and Karen, Lance as Champion, and Silver as your rival.',
    'Pick both and 8 of the 16 gym leaders and 4 of the Elite Four are drawn and shuffled, and the Champion is Blue or Lance. Every boss is scaled to the slot they land in — Brock as the eighth gym brings Golem, Rhydon and Onix — and nobody shows up twice.',
    'A Gen 2-only run plays Gen 2 pokémon only, plus the Gen 1 lines a Gen 2 pokémon belongs to (Onix with Steelix, Magby with Magmar, Pichu with Pikachu). Johto\u2019s leaders can still field Gen 1 pokémon from the Johto Pokédex, Dratini and Dragonite for Clair and Lance, but those are never sold to you.',
    '68 Gen 2 pokémon: the Johto starters, Hoothoot, Ledyba, Spinarak, Marill, Mareep, Natu, Wooper, Snubbull, Murkrow, Teddiursa, Swinub, Phanpy, Pineco, Houndour, Girafarig, Misdreavus, Miltank, Sneasel, Skarmory, Hitmontop, Heracross, Larvitar to Tyranitar, the seven babies, and Raikou, Entei, Suicune, Lugia and Ho-Oh as encounters.',
    'With Gen 2 on, Gen 1 pokémon can evolve further: Golbat into Crobat and Chansey into Blissey by level, Onix and Scyther into Steelix and Scizor with a Metal Coat, Poliwhirl into Politoed with a King\u2019s Rock, Gloom into Bellossom and Eevee into Espeon with a Sun Stone, and Eevee into Umbreon with a Moon Stone.',
    'Tyrogue becomes Hitmonlee, Hitmonchan or Hitmontop depending on its highest stat — Attack, HP or Speed — so your vitamins choose.',
    'Magmar joins Gen 1 as a Fire Cannon (Magby grows into it). Horsea → Seadra joins Gen 1 too, and a Dragon Scale turns Seadra into Kingdra.',
    'Mixed runs level up more easily. Each run draws 3 Focus lines (marked \u2605 in the Daycare), which show up more often, and a pool of 4 open cross-gen evolutions, so no two runs evolve the same way. Single-gen runs are unchanged.',
    'Early Gen 2 was support-heavy. Hoothoot and Noctowl are now Tanks, Natu and Xatu Cannons and Girafarig a Bruiser, and the Wooper line arrives at Tier 1 as a Tank.',
    'The Daily Challenge now rotates generations by date (Gen 1, Gen 1+2 or Gen 2, the same for everyone) and shows the day\u2019s Focus lines and open evolutions as the Pool of the day. The run summary, and the summary image you can save, list your run\u2019s Focus and evolutions.',
    'A new Pokédex: families sit together left to right, with search, a card for every pokémon (stats, moves, evolutions, matchups and who uses it), and a count of the ones you have seen. It is also on the title menu now, and the title screen has a livelier field.',
    'Two new types, Steel and Dark, with the Gen 2 matchups. No Gen 1 pokémon changes type.',
    'Gen 2 and mixed runs keep their own records, and the Mono-type list follows the generations you pick. Badges keep their own look wherever their leader lands.',
    'The Metal Coat held item is now the Assault Vest — same effect (15% less damage from every hit), new look — because Metal Coat is Gen 2\u2019s evolution item for Steelix and Scizor.',
    'The Pokédex has filters: show everything, or just Pokémon, Trainers or Items, and pick All gens, Gen 1 or Gen 2.' ] },
  { v:'3.8.1', date:'Sep 30, 2026', title:'Visual bug fixes', sub:'Art for all nineteen new pokémon', items:[
    'Weedle, Kakuna, Beedrill, Spearow, Fearow, Doduo, Dodrio, Diglett, Dugtrio, Sandshrew, Sandslash, both Nidorans and their evolutions, Farfetch\u2019d and Porygon now have their sprites instead of letter placeholders.' ] },
  { v:'3.8.0', date:'Sep 30, 2026', title:'Major gameplay update', sub:'Nineteen new pokémon: Weedle, Spearow, Doduo, Diglett, Sandshrew, both Nidorans, Farfetch\u2019d and Porygon', items:[
    'Weedle → Kakuna → Beedrill (Bug): a poisoning Cannon that slows with String Shot, hardens as Kakuna, and stings twice as Beedrill.',
    'Spearow → Fearow (Flying Cannon): fast Pecks that pick off the weakest enemy. Doduo → Dodrio (Flying Bruiser): three-hit Tri Attack after a free Focus Energy. Farfetch\u2019d (Flying Bruiser, Tier 3): Slash, and it Swords Dances before the first hit.',
    'Diglett → Dugtrio (Ground Cannon): the fastest thing in the game, confusing with Sand Attack and digging in with a charged Dig. Sandshrew → Sandslash (Ground Bruiser): Fury Swipes from behind a free Defense Curl.',
    'Nidoran\u2640 → Nidorina → Nidoqueen (Poison Tank): Body Slam walls that poison from the back row. Nidoran\u2642 → Nidorino → Nidoking (Poison Cannon): Double Kick, then a Thrash that ramps up. Both take a Moon Stone for the last step, so Moon Stones now also evolve Nidorina and Nidorino.',
    'Porygon (Normal Support, Tier 4): Conversion heals the team as it hits, and it can Recover once when low.',
    'Flying, Poison and Ground now have three or more lines, so each gets a Mono-type run of its own. The gym leaders and Elite Four pick the new pokémon where they fit (Brock and Giovanni get the Ground lines, Koga the Weedle and Nidoran lines, Lance the new Flying ones).',
    'Clearer wording: a wild legendary\u2019s card now says the offer disappears after the next battle, and that a recruited legendary is yours to keep.',
    'Every boss and every run rule (Rich & Ruthless, No PC, One Life and all the Mono types) was re-measured for the bigger roster, so the difficulty is about where it was.' ] },
  { v:'3.7.0', date:'Sep 30, 2026', title:'Minor gameplay changes', sub:'A polish update: run summaries, tap-to-inspect everywhere, first-run tips, haptics and a new app icon', items:[
    'Run summary: when a run ends you see your turns, badges, stage, wins and losses, a Run MVP (most damage, KOs and healing across the whole run) and the runners-up. “Save summary image” makes a picture of your team and result to send to friends.',
    'Tap to inspect, everywhere: tap a pokémon in a scouting report, either side of a battle, or your team on the run-over screen to see its full summary card.',
    'Options → Trainer battles → Skip to result plays ordinary trainer battles instantly. Gym leaders, the Elite Four, the Champion and your rival are always shown.',
    'Haptics: a light buzz on buys, level-ups, evolutions, knockouts, badges, wins and losses (Android phones; iPhones don’t let web pages vibrate). Turn it off in Options.',
    'First-run tips: five short cards explain buying, inspecting, levelling, roles and gym leaders the first time you meet each one. Options → Tips hides them or shows them again.',
    'Clean-up: bigger tap targets for the Options buttons, Line up by role and Formations, and a tidier run-over screen.',
    'New home-screen app icon: a pixel globe-orb.' ] },
  { v:'3.6.0', date:'Sep 30, 2026', title:'Balance patch', sub:'Gym leaders and the Elite Four only bring bodyguards that fit them, and the boss sprite is back on the battle card', items:[
    'Every leader now has a hand-picked list of bodyguards instead of drawing any off-theme pokémon. Lt. Surge backs his Electrics with Flying types (Pidgeot, Golbat) and Rattata, Giovanni brings Team Rocket’s Rattata, Zubat, Koffing and Machamp, Erika leans on Chansey and Clefairy, Bruno on Golem, Rhydon and Snorlax, and so on. No more Onix in Lt. Surge’s gym.',
    'Fixed: the gym leader’s sprite was missing on the “wants to battle!” card at the bottom of the screen.',
    'Gyms, the Elite Four and the Champion were re-calibrated for the new benches, and Rich & Ruthless, No PC, One Life and every Mono type were re-measured.' ] },
  { v:'3.5.0', date:'Sep 29, 2026', title:'Balance patch', sub:'Tangela, Venusaur and Vaporeon get identities, and three new moves answer buffs, second moves and held items', items:[
    'Tangela is much sturdier (HP 58 → 70) and hits harder from the front. Venusaur’s Giga Drain now heals it for all of the damage it deals, and Venusaur has more HP. Vaporeon puts up Acid Armor before the first hit instead of waiting until it is hurt.',
    'Three new moves join Brick Break as answers to what your opponent is counting on. Disable seals the target’s second move for the battle (Alakazam, Electabuzz). Haze wipes Attack gains, Focus and stacked blocking (Starmie). Knock Off strips the held item (Scyther).',
    'Those moves replace Psybeam, Water Pulse and both Quick Attacks, so the strongest cannons are a little less overpowering. Small stat lifts for Jynx, Charizard, Gyarados, Butterfree and Weezing, and a small trim for Alakazam and Jolteon.',
    'Every gym leader, the Elite Four and the Champion were re-calibrated again, and Rich & Ruthless, No PC, One Life and every Mono type were re-measured, so a normal run is still about as winnable as before.' ] },
  { v:'3.4.0', date:'Sep 29, 2026', title:'Balance patch', sub:'Brick Break answers the new barriers, and every gym now gets harder in steps instead of being trivial until the Elite Four', items:[
    'New move: Brick Break shatters the target’s barrier before it hits, so nothing is soaked. Hitmonlee and Poliwrath have it (Hitmonlee gave up Focus Energy, Poliwrath gave up Hypnosis). It is the answer to Iron Defense, Defense Curl and Reflect.',
    'Gym difficulty pass: gyms 2 to 8 were close to a walkover for a well-built team, while the Champion was a wall. Every gym leader, Elite Four member and the Champion was re-calibrated so difficulty climbs in steps, from Brock to Lt. Surge to Blaine to Giovanni, then the Elite Four and Blue.',
    'To balance that, the Elite Four and Champion ratios were eased a little, and Rich & Ruthless, No PC, One Life and every Mono type were re-measured. A normal run is about as winnable as before; the losses just come earlier and more evenly.' ] },
  { v:'3.3.0', date:'Sep 29, 2026', title:'Balance patch', sub:'Snorlax, Onix, Blastoise and other weak finals get real identities, and the Elite Four only field evolved pokémon', items:[
    'Blastoise now uses Surf: it hits every enemy instead of charging a single Hydro Pump. Bubble is unchanged.',
    'Onix, Golem, Cloyster and Rhydon open the battle behind a barrier (Iron Defense, Defense Curl), for free, instead of curling up once they are already hurt. Cloyster trades Supersonic for it and Rhydon trades Stomp.',
    'Snorlax is a little faster (Speed 20 → 26) and now opens with Reflect, a barrier for your whole team, instead of Rest.',
    'Smaller lifts for Gyarados, Golbat (its Leech Life heals more), Wigglytuff, Vileplume, Poliwrath, Lapras, Hypno and Magneton.',
    'The Elite Four now field fully evolved pokémon (no more Seel, Dratini or Machop). Lorelei gains Vaporeon, Agatha gains Weezing and Victreebel, and their leads are now final forms.',
    'The Elite Four and Champion, Rich & Ruthless, No PC, One Life and every Mono type were re-measured again. The Balance Sheet lists every change in this update, including for the bosses.' ] },
  { v:'3.2.0', date:'Sep 29, 2026', title:'Balance patch', sub:'A stat pass on the whole roster, and every gym leader and Elite Four member has a bench of their own', items:[
    'Roster pass: the strongest finals were trimmed (Alakazam, Starmie, Jolteon, Gengar, Arcanine, Electrode, Electabuzz, Hitmonlee, Pidgeot) and the weakest were lifted (Snorlax, Onix, Golem, Cloyster, Hypno, Wigglytuff, Vileplume, Jynx, Blastoise, Venusaur). The best and worst finals are now about 19 points apart instead of 33.',
    'Bosses now have benches of their own. Erika keeps the Grasses (no Bugs), Koga is Bugs plus Koffing and Weezing, Agatha is ghosts, Zubat, Golbat, Drowzee and Hypno, and Bruno is the Fighting lines (Machop, Mankey, Hitmonlee, Hitmonchan) plus Onix.',
    'Misty leaves the icy Waters (Seel, Dewgong, Shellder, Cloyster, Lapras) to Lorelei, Giovanni leaves the Rock walls to Brock, and Lance drops the bats and bugs. Blurbs were updated to match.',
    'The Elite Four and Champion, Rich & Ruthless, No PC, One Life and every Mono type were re-measured, so each run rule is still about as hard as the others.' ] },
  { v:'3.1.2', date:'Sep 29, 2026', title:'Visual bug fixes', sub:'Art for Koffing and Golbat, so every new pokémon has its sprite', items:[
    'Koffing and Golbat now have their pixel art instead of a two-letter placeholder. All the 3.1.0 pokémon are drawn.' ] },
  { v:'3.1.1', date:'Sep 29, 2026', title:'Visual bug fixes', sub:'Art for Zubat, Weezing, Mankey, Primeape and Hitmonchan', items:[
    'Zubat, Weezing, Mankey, Primeape and Hitmonchan now have their pixel art instead of a two-letter placeholder.',
    'Golbat and Koffing are still waiting for art.' ] },
  { v:'3.1.0', date:'Sep 29, 2026', title:'Minor gameplay changes', sub:'Jynx, Mankey, Hitmonchan, Zubat and Koffing lines join, and Poison is now a type', items:[
    'Poison is the 15th type: strong against Grass, weak to Ground and Psychic, and it resists Grass, Fighting, Poison and Bug. Grass, Bug and Fighting now also fall short against it (×½).',
    'Zubat → Golbat (Poison Support): a fast drainer that heals itself and confuses with Supersonic. Koffing → Weezing (Poison Tank): a wall that poisons with Smog, Sludge and Poison Gas.',
    'Mankey → Primeape (Fighting Bruiser): a fast triple-striker that turns into a Rage machine. Hitmonchan (Fighting Bruiser, Tier 5): Comet Punch, and it bulks up before the first hit.',
    'Jynx (Ice Support, Tier 4): Ice Punch and Lovely Kiss. It is the first pokémon of the Ice type.',
    'With four lines Fighting is a Mono type again. Koga now leads with Weezing, and the new pokémon join the Elite Four and gym pools they fit (Bruno, Lorelei, Sabrina, Agatha, Lance). The Mono factors were re-measured.',
    'Art for Zubat, Golbat, Koffing, Weezing, Mankey, Primeape and Hitmonchan is still to come, so they show a two-letter placeholder for now.' ] },
  { v:'3.0.0', date:'Sep 29, 2026', title:'Major gameplay update', sub:'The real Gen 1 type chart: 14 types, one main type per pokémon, and weaknesses that finally make sense', items:[
    'The old six-type ring is gone. Every pokémon now has its real main Gen 1 type (Bulbasaur is Grass, Onix is Rock, Dragonite is Dragon, Gengar is Ghost) and the matchups follow the real games.',
    'One type each: pokémon with two types use their first one, and Normal/Flying pokémon (the Pidgey line and friends) count as Flying. Types can now be weak to, or resist, several types at once.',
    'The chart is the modern one without Dark, Steel and Fairy. Where the games make a type immune (Ghost vs Normal, Ground vs Electric, and so on) this game makes it resist instead, so an attack never does nothing.',
    'Electric replaces Lightning, and Electric types are the ones immune to paralysis. The Help page now has the full chart.',
    'Mono runs are now Normal, Fire, Water, Electric, Grass and Bug: the types with at least three pokémon lines to build a team from. Mono-Fighting, Mono-Psychic and the old Mono-Lightning are gone, and a Mono-Water run no longer meets Articuno (it is Ice now).',
    'Everything was re-measured for the new chart: the Elite Four and Champion, Rich & Ruthless, No PC, One Life and every Mono type. Brock was made easier, since Rock takes so much from Water, Grass, Fighting and Ground.',
    'Boss descriptions were updated to the new types. Lorelei’s team is icy Water pokémon (Water types in this game), and your rival picks his starter to counter your party’s main type.' ] },
  { v:'2.11.0', date:'Sep 29, 2026', title:'Balance patch', sub:'Gym leaders are about 15% tougher, and every run rule was re-tuned to match', items:[
    'All eight gym leaders are tougher: Brock about 3% and the rest about 15% more powerful. They were much easier than the Elite Four, so the badges now ask a bit more of your team.',
    'The Elite Four and Champion are unchanged.',
    'Rich & Ruthless, No PC, One Life and every Mono type were re-measured against the new gyms, so each run rule is still about as hard as the others.' ] },
  { v:'2.10.1', date:'Sep 29, 2026', title:'Visual bug fixes', sub:'Gym leader and Elite Four descriptions now match the pokémon they actually field', items:[
    'Every gym leader and Elite Four description was rewritten to match their real team. Erika’s no longer mentions Leech Seed (it’s gone), and each one now says who leads.',
    'Koga’s hint now points you at Fire, since his team is Poison and Bug pokémon, and Agatha’s and Lorelei’s describe their signature leads.' ] },
  { v:'2.10.0', date:'Sep 29, 2026', title:'Minor gameplay changes', sub:'Lorelei fields only Ice pokémon and Koga trades his Ghosts for Bug pokémon, so no two leaders share a bench', items:[
    'Lorelei used to draw on exactly the same pokémon as Misty. She now fields only her Ice team: Seel and Dewgong, Shellder and Cloyster, and Lapras, with Water bodyguards from outside it.',
    'Koga now draws on Poison and Bug pokémon (the Bulbasaur, Oddish, Bellsprout, Caterpie and Paras lines, plus Scyther) and no longer fields Ghosts, so the Gastly line belongs to Agatha.',
    'The Balance Sheet has a new section listing every gym leader, Elite Four member and the Champion with the pokémon they can field, their signature lead and which benches overlap.',
    'The Elite Four and Champion are a hair harder (about 0.4%), Rich & Ruthless a touch easier, and Mono-Fighting and Mono-Lightning were re-tuned, so each run rule stays about as hard as the others.' ] },
  { v:'2.9.0', date:'Sep 29, 2026', title:'Minor gameplay changes', sub:'Every gym leader and Elite Four member now leads with their signature pokémon', items:[
    'Each gym leader and Elite Four member has a signature pokémon that leads their team: Brock’s Onix, Misty’s Starmie (Poliwag early on), Lt. Surge’s Raichu, Erika’s Vileplume, Koga’s Victreebel, Sabrina’s Alakazam, Blaine’s Arcanine, Giovanni’s Rhydon, Lorelei’s Lapras, Bruno’s Machamp, Agatha’s Gengar and Lance’s Dragonite.',
    'If their signature pokémon is too advanced for that point in the run, they lead with the earlier form of it or the next name on their list, so Brock doesn’t open with a Golem.',
    'Rich & Ruthless, Mono-Lightning and Mono-Psychic were re-tuned so each run rule is still about as hard as the others.' ] },
  { v:'2.8.0', date:'Sep 29, 2026', title:'Minor gameplay changes', sub:'Tangela joins as a Tier 3 Grass Tank', items:[
    'New: Tangela, a Tier 3 Grass Tank. Bind hits hard from the front rank, and every 3rd action Stun Spore paralyses a random enemy. It doesn’t evolve.',
    'Grass now has a tank at Tier 3 to go with its Cannons (Exeggcute, Bellsprout) and Bruisers (Paras).',
    'The Elite Four and Champion are a hair easier (about 0.3%) and Rich & Ruthless a hair harder, so every run rule stays about as tough as the others.' ] },
  { v:'2.7.1', date:'Sep 29, 2026', title:'Visual bug fixes', sub:'Real artwork for Paras, Parasect, Exeggcute, Exeggutor, Bellsprout, Weepinbell, Victreebel and the Leaf Stone', items:[
    'The two-letter placeholders are gone: Paras, Parasect, Exeggcute, Exeggutor, Bellsprout, Weepinbell and Victreebel now have their own pictures.',
    'The Leaf Stone has real artwork too, instead of the recoloured Water Stone.' ] },
  { v:'2.7.0', date:'Sep 28, 2026', title:'Minor gameplay changes', sub:'The Bellsprout line joins as a poisoning Grass damage dealer, and Leaf Stone now evolves Weepinbell too', items:[
    'New Grass pokémon: Bellsprout evolves into Weepinbell by levelling up, and Weepinbell evolves into Victreebel with a Leaf Stone. All three are Cannons. Vine Whip, then Razor Leaf, hit hard, and Poison Powder poisons the enemy front every 3rd action.',
    'The Leaf Stone now evolves Weepinbell as well as Exeggcute.',
    'Bellsprout’s line is Grass’s first real damage dealer at Tier 3. Victreebel hits about as hard as Arcanine or Machamp.',
    'The run rules were re-tuned so each one is still about as hard as the others: Rich & Ruthless is a touch easier, and Mono Fire, Grass, Fighting, Lightning and Psychic changed slightly. The pictures for the three new pokémon are placeholders for now.' ] },
  { v:'2.6.0', date:'Sep 28, 2026', title:'Minor gameplay changes', sub:'Paras, Parasect, Exeggcute, Exeggutor and the Leaf Stone join to give Grass more to work with', items:[
    'New Grass pokémon: Paras evolves into Parasect by levelling up. Both are Bruisers. Paras uses Scratch and Stun Spore, and Parasect uses Slash and Spore, which puts the enemy front to sleep.',
    'New: Exeggcute, a Cannon that evolves into Exeggutor with the new Leaf Stone. Exeggcute fires Barrage and Hypnosis. Exeggutor charges Solar Beam every 2nd turn, with Egg Bomb in between.',
    'New item: the Leaf Stone. It evolves Exeggcute, and it appears in shops like the other stones. Its art is a placeholder for now, and so are the four new pokémon’s pictures.',
    'Mono-Grass was the weakest run rule because Grass had so few pokémon. With the new lines its enemies are only 4.5% weaker instead of 9% weaker, so it is still about as hard as the other Mono types.' ] },
  { v:'2.5.0', date:'Sep 28, 2026', title:'Balance patch', sub:'Bulbasaur line is a Tank, Squirtle line a Bruiser, Jolteon gets Thunderbolt, and every move name now means one thing', items:[
    'The Bulbasaur line is now a Tank (it grows HP and guards the front rank), with Absorb, Mega Drain and Giga Drain. Its second move is Poison Powder all the way up; Venusaur’s Solar Beam is gone.',
    'The Squirtle line is now a Bruiser: Water Gun hits harder with each evolution, plus a Bubble that slows the enemy. Blastoise’s Hydro Pump is a big charged hit every 2nd turn. Withdraw, Reflect and Water Gun’s healing are gone.',
    'Jolteon’s Thunder Wave is now Thunderbolt, a hit on every enemy, so it deals more damage. To keep it fair its Attack went 42 → 38 and its Speed 80 → 72.',
    'A move name now has one effect on every pokémon that has it, and only the percentages differ. Renamed to keep that true: Oddish’s Absorb is Heal Pulse and Gloom’s Mega Drain is Floral Healing (they heal a teammate), Oddish’s Poison Powder is Poison Sting, Butterfree’s Stun Spore is Silver Wind, Gastly’s line’s Hypnosis is Dark Void, Magneton’s Thunderbolt is Flash Cannon, Vaporeon’s Water Gun is Waterfall, Starmie’s Hydro Pump is Water Pulse, Ninetales’ Fire Blast is Flamethrower, Moltres’ Fire Blast is Sacred Fire and its Wing Attack is Air Slash, Growlithe’s Ember is Fire Spin, Metapod’s and Onix’s Harden barrier is Iron Defense, Abra’s Psybeam is Confusion, Mewtwo’s Psychic is Psyshock, Dragonair’s Dragon Rage is Dragon Breath, Eevee’s Quick Attack is Helping Hand, Articuno’s Ice Beam is Icicle Crash, Dewgong’s Blizzard is Powder Snow, Rattata’s and Raticate’s Bite is Pursuit, and Electrode’s Swift is Tackle.',
    'The Elite Four and Champion are 1% tougher, and the run rules (Rich, No PC and each Mono type) were re-tuned so every rule is still about as hard as the others.' ] },
  { v:'2.4.0', date:'Sep 28, 2026', title:'Minor gameplay changes', sub:'Hardcore Badge for clearing One Life, and a Trainer Card on the title screen', items:[
    'New: the Hardcore Badge. Beat the Champion on One Life (the Daily Challenge counts too) and it’s yours for good. The badge art is a placeholder for now.',
    'It shows on the title screen next to your name, on your Trainer Card (there’s an empty slot that tells you how to earn it), on the victory screen, and in your Daily Challenge result and the copied result line.',
    'The title screen menu now has TRAINER CARD, so you can check your records without starting a run.',
    'The New Run screen reminds you that a One Life clear earns the badge.' ] },
  { v:'2.3.0', date:'Sep 28, 2026', title:'Minor gameplay changes', sub:'One Life now ends the run on any lost battle', items:[
    'One Life now works the way it says: every lost battle takes your life, including the first defeat by a gym leader or Elite Four member (they used to get two free rematches).' ] },
  { v:'2.2.1', date:'Sep 28, 2026', title:'Visual bug fixes', sub:'Battle transition, title menu, battle button, faint shadow, pick-up chip, battlefield and phone layout', items:[
    'Fixed a pale strip along the bottom of the screen during the pokéball transition on some phones.',
    'The title menu now shows just the ▶ arrow as your selection — a dotted box could appear on a second item on computers.',
    'The next-fight box and the BATTLE button now keep the same size and line up, even when the Undo button is showing (it used to squeeze the box and stretch BATTLE on computers).',
    'A pokémon that faints in battle no longer leaves a faint shadow on the ground.',
    'The pick-up chip that follows your mouse now appears right under the pointer when you select a pokémon or item, instead of starting in the wrong place and jumping, and it only shows while something is selected.',
    'The pale sandy patches on the battlefield are gone; each pokémon keeps its own shadow.',
    'Small phones: the badge row no longer runs into the “Next turn” income at the top of the screen.',
    'Phones on their side: the START menu fits the screen, and the battle field is sized to fit instead of running off the bottom.' ] },
  { v:'2.2.0', date:'Sep 27, 2026', title:'Minor gameplay changes', sub:'Guaranteed legendary, the Champion’s legendary, Zap Cannon and EXP pips in the summary', items:[
    'Every run now meets a legendary: if none has appeared by the 7th gym, one always does.',
    'The Champion brings a legendary of his own — always one you didn’t recruit.',
    'Zapdos’s second move is now Zap Cannon: every 4th action, 200% to the enemy with the most HP, with a 70% chance to paralyse it.',
    'A pokémon’s summary now shows its EXP pips next to its level, so you can see how close anything in the PC is to levelling up.',
    'The Elite Four and Champion are a little tougher to make up for the guaranteed legendary, and the run rules were re-tuned to match.' ] },
  { v:'2.1.0', date:'Sep 27, 2026', title:'Minor gameplay changes', sub:'Articuno and Moltres join, and legendaries get their own rules', items:[
    'Articuno (Water · Tank) and Moltres (Fire · Bruiser) join Zapdos and Mewtwo as legendary encounters after the 5th gym.',
    'Legendaries now play by their own rules: they have no tier and never level up (no copies, no Rare Candy), marked with a gold ★ instead of a level.',
    'To make up for it, every legendary has a much higher base stat total than any regular pokémon and grows 20% faster from battles, Exp. Share and catching up to your trainer.',
    'Mewtwo’s Psystrike hits harder. With four legendaries around, each one appears a little less often per gym — about half of runs meet one.',
    'Legendaries are yours alone: no trainer, gym leader or Elite Four member fields one.' ] },
  { v:'2.0.0', date:'Sep 27, 2026', title:'Major gameplay update', sub:'Daily Challenge, run rules, legendary encounters, undo, battle recap and formations', items:[
    'Daily Challenge (title screen): one run a day that’s the same for everyone — same shops, same trainers, same bosses — sometimes with a rule of the day. It has its own save, so your normal run is safe. Copy your result to compare with friends.',
    'Run rules: start a New Run with Mono-type (pick a type; the Daycare sells only that type), No PC, Rich & Ruthless (double income, tougher opponents) or One Life. Runs with rules keep their own records.',
    'Legendary encounters: Zapdos and Mewtwo are no longer sold in the Daycare. After the 5th gym, a legendary may appear for one turn. Recruit it for 12₽ or let it go.',
    'Undo: made a wrong buy? Undo it once per turn from above the Battle button, with a full refund.',
    'Battle recap after every fight: damage dealt and taken, healing and knockouts for each of your pokémon, with the MVP, the Wall and the Medic called out.',
    'Formations: save up to three line-ups (Your Party → Formations) and snap back to one with a tap.',
    'START → Title screen takes you back to the title, where you can switch between your run and the Daily Challenge.' ] },
  { v:'1.5.0', date:'Sep 27, 2026', title:'Minor gameplay changes', sub:'Evolution stones preview what they would do to your pokémon', items:[
    'Evolution stones in the PokéMart now show what they would do to your pokémon before you buy: “Yours: Eevee → Jolteon” right on the shelf.',
    'Tap a stone to see every pokémon it would evolve, party and PC, with the new type, role and how its stats change.' ] },
  { v:'1.4.1', date:'Sep 27, 2026', title:'Visual bug fixes', sub:'What’s new tags no longer split across two lines', items:[
    'The “new to you” and “current” tags in What’s new no longer break across two lines; each update’s date and tag stay together.' ] },
  { v:'1.4.0', date:'Sep 27, 2026', title:'Minor gameplay changes', sub:'Your rival raises an Eevee and brings its Eeveelution to the Champion fight', items:[
    'Your rival raises an Eevee, like in the games. It joins his team at your second meeting and has evolved by the third, into whichever Eeveelution covers his starter’s weakness (Vaporeon for a Charmander, Jolteon for a Squirtle, Flareon for a Bulbasaur).',
    'Blue brings that same Eeveelution to the Champion fight, fully trained, alongside his starter.',
    'Vaporeon, Jolteon and Flareon are Water, Lightning and Fire, with matching weaknesses; only Eevee is Colorless.' ] },
  { v:'1.3.0', date:'Sep 27, 2026', title:'Minor gameplay changes', sub:'Eevee and its evolutions, transfer codes and the version on the title screen', items:[
    'Eevee joins the Daycare (from shop tier 3) as a Support, and it’s the first pokémon with a choice of evolutions: a Water Stone makes Vaporeon (a Tank), a Thunder Stone makes Jolteon (a glass Cannon), a Fire Stone makes Flareon (a Bruiser). The stone you use decides.',
    'Transfer codes: START → Transfer save turns your run into a code you can paste on another phone or computer, or into the home-screen app. Your records and trainer name come along.',
    'The title screen shows the version under the logo. The date now only appears here in What’s new, next to each update from 1.2.0 on.' ] },
  { v:'1.2.0', was:'v54', date:'Sep 27, 2026', title:'Balance patch', sub:'X items cut to 2 uses, rarity sparkle, Choice Band sprite and new version numbers', items:[
    'Updates now have three-part numbers like 1.2.0. The first number goes up for a big change to how the game plays, the middle one for fixes and things added or removed, the last one for small visual and wording touch-ups. Everything before 1.2.0 is gathered under 1.1.0 beta.',
    'When a Rare or Very rare item turns up in the PokéMart it sparkles and chimes: a blue shine for Rare, a gold one with a longer chime for Very rare.',
    'X Attack and X Speed: 2 uses of each per battle (was 3), still +5% each.',
    'Choice Band has its own sprite.' ] },
  { v:'1.1.0 beta', wasAny:/^v\d+$/, title:'Major gameplay update', sub:'The whole game up to v53, gathered in one entry', items:[
    'The auto battler itself: buy pokémon in the Daycare, line them up on a 3×2 field, and they fight on their own on a speed-based action clock. 37 battles a run: trainers, 8 gym leaders, your rival, then the Elite Four and the Champion back to back.',
    '60+ Gen 1 pokémon in four roles (Tank, Bruiser, Support, Cannon), each with a main move and a second move, status conditions, type matchups, levelling by merging copies, and evolution by level or stone.',
    'A PC box for a bench, trainer EXP so late buys arrive strong, lives and blackouts, badge rewards to pick from, a scouting report for rematches.',
    'The PokéMart: medicine and stones, X Attack and X Speed, and held items in a Bag, with rarities from Common to Very rare, including Choice Band, Life Orb, Iron Ball, Heart Scale, Shell Bell and Rocky Helmet.',
    'A Game Boy look with real sprites and leader portraits, a title screen, pokéball wipes, sound effects, a Pokédex, How to play, team codes to battle friends, dark mode, and a home-screen app.' ] },
];
const SEEN_KEY = 'pkb_seen_version';
function seenVersion(){ try{ return localStorage.getItem(SEEN_KEY); }catch(e){ return null; } }
function markSeen(){ try{ localStorage.setItem(SEEN_KEY, GAME_VERSION.v); }catch(e){} }
/** Something new since this player last opened What's new? (first-timers too) */
const hasUnseen = () => seenVersion() !== GAME_VERSION.v;
function openChangelog(){
  const seen = seenVersion();
  const idx = CHANGELOG.findIndex(e => e.v === seen || e.was === seen || (e.wasAny && seen && e.wasAny.test(seen)));   // 1.2.0 was v54; 1.1.0 beta is v1–v53
  const d = modal(`<h3>What’s new <span class="vsub">you’re on ${GAME_VERSION.v}</span></h3>
    <div class="clog">${CHANGELOG.map((e, i) => `
      <details ${i === 0 || (idx > 0 && i < idx) ? 'open' : ''} class="${idx > 0 && i < idx ? 'unseen' : ''}">
        <summary><b>${esc(e.v)}</b> ${esc(e.title)}${(() => {
          // 1.4.1: the date and the tag travel together, so a tag never splits across two lines
          const tag = e.v === GAME_VERSION.v ? '<i class="cnow">current</i>' : idx > 0 && i < idx ? '<i class="cnew">new to you</i>' : '';
          return e.date || tag ? ` <span class="cmeta">${e.date ? `<span class="cdate">${esc(e.date)}</span>` : ''}${tag}</span>` : ''; })()}${e.sub ? `<span class="csub">${esc(e.sub)}</span>` : ''}</summary>
        <ul>${e.items.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
      </details>`).join('')}</div>
    <div class="btnrow"><button class="btn ghost" data-m="close">Close</button></div>`);
  d.querySelector('[data-m="close"]').onclick = () => d.remove();
  markSeen(); render();
}

/* v37: the Start menu — a Game Boy box that slides in from the right with a
   ▶ cursor. Arrow keys move the cursor; the line at the bottom says what the
   highlighted entry does. Restart asks YES / NO before it wipes a run. */
function openMenu(){
  SFX.play('open');
  const items = [
    ['trainer', 'Trainer', 'Your badges, this run and your records.'],
    ['dex',     'Pokédex', 'Every pokémon, leader and item.'],
    ['duels',   'Duels', 'Your duel box, and best-of-three sets with a friend by code.'],
    ['transfer','Transfer save', 'Move this run to another device or the home-screen app with a code.'],
    ['news',    'What’s new', `What changed in ${GAME_VERSION.v}.`],
    ['help',    'How to play', 'Rules, roles and statuses.'],
    ...(APP.canInstall() ? [['install', 'Install app', 'Put PokéArena on your home screen and play it full screen, even offline.']] : []),
    ['options', 'Options', 'Your name, theme, speed, sound, transitions and more.'],
    ['title',   'Title screen', 'Back to the title: your run, the Daily Challenge, a new run.'],
    ['restart', 'Restart', G && G.daily ? 'Start today’s Daily Challenge again from turn 1.' : 'Start a new run from turn 1, with rules if you like.'],
    ['close',   'Exit', 'Back to the game.'],
  ];
  const d = modal(`<div class="smenu" role="menu" aria-label="Menu">
    ${items.map(([id, label, desc], k) => `${id === 'restart' ? '<hr>' : ''}<button class="smi ${k === 0 ? 'cur' : ''} ${id === 'restart' ? 'red' : ''}"
      role="menuitem" data-m="${id}" data-d="${esc(desc)}">${label}${id === 'trainer' && sbEarned().length ? ` <i class="sbpill">${sbEarned().length}</i>` : ''}${id === 'news' && hasUnseen() ? ' <i class="newdot">New</i>' : ''}</button>`).join('')}
    <div class="sdesc">${esc(items[0][2])}</div>
    <div class="yesno" hidden>${G.daily ? 'Restart today’s challenge?' : 'Start over?'} Turn ${G.turn} and ${G.badges} badge${G.badges === 1 ? '' : 's'} will be lost.
      <div class="btnrow"><button class="btn" data-m="restart-no">No</button><button class="btn danger" data-m="restart-yes">Yes</button></div></div>
    <div class="sver">${GAME_VERSION.v}</div>
  </div>`);
  d.classList.add('startmenu');
  const btns = [...d.querySelectorAll('.smi')], desc = d.querySelector('.sdesc'), yn = d.querySelector('.yesno');
  const point = b => { if(!b.classList.contains('cur')) SFX.play('move'); btns.forEach(x => x.classList.toggle('cur', x === b)); desc.textContent = b.dataset.d; };
  btns.forEach(b => { b.addEventListener('mouseenter', () => point(b)); b.addEventListener('focus', () => point(b)); });
  d.addEventListener('keydown', e => {
    const k = btns.indexOf(d.querySelector('.smi.cur'));
    if(e.key === 'ArrowDown' || e.key === 'ArrowUp'){
      e.preventDefault();
      const nx = btns[(k + (e.key === 'ArrowDown' ? 1 : btns.length - 1)) % btns.length];
      nx.focus(); point(nx);
    }
    if(e.key === 'Escape'){ e.stopPropagation(); SFX.play('back'); d.remove(); }
  });
  d.querySelectorAll('[data-m]').forEach(b => b.onclick = () => {
    const m = b.dataset.m;
    if(m === 'restart'){ yn.hidden = false; desc.hidden = true; return; }
    if(m === 'restart-no'){ yn.hidden = true; desc.hidden = false; return; }
    d.remove();
    if(m === 'restart-yes'){
      if(G.daily){ noteQuit(); G = newGame(dailySeed(G.daily), { mods: G.mods, daily: G.daily, gens: G.gens }); rollShop(G, false);
        phase = 'shop'; sel = null; inspect = null; battle = null; undo = null; save(); render(); }
      else openNewRun();
    }
    if(m === 'title') showTitle(afterTitle);
    if(m === 'trainer') openTrainerCard();
    if(m === 'duels')   openDuels();
    if(m === 'transfer') openTransfer();
    if(m === 'help')    openHelp();
    if(m === 'news')    openChangelog();
    if(m === 'dex')     openDex();
    if(m === 'options') openOptions();
    if(m === 'install') APP.install();
  });
  /* v47: focusing inside the menu forces the browser to lay out the whole page
     the moment it opens, which cost the slide-in its first frames. The cursor
     moves in once the menu has finished sliding. */
  if(finePointer()){
    const box = d.querySelector('.box');
    const go = () => { if(d.isConnected && !d.contains(document.activeElement)) btns[0].focus({ preventScroll:true }); };
    box.addEventListener('animationend', go, { once:true });
    setTimeout(go, 260);
  }
}

/* ---- TRAINER CARD + RECORDS (v37) ---------------------------------
   Per run (saved inside G): how many battles each pokémon has fought and the
   biggest single hit. Across runs (this device): runs finished, runs cleared
   and the furthest anyone got. Friend battles don't count. */
const REC_KEY = 'pkb_records';
function records(){
  let r = null; try{ r = JSON.parse(localStorage.getItem(REC_KEY) || 'null'); }catch(e){}
  return Object.assign({ runs:0, cleared:0, best:-1 }, r || {});
}
function saveRecords(r){ try{ localStorage.setItem(REC_KEY, JSON.stringify(r)); }catch(e){} }
/* 5.5.0 · CAREER: totals across every run on this device, for the Trainer Card. Before 5.5.0 nothing counted
   battles, so the first time it's read it starts from what the records already know (run history, clears). */
function career(r){
  r = r || records();
  if(r.career) return Object.assign({ battles:0, wins:0, gyms:0, elite:0, champs:0, used:{}, hit:null, fastest:0, floors:[] }, r.career);
  const H = r.history || [], used = {};
  for(const h of H) for(const id of h.team || []) used[id] = (used[id] || 0) + 1;
  const fast = H.filter(h => h.won && h.turn).map(h => h.turn);
  return { battles:0, wins:0, gyms: H.reduce((n, h) => n + (h.badges || 0), 0), elite:0, champs: r.cleared || 0, used, hit:null,
           fastest: fast.length ? Math.min(...fast) : 0, floors:[] };
}
function noteCareer(b, result){
  if(!b || b.exhibition || !b.steps || !b.steps.length) return;
  const r = records(), c = career(r);
  c.battles++;
  if(result === 'win'){
    c.wins++;
    if(b.kind === 'gym') c.gyms++;
    if(b.kind === 'elite') c.elite++;
    if(b.kind === 'champion') c.champs++;
    const f = floorWon(b); if(f && !c.floors.includes(f)) c.floors.push(f);
  }
  for(const u of b.steps[0].p) c.used[u.id] = (c.used[u.id] || 0) + 1;
  const h = G && G.rec && G.rec.hit; if(h && (!c.hit || h.dmg > c.hit.dmg)) c.hit = { ...h };
  r.career = c; saveRecords(r);
}
function noteCareerEnd(){
  if(!G || G.over !== 'won') return;
  const r = records(), c = career(r), t = G.turn || 1;
  if(!c.fastest || t < c.fastest){ c.fastest = t; r.career = c; saveRecords(r); }
}
function mergeCareer(a, b){
  if(!a && !b) return null;
  const A = Object.assign({ used:{}, floors:[] }, a || {}), B = Object.assign({ used:{}, floors:[] }, b || {}), used = { ...A.used };
  for(const [k, v] of Object.entries(B.used)) used[k] = Math.max(used[k] || 0, v);
  const mx = k => Math.max(A[k] || 0, B[k] || 0), fs = [A.fastest, B.fastest].filter(Boolean);
  return { battles: mx('battles'), wins: mx('wins'), gyms: mx('gyms'), elite: mx('elite'), champs: mx('champs'), used,
           hit: [A.hit, B.hit].filter(Boolean).sort((x, y) => y.dmg - x.dmg)[0] || null,
           fastest: fs.length ? Math.min(...fs) : 0, floors: [...new Set([...A.floors, ...B.floors])] };
}
function careerHtml(){
  const c = career(), fav = Object.entries(c.used).sort((x, y) => y[1] - x[1])[0], favId = fav && SPECIES[fav[0]] ? fav[0] : null;
  const tile = (n, lbl, extra) => `<div class="ct"><b>${n}</b><span>${lbl}</span>${extra || ''}</div>`;
  return `<h4>Career</h4><div class="career">
    ${tile(c.battles ? `${c.wins}<i>/${c.battles}</i>` : '—', 'Battles won')}
    ${tile(c.gyms, 'Gym leaders beaten')}
    ${tile(c.elite, 'Elite Four beaten')}
    ${tile(c.champs, 'Champion wins')}
    ${tile(c.fastest ? `T${c.fastest}` : '—', 'Fastest clear')}
    ${tile(c.hit ? c.hit.dmg : '—', 'Biggest hit', c.hit && SPECIES[c.hit.id] ? `<small>${esc(SPECIES[c.hit.id].name)}</small>` : '')}
    <div class="ct fav">${favId ? spriteHtml(favId, 'sm') : ''}<div><b>${favId ? esc(SPECIES[favId].name) : '—'}</b><span>Favourite pokémon${fav ? ` · ${fav[1]} battle${fav[1] === 1 ? '' : 's'}` : ''}</span></div></div>
  </div>`;
}
function homeFieldHtml(){
  const c = career(), cur = homeFloor();
  const sw = f => { const on = f === 'route' || c.floors.includes(f);
    return `<button class="hf ${on ? '' : 'locked'} ${f === cur ? 'cur' : ''}" data-hf="${f}" aria-label="${esc(floorName(f))}"><span class="fsw bstage board stadium fl-${f}"><span class="table"><span class="pitch"></span></span></span>${on ? '' : '<i class="hflock"></i>'}</button>`; };
  return `<h4>Home field <span class="dim">${1 + c.floors.length} / ${ALL_FLOORS.length}</span></h4>
    <div class="hfgrid">${ALL_FLOORS.map(sw).join('')}</div>
    <div class="hfinfo">${hfInfo(cur)}</div>`;
}
function hfInfo(f){
  const on = f === 'route' || career().floors.includes(f);
  return `<b>${esc(floorName(f))}</b> <span class="dim">${on ? 'Your trainer battles, and the shop before them, are played here.' : 'Locked. ' + esc(floorHow(f))}</span>`;
}
function bindHomeField(d){
  const info = d.querySelector('.hfinfo');
  d.querySelectorAll('[data-hf]').forEach(btn => btn.onclick = () => {
    const f = btn.dataset.hf, on = f === 'route' || career().floors.includes(f);
    SFX.play(on ? 'tap' : 'error');
    if(on){ PREF.set('homefloor', f); d.querySelectorAll('[data-hf]').forEach(x => x.classList.toggle('cur', x === btn)); layoutWorld(); }
    info.innerHTML = hfInfo(f);
  });
}

/* ---- 2.4.0 · THE HARDCORE BADGE ---------------------------------------
   Earned by clearing a run with One Life on (a One Life daily counts). Kept in
   this device's records as { count, first, last } and it rides along in a
   transfer code. The art is a drawn placeholder: drop a hardcore.png into the
   Sprites folder and gen-sprites.py picks it up as SPRITES.hardcore. */
const HC_HOW = 'Clear a run on One Life.';
function hcBadge(cls = ''){
  return SPRITES.hardcore
    ? `<img class="hcb ${cls}" src="${SPRITES.hardcore}" alt="Hardcore badge">`
    : `<svg class="hcb ${cls}" viewBox="0 0 32 32" role="img" aria-label="Hardcore badge"><polygon points="10,1.5 22,1.5 30.5,10 30.5,22 22,30.5 10,30.5 1.5,22 1.5,10" fill="#2b1a22" stroke="#e0a526" stroke-width="2"/><polygon points="10.6,5 21.4,5 27,10.6 27,21.4 21.4,27 10.6,27 5,21.4 5,10.6" fill="none" stroke="#7a1f2b" stroke-width="1"/><path d="M16 25.5C7 19.5 5.8 12.2 10.4 9.4c2.6-1.4 4.8-.3 5.6 1.4.8-1.7 3-2.8 5.6-1.4 4.6 2.8 3.4 10.1-5.6 16.1z" fill="#e8462a" stroke="#ffd36b" stroke-width="1"/><text x="16" y="19.4" text-anchor="middle" font-size="9.5" font-weight="900" fill="#fff" font-family="monospace,sans-serif">1</text></svg>`;
}
/* ---- 4.1.0 · RED'S BADGE ----------------------------------------------
   Earned by beating Red on Mt. Silver. Kept in records as { count, first, last },
   merged across devices like the Hardcore Badge. Drop redbadge.png into the
   Sprites folder to replace the drawn badge. */
const secretBoss = () => secretOf(G) || RED;
const SECRET_HOW = { red:'Beat Red on Mt. Silver. He turns up in about one Gen 2 run in six, after the Champion.',
                     oak:'Beat Professor Oak in Pallet Town. He turns up in about one Gen 1 run in six, after the Champion.' };
const GAUNT_HOW = 'Beat both Red and Oak in one Secret Gauntlet run (Gen 1 + Gen 2, costs a ticket for each).';
function redBadge(cls = ''){ return secretBadge('red', cls); }
function secretBadge(id, cls = ''){
  if(id === 'gauntlet') return `<svg class="hcb rdb ${cls}" viewBox="0 0 32 32" role="img" aria-label="Gauntlet Badge"><circle cx="16" cy="16" r="14.5" fill="#2b1a22" stroke="#e0a526" stroke-width="2"/><path d="M1.5 16a14.5 14.5 0 0 1 14.5-14.5v29A14.5 14.5 0 0 1 1.5 16z" fill="#d6342c"/><path d="M16 1.5a14.5 14.5 0 0 1 0 29z" fill="#3d9a4c"/><circle cx="16" cy="16" r="6" fill="#fff" stroke="#2b1a22" stroke-width="1.5"/><polygon points="17,10 13,17 16,17 15,22 19,15 16.2,15" fill="#ffd23a" stroke="#2b1a22" stroke-width=".8"/></svg>`;
  const nm = id === 'oak' ? 'Oak\u2019s Badge' : 'Red\u2019s Badge', img = id === 'oak' ? SPRITES.oakbadge : SPRITES.redbadge;
  if(img) return `<img class="hcb rdb ${cls}" src="${img}" alt="${nm}">`;
  if(id === 'oak') return `<svg class="hcb rdb ${cls}" viewBox="0 0 32 32" role="img" aria-label="${nm}"><circle cx="16" cy="16" r="14.5" fill="#f4f0e2" stroke="#2b1a22" stroke-width="2"/><circle cx="16" cy="16" r="10.5" fill="none" stroke="#3d9a4c" stroke-width="1.5"/><path d="M16 26c-1-6 0-11 2-14 2 1 6 3 6 8-3 0-5 1-6 3 0-4-2-7-4-9-1 3-1 8 2 12z" fill="#3d9a4c" stroke="#1d5a2a" stroke-width="1" stroke-linejoin="round"/><circle cx="16" cy="9" r="3.2" fill="#d6342c" stroke="#2b1a22" stroke-width="1"/></svg>`;
  return `<svg class="hcb rdb ${cls}" viewBox="0 0 32 32" role="img" aria-label="${nm}"><circle cx="16" cy="16" r="14.5" fill="#fff" stroke="#2b1a22" stroke-width="2"/><path d="M1.5 16a14.5 14.5 0 0 1 29 0z" fill="#d6342c"/><path d="M1.5 16h29" stroke="#2b1a22" stroke-width="2"/><polygon points="17.5,4.5 10.5,17 15.2,17 13.6,27 21.5,13.5 16.6,13.5 19,4.5" fill="#ffd23a" stroke="#2b1a22" stroke-width="1.3" stroke-linejoin="round"/></svg>`;
}
function secretRec(id){ const h = records()[id]; return h && h.count > 0 ? h : null; }
function redRec(){ return secretRec('red'); }
const secWonIds = () => G.secWon || (G.redResult === 'won' ? [secretBoss().id] : []);
function awardRed(){
  if(!G || G.over !== 'won' || G.redDone) return;
  const ids = secWonIds(); if(!ids.length) return;
  const r = records(); G.redDone = true;
  for(const id of ids){
    const h = r[id] || { count:0, first:null, last:null };
    if(id === secretBoss().id) G.redNew = !h.count;
    h.count++; h.first = h.first || localDate(); h.last = localDate();
    r[id] = h;
    if(!G.daily){ r.tickets = { ...(r.tickets || {}), [id]: Math.min(TICKET_MAX, ((r.tickets || {})[id] || 0) + 1) }; G.ticketNew = true; }   // 4.3.0: a ticket for a rematch (not from a daily)
    r.met = { ...(r.met || {}), [id]: true };
  }
  if(G.secrets && ids.length >= G.secrets.length){   // 4.4.0: both bosses down in the Secret Gauntlet
    const g = r.gauntlet || { count:0, first:null, last:null }; G.gauntNew = !g.count;
    g.count++; g.first = g.first || localDate(); g.last = localDate(); r.gauntlet = g;
  }
  saveRecords(r);
}
/* 4.4.0: your run of secret-boss wins in a row (a loss to a secret boss resets it) */
function noteSecretStreak(){
  if(!G || G.streakDone || !G.redOpen || !G.over) return;
  G.streakDone = true;
  const wins = secWonIds().length, lost = G.redResult === 'lost'; if(!wins && !lost) return;
  const r = records(), t = r.secStreak || { cur:0, best:0 };
  for(let k = 0; k < wins; k++){ t.cur++; t.best = Math.max(t.best, t.cur); }
  if(lost) t.cur = 0;
  r.secStreak = t; saveRecords(r);
}
const TICKET_MAX = 3;
const ticketCount = id => (records().tickets || {})[id] || 0;
const useTicket = id => { const r = records(); if(((r.tickets || {})[id] || 0) < 1) return false; r.tickets[id]--; saveRecords(r); return true; };
function hardcoreRec(){ const h = records().hardcore; return h && h.count > 0 ? h : null; }
const hcLine = h => `${h.count > 1 ? `${h.count} clears` : '1 clear'}${h.first ? ` · first ${prettyDate(h.first)}` : ''}`;
/** Called once when a finished run is a One Life win. */
function awardHardcore(){
  if(!G || G.over !== 'won' || !(G.mods && G.mods.onelife) || G.hcDone) return;
  const r = records(), h = r.hardcore || { count:0, first:null, last:null };
  G.hcNew = !h.count; G.hcDone = true;
  h.count++; h.first = h.first || localDate(); h.last = localDate();
  r.hardcore = h; saveRecords(r);
}
const mergeHardcore = (a, b) => {
  if(!(a && a.count) && !(b && b.count)) return undefined;
  a = a || {}; b = b || {};
  const firsts = [a.first, b.first].filter(Boolean).sort();
  return { count: Math.max(a.count || 0, b.count || 0), first: firsts[0] || null, last: [a.last, b.last].filter(Boolean).sort().pop() || null,
           ...(a.gold || b.gold ? { gold: Math.max(a.gold || 0, b.gold || 0) } : {}) };
};
/* ---- 4.12.0 · CHALLENGE BADGES ----------------------------------------
   One badge per challenge rule, earned by clearing a run with it on (a daily
   counts). Clear with GOLD_AT or more challenges stacked and that clear is
   GOLD for every one of them. Records: r.chal[id] = { count, gold, first, last }
   (+ types for Mono). One Life keeps its old record (r.hardcore) and its art. */
const GOLD_AT = 3;
const CHAL = [
  { id:'onelife',  name:'Hardcore Badge',   short:'Hardcore',  how:'Clear a run on One Life.' },
  { id:'nopc',     name:'Lone Six Badge',   short:'Lone Six',  how:'Clear a run with No PC.' },
  { id:'mono',     name:'Mono Badge',       short:'Mono',      how:'Clear a Mono-type run. Every type you clear gets stamped on it.' },
  { id:'noitems',  name:'Empty Bag Badge',  short:'Empty Bag', how:'Clear a run with No Held Items.' },
  { id:'nolegend', name:'Underdog Badge',   short:'Underdog',  how:'Clear a run with No Legendaries.' },
  { id:'hardgyms', name:'Gym Crusher Badge',short:'Crusher',   how:'Clear a run with Hard Gyms.' },
  { id:'tight',    name:'Thrifty Badge',    short:'Thrifty',   how:'Clear a run on a Tight Budget.' },
];
const chalById = id => CHAL.find(c => c.id === id);
const chalActive = g => CHAL.map(c => c.id).filter(id => g && g.mods && g.mods[id]);
function chalRec(id){ const r = records(), h = id === 'onelife' ? r.hardcore : (r.chal || {})[id]; return h && h.count > 0 ? h : null; }
function chalBadge(id, cls = ''){
  if(id === 'onelife') return hcBadge(cls);
  const c = chalById(id), img = SPRITES['badge-' + id];
  if(img) return `<img class="hcb ${cls}" src="${img}" alt="${esc(c.name)}">`;
  const rim = 'stroke="#2b1a22" stroke-width="2"', ink = '#2b1a22';
  const art = {
    nopc:     `<rect x="2" y="2" width="28" height="28" rx="6" fill="#3b6fb6" ${rim}/><rect x="6.5" y="6.5" width="19" height="19" rx="3" fill="none" stroke="#9cc3ff" stroke-width="1.2"/><text x="16" y="22" text-anchor="middle" font-size="16" font-weight="900" fill="#fff" font-family="monospace,sans-serif">6</text>`,
    mono:     `<circle cx="16" cy="16" r="14.5" fill="#7a52b3" ${rim}/><circle cx="16" cy="16" r="8.5" fill="#fff" stroke="${ink}" stroke-width="1.3"/><circle cx="16" cy="16" r="4" fill="#7a52b3"/>`,
    noitems:  `<path d="M16 1.8 29 6v9.5c0 7.6-5.4 12.6-13 14.7C8.4 28.1 3 23.1 3 15.5V6z" fill="#2f8f6b" ${rim}/><path d="M10.5 13h11l-1 9.5h-9z" fill="#f4f0e2" stroke="${ink}" stroke-width="1.2"/><path d="M13 13c0-3 6-3 6 0" fill="none" stroke="${ink}" stroke-width="1.2"/><path d="M8.5 24 23.5 9" stroke="#d6342c" stroke-width="2.4" stroke-linecap="round"/>`,
    nolegend: `<polygon points="16,1.5 30.5,12 25,30 7,30 1.5,12" fill="#c2603a" ${rim} stroke-linejoin="round"/><polygon points="16,7.5 18.4,13.3 24.4,13.6 19.7,17.4 21.3,23.3 16,19.9 10.7,23.3 12.3,17.4 7.6,13.6 13.6,13.3" fill="#ffd23a" stroke="${ink}" stroke-width="1"/><path d="M8.5 25 23.5 9" stroke="#2b1a22" stroke-width="2.4" stroke-linecap="round"/>`,
    hardgyms: `<polygon points="16,1.5 30.5,16 16,30.5 1.5,16" fill="#59606e" ${rim} stroke-linejoin="round"/><path d="M10 15.5 16 9.5l6 6M10 21.5l6-6 6 6" fill="none" stroke="#ffd23a" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`,
    tight:    `<circle cx="16" cy="16" r="14.5" fill="#d9a92b" ${rim}/><circle cx="16" cy="16" r="10.5" fill="none" stroke="#8a6512" stroke-width="1.3"/><text x="16" y="21" text-anchor="middle" font-size="13" font-weight="900" fill="#5a3f08" font-family="monospace,sans-serif">−1</text>`,
  }[id];
  return `<svg class="hcb ${cls}" viewBox="0 0 32 32" role="img" aria-label="${esc(c.name)}">${art}</svg>`;
}
/** Called once when a finished run is won (after awardHardcore). */
function awardChallenges(){
  if(!G || G.over !== 'won' || G.chDone) return;
  G.chDone = true;
  const act = chalActive(G); if(!act.length){ G.chNew = []; return; }
  const gold = act.length >= GOLD_AT, r = records(); r.chal = r.chal || {};
  G.chGold = gold; G.chNew = [];
  for(const id of act){
    let h;
    if(id === 'onelife') h = r.hardcore || (r.hardcore = { count:1, first:localDate(), last:localDate() });   // awardHardcore already counted it
    else { h = r.chal[id] || { count:0, first:null, last:null }; h.count++; h.first = h.first || localDate(); h.last = localDate(); r.chal[id] = h; }
    const isNew = id === 'onelife' ? !!G.hcNew : h.count === 1, goldNew = gold && !h.gold;
    if(gold) h.gold = (h.gold || 0) + 1;
    if(id === 'mono'){ h.types = [...new Set([...(h.types || []), G.mods.mono])]; }
    G.chNew.push({ id, isNew, goldNew });
  }
  saveRecords(r);
}
const mergeChal = (a, b) => {
  const out = {};
  for(const c of CHAL){ if(c.id === 'onelife') continue;
    const x = (a || {})[c.id], y = (b || {})[c.id], m = mergeHardcore(x, y);
    if(!m) continue;
    m.gold = Math.max((x || {}).gold || 0, (y || {}).gold || 0);
    if(c.id === 'mono') m.types = [...new Set([...((x || {}).types || []), ...((y || {}).types || [])])];
    out[c.id] = m; }
  return out;
};
/** Every special badge — secret bosses first, then challenges — with its record (or null). */
function specialBadges(){
  const R = records();
  const sec = [['red', 'Red’s Badge', 'Red'], ['oak', 'Oak’s Badge', 'Oak'], ['gauntlet', 'Gauntlet Badge', 'Gauntlet']].map(([id, name, short]) => {
    const rec = R[id] && R[id].count ? R[id] : null;
    return { id, kind:'sec', name, short, rec, how: id === 'gauntlet' ? GAUNT_HOW : SECRET_HOW[id], icon: cls => secretBadge(id, cls) };
  });
  const ch = CHAL.map(c => ({ id:c.id, kind:'chal', name:c.name, short:c.short, rec:chalRec(c.id), how:c.how, icon: cls => chalBadge(c.id, cls) }));
  return { sec, ch, all:[...sec, ...ch] };
}
const sbEarned = () => specialBadges().all.filter(b => b.rec);
/** The little row of badges by your name on the title screen: gold first, then the rest, at most 4 shown. */
function titleBadgesHtml(){
  const got = sbEarned().sort((a, b) => (b.rec.gold ? 1 : 0) - (a.rec.gold ? 1 : 0));
  if(!got.length) return '';
  const shown = got.slice(0, 4);
  return `<span class="tbadges" title="${esc(got.map(b => b.name).join(', '))}">${shown.map(b => `<span class="thc ${b.rec.gold ? 'gold' : ''}">${b.icon('sm')}</span>`).join('')}${got.length > shown.length ? `<i class="tmore">+${got.length - shown.length}</i>` : ''}</span>`;
}
function sbInfoHtml(b){
  if(!b) return `<span class="dim">Tap a badge to see what it is and how to earn it.</span>`;
  const r = b.rec, tk = (b.id === 'red' || b.id === 'oak') && ticketCount(b.id) ? ` <em class="tkt">🎫 ${ticketCount(b.id)} ticket${ticketCount(b.id) === 1 ? '' : 's'}</em>` : '';
  const gold = r && r.gold ? ` · <b class="gtxt">gold ×${r.gold}</b>` : '';
  const types = b.id === 'mono' && r && r.types && r.types.length ? `<span class="sbtypes">${r.types.map(t => `<i style="--c:${(TYPES[t] || {}).color || '#888'}">${esc(t)}</i>`).join('')}</span>` : '';
  const goldHow = b.kind === 'chal' ? ` Clear with ${GOLD_AT} or more challenges on at once for the gold version.` : '';
  return `${b.icon(r ? (r.gold ? 'gold' : '') : 'locked')}<div><b>${esc(b.name)}</b><span>${r ? esc(hcLine(r)) + gold : 'Not earned yet.'} ${esc(b.how)}${goldHow}${tk}</span>${types}</div>`;
}
function specialBadgesHtml(){
  const S = specialBadges();
  const tile = b => `<button class="sbt ${b.rec ? 'on' : ''} ${b.rec && b.rec.gold ? 'gold' : ''}" data-sb="${b.id}" aria-label="${esc(b.name)}">${b.icon(b.rec ? '' : 'locked')}
    <span>${esc(b.short)}</span>${b.rec && b.rec.count > 1 ? `<i class="sbn">×${b.rec.count}</i>` : ''}</button>`;
  return `<h4>Special badges <span class="dim">${S.all.filter(b => b.rec).length} / ${S.all.length}</span></h4>
    <h5 class="sbh">Secret bosses</h5><div class="sbgrid">${S.sec.map(tile).join('')}</div>
    <h5 class="sbh">Challenges</h5><div class="sbgrid">${S.ch.map(tile).join('')}</div>
    <div class="sbinfo">${sbInfoHtml(null)}</div>`;
}
function bindSpecialBadges(d){
  const info = d.querySelector('.sbinfo'), S = specialBadges();
  d.querySelectorAll('[data-sb]').forEach(btn => btn.onclick = () => {
    const b = S.all.find(x => x.id === btn.dataset.sb); SFX.play('tap');
    d.querySelectorAll('[data-sb]').forEach(x => x.classList.toggle('cur', x === btn));
    info.innerHTML = sbInfoHtml(b);
  });
}
/** The end-of-run block: every challenge badge this run earned. */
function chalAwardsHtml(){
  if(G.over !== 'won') return '';
  const L = G.chNew || chalActive(G).map(id => ({ id, isNew:false, goldNew:false })), gold = G.chNew ? !!G.chGold : chalActive(G).length >= GOLD_AT;   // a run won before 4.12.0 has no chNew
  if(!L.length) return '';
  if(L.length === 1){ const { id, isNew, goldNew } = L[0], c = chalById(id), h = chalRec(id);
    return `<div class="hcaward ${gold ? 'gold' : ''}">${chalBadge(id, 'big')}<div><b>${esc(c.name)}${isNew ? ' <i class="newdot">New</i>' : ''}</b>
      <span>${isNew ? esc(c.how.replace(/^Clear/, 'You cleared')) : `Another ${esc(modName(G, id))} clear${h ? ` · ${h.count} in all` : ''}.`}</span></div></div>`; }
  return `<div class="hcaward multi ${gold ? 'gold' : ''}"><div class="chhead"><b>${L.length} CHALLENGE BADGES</b><span>${gold ? `★ Gold clear: ${L.length} challenges at once` : 'Cleared with all of them on'}</span></div>
    <div class="chrow">${L.map(({ id, isNew, goldNew }) => `<div class="chone">${chalBadge(id, gold ? 'gold' : '')}<span>${esc(chalById(id).short)}</span>${isNew ? '<i class="newdot">New</i>' : goldNew ? '<i class="newdot gold">Gold</i>' : ''}</div>`).join('')}</div></div>`;
}

const secretStages = () => G.redOpen ? (G.secrets ? G.secrets.length : 1) : 0;
const reachedStage = () => G.over === 'won' ? runPlan(G).length - (G.redOpen ? secretStages() - (G.secrets ? secWonIds().length : (G.redResult === 'won' ? 1 : 0)) : 0) : (G.stage || 0);   // Red is a bonus, not part of 'Champion'
/* 2.0.0: a daily run keeps its own result per day, and a run with rules keeps
   its own record per rule set — neither muddies your plain-run records. */
const DAILY_REC = 'pkb_daily';
function dailyResults(){ try{ return JSON.parse(localStorage.getItem(DAILY_REC) || '{}') || {}; }catch(e){ return {}; } }
function noteDaily(){
  const all = dailyResults(), was = all[G.daily] || { best:-1, cleared:false, tries:0 };
  all[G.daily] = { ...was, best: Math.max(was.best, reachedStage()), badges: Math.max(was.badges || 0, G.badges),
                   cleared: was.cleared || G.over === 'won', mods: modsLabel(G),
                   hardcore: !!(was.hardcore || (G.over === 'won' && G.mods && G.mods.onelife)),
                   secret: (G.redResult === 'won' ? secretBoss().name : was.secret) || '' };
  try{ localStorage.setItem(DAILY_REC, JSON.stringify(all)); }catch(e){}
}
function recBucket(r){
  if(!modList(G).length) return r;
  r.modes = r.modes || {}; const k = modsLabel(G);
  return r.modes[k] || (r.modes[k] = { runs:0, cleared:0, best:-1 });
}
/* 4.9.0 · RUN HISTORY: the last 30 finished runs on this device, newest first. */
const HIST_MAX = 30;
function logRun(){
  if(!G || G.histLogged) return; G.histLogged = true;
  const r = records(), gl = G.gens ? [].concat(G.gens).join('+') : '1';
  const sec = G.secWon || (G.redResult === 'won' ? [secretBoss().id] : []);
  const team = G.team.concat(G.pc || []).slice().sort((a, b) => (b.lvl || 0) - (a.lvl || 0)).slice(0, 6).map(u => u.id);
  r.history = [{ at: Date.now(), won: G.over === 'won', stage: reachedStage(), label: bestRunLabel(reachedStage()), team, mods: modsLabel(G), gens: gl, daily: G.daily || '', sec, ch: G.over === 'won' ? chalActive(G) : [], chg: G.over === 'won' && chalActive(G).length >= GOLD_AT, turn: G.turn || 1, badges: G.badges || 0 }].concat(r.history || []).slice(0, HIST_MAX);
  saveRecords(r);
}
function noteProgress(){ if(G.daily) return noteDaily(); const r = records(), b = recBucket(r); if(reachedStage() > b.best){ b.best = reachedStage(); saveRecords(r); } }
function noteRunEnd(){ logRun(); noteCareerEnd(); awardHardcore(); awardChallenges(); awardRed(); noteSecretStreak(); if(G.daily){ noteDaily(); return; } const r = records(), b = recBucket(r); b.runs++; if(G.over === 'won') b.cleared++; b.best = Math.max(b.best, reachedStage()); saveRecords(r); }
/** Restarting a run you have actually played counts as finishing it. */
function noteQuit(){ if(G && !G.over && ((G.stage || 0) > 0 || G.turn > 1)){ logRun(); if(G.daily){ noteDaily(); return; } const r = records(), b = recBucket(r); b.runs++; b.best = Math.max(b.best, reachedStage()); saveRecords(r); } }
function noteBattle(b){
  if(!b || b.exhibition || !b.steps || !b.steps.length) return;
  const rec = G.rec || (G.rec = { fought:{}, hit:null });
  for(const u of b.steps[0].p) rec.fought[u.uid] = (rec.fought[u.uid] || 0) + 1;
  const P = partnerOf(); if(P) PREF.set('partner', P.u.id);   // v38: the title screen shows it next time
  for(let i = 1; i < b.steps.length; i++){
    const s = b.steps[i], prev = b.steps[i - 1];
    const act = (s.fx || []).find(f => f.kind === 'act');
    if(!act || act.side !== 'p') continue;
    const me = prev.p.find(u => u.uid === act.uid);
    if(!me) continue;
    let best = 0;
    for(const e of prev.e){ const now = s.e.find(x => x.uid === e.uid); best = Math.max(best, e.hp - (now ? Math.max(0, now.hp) : 0)); }
    if(best > 0 && (!rec.hit || best > rec.hit.dmg)) rec.hit = { dmg: Math.round(best), id: me.id };
  }
}
function bestRunLabel(stage){
  if(stage < 0) return '—';
  const plan = runPlan(G);
  if(stage >= plan.length - secretStages()) return 'Champion!';
  if(plan[stage].boss) return `Reached ${plan[stage].boss.name}`;
  let k = stage; while(k < plan.length && !plan[k].boss) k++;
  return plan[k] ? `On the way to ${plan[k].boss.name}` : '—';
}
function partnerOf(){
  const f = (G.rec && G.rec.fought) || {};
  let best = null;
  for(const u of G.team.concat(G.pc)) if(f[u.uid] && (!best || f[u.uid] > f[best.uid])) best = u;
  return best ? { u: best, n: f[best.uid] } : null;
}
function openTrainerCard(fromTitle){
  const R = records(), P = partnerOf(), hit = G.rec && G.rec.hit, HC = R.hardcore && R.hardcore.count ? R.hardcore : null, RD = R.red && R.red.count ? R.red : null, OK = R.oak && R.oak.count ? R.oak : null;
  const live = !fromTitle || runInProgress();     // from the title with no run going, only who you are
  const face = P ? P.u.id : PREF.get('partner', '');
  const streak = !G.streak ? '—' : G.streak > 0 ? `${G.streak}W` : `${-G.streak}L`;
  const cells = bossPlanOf(G).gyms.slice(0, TUNING.badgesToWin).map((g, i) => i < G.badges
    ? `<div class="bcell2 on" title="${esc(g.badge)} Badge — ${esc(g.name)}"><i class="bdg ${badgeCls(G, i)} on"></i>${bossArt(g, 'case')}<span>${esc(g.badge)}</span></div>`
    : `<div class="bcell2" title="${esc(g.badge)} Badge — not won yet"><i class="bdg ${badgeCls(G, i)}"></i></div>`).join('');
  const d = modal(`<div class="tcard">
    <div class="trow">
      <div class="facts">
        <div><span>Name</span><b>${esc(playerName())}</b></div>
        ${live ? `<div><span>Money</span><b>₽${G.credits}</b></div>
        <div><span>Turn</span><b>${G.turn}</b></div>
        <div><span>Lives</span><b>${Math.max(0, G.lives)}/${G.mods && G.mods.onelife ? 1 : TUNING.startingLives}</b></div>
        <div><span>Streak</span><b>${streak}</b></div>` : `<div><span>Runs played</span><b>${R.runs}</b></div>
        <div><span>Runs cleared</span><b>${R.cleared}</b></div>`}
      </div>
      <div class="tface" title="${P ? esc(P.u.nm) + ', your partner' : ''}">${SPRITES[face] ? `<img src="${SPRITES[face]}" alt="">` : '<i class="pball"></i>'}</div>
    </div>
    <h4>Badges</h4><div class="bcase">${cells}</div>
    ${careerHtml()}
    ${specialBadgesHtml()}
    ${homeFieldHtml()}
    <h4>Records</h4><div class="recs">
      ${R.secStreak && R.secStreak.best ? `<div><span>Secret boss streak</span><b>${R.secStreak.cur} now · best ${R.secStreak.best}</b></div>` : ''}
      <div><span>Best run</span><b>${esc(bestRunLabel(Math.max(R.best, live ? reachedStage() : 0)))}</b></div>
      <div><span>Runs cleared</span><b>${R.cleared} of ${R.runs}</b></div>
      ${live ? `<div><span>Partner</span><b>${P ? `${esc(SPECIES[P.u.id].name)} · ${P.n} battle${P.n === 1 ? '' : 's'}` : '—'}</b></div>
      <div><span>Biggest hit</span><b>${hit ? `${esc(SPECIES[hit.id] ? SPECIES[hit.id].name : '?')} · ${hit.dmg}` : '—'}</b></div>` : ''}
      ${Object.entries(R.modes || {}).filter(([, b]) => b.runs).map(([k, b]) => `<div><span>${esc(k)}</span><b>${b.cleared} of ${b.runs} cleared · ${esc(bestRunLabel(b.best))}</b></div>`).join('')}
      ${(() => { const t = dailyResults()[localDate()]; return t ? `<div><span>Today’s daily</span><b>${esc(t.cleared ? 'Champion!' : bestRunLabel(t.best))}${t.hardcore ? ' · Hardcore' : ''}</b></div>` : ''; })()}
    </div>
  </div>
  <div class="btnrow"><button class="btn" data-m="history">Run history</button><button class="btn" data-m="options">Change name</button><button class="btn ghost" data-m="close">Close</button></div>`);
  d.classList.add('trainer');
  bindSpecialBadges(d); bindHomeField(d);
  d.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { d.remove(); if(b.dataset.m === 'options') openOptions(); if(b.dataset.m === 'history') openHistory(fromTitle); });
}

function openHistory(fromTitle){
  const H = records().history || [], ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 2 ? 'just now' : m < 90 ? m + ' min ago' : m < 2160 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' days ago'; };
  const row = h => `<div class="hrow ${h.won ? 'won' : ''}"><div class="hteam">${(h.team || []).map(id => SPECIES[id] ? spriteHtml(id, 'sm') : '').join('')}</div>
    <div class="hinfo"><b>${h.won ? 'Champion!' : esc(h.label || '—')}</b>${(h.sec || []).length ? ' <span class="tag">' + h.sec.map(x => x === 'oak' ? 'Oak' : 'Red').join(' + ') + ' beaten</span>' : ''}${(h.ch || []).length ? ` <span class="hch ${h.chg ? 'gold' : ''}">${h.ch.map(id => chalById(id) ? chalBadge(id, 'sm') : '').join('')}</span>` : ''}
      <span class="dim">${[h.gens ? 'Gen ' + esc(h.gens) : '', esc(h.mods || ''), h.daily ? 'Daily ' + esc(h.daily) : '', ago(h.at)].filter(Boolean).join(' · ')}</span></div></div>`;
  const d = modal(`<h3>Run history</h3><p class="dim">Your last ${HIST_MAX} runs on this device. Transfer codes carry it along.</p>
    <div class="hlist">${H.length ? H.map(row).join('') : '<p class="dim">No finished runs yet. They show up here once you win, lose or start a new run.</p>'}</div>
    <div class="btnrow"><button class="btn ghost" data-m="close">Back</button></div>`);
  d.classList.add('trainer', 'history');
  d.querySelector('[data-m="close"]').onclick = () => { d.remove(); openTrainerCard(fromTitle); };
}

/* ---- OPTIONS (v37) ------------------------------------------------ */
function openOptions(){
  const seg = (key, cur, opts) => `<div class="speed optseg" role="group">${opts.map(([v, l]) =>
    `<button class="sp ${String(v) === String(cur) ? 'on' : ''}" data-o="${key}" data-v="${v}" aria-pressed="${String(v) === String(cur)}">${l}</button>`).join('')}</div>`;
  const d = modal(`<h3>Options</h3>
    <label class="optrow" for="optname"><span>Name</span>
      <input id="optname" maxlength="10" value="${esc(PREF.get('name', ''))}" placeholder="Trainer" autocomplete="off" spellcheck="false"></label>
    <div class="optrow"><span>Theme</span>${seg('theme', PREF.get('theme', 'light'), [['light', 'Light'], ['dark', 'Dark'], ['system', 'System']])}</div>
    <div class="optrow"><span>Battle speed</span>${seg('speed', speed, [[1, '1×'], [2, '2×'], [4, '4×']])}</div>
    <div class="optrow"><span>Motion</span>${seg('motion', PREF.get('motion', 'device'), [['device', 'Normal'], ['reduced', 'Reduced']])}</div>
    <div class="optrow"><span>Title screen</span>${seg('title', PREF.get('title', 'on'), [['on', 'Show'], ['off', 'Skip']])}</div>
    <div class="optrow"><span>Haptics</span>${seg('haptics', PREF.get('haptics', 'on'), [['on', 'On'], ['off', 'Off']])}</div>
    <div class="optrow"><span>Trainer battles</span>${seg('autoskip', PREF.get('autoskip', 'off'), [['off', 'Watch'], ['on', 'Skip to result']])}</div>
    <div class="optrow"><span>Tips</span>${seg('tips', PREF.get('tips', 'on'), [['on', 'Show'], ['off', 'Hide'], ['reset', 'Show again']])}</div>
    <div class="optrow"><span>Volume</span>${seg('volume', PREF.get('sound', 'on') === 'off' ? 'off' : PREF.get('volume', 'mid'), [['off', 'Mute'], ['low', 'Low'], ['mid', 'Mid'], ['high', 'High']])}</div>
    <div class="optrow"><span>Battle look</span>${seg('look', PREF.get('look', 'stadium'), [['stadium', 'Stadium'], ['mini', 'Miniatures'], ['paper', 'Paper']])}</div>
    <div class="optrow"><span>Effects</span>${seg('fx', fxLevel(), [['full', 'Full'], ['light', 'Light'], ['off', 'Off']])}</div>
    <div class="optrow"><span>Item hints</span>${seg('itemhint', PREF.get('itemhint', 'on'), [['on', 'Show'], ['off', 'Hide']])}</div>
    <div class="optrow"><span>Transitions</span>${seg('wipe', PREF.get('wipe', 'auto'), [['auto', 'Camera'], ['quick', 'Quick'], ['off', 'Off']])}</div>
    <p class="hint optnote">Your name goes on your Trainer Card and your duel teams. System theme follows your phone or computer. These settings stay on this device.
      If your phone or computer asks apps for less motion, the game follows it. Transitions on Auto play the full pokéball wipe for your first ${WIPE_FULL_BATTLES} battles each time you open the game, then a quick one.
      On an iPhone the silent switch mutes the sound, and iPhones don't let web pages vibrate, so Haptics only works on Android.
      Battle look changes the pieces on the stadium table: squares, miniatures on round bases, or paper standees.
      Effects: Light keeps the move effects but drops trails, signature moves, field weather and half the particles, for older phones; Off shows only the numbers.
      Item hints puts a gold star on the party pokémon that gains the most from the vitamin or held item you have picked.
      Skip to result plays trainer battles instantly — gym leaders, the Elite Four, the Champion and your rival are always shown.</p>
    <div class="btnrow"><button class="btn primary" data-m="close">Done</button></div>`);
  d.classList.add('options');
  const inp = d.querySelector('#optname');
  inp.addEventListener('input', () => PREF.set('name', inp.value.replace(/[<>]/g, '').slice(0, 10)));
  inp.addEventListener('keydown', e => { if(e.key === 'Enter') inp.blur(); e.stopPropagation(); });
  d.querySelectorAll('[data-o]').forEach(b => b.onclick = () => {
    const k = b.dataset.o, v = b.dataset.v;
    if(k === 'speed') setSpeed(+v);
    else if(k === 'tips' && v === 'reset'){ TIPS.reset(); PREF.set('tips', 'on'); }
    else if(k === 'volume'){ if(v === 'off') PREF.set('sound', 'off'); else { PREF.set('sound', 'on'); PREF.set('volume', v); } }   // 4.9.1: Mute lives in the Volume row
    else PREF.set(k, v);
    if(k === 'haptics' && v === 'on') HAPTIC.buzz('select');
    if(k === 'motion') applyMotion();
    if(k === 'theme') applyTheme();
    if((k === 'sound' || k === 'volume') && v !== 'off') setTimeout(() => SFX.play('select'), 30);   // hear the new level
    d.querySelectorAll(`[data-o="${k}"]`).forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); });
  });
  d.querySelector('[data-m="close"]').onclick = () => { d.remove(); render(); };
  d.addEventListener('click', ev => { if(ev.target === d) render(); });
}

/* ---- the message box types itself out (v37) -----------------------
   The whole text is in the page from the start — each letter just fades in on
   a short stagger, so nothing that reads the box ever sees half a sentence.
   Only when the message changes; a redraw with the same text shows it whole. */
let lastInspect = '';
function typeInspect(){
  const box = $('#inspect'); if(!box) return;
  const html = box.innerHTML;
  if(html === lastInspect) return;
  lastInspect = html;
  if(motionOff() || true) return;   // 5.4.0: the info box no longer types itself out (that was the Game Boy style)
  /* v43: a full summary has chips, bars and flex rows that splitting into
     letters would break apart, so it rolls out line by line instead. */
  const sum = box.querySelector('.isum');
  if(sum){ sum.classList.remove('reveal'); void sum.offsetWidth; sum.classList.add('reveal'); return; }
  const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
  const nodes = []; while(walker.nextNode()) nodes.push(walker.currentNode);
  const total = nodes.reduce((t, n) => t + n.nodeValue.length, 0);
  if(!total) return;
  const per = Math.min(16, 700 / total);
  let k = 0;
  for(const n of nodes){
    const frag = document.createDocumentFragment();
    for(const ch of n.nodeValue){
      if(/\s/.test(ch)){ frag.appendChild(document.createTextNode(ch)); k++; continue; }
      const sp = document.createElement('span');
      sp.className = 'tw'; sp.style.animationDelay = Math.round(k++ * per) + 'ms'; sp.textContent = ch;
      frag.appendChild(sp);
    }
    n.parentNode.replaceChild(frag, n);
  }
}

/* ===================================================================
   1.3.0 · TRANSFER CODES
   Each copy of the game keeps its own save (the claude.ai link, the
   home-screen app, another phone). A transfer code carries a run from one to
   another: the run, the records and the trainer name, squeezed (deflate) and
   written as text with a checksum so a half-pasted code is caught, not loaded.
   =================================================================== */
const XFER_PREFIX = 'PKBSAVE-';
const b64u = bytes => { let s = ''; for(let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64u = str => { const s = atob(str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4));
  const out = new Uint8Array(s.length); for(let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i); return out; };
const xsum = str => { let h = 0x811c9dc5; for(let i = 0; i < str.length; i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(36).padStart(7, '0').slice(-6); };
async function squeeze(bytes, how){
  const cs = new (how === 'z' ? CompressionStream : DecompressionStream)('deflate-raw');
  const out = new Response(new Blob([bytes]).stream().pipeThrough(cs)).arrayBuffer();
  return new Uint8Array(await out);
}
async function makeTransferCode(){
  const g = JSON.parse(JSON.stringify(G));
  if(Array.isArray(g.log)) g.log = g.log.slice(-10);           // the full battle log isn't worth the length
  const payload = { k:'pkb', f:1, v:GAME_VERSION.v, at:Date.now(), name:playerName(), rec:records(),
                    s:{ G:g, phase: phase === 'battle' ? 'shop' : phase } };
  let bytes = new TextEncoder().encode(JSON.stringify(payload)), flag = 'j';
  try{ if(typeof CompressionStream === 'function'){ bytes = await squeeze(bytes, 'z'); flag = 'z'; } }catch(e){ flag = 'j'; }
  const body = flag + b64u(bytes);
  return XFER_PREFIX + body + '-' + xsum(body);
}
async function readTransferCode(raw){
  const code = String(raw || '').replace(/\s+/g, '');
  if(!code) return { ok:false, why:'Paste a transfer code first.' };
  if(/^PKB\d-/.test(code)) return { ok:false, why:'That’s an old team code, not a transfer code.' };
  if(!code.startsWith(XFER_PREFIX)) return { ok:false, why:'That doesn’t look like a transfer code — they start with PKBSAVE-.' };
  const rest = code.slice(XFER_PREFIX.length), cut = rest.lastIndexOf('-');
  if(cut < 2) return { ok:false, why:'This code is cut short. Copy the whole thing and try again.' };
  const body = rest.slice(0, cut), sum = rest.slice(cut + 1);
  if(xsum(body) !== sum) return { ok:false, why:'This code is damaged or cut short. Copy the whole thing and try again.' };
  try{
    let bytes = unb64u(body.slice(1));
    if(body[0] === 'z') bytes = await squeeze(bytes, 'u');
    const data = JSON.parse(new TextDecoder().decode(bytes));
    if(!data || data.k !== 'pkb' || !data.s || !data.s.G || !Array.isArray(data.s.G.team)) return { ok:false, why:'This code has no run in it.' };
    return { ok:true, data };
  }catch(e){ return { ok:false, why:'This code couldn’t be read. Copy the whole thing and try again.' }; }
}
function applyTransfer(data){
  const key = slotKey(data.s.G);                     // 2.0.0: a daily run lands in the daily slot
  const before = localStorage.getItem(key);
  try{
    save();                                          // keep whatever is on screen in its own slot
    localStorage.setItem(key, JSON.stringify(data.s));
    const d = load(key);
    if(!d) throw new Error('bad save');
    // records: keep the best of both devices
    const a = records(), b = Object.assign({ runs:0, cleared:0, best:-1 }, data.rec || {});
    const hc = mergeHardcore(a.hardcore, b.hardcore), rd = mergeHardcore(a.red, b.red), ok = mergeHardcore(a.oak, b.oak);
    const tk = { red: Math.max((a.tickets || {}).red || 0, (b.tickets || {}).red || 0), oak: Math.max((a.tickets || {}).oak || 0, (b.tickets || {}).oak || 0) }, mt = { ...(a.met || {}), ...(b.met || {}) }, ga = mergeHardcore(a.gauntlet, b.gauntlet), st = { cur: Math.max((a.secStreak || {}).cur || 0, (b.secStreak || {}).cur || 0), best: Math.max((a.secStreak || {}).best || 0, (b.secStreak || {}).best || 0) };
    const chm = mergeChal(a.chal, b.chal);   // 4.12.0
    const cr = mergeCareer(a.career, b.career);   // 5.5.0
    const hist = [...(a.history || []), ...(b.history || [])].filter((x, i, arr) => x && arr.findIndex(y => y && y.at === x.at) === i).sort((p, q) => q.at - p.at).slice(0, HIST_MAX);
    saveRecords({ ...a, ...(cr ? { career: cr } : {}), chal: chm, history: hist, tickets: tk, met: mt, ...(ga ? { gauntlet: ga } : {}), ...(st.best ? { secStreak: st } : {}), runs: Math.max(a.runs, b.runs), cleared: Math.max(a.cleared, b.cleared), best: Math.max(a.best, b.best), ...(hc ? { hardcore: hc } : {}), ...(rd ? { red: rd } : {}), ...(ok ? { oak: ok } : {}) });
    if(data.name && data.name !== 'Trainer') PREF.set('name', String(data.name).replace(/[<>]/g, '').slice(0, 10));
    G = d.G; phase = d.phase === 'over' ? 'over' : 'shop';
    sel = null; inspect = null; battle = null; shopMem = null; drawnPhase = null; toast = ''; undo = null;
    if(!G.daycare || !G.daycare.length) rollShop(G, false);
    save(); render();
    if(phase === 'shop' && pendingOffer(G)) openRewardPicker();
    return true;
  }catch(e){
    try{ if(before === null) localStorage.removeItem(key); else localStorage.setItem(key, before); }catch(_){}
    return false;
  }
}
const runSummary = (g, name) => `${esc(name || 'Trainer')} · turn ${g.turn || 1} · ${g.badges || 0} badge${g.badges === 1 ? '' : 's'}${g.over ? (g.over === 'won' ? ' · cleared' : ' · run over') : ''}`;
function openTransfer(){
  const d = modal(`<h3>Transfer save</h3>
    <p>Each copy of PokéArena keeps its own save: this link, the home-screen app, another phone or computer. A transfer code moves your run between them, with your records and name.</p>
    <h4>Send this run</h4>
    <p class="dim">${runSummary(G, playerName())}</p>
    <div class="xout" hidden><textarea readonly class="xcode"></textarea><p class="dim xlen"></p></div>
    <div class="btnrow"><button class="btn primary" data-x="make">Make code</button><button class="btn" data-x="copy" hidden>Copy</button>${
      navigator.share ? '<button class="btn" data-x="share" hidden>Share</button>' : ''}</div>
    <h4>Load a run</h4>
    <textarea class="xin" placeholder="PKBSAVE-…" spellcheck="false" autocomplete="off"></textarea>
    <p class="xmsg" role="status"></p>
    <div class="xconfirm" hidden><p class="xwhat"></p>
      <div class="btnrow"><button class="btn danger" data-x="yes">Replace my run</button><button class="btn" data-x="no">Cancel</button></div></div>
    <div class="btnrow"><button class="btn" data-x="read">Load</button><button class="btn ghost" data-x="close">Close</button></div>`);
  d.classList.add('xfer');
  const $$ = q => d.querySelector(q), msg = t => { $$('.xmsg').textContent = t || ''; };
  let code = '', pending = null;
  d.querySelectorAll('[data-x]').forEach(b => b.onclick = async () => {
    const x = b.dataset.x;
    if(x === 'close'){ d.remove(); return; }
    if(x === 'make'){
      b.disabled = true; code = await makeTransferCode(); b.disabled = false;
      $$('.xcode').value = code; $$('.xout').hidden = false; $$('.xlen').textContent = `${code.length} characters. Copy all of it.`;
      d.querySelectorAll('[data-x="copy"],[data-x="share"]').forEach(e => e.hidden = false);
      b.textContent = 'New code'; SFX.play('select'); return;
    }
    if(x === 'copy'){
      const ta = $$('.xcode'); ta.select();
      try{ navigator.clipboard ? await navigator.clipboard.writeText(code) : document.execCommand('copy'); }catch(e){ try{ document.execCommand('copy'); }catch(_){} }
      b.textContent = 'Copied!'; return;
    }
    if(x === 'share'){ try{ await navigator.share({ title:'PokéArena save', text: code }); }catch(e){} return; }
    if(x === 'read'){
      $$('.xconfirm').hidden = true; pending = null;
      const r = await readTransferCode($$('.xin').value);
      if(!r.ok){ SFX.play('error'); msg(r.why); return; }
      pending = r.data; msg('');
      const when = pending.at ? new Date(pending.at).toLocaleString([], { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' }) : '';
      $$('.xwhat').innerHTML = `Load <b>${runSummary(pending.s.G, pending.name)}</b>${when ? ` <span class="dim">(made ${esc(when)}${pending.v && pending.v !== GAME_VERSION.v ? ` on ${esc(pending.v)}` : ''})</span>` : ''}?
        It replaces the run on this device: <b>${runSummary(G, playerName())}</b>.`;
      $$('.xconfirm').hidden = false; return;
    }
    if(x === 'no'){ $$('.xconfirm').hidden = true; pending = null; return; }
    if(x === 'yes' && pending){
      if(applyTransfer(pending)){ SFX.play('levelup'); d.remove(); say('Run loaded from your transfer code.'); }
      else { SFX.play('error'); msg('That run couldn’t be loaded here. Nothing on this device was changed.'); $$('.xconfirm').hidden = true; }
    }
  });
}

function typeRingHtml(){
  /* 3.0.0: the real Gen 1 types — each row is a type with what it is weak to and resists. */
  const chips = l => l.length ? l.map(t => `<span class="chip" style="background:${TYPES[t].color}">${t}</span>`).join('') : '<span class="dim">nothing</span>';
  return `<div class="tchart">` + Object.keys(TYPES).map(t => `<div class="trow"><span class="chip big" style="background:${TYPES[t].color}">${t}</span>
    <div><i class="bad">weak to</i> ${chips(TYPES[t].weak)}</div><div><i class="good">resists</i> ${chips(TYPES[t].resist)}</div></div>`).join('') + `</div>`;
}

/* 4.10.0 · FIRST-RUN TUTORIAL — five short cards the first time the game opens (and from How to Play → Replay the tutorial). */
function openTutorial(){
  const T = TUNING;
  const pages = [
    { ids:['bulbasaur','charmander','squirtle'], title:'Welcome to PokéArena',
      text:`Build a team of up to ${T.maxTeam} pokémon and beat ${T.badgesToWin} gym leaders, the Elite Four and the Champion. Battles play out on their own: your job is the team you bring to each one.` },
    { ids:['onix','pikachu'], title:'Buy, then place',
      text:'Tap a pokémon in the Daycare, then tap an empty spot in your party. Where they stand matters: the front rank takes the hits and the back rank deals damage safely. The little badge on each is its role, and “Line up by role” sorts your party for you.' },
    { ids:['charmander','charmeleon','charizard'], title:'Level up and evolve',
      text:'Three copies of the same pokémon make it level 2, six make level 3, and levelling up evolves it. You earn ₽ after every battle to spend in the Daycare and the PokéMart on stones, held items and next-battle boosts.' },
    { ids:['snorlax','zapdos'], title:'Fights have stakes',
      text:`Lose a battle and you lose a life, and with ${T.startingLives} lives gone the run is over. Every gym gives you a badge reward to choose. After gym ${T.legend.fromBadge} a legendary may turn up for one turn: recruit it or let it go.` },
    { ids:['eevee','pikachu','mew'], title:'Make it yours',
      text:'The Menu button opens your Pokédex, Trainer Card, run history and Options. New Run lets you choose generations, rules and challenges (each challenge clears for a badge). The Daily Challenge is one shared run each day, and Duels lets you battle a friend.' },
  ];
  let i = 0;
  const d = modal('', true); d.classList.add('tutorial');
  const finish = () => { PREF.set('tutorial', 'done'); TIPS.dismiss('shop'); d.remove(); SFX.play('back'); render(); };
  const draw = () => {
    const p = pages[i], last = i === pages.length - 1;
    d.querySelector('.boxscroll').innerHTML = `<div class="tutpg">
      <div class="tutart">${p.ids.filter(k => SPECIES[k]).map(k => spriteHtml(k, 'lg')).join('')}</div>
      <h3>${esc(p.title)}</h3><p>${esc(p.text)}</p>
      <div class="tutdots" aria-hidden="true">${pages.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
      <div class="btnrow">${i > 0 ? '<button class="btn" data-t="back">Back</button>' : '<button class="btn ghost" data-t="skip">Skip</button>'}
        <button class="btn primary" data-t="next">${last ? 'Let’s go!' : 'Next'}</button></div>
      ${i > 0 && !last ? '<button class="btn ghost tutskip" data-t="skip">Skip the tutorial</button>' : ''}</div>`;
    d.querySelectorAll('[data-t]').forEach(b => b.onclick = () => {
      const a = b.dataset.t;
      if(a === 'skip') return finish();
      if(a === 'back'){ i--; SFX.play('back'); return draw(); }
      if(last) return finish();
      i++; SFX.play('select'); draw(); });
  };
  draw(); SFX.play('open');
}
/** First time only: a fresh install with nothing played yet. Test browsers skip it like the tips. */
function maybeTutorial(){
  if(PREF.get('tutorial', '') === 'done' || (navigator.webdriver && !window.PKB_TIPS)) return;
  if(!G || G.daily || (records().runs || 0) > 0 || (G.turn || 1) > 1 || (G.stage || 0) > 0) { PREF.set('tutorial', 'done'); return; }   // someone already playing doesn't need it
  openTutorial();
}
function openHelp(){
  const T = TUNING;
  const d = modal(`<h3>How to Play</h3>
    <button class="btn replay" data-m="tutorial">Replay the tutorial</button>
    <p class="legend"><span style="color:var(--atk)">${SI('a')} Attack</span>
       <span style="color:var(--hp)">${SI('h')} HP</span>
       <span style="color:var(--spd)">${SI('s')} Speed</span></p>

    <h4>The formation</h4>
    <p>Your party fights as <b>three ranks, two abreast</b> — Front, Middle, Back. Attacks land on a random
    pokémon in the enemy's <b>front rank</b> unless a move says otherwise, so a second body up front halves
    the chance either one gets hit. <b>Put pokémon wherever you like</b> — gaps are fine: a lone
    pokémon in the front rank takes every front-line hit on its own. The front is the frontmost rank anyone
    is still standing in, so when a whole rank is knocked out, the rank behind becomes the front. Tap a
    pokémon, then any cell, to move it there (or swap). The PC works the same way: tap a stored pokémon,
    then any box — or drop a Daycare pokémon on a stored copy to combine them.</p>
    <p>Tap any pokémon or item and its full summary appears in the message box under your party.</p>

    <h4>Two moves</h4>
    <p>Every pokémon has a <b>main move</b> and a <b>second move</b>. The second one fires instead of the main
    move when its trigger comes up: <b>first, before anyone moves</b> (Quick Attack and friends jump the queue),
    <b>its first action</b>, <b>every 3rd action</b>, <b>once below half HP</b>, or <b>when a teammate is below
    half HP</b>. Both are on the pokémon's summary card.</p>
    <p class="legend" style="flex-direction:column;align-items:flex-start;gap:4px">
      ${Object.keys(TUNING.status).map(k => { const S = TUNING.status[k]; return `<span><b>${S.icon} ${esc(S.name)}</b> — ${esc({
        brn:`loses ${Math.round(S.dotPct*100)}% of its HP every round and its attacks deal ${Math.round(S.atkCut*100)}% less, for ${S.rounds} rounds. Fire types can't be burned.`,
        psn:`loses ${Math.round(S.dotPct*100)}% of its HP every round for ${S.rounds} rounds. Poison types can't be poisoned.`,
        par:`acts ${Math.round((1 - 1/S.slow)*100)}% less often for ${S.rounds} rounds. Electric types can't be paralysed.`,
        slp:`skips its next ${S.actions} actions.`,
        cnf:`for ${S.actions} actions, ${Math.round(S.selfHit*100)}% chance to hit itself instead.`,
        fln:`skips its next action.` }[k])}</span>`; }).join('')}
    </p>
    <p>A pokémon has one status at a time, and can suffer each one only <b>once per battle</b> (flinching
    aside), so nobody gets put to sleep forever. <b>Barriers</b> (Light Screen, Defense Curl, Iron Defense…) soak
    damage before HP does.</p>

    <h4>Roles</h4>
    <p>Every pokémon has a <b>role</b>, shown by the badge on the top-left of its picture. The role
    decides how it <b>grows</b> — EXP, level-ups and merges all lean its way — and gives it one
    <b>trait</b>. Medicine is the same for everyone.</p>
    <p class="legend" style="flex-direction:column;align-items:flex-start;gap:4px">
      ${Object.keys(ROLES).map(r => `<span><b>${ROLES[r].icon} ${esc(ROLES[r].name)}</b> — ${esc(ROLES[r].text())}</span>`).join('')}
    </p>
    <p>A team of one role falls over: six Tanks can't finish anything and six Cannons can't stand up.
    The classic line-up is Tanks in front, Bruisers beside or behind them, Supports in the middle and
    Cannons at the back — <b>Line up by role</b> above your party does exactly that. Trainers and gym
    leaders line up the same way.</p>

    <h4>Battles</h4>
    <p>There are no turns to take in order. Every pokémon acts on its own clock, and <b>speed sets the
    clock</b>: a pokémon twice as fast as another acts twice as often. Your back rank attacks just as
    often as your front one, it just can't be reached.</p>
    <p>The <b>Next</b> strip under the battlefield shows who moves next, and next after that — blue is
    yours, red is theirs. Three of their sprites in a row means three of their attacks land before you
    swing.</p>
    <p>You can read the same thing before the fight. The <b>Order</b> strip under your party shows the
    order your own pokémon will act in, so a Pikachu appearing three times before a Snorlax appears once
    is what "three times the rate" actually looks like. Each pokémon's summary card names its pace, and
    the Daycare tells you where a new one would slot into your team before you buy it.</p>

    <h4>What the three stats do</h4>
    <p class="legend" style="flex-direction:column;align-items:flex-start;gap:4px">
      <span><b style="color:var(--hp)">${SI('h')} HP</b> — how long you stay in the fight.</span>
      <span><b style="color:var(--atk)">${SI('a')} Attack</b> — how much each action is worth.</span>
      <span><b style="color:var(--spd)">${SI('s')} Speed</b> — <b>how often you act</b>.</span></p>
    <p>There is no threshold and no ceiling: every point of speed is more actions, at every value. A slow
    pokémon isn't merely last any more — it genuinely swings less often, so leaving speed alone is a real
    cost rather than a free saving.</p>
    <p>All three stats are worth about the same per point, so a bigger number is a better number whichever
    row it's on, and you can compare two pokémon by adding them up. Spreading your investment beats
    stacking one stat — a pokémon that acts constantly and hits for nothing loses to a balanced one.</p>

    <h4>Types</h4>
    <p>Every pokémon has one type, its main Gen 1 type (a Normal/Flying pokémon counts as Flying). A type
    is <b>weak</b> to some types (×2 damage taken) and <b>resists</b> others (×½), like in the games without
    Dark, Steel and Fairy. Where the games make a type immune, this game just resists (×½), so an attack never does
    nothing.</p>
    ${typeRingHtml()}

    <h4>Levelling and evolution</h4>
    <p>Three copies of the same pokémon make it <b>level 2</b>, six make it <b>level 3</b> — and levelling up
    <b>evolves it</b> along its real line. Charmander → Charmeleon → Charizard. Stone lines like Pikachu wait
    for their stone from the PokéMart instead. Pokémon with nowhere left to evolve take a bigger stat jump, so
    they never fall behind.</p>

    <h4>EXP belongs to you, not to one pokémon</h4>
    <p>Every battle earns <b>+${T.expGainWin.hp} HP, +${T.expGainWin.atk} Attack,
    +${T.expGainWin.spd} Speed</b> on a win — and it goes to <b>you</b>. Your whole party gets it,
    and so does <b>anything you buy from here on</b>: a pokémon in the Daycare already shows the
    stats it will have when it joins you, not the stats it hatched with.</p>
    <p>That is what keeps the shop worth reading all game. A pokémon bought on turn 30 is not a
    hopeless runt three levels behind your veterans — it arrives ready, so you can drop something
    that isn't working, counter-draft a gym leader you just lost to, and take the good roll when
    you see it. The team you finish with does not have to be the team you happened to start with.</p>

    <h4>Money</h4>
    <p>${T.creditsPerTurn}₽ every turn, plus <b>${T.winBonus}₽ for a win</b> or <b>${T.lossBonus}₽ for a loss</b>,
    plus a <b>streak bonus</b> — up to +${T.winStreakBonus[T.winStreakBonus.length-1]}₽ on a win streak and
    +${T.lossStreakBonus[T.lossStreakBonus.length-1]}₽ on a losing one, so a bad patch still funds a comeback.
    Anything you don't spend <b>carries over</b>, up to ${carryCap(G)}₽ — saving up for a big turn is a real play.</p>

    <h4>The shops</h4>
    <p>The <b>Daycare</b> sells pokémon — nothing is held there, so a reroll always clears the board.
    The <b>PokéMart</b> has three sections. <b>Held items</b> go into your Bag and stay on a pokémon until
    you move them. <b>Medicine &amp; stones</b> are spent the moment you use them, and their boosts stack up
    all run — but like the real games, a pokémon can take at most <b>${TUNING.vitaminCap} vitamins of each kind</b>
    (Attack, HP and Speed). The role medicines count toward the one they replace: Calcium is an Attack vitamin, Iron and Zinc are HP vitamins, Energy Root is a Speed vitamin. Its summary shows how many it has had, and of which. The <b>always in stock</b> X items boost <b>your whole party</b> for the next battle —
    +${Math.round(TUNING.xItems.pct*100)}% Attack or Speed each, up to ${TUNING.xItems.perBattle} of each per battle. You can
    <b>Reserve</b> a Mart item to keep it through a reroll, and each shop rerolls separately.</p>

    <h4>Daily Challenge, rules and legendaries</h4>
    <p>The <b>Daily Challenge</b> (title screen) is one run a day that’s the same for everyone, sometimes with a rule of the day, in its own save. A <b>New Run</b> can have rules (Mono-type, Rich &amp; Ruthless) and <b>challenges</b>: One Life, No PC, No Held Items, No Legendaries, Hard Gyms and Tight Budget. Clear a run with a challenge on, or a Mono-type run, and you earn its badge on your Trainer Card. With 3 or more challenges on at once, the badges you earn are gold.
    <b>Legendaries</b> (Zapdos, Articuno, Moltres and Mewtwo in Kanto; Raikou, Entei, Suicune, Lugia and Ho-Oh in Johto) aren’t sold in the Daycare: after the 5th gym one may appear for one turn, and by the 7th gym one always has. Recruit one and it stays on your team for the rest of the run; only the offer expires. The Champion brings one you didn’t recruit. They never level up but start far stronger and grow faster. Made a wrong buy? <b>Undo</b> (above Battle) takes back your last buy, once a turn.
    <b>Formations</b> (Your Party) saves a line-up to snap back to, and every fight ends with a <b>recap</b> of who did what.</p>
    <h4>The Bag and held items</h4>
    <p>The Bag sits under the PC and holds ${bagCap(G)} items. Tap one, then tap any pokémon — in your
    party or in the PC — to hand it over; each can carry <b>one</b>. Tap the badge on its sprite to take it
    back. Swapping is free and unlimited, so an Amulet Coin can ride on a benched pokémon early and a
    Muscle Band can move to whoever is carrying the fight later. Stat items are <b>percentages</b>, so they
    keep up as your pokémon grows. Selling a pokémon hands its item back to the Bag, so the Bag has to have
    room first.</p>
    <p>Items you don't want <b>sell back for half price</b> — from the Bag, or straight off the pokémon
    holding one. That second route matters: with a full Bag you can't take an item off to sell it, and the
    one you want rid of is usually the one in the way.</p>

    <h4>The PC</h4>
    <p>${pcCap(G)} storage slots for pokémon you own but aren't carrying (it starts at ${TUNING.pcSlots}; a badge reward adds more). Buy a spare copy straight into
    the PC and it waits there until you want it — that's how you bank the three or six copies a
    <b>level up</b> needs without giving up a party slot. Tap a stored pokémon, then tap its twin in your
    party, to combine them; a <b>＋</b> on the card means a party member can take it right now.</p>
    <p>Tap a stored pokémon and then any party slot to <b>withdraw</b> it, or to <b>swap</b> it with whoever is
    standing there. Stored pokémon still train, but at <b>half rate</b> — bench something for long enough and
    it will fall behind the six that are fighting.</p>

    <h4>The run</h4>
    <p>Lose a trainer battle and you lose a life, and the run moves on regardless.</p>

    <h4>Your rival</h4>
    <p>Three times a run your rival — <b>Blue</b> in Kanto, <b>Silver</b> in Johto — turns up instead of a trainer — once early, once in the
    middle, once near the end. The next-up box won't warn you. His starter is the type that beats the type
    most of your party is, and he keeps the same team all run, evolving it each time you meet. He's tougher
    than a trainer and easier than a gym. Losing costs a life like any trainer battle; beating him pays
    <b>extra credits next turn</b> and a <b>held item</b>. And if you meet him at the very end… he'll have
    that starter with him.</p>

    <h4>The journey</h4>
    <p><b>${T.battlesPerBadge} trainer battles, then a gym leader</b>, eight times over — then the
    <b>Elite Four</b> and the <b>Champion</b>. ${RUN_LENGTH()} battles in all. A leader's team is themed,
    and you are told the type before you go in.</p>
    <p>A gym is a gate, not a battle you pass through. Lose and you <b>black out</b>: you keep your team and
    your badges, you lose <b>half your credits</b>, and you face the same leader again next turn. Your first
    ${T.freeAttempts} attempts cost only money — from the ${T.freeAttempts + 1}${T.freeAttempts + 1 === 3 ? 'rd' : 'th'}
    a defeat costs a life as well. Losing also earns you a <b>scouting report</b>: the rematch shows you
    exactly what they fielded, so you know what to build.</p>
    <h4>The Elite Four</h4>
    <p>The last five battles — the Elite Four, then the Champion — are one gauntlet. Once you challenge
    the first of them, they come <b>one after another with no shopping in between</b>, and
    <b>damage carries over</b>: a pokémon finishes one fight with the HP it will start the next with, and a
    fainted one sits out the rest.</p>
    <p>Between fights you can still <b>rearrange your formation, move held items, and swap pokémon in from
    your PC</b>. Anything stored there comes in at full health, and a hurt pokémon resting there recovers
    ${Math.round(TUNING.benchRest * 100)}% of its HP for each fight it sits out (a fainted one stays down) —
    so the PC is your bench. A few spare
    pokémon bought on the turn before the Elite Four can be the difference. Lose any of the five and you
    black out back to the first, with everyone healed and the shops open again. The whole gauntlet counts
    as one attempt for lives.</p>
    <h4>Badge rewards</h4>
    <p>Every badge offers <b>three rewards and you keep one</b> for the rest of the run: a bigger PC or
    Bag, extra money every turn, free rerolls, a bigger carry-over, a burst of battle EXP, or a free held
    item. Tap the badge case at the top to see what yours have added up to.</p>
    <p><b>Badges are the clock.</b> Each one deepens the Daycare roster and widens the shops. Turns raise the
    roster too, more slowly — that is what lets a stuck trainer out-grow a wall instead of retrying into it
    forever.</p>
    <div class="btnrow"><button class="btn ghost" data-m="close">Close</button></div>`);
  d.querySelector('[data-m="close"]').onclick = () => d.remove();
  d.querySelector('[data-m="tutorial"]').onclick = () => { d.remove(); openTutorial(); };
}

/** 4.9.0: the types a pokémon also has in the games (its label), beyond the one it plays as. */
const secondTypes = k => String(SPECIES[k].gen1 || '').split('/').map(x => x.trim()).filter(t => t && t !== SPECIES[k].type && TYPES[t]);
/** 4.9.0: who evolves with a given stone / item, for the Pokédex item list. */
const stoneUsers = item => { const out = []; Object.keys(SPECIES).forEach(k => [SPECIES[k].evo, SPECIES[k].evo2].forEach(e => [].concat(e || []).forEach(o => { if(o && o.by === 'stone' && o.stone === item) out.push(`${SPECIES[k].name} → ${SPECIES[o.into].name}`); }))); return out; };
function openDex(){
  // 4.0.0: the dex shows every gen you can play, so read the families with all of them on
  const gensBefore = ACTIVE_GENS.slice(); setActiveGens(GENS_READY);
  // group by evolution line so the dex reads as families
  const seen = new Set();
  const families = [];
  Object.keys(SPECIES).forEach(k => {
    const line = evoFamily(k);   // 1.3.0: every branch, so Eevee's family is all four
    if(seen.has(line[0])) return;
    seen.add(line[0]);
    families.push(line);
  });
  families.sort((a,b) => (SPECIES[a[0]].tier || 7) - (SPECIES[b[0]].tier || 7)
    || SPECIES[a[0]].name.localeCompare(SPECIES[b[0]].name));

  /* 4.1.0: the Pokémon are a grid of tiles; a tap opens that pokémon's card. */
  const seenSet = dexSeen();
  /* 6.5.0 (Sean): real National Pokédex numbers and order (#001 Bulbasaur … #385 Jirachi), with gaps where the game has no pokémon. */
  const allMons = families.flat().sort((a, b) => (NATDEX[a] || 999) - (NATDEX[b] || 999));
  const dexNo = k => String(NATDEX[k] || 0).padStart(3, '0');
  const maxOf = f => Math.max(...Object.keys(SPECIES).map(k => SPECIES[k][f] || 0));
  const MAXS = { hp: maxOf('hp'), atk: maxOf('atk'), spd: maxOf('spd') };
  const viaOf = (k, i) => { const from = i > 0 ? evoStep(k) : null; if(!from) return '';
    return from.by === 'stone' ? `${itemGlyph(from.stone, ITEMS[from.stone].icon)} ${esc(ITEMS[from.stone].name)}`
      : from.stat ? `level up · ${({ atk:'Attack', hp:'HP', spd:'Speed' })[from.stat]} highest` : 'level up'; };
  /* who fields each pokémon: one pass over the bosses, only when a card is first opened */
  let bossUse = null;
  const bossesOf = k => {
    if(!bossUse){ bossUse = {}; EVERY_BOSS.forEach(b => { if(!b.theme) return;
      new Set([...themePool(b), ...(b.bossOnly || [])]).forEach(id => (bossUse[id] = bossUse[id] || []).push(b.name)); }); }
    return [...new Set(bossUse[k] || [])]; };   // 5.12.0: each name once
  const barRow = (label, v, max, cls) => `<div class="cbar"><span>${label}</span><i><u class="${cls}" style="width:${Math.max(4, Math.round(100 * v / max))}%"></u></i><b>${v}</b></div>`;
  /* 5.12.0: the card is a trading card framed in the pokémon's type colour (art, move, stat triangle), with its
     evolution line, matchups and who uses it underneath. A pokémon you haven't seen stays a silhouette. */
  const cardHtml = k => {
    const s = SPECIES[k], fam = evoFamily(k), t = TYPES[s.type], seen = seenSet.has(k), no = dexNo(k);
    if(!seen) return `<div class="dcard ccard unseen" style="--tcol:${typeColor(k)}"><div class="tcin">
      <div class="tctop"><b>???</b><span class="tcno">#${no}</span></div>
      <div class="tcwin">${spriteHtml(k, 'lg')}</div>
      <p class="tchint">Not seen yet. Meet it in a run (in the Daycare, or on a trainer’s team) to fill in its entry.</p></div></div>`;
    const chain = fam.map((m, i) => `${i ? `<span class="carrow" title="${viaOf(m, i)}">›<small>${viaOf(m, i)}</small></span>` : ''}<button class="cevo ${m === k ? 'me' : ''} ${seenSet.has(m) ? '' : 'unseen'}" data-jump="${m}">${spriteHtml(m, 'sm')}<span>${seenSet.has(m) ? esc(SPECIES[m].name) : '???'}</span></button>`).join('');
    const sold = s.legendary ? 'Encounter only' : [inGens(k, [1]) ? 'Gen 1 runs' : '', inGens(k, [2]) ? 'Gen 2 runs' : ''].filter(Boolean).join(' · ') || 'Bosses only';
    const bs = bossesOf(k);
    const keep = TRI_SCALE; TRI_SCALE = { atk: MAXS.atk * 1.02, hp: MAXS.hp * 1.02, spd: MAXS.spd * 1.02 };   // measured against the whole Pokédex
    const tri = statTri(s.atk, s.hp, s.spd); TRI_SCALE = keep;
    return `<div class="dcard ccard" style="--tcol:${typeColor(k)}"><div class="tcin">
      <div class="tctop"><b>${esc(s.name)}</b><span class="tchp ch">${SI('h')} ${s.hp}</span></div>
      <div class="tcwin">${spriteHtml(k, 'lg')}<span class="tcno">#${no}</span></div>
      <div class="chead"><span class="tag" style="background:${TYPES[s.type].color};color:#10131a">${esc(s.type)}</span>${secondTypes(k).map(t => ` <span class="tag t2" title="Also ${esc(t)} — counts for Mono ${esc(t)} runs" style="border:2px solid ${TYPES[t].color};color:${TYPES[t].color};background:transparent">${esc(t)}</span>`).join('')} ${roleChip(k)}${subroleTag(k)}${s.legendary ? ' <i class="rar r-veryrare">Legendary</i>' : ''}${genOf(k) > 1 ? ` <span class="tag gentag">Gen ${genOf(k)}</span>` : ''}${SIG[k] ? ' <span class="tag sigtag">✦ Signature move</span>' : ''}</div>
      <div class="cmoves"><div class="abil"><b>${esc(s.move.name)}</b> <i class="trig">Main move</i><span>${esc(s.move.text(1))}</span></div>
        ${s.move2 ? `<div class="abil"><b>${esc(s.move2.name)}</b> <i class="trig">${esc(s.move2.when())}</i><span>${esc(s.move2.text(1))}</span></div>` : ''}</div>
      <div class="tcfoot">${tri}<div class="tcnums"><span class="ca">${SI('a')} ${s.atk}</span><span class="ch">${SI('h')} ${s.hp}</span><span class="cs">${SI('s')} ${s.spd}</span></div>
        <div class="tctier">${s.legendary ? '★ Legendary' : '★'.repeat(Math.min(5, s.tier || 1)) + ` Tier ${s.tier}`}<small>${esc(sold)}</small></div></div>
    </div></div>
    <div class="tcmore">
      ${fam.length > 1 ? `<h4>Evolution</h4><div class="cchain">${chain}</div>` : ''}
      <h4>Matchups</h4><div class="cmu">${t.weak.length ? `<span class="mu bad">weak to ${t.weak.join(', ')} ×2</span>` : ''}${t.resist.length ? `<span class="mu good">resists ${t.resist.join(', ')} ×½</span>` : ''}</div>
      ${bs.length ? `<h4>Trainers who use it</h4><div class="dim">${bs.slice(0, 6).map(esc).join(' · ')}${bs.length > 6 ? ` · +${bs.length - 6} more` : ''}</div>` : ''}
    </div>`; };
  /* 4.1.1: a card is built when you tap its tile, not for all 186 up front (that made the Pokédex take seconds to open on a phone) */
  const cards = {};
  const cardFor = k => { if(!cards[k]){ const before = ACTIVE_GENS.slice(); setActiveGens(GENS_READY); try{ cards[k] = cardHtml(k); } finally { setActiveGens(before); if(G) useGens(G); } } return cards[k]; };
  /* 5.12.0: one numbered grid (National Pokédex order), coloured by type; unseen ones are silhouettes */
  const tileHtml = k => { const s = SPECIES[k], seen = seenSet.has(k);
    return `<button class="dextile ${seen ? 'seen' : 'unseen'}" data-id="${k}" data-name="${esc(s.name.toLowerCase())}" data-type="${esc(s.type)} ${secondTypes(k).map(esc).join(' ')}" ${dexGenAttr(k)} style="--tcol:${typeColor(k)}" aria-label="${seen ? esc(s.name) : 'Not seen yet'}">
      <span class="dno">${dexNo(k)}</span>${spriteHtml(k, 'tile')}<b>${seen ? esc(s.name) : '???'}</b>${s.legendary && seen ? '<i class="dleg">★</i>' : ''}<i class="dband"></i></button>`; };
  const rows = `<div class="dexgrid">${allMons.map(tileHtml).join('')}</div>`;
  const dexTypes = Object.keys(TYPES).filter(t => allMons.some(k => SPECIES[k].type === t));
  const typeChips = `<div class="dextypes"><button class="dty on" data-ty="">All types</button>${dexTypes.map(t => `<button class="dty" data-ty="${esc(t)}" style="--c:${TYPES[t].color}"><i></i>${esc(t)}</button>`).join('')}</div>`;
  const seenCount = allMons.filter(k => seenSet.has(k)).length;
  setActiveGens(gensBefore); if(G) useGens(G);

  const items = Object.keys(ITEMS).map(k => { const it = ITEMS[k];
    const g2only = ['sunstone', 'kingsrock', 'metalcoat'].includes(k);   // 4.0.0: only useful with Gen 2 on
    return `<div class="dexrow" data-g1="${g2only ? 0 : 1}" data-g2="1">${itemSpriteHtml(k, it.icon, 'sm')}
      <div><b>${esc(it.name)}</b>${rarityTag(it)} <span class="dim">${it.cost}₽ · tier ${it.tier} · permanent</span>
      <div class="abil">${esc(it.text)}</div>${stoneUsers(k).length ? `<div class="dim evof">Evolves: ${stoneUsers(k).map(esc).join(' · ')}</div>` : ''}</div></div>`; }).join('');

  // held items, grouped so the three flavours read as three groups
  const KINDS = [
    ['stat',    'Stat', 'A bonus for as long as it is held.'],
    ['trigger', 'Trigger', 'Fires during the battle.'],
    ['economy', 'Economy', 'Pays off between rounds.'],
  ];
  const held = KINDS.map(([kind, label, blurb]) => {
    const rows = Object.keys(HELD_ITEMS).filter(k => HELD_ITEMS[k].kind === kind).map(k => {
      const it = HELD_ITEMS[k];
      return `<div class="dexrow">${itemSpriteHtml(k, it.icon, 'sm')}
        <div><b>${esc(it.name)}</b>${rarityTag(it)} <span class="dim">${it.cost}₽ · tier ${it.tier}</span>
        <div class="abil">${esc(it.text)}</div></div></div>`;
    }).join('');
    return rows ? `<div class="dexkind"><b class="hkind ${kind}">${label}</b>
      <span class="dim">${esc(blurb)}</span></div>${rows}` : '';
  }).join('');

  const bitems = BATTLE_ITEMS.map(it =>
    `<div class="dexrow">${itemSpriteHtml(it.id, it.icon, 'sm')}
      <div><b>${esc(it.name)}</b> <span class="dim">${it.cost}₽ · always stocked · whole party · next battle only</span>
      <div class="abil">${esc(it.text(G ? G.turn : 1))}</div></div></div>`).join('');

  const leaderRow = (b, kind) => `<div class="dexrow">
    ${bossArt(b, 'dex') || `<span class="lbadge ${kind}"></span>`}
    <div><b>${esc(b.name)}</b>
      <span class="tag">${esc(b.title)}</span>
      ${b.theme ? b.theme.map(t => `<span class="ntype">${esc(t)}</span>`).join(' ') : '<span class="ntype">no theme</span>'}
      ${b.badge ? `<span class="dim">${esc(b.badge)} Badge</span>` : ''}
      <div class="abil">${esc(b.blurb)}</div></div></div>`;
  /* 4.3.0: secret bosses stay a silhouette until you have met them */
  const MET = records().met || {};
  const secretRow = id => { const b = SECRETS[id], met = !!MET[id], won = !!secretRec(id);
    return `<div class="dexrow secret${met ? '' : ' unmet'}" data-g${b.gen}="1">
    ${met ? (bossArt(b, 'dex') || '<span class="lbadge champion"></span>') : (bossArt(b, 'dex silhouette') || '<span class="lbadge"></span>')}
    <div><b>${met ? esc(b.name) : '???'}</b> <span class="tag">${met ? esc(b.title) : 'Secret'}</span>
      ${met ? `<span class="dim">${esc(b.place)} \u00b7 ${esc(GENS[b.gen].name)}</span> ${won ? `<span class="dim">\u2714 ${esc(b.name)}\u2019s Badge earned</span>` : '<span class="dim">badge not earned</span>'}`
            : `<span class="dim">${esc(GENS[b.gen].name)}</span>`}
      <div class="abil">${met ? esc(b.blurb) : `Turns up after the Champion in about one ${esc(GENS[b.gen].name)} run in six. Meet him to fill this in.`}</div>
      ${met ? `<div class="secteam">${b.lineup.map(m => miniSprite(m.id)).join('')}</div>` : ''}</div></div>`; };
  const secrets = ['red', 'oak', 'steven'].filter(id => GENS_READY.includes(SECRETS[id].gen)).map(secretRow).join('');
  /* 4.0.0: one block per gen that can be played */
  const leaders = GENS_READY.map(n => { const g = GEN_BOSSES[n];
    return `<div class="dexgen" data-g${n}="1">` + (GENS_READY.length > 1 ? `<h4 class="genhead">${esc(GENS[n].name)} · ${esc(GENS[n].region)}</h4>` : '')
      + g.gyms.map(b => leaderRow(b, 'gym')).join('')
      + g.elite.map(b => leaderRow(b, 'elite')).join('')
      + leaderRow(g.champion, 'champion')
      + leaderRow(g.rival, 'rival') + '</div>'; }).join('');

  /* 4.0.0 (Sean): filters — what to show (Pokémon, Trainers, Items) and, with more
     than one gen to play, which gen. Remembered between visits. */
  const SECS = [['all','All'], ['mon','Pokémon'], ['gym','Trainers'], ['items','Items']];
  const GENF = [['all','All gens'], ...GENS_READY.map(n => [String(n), GENS[n].name])];
  let sec = PREF.get('dexsec', 'all'), gen = PREF.get('dexgen', 'all');
  if(!SECS.some(x => x[0] === sec)) sec = 'all';
  if(!GENF.some(x => x[0] === gen)) gen = 'all';
  const jump = `<div class="dexjump dexfilt">
    <div class="dexseg" data-f="sec">${SECS.map(([id, label]) => `<button class="sp" data-v="${id}">${label}</button>`).join('')}</div>
    ${GENS_READY.length > 1 ? `<div class="dexseg" data-f="gen">${GENF.map(([id, label]) => `<button class="sp" data-v="${id}">${esc(label)}</button>`).join('')}</div>` : ''}
  </div>`;

  const d = modal(`<div class="dextop"><h3>Pokédex <span class="dim dexcount">${seenCount} / ${allMons.length} seen</span><button class="dexx" data-m="close" aria-label="Close">✕</button></h3>
    <div class="dexprog"><u style="width:${(100 * seenCount / Math.max(1, allMons.length)).toFixed(1)}%"></u></div>${jump}</div>
    <section data-sec="mon"><h3 class="dexh" id="dex-mon">Pokémon <span class="dim">— tap one for its card</span></h3>
      <input class="dexsearch" type="search" placeholder="Search by name…" aria-label="Search pokémon" autocomplete="off">${typeChips}${rows}</section>
    <section data-sec="gym"><h3 class="dexh" id="dex-gym">Trainers <span class="dim">— gym leaders, the Elite Four, Champions and rivals</span></h3>
    <div>${leaders}</div>
    <h3 class="dexh" id="dex-secret">Secret bosses <span class="dim">\u2014 found after a Champion</span></h3><div>${secrets}</div></section>
    <section data-sec="items"><h3 class="dexh" id="dex-held">Held items <span class="dim">— one each, swap any time</span></h3>
    <div>${held}</div>
    <h3 class="dexh" id="dex-mart">PokéMart <span class="dim">— used right away</span></h3><div>${items}</div>
    <h3 class="dexh" id="dex-ctr">Battle counter <span class="dim">— next battle only</span></h3><div>${bitems}</div></section>
    <p class="dim dexnone" hidden>Nothing here for that generation.</p>
    <div class="btnrow"><button class="btn ghost" data-m="close">Close</button></div>`);
  d.classList.add('dex', 'dexfull');
  d.querySelectorAll('[data-m="close"]').forEach(x => x.onclick = () => d.remove());
  let ty = '';
  d.querySelectorAll('.dty').forEach(b => b.onclick = () => { SFX.play('tap'); ty = b.dataset.ty; d.querySelectorAll('.dty').forEach(x => x.classList.toggle('on', x === b)); apply(); });
  const apply = () => {
    d.querySelectorAll('.dexseg[data-f="sec"] .sp').forEach(b => b.classList.toggle('on', b.dataset.v === sec));
    d.querySelectorAll('.dexseg[data-f="gen"] .sp').forEach(b => b.classList.toggle('on', b.dataset.v === gen));
    d.querySelectorAll('section[data-sec]').forEach(x => x.hidden = sec !== 'all' && x.dataset.sec !== sec);
    const okGen = el => gen === 'all' || el.getAttribute('data-g' + gen) !== '0' && (el.hasAttribute('data-g' + gen) || !el.matches('.dexgen'));
    d.querySelectorAll('[data-g1],[data-g2]').forEach(el => el.hidden = !okGen(el));
    const q = (d.querySelector('.dexsearch').value || '').trim().toLowerCase();
    d.querySelectorAll('.dextile').forEach(t => { if((q && !t.dataset.name.includes(q)) || (ty && !t.dataset.type.split(' ').includes(ty))) t.hidden = true; });
    d.querySelectorAll('.dexgen').forEach(g => g.hidden = gen !== 'all' && !g.hasAttribute('data-g' + gen));
    const shown = [...d.querySelectorAll('section[data-sec]')].filter(x => !x.hidden);
    d.querySelector('.dexnone').hidden = shown.some(x => [...x.querySelectorAll('.dexrow,.dextile')].some(r => !r.hidden && !r.closest('[hidden]')));
  };
  d.querySelectorAll('.dexseg .sp').forEach(b => b.onclick = () => {
    SFX.play('tap');
    if(b.closest('.dexseg').dataset.f === 'sec'){ sec = b.dataset.v; PREF.set('dexsec', sec); }
    else { gen = b.dataset.v; PREF.set('dexgen', gen); }
    apply(); d.scrollTop = 0; const box = d.querySelector('.box') || d; box.scrollTop = 0;
  });
  const showCard = k => {
    SFX.play('tap');
    const c = modal(cardFor(k)); c.classList.add('dexcardm');
    if(!motionOff()){ const card = c.querySelector('.ccard'); if(card) anim(card, [{ transform: 'perspective(600px) rotateY(-70deg) scale(.85)', opacity: 0 }, { transform: 'perspective(600px) rotateY(8deg) scale(1.02)', opacity: 1, offset: .7 }, { transform: 'none', opacity: 1 }], { duration: 420, easing: 'ease-out' }); }
    c.querySelector('.boxscroll').insertAdjacentHTML('beforeend', '<div class="btnrow"><button class="btn ghost" data-m="x">Back</button></div>');
    c.querySelector('[data-m="x"]').onclick = () => c.remove();
    c.querySelectorAll('[data-jump]').forEach(b => b.onclick = () => { if(b.dataset.jump !== k){ c.remove(); showCard(b.dataset.jump); } });
  };
  d.querySelectorAll('.dextile').forEach(t => t.onclick = () => showCard(t.dataset.id));
  d.querySelector('.dexsearch').addEventListener('input', apply);
  apply();
}
/** 4.0.0: which gens can meet this pokémon, for the dex filter (Gen 2 is the Johto Pokédex). */
const dexGenAttr = k => GENS_READY.map(n => `data-g${n}="${inGens(k, [n]) ? 1 : 0}"`).join(' ');

/* ===================================================================
   TITLE SCREEN (v38)
   Shown each time the game opens: the logo, your partner pokémon on a little
   field, and PRESS START. With a run in progress START offers CONTINUE /
   NEW RUN / OPTIONS; with nothing to continue it goes straight in. It can be
   turned off in Options. Browser test runs (navigator.webdriver) skip it so
   the older suites load straight into the shop; titletest.js sets
   window.PKB_TITLE to see it.
   =================================================================== */
const TITLE_STARTERS = ['bulbasaur', 'charmander', 'squirtle', 'pikachu'];
const titleWanted = () => PREF.get('title', 'on') !== 'off' && (!navigator.webdriver || window.PKB_TITLE);
const runInProgress = () => !!(G && !G.over && phase !== 'over' && ((G.stage || 0) > 0 || G.turn > 1));
function titlePartner(){
  if(runInProgress()){ const P = partnerOf(); if(P && SPRITES[P.u.id]) return P.u.id; }
  const saved = PREF.get('partner', '');
  if(saved && SPRITES[saved]) return saved;
  return TITLE_STARTERS[Math.floor(Math.random() * TITLE_STARTERS.length)];
}
let titleEl = null;
function showTitle(then){
  if(titleEl) return;
  const mon = titlePartner(), R = records(), best = Math.max(R.best, 0), HC0 = R.hardcore && R.hardcore.count ? R.hardcore : null;
  const M = mainRun();                                   // 2.0.0: CONTINUE is always your own run
  const cont = !!(M && !M.over && ((M.stage || 0) > 0 || M.turn > 1));
  const runLine = cont ? `Turn ${M.turn} · ${M.badges} badge${M.badges === 1 ? '' : 's'} · ${Math.max(0, M.lives)} ${M.lives === 1 ? 'life' : 'lives'}${modList(M).length ? ' · ' + esc(modsLabel(M)) : ''}` : '';
  const dres = dailyResults()[localDate()];
  /* 4.1.0: two more pokémon share the field — your party when a run is on, otherwise any two */
  const flank = (() => {
    const mine = runInProgress() ? [...G.team, ...G.pc].map(u => u.id).filter(k => k !== mon && SPRITES[k]) : [];
    const any = Object.keys(SPECIES).filter(k => k !== mon && SPRITES[k] && !SPECIES[k].legendary && (SPECIES[k].tier || 9) <= 3);
    const out = [];
    for(const k of [...mine.sort(() => Math.random() - .5), ...any.sort(() => Math.random() - .5)]){ if(!out.includes(k)) out.push(k); if(out.length === 2) break; }
    return out;
  })();
  const dexTotal = Object.keys(SPECIES).length, dexHave = Math.min(dexTotal, dexSeen().size);
  const who = PREF.get('name', '') ? `Welcome back, ${esc(playerName())}!` : 'Ready to battle, Trainer?';
  const d = document.createElement('div');
  d.id = 'title'; d.className = 'title' + (motionOff() ? ' still' : '');
  d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', 'PokéArena title screen');
  d.innerHTML = `<div class="tscreen">
    <h1 class="tlogo" aria-label="PokéArena"><span class="t1">Poké<i class="pball"></i></span><span class="t2">Arena</span></h1>
    <div class="tsub">A Pokémon Auto Battler</div>
    <div class="tver">${GAME_VERSION.v}</div>
    <div class="tfield"><i class="tcloud c1"></i><i class="tcloud c2"></i><i class="tcloud c3"></i>
      ${flank.map((k, n) => `<div class="tside ${n ? 'r' : 'l'}"><img src="${SPRITES[k]}" alt=""></div>`).join('')}
      <div class="tmon"><img src="${SPRITES[mon]}" alt="${esc(SPECIES[mon] ? SPECIES[mon].name : '')}"></div></div>
    <div class="twho">${titleBadgesHtml()}${who}</div>
    <button class="tpress" data-t="start">Tap to play</button>
    <div class="tmenu" hidden role="menu">
      ${cont ? `<button class="tmi cur" role="menuitem" data-t="continue">Continue<small>${runLine}</small></button>` : ''}
      <button class="tmi ${cont ? '' : 'cur'}" role="menuitem" data-t="new">New run<small>with rules, if you like</small></button>
      <button class="tmi" role="menuitem" data-t="daily">Daily challenge<small>${dres ? `today: ${esc(dres.cleared ? 'Champion!' : bestRunLabel(dres.best))}${dres.hardcore ? ' · Hardcore' : ''}` : esc(prettyDate(localDate()))}</small></button>
      <button class="tmi" role="menuitem" data-t="duels">Duels<small>battle a friend with saved pokémon, by code</small></button>
      <button class="tmi" role="menuitem" data-t="dex">Pokédex<small>${dexHave} / ${dexTotal} seen · cards, trainers, items</small></button>
      <button class="tmi" role="menuitem" data-t="trainer">Trainer card<small>${sbEarned().length ? `${sbEarned().length} special badge${sbEarned().length === 1 ? '' : 's'} · records` : 'your badges and records'}</small></button>
      <button class="tmi" role="menuitem" data-t="options">Options</button>
    </div>
    <div class="tfoot">${best > 0 ? `<span>Best: ${esc(bestRunLabel(best))}${R.cleared ? ` · ${R.cleared} cleared` : ''}</span>` : ''}
      </div>
  </div>`;
  document.body.appendChild(d);
  titleEl = d;
  document.body.classList.add('titled');
  const menu = d.querySelector('.tmenu'), press = d.querySelector('.tpress');
  const items = () => [...d.querySelectorAll('.tmi')];
  const leave = () => {
    if(!titleEl) return;
    titleEl = null; document.removeEventListener('keydown', onKey, true);
    /* 5.4.0: the title fades into the stadium (the pokéball wipe was the Game Boy style) */
    const done = () => { d.remove(); document.body.classList.remove('titled'); if(then) then(); };
    if(motionOff() || !wipeWanted()){ done(); return; }
    SFX.play('wipeOut', true);
    d.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(1.06)' }], { duration: 420, easing: 'ease-in', fill: 'forwards' }).finished.then(done, done);
  };
  const act = t => {
    SFX.play(t === 'start' ? 'start' : t === 'new-no' ? 'back' : 'select');
    if(t === 'start'){
      d.querySelector('.tmon').classList.add('hop');
      press.hidden = true; menu.hidden = false; (d.querySelector('.tmi.cur') || items()[0]).focus();
    } else if(t === 'continue'){ if(G && G.daily) switchSlot(SAVE_KEY); leave(); }
    else if(t === 'new'){ if(document.activeElement) document.activeElement.blur(); openNewRun(leave); }
    else if(t === 'daily'){ if(document.activeElement) document.activeElement.blur(); openDaily(leave); }
    else if(t === 'duels'){ if(document.activeElement) document.activeElement.blur(); openDuels(); }
    else if(t === 'dex'){ if(document.activeElement) document.activeElement.blur(); openDex(); }
    else if(t === 'trainer'){ if(document.activeElement) document.activeElement.blur(); openTrainerCard(true); }
    else if(t === 'options'){ if(document.activeElement) document.activeElement.blur(); openOptions(); }
  };
  d.addEventListener('click', ev => {
    if(document.querySelector('.modal')) return;   // Options is open on top
    const b = ev.target.closest('[data-t]');
    if(b) return act(b.dataset.t);
    if(!press.hidden) act('start');             // a tap anywhere is START
  });
  const onKey = e => {
    if(!titleEl || document.querySelector('.modal')) return;
    if(!press.hidden){ if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); e.stopPropagation(); act('start'); } return; }
    const list = items().filter(b => !b.disabled);
    if(!list.length) return;
    let k = list.indexOf(d.querySelector('.tmi.cur'));
    if(e.key === 'ArrowDown' || e.key === 'ArrowUp'){
      e.preventDefault(); k = (k + (e.key === 'ArrowDown' ? 1 : list.length - 1)) % list.length;
      SFX.play('move'); list.forEach((b, j) => b.classList.toggle('cur', j === k)); list[k].focus();
    } else if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); e.stopPropagation(); act((list[k] || list[0]).dataset.t); }
    else if(e.key === 'Escape'){ e.stopPropagation(); }
  };
  // move, not over: a menu opening under a mouse that isn't moving keeps its cursor where it is
  d.addEventListener('pointermove', e => { const b = e.target.closest('.tmi'); if(b && !b.disabled && !b.classList.contains('cur')){ SFX.play('move'); items().forEach(x => x.classList.toggle('cur', x === b)); } });
  document.addEventListener('keydown', onKey, true);
}

/*@DUELUI@*/

/* ===================================================================
   BOOT
   =================================================================== */
function newRun(opts){
  G = newGame(undefined, opts);
  rollShop(G, false);
  phase = 'shop'; sel = null; inspect = null; battle = null;
  save();
}
const afterTitle = () => { if(phase === 'shop' && pendingOffer(G)) openRewardPicker(); else maybeTutorial(); };   // a reward left unchosen

(function boot(){
  applyMotion();
  // 2.0.0: come back to whichever run you were last in — your own or the daily
  const saved = (PREF.get('slot', 'main') === 'daily' && load(DAILY_KEY)) || load(SAVE_KEY);
  if(saved){ G = saved.G; phase = saved.phase === 'over' ? 'over' : 'shop'; }
  else newRun();
  if(!G.daycare || !G.daycare.length) rollShop(G, false);
  render();
  if(titleWanted()) showTitle(afterTitle); else afterTitle();
})();
