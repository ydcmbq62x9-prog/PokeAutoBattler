# PokéArena — working on the game

Source: `engine.js` (rules), `ui.js` (screens, changelog), `shell.html` (CSS + page), `sprites.js` (images),
`arena.js/css` (battle stage). `build.py` joins them into one HTML file.

## The loop
1. Edit.
2. `./quick.sh` — rules/items/shop/economy tests, about 25 s, no browser. Run after every edit.
3. `python3 bump.py 6.13.0 "Balance patch" "One-line subtitle" "Bullet." "Bullet."` — sets the version and writes
   the changelog entry (title must be one of the four allowed; non-ASCII is escaped for you).
4. `./release.sh` — build, quick suite, phone layout check. `./release.sh full` also runs the whole suite (~9 min).
5. Publish `/mnt/user-data/outputs/pokebattler.html` as the artifact, hand over `gen2/pokebattler-app.zip`.
   (`build.py` writes the artifact copy itself now, so it can never be a stale build.)

Version rule: first digit mechanical, second additions/removals, third visual.

## Balance (`bal.js`)
- `node bal.js items` — every held item on every role, flagged LOW/HIGH against its rarity's band (edit `TARGET` in the file).
- `node bal.js vit` — every vitamin / Training Manual boost per role.
- `node bal.js econ 700 "base inc1 egg share1"` — bot clear rate with a gift (income, Lucky Egg, Exp. Share, Candy).
- `node bal.js rate 300 [1,2,3]` — bot clear rate. Boss-by-boss: `node rate.js 300 [3] 1`.
- Try a number without editing: `PATCH='{"scope":{"pct":{"atk":0.7}}}' node bal.js items 800`.
- Rule of thumb found so far: raising vitamins lifts the clear rate 6–9 points; an Exp. Share doing 2 rounds made Red far
  too easy because the bot stacks them. Re-run `./runtests.sh` after anything economic.

## Where a number lives (edit once)
- Vitamins: `boost:{…}` on the item in `ITEMS`; the tap effect and the card text are generated from it.
- Held items: `pct`, `cutPct`, `income`, … on the item in `HELD_ITEMS`, plus its `text` (check the card still says the same thing).
- Rarity odds: `TUNING.rarity` weights; per-item `rarity`. Economy caps: `TUNING.eggCap`, `TUNING.vitaminCap`, `TUNING.manual`.

## Tests
- `*test.js` fail with a non-zero exit. A test that fails then passes on retry shows as FLAKY (`run1.sh`); two failures is FAIL.
  Logs go to `_scratch/logs/`.
- `// @slow` on line 1 = a statistical balance check, left out of `quick.sh`.
- Don't hard-code a balance number in a test: read it from `E.HELD_ITEMS` / `E.TUNING` (see `test.js` Assault Vest).
- Reports with no assertions are named `*report.js` (`lockreport.js`, `symreport.js`) so the suite doesn't run them.
- `_scratch/` (git-ignored) holds screenshots, logs and one-off scripts.

## Running outside the cloud sandbox
Set `PKB_OUT` to any folder (default `/mnt/user-data/outputs`). `build.py` writes there and every browser test loads
`$PKB_OUT/gen2/pokebattler.html` via `pkbpaths.js`. See `CLAUDE.md` for the full hand-off.
