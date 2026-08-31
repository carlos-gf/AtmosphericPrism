#!/usr/bin/env python3
"""Folds the whole app into one HTML file.

This repository is the app: index.html, css/, js/ and img/ are served as they
are. This script rolls the same files into a single self-contained page with
every image inlined as a data URI, for showing the demo on a laptop with no
server to hand. It reads the same sources the site does, so the two builds can
never drift apart.

    python3 build_standalone.py

Note that the standalone will NOT run on an iPad: opening an HTML file in the
iOS Files app gets you Quick Look, which renders the page but executes no
JavaScript. On iOS, use the GitHub Pages URL.
"""

import base64
import pathlib
import re

HERE = pathlib.Path(__file__).parent
OUT = HERE / 'kaleidoscope_standalone.html'

html = (HERE / 'index.html').read_text()
css = (HERE / 'css' / 'style.css').read_text()
scenes = (HERE / 'js' / 'scenes.js').read_text()
app = (HERE / 'js' / 'app.js').read_text()

# the two module seams, which are the only difference between the builds
scenes = scenes.replace('export const SCENES', 'const SCENES')
app = re.sub(r"^import \{ SCENES \}.*$", '', app, flags=re.M)

# a service worker cannot be registered from file://, and is pointless here
app = re.sub(r"if \('serviceWorker' in navigator\) \{.*?\}\n", '', app, flags=re.S)

inline = {}
for jpg in sorted((HERE / 'img').glob('*.jpg')):
    inline[jpg.stem] = 'data:image/jpeg;base64,' + base64.b64encode(jpg.read_bytes()).decode()

icon = base64.b64encode((HERE / 'icon.png').read_bytes()).decode()

img_js = 'self.HP_INLINE = {\n' + ''.join(
    f'  "{k}": "{v}",\n' for k, v in inline.items()) + '};\n'

html = html.replace('<link rel="stylesheet" href="css/style.css">',
                    '<style>\n' + css + '\n</style>')
html = html.replace('<link rel="manifest" href="manifest.webmanifest">\n', '')
html = html.replace('<link rel="apple-touch-icon" href="icon.png">',
                    f'<link rel="apple-touch-icon" href="data:image/png;base64,{icon}">')
html = html.replace('<link rel="icon" href="icon.png">',
                    f'<link rel="icon" href="data:image/png;base64,{icon}">')
html = html.replace('<script type="module" src="js/app.js"></script>',
                    '<script>\n' + img_js + scenes + '\n' + app + '\n</script>')

OUT.write_text(html)
print(f'{OUT.name}  {OUT.stat().st_size / 1024 / 1024:.1f} MB  ({len(inline)} images)')

assert 'href="css/' not in html and 'src="js/' not in html, 'something is still external'
assert 'img/' not in html.split('self.HP_INLINE')[0], 'index still references img/'
