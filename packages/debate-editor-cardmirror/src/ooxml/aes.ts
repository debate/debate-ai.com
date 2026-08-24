/**
 * Synchronous AES-CBC DECRYPTION (128/192/256-bit keys).
 *
 * Decrypt-only on purpose: CardMirror opens password-protected Office
 * files but never writes encryption, so there is no cipher/encrypt
 * path here. Pure-JS (not Web Crypto) for the same reasons as
 * `sha512.ts` — portability across renderer / browser / node, and
 * because Web Crypto's AES-CBC mandates PKCS7 padding, which the raw
 * fixed-block CBC that Office uses does not have.
 *
 * Standard byte-oriented inverse cipher (FIPS-197 §5.3) with
 * precomputed GF(2^8) multiply tables for InvMixColumns. Verified in
 * the tests against the FIPS-197 AES-256 known-answer vector and the
 * NIST SP 800-38A CBC vectors.
 */

// prettier-ignore
const SBOX = new Uint8Array([
  0x63,0x7c,0x77,0x7b,0xf2,0x6b,0x6f,0xc5,0x30,0x01,0x67,0x2b,0xfe,0xd7,0xab,0x76,
  0xca,0x82,0xc9,0x7d,0xfa,0x59,0x47,0xf0,0xad,0xd4,0xa2,0xaf,0x9c,0xa4,0x72,0xc0,
  0xb7,0xfd,0x93,0x26,0x36,0x3f,0xf7,0xcc,0x34,0xa5,0xe5,0xf1,0x71,0xd8,0x31,0x15,
  0x04,0xc7,0x23,0xc3,0x18,0x96,0x05,0x9a,0x07,0x12,0x80,0xe2,0xeb,0x27,0xb2,0x75,
  0x09,0x83,0x2c,0x1a,0x1b,0x6e,0x5a,0xa0,0x52,0x3b,0xd6,0xb3,0x29,0xe3,0x2f,0x84,
  0x53,0xd1,0x00,0xed,0x20,0xfc,0xb1,0x5b,0x6a,0xcb,0xbe,0x39,0x4a,0x4c,0x58,0xcf,
  0xd0,0xef,0xaa,0xfb,0x43,0x4d,0x33,0x85,0x45,0xf9,0x02,0x7f,0x50,0x3c,0x9f,0xa8,
  0x51,0xa3,0x40,0x8f,0x92,0x9d,0x38,0xf5,0xbc,0xb6,0xda,0x21,0x10,0xff,0xf3,0xd2,
  0xcd,0x0c,0x13,0xec,0x5f,0x97,0x44,0x17,0xc4,0xa7,0x7e,0x3d,0x64,0x5d,0x19,0x73,
  0x60,0x81,0x4f,0xdc,0x22,0x2a,0x90,0x88,0x46,0xee,0xb8,0x14,0xde,0x5e,0x0b,0xdb,
  0xe0,0x32,0x3a,0x0a,0x49,0x06,0x24,0x5c,0xc2,0xd3,0xac,0x62,0x91,0x95,0xe4,0x79,
  0xe7,0xc8,0x37,0x6d,0x8d,0xd5,0x4e,0xa9,0x6c,0x56,0xf4,0xea,0x65,0x7a,0xae,0x08,
  0xba,0x78,0x25,0x2e,0x1c,0xa6,0xb4,0xc6,0xe8,0xdd,0x74,0x1f,0x4b,0xbd,0x8b,0x8a,
  0x70,0x3e,0xb5,0x66,0x48,0x03,0xf6,0x0e,0x61,0x35,0x57,0xb9,0x86,0xc1,0x1d,0x9e,
  0xe1,0xf8,0x98,0x11,0x69,0xd9,0x8e,0x94,0x9b,0x1e,0x87,0xe9,0xce,0x55,0x28,0xdf,
  0x8c,0xa1,0x89,0x0d,0xbf,0xe6,0x42,0x68,0x41,0x99,0x2d,0x0f,0xb0,0x54,0xbb,0x16,
]);
const RCON = new Uint8Array([0x01,0x02,0x04,0x08,0x10,0x20,0x40,0x80,0x1b,0x36,0x6c,0xd8,0xab,0x4d]);

const INV_SBOX = new Uint8Array(256);
for (let i = 0; i < 256; i++) INV_SBOX[SBOX[i]!] = i;

/** GF(2^8) multiply, used to build the InvMixColumns tables. */
function gmul(a: number, b: number): number {
  let p = 0;
  for (let i = 0; i < 8; i++) {
    if (b & 1) p ^= a;
    const hi = a & 0x80;
    a = (a << 1) & 0xff;
    if (hi) a ^= 0x1b;
    b >>= 1;
  }
  return p;
}
const M9 = new Uint8Array(256), M11 = new Uint8Array(256), M13 = new Uint8Array(256), M14 = new Uint8Array(256);
for (let i = 0; i < 256; i++) {
  M9[i] = gmul(i, 9); M11[i] = gmul(i, 11); M13[i] = gmul(i, 13); M14[i] = gmul(i, 14);
}

/** Expand a 16/24/32-byte key into the round-key schedule (one byte
 *  per entry, `4 * (Nr + 1)` words). */
function expandKey(key: Uint8Array): { rk: Uint8Array; rounds: number } {
  const Nk = key.length / 4;
  const Nr = Nk + 6;
  const total = 4 * (Nr + 1); // words
  const w = new Uint8Array(total * 4);
  w.set(key);
  const t = new Uint8Array(4);
  for (let i = Nk; i < total; i++) {
    const p = (i - 1) * 4;
    t[0] = w[p]!; t[1] = w[p + 1]!; t[2] = w[p + 2]!; t[3] = w[p + 3]!;
    if (i % Nk === 0) {
      // RotWord + SubWord + Rcon
      const tmp = t[0]!;
      t[0] = SBOX[t[1]!]! ^ RCON[i / Nk - 1]!;
      t[1] = SBOX[t[2]!]!;
      t[2] = SBOX[t[3]!]!;
      t[3] = SBOX[tmp]!;
    } else if (Nk > 6 && i % Nk === 4) {
      // SubWord (AES-256 extra step)
      t[0] = SBOX[t[0]!]!; t[1] = SBOX[t[1]!]!; t[2] = SBOX[t[2]!]!; t[3] = SBOX[t[3]!]!;
    }
    const q = (i - Nk) * 4;
    w[i * 4] = w[q]! ^ t[0]!;
    w[i * 4 + 1] = w[q + 1]! ^ t[1]!;
    w[i * 4 + 2] = w[q + 2]! ^ t[2]!;
    w[i * 4 + 3] = w[q + 3]! ^ t[3]!;
  }
  return { rk: w, rounds: Nr };
}

/** Decrypt one 16-byte block in place-ish, writing to `out`. */
function decryptBlock(s: Uint8Array, rk: Uint8Array, Nr: number, out: Uint8Array): void {
  // AddRoundKey(Nr)
  for (let i = 0; i < 16; i++) s[i] = s[i]! ^ rk[Nr * 16 + i]!;
  for (let round = Nr - 1; round >= 1; round--) {
    invShiftRowsSubBytes(s);
    for (let i = 0; i < 16; i++) s[i] = s[i]! ^ rk[round * 16 + i]!;
    invMixColumns(s);
  }
  invShiftRowsSubBytes(s);
  for (let i = 0; i < 16; i++) out[i] = s[i]! ^ rk[i]!;
}

/** InvShiftRows followed by InvSubBytes (order-independent, fused). */
function invShiftRowsSubBytes(s: Uint8Array): void {
  // State is column-major: byte index = row + 4*col.
  // InvShiftRows: row r cyclically shifts RIGHT by r.
  const t = s.slice();
  // row 0: no shift
  s[0] = INV_SBOX[t[0]!]!; s[4] = INV_SBOX[t[4]!]!; s[8] = INV_SBOX[t[8]!]!; s[12] = INV_SBOX[t[12]!]!;
  // row 1: right by 1
  s[1] = INV_SBOX[t[13]!]!; s[5] = INV_SBOX[t[1]!]!; s[9] = INV_SBOX[t[5]!]!; s[13] = INV_SBOX[t[9]!]!;
  // row 2: right by 2
  s[2] = INV_SBOX[t[10]!]!; s[6] = INV_SBOX[t[14]!]!; s[10] = INV_SBOX[t[2]!]!; s[14] = INV_SBOX[t[6]!]!;
  // row 3: right by 3
  s[3] = INV_SBOX[t[7]!]!; s[7] = INV_SBOX[t[11]!]!; s[11] = INV_SBOX[t[15]!]!; s[15] = INV_SBOX[t[3]!]!;
}

function invMixColumns(s: Uint8Array): void {
  for (let c = 0; c < 4; c++) {
    const i = c * 4;
    const a0 = s[i]!, a1 = s[i + 1]!, a2 = s[i + 2]!, a3 = s[i + 3]!;
    s[i]     = M14[a0]! ^ M11[a1]! ^ M13[a2]! ^ M9[a3]!;
    s[i + 1] = M9[a0]! ^ M14[a1]! ^ M11[a2]! ^ M13[a3]!;
    s[i + 2] = M13[a0]! ^ M9[a1]! ^ M14[a2]! ^ M11[a3]!;
    s[i + 3] = M11[a0]! ^ M13[a1]! ^ M9[a2]! ^ M14[a3]!;
  }
}

/** AES-CBC decrypt `data` (a whole number of 16-byte blocks) with no
 *  padding removal — the caller owns any trailing structure. */
export function aesCbcDecrypt(key: Uint8Array, iv: Uint8Array, data: Uint8Array): Uint8Array {
  if (data.length % 16 !== 0) throw new Error('AES-CBC: input not a multiple of 16 bytes');
  const { rk, rounds } = expandKey(key);
  const out = new Uint8Array(data.length);
  const block = new Uint8Array(16);
  const dec = new Uint8Array(16);
  let prev = iv;
  for (let off = 0; off < data.length; off += 16) {
    block.set(data.subarray(off, off + 16));
    decryptBlock(block, rk, rounds, dec);
    for (let i = 0; i < 16; i++) out[off + i] = dec[i]! ^ prev[i]!;
    prev = data.subarray(off, off + 16);
  }
  return out;
}
