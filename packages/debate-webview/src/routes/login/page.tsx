import { Suspense } from "react"
import LoginPage from "../../components/layout/LoginPage"

export default function Page() {
  // LoginPage reads useSearchParams(), which needs a Suspense boundary.
  return (
    <Suspense fallback={null}>
      <LoginPage />
    </Suspense>
  );
}
