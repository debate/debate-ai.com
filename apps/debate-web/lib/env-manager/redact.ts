/**
 * @fileoverview Keeps credentials out of errors, logs and audit rows. Every
 * message that leaves the env manager (to the browser, `console` or D1) goes
 * through `redact`, which blanks the secrets it was told about and anything
 * shaped like a Cloudflare or GitHub token.
 */

const TOKEN_SHAPES = [
  /\bgithub_pat_[A-Za-z0-9_]{20,}/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}/g,
  /\b(Bearer|token)\s+[A-Za-z0-9._~+/=-]{16,}/gi,
  /\bcfut_[A-Za-z0-9]{20,}/g,
  /\bcfat_[A-Za-z0-9]{20,}/g,
];

export function redact(text: unknown, secrets: Array<string | null | undefined> = []): string {
  let out = typeof text === "string" ? text : text instanceof Error ? text.message : String(text ?? "");
  for (const secret of secrets) {
    if (secret && secret.length >= 4) out = out.split(secret).join("[redacted]");
  }
  for (const shape of TOKEN_SHAPES) out = out.replace(shape, (match) => (/^(bearer|token)\s/i.test(match) ? `${match.split(/\s/)[0]} [redacted]` : "[redacted]"));
  return out.length > 500 ? `${out.slice(0, 500)}…` : out;
}

/** Last four characters, the only part of a saved token the panel may show. */
export function tail(secret: string): string {
  return secret.length > 8 ? secret.slice(-4) : "";
}
