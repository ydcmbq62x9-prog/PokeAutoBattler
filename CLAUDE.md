# PokéArena — brief for Claude Code

You are taking over a hobby project that was built over many sessions with Claude in the Claude desktop app (Cowork).
This file is the hand-off. Read it fully before touching anything; `DEV.md` has the short command cheat-sheet.

## 1. What this is

**PokéArena** (formerly PokéBattler) is a Pokémon **auto battler** for the owner (Sean) and his friends, played on phones and in
a browser. A run is a ~30-minute journey: shop between fights (Daycare, PokéMart, PC, Bag), line up six pokémon in a
three-rank formation, press Battle, and the fight plays out automatically. Eight gym leaders, then the Elite Four and the
Champion. It ships as **one self-contained HTML file** (no dependencies, no server) plus a home-screen web app
(manifest + service worker + icons) that Sean hosts on GitHub Pages.

- Gens in the game: Gen 1 (Kanto), Gen 2 (Johto), Gen 3 (Hoenn), toggled per run on New Run. ~297 species (incl. legendaries).
- Sean is a hobbyist, not a developer. He is learning to code. Explain what you changed in plain words, keep answers short,
  and ask before any large change.
- The game is for friends: honest balance and fun matter more than exotic engineering.

## 2. Standing rules from Sean (obey these)

1. **Version numbers `x.y.z`**: first digit = big mechanical update, second = patches and additions/removals, third = very minor
   visual/text fixes. If unsure which digit to bump, ask him.
2. **Every changelog entry** (`CHANGELOG` in `ui.js`) has a `title` that is exactly one of: `Visual bug fixes`,
   `Minor gameplay changes`, `Balance patch`, `Major gameplay update`, plus a one-line `sub` summary. Use
   `python3 bump.py X.Y.Z "Title" "sub" "bullet" ...` — it edits `GAME_VERSION` and the changelog together, and `build.py`
   refuses to build if they disagree.
3. **Push to GitHub only when Sean says "push it".** The claude.ai artifact gets every update immediately; the GitHub Pages
   copy (the installed home-screen app) is updated only on request. (The previous sessions had no write access to the repo, so
   Sean uploaded `index.html`, `sw.js`, `manifest.webmanifest`, `icons/` himself. With Claude Code you may be able to push
   directly — still only when told.)
4. **"Iron out"** = a pass of small visual clean-ups, done **only** when he says the words. Otherwise leave small cosmetic nits.
5. **Always offer ideas** for how the task or the project could progress next.
6. **A move name means the same effect on every pokémon that has it** (only the percentages may differ for balance). If a move
   must change effect, rename it. `movenames.js` enforces this.
7. **Balance changes appear on the Balance Sheet for that update only** (not carried into later updates).
8. Don't write words in ALL CAPS in the game's lettering (menus, title, etc.). Don't call things "Game Boy" — that look was retired.
9. No need to send tester checklists or design docs with each update.
10. Keep the **multiplayer (Duels) work separate from the main game for now** (own branch, own preview). Sean wants it merged only
    when he decides.
11. Gen packs are added on their own branch first, then merged once Sean is happy (this is how Gen 2 and Gen 3 landed).
12. Don't hint/telegraph secret bosses (the 1-in-6 chance is pure luck by design).

## 3. Repository and branches

Tracked files (all at the repo root): `engine.js` (rules), `ui.js` (screens, `GAME_VERSION`, `CHANGELOG`), `shell.html` (CSS + page
template), `sprites.js` (generated base64 art — checked in, don't regenerate casually), `arena.js`/`arena.css` (battle stage),
`build.py`, `bump.py`, `quick.sh`/`runtests.sh`/`run1.sh`/`release.sh`, ~86 `*test.js` files plus ~130 measuring/one-off scripts,
`app/` (icon scripts, README/sw templates, icons), `extra-sprites/`, `DEV.md`, this file. `_scratch/` is git-ignored.

Branches (the repo bundle in this hand-off contains all of them):

| branch | version | what it is |
|---|---|---|
| `merge610` | 6.12.0 | **The main game line.** Gens 1+2+3, roles/subroles, items, economy, dev tooling. Start here. |
| `multiplayer` | 6.15.0 | `merge610` + Duels (friend-code sets, power budget, live link with 4-letter code). Separate preview, not merged. |
| `gen2` | 5.12.2 | older line, kept for history |
| `main` | 4.1.0 | very old; matches what was on GitHub Pages at some point |

`origin` is https://github.com/ydcmbq62x9-prog/PokeAutoBattler (the GitHub Pages repo that serves the installed app).
It holds only the built app files (index.html, sw.js, manifest, icons), not this source.

## 4. Building and testing on your own machine

The build and tests were written for a cloud sandbox that used `/mnt/user-data/outputs`. **Set `PKB_OUT` to any folder** and everything
uses it (`build.py`, all tests via `pkbpaths.js`):

```
export PKB_OUT=$HOME/pokearena-out        # PowerShell: $env:PKB_OUT="C:\Users\you\pokearena-out"
npm i playwright && npx playwright install chromium   # browser tests only; engine tests need just node
python3 build.py                          # writes $PKB_OUT/pokebattler.html, $PKB_OUT/gen2/pokebattler.html (+ -app/, -app.zip)
./quick.sh                                # ~25-60 s, engine-only tests, no browser: run after EVERY edit
./release.sh                              # build + quick + phone-layout pass (phonepass.js must report 0 findings)
./release.sh full                         # + the whole suite (~9 min; the browser tests are heavy)
```

- Browser tests load `$PKB_OUT/gen2/pokebattler.html` (title "PokéArena Gen 2 Preview"); `$PKB_OUT/pokebattler.html` is the
  artifact copy (title "PokéArena"). `build.py` writes both from the repo files only — never publish a copy it didn't just write.
- Some scripts hard-code Chromium at `/opt/pw-browsers/chromium`; on your machine change that to Playwright's default
  (remove the `executablePath`) or set it to your Chrome. A few older one-off scripts may still assume the sandbox; the
  tests in `quick.sh`/`runtests.sh` are the maintained ones.
- `run1.sh` retries a failing test once: pass-on-retry is reported **FLAKY** (timing, usually a browser test under parallel load),
  fail-twice is **FAIL**. `// @slow` on line 1 of a test = statistical balance check, skipped by `quick.sh`.
- Reports with no assertions are named `*report.js` so the suite doesn't run them. Don't hard-code balance numbers in tests; read
  them from `E.HELD_ITEMS` / `E.TUNING`.
- Dev scripts need Node 20+ and Python 3. `gen-sprites.py` rebuilds `sprites.js` from Sean's local Sprites folder (not in this
  bundle); you normally never run it — the generated `sprites.js` is committed.

## 5. Architecture (what to know before editing)

- **Engine/UI split.** `engine.js` is pure logic with a guarded `module.exports` (so Node tests and bots import it). `ui.js` is the
  browser layer. `build.py` concatenates `engine + ui(+sprites)` into `shell.html`'s script tag. The bot/sim scripts import `engine.js`
  directly and run the real battle simulator.
- **Battle simulator**: `simulateBattle`, `generateAiTeam`, `B.*` helpers. Deterministic given a seed: the replay depends on it.
  Shops are also seeded (`shopRng(G)`), so a seed + same choices = same shelves (this is also what makes Duels work).
- **State** `G` (top-level `let`, as is `battle`; use `typeof G` in Playwright). Saves are versioned/migrated in `load()`.
- **Design for "edit once"**: vitamins are `boost:{…}` on the item in `ITEMS` (tap effect and card text are generated from it);
  held items carry `pct`, `cutPct`, `income`, … plus `text` (re-check the text matches); rarity weights in `TUNING.rarity`; caps in
  `TUNING.eggCap`, `TUNING.vitaminCap`, `TUNING.manual`; Mart shelf width `TUNING.martSlots = [2,3,3,4,4,5]` by tier.
- **Ids stay stable even when names change** (Expert Belt is id `char`, formerly Charcoal) so saves survive renames.
- **Redraws**: shop→shop redraws go through `morphInto` (patches the DOM, keeps sprites/animations). Effects use `replay(el, cls)`.
- **Art**: pixel sprites from Sean's PC are base64 in `sprites.js`; `extra-sprites/` is fallback art. `bossArt()` draws trainers.
  Missing art falls back to a two-letter placeholder; `spritetest.js` has an `AWAITING_ART` list.
- **Look**: the "Broadcast" stadium look (TV scoreboard, stands/floodlights that grow with badges, home fields, 3D tabletop
  stadium board in battle). Light/Dark/System themes (`html.dark`). The app is landscape-, phone- and PC-friendly; `phonepass.js`
  audits ~26 screens × 6 viewports for overflow/cut-off text and must stay at **0 findings**.

## 6. Game rules in one page

- **Run**: `3 trainer battles → gym leader` ×8, then Elite Four ×4 + Champion as one gauntlet (damage carries, shops closed, the PC is
  your bench, benched pokémon rest 25%/fight). 37 battles, median ~41 turns (gym retries). Each gen has its own gym leaders/E4/champion;
  with several gens on, bosses are pooled and scaled to the slot they land in. `runPlan()` is a schedule built from TUNING numbers.
- **Stats**: HP / Attack / Speed. Speed = how often you act (action-meter, `intervalFor(spd)=atbQuantum/spd`), not just order.
  Power score `unitPower = hp + atk + spdPower·spd`. Three-rank, two-abreast formation with free placement; attacks hit a random member
  of the enemy's front rank; nobody slides forward when a teammate faints.
- **Roles** (growth split + one trait each): Tank (Bodyguard), Bruiser (Steady), Cannon (Covering Fire), Support (Aftercare).
  A mixed team beats any one-role team. **Subroles** (6.0.0): a few lines blend growth toward a second role (growth only; trait, AI
  lineup and move legality stay on the primary role). Deliberately rare (9 lines/17 species) — do not auto-apply the base-stat
  screen that flagged 172 species; it is noise (see §9).
- **Types**: real Gen 1 typing, one main type per pokémon, modern chart without Dark/Steel/Fairy and no immunities; ring
  Grass→Fire→Water→Lightning→Fighting→Psychic→Grass plus Colorless; dual-type pokémon belong to the Mono pool of each of their types.
- **Economy**: income = carry-over (capped) + base + win/loss + streak + items + rival; trainer-based EXP (a buy arrives at your
  level; catch-up applied when the Daycare rolls); vitamins capped at 10 per kind per pokémon; widened Mart shelf. Badge rewards: three
  offered per badge, keep one (Storage Box, Bag Pocket, Allowance, Lucky Ticket, Piggy Bank, Special Training, Gift Item).
- **Items**: rarity Common/Uncommon/Rare/Very rare (weights 1/.6/.25/.1). Rarer must mean stronger for one slot. Recently re-measured
  (6.8–6.12): role-specific held items (Bulk Plate, Black Belt, Scope Lens, Soothe Bell, …) are Rare; Very rare items were buffed; Exp. Share
  is one round, cost 5 (two rounds made the Champion far too easy); Lucky Egg capped at 12 rounds (`TUNING.eggCap`); Amulet Coin +1₽.
  The Mart **guarantees at least one evolution stone per shelf** (swaps the last open consumable slot for an eligible stone).
  X items: +5% party-wide, 2 uses per battle. Vitamins are intentionally weak; buffing them raises clear rate 6–9 points and needs a
  boss retune.
- **Run rules**: Mono (one type), No PC, Rich, One Life (→ Hardcore Badge); Daily Challenge (own save slot); opt-in challenges earn
  Trainer Card badges. Legendaries are encounter-only (no tier, never level, higher base stats and growth); one guaranteed by badge 7;
  support legendaries Celebi and Mew; the Champion fields one.
- **Secret bosses** (1-in-6 after the Champion, one chance, a named badge, optional Secret Boss Tickets, Gauntlet rule): Red (Gen 2),
  Professor Oak (Gen 1), Steven Stone (Gen 3); `drawSecret` uses the per-gen map `GEN_SECRET`.
- **Rival** (Blue/Silver/May by gen): three ambushes per run, persistent team, priced off *your* team's power, pays ₽ + a held item,
  and the Champion leads with his starter's final form.
- Trainer Card: career stats, run history, badges, unlockable home fields. Pokédex has Pokémon/Leaders/Items/Mart/Battle counter
  sections; Transfer codes (`PKBSAVE-…`) move a run between devices; team codes (`PKB3-…`) share a team.

## 7. Balance method (important)

Everything numeric has been **measured, not guessed**, with scripts that run the real simulator many times:

- Held items: `node bal.js items [N]` — win-rate gain of each item on its best holder against target bands per rarity
  (common 2.5–5, uncommon 4–6.5, rare 5–7.5, very rare 6–8.5 points). `PATCH='{"scope":{"pct":{"atk":0.7}}}' node bal.js items 800`
  tries a number without editing.
- Vitamins: `node bal.js vit`. Economy items (gold, EXP): `node bal.js econ 700 "base inc1 egg share1"` = bot clear rate with a gift.
- Whole-run clear rate: `node bal.js rate 300 [1,2,3]`; per boss: `node rate.js 300 [3] 1`. Reference bot is `botlib.js` (rerolls,
  lines up by role, benches, picks best rewards). Targets Sean chose: reference ~76–82%, casual-with-habits far lower; gen
  combinations and rule-sets each land near 50% (`TUNING.mods.*Foes`, `gensFoes`).
- Rules of thumb found: +1₽/turn ≈ +6 clear-rate points; raising vitamins lifts clear rate 6–9; an Exp. Share doing 2 rounds made Red far too
  easy; reroll gap must stay ≤27 points (`econtest.js`); a number that tracks another number must be computed from it (bar maxima).
- Re-tune order after a growth change: `fitcurve.js` → `powerCurve`, `aiDifficulty` by the same ratio → `tune2.js` per-boss `calib`
  → `ramp.js` global ramp → `tune.js` spread. Gen bosses were calibrated by binary-searching `calib` to match the average win rate of
  existing same-slot bosses.
- Always re-run `./runtests.sh` after anything economic. Verify tests catch a regression by sabotage when you add one.

## 8. Multiplayer: Duels (branch `multiplayer`, 6.15.0)

Built on a branch so the main game stays safe. Everything lives in `engine.js` (DUELS section + `TUNING.duel`) and `duelui.js`
(injected into the build at `/*@DUELUI@*/` in `ui.js`).

Rules (Sean's decisions): a separate **Duel Box** (30 slots) holds frozen snapshots saved from past runs (3 from a winning run, 1 from a
losing run); pokémon never grow in the box. A set is **best of 3** (first to 2; W-L-D/W-D-L = draw), six against six within a **power
budget of 4200** (first guess: median best-six from a winning bot run; re-tune after real play). A fainted pokémon **sits out only the next
game**. Items stay on the pokémon they were saved with; the set's **item pool** is the items on the six brought to game 1, movable
between brought pokémon but never conjured; a pokémon swapped in from the box arrives without an item. **Hidden picks**: lock in
before the opponent's team opens. Nothing carries past the set.

Transport, in order of preference:
1. **Live link (6.14–6.15)**: Host shows a 4-character code; Join types it. A tiny signalling client talks to the **free PeerJS
   matchmaking server** (`0.peerjs.com`, message format: OPEN/ID-TAKEN/OFFER/ANSWER/CANDIDATE) and then the phones talk directly over
   a WebRTC data channel (the server never sees teams). Messages: commit fingerprint → team once both are locked → ready → 3-2-1 →
   both devices run the same deterministic battle. The first OFFER wins the seat; strangers are ignored. **This was never run against
   the real server** (the cloud sandbox couldn't reach it) — only against a local stand-in (`livetest.js` uses a `ws` mock; `npm i ws` to run it). Test it for
   real first: if the PeerJS server's behaviour differs, `liveSignal`/`liveHost`/`liveJoin` in `duelui.js` are the places to look.
2. **Shared room fallback** for the claude.ai preview page, where WebRTC/WebSocket to other hosts are blocked: the artifact `room`
   capability carries the same 4-letter code (`liveRoom`). Needs viewers signed in with access to the artifact. Not used in a normal
   browser or the installed app.
3. **Friend codes** (`PKD1-<checksum>-<base64>`): copy/paste team codes; seed = hash(set id, game, both codes sorted); the lower code
   plays the 'p' side. Works with no network at all. Results are recorded the moment Fight is tapped.

Developer tools: tap the **Duels** heading five times to show "Add maxed / Fill the box / Clear box + set" (also `#dev` in the URL
outside the preview). Tests: `dueltest.js` (rules, in quick), `dueluitest.js` (two browsers play a full set), `livetest.js`,
`roomtest.js`. Known limits: the 'e'-side player sees the fight from the 'p' side's view with the result flipped; lock-in is honour-based
for the code-swap path; saves live in localStorage and can be edited.

## 9. Gotchas learned the hard way

- **Never publish a stale build**: `build.py` writes everything from repo files; there is a version/changelog assert.
- Tests that touch real randomness flake: pin `G.seed`. Wait for UI conditions, don't sleep.
- `arenatest`, `v49test`, `carryfix`, `slotstest` can flake under parallel load and pass alone.
- Don't re-run the "base stats vs role shape" screen and auto-apply it (172/265 species flagged = noise); hand-check cross-stage consistency.
- Boss filter is `!boss` — a new item that bosses may hold must have no `boss` key (`boss:false` would also pass).
- Mid and final evolutions need `token:true` or they appear in the shop as base forms (test.js catches it).
- A stray `//` in a species line once blanked its stats; `slotstest` checks every species has finite stats and a role.
- WAAPI: easing on a multi-keyframe animation warps the whole timeline; put easing on the keyframes.
- A module-level counter doesn't survive reload: `syncUid` lifts it above saved uids. Popups address units by location, not uid.
- Phone layout: check 360×640 (title menu overflow was a real bug), landscape, and tablets with `phonepass.js`.
- Service worker cache name is `pokebattler-<version>`; updating the app = new `index.html` + `sw.js`. Saves are per address.
- Never add a literal `</script>` to the JS (build asserts it).

## 10. Open items and ideas (nothing here is committed to)

- **Real-world test of the live link** (PeerJS server, mobile carriers/symmetric NATs may block direct links — a TURN server would be
  the fix; consider a relay if friends can't connect).
- Tune the duel budget (4200) and save counts (3/1) after real play. Maybe mirrored replay for the 'e' side.
- Subroles: no playtest data yet on whether 0.2–0.5 weights are felt.
- Vitamins are weak; buffing needs a boss retune. Attack vitamins weakest.
- Possible: split `engine.js` / `ui.js` into modules (asked, no answer yet); polish pass; more gens (later packs) — the game must not be
  framed as Gen 1 only; more run modifiers; replay link for duels; duel record on the Trainer Card; "Draft Duel" mode with no box.
- Playtest watchlist themes: skill gap between casual and reference players, whether anyone stacks Cannons on vitamins, whether
  friends stall at Lance/Blue, whether the benched-body second team is exploitable, sound/wipe annoyance, animation smoothness on old phones.

## 11. Where the long-form history lives

Sean's Claude project "Auto Battler" on claude.ai holds 18 design notes (`pokebattler-design.md`, `-economy.md`, `-run-structure.md`,
`-stats.md`, `-gen3.md`, `-subroles.md`, `-multiplayer-phase1.md`, `-dev-workflow.md`, `-playtest-watchlist.md`, style/stadium/broadcast
looks, challenges-and-badges, mobile-and-items, tm-ideas, tester-checklists, phone-fixes). Those files are *history and rationale*, with
per-version measurements; this CLAUDE.md distils the parts that matter now. If you need the original reasoning for a number, ask Sean to
add that note to this folder (he can download it from the project), or search `ui.js`'s `CHANGELOG` which records every change since 1.1.0.

## 12. How to work with Sean

Short, plain-language updates; one question at a time; use a multiple-choice question for real design decisions. Big or risky changes
(restructuring, new mechanics, balance shifts that move clear rates) → propose first. After any gameplay change: run `./quick.sh`, bump
the version correctly with `bump.py`, run `./release.sh`, and tell him what he'd see. Tell him honestly what you could not test.
