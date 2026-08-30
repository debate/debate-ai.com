/**
 * Synchronous SHA-512 over byte arrays.
 *
 * Hand-rolled (not Web Crypto) for two reasons the office-decryption
 * path forces: the Agile key derivation iterates the hash 100,000
 * times SEQUENTIALLY, where `await crypto.subtle.digest` per round
 * would drown in microtask overhead; and the same code must run in
 * the renderer, the browser, and the node test env with no host
 * crypto assumptions — the fflate-over-node:zlib stance applied to
 * hashing.
 *
 * 64-bit words are carried as (hi, lo) 32-bit halves. The compression
 * accumulates each addend's low half in a JS double (a sum of a
 * handful of 32-bit values stays inside the 53-bit safe-integer
 * range) and folds the overflow into the high half — the standard
 * no-BigInt SHA-512 trick.
 *
 * Verified against the FIPS 180-4 vectors in the tests.
 */

// SHA-512 round constants: 80 × 64-bit, as (hi, lo) pairs.
// prettier-ignore
const K = new Uint32Array([
  0x428a2f98, 0xd728ae22, 0x71374491, 0x23ef65cd, 0xb5c0fbcf, 0xec4d3b2f, 0xe9b5dba5, 0x8189dbbc,
  0x3956c25b, 0xf348b538, 0x59f111f1, 0xb605d019, 0x923f82a4, 0xaf194f9b, 0xab1c5ed5, 0xda6d8118,
  0xd807aa98, 0xa3030242, 0x12835b01, 0x45706fbe, 0x243185be, 0x4ee4b28c, 0x550c7dc3, 0xd5ffb4e2,
  0x72be5d74, 0xf27b896f, 0x80deb1fe, 0x3b1696b1, 0x9bdc06a7, 0x25c71235, 0xc19bf174, 0xcf692694,
  0xe49b69c1, 0x9ef14ad2, 0xefbe4786, 0x384f25e3, 0x0fc19dc6, 0x8b8cd5b5, 0x240ca1cc, 0x77ac9c65,
  0x2de92c6f, 0x592b0275, 0x4a7484aa, 0x6ea6e483, 0x5cb0a9dc, 0xbd41fbd4, 0x76f988da, 0x831153b5,
  0x983e5152, 0xee66dfab, 0xa831c66d, 0x2db43210, 0xb00327c8, 0x98fb213f, 0xbf597fc7, 0xbeef0ee4,
  0xc6e00bf3, 0x3da88fc2, 0xd5a79147, 0x930aa725, 0x06ca6351, 0xe003826f, 0x14292967, 0x0a0e6e70,
  0x27b70a85, 0x46d22ffc, 0x2e1b2138, 0x5c26c926, 0x4d2c6dfc, 0x5ac42aed, 0x53380d13, 0x9d95b3df,
  0x650a7354, 0x8baf63de, 0x766a0abb, 0x3c77b2a8, 0x81c2c92e, 0x47edaee6, 0x92722c85, 0x1482353b,
  0xa2bfe8a1, 0x4cf10364, 0xa81a664b, 0xbc423001, 0xc24b8b70, 0xd0f89791, 0xc76c51a3, 0x0654be30,
  0xd192e819, 0xd6ef5218, 0xd6990624, 0x5565a910, 0xf40e3585, 0x5771202a, 0x106aa070, 0x32bbd1b8,
  0x19a4c116, 0xb8d2d0c8, 0x1e376c08, 0x5141ab53, 0x2748774c, 0xdf8eeb99, 0x34b0bcb5, 0xe19b48a8,
  0x391c0cb3, 0xc5c95a63, 0x4ed8aa4a, 0xe3418acb, 0x5b9cca4f, 0x7763e373, 0x682e6ff3, 0xd6b2b8a3,
  0x748f82ee, 0x5defb2fc, 0x78a5636f, 0x43172f60, 0x84c87814, 0xa1f0ab72, 0x8cc70208, 0x1a6439ec,
  0x90befffa, 0x23631e28, 0xa4506ceb, 0xde82bde9, 0xbef9a3f7, 0xb2c67915, 0xc67178f2, 0xe372532b,
  0xca273ece, 0xea26619c, 0xd186b8c7, 0x21c0c207, 0xeada7dd6, 0xcde0eb1e, 0xf57d4f7f, 0xee6ed178,
  0x06f067aa, 0x72176fba, 0x0a637dc5, 0xa2c898a6, 0x113f9804, 0xbef90dae, 0x1b710b35, 0x131c471b,
  0x28db77f5, 0x23047d84, 0x32caab7b, 0x40c72493, 0x3c9ebe0a, 0x15c9bebc, 0x431d67c4, 0x9c100d4c,
  0x4cc5d4be, 0xcb3e42b6, 0x597f299c, 0xfc657e2a, 0x5fcb6fab, 0x3ad6faec, 0x6c44198c, 0x4a475817,
]);

/** SHA-512 digest of `msg`, returned as 64 bytes. */
export function sha512(msg: Uint8Array): Uint8Array {
  // Working hash H0..H7 as (hi, lo) pairs — the FIPS 180-4 IVs.
  let h0h = 0x6a09e667, h0l = 0xf3bcc908;
  let h1h = 0xbb67ae85, h1l = 0x84caa73b;
  let h2h = 0x3c6ef372, h2l = 0xfe94f82b;
  let h3h = 0xa54ff53a, h3l = 0x5f1d36f1;
  let h4h = 0x510e527f, h4l = 0xade682d1;
  let h5h = 0x9b05688c, h5l = 0x2b3e6c1f;
  let h6h = 0x1f83d9ab, h6l = 0xfb41bd6b;
  let h7h = 0x5be0cd19, h7l = 0x137e2179;

  // Padding: append 0x80, then zeros, then the 128-bit big-endian
  // bit length, to a multiple of 128 bytes.
  const bitLenLo = msg.length * 8;
  const padded = new Uint8Array(((msg.length + 16) >> 7 << 7) + 128);
  padded.set(msg);
  padded[msg.length] = 0x80;
  // Only the low 64 bits of the length are meaningful for any doc we
  // will ever hash; the high 64 bits stay zero.
  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 4, bitLenLo >>> 0);
  dv.setUint32(padded.length - 8, Math.floor(bitLenLo / 0x100000000) >>> 0);

  const wh = new Int32Array(80);
  const wl = new Int32Array(80);

  for (let off = 0; off < padded.length; off += 128) {
    for (let i = 0; i < 16; i++) {
      wh[i] = dv.getInt32(off + i * 8);
      wl[i] = dv.getInt32(off + i * 8 + 4);
    }
    for (let i = 16; i < 80; i++) {
      // s0 = ror(w[i-15],1) ^ ror(w[i-15],8) ^ shr(w[i-15],7)
      let xh = wh[i - 15]!, xl = wl[i - 15]!;
      const s0h = ((xh >>> 1) | (xl << 31)) ^ ((xh >>> 8) | (xl << 24)) ^ (xh >>> 7);
      const s0l = ((xl >>> 1) | (xh << 31)) ^ ((xl >>> 8) | (xh << 24)) ^ ((xl >>> 7) | (xh << 25));
      // s1 = ror(w[i-2],19) ^ ror(w[i-2],61) ^ shr(w[i-2],6)
      xh = wh[i - 2]!; xl = wl[i - 2]!;
      const s1h = ((xh >>> 19) | (xl << 13)) ^ ((xl >>> 29) | (xh << 3)) ^ (xh >>> 6);
      const s1l = ((xl >>> 19) | (xh << 13)) ^ ((xh >>> 29) | (xl << 3)) ^ ((xl >>> 6) | (xh << 26));

      const i7l = wl[i - 7]!, i16l = wl[i - 16]!;
      let lo = (s0l >>> 0) + (s1l >>> 0) + (i7l >>> 0) + (i16l >>> 0);
      let hi = (s0h | 0) + (s1h | 0) + (wh[i - 7]! | 0) + (wh[i - 16]! | 0) + Math.floor(lo / 0x100000000);
      wl[i] = lo | 0;
      wh[i] = hi | 0;
    }

    let ah = h0h, al = h0l, bh = h1h, bl = h1l, ch = h2h, cl = h2l, dh = h3h, dl = h3l;
    let eh = h4h, el = h4l, fh = h5h, fl = h5l, gh = h6h, gl = h6l, hh = h7h, hl = h7l;

    for (let i = 0; i < 80; i++) {
      // Σ1(e) = ror(e,14) ^ ror(e,18) ^ ror(e,41)
      const S1h = ((eh >>> 14) | (el << 18)) ^ ((eh >>> 18) | (el << 14)) ^ ((el >>> 9) | (eh << 23));
      const S1l = ((el >>> 14) | (eh << 18)) ^ ((el >>> 18) | (eh << 14)) ^ ((eh >>> 9) | (el << 23));
      // Ch(e,f,g) = (e & f) ^ (~e & g)
      const chh = (eh & fh) ^ (~eh & gh);
      const chl = (el & fl) ^ (~el & gl);
      // Σ0(a) = ror(a,28) ^ ror(a,34) ^ ror(a,39)
      const S0h = ((ah >>> 28) | (al << 4)) ^ ((al >>> 2) | (ah << 30)) ^ ((al >>> 7) | (ah << 25));
      const S0l = ((al >>> 28) | (ah << 4)) ^ ((ah >>> 2) | (al << 30)) ^ ((ah >>> 7) | (al << 25));
      // Maj(a,b,c)
      const majh = (ah & bh) ^ (ah & ch) ^ (bh & ch);
      const majl = (al & bl) ^ (al & cl) ^ (bl & cl);

      // T1 = h + Σ1 + Ch + K[i] + W[i]
      let t1l = (hl >>> 0) + (S1l >>> 0) + (chl >>> 0) + (K[i * 2 + 1]! >>> 0) + (wl[i]! >>> 0);
      let t1h = (hh | 0) + (S1h | 0) + (chh | 0) + (K[i * 2]! | 0) + (wh[i]! | 0) + Math.floor(t1l / 0x100000000);
      t1l = t1l >>> 0;
      // T2 = Σ0 + Maj
      let t2l = (S0l >>> 0) + (majl >>> 0);
      let t2h = (S0h | 0) + (majh | 0) + Math.floor(t2l / 0x100000000);
      t2l = t2l >>> 0;

      hh = gh; hl = gl;
      gh = fh; gl = fl;
      fh = eh; fl = el;
      // d + T1
      let dl2 = (dl >>> 0) + t1l;
      eh = (dh | 0) + (t1h | 0) + Math.floor(dl2 / 0x100000000) | 0;
      el = dl2 | 0;
      dh = ch; dl = cl;
      ch = bh; cl = bl;
      bh = ah; bl = al;
      // T1 + T2
      let al2 = (t1l >>> 0) + t2l;
      ah = (t1h | 0) + (t2h | 0) + Math.floor(al2 / 0x100000000) | 0;
      al = al2 | 0;
    }

    // Fold the block into the running hash.
    let x = (h0l >>> 0) + (al >>> 0); h0l = x | 0; h0h = (h0h + ah + Math.floor(x / 0x100000000)) | 0;
    x = (h1l >>> 0) + (bl >>> 0); h1l = x | 0; h1h = (h1h + bh + Math.floor(x / 0x100000000)) | 0;
    x = (h2l >>> 0) + (cl >>> 0); h2l = x | 0; h2h = (h2h + ch + Math.floor(x / 0x100000000)) | 0;
    x = (h3l >>> 0) + (dl >>> 0); h3l = x | 0; h3h = (h3h + dh + Math.floor(x / 0x100000000)) | 0;
    x = (h4l >>> 0) + (el >>> 0); h4l = x | 0; h4h = (h4h + eh + Math.floor(x / 0x100000000)) | 0;
    x = (h5l >>> 0) + (fl >>> 0); h5l = x | 0; h5h = (h5h + fh + Math.floor(x / 0x100000000)) | 0;
    x = (h6l >>> 0) + (gl >>> 0); h6l = x | 0; h6h = (h6h + gh + Math.floor(x / 0x100000000)) | 0;
    x = (h7l >>> 0) + (hl >>> 0); h7l = x | 0; h7h = (h7h + hh + Math.floor(x / 0x100000000)) | 0;
  }

  const out = new Uint8Array(64);
  const odv = new DataView(out.buffer);
  const words = [h0h, h0l, h1h, h1l, h2h, h2l, h3h, h3l, h4h, h4l, h5h, h5l, h6h, h6l, h7h, h7l];
  for (let i = 0; i < 16; i++) odv.setUint32(i * 4, words[i]! >>> 0);
  return out;
}
