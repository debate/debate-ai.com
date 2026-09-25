import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Judge Profiles",
  description: "Side-vote bias, average speaker points, and tendencies for every saved judge profile",
}

export { default } from "debate-ai-webui/routes/judges/page"
