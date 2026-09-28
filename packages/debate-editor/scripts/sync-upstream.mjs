#!/usr/bin/env node
/**
 * Keeps `src/` = upstream CardMirror + debate-ai.com's changes.
 *
 * Upstream CardMirror is the git submodule at `packages/debate-editor-cm`
 * (github.com/debate/debate-editor). Its `src/` is copied into this package's
 * `src/` and our changes sit on top of it, in two forms:
 *
 *  - **Edits to upstream files** — recorded in `patches/debate-ai.patch`, a
 *    unified diff from upstream (at the commit pinned in `upstream.json`) to
 *    our `src/`. The toolbar tabs, the embed hooks (`adoptEmbeddedDoc`,
 *    `hostPlugins`, `chromeHost`, narrow chrome), the settings sidebar, the
 *    account-sync wiring, and the rest.
 *  - **Files upstream doesn't have** — the React shell (`react/`, `ui/`) and
 *    our own engine modules (`editor/ribbon-tabs*.ts`, `editor/chrome-host.ts`,
 *    the learn/quick-cards sync clients, …). They live in `src/` directly,
 *    beside the upstream files they import, and this script never writes them.
 *
 * Edit `src/` as usual, then record the change:
 *
 *   node scripts/sync-upstream.mjs --save-patch  # rewrite the patch from src/
 *   node scripts/sync-upstream.mjs --check       # CI: patch matches src/ (test/upstream-sync.test.ts)
 *
 * To take new upstream commits, move the submodule and sync:
 *
 *   git -C ../debate-editor-cm pull origin main
 *   node scripts/sync-upstream.mjs               # rebase src/ onto the submodule's HEAD
 *   node scripts/sync-upstream.mjs --ref <sha>   # …or onto a specific upstream commit
 *
 * A sync three-way merges every upstream file (base: the old pin, ours: src/,
 * theirs: the new commit) with `git merge-file`, adds files upstream added,
 * drops files upstream deleted, then rewrites the patch and the pin. Conflicts
 * are left in `src/` with `<<<<<<< src` markers and listed; resolve them, run
 * `--save-patch`, and commit `src/`, `patches/` and `upstream.json` together
 * with the submodule bump.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG_PATH = join(PKG, "upstream.json");
const config = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
const SUBMODULE = resolve(PKG, config.submodule);
const SRC = join(PKG, config.srcDir);
const PATCH = join(PKG, config.patch);

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const log = (msg) => console.log(`[sync-upstream] ${msg}`);

function git(gitArgs, opts = {}) {
  const r = spawnSync("git", gitArgs, { encoding: opts.encoding ?? "utf8", maxBuffer: 1 << 30, cwd: opts.cwd });
  if (r.error) throw r.error;
  if (!opts.allowFail && r.status !== 0) {
    throw new Error(`git ${gitArgs.join(" ")} failed (${r.status}): ${r.stderr}`);
  }
  return r;
}

function requireSubmodule() {
  if (!existsSync(join(SUBMODULE, ".git"))) {
    console.error(`[sync-upstream] ${relative(PKG, SUBMODULE)} is not checked out — run \`git submodule update --init packages/debate-editor-cm\`.`);
    process.exit(1);
  }
}

function resolveCommit(ref) {
  return git(["-C", SUBMODULE, "rev-parse", "--verify", `${ref}^{commit}`]).stdout.trim();
}

function hasCommit(ref) {
  return git(["-C", SUBMODULE, "cat-file", "-e", `${ref}^{commit}`], { allowFail: true }).status === 0;
}

/** Every file under upstream's src dir at `commit`, relative to it. */
function upstreamFiles(commit) {
  const out = git(["-C", SUBMODULE, "ls-tree", "-r", "--name-only", commit, "--", `${config.upstreamSrcDir}/`]).stdout;
  const prefix = `${config.upstreamSrcDir}/`;
  return out.split("\n").filter(Boolean).map((p) => p.slice(prefix.length));
}

/** Upstream's copy of one file at `commit`, as bytes. */
function upstreamBlob(commit, path) {
  return git(["-C", SUBMODULE, "show", `${commit}:${config.upstreamSrcDir}/${path}`], { encoding: "buffer" }).stdout;
}

function readIfExists(path) {
  return existsSync(path) ? readFileSync(path) : null;
}

function write(path, bytes) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bytes);
}

function removeEmptyDirs(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) removeEmptyDirs(join(dir, entry.name));
  }
  if (dir !== SRC && readdirSync(dir).length === 0) rmSync(dir, { recursive: true });
}

const isBinary = (bytes) => bytes.subarray(0, 8000).includes(0);

/**
 * The patch: a diff from upstream at `commit` to src/, over upstream's files
 * only (our own files are not upstream's business and stay out of it).
 * Both sides are written fresh into a temp dir so file modes and line endings
 * can't show up as spurious changes.
 */
function buildPatch(commit) {
  const tmp = mkdtempSync(join(tmpdir(), "debate-editor-patch-"));
  try {
    for (const path of upstreamFiles(commit)) {
      write(join(tmp, "u", path), upstreamBlob(commit, path));
      const ours = readIfExists(join(SRC, path));
      if (ours) write(join(tmp, "d", path), ours);
    }
    mkdirSync(join(tmp, "d"), { recursive: true });
    const r = git(
      ["-c", "core.quotepath=off", "diff", "--no-index", "--no-color", "--binary", "--no-prefix", "--no-renames", "u", "d"],
      { cwd: tmp, allowFail: true },
    );
    if (r.status !== 0 && r.status !== 1) throw new Error(`git diff failed: ${r.stderr}`);
    // Header paths point at the temp dirs; rewrite them to this package's
    // src/ so `git apply` works from the package root.
    const body = r.stdout
      .split("\n")
      .map((line) =>
        /^(diff --git |--- |\+\+\+ )/.test(line)
          ? line.replace(/(^| )u\//g, "$1a/src/").replace(/(^| )d\//g, "$1b/src/")
          : line,
      )
      .join("\n");
    const header =
      `# debate-ai.com changes to upstream CardMirror (packages/debate-editor-cm).\n` +
      `# Base: ${config.repository} @ ${commit}\n` +
      `# Generated by scripts/sync-upstream.mjs — edit src/ and run --save-patch; do not edit by hand.\n`;
    return header + body;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

function patchStats(patch) {
  const files = (patch.match(/^diff --git /gm) ?? []).length;
  const added = (patch.match(/^\+(?!\+\+ )/gm) ?? []).length;
  const removed = (patch.match(/^-(?!-- )/gm) ?? []).length;
  return `${files} upstream files changed, +${added} −${removed}`;
}

function savePatch() {
  requireSubmodule();
  const patch = buildPatch(config.commit);
  write(PATCH, patch);
  log(`wrote ${relative(PKG, PATCH)} (${patchStats(patch)})`);
}

function check() {
  if (!existsSync(join(SUBMODULE, ".git"))) {
    log(`${relative(PKG, SUBMODULE)} not checked out — skipping the check.`);
    return;
  }
  if (!hasCommit(config.commit)) {
    log(`pinned commit ${config.commit} is not in the submodule's history — skipping the check.`);
    return;
  }
  const expected = buildPatch(config.commit);
  const actual = readIfExists(PATCH)?.toString("utf8");
  if (actual !== expected) {
    console.error(
      `[sync-upstream] ${relative(PKG, PATCH)} is out of date with src/.\n` +
        `  An upstream file under src/ was edited without recording it. Run:\n` +
        `    node packages/debate-editor/scripts/sync-upstream.mjs --save-patch`,
    );
    process.exit(1);
  }
  const head = resolveCommit("HEAD");
  if (head !== config.commit) {
    log(`note: the submodule is at ${head.slice(0, 8)}, src/ is synced to ${config.commit.slice(0, 8)} — run sync-upstream to take it.`);
  }
  log(`ok — src/ matches upstream ${config.commit.slice(0, 8)} + ${relative(PKG, PATCH)} (${patchStats(expected)})`);
}

/** Three-way merge `src/` from upstream `base` onto upstream `target`. */
function sync(base, target) {
  const baseFiles = new Set(upstreamFiles(base));
  const targetFiles = new Set(upstreamFiles(target));
  const conflicts = [];
  let merged = 0;
  let added = 0;
  let removed = 0;
  const tmp = mkdtempSync(join(tmpdir(), "debate-editor-sync-"));
  try {
    for (const path of new Set([...baseFiles, ...targetFiles])) {
      const dest = join(SRC, path);
      const ours = readIfExists(dest);
      const baseBytes = baseFiles.has(path) ? upstreamBlob(base, path) : null;
      const theirs = targetFiles.has(path) ? upstreamBlob(target, path) : null;

      if (!baseBytes) {
        // Upstream added it. A same-named file of ours would be silently
        // replaced — stop instead and let a human pick a new name for ours.
        if (ours && !ours.equals(theirs)) {
          conflicts.push(`${path} (upstream added a file with the same name as one of ours)`);
        } else if (!ours) {
          write(dest, theirs);
          added++;
        }
        continue;
      }
      if (!theirs) {
        // Upstream deleted it: drop it too, unless we had changed it.
        if (ours && !ours.equals(baseBytes)) {
          conflicts.push(`${path} (upstream deleted it; we had changed it)`);
        } else if (ours) {
          rmSync(dest);
          removed++;
        }
        continue;
      }
      if (!ours) {
        // We deleted it (recorded in the patch). Fine while upstream leaves it alone.
        if (!theirs.equals(baseBytes)) conflicts.push(`${path} (we deleted it; upstream changed it)`);
        continue;
      }
      if (theirs.equals(baseBytes) || ours.equals(theirs)) continue;
      if (ours.equals(baseBytes)) {
        write(dest, theirs);
        merged++;
        continue;
      }
      if (isBinary(ours) || isBinary(theirs)) {
        conflicts.push(`${path} (binary, changed on both sides — src/ keeps ours)`);
        continue;
      }
      writeFileSync(join(tmp, "base"), baseBytes);
      writeFileSync(join(tmp, "theirs"), theirs);
      const r = git(["merge-file", "-L", "src", "-L", "base", "-L", "upstream", dest, join(tmp, "base"), join(tmp, "theirs")], {
        allowFail: true,
      });
      if (r.status < 0 || r.status === null) throw new Error(`git merge-file failed on ${path}: ${r.stderr}`);
      if (r.status > 0) conflicts.push(`${path} (${r.status} conflict${r.status === 1 ? "" : "s"})`);
      merged++;
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  removeEmptyDirs(SRC);
  log(`${merged} files merged, ${added} added, ${removed} removed`);
  return conflicts;
}

// ── main ────────────────────────────────────────────────────────────────────
if (flag("--check")) {
  check();
} else if (flag("--save-patch")) {
  savePatch();
} else {
  requireSubmodule();
  const target = resolveCommit(option("--ref") ?? "HEAD");
  if (target === config.commit) {
    log(`already at ${target.slice(0, 8)} — refreshing the patch only`);
    savePatch();
  } else {
    if (!hasCommit(config.commit)) {
      console.error(`[sync-upstream] the pinned commit ${config.commit} is missing from the submodule — fetch its history (git -C ${config.submodule} fetch --unshallow).`);
      process.exit(1);
    }
    log(`rebasing src/ from upstream ${config.commit.slice(0, 8)} onto ${target.slice(0, 8)}`);
    const conflicts = sync(config.commit, target);
    config.commit = target;
    writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`);
    log(`pinned upstream.json to ${target}`);
    if (conflicts.length) {
      console.error(`[sync-upstream] ${conflicts.length} file(s) need a hand merge — resolve them in src/, then run --save-patch:`);
      for (const c of conflicts) console.error(`  - ${c}`);
      process.exitCode = 1;
    } else {
      savePatch();
    }
  }
}
