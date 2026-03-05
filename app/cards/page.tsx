import { Suspense } from "react"
import { SearchInterface } from "@/components/debate/SharedResearch/SearchInterface"

export default function SearchPage() {
  return (
    <Suspense>
      <SearchInterface />
    </Suspense>
  )
}
