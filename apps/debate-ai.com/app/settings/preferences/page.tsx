import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Settings",
  description: "Redirects to the Preferences tab of Settings",
}

export { default } from "debate-webview/routes/settings/preferences/page"
