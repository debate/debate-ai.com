import { Suspense } from "react"
import { ToolPage, ToolPageHeader } from "../../components/tools/ToolPageHeader"
import { SpeechSendLogPanel } from "./SpeechSendLogPanel"

export default function SpeechDocumentsPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/speech-documents" backHref="/reason-editor" backLabel="Reason Editor" guide="training-tools" />
      {/* SpeechSendLogPanel reads `?entry=` through useSearchParams, which needs a Suspense boundary. */}
      <Suspense>
        <SpeechSendLogPanel />
      </Suspense>
    </ToolPage>
  )
}
