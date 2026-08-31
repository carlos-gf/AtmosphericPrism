/* RPCA restricted to the triangle the prism actually shows.

   The original stimuli were generated over the full 900 x 900 square and then
   clipped to a triangle for the kaleidoscope. That quietly breaks the method's
   one guarantee: pixels are permuted across the whole square, so a large share
   of them land outside the triangle and never appear, and what you see through
   the mirrors no longer holds the source's colour histogram.

   This regenerates them properly. The permutation is computed over the masked
   set only: the pixels inside the triangle are sorted by hue, the field values
   inside the triangle are sorted by luminance, and the two are matched. Source
   and destination sets are the same set, so the visible triangle preserves the
   histogram of the source's triangle exactly.

   Everything else is the verified port of sketch_260201f_base.pde — the
   parabolic blur, the float32 sort keys, java.awt.Color.RGBtoHSB — reused
   unchanged from the Histogram Perfect web app. Only the domain changes. */

import fs from 'node:fs';
import path from 'node:path';
import {
  buildBlurredLuminanceField, sortByKey, BLUR_A,
} from './lib/pipeline.js';

const fr = Math.fround;

const W = 900;
const H = 779;                 // round(900 * sqrt(3)/2), the triangle bbox
const DILATE = 3;              // px of content carried past the clip edge
const IN = process.argv[2];
const OUT = process.argv[3];

/* ---------------- the triangle ---------------- */

/* Apex up: at depth y the half width is (W/2) * y/H. `slack` is measured
   horizontally; the slanted edges lean 30 degrees off vertical, so a
   perpendicular margin of d costs d / cos(30) = 1.1547 d horizontally. */
function halfWidthAt(y) { return (W / 2) * ((y + 0.5) / H); }

function makeMask(slackPx) {
  const m = new Uint8Array(W * H);
  const slack = slackPx * 1.1547;
  for (let y = 0; y < H; y++) {
    const hw = halfWidthAt(y) + slack;
    for (let x = 0; x < W; x++) {
      m[y * W + x] = Math.abs(x + 0.5 - W / 2) <= hw ? 1 : 0;
    }
  }
  return m;
}

/* JPEG ringing along a hard black edge would show as a dark halo just inside
   the clip path, so content is carried a few pixels past it and the clip cuts
   through picture rather than through an edge. */
function bleed(out, inside, dilated) {
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!dilated[i] || inside[i]) continue;

      // walk toward the centre line until we are back inside the triangle
      const step = x + 0.5 < W / 2 ? 1 : -1;
      let sx = x;
      for (let k = 0; k < 16; k++) {
        sx += step;
        if (sx < 0 || sx >= W) break;
        if (inside[y * W + sx]) {
          const s = (y * W + sx) * 4, d = i * 4;
          out[d] = out[s]; out[d + 1] = out[s + 1]; out[d + 2] = out[s + 2]; out[d + 3] = 255;
          break;
        }
      }
    }
  }
}

/* ---------------- hue key, java.awt.Color.RGBtoHSB ---------------- */

function hueKey(r, g, b) {
  let cmax = r > g ? r : g; if (b > cmax) cmax = b;
  let cmin = r < g ? r : g; if (b < cmin) cmin = b;

  const brightness = fr(cmax / 255.0);
  const saturation = cmax !== 0 ? fr((cmax - cmin) / cmax) : 0;
  let hue = 0;

  if (saturation !== 0) {
    const d = cmax - cmin;
    const redc = fr((cmax - r) / d), greenc = fr((cmax - g) / d), bluec = fr((cmax - b) / d);
    if (r === cmax) hue = fr(bluec - greenc);
    else if (g === cmax) hue = fr(fr(2.0 + redc) - bluec);
    else hue = fr(fr(4.0 + greenc) - redc);
    hue = fr(hue / 6.0);
    if (hue < 0) hue = fr(hue + 1.0);
  }

  // the sketch's composite key: hue, nudged by saturation then brightness
  return fr(fr(hue + fr(saturation * fr(0.08))) + fr(brightness * fr(0.02)));
}

/* ---------------- one scene ---------------- */

function run(rgba) {
  /* The field is built over the whole rectangle on purpose. The blur kernel is
     63 px wide and the pixels just outside the triangle are real neighbours in
     the photograph; masking them to black first would ring the field along the
     edges and pull the permutation toward the rim. Only the *selection* is
     masked, not the blur. */
  const field = buildBlurredLuminanceField(rgba, W, H, BLUR_A, 0);

  const inside = makeMask(0);
  const dilated = makeMask(DILATE);

  let n = 0;
  for (let i = 0; i < W * H; i++) if (inside[i]) n++;

  const srcIdx = new Uint32Array(n);
  const dstIdx = new Uint32Array(n);
  const srcKey = new Float32Array(W * H);

  for (let i = 0, k = 0; i < W * H; i++) {
    if (!inside[i]) continue;
    const p = i * 4;
    srcKey[i] = hueKey(rgba[p], rgba[p + 1], rgba[p + 2]);
    srcIdx[k] = i;
    dstIdx[k] = i;
    k++;
  }

  sortByKey(srcIdx, srcKey);
  sortByKey(dstIdx, field);

  const out = new Uint8ClampedArray(W * H * 4);   // black everywhere to start
  for (let k = 0; k < n; k++) {
    const s = srcIdx[k] * 4, d = dstIdx[k] * 4;
    out[d] = rgba[s]; out[d + 1] = rgba[s + 1]; out[d + 2] = rgba[s + 2]; out[d + 3] = 255;
  }

  bleed(out, inside, dilated);
  return { out, inside, dilated, n };
}

/* Proof, not decoration: if the permutation really is closed over the triangle,
   the multiset of colours inside it is untouched. Any drift means a pixel
   escaped, which is exactly the bug being fixed. */
function histogram(rgba, mask) {
  const h = new Uint32Array(256 * 3);
  for (let i = 0; i < W * H; i++) {
    if (!mask[i]) continue;
    const p = i * 4;
    h[rgba[p]]++; h[256 + rgba[p + 1]]++; h[512 + rgba[p + 2]]++;
  }
  return h;
}

const scenes = fs.readdirSync(IN).filter(f => f.endsWith('.rgba')).sort();
fs.mkdirSync(OUT, { recursive: true });

for (const file of scenes) {
  const id = path.basename(file, '.rgba');
  const rgba = new Uint8ClampedArray(fs.readFileSync(path.join(IN, file)));

  const { out, inside, n } = run(rgba);

  const a = histogram(rgba, inside);
  const b = histogram(out, inside);
  let drift = 0;
  for (let i = 0; i < a.length; i++) drift += Math.abs(a[i] - b[i]);

  fs.writeFileSync(path.join(OUT, `${id}_rpca.rgba`), Buffer.from(out.buffer));

  // the source, masked the same way, for the reveal
  const src = new Uint8ClampedArray(W * H * 4);
  const dil = makeMask(DILATE);
  for (let i = 0; i < W * H; i++) {
    if (!dil[i]) continue;
    const p = i * 4;
    src[p] = rgba[p]; src[p + 1] = rgba[p + 1]; src[p + 2] = rgba[p + 2]; src[p + 3] = 255;
  }
  fs.writeFileSync(path.join(OUT, `${id}_src.rgba`), Buffer.from(src.buffer));

  console.log(`${id.padEnd(10)} ${n} px in triangle (${(100 * n / (W * H)).toFixed(1)}%)  histogram drift ${drift}`);
}
