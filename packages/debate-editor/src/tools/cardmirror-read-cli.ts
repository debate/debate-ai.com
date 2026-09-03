/**
 * cardmirror-read — CLI entry.
 *
 * A tiny utility an AI assistant (or anyone) can run to get a
 * temporary, read-only, machine-readable copy of a CardMirror `.cmir`
 * or Word `.docx` file — without the app, without a display, without
 * write access to the original.
 *
 *   node cardmirror-read.cjs <file> [--form text|json] [--stdout] [--out PATH]
 *
 *   --form text   (default) markdown-flavored plain text
 *   --form json   uncompressed CardMirror JSON envelope (full fidelity)
 *   --stdout      print the content instead of writing a temp file
 *   --out PATH    write to PATH instead of a temp file
 *
 * Default behavior prints exactly ONE line to stdout: the absolute
 * path of the freshly written read-only temp file — trivially
 * consumable by an agent. Errors go to stderr with exit code 1.
 */

import { readFileSync, writeFileSync, mkdtempSync, chmodSync, existsSync, statSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { basename, extname, join, resolve } from 'node:path';
import { looksLikeNative, NativeDamagedError } from '../native/index.js';
import {
  toUncompressedJson,
  parseToDoc,
  renderPlainText,
  type ReadForm,
  type FileKind,
} from './cardmirror-read-lib.js';
import { runMirror } from './cardmirror-read-mirror.js';
import { runMcpServer, runMcpHttpServer } from './cardmirror-read-mcp.js';

// A closed read end (e.g. `cardmirror-read … --stdout | head`) must be
// a clean exit, not an unhandled-EPIPE crash dump — agents pipe.
process.stdout.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EPIPE') process.exit(0);
  throw err;
});

/** Shells don't expand `~` inside quotes — and quoting is exactly what
 *  we tell users to do for paths with spaces (field report: a quoted
 *  "~/Documents/…" resolved to $PWD/~/…). Expand it ourselves so both
 *  spellings work. */
function expandTilde(p: string): string {
  if (p === '~') return homedir();
  if (p.startsWith('~/')) return join(homedir(), p.slice(2));
  return p;
}

function fail(msg: string): never {
  process.stderr.write(`cardmirror-read: ${msg}\n`);
  process.exit(1);
}

function usage(): never {
  process.stderr.write(
    'Usage:\n' +
      '  cardmirror-read <file.cmir|file.docx> [--form text|json] [--stdout] [--out PATH]\n' +
      '  cardmirror-read --mirror DIR [--mirror DIR …] --out-dir DIR\n' +
      '  cardmirror-read --mcp --root DIR [--root DIR …]\n' +
      '  cardmirror-read --mcp-http [--port N] --root DIR [--root DIR …]\n',
  );
  process.exit(1);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let file: string | null = null;
  let form: ReadForm = 'text';
  let stdout = false;
  let outPath: string | null = null;
  const mirrors: string[] = [];
  let outDir: string | null = null;
  let mcp = false;
  let mcpHttp = false;
  let port = 3323;
  const roots: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === '--mirror') {
      const v = args[++i];
      if (!v) fail('--mirror needs a folder');
      mirrors.push(expandTilde(v));
    } else if (a === '--out-dir') {
      outDir = args[++i] ?? null;
      if (!outDir) fail('--out-dir needs a folder');
      outDir = expandTilde(outDir);
    } else if (a === '--mcp') mcp = true;
    else if (a === '--mcp-http') mcpHttp = true;
    else if (a === '--port') {
      const v = Number(args[++i]);
      if (!Number.isInteger(v) || v < 1 || v > 65535) fail('--port needs a port number');
      port = v;
    } else if (a === '--root') {
      const v = args[++i];
      if (!v) fail('--root needs a folder');
      roots.push(expandTilde(v));
    } else if (a === '--form') {
      const v = args[++i];
      if (v !== 'text' && v !== 'json') fail(`--form must be "text" or "json", got "${v}"`);
      form = v;
    } else if (a === '--stdout') stdout = true;
    else if (a === '--out') {
      outPath = args[++i] ?? null;
      if (!outPath) fail('--out needs a path');
      outPath = expandTilde(outPath);
    } else if (a === '--help' || a === '-h') usage();
    else if (a.startsWith('--')) fail(`unknown flag ${a}`);
    else if (file)
      fail(
        `unexpected extra argument "${a}" — if a folder or file path contains spaces, wrap it in quotes (e.g. --root "/Users/you/My Debate Folder")`,
      );
    else file = expandTilde(a);
  }

  // A mistyped or non-expanded folder should fail LOUDLY here — a
  // server "working" over a nonexistent root reads as mysteriously
  // empty instead of misconfigured.
  for (const dir of [...roots, ...mirrors]) {
    if (!existsSync(dir) || !statSync(dir).isDirectory()) {
      fail(`folder does not exist: "${dir}"`);
    }
  }

  // Long-running modes.
  if (mcp || mcpHttp) {
    if (mirrors.length || file)
      fail(
        file
          ? `unexpected argument "${file}" alongside --mcp — if your --root path contains spaces, wrap it in quotes (e.g. --root "/Users/you/My Debate Folder")`
          : '--mcp cannot be combined with --mirror',
      );
    if (roots.length === 0) fail('--mcp needs at least one --root folder to serve');
    if (mcpHttp) runMcpHttpServer(roots, port);
    else runMcpServer(roots);
    return; // server loop keeps the process alive
  }
  if (mirrors.length > 0) {
    if (file) fail('--mirror cannot be combined with a file argument');
    if (!outDir) fail('--mirror needs --out-dir');
    await runMirror(mirrors, outDir);
    return;
  }

  if (!file) usage();

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(readFileSync(resolve(file)));
  } catch (err) {
    fail(`can't read "${file}": ${err instanceof Error ? err.message : err}`);
  }

  const ext = extname(file).toLowerCase();
  const kind: FileKind =
    ext === '.docx' ? 'docx' : ext === '.cmir' || looksLikeNative(bytes) ? 'cmir' : (fail(
      `unsupported file type "${ext || '(none)'}" — expected .cmir or .docx`,
    ) as never);

  let content: string;
  try {
    if (form === 'json') {
      content = await toUncompressedJson(bytes, kind);
    } else {
      const doc = await parseToDoc(bytes, kind);
      content = renderPlainText(doc, basename(file));
    }
  } catch (err) {
    if (err instanceof NativeDamagedError) {
      fail(
        `this .cmir is damaged beyond the automatic repairs (${err.message}); ` +
          `try --form json for the raw (uncompressed) envelope`,
      );
    }
    fail(`couldn't convert "${file}": ${err instanceof Error ? err.message : err}`);
  }

  if (stdout) {
    process.stdout.write(content);
    return;
  }

  const target =
    outPath ??
    join(
      mkdtempSync(join(tmpdir(), 'cardmirror-read-')),
      `${basename(file, extname(file))}.${form === 'json' ? 'json' : 'txt'}`,
    );
  writeFileSync(target, content);
  // Read-only: this is a disposable VIEW of the document, never a
  // thing to edit (edits would be silently lost — the original file
  // is untouched by design).
  chmodSync(target, 0o444);
  process.stdout.write(resolve(target) + '\n');
}

void main();
