import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Debate Preferences",
  description: "Debate style, font size and font family preferences for the flow editor",
}

export { default } from "debate-ai-webui/routes/settings/preferences/page"
