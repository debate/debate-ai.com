import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Group Challenges",
  description: "Create squad-scoped friendly challenges like completing a set of blocks or winning a rebuttal exercise",
}

export { default } from "debate-webview/routes/cards/group-challenges/page"
