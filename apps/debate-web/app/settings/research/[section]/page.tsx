import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Research Settings",
  description: "Models, search, MCP servers, skills and memory, and voice for the research agent",
}

export { default } from "@debate/webview/routes/settings/research/[section]/page"
