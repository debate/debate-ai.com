import { Suspense } from "react"
import TwoFactorPage from "../../../components/layout/auth/TwoFactorPage"

// TwoFactorPage reads `callbackURL` with useSearchParams(), which needs a
// Suspense boundary above it.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <TwoFactorPage />
    </Suspense>
  )
}
