/**
 * cardmirror-read — MCP server mode.
 *
 * A minimal Model Context Protocol server (tools-only, stdio
 * transport: newline-delimited JSON-RPC 2.0) so MCP-capable assistants
 * can list and read `.cmir`/`.docx` files on demand — no pre-rendered
 * mirror needed. Implemented by hand rather than via the SDK to keep
 * the shipped artifact a single dependency-free file.
 *
 * Security model: the server only ever reads inside the `--root`
 * folders given at launch. Requested paths are resolved and checked
 * against the roots, so a client can't walk out of the sandbox the
 * user configured.
 */

import { readFileSync, readdirSync, statSync, realpathSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, resolve, extname, relative, sep, basename } from 'node:path';
import {
  parseToDoc,
  renderPlainText,
  toUncompressedJson,
  type FileKind,
} from './cardmirror-read-lib.js';

const PROTOCOL_VERSION = '2025-06-18';
const SERVER_INFO = { name: 'cardmirror-read', version: '1.0.0' };

/** Character caps so a single tool result can't blow out an
 *  assistant's context. Text truncates with a notice; JSON refuses
 *  (its size is structural, truncation would corrupt it). */
const TEXT_CAP = 400_000;
const JSON_CAP = 2_000_000;
const CONVERTIBLE = new Set(['.cmir', '.docx']);

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: number | string | null;
  method: string;
  params?: Record<string, unknown>;
}

type JsonValue = unknown;

function ok(id: number | string | null, result: JsonValue): string {
  return JSON.stringify({ jsonrpc: '2.0', id, result });
}
function err(id: number | string | null, code: number, message: string): string {
  return JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } });
}
function toolText(id: number | string | null, text: string, isError = false): string {
  return ok(id, { content: [{ type: 'text', text }], isError });
}

const TOOLS = [
  {
    name: 'list_debate_files',
    description:
      'List CardMirror (.cmir) and Word (.docx) debate files under the configured folders. ' +
      'Returns relative paths usable with read_debate_file. Optional substring filter.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Case-insensitive substring to filter paths (optional).',
        },
      },
    },
  },
  {
    name: 'read_debate_file',
    description:
      'Read one debate file as text. `path` is a path returned by list_debate_files (or an ' +
      "absolute path inside a configured folder). `form` is 'text' (default: legible " +
      "markdown-flavored rendering — ==highlighted== is the read-aloud layer) or 'json' " +
      '(full-fidelity uncompressed CardMirror envelope; can be very large).',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File to read.' },
        form: { type: 'string', enum: ['text', 'json'], description: "Output form (default 'text')." },
      },
      required: ['path'],
    },
  },
];

/** Resolve a client-supplied path against the roots; null if it
 *  escapes them (symlinks included). */
function resolveWithinRoots(roots: string[], p: string): string | null {
  const candidates = p.startsWith('/') ? [p] : roots.map((r) => join(r, p));
  for (const cand of candidates) {
    let real: string;
    try {
      real = realpathSync(resolve(cand));
    } catch {
      continue; // doesn't exist under this root
    }
    for (const root of roots) {
      let realRoot: string;
      try {
        realRoot = realpathSync(root);
      } catch {
        continue;
      }
      if (real === realRoot || real.startsWith(realRoot + sep)) return real;
    }
  }
  return null;
}

function* walkFiles(dir: string): Generator<string> {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    if (ent.name.startsWith('.') || ent.name.startsWith('~$')) continue;
    const full = join(dir, ent.name);
    if (ent.isDirectory()) yield* walkFiles(full);
    else if (ent.isFile() && CONVERTIBLE.has(extname(ent.name).toLowerCase())) yield full;
  }
}

async function callTool(
  roots: string[],
  id: number | string | null,
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  if (name === 'list_debate_files') {
    const query = typeof args['query'] === 'string' ? args['query'].toLowerCase() : null;
    const lines: string[] = [];
    for (const root of roots) {
      for (const file of walkFiles(root)) {
        const rel = roots.length === 1 ? relative(root, file) : join(basename(root), relative(root, file));
        if (query && !rel.toLowerCase().includes(query)) continue;
        lines.push(rel);
        if (lines.length >= 2000) break;
      }
    }
    return toolText(
      id,
      lines.length === 0
        ? 'No matching .cmir/.docx files found.'
        : lines.join('\n') + (lines.length >= 2000 ? '\n… (truncated at 2000 entries — use query)' : ''),
    );
  }

  if (name === 'read_debate_file') {
    const p = args['path'];
    if (typeof p !== 'string' || !p) return toolText(id, 'read_debate_file: `path` is required.', true);
    // Multi-root relative paths carry the root basename prefix that
    // list_debate_files emitted — strip it before resolving.
    let rel = p;
    if (roots.length > 1 && !p.startsWith('/')) {
      const first = p.split(sep)[0]!;
      const match = roots.find((r) => basename(r) === first);
      if (match) rel = join(match, p.slice(first.length + 1));
    }
    const real = resolveWithinRoots(roots, rel);
    if (!real) return toolText(id, `read_debate_file: "${p}" not found inside the configured folders.`, true);
    const ext = extname(real).toLowerCase();
    if (!CONVERTIBLE.has(ext)) return toolText(id, `read_debate_file: "${p}" is not a .cmir or .docx file.`, true);
    const kind: FileKind = ext === '.docx' ? 'docx' : 'cmir';
    const form = args['form'] === 'json' ? 'json' : 'text';
    const bytes = new Uint8Array(readFileSync(real));
    try {
      if (form === 'json') {
        const json = await toUncompressedJson(bytes, kind);
        if (json.length > JSON_CAP) {
          return toolText(
            id,
            `read_debate_file: the JSON form of "${p}" is ${(json.length / 1e6).toFixed(1)} MB — too large to return. Use form:"text".`,
            true,
          );
        }
        return toolText(id, json);
      }
      const doc = await parseToDoc(bytes, kind);
      let text = renderPlainText(doc, basename(real));
      if (text.length > TEXT_CAP) {
        text =
          text.slice(0, TEXT_CAP) +
          `\n\n[…truncated: rendering is ${text.length.toLocaleString()} chars; showing the first ${TEXT_CAP.toLocaleString()}]`;
      }
      return toolText(id, text);
    } catch (e) {
      return toolText(id, `read_debate_file: couldn't convert "${p}": ${e instanceof Error ? e.message : e}`, true);
    }
  }

  return err(id, -32602, `unknown tool "${name}"`);
}

/** Handle one JSON-RPC message; returns the reply line, or null for
 *  notifications (which never get replies). Exported for tests. */
export async function handleMcpMessage(roots: string[], raw: string): Promise<string | null> {
  let msg: JsonRpcRequest;
  try {
    msg = JSON.parse(raw);
  } catch {
    return err(null, -32700, 'parse error');
  }
  const id = msg.id ?? null;
  const isNotification = msg.id === undefined;
  switch (msg.method) {
    case 'initialize':
      return ok(id, {
        protocolVersion:
          typeof msg.params?.['protocolVersion'] === 'string'
            ? msg.params['protocolVersion']
            : PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
      });
    case 'ping':
      return ok(id, {});
    case 'tools/list':
      return ok(id, { tools: TOOLS });
    case 'tools/call': {
      const name = msg.params?.['name'];
      const args = (msg.params?.['arguments'] ?? {}) as Record<string, unknown>;
      if (typeof name !== 'string') return err(id, -32602, 'tools/call needs params.name');
      return callTool(roots, id, name, args);
    }
    default:
      if (isNotification) return null; // notifications/initialized etc.
      return err(id, -32601, `method not found: ${msg.method}`);
  }
}

/** HTTP transport (MCP "Streamable HTTP"): for clients whose custom-
 *  server UI takes only a URL. The client POSTs one JSON-RPC message
 *  per request to the endpoint; we answer with JSON (or 202 for
 *  notifications). Stateless — no sessions, no server-push stream
 *  (GET answers 405, which spec-compliant clients treat as "server
 *  doesn't offer one").
 *
 *  Security: binds 127.0.0.1 ONLY (this serves file contents — it
 *  must never be reachable from the LAN), and any browser-ish Origin
 *  header that isn't localhost is rejected to block DNS-rebinding. */
export function runMcpHttpServer(roots: string[], port: number): void {
  const resolved = roots.map((r) => resolve(r));
  const server = createServer((req, res) => {
    const origin = req.headers.origin;
    if (origin && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
      res.writeHead(403);
      res.end();
      return;
    }
    if (req.method !== 'POST') {
      res.writeHead(405, { Allow: 'POST' });
      res.end();
      return;
    }
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (c: string) => {
      body += c;
      if (body.length > 10_000_000) req.destroy();
    });
    req.on('end', () => {
      void handleMcpMessage(resolved, body).then((reply) => {
        if (reply === null) {
          res.writeHead(202);
          res.end();
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(reply);
        }
      });
    });
  });
  server.listen(port, '127.0.0.1', () => {
    process.stdout.write(
      `cardmirror-read MCP server listening on http://127.0.0.1:${port}/mcp\n` +
        `(serving ${resolved.length} folder(s): ${resolved.join(', ')})\n` +
        `Paste that URL into your assistant's custom MCP server field. Keep this running.\n`,
    );
  });
}

/** stdio loop: newline-delimited JSON-RPC on stdin/stdout. */
export function runMcpServer(roots: string[]): void {
  const resolved = roots.map((r) => resolve(r));
  let buffer = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk: string) => {
    buffer += chunk;
    let nl: number;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      void handleMcpMessage(resolved, line).then((reply) => {
        if (reply !== null) process.stdout.write(reply + '\n');
      });
    }
  });
  process.stdin.on('end', () => process.exit(0));
}
