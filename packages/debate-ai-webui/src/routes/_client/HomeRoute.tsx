"use client"

import { redirect } from "next/navigation"

/** `/` — the web app redirects on the server (`app/page.tsx`); same target. */
export default function HomeRoute(): never {
  redirect("/videos")
}
