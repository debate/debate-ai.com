import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Judge Paradigm Picker",
  description: "Pick a built-in or custom AI judge paradigm for a practice round",
}

export { default } from "debate-ai-webui/routes/paradigms/page"
