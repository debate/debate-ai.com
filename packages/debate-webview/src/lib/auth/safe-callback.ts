/**
 * A `?callbackURL=` value reduced to a same-site path, so a sign-in page can
 * never be turned into an open redirect: anything that isn't a path on this
 * origin (`https://…`, `//host`, `/\host`, `javascript:`) becomes "/".
 */
export function safeCallbackURL(value: string | null | undefined): string {
  if (!value) return "/"
  const trimmed = value.trim()
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.startsWith("/\\")) return "/"
  return trimmed
}
