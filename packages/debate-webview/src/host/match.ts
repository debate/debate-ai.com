/**
 * @fileoverview Matches an app path against Next-style route patterns.
 *
 * The route table (`routes/index.ts`) is written in the same shapes as the
 * web app's `app/` directory — `/videos/[category]`,
 * `/tournaments/[[...slug]]` — so the two stay easy to compare and the params
 * a page reads through `useParams()` have the same names in both hosts.
 *
 * A dynamic segment may also carry a literal prefix, written `@[team]` for
 * the `@<team>` profile handles: `app/` cannot name a folder `@team` (Next
 * reserves a leading `@` for parallel-route slots), so the handle pages are
 * served from `/teams/[team]` and rewritten; this host matches them directly.
 */

export type RouteParams = Record<string, string | string[]>

interface Segment {
  kind: "static" | "dynamic" | "catchAll" | "optionalCatchAll"
  name: string
  /** Literal text a dynamic segment must start with, e.g. `@` in `@[team]`. */
  prefix?: string
}

function parse(pattern: string): Segment[] {
  return pattern
    .split("/")
    .filter(Boolean)
    .map((part): Segment => {
      const optional = part.match(/^\[\[\.\.\.(.+)\]\]$/)
      if (optional) return { kind: "optionalCatchAll", name: optional[1] }
      const catchAll = part.match(/^\[\.\.\.(.+)\]$/)
      if (catchAll) return { kind: "catchAll", name: catchAll[1] }
      const dynamic = part.match(/^\[(.+)\]$/)
      if (dynamic) return { kind: "dynamic", name: dynamic[1] }
      // A dynamic segment with a literal prefix, e.g. `@[team]`.
      const prefixed = part.match(/^([^[]+)\[(.+)\]$/)
      if (prefixed) {
        return { kind: "dynamic", name: prefixed[2], prefix: prefixed[1] }
      }
      return { kind: "static", name: part }
    })
}

function decode(part: string): string {
  try {
    return decodeURIComponent(part)
  } catch {
    return part
  }
}

/** The params `pathname` binds in `pattern`, or `null` when it doesn't match. */
export function matchRoute(pattern: string, pathname: string): RouteParams | null {
  const segments = parse(pattern)
  const parts = pathname.split("/").filter(Boolean)
  const params: RouteParams = {}

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    if (segment.kind === "catchAll" || segment.kind === "optionalCatchAll") {
      const rest = parts.slice(i).map(decode)
      if (segment.kind === "catchAll" && rest.length === 0) return null
      if (rest.length) params[segment.name] = rest
      return params
    }
    const part = parts[i]
    if (part === undefined) return null
    if (segment.kind === "static") {
      if (part !== segment.name) return null
    } else {
      // A prefixed dynamic segment (`@[team]`) binds what follows
      // its literal prefix, and only matches a part that has it.
      if (segment.prefix) {
        const rest = part.slice(segment.prefix.length)
        if (!part.startsWith(segment.prefix) || rest === "") return null
        params[segment.name] = decode(rest)
      } else {
        params[segment.name] = decode(part)
      }
    }
  }
  return parts.length === segments.length ? params : null
}

/**
 * Orders patterns so the most specific wins, as Next does: static segments
 * before dynamic ones before catch-alls, compared position by position.
 */
export function compareSpecificity(a: string, b: string): number {
  const rank = { static: 0, dynamic: 1, catchAll: 2, optionalCatchAll: 3 }
  const sa = parse(a)
  const sb = parse(b)
  for (let i = 0; i < Math.max(sa.length, sb.length); i++) {
    const ka = sa[i] ? rank[sa[i].kind] : -1
    const kb = sb[i] ? rank[sb[i].kind] : -1
    if (ka !== kb) return ka - kb
  }
  return sb.length - sa.length
}
