import { Suspense } from "react"
import { SearchInterface } from "@/components/debate/DebateCardSearch/SearchInterface"

export default function SearchPage() {
  return (
    <Suspense>
      <SearchInterface />
    </Suspense>
  )
}
