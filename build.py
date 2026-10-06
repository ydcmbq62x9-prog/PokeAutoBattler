import re, pathlib
shell = pathlib.Path('/mnt/user-data/outputs/gen2/pokebattler.html').read_text().replace('<title>PokéBattler Gen 2 Preview</title>', '<title>PokéBattler</title>')
if '<!--BUILT-->' in shell:
    shell = pathlib.Path('shell.html').read_text()
else:
    pathlib.Path('shell.html').write_text(shell)
engine  = pathlib.Path('engine.js').read_text()
ui      = pathlib.Path('ui.js').read_text()
sprites = pathlib.Path('sprites.js')
if sprites.exists():
    placeholder = ui.split('const SPRITES = {};')
    assert len(placeholder) == 2, 'SPRITES placeholder not found in ui.js'
    ui = placeholder[0] + sprites.read_text().strip() + placeholder[1]
js = engine + "\n\n" + ui
assert '</script>' not in js, 'JS contains a literal closing script tag'
out = shell.replace('<script>\n"use strict";\n</script>', '<!--BUILT-->\n<script>\n"use strict";\n' + js + '\n</script>')
assert '<!--BUILT-->' in out, 'injection point not found'
pathlib.Path('/mnt/user-data/outputs/gen2/pokebattler.html').write_text(out.replace('<title>PokéBattler</title>', '<title>PokéBattler Gen 2 Preview</title>', 1))   # gen2 branch: its own page title
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
head = '''<meta name="description" content="PokéBattler — a Pokémon auto battler for you and your friends.">
<link rel="manifest" href="manifest.webmanifest">
<meta name="theme-color" content="#11182c">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="PokéBattler">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<link rel="icon" type="image/png" sizes="32x32" href="icons/favicon-32.png">
'''
vp_old = '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">'
assert vp_old in out and '<title>PokéBattler</title>' in out
app_html = out.replace(vp_old, vp_old.replace('user-scalable=no', 'user-scalable=no, viewport-fit=cover'), 1)
app_html = app_html.replace('<title>PokéBattler</title>', '<title>PokéBattler</title>\n' + head, 1)
(appdir / 'index.html').write_text(app_html)
manifest = {
  "name": "PokéBattler", "short_name": "PokéBattler",
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
        if f.is_file(): z.write(f, f.relative_to(appdir))
print('app', ver, 'written:', sorted(str(f.relative_to(appdir)) for f in appdir.rglob('*') if f.is_file()))
