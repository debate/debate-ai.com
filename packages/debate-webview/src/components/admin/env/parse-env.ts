/**
 * @fileoverview Parses pasted `.env`-style text into variable entries:
 * `KEY=value`, `export KEY=value`, `#` comment lines, single- and double-quoted
 * values (double quotes honour `\n`, and a quote left open continues onto the
 * next lines, as private keys need), and ` # comment` after an unquoted value.
 */

export interface ParsedEnv {
  entries: Array<{ name: string; value: string }>;
  /** Lines that were skipped, with why. */
  errors: string[];
}

const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function parseEnvText(text: string): ParsedEnv {
  const entries = new Map<string, string>();
  const errors: string[] = [];
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^(?:export\s+)?([^=\s]+)\s*=\s*(.*)$/.exec(line);
    if (!match) {
      errors.push(`Line ${i + 1}: expected NAME=value.`);
      continue;
    }
    const [, name, rest] = match;
    if (!NAME.test(name)) {
      errors.push(`Line ${i + 1}: "${name}" is not a valid variable name.`);
      continue;
    }
    let value = rest;
    const quote = rest[0] === '"' || rest[0] === "'" ? rest[0] : null;
    if (quote) {
      let body = rest.slice(1);
      let end = body.indexOf(quote);
      while (end === -1 && i + 1 < lines.length) {
        body += `\n${lines[++i]}`;
        end = body.indexOf(quote);
      }
      if (end === -1) {
        errors.push(`Line ${i + 1}: unterminated quote for ${name}.`);
        continue;
      }
      value = body.slice(0, end);
      if (quote === '"') value = value.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    } else {
      value = rest.replace(/\s+#.*$/, "").trim();
    }
    entries.set(name, value);
  }
  return { entries: [...entries].map(([name, value]) => ({ name, value })), errors };
}
