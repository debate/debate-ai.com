import { redirect } from "next/navigation"

/**
 * `/settings/preferences` — the app's debate preferences (debate style, font
 * size, font family, color theme, light/dark) used to live on this page. They
 * are now the first tab of `/settings`, so this route only redirects there,
 * keeping old links and bookmarks working.
 */
export default function DebatePreferencesPage(): never {
  redirect("/settings?category=preferences")
}
