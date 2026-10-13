import { Suspense } from "react"
import LoginPage from "../../components/layout/LoginPage"

// LoginPage reads `callbackURL` with useSearchParams(), which fails the
// production render with a 500 unless a Suspense boundary sits above it.
export default function Page() {
  // LoginPage reads useSearchParams(), which needs a Suspense boundary.
  return (
    <Suspense fallback={null}>
      <LoginPage />
    </Suspense>
  );
}
