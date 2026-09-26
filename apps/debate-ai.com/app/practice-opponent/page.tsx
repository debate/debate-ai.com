import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Opponent Persona Picker",
  description: "Pick the AI practice-opponent style for a session",
}

export { default } from "debate-webview/routes/practice-opponent/page"
