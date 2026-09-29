#!/usr/bin/env node
/**
 * Assembles `src/` from the upstream CardMirror submodule plus this adapter.
 *
 * This package holds no copy of the editor. Upstream CardMirror is the git
 * submodule at `packages/debate-editor-cm` (github.com/debate/debate-editor);
 * what this package tracks is only what debate-ai.com adds to it:
 *
 *  - `patches/debate-ai.patch` — edits to upstream files, as a unified diff
 *    from upstream (at the commit pinned in `upstream.json`). The toolbar
 *    tabs, the embed hooks (`adoptEmbeddedDoc`, `hostPlugins`, `chromeHost`,
 *    narrow chrome), the settings sidebar, the account-sync wiring, and the
 *    rest.
 *  - `overlay/` — files upstream doesn't have: the React shell (`react/`,
 *    `ui/`) and our own engine modules (`editor/ribbon-tabs*.ts`,
 *    `editor/chrome-host.ts`, the learn/quick-cards sync clients, …).
 *
 * `src/` is generated (git-ignored): upstream's `src/` at the pinned commit,
 * the patch applied, the overlay copied on top. The package's exports point
 * into it, so it is rebuilt on `postinstall`, `build`, `typecheck` and `test`.
 *
 *   node scripts/sync-upstream.mjs               # assemble src/ (no-op when current)
 *   node scripts/sync-upstream.mjs --save        # record edits made in src/ into patches/ + overlay/
 *   node scripts/sync-upstream.mjs --check       # CI: the patch applies and src/ has no unrecorded edits
 *   node scripts/sync-upstream.mjs --force       # re-assemble, discarding unrecorded edits in src/
 *   node scripts/sync-upstream.mjs --if-available  # postinstall: skip, not fail, without the submodule
 *
 * Edit `src/` as usual and run `--save`, or edit `overlay/` directly. An
 * assemble never overwrites unrecorded edits in `src/`; it stops and says so.
 *
 * To take new upstream commits, move the submodule and rebase onto it:
 *
 *   git -C ../debate-editor-cm pull origin main
 *   node scripts/sync-upstream.mjs --rebase             # onto the submodule's HEAD
 *   node scripts/sync-upstream.mjs --rebase --ref <sha> # …or onto a specific upstream commit
 *
 * A rebase three-way merges every upstream file (base: the old pin, ours:
 * src/, theirs: the new commit) with `git merge-file`, adds files upstream
 * added, drops files upstream deleted, then rewrites the patch and the pin.
 * Conflicts are left in `src/` with `<<<<<<< src` markers and listed; resolve
 * them, run `--save`, and commit `patches/`, `overlay/` and `upstream.json`
 * together with the submodule bump.
 */

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG_PATH = join(PKG, "upstream.json");
const config = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
const SUBMODULE = resolve(PKG, config.submodule);
const SRC = join(PKG, config.srcDir);
const OVERLAY = join(PKG, config.overlayDir);
const PATCH = join(PKG, config.patch);
/** What the last assemble wrote to src/, so later runs can tell our output from hand edits. */
const MANIFEST = join(SRC, ".assembled.json");

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const log = (msg) => console.log(`[sync-upstream] ${msg}`);
const fail = (msg) => {
  console.error(`[sync-upstream] ${msg}`);
  process.exit(1);
};

function git(gitArgs, opts = {}) {
  const r = spawnSync("git", gitArgs, { encoding: opts.encoding ?? "utf8", maxBuffer: 1 << 30, cwd: opts.cwd });
  if (r.error) throw r.error;
  if (!opts.allowFail && r.status !== 0) {
    throw new Error(`git ${gitArgs.join(" ")} failed (${r.status}): ${r.stderr}`);
  }
  return r;
}

const submoduleCheckedOut = () => existsSync(join(SUBMODULE, ".git"));

function requireSubmodule() {
  if (!submoduleCheckedOut()) {
    fail(`${relative(PKG, SUBMODULE)} is not checked out — run \`git submodule update --init packages/debate-editor-cm\`.`);
  }
}

function resolveCommit(ref) {
  return git(["-C", SUBMODULE, "rev-parse", "--verify", `${ref}^{commit}`]).stdout.trim();
}

function hasCommit(ref) {
  return git(["-C", SUBMODULE, "cat-file", "-e", `${ref}^{commit}`], { allowFail: true }).status === 0;
}

function requirePinnedCommit() {
  if (!hasCommit(config.commit)) {
    // A shallow submodule checkout (CI's `submodules: true`) has only the
    // gitlink's commit; fetch the pinned one on its own when they differ.
    log(`fetching the pinned upstream commit ${config.commit.slice(0, 8)} into ${relative(PKG, SUBMODULE)}`);
    git(["-C", SUBMODULE, "fetch", "--quiet", "--depth=1", "--no-tags", "origin", config.commit], { allowFail: true });
  }
  if (!hasCommit(config.commit)) {
    fail(
      `the pinned upstream commit ${config.commit} is missing from ${relative(PKG, SUBMODULE)} — ` +
        `run \`git submodule update --init packages/debate-editor-cm\` (or fetch its history).`,
    );
  }
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

/** Every file under `dir`, relative to it, with `/` separators. */
function listFiles(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  const walk = (d) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else out.push(relative(dir, full).split(sep).join("/"));
    }
  };
  walk(dir);
  return out.sort();
}

function removeEmptyDirs(dir, root) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) removeEmptyDirs(join(dir, entry.name), root);
  }
  if (dir !== root && readdirSync(dir).length === 0) rmSync(dir, { recursive: true });
}

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const isBinary = (bytes) => bytes.subarray(0, 8000).includes(0);

// ── assemble ────────────────────────────────────────────────────────────────

/** Upstream at `commit` + the patch + the overlay, written into `dest`. */
function assembleInto(dest, commit) {
  const tmp = mkdtempSync(join(tmpdir(), "debate-editor-assemble-"));
  try {
    for (const path of upstreamFiles(commit)) write(join(tmp, "src", path), upstreamBlob(commit, path));
    // Applied in a scratch dir outside any repo, so `git apply` behaves like
    // `patch` and takes the a/src/… paths relative to it.
    const r = git(["apply", "--whitespace=nowarn", PATCH], { cwd: tmp, allowFail: true });
    if (r.status !== 0) {
      fail(
        `${relative(PKG, PATCH)} does not apply to upstream ${commit.slice(0, 8)}:\n${r.stderr}` +
          `  The patch was built against the commit pinned in upstream.json; if the submodule moved, use --rebase.`,
      );
    }
    rmSync(dest, { recursive: true, force: true });
    cpSync(join(tmp, "src"), dest, { recursive: true });
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  for (const path of listFiles(OVERLAY)) {
    if (existsSync(join(dest, path))) {
      fail(`overlay/${path} shadows an upstream file — move the change into the patch (edit src/, then --save).`);
    }
    write(join(dest, path), readFileSync(join(OVERLAY, path)));
  }
}

/** The inputs an assembled src/ was built from; a change to any means a rebuild. */
function inputsKey() {
  const h = createHash("sha256");
  h.update(`${config.commit}\n`);
  h.update(readFileSync(PATCH));
  for (const path of listFiles(OVERLAY)) h.update(`\n${path}\n`).update(readFileSync(join(OVERLAY, path)));
  return h.digest("hex");
}

function readManifest() {
  try {
    return JSON.parse(readFileSync(MANIFEST, "utf8"));
  } catch {
    return null;
  }
}

/** Files in src/ that differ from what the last assemble wrote there. */
function unrecordedEdits() {
  const manifest = readManifest();
  if (!manifest) return listFiles(SRC).filter((p) => p !== ".assembled.json");
  const edits = [];
  const seen = new Set();
  for (const path of listFiles(SRC)) {
    if (path === ".assembled.json") continue;
    seen.add(path);
    if (manifest.files[path] !== hash(readFileSync(join(SRC, path)))) edits.push(path);
  }
  for (const path of Object.keys(manifest.files)) if (!seen.has(path)) edits.push(`${path} (deleted)`);
  return edits;
}

function writeManifest() {
  const files = {};
  for (const path of listFiles(SRC)) if (path !== ".assembled.json") files[path] = hash(readFileSync(join(SRC, path)));
  write(MANIFEST, `${JSON.stringify({ inputs: inputsKey(), commit: config.commit, files }, null, 2)}\n`);
}

function assemble({ force = false, quiet = false } = {}) {
  if (!submoduleCheckedOut()) {
    if (existsSync(MANIFEST) || flag("--if-available")) {
      log(`${relative(PKG, SUBMODULE)} is not checked out — keeping the existing src/.`);
      return;
    }
    fail(`${relative(PKG, SUBMODULE)} is not checked out — run \`git submodule update --init packages/debate-editor-cm\`.`);
  }
  requirePinnedCommit();
  const inputs = inputsKey();
  const manifest = readManifest();
  const edits = existsSync(SRC) ? unrecordedEdits() : [];
  if (!force && manifest?.inputs === inputs && edits.length === 0) {
    if (!quiet) log(`src/ is current (upstream ${config.commit.slice(0, 8)} + patch + overlay)`);
    return;
  }
  if (!force && edits.length && manifest) {
    fail(
      `src/ has ${edits.length} unrecorded edit(s) — record them with --save, or discard them with --force:\n` +
        edits.slice(0, 20).map((e) => `  - ${e}`).join("\n") +
        (edits.length > 20 ? `\n  … and ${edits.length - 20} more` : ""),
    );
  }
  assembleInto(SRC, config.commit);
  writeManifest();
  const head = resolveCommit("HEAD");
  if (head !== config.commit) {
    log(`note: the submodule is at ${head.slice(0, 8)}, the patch is pinned to ${config.commit.slice(0, 8)} — run --rebase to take it.`);
  }
  log(`assembled src/ from upstream ${config.commit.slice(0, 8)} + ${relative(PKG, PATCH)} + ${relative(PKG, OVERLAY)}/`);
}

// ── save ────────────────────────────────────────────────────────────────────

/**
 * The patch: a diff from upstream at `commit` to src/, over upstream's files
 * only (our own files live in overlay/). Both sides are written fresh into a
 * temp dir so file modes and line endings can't show up as spurious changes.
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
    // Header paths point at the temp dirs; rewrite them to src/ so `git
    // apply` works from the assemble scratch dir.
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
      `# Generated by scripts/sync-upstream.mjs — edit src/ and run --save; do not edit by hand.\n`;
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

/** Record src/ into patches/ (upstream files) and overlay/ (ours). */
function save() {
  requireSubmodule();
  requirePinnedCommit();
  if (!existsSync(SRC)) fail("src/ has not been assembled — nothing to save.");
  const upstream = new Set(upstreamFiles(config.commit));
  const patch = buildPatch(config.commit);
  write(PATCH, patch);
  const ours = listFiles(SRC).filter((p) => p !== ".assembled.json" && !upstream.has(p));
  rmSync(OVERLAY, { recursive: true, force: true });
  for (const path of ours) write(join(OVERLAY, path), readFileSync(join(SRC, path)));
  writeManifest();
  log(`wrote ${relative(PKG, PATCH)} (${patchStats(patch)}) and ${relative(PKG, OVERLAY)}/ (${ours.length} files)`);
}

// ── check ───────────────────────────────────────────────────────────────────

function check() {
  if (!submoduleCheckedOut()) {
    log(`${relative(PKG, SUBMODULE)} not checked out — skipping the check.`);
    return;
  }
  if (!hasCommit(config.commit)) {
    log(`pinned commit ${config.commit} is not in the submodule's history — skipping the check.`);
    return;
  }
  // The patch applies cleanly and the overlay shadows nothing (both fail() inside).
  const tmp = mkdtempSync(join(tmpdir(), "debate-editor-check-"));
  try {
    assembleInto(join(tmp, "src"), config.commit);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  // An assembled src/ with hand edits would be lost on the next assemble.
  if (existsSync(MANIFEST)) {
    const edits = unrecordedEdits();
    if (edits.length) {
      fail(
        `src/ has ${edits.length} edit(s) not recorded in patches/ or overlay/. Run:\n` +
          `    node packages/debate-editor/scripts/sync-upstream.mjs --save\n` +
          edits.slice(0, 20).map((e) => `  - ${e}`).join("\n"),
      );
    }
  }
  log(`ok — upstream ${config.commit.slice(0, 8)} + ${relative(PKG, PATCH)} (${patchStats(readFileSync(PATCH, "utf8"))}) + ${relative(PKG, OVERLAY)}/`);
}

// ── rebase ──────────────────────────────────────────────────────────────────

/** Three-way merge `src/` from upstream `base` onto upstream `target`. */
function rebase(base, target) {
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
  removeEmptyDirs(SRC, SRC);
  log(`${merged} files merged, ${added} added, ${removed} removed`);
  return conflicts;
}

// ── main ────────────────────────────────────────────────────────────────────
if (flag("--check")) {
  check();
} else if (flag("--save")) {
  save();
} else if (flag("--rebase")) {
  requireSubmodule();
  requirePinnedCommit();
  assemble({ quiet: true });
  const target = resolveCommit(option("--ref") ?? "HEAD");
  if (target === config.commit) {
    log(`already at ${target.slice(0, 8)} — nothing to rebase`);
  } else {
    log(`rebasing src/ from upstream ${config.commit.slice(0, 8)} onto ${target.slice(0, 8)}`);
    const conflicts = rebase(config.commit, target);
    config.commit = target;
    writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`);
    log(`pinned upstream.json to ${target}`);
    if (conflicts.length) {
      console.error(`[sync-upstream] ${conflicts.length} file(s) need a hand merge — resolve them in src/, then run --save:`);
      for (const c of conflicts) console.error(`  - ${c}`);
      process.exitCode = 1;
    } else {
      save();
    }
  }
} else {
  assemble({ force: flag("--force") });
}
