import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Speech Documents",
  description: "A history of evidence sent into your designated speech document from the Reason Editor's send-to-speech commands",
}

export { default } from "debate-ai-webui/routes/speech-documents/page"
