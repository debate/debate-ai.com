/**
 * A URL slug for a new organization: the name, lowercased and hyphenated,
 * plus a short random tail. better-auth requires slugs to be unique, and two
 * teams called "Debate Team" is normal, so the tail is what keeps them apart.
 */
export function slugifyOrganizationName(name: string, random: () => number = Math.random): string {
  const base = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "")
  const tail = Math.floor(random() * 36 ** 6)
    .toString(36)
    .padStart(6, "0")
  return base ? `${base}-${tail}` : `org-${tail}`
}
