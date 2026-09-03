/**
 * Open password-protected Office documents (ECMA-376 Agile encryption).
 *
 * A password-protected .docx is NOT a zip — it's an OLE/CFB compound
 * file (magic D0 CF 11 E0) wrapping two streams: `EncryptionInfo` (the
 * key descriptor) and `EncryptedPackage` (the AES-CBC-encrypted zip).
 * This module recognizes such files, and — given the password —
 * decrypts the package back to ordinary .docx bytes for the existing
 * importer. Decrypt-only: CardMirror never writes encryption.
 *
 * Scope: Agile encryption (EncryptionInfo version 4.4), which is what
 * modern Word/Excel/PowerPoint produce. The older "Standard" scheme
 * (ECB/binary) and legacy Office 97-2003 encryption are detected and
 * rejected with a clear message rather than mis-decrypted.
 *
 * Crypto per MS-OFFCRYPTO §2.3.4: SHA-512 key derivation with a
 * 100k-iteration spin, AES-256-CBC, package split into 4096-byte
 * segments each with IV = SHA512(keyDataSalt ‖ segmentIndex_LE). All
 * primitives are the pure-JS `sha512` / `aesCbcDecrypt` in this
 * folder, verified end-to-end against a real protected file in the
 * tests.
 */

import { XMLParser } from 'fast-xml-parser';
import { sha512 } from './sha512.js';
import { aesCbcDecrypt } from './aes.js';

/** Base class for every failure this module raises, so callers can
 *  distinguish "encrypted-file problem" (surface the message, offer
 *  the password box) from a generic open error. */
export class EncryptedOfficeError extends Error {}

/** The password did not match the file's verifier. */
export class WrongPasswordError extends EncryptedOfficeError {
  constructor() {
    super('Incorrect password.');
    this.name = 'WrongPasswordError';
  }
}

/** The file is encrypted, but with a scheme we don't decrypt. */
export class UnsupportedEncryptionError extends EncryptedOfficeError {
  constructor(detail: string) {
    super(detail);
    this.name = 'UnsupportedEncryptionError';
  }
}

const CFB_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

// Shared so the pre-open classifier and the decryptor speak with one
// voice (the classifier decides whether to even prompt for a password).
const MSG_LEGACY_BINARY =
  'This looks like an old binary Office file (.doc / .xls), which CardMirror can’t open. Open it in Word and re-save as .docx first.';
const MSG_STANDARD =
  'This file uses an older Office password scheme (Standard encryption) that CardMirror can’t open yet. Re-save it in a current version of Word, or remove the password.';
const MSG_CORRUPT = 'This file looks like a damaged Office document — CardMirror couldn’t read its structure.';

/** True if `bytes` is an OLE/CFB compound file — the container Office
 *  uses for password-encrypted documents (and, historically, for
 *  legacy .doc/.xls). A quick 8-byte magic check, no allocation. */
export function isEncryptedOfficeFile(bytes: Uint8Array): boolean {
  if (bytes.length < 8) return false;
  for (let i = 0; i < 8; i++) if (bytes[i] !== CFB_MAGIC[i]) return false;
  return true;
}

// ─── Compound File (CFB) reader ───────────────────────────────────
// Just enough to pull named streams out of the root storage. Handles
// the FAT/mini-FAT split (streams under 4096 bytes live in the
// mini-stream). No sub-storages — Office encryption puts everything
// in the root.

const END_OF_CHAIN = 0xfffffffe;
const FREE_SECT = 0xffffffff;

class CompoundFile {
  private sectorSize: number;
  private miniSectorSize: number;
  private miniCutoff: number;
  private fat: Uint32Array;
  private miniFat: Uint32Array;
  private miniStream: Uint8Array;
  private streams = new Map<string, { start: number; size: number }>();

  constructor(private data: Uint8Array) {
    const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
    this.sectorSize = 1 << dv.getUint16(30, true);
    this.miniSectorSize = 1 << dv.getUint16(32, true);
    this.miniCutoff = dv.getUint32(56, true);
    const dirStart = dv.getUint32(48, true);
    const miniFatStart = dv.getUint32(60, true);

    // FAT: assembled from the sectors listed in the DIFAT. The first
    // 109 DIFAT entries live in the header; files needing more use
    // DIFAT sectors, which no Office-encrypted doc is large enough to
    // reach (the encrypted package is one stream, MBs at most).
    const fatSectors: number[] = [];
    for (let i = 0; i < 109; i++) {
      const s = dv.getUint32(76 + i * 4, true);
      if (s !== FREE_SECT) fatSectors.push(s);
    }
    const fatBytes = new Uint8Array(fatSectors.length * this.sectorSize);
    fatSectors.forEach((s, i) => fatBytes.set(this.sector(s), i * this.sectorSize));
    this.fat = new Uint32Array(fatBytes.buffer, 0, fatBytes.length >> 2);

    // Directory chain → stream table + the root entry (whose own
    // chain backs the mini-stream).
    const dirBytes = this.readChain(dirStart, this.fat, (s) => this.sector(s));
    let rootStart = 0;
    for (let off = 0; off + 128 <= dirBytes.length; off += 128) {
      const e = new DataView(dirBytes.buffer, dirBytes.byteOffset + off, 128);
      const nameLen = e.getUint16(64, true);
      if (nameLen === 0) continue;
      let name = '';
      for (let i = 0; i < nameLen - 2; i += 2) name += String.fromCharCode(e.getUint16(i, true));
      const type = e.getUint8(66);
      const start = e.getUint32(116, true);
      const size = Number(e.getBigUint64(120, true));
      if (type === 5) rootStart = start; // root storage
      else if (type === 2) this.streams.set(name, { start, size }); // stream
    }

    const miniFatBytes = this.readChain(miniFatStart, this.fat, (s) => this.sector(s));
    this.miniFat = new Uint32Array(miniFatBytes.buffer, 0, miniFatBytes.length >> 2);
    this.miniStream = this.readChain(rootStart, this.fat, (s) => this.sector(s));
  }

  private sector(i: number): Uint8Array {
    const off = 512 + i * this.sectorSize;
    return this.data.subarray(off, off + this.sectorSize);
  }
  private miniSector(i: number): Uint8Array {
    const off = i * this.miniSectorSize;
    return this.miniStream.subarray(off, off + this.miniSectorSize);
  }

  private readChain(start: number, table: Uint32Array, read: (s: number) => Uint8Array): Uint8Array {
    const parts: Uint8Array[] = [];
    const seen = new Set<number>();
    let s = start;
    let total = 0;
    while (s !== END_OF_CHAIN && s !== FREE_SECT && s < table.length && !seen.has(s)) {
      seen.add(s);
      const chunk = read(s);
      parts.push(chunk);
      total += chunk.length;
      s = table[s]!;
    }
    const out = new Uint8Array(total);
    let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  }

  /** The named stream's bytes, or null if absent. */
  stream(name: string): Uint8Array | null {
    const e = this.streams.get(name);
    if (!e) return null;
    const raw =
      e.size < this.miniCutoff
        ? this.readChain(e.start, this.miniFat, (s) => this.miniSector(s))
        : this.readChain(e.start, this.fat, (s) => this.sector(s));
    return raw.subarray(0, e.size);
  }
}

// ─── Agile key derivation ─────────────────────────────────────────

// Fixed block keys (MS-OFFCRYPTO §2.3.4.10) that scope the derived
// key to a purpose.
const BLOCK_VERIFIER_INPUT = new Uint8Array([0xfe, 0xa7, 0xd2, 0x76, 0x3b, 0x4b, 0x9e, 0x79]);
const BLOCK_VERIFIER_VALUE = new Uint8Array([0xd7, 0xaa, 0x0f, 0x6d, 0x30, 0x61, 0x34, 0x4e]);
const BLOCK_KEY_VALUE = new Uint8Array([0x14, 0x6e, 0x0b, 0xe7, 0xab, 0xac, 0xd0, 0xd6]);

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

/** UTF-16LE of a string (the encoding Office hashes the password in). */
function utf16le(s: string): Uint8Array {
  const out = new Uint8Array(s.length * 2);
  const dv = new DataView(out.buffer);
  for (let i = 0; i < s.length; i++) dv.setUint16(i * 2, s.charCodeAt(i), true);
  return out;
}

function u32le(n: number): Uint8Array {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, n >>> 0, true);
  return out;
}

/** Derive a purpose-scoped key: H0 = SHA512(salt ‖ pwUtf16), then
 *  `spin` iterations of H = SHA512(iLE ‖ H), then SHA512(H ‖ blockKey)
 *  truncated to `keyBytes`. */
function deriveKey(password: string, salt: Uint8Array, spin: number, blockKey: Uint8Array, keyBytes: number): Uint8Array {
  let h = sha512(concat(salt, utf16le(password)));
  for (let i = 0; i < spin; i++) h = sha512(concat(u32le(i), h));
  h = sha512(concat(h, blockKey));
  return h.subarray(0, keyBytes);
}

interface AgileDescriptor {
  keyDataSalt: Uint8Array;
  keyBits: number;
  pwSalt: Uint8Array;
  spinCount: number;
  pwKeyBits: number;
  encryptedKeyValue: Uint8Array;
  encryptedVerifierHashInput: Uint8Array;
  encryptedVerifierHashValue: Uint8Array;
  hashAlgorithm: string;
  cipherAlgorithm: string;
  cipherChaining: string;
}

function b64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const attrParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseAttributeValue: false });

/** Parse the Agile EncryptionInfo XML descriptor into typed fields. */
function parseAgile(infoXml: string): AgileDescriptor {
  const root = attrParser.parse(infoXml) as Record<string, unknown>;
  const encryption = root['encryption'] as Record<string, unknown> | undefined;
  const keyData = encryption?.['keyData'] as Record<string, string> | undefined;
  // The password key encryptor is under keyEncryptors/keyEncryptor,
  // namespaced `p:encryptedKey`. fast-xml-parser keeps the raw tag
  // name including the prefix.
  const keyEncryptors = encryption?.['keyEncryptors'] as Record<string, unknown> | undefined;
  let keyEncryptor = keyEncryptors?.['keyEncryptor'] as unknown;
  if (Array.isArray(keyEncryptor)) keyEncryptor = keyEncryptor.find((k) => (k as Record<string, unknown>)['p:encryptedKey']);
  const enc = (keyEncryptor as Record<string, unknown> | undefined)?.['p:encryptedKey'] as Record<string, string> | undefined;
  if (!keyData || !enc) {
    throw new UnsupportedEncryptionError('This file uses an Office encryption scheme CardMirror can’t open (no password key found).');
  }
  const alg = keyData['cipherAlgorithm'] ?? '';
  const chain = keyData['cipherChaining'] ?? '';
  const hash = keyData['hashAlgorithm'] ?? '';
  if (alg !== 'AES' || chain !== 'ChainingModeCBC') {
    throw new UnsupportedEncryptionError(`This file uses ${alg || 'an unknown'} ${chain || ''} encryption, which CardMirror can’t open.`.replace(/\s+/g, ' ').trim() + '.');
  }
  if (!/^SHA-?512$/i.test(hash)) {
    throw new UnsupportedEncryptionError(`This file uses ${hash || 'an unsupported'} password hashing, which CardMirror can’t open.`);
  }
  return {
    keyDataSalt: b64(keyData['saltValue']!),
    keyBits: parseInt(keyData['keyBits']!, 10),
    pwSalt: b64(enc['saltValue']!),
    spinCount: parseInt(enc['spinCount']!, 10),
    pwKeyBits: parseInt(enc['keyBits']!, 10),
    encryptedKeyValue: b64(enc['encryptedKeyValue']!),
    encryptedVerifierHashInput: b64(enc['encryptedVerifierHashInput']!),
    encryptedVerifierHashValue: b64(enc['encryptedVerifierHashValue']!),
    hashAlgorithm: hash,
    cipherAlgorithm: alg,
    cipherChaining: chain,
  };
}

/** Constant-time-ish compare of the first `n` bytes. Not a security
 *  boundary here (it's local file open), just correctness. */
function bytesEqual(a: Uint8Array, b: Uint8Array, n: number): boolean {
  if (a.length < n || b.length < n) return false;
  let diff = 0;
  for (let i = 0; i < n; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

export type OfficeEncryptionInfo =
  | { kind: 'agile' }
  | { kind: 'unsupported'; message: string };

/**
 * Classify a compound-file Office container WITHOUT deriving any keys,
 * so the caller can decide whether to prompt for a password at all
 * (a non-encrypted legacy `.doc` is a CFB too, and shouldn't get a
 * password box). Returns null when `bytes` isn't a compound file.
 */
export function officeEncryption(bytes: Uint8Array): OfficeEncryptionInfo | null {
  if (!isEncryptedOfficeFile(bytes)) return null;
  let cfb: CompoundFile;
  try {
    cfb = new CompoundFile(bytes);
  } catch {
    return { kind: 'unsupported', message: MSG_CORRUPT };
  }
  const info = cfb.stream('EncryptionInfo');
  const pkg = cfb.stream('EncryptedPackage');
  if (!info || !pkg) return { kind: 'unsupported', message: MSG_LEGACY_BINARY };
  const version = new DataView(info.buffer, info.byteOffset).getUint32(0, true);
  const major = version & 0xffff;
  const minor = (version >>> 16) & 0xffff;
  if (major !== 4 || minor !== 4) return { kind: 'unsupported', message: MSG_STANDARD };
  return { kind: 'agile' };
}

/**
 * Decrypt a password-protected Office file to its inner package bytes
 * (a normal zip / .docx). Throws {@link WrongPasswordError} on a bad
 * password and {@link UnsupportedEncryptionError} for schemes we don't
 * handle; the caller decides how to surface each.
 */
export function decryptOfficeDocument(bytes: Uint8Array, password: string): Uint8Array {
  const cfb = new CompoundFile(bytes);
  const info = cfb.stream('EncryptionInfo');
  const pkg = cfb.stream('EncryptedPackage');
  if (!info || !pkg) throw new UnsupportedEncryptionError(MSG_LEGACY_BINARY);
  const version = new DataView(info.buffer, info.byteOffset).getUint32(0, true);
  // Agile is version 4.4 → (major 4, minor 4) → 0x00040004 little-end.
  const major = version & 0xffff;
  const minor = (version >>> 16) & 0xffff;
  if (major !== 4 || minor !== 4) throw new UnsupportedEncryptionError(MSG_STANDARD);

  const xml = new TextDecoder().decode(info.subarray(8));
  const d = parseAgile(xml);
  const keyBytes = d.pwKeyBits / 8;
  const ivLen = 16; // AES block size

  // Verify the password before doing the expensive package decrypt.
  const inputKey = deriveKey(password, d.pwSalt, d.spinCount, BLOCK_VERIFIER_INPUT, keyBytes);
  const valueKey = deriveKey(password, d.pwSalt, d.spinCount, BLOCK_VERIFIER_VALUE, keyBytes);
  const iv0 = d.pwSalt.subarray(0, ivLen);
  const verifierInput = aesCbcDecrypt(inputKey, iv0, d.encryptedVerifierHashInput);
  const verifierValue = aesCbcDecrypt(valueKey, iv0, d.encryptedVerifierHashValue);
  const expected = sha512(verifierInput);
  if (!bytesEqual(expected, verifierValue, 64)) throw new WrongPasswordError();

  // Recover the package's secret key, then decrypt the package.
  const keyValueKey = deriveKey(password, d.pwSalt, d.spinCount, BLOCK_KEY_VALUE, keyBytes);
  const secret = aesCbcDecrypt(keyValueKey, iv0, d.encryptedKeyValue).subarray(0, d.keyBits / 8);

  const totalSize = Number(new DataView(pkg.buffer, pkg.byteOffset).getBigUint64(0, true));
  const cipher = pkg.subarray(8);
  const out = new Uint8Array(cipher.length);
  const SEG = 4096;
  for (let i = 0, off = 0; off < cipher.length; i++, off += SEG) {
    const iv = sha512(concat(d.keyDataSalt, u32le(i))).subarray(0, ivLen);
    const seg = cipher.subarray(off, off + SEG);
    out.set(aesCbcDecrypt(secret, iv, seg), off);
  }
  return out.subarray(0, totalSize);
}
