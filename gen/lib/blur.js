// Exact port of Processing's PImage.filter(BLUR, r).
//
// This is not a Gaussian and it is not the CSS/canvas blur. Processing builds a
// parabolic kernel of half-width floor(r * 3.5), applies it separably, and
// truncates with integer division on each pass. The blurred luminance field is
// what decides where every pixel lands in RPCA and RPCB, so matching it exactly
// is what makes the browser output the same method as the study, rather than
// something that merely looks similar.
//
// Reference: processing.core.PImage#buildBlurKernel and #blurRGB.

let cached = null;

export function buildBlurKernel(r) {
  let radius = Math.trunc(r * 3.5);
  radius = radius < 1 ? 1 : (radius < 248 ? radius : 248);

  if (cached && cached.radius === radius) return cached;

  const size = 1 + (radius << 1);
  const kernel = new Int32Array(size);

  // kernel[radius ± i] = (radius - i)^2
  for (let i = 1, ri = radius - 1; i < radius; i++, ri--) {
    kernel[radius + i] = kernel[ri] = ri * ri;
  }
  kernel[radius] = radius * radius;

  cached = { radius, size, kernel };
  return cached;
}

/**
 * Blur one 8-bit channel. Processing blurs R, G and B independently; the field
 * is built from a greyscale copy where all three are equal, so one channel is
 * enough and gives an identical result for a third of the work.
 *
 * @param {Uint8Array|Uint8ClampedArray} src  w*h samples, 0..255
 * @returns {Uint8Array} blurred, 0..255
 */
export function blurChannel(src, w, h, r) {
  const { radius, size, kernel } = buildBlurKernel(r);

  const mid = new Uint8Array(w * h);
  const out = new Uint8Array(w * h);

  // ---- horizontal pass ----
  for (let y = 0, yi = 0; y < h; y++, yi += w) {
    for (let x = 0; x < w; x++) {
      let acc = 0, sum = 0;
      let read = x - radius;
      let bk0 = 0;

      if (read < 0) { bk0 = -read; read = 0; }

      for (let i = bk0; i < size; i++) {
        if (read >= w) break;
        const k = kernel[i];
        acc += k * src[read + yi];
        sum += k;
        read++;
      }

      mid[yi + x] = (acc / sum) | 0;   // Processing truncates here
    }
  }

  // ---- vertical pass ----
  let yi = 0;
  let ym = -radius;
  let ymi = ym * w;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let acc = 0, sum = 0;
      let bk0, ri, read;

      if (ym < 0) { bk0 = ri = -ym; read = x; }
      else { if (ym >= h) break; bk0 = 0; ri = ym; read = x + ymi; }

      for (let i = bk0; i < size; i++) {
        if (ri >= h) break;
        const k = kernel[i];
        acc += k * mid[read];
        sum += k;
        ri++;
        read += w;
      }

      out[x + yi] = (acc / sum) | 0;
    }

    yi += w;
    ymi += w;
    ym++;
  }

  return out;
}
