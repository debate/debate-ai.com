/**
 * Base64 helpers for embedding image bytes in schema attrs.
 *
 * Works in browsers (Vite app) and Node (Vitest) using the cross-
 * platform `btoa` / `atob` globals. Converts to/from a binary string
 * in chunks so large images don't blow the spread-args stack limit.
 */

const CHUNK = 32_768;

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, i + CHUNK);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
