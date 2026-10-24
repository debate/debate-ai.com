import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "File Market",
  description: "Buy research files from other debaters, or sell your own — every file's table of contents is free to read",
}

export { default } from "@debate-ai/webview/routes/market/page"
