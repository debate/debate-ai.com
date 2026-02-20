import type { Metadata } from "next"


export const metadata: Metadata = {
  title: "REASON Docs",
  description: "Research Evidence And Speech Organizer Notes",
}

export default function EditorPage() {
  return (
    <div className="fixed inset-0 lg:left-[72px] flex flex-col pb-20 lg:pb-0">
      <iframe
        src="https://editor.qwksearch.com"
        className="w-full h-full border-0"
        title="Editor"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  )
}
