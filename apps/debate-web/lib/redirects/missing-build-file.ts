/**
 * @fileoverview A plain 404 for build output that is not in this deploy.
 *
 * Every file under `/_next/static/` and `/assets/` is content-hashed and is
 * served by the Workers static-assets layer before this Worker ever runs. A
 * request for one that reaches the Worker therefore names a file this deploy
 * does not have — almost always a chunk from the build before (a tab opened
 * before the deploy) or after (an edge that has the new HTML a moment before
 * the new assets).
 *
 * Left to the app, that request rendered the HTML not-found page. Safari then
 * reported `'text/html' is not a valid JavaScript MIME type` for the module
 * script, and an HTML 404 could be cached by a proxy under a script URL. This
 * answers with a short `text/plain` 404 that is never cached, and the page's
 * chunk-reload script (lib/chunk-reload/script.ts) recovers by reloading.
 *
 *     const missing = missingBuildFileResponse(request);
 *     if (missing) return missing;
 */

/** Paths that only ever hold hashed build output served by the assets layer. */
const BUILD_OUTPUT_PREFIXES = ["/_next/static/", "/assets/"];

/** True when `pathname` is under a build-output folder. */
export function isBuildOutputPath(pathname: string): boolean {
  return BUILD_OUTPUT_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * A `text/plain` 404 for a GET or HEAD of a build file that reached the
 * Worker, or `null` for every other request.
 */
export function missingBuildFileResponse(request: Request): Response | null {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return null;
  }
  if (!isBuildOutputPath(url.pathname)) return null;
  return new Response(request.method === "HEAD" ? null : "Not found: this file is not part of the current deploy.\n", {
    status: 404,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

/**
 * The slice of an R2 bucket binding the archive lookup needs, so tests can
 * pass a plain object instead of a real bucket.
 */
export interface BuildArchiveBucket {
  get(key: string): Promise<{
    body: ReadableStream | null;
    size?: number;
    httpEtag?: string;
  } | null>;
}

/** Content types by extension for archived build files. */
const ARCHIVE_CONTENT_TYPES: Record<string, string> = {
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  json: "application/json; charset=utf-8",
  map: "application/json; charset=utf-8",
  wasm: "application/wasm",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  avif: "image/avif",
  gif: "image/gif",
  ico: "image/x-icon",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
  txt: "text/plain; charset=utf-8",
};

/** The R2 key an archived build file is stored under: its path without the leading slash. */
export function buildArchiveKey(pathname: string): string {
  return pathname.replace(/^\/+/, "");
}

/** The Content-Type to serve an archived build file with, from its extension. */
export function archivedContentType(pathname: string): string {
  const ext = pathname.slice(pathname.lastIndexOf(".") + 1).toLowerCase();
  return ARCHIVE_CONTENT_TYPES[ext] ?? "application/octet-stream";
}

/**
 * A build file from an earlier deploy, served out of the BUILD_ARCHIVE R2
 * bucket, or `null` when it is not a build-file GET/HEAD or is not archived.
 *
 * Each Worker version's static-assets layer only holds the files of its own
 * build, so the moment a deploy (or a rollback) goes live every chunk of the
 * build before it 404s, and any tab still running that build crashes on its
 * next lazy import ("Failed to fetch dynamically imported module"). The deploy
 * workflow copies every build's `/_next/static/` and `/assets/` files into
 * the bucket (.github/scripts/archive-build-assets.mjs); since the names are
 * content-hashed, a file under a given key never changes, so it is served as
 * immutable. Lookup errors fall through to the plain 404 rather than failing
 * the request.
 */
export async function archivedBuildFileResponse(
  request: Request,
  bucket: BuildArchiveBucket | undefined,
): Promise<Response | null> {
  if (!bucket) return null;
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  let pathname: string;
  try {
    pathname = new URL(request.url).pathname;
  } catch {
    return null;
  }
  if (!isBuildOutputPath(pathname) || pathname.includes("..")) return null;
  let object: Awaited<ReturnType<BuildArchiveBucket["get"]>>;
  try {
    object = await bucket.get(buildArchiveKey(pathname));
  } catch {
    return null;
  }
  if (!object) return null;
  const headers: Record<string, string> = {
    "content-type": archivedContentType(pathname),
    "cache-control": "public, max-age=31536000, immutable",
    "x-content-type-options": "nosniff",
    "x-build-archive": "hit",
  };
  if (object.httpEtag) headers.etag = object.httpEtag;
  if (typeof object.size === "number") headers["content-length"] = String(object.size);
  return new Response(request.method === "HEAD" ? null : object.body, { status: 200, headers });
}
