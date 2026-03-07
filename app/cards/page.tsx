import { Suspense } from "react"
import { SearchInterface } from "@/components/debate/DebateCARDSearch/SearchInterface"

export default function SearchPage() {
  return (
    <Suspense>
      <SearchInterface />
    </Suspense>
  )
}
