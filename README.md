# Do you recognise this atmosphere?

Kaleidoscope booth demo for **Histogram Perfect**, VRSJ 2026.

A triangular mirror prism, 160 mm to a side, stands on an iPad Pro 11" in
portrait. Under it the screen shows one RPCA image; the mirrors tile that
triangle outward and it reads as an endless space. Below the prism, where the
visitor can actually see it, the app asks what atmosphere it is and offers four
choices. When they answer, the **source photograph appears inside the prism** —
the reveal happens in the kaleidoscope, not on a thumbnail.

That is the paper's argument made physical: a reduced image, with no objects
left in it, is still enough to build an environment out of.

---

## Two builds, same code

| | what it is | when to use it |
|---|---|---|
| `app/` | ordinary web folder | GitHub Pages, then **Add to Home Screen** on the iPad. Works offline after the first load. |
| `kaleidoscope_standalone.html` | one 11 MB file, images and all | AirDrop to the iPad, open from Files. No server, no network, no setup. |

The standalone is generated from `app/` by `python3 build_standalone.py`, so the
two cannot drift apart. Edit `app/`, rebuild, never edit the standalone.

**Take both to the venue.** The home-screen version is the good experience;
the standalone is the one that still works when the wifi does not.

---

## Setting up the iPad

1. **Install it.** Open the Pages URL in Safari → Share → *Add to Home Screen*.
   Launch it from the home screen icon, not from Safari — that is what removes
   the address bar and makes it genuinely fullscreen.
2. **Let it finish loading once, on a network you trust.** The progress bar
   under the title counts to 20 of 20. After that it runs with wifi switched off.
3. **Lock it.** Settings → Accessibility → Guided Access → on, with a passcode.
   Then triple-click the side button inside the app. Nobody can leave it,
   swipe it away, or reach the home screen.
4. **Brightness to maximum**, Auto-Brightness off, True Tone off. Everything
   the visitor sees is a reflection of this screen.
5. **Align the prism.** Five taps in the very bottom-left corner opens Booth
   settings. Turn *Alignment outline* on, stand the prism on the glass, nudge
   until the mirrors sit exactly on the gold line, turn the outline off.

The triangle is sized in **millimetres of real glass**, not pixels — the default
is 160.0 mm, which on this screen is 831.5 of 834 available points. There is
roughly one point of margin on each side, so if the prism turns out to measure
161 mm the app will clip it rather than shrink the picture. Measure the
*inside* of the mirrors and set the real number.

If the demo runs on some other tablet, correct *Screen density* first (264 ppi
is the iPad Pro 11", every generation) and the millimetres follow.

---

## Changing the words

Everything a visitor reads lives in `app/js/scenes.js`, one block per scene:

```js
{
  id: 'hiyoshi',                       // img/hiyoshi_rpca.jpg + img/hiyoshi_src.jpg
  answer: 'Autumn trees',              // the one that is correct
  others: ['A desert canyon', 'A field of rapeseed', 'A tiled courtyard'],
  reveal: 'Ginkgo trees on campus',    // shown after they answer
  place: 'Hiyoshi, Keio University',   // small grey line under it
}
```

The four options are shuffled on screen, so the correct one is never in a
predictable place.

Two decisions worth keeping if you rewrite them:

- **The options are atmospheres and place types, not place names.** "A shopping
  street", not "Sasazuka". Naming the city would make it a geography quiz;
  the study measured impression, and so should this.
- **The distractors are colour-plausible.** Every alternative had to be
  believable given what the reduced image actually looks like — gold-and-blue
  Hiyoshi is offered a rapeseed field, dark-and-red Shinjuku is offered a lava
  field. Obviously wrong options would make people right for the wrong reason,
  and the interesting result is that they are *usually wrong and still confident
  about the mood*.

Two `place` fields are still generic (`river`, `fireworks`) because the demo's
`labels.txt` never had them filled in. Add them when you know them.

After editing, rebuild the standalone and **bump `CACHE` in `app/sw.js`** —
otherwise the iPad keeps serving the version it already cached.

---

## Getting the answers back

Every answer is recorded on the iPad: session, timestamp, scene, correct
answer, what they chose, whether it matched, and how long they took.

Five taps in the bottom-left corner → **Booth settings** → *Copy CSV* or
*Download CSV*. Copying and pasting into Notes or Mail is the reliable route on
an iPad in Guided Access; the download goes to Files.

Sessions are separated automatically: a fresh sequence starts after two minutes
of nobody touching it, so each visitor's answers group together under one
session id.

**Do this at the end of each day.** The log lives in the browser's storage on
that one iPad. Clearing Safari's website data, or deleting the home-screen app,
erases it.

---

## Things that were decided deliberately

**The prism is never dark.** Before anyone touches it, the triangle drifts
through the reduced images every five seconds. From across the room that
movement is what makes someone walk over and look inside.

**Nothing outside the triangle is bright.** Page black, text dim, no white
anywhere. Stray light from the screen enters the prism and shows up as a
glowing edge in the reflections.

**Getting it wrong is not punished.** Gold marks what the image actually was;
the option the visitor picked is outlined in plain grey. Most people will be
wrong, that is the finding, and the demo should not scold them for confirming it.

**It moves on by itself.** Forty seconds after an answer it advances, so the
next person always arrives at a question rather than someone else's reveal.
Two minutes of silence and it reshuffles for a new visitor.

---

Carlos Garcia Fernandez, Takatoshi Yoshida, Kouta Minamizawa —
Keio University Graduate School of Media Design.
