/**
 * @fileoverview The `/<username>/<folder path>/<doc slug>` address of a
 * personal file (one of the reader's own My Files), e.g.
 * `/alexgul/aff/k-aff-answers`.
 *
 * A personal file is addressed by its owner's username — a handle made from
 * their name, numbered when two people share one (`alexgul`, `alexgul2`, …) —
 * and then the file's own path: the same folder-and-file slugs `./doc-path`
 * builds for `?doc=`. It is the personal twin of a public Topic Starter's
 * `/docs/<topic code>/<path>` (`./topic-doc-paths`), and replaces the old
 * `/reason-editor?doc=<path>` link, which still opens the file and is then
 * rewritten to this form (`canonicalEditorUrl` in `./route-selection`).
 *
 * The username is a namespace, not a lookup key: the file is still resolved
 * against the reader's own documents (then the public library), so a link a
 * reader follows opens their copy of that name.
 *
 * Usernames share the site's first path segment with every top-level page, so
 * a handle can never be one of {@link RESERVED_USERNAMES} — those get a number
 * like any other taken handle — and an address whose first segment is one of
 * them is never read as a personal file. Handles are `[a-z0-9]` only, so they
 * never collide with `/@<handle>` profiles or a file like `/favicon.ico`.
 *
 * Built and read back here so the two halves cannot drift; the server assigns
 * handles with {@link pickUsername} (`apps/debate-web/lib/users/user-handles.ts`).
 *
 * @module lib/reason-docs/personal-doc-paths
 */

/**
 * First path segments that belong to a page, not a person: every top-level
 * route under `apps/debate-web/app` (a test keeps the two in step), plus words
 * kept free for pages that may come later.
 */
export const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  // apps/debate-web/app
  "about", "admin", "annotations", "api", "auth", "blog", "coaching", "contacts",
  "debate", "docs", "lectures", "legal", "login", "news", "notifications",
  "outline", "practice", "reason-editor", "research", "schools", "settings",
  "speech-documents", "summaries", "teams", "tournament", "videos",
  "word-count", "youtube-player",
  // Kept free
  "account", "app", "assets", "dashboard", "doc", "editor", "flow", "help",
  "home", "learn", "logout", "market", "me", "null", "pricing", "privacy",
  "profile", "register", "root", "round", "rounds", "search", "signin",
  "signout", "signup", "static", "support", "terms", "timer", "tournaments",
  "undefined", "user", "users", "www",
])

/** Longest handle made from a name, before any collision number. */
export const MAX_USERNAME_LENGTH = 30

const USERNAME_PATTERN = /^[a-z0-9]{1,40}$/

/** Whether `segment` is shaped like a handle and not a reserved page name. */
export function isUsername(segment: string | null | undefined): segment is string {
  return typeof segment === "string" && USERNAME_PATTERN.test(segment) && !RESERVED_USERNAMES.has(segment)
}

/**
 * The handle a name asks for, before collisions: lowercase letters and digits
 * only, accents folded — `Alex Gul` → `alexgul`, `José Núñez` → `josenunez`.
 * Falls back to the email's local part, then to `user`.
 */
export function usernameBase(name: string | null | undefined, email?: string | null): string {
  const clean = (value: string | null | undefined) =>
    (value ?? "")
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, MAX_USERNAME_LENGTH)
  return clean(name) || clean(email?.split("@")[0]) || "user"
}

/**
 * The first free handle for `base`: `base` itself, else `base2`, `base3`, …
 * Reserved page names count as taken, so `Admin` becomes `admin2`.
 */
export function pickUsername(base: string, isTaken: (handle: string) => boolean): string {
  const free = (handle: string) => !RESERVED_USERNAMES.has(handle) && !isTaken(handle)
  if (free(base)) return base
  for (let n = 2; ; n++) {
    const handle = `${base}${n}`
    if (free(handle)) return handle
  }
}

/** A personal-file address read back: the owner, and the file's path. */
export interface PersonalDocPath {
  /** The file's owner — their username. */
  username: string
  /** The file's path below the username (`aff/k-aff-answers`), folders
   *  included — the same ref `?doc=` carries. */
  path: string
}

/** Reads `/<username>/<path>` off a pathname, or `null` for anything else —
 *  including a bare `/<username>` and any first segment that is a page. */
export function parsePersonalDocPath(pathname: string | null | undefined): PersonalDocPath | null {
  if (!pathname) return null
  const raw = (pathname.split("?")[0]?.split("#")[0] ?? "").replace(/\/+$/, "")
  if (!raw.startsWith("/")) return null
  const [username, ...rest] = raw.slice(1).split("/")
  if (!isUsername(username)) return null
  const segments = rest.filter(Boolean).map((segment) => {
    try {
      return decodeURIComponent(segment)
    } catch {
      return segment
    }
  })
  if (segments.length === 0) return null
  return { username, path: segments.join("/") }
}

/** True on a personal-file address (`/alexgul/aff/k-aff-answers`). */
export function isPersonalDocPath(pathname: string | null | undefined): boolean {
  return parsePersonalDocPath(pathname) != null
}

/** `/<username>/<path>`, encoded segment-wise so the path's own slashes stay
 *  path structure. */
export function personalDocHref(username: string, path: string): string {
  return `/${username}/${path.split("/").filter(Boolean).map(encodeURIComponent).join("/")}`
}
