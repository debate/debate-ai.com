import type { Metadata } from "next"
import { ToolPage, ToolPageHeader } from "@/components/tools/ToolPageHeader"
import { SpeechSendLogPanel } from "./SpeechSendLogPanel"

export const metadata: Metadata = {
  title: "Speech Documents",
  description: "A history of evidence sent into your designated speech document from the Reason Editor's send-to-speech commands",
}

export default function SpeechDocumentsPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/speech-documents" backHref="/reason-editor" backLabel="Reason Editor" guide="training-tools" />
      <SpeechSendLogPanel />
    </ToolPage>
  )
}
