/**
 * @fileoverview A school's logo (from `debate-icons`, via `getSchoolLogo`),
 * drawn beside its name rather than in place of it, so the name stays the
 * readable, searchable text (and the profile page keeps its `<h1>`). Renders
 * nothing for a school with no logo.
 */

import { getSchoolLogo } from "./lib/schoolLogos"

export function SchoolLogo({ school, className }: { school: string; className?: string }) {
  const logo = getSchoolLogo(school)
  if (!logo) return null
  if (typeof logo === "function") {
    const Logo = logo
    return <Logo aria-hidden className={className} />
  }
  const src = typeof logo === "string" ? logo : logo.src
  // Decorative: the school's name is always printed next to it.
  return <img src={src} alt="" aria-hidden className={className} />
}
