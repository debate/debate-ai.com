const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const pkg = require("../../package.json");

// The app builds with vinext/Vite, whose client output lands in `dist/client`
// and is served at the site root (see wrangler.jsonc `assets.directory`).
// Hashed assets live under `/assets/*`. (Before the Next.js -> Vite migration
// this scanned `.next/static` and emitted `/_next/static/*` paths, which no
// longer exist in the build — the stale list caused the service worker to
// precache dead chunks, producing "Failed to fetch" + React #130 on clients
// that still had the old worker installed.)
const folderPath = "dist/client";

// Files in the build output we must not precache: source maps, Vite's internal
// manifest dir, Cloudflare routing files, and the service worker itself
// (the browser manages the SW script; caching it would pin a stale worker).
const EXCLUDE_EXACT = new Set([
  "service-worker.js",
  "_headers",
  "_redirects",
  ".assetsignore",
  ".DS_Store",
]);
const isExcluded = (relPath) => {
  if (relPath.endsWith(".map")) return true;
  if (relPath.split("/").includes(".vite")) return true;
  if (EXCLUDE_EXACT.has(relPath)) return true;
  return false;
};

function getAllFilesInDir(dir) {
  if (!fs.existsSync(dir)) {
    console.warn(`Directory ${dir} does not exist. Creating empty file list.`);
    return [];
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? getAllFilesInDir(fullPath) : [fullPath];
  });
}

// Static assets emitted by the Vite build, served at the site root.
const staticFiles = getAllFilesInDir(folderPath)
  .map((f) => path.relative(folderPath, f).split(path.sep).join("/"))
  .filter((rel) => !isExcluded(rel))
  .map((rel) => `/${rel}`)
  .sort();

const allFiles = staticFiles;

const fileList = `export const APP_FILE_LIST = [\n  ${allFiles.map((f) => `'${f}'`).join(",\n  ")}\n];\n`;
fs.writeFileSync("./lib/offline-sw/app-file-list.ts", fileList);

// The worker names its cache after VERSION and deletes every other cache on
// activate, so VERSION has to change whenever the build output does. Using
// `pkg.version` alone did not: it has sat at the same number across many
// deploys, so every build reused one cache and the purge in `onActivate` was a
// no-op. Entries cached by an older build — including the RSC payloads the
// router fetches for client-side navigation — outlived the build they came
// from and were served in preference to the current one. Fold a digest of the
// emitted files into the version so each distinct build gets its own cache.
const buildDigest = crypto.createHash("sha256");
for (const rel of allFiles) {
  buildDigest.update(rel);
  buildDigest.update(fs.readFileSync(path.join(folderPath, rel.slice(1))));
}
const VERSION = `${pkg.version}-${buildDigest.digest("hex").slice(0, 12)}`;

const versionFile = `export const VERSION = '${VERSION}';\n`;
fs.writeFileSync("./lib/offline-sw/version.ts", versionFile);

console.log(
  `Generated app-file-list.ts (${allFiles.length} files) and version.ts (v${VERSION}) from ${folderPath}`,
);
