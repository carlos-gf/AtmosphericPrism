// java.util.Random and the generator sketch's filename hash, ported so that the
// tile shuffle in the browser lands on exactly the same arrangement as the
// desktop sketch for the same file name.

const MULT = 0x5DEECE66Dn;
const ADD  = 0xBn;
const MASK = (1n << 48n) - 1n;

export class JavaRandom {
  constructor(seed) {
    this.seed = (BigInt(seed) ^ MULT) & MASK;
  }

  next(bits) {
    this.seed = (this.seed * MULT + ADD) & MASK;
    // Java returns a signed int from the top bits; for bits <= 31 it is positive.
    return Number(this.seed >> BigInt(48 - bits));
  }

  nextInt(bound) {
    if ((bound & -bound) === bound) {
      // power of two
      return Number((BigInt(bound) * BigInt(this.next(31))) >> 31n);
    }

    let bits, val;
    do {
      bits = this.next(31);
      val = bits % bound;
    } while (bits - val + (bound - 1) > 2147483647);

    return val;
  }
}

/**
 * The generator sketch's stableSeedFromName: a Java string hash, then abs.
 * Java int arithmetic wraps, so the |0 matters.
 */
export function stableSeedFromName(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (Math.imul(31, h) + name.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Strips a file extension, like the sketch's fileBaseName. */
export function fileBaseName(filename) {
  const dot = filename.lastIndexOf('.');
  return dot > 0 ? filename.substring(0, dot) : filename;
}
