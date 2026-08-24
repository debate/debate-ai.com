/**
 * Password gate in front of the open pipeline.
 *
 * A password-protected `.docx` arrives as an OLE/CFB compound file,
 * not a zip — without this it fell straight through the docx/native
 * dispatch to the `.cmir` parser and died with "not valid JSON". Here
 * we detect it, ask for the password (retrying on a wrong one), and
 * hand the decrypted `.docx` bytes back to the normal path.
 *
 * Every disk-open entry point routes its bytes through
 * `maybeDecryptForOpen` before the docx/native branch, so a protected
 * file is handled no matter which open path it came in on.
 */

import {
  officeEncryption,
  decryptOfficeDocument,
  WrongPasswordError,
  UnsupportedEncryptionError,
} from '../ooxml/decrypt-docx.js';
import { promptForText } from './text-prompt.js';
import { showToast } from './toast.js';

/** The user dismissed the password prompt — the open should abort
 *  silently (no error dialog), same as cancelling the file picker. */
export class OpenCancelledError extends Error {
  constructor() {
    super('open cancelled');
    this.name = 'OpenCancelledError';
  }
}

export { UnsupportedEncryptionError };

/** Two rAFs — enough for the "Decrypting…" toast to paint before the
 *  ~1s synchronous key-derivation spin blocks the main thread. */
function paintGap(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

/**
 * If `bytes` is a password-protected Office file, prompt for the
 * password and return the decrypted `.docx` bytes; otherwise return
 * `bytes` unchanged. Throws {@link OpenCancelledError} if the user
 * dismisses the prompt, and {@link UnsupportedEncryptionError} for a
 * CFB we can't decrypt (legacy binary, Standard encryption).
 */
export async function maybeDecryptForOpen(bytes: Uint8Array, filename: string): Promise<Uint8Array> {
  const enc = officeEncryption(bytes);
  if (enc === null) return bytes; // not a compound file — normal path
  if (enc.kind === 'unsupported') throw new UnsupportedEncryptionError(enc.message);

  let detail = `“${filename}” is password-protected.`;
  for (;;) {
    const pw = await promptForText({
      message: 'Enter the document password',
      detail,
      password: true,
      okLabel: 'Open',
      placeholder: 'Password',
    });
    if (pw === null) throw new OpenCancelledError();
    if (pw === '') {
      detail = 'Enter the password to open this file.';
      continue;
    }
    showToast('Decrypting…');
    await paintGap();
    try {
      return decryptOfficeDocument(bytes, pw);
    } catch (err) {
      if (err instanceof WrongPasswordError) {
        detail = 'Incorrect password — try again.';
        continue;
      }
      throw err; // unsupported scheme or a genuine structural failure
    }
  }
}
