#!/usr/bin/env python3
"""Release bookkeeping in one command: set GAME_VERSION and add the changelog entry.

  python3 bump.py 6.13.0 "Balance patch" "One-line subtitle" "First bullet." "Second bullet." ...

Title must be one of: Visual bug fixes, Minor gameplay changes, Balance patch, Major gameplay update.
Version rule: first digit mechanical, second additions/removals, third visual. Date is today.
Non-ASCII text (₽, é, curly quotes) is escaped for you, so just type it normally."""
import sys, re, datetime, pathlib
TITLES = ['Visual bug fixes', 'Minor gameplay changes', 'Balance patch', 'Major gameplay update']
if len(sys.argv) < 5: sys.exit(__doc__)
ver, title, sub, *items = sys.argv[1:]
assert re.fullmatch(r'\d+\.\d+\.\d+', ver), 'version must look like 6.13.0'
assert title in TITLES, f'title must be one of {TITLES}'
p = pathlib.Path('ui.js'); ui = p.read_text()
cur = re.search(r"GAME_VERSION = \{ v:'([\d.]+)'", ui).group(1)
assert tuple(map(int, ver.split('.'))) > tuple(map(int, cur.split('.'))), f'{ver} is not newer than {cur}'
date = datetime.date.today().strftime('%b %-d, %Y')
def js(t): return ''.join(c if ord(c) < 128 and c not in "'\\" else ('\\u%04x' % ord(c) if ord(c) >= 128 else '\\' + c) for c in t)
entry = f"  {{ v:'{ver}', date:'{date}', title:'{title}', sub:'{js(sub)}', items:[\n" + ''.join(f"    '{js(i)}',\n" for i in items) + "  ] },\n"
ui = re.sub(r"(GAME_VERSION = \{ v:')[\d.]+(', date:')[^']*'", lambda m: f"{m[1]}{ver}{m[2]}{date}'", ui, count=1)
assert 'const CHANGELOG = [\n' in ui
ui = ui.replace('const CHANGELOG = [\n', 'const CHANGELOG = [\n' + entry, 1)
p.write_text(ui); print(f'{cur} -> {ver}: {title} ({date}); now run ./release.sh')
