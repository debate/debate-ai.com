"use client"

import { useParams } from "next/navigation"
import { ToolPage } from "../../../components/tools/ToolPageHeader"
import { SchoolProfileView } from "../../../components/schools/SchoolProfileView"

/**
 * The old `/schools/<school>` address. The web app 308s it to the school's
 * `@school` handle (see `next.config.mjs`); hosts without Next still route it
 * here, so it keeps rendering the same profile.
 */
export default function SchoolProfile() {
  const { school } = useParams<{ school: string }>()
  return (
    <ToolPage>
      <SchoolProfileView slug={school ?? ""} />
    </ToolPage>
  )
}
