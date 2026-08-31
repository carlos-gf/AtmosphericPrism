// The four Histogram Perfect conditions, ported from sketch_260201f_base.pde.
//
// SRC   centre cropped and resized source
// RPCA  histogram preserving permutation, hue ordered pixels into a blurred
//       luminance field
// RPCB  histogram preserving permutation, luminance ordered pixels into a
//       coarsened blurred luminance field
// CTRL  deterministic tile shuffle of SRC
//
// RPCA and RPCB preserve the colour histogram exactly, because no pixel value is
// ever modified — they are only moved.

import { blurChannel } from './blur.js';
import { JavaRandom, stableSeedFromName } from './rng.js';

// Processing stores both key arrays as float[], and rounds after every
// arithmetic step. That is not a detail we can skip: at v around 0.5 a 32-bit
// float cannot even represent the y * 1e-9 tie breaker, so in Java it vanishes
// and huge groups of pixels end up with genuinely equal keys, ordered by the
// quicksort's own behaviour. Emulating double precision here would order those
// groups differently and produce a different picture. fr() is Math.fround.
const fr = Math.fround;

export const SIZE = 900;
export const CTRL_TILE = 36;
export const BLUR_A = 18.0;
export const BLUR_B = 34.0;
export const B_LEVELS = 10;

/* ---------------- luminance field ---------------- */

/**
 * Greyscale, blur, normalise to 0..1, optionally quantise, then add a tiny
 * positional term so equal values still have a stable order.
 */
export function buildBlurredLuminanceField(rgba, w, h, blurRadius, quantLevels) {
  const lum = new Uint8Array(w * h);

  for (let i = 0, p = 0; i < w * h; i++, p += 4) {
    // float y = 0.2126f*r + 0.7152f*g + 0.0722f*b, left to right
    const y = fr(fr(fr(0.2126) * rgba[p] + fr(fr(0.7152) * rgba[p + 1]))
                 + fr(fr(0.0722) * rgba[p + 2]));

    // color(y, y, y) goes through colorCalc, which divides by 255, multiplies
    // back by 255 and truncates. The round trip loses a unit surprisingly often.
    lum[i] = fr(fr(y / 255.0) * 255) | 0;
  }

  const blurred = blurChannel(lum, w, h, blurRadius);
  const field = new Float32Array(w * h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let v = fr(blurred[i] / 255.0);

      if (quantLevels > 0) v = fr(Math.floor(fr(v * quantLevels)) / quantLevels);

      field[i] = fr(v + fr(fr(x * fr(1e-7)) + fr(y * fr(1e-9))));
    }
  }

  return field;
}

/* ---------------- sorting ---------------- */

/**
 * The generator's quicksort, made iterative so a pathological input cannot blow
 * the JavaScript stack. Same pivot choice and same partition, so the same
 * ordering comes out.
 */
export function sortByKey(idx, key) {
  const stack = [0, idx.length - 1];

  while (stack.length) {
    const hi = stack.pop();
    const lo = stack.pop();
    if (lo >= hi) continue;

    let i = lo, j = hi;
    const pivot = key[idx[(lo + hi) >>> 1]];

    while (i <= j) {
      while (key[idx[i]] < pivot) i++;
      while (key[idx[j]] > pivot) j--;
      if (i <= j) {
        const t = idx[i]; idx[i] = idx[j]; idx[j] = t;
        i++; j--;
      }
    }

    if (lo < j) stack.push(lo, j);
    if (i < hi) stack.push(i, hi);
  }
}

/* ---------------- hue, exactly as java.awt.Color.RGBtoHSB ---------------- */

const hsb = new Float32Array(3);

function rgbToHsb(r, g, b) {
  let cmax = r > g ? r : g;
  if (b > cmax) cmax = b;
  let cmin = r < g ? r : g;
  if (b < cmin) cmin = b;

  const brightness = fr(cmax / 255.0);
  const saturation = cmax !== 0 ? fr((cmax - cmin) / cmax) : 0;

  let hue = 0;

  if (saturation !== 0) {
    const d = cmax - cmin;
    const redc = fr((cmax - r) / d);
    const greenc = fr((cmax - g) / d);
    const bluec = fr((cmax - b) / d);

    if (r === cmax) hue = fr(bluec - greenc);
    else if (g === cmax) hue = fr(fr(2.0 + redc) - bluec);
    else hue = fr(fr(4.0 + greenc) - redc);

    hue = fr(hue / 6.0);
    if (hue < 0) hue = fr(hue + 1.0);
  }

  hsb[0] = hue; hsb[1] = saturation; hsb[2] = brightness;
  return hsb;
}

/* ---------------- the permutation ---------------- */

export function permuteHistogramPerfect(rgba, w, h, dstField, sourceUsesHue) {
  const n = w * h;

  const srcIdx = new Uint32Array(n);
  const dstIdx = new Uint32Array(n);
  const srcKey = new Float32Array(n);

  for (let i = 0, p = 0; i < n; i++, p += 4) {
    srcIdx[i] = i;
    dstIdx[i] = i;

    const r = rgba[p], g = rgba[p + 1], b = rgba[p + 2];

    if (sourceUsesHue) {
      const c = rgbToHsb(r, g, b);
      srcKey[i] = fr(fr(c[0] + fr(c[1] * fr(0.08))) + fr(c[2] * fr(0.02)));
    } else {
      srcKey[i] = fr(fr(fr(fr(0.2126) * r) + fr(fr(0.7152) * g)) + fr(fr(0.0722) * b));
    }
  }

  sortByKey(srcIdx, srcKey);
  sortByKey(dstIdx, dstField);

  const out = new Uint8ClampedArray(n * 4);

  for (let k = 0; k < n; k++) {
    const s = srcIdx[k] * 4;
    const d = dstIdx[k] * 4;
    out[d]     = rgba[s];
    out[d + 1] = rgba[s + 1];
    out[d + 2] = rgba[s + 2];
    out[d + 3] = 255;
  }

  return out;
}

/* ---------------- tile shuffle control ---------------- */

export function shuffleTilesDeterministic(rgba, w, h, tile, seed) {
  const out = new Uint8ClampedArray(w * h * 4);

  const cols = Math.floor(w / tile);
  const rows = Math.floor(h / tile);
  const tileCount = cols * rows;

  const order = new Int32Array(tileCount);
  for (let i = 0; i < tileCount; i++) order[i] = i;

  const rng = new JavaRandom(seed);
  for (let i = tileCount - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    const t = order[i]; order[i] = order[j]; order[j] = t;
  }

  let t = 0;
  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      const pick = order[t++];

      const sx = (pick % cols) * tile;
      const sy = Math.floor(pick / cols) * tile;
      const dx = tx * tile;
      const dy = ty * tile;

      for (let yy = 0; yy < tile; yy++) {
        const yS = sy + yy, yD = dy + yy;
        if (yS >= h || yD >= h) continue;

        for (let xx = 0; xx < tile; xx++) {
          const xS = sx + xx, xD = dx + xx;
          if (xS >= w || xD >= w) continue;

          const s = (yS * w + xS) * 4;
          const d = (yD * w + xD) * 4;
          out[d]     = rgba[s];
          out[d + 1] = rgba[s + 1];
          out[d + 2] = rgba[s + 2];
          out[d + 3] = 255;
        }
      }
    }
  }

  return out;
}

/* ---------------- everything, in order ---------------- */

/**
 * @param {Uint8ClampedArray} srcRgba  SIZE*SIZE*4, already cropped and resized
 * @param {string} baseName            drives the CTRL shuffle, exactly as the sketch does
 * @param {(stage:string, done:number, total:number)=>void} onProgress
 */
export function runPipeline(srcRgba, baseName, onProgress = () => {}) {
  const w = SIZE, h = SIZE;
  const step = (name, i) => onProgress(name, i, 5);

  step('blurred luminance field, RPCA', 0);
  const fieldA = buildBlurredLuminanceField(srcRgba, w, h, BLUR_A, 0);

  step('permuting pixels, RPCA', 1);
  const rpcA = permuteHistogramPerfect(srcRgba, w, h, fieldA, true);

  step('coarsened luminance field, RPCB', 2);
  const fieldB = buildBlurredLuminanceField(srcRgba, w, h, BLUR_B, B_LEVELS);

  step('permuting pixels, RPCB', 3);
  const rpcB = permuteHistogramPerfect(srcRgba, w, h, fieldB, false);

  step('tile shuffle, CTRL', 4);
  const ctrl = shuffleTilesDeterministic(srcRgba, w, h, CTRL_TILE, stableSeedFromName(baseName));

  return { SRC: srcRgba, RPC_A: rpcA, RPC_B: rpcB, CTRL: ctrl };
}
