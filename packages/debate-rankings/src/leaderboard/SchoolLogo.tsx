/**
 * @fileoverview A school's logo (from `debate-icons`, via `getSchoolLogo`),
 * drawn beside its name rather than in place of it, so the name stays the
 * readable, searchable text (and the profile page keeps its `<h1>`). Renders
 * nothing for a school with no logo, or while the "Show school logos" setting
 * is off.
 */

import { useSchoolLogo } from "./lib/school-art-settings"

export function SchoolLogo({ school, className }: { school: string; className?: string }) {
  // Nothing while Settings → Preferences has school logos switched off.
  const logo = useSchoolLogo(school)
  if (!logo) return null
  if (typeof logo === "function") {
    const Logo = logo
    return <Logo aria-hidden className={className} />
  }
  const src = typeof logo === "string" ? logo : logo.src
  // Decorative: the school's name is always printed next to it.
  return <img src={src} alt="" aria-hidden className={className} />
}
