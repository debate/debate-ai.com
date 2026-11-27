/**
 * @fileoverview A small JSONC reader for `wrangler.jsonc`: strips comments
 * and trailing commas outside string literals, then `JSON.parse`s.
 */

export function parseJsonc(text: string): unknown {
  let out = "";
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') j += text[j] === "\\" ? 2 : 1;
      out += text.slice(i, j + 1);
      i = j + 1;
    } else if (ch === "/" && next === "/") {
      while (i < text.length && text[i] !== "\n") i++;
    } else if (ch === "/" && next === "*") {
      const end = text.indexOf("*/", i + 2);
      i = end === -1 ? text.length : end + 2;
    } else {
      out += ch;
      i++;
    }
  }
  return JSON.parse(stripTrailingCommas(out));
}

function stripTrailingCommas(json: string): string {
  let out = "";
  let i = 0;
  while (i < json.length) {
    const ch = json[i];
    if (ch === '"') {
      let j = i + 1;
      while (j < json.length && json[j] !== '"') j += json[j] === "\\" ? 2 : 1;
      out += json.slice(i, j + 1);
      i = j + 1;
    } else if (ch === ",") {
      let j = i + 1;
      while (j < json.length && /\s/.test(json[j])) j++;
      if (json[j] === "}" || json[j] === "]") i++;
      else {
        out += ch;
        i++;
      }
    } else {
      out += ch;
      i++;
    }
  }
  return out;
}

export interface WranglerInfo {
  path: string;
  name: string | null;
  /** `keep_vars`: dashboard vars survive `wrangler deploy` only when true. */
  keepVars: boolean;
  /** Names under the top-level `vars`, which `wrangler deploy` writes over API-set values. */
  varNames: string[];
}

/** What matters about a wrangler config for env var management. Throws on invalid JSONC. */
export function readWranglerInfo(path: string, text: string): WranglerInfo {
  const config = parseJsonc(text) as Record<string, unknown> | null;
  const vars = config && typeof config.vars === "object" && config.vars ? (config.vars as Record<string, unknown>) : {};
  return {
    path,
    name: typeof config?.name === "string" ? config.name : null,
    keepVars: config?.keep_vars === true,
    varNames: Object.keys(vars),
  };
}
