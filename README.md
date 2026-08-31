# Atmospheric Prism

Booth demo for **Histogram Perfect**, VRSJ 2026.
Live: **https://carlos-gf.github.io/AtmosphericPrism/**

A triangular mirror prism, 160 mm to a side, stands on an iPad Pro 11" in
portrait. The screen shows a reduced image under the prism; the mirrors turn it
into an endless space. Below the prism the app asks what atmosphere it is. After
an answer, the source photograph appears inside the prism.

## Publishing

No build step and no dependencies. Settings → Pages → branch `main`, folder
`/ (root)`.

To run it locally, use a static server — ES modules will not load over `file://`:

```
python3 -m http.server 8000
```

## On the iPad

1. Open the Pages URL in Safari → Share → **Add to Home Screen**, and launch it
   from the icon.
2. Let the bar reach 20 of 20 once while online. After that it runs offline.
3. Settings → Accessibility → **Guided Access** on, then triple-click the side
   button inside the app.
4. Brightness to maximum, Auto-Brightness and True Tone off.
5. Five taps inside the **faint square in the top-right corner** open the
   settings; its outline brightens as the taps land. Turn the alignment outline
   on, stand the prism on the glass, nudge until the mirrors sit on the line,
   turn it off.

The triangle is sized in millimetres, not pixels. The default is 160.0 mm; set
whatever your prism measures inside the mirrors. *Screen density* is there for
other tablets (264 ppi is the iPad Pro 11").

Settings also holds the one timing control: after someone answers, the source
photograph stays in the prism for **10 seconds** by default, then the next
atmosphere comes up on its own. Adjustable from 3 to 60 seconds.

## Changing the words

Everything a visitor reads is in `js/scenes.js`:

```js
{
  id: 'hiyoshi',                       // img/hiyoshi_rpca.jpg, _src.jpg, _thumb.jpg
  answer: 'Autumn trees',
  others: ['A desert canyon', 'A field of rapeseed', 'A tiled courtyard'],
  reveal: 'Ginkgo trees on campus',
  place: 'Hiyoshi, Keio University',
}
```

The options are shuffled on screen. After editing, bump `CACHE` in `sw.js` or
the iPad keeps serving the version it cached.

## Answers

Every answer is stored on the iPad: session, timestamp, scene, correct answer,
choice, whether it matched, seconds taken. Settings → *Copy CSV* or *Download
CSV*. The log lives in that browser's storage, so export it before clearing
website data.

## Regenerating the images

The RPCA permutation is computed **inside the triangle**, not over the square
and then clipped — clipping would discard half the pixels and the visible area
would no longer hold the source's colour histogram. `gen/rpca_triangle.mjs`
checks this on every run.

```
python3 gen/dump.py           gen/bin  <folder of 900x900 *_SRC.png>
node    gen/rpca_triangle.mjs gen/bin  gen/out
python3 gen/pack.py           gen/out  img
```

`kaleidoscope_standalone.html` is a single-file build for a laptop, made by
`python3 build_standalone.py`. It cannot run on an iPad: the iOS Files app opens
HTML in Quick Look, which executes no JavaScript.

MIT licensed. From *Preliminary Exploration for Visual Reduction for Preserving
Atmospheric Impression*, VRSJ 2026.
