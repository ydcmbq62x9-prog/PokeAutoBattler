"""Build the game: shell.html + engine.js + sprites.js + ui.js -> one HTML file, plus the home-screen app zip.
   Everything comes from files in this folder; nothing is read back from the output (it used to be, which is how
   a stale copy could get published). Writes, under /mnt/user-data/outputs/:
     pokebattler.html        the page to publish as the artifact (title "PokéArena")
     gen2/pokebattler.html   the copy the Playwright tests load (title "PokéArena Gen 2 Preview")
     gen2/pokebattler-app.zip + gen2/pokebattler-app/   the GitHub Pages / home-screen app
   Fails loudly if the version and the changelog disagree. """
import re, pathlib
OUT = pathlib.Path('/mnt/user-data/outputs')
shell = pathlib.Path('shell.html').read_text()
engine  = pathlib.Path('engine.js').read_text()
ui      = pathlib.Path('ui.js').read_text()
_ver = re.search(r"GAME_VERSION = \{ v:'([\w.]+)'", ui).group(1)
_top = re.search(r"const CHANGELOG = \[\s*\{ v:'([\w.]+)'", ui).group(1)
assert _ver == _top, f'GAME_VERSION {_ver} but the newest changelog entry is {_top}: run bump.py'
sprites = pathlib.Path('sprites.js')
if sprites.exists():
    placeholder = ui.split('const SPRITES = {};')
    assert len(placeholder) == 2, 'SPRITES placeholder not found in ui.js'
    ui = placeholder[0] + sprites.read_text().strip() + placeholder[1]
js = engine + "\n\n" + ui
assert '</script>' not in js, 'JS contains a literal closing script tag'
out = shell.replace('<script>\n"use strict";\n</script>', '<!--BUILT-->\n<script>\n"use strict";\n' + js + '\n</script>')
assert '<!--BUILT-->' in out, 'injection point not found'
(OUT / 'gen2').mkdir(parents=True, exist_ok=True)
(OUT / 'pokebattler.html').write_text(out)                                    # the artifact copy: always the same build as the tests load
(OUT / 'gen2' / 'pokebattler.html').write_text(out.replace('<title>PokéArena</title>', '<title>PokéArena Gen 2 Preview</title>', 1))
print('built', len(out), 'bytes')

# ---- v48: the home-screen app (GitHub Pages) ----
# Same game, plus a manifest, icons and a service worker beside it. Written to
# /mnt/user-data/outputs/gen2/pokebattler-app/ and zipped; the artifact is unchanged.
import json, shutil, zipfile
ver = re.search(r"GAME_VERSION = \{ v:'([\w.]+)'", ui).group(1)
appdir = pathlib.Path('/mnt/user-data/outputs/gen2/pokebattler-app')
if appdir.exists(): shutil.rmtree(appdir)
(appdir / 'icons').mkdir(parents=True)
for f in ['icon-192.png', 'icon-512.png', 'maskable-192.png', 'maskable-512.png', 'apple-touch-icon.png', 'favicon-32.png']:
    shutil.copy('app/icons/' + f, appdir / 'icons' / f)
head = '''<meta name="description" content="PokéArena — a Pokémon auto battler for you and your friends.">
<link rel="manifest" href="manifest.webmanifest">
<meta name="theme-color" content="#11182c">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="PokéArena">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<link rel="icon" type="image/png" sizes="32x32" href="icons/favicon-32.png">
'''
vp_old = '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">'
assert vp_old in out and '<title>PokéArena</title>' in out
app_html = out.replace(vp_old, vp_old.replace('user-scalable=no', 'user-scalable=no, viewport-fit=cover'), 1)
app_html = app_html.replace('<title>PokéArena</title>', '<title>PokéArena</title>\n' + head, 1)
(appdir / 'index.html').write_text(app_html)
manifest = {
  "name": "PokéArena", "short_name": "PokéArena",
  "description": "A Pokémon auto battler for you and your friends.",
  "id": "./", "start_url": "./", "scope": "./",
  "display": "standalone", "orientation": "any",
  "background_color": "#3a8840", "theme_color": "#11182c",
  "icons": [
    {"src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
    {"src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
    {"src": "icons/maskable-192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable"},
    {"src": "icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}]}
(appdir / 'manifest.webmanifest').write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
(appdir / 'sw.js').write_text(pathlib.Path('app/sw.template.js').read_text().replace('__VERSION__', ver))
(appdir / 'README.md').write_text(pathlib.Path('app/README.template.md').read_text().replace('__VERSION__', ver))
zpath = pathlib.Path('/mnt/user-data/outputs/gen2/pokebattler-app.zip')
with zipfile.ZipFile(zpath, 'w', zipfile.ZIP_DEFLATED) as z:
    for f in sorted(appdir.rglob('*')):
        if f.is_file():
            zi = zipfile.ZipInfo(str(f.relative_to(appdir)), (2026, 1, 1, 0, 0, 0))   # fixed date: a file with a pre-1980 mtime made zipping fail
            zi.compress_type = zipfile.ZIP_DEFLATED; zi.external_attr = 0o644 << 16
            z.writestr(zi, f.read_bytes())
print('app', ver, 'written:', sorted(str(f.relative_to(appdir)) for f in appdir.rglob('*') if f.is_file()))
