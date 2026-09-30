"use client"

/**
 * @fileoverview Full-screen sign-in route (`/login`).
 *
 * Only page chrome lives here — the controls come from {@link LoginForm}, which
 * the settings-menu dialog renders too.
 */

import Image from "next/image"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

import { Card, CardContent, CardHeader } from "../../lib/ui/primitives/card"
import { LoginForm } from "./LoginForm"
import { APP_LOGO, APP_LOGO_HEIGHT, APP_LOGO_WIDTH, APP_NAME } from "../../lib/config/site"
import { describeSignInError } from "../../lib/auth/sign-in-errors"

export default function LoginPage() {
  const searchParams = useSearchParams()

  // Set by native-wrapper's LoginForm when it opens this page in the system
  // browser (see LoginForm.tsx) — carries the sign-in through to
  // /auth/native-complete instead of the default "/". Any other caller of
  // /login can use the same param to land somewhere specific after sign-in.
  const callbackURL = searchParams.get("callbackURL") ?? "/"

  // A sign-in that failed on the way back from the provider lands here rather
  // than on better-auth's built-in error page — see `onAPIError` in
  // lib/auth/index.ts. Most of these codes mean "start over", and the buttons
  // to do that are already on this page, so all that is missing is saying so.
  const errorMessage = describeSignInError(searchParams.get("error"))

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-col items-center gap-4">
          <Image
            src={APP_LOGO}
            alt={APP_NAME}
            width={APP_LOGO_WIDTH}
            height={APP_LOGO_HEIGHT}
            className="h-auto w-full max-w-[260px]"
            priority
            unoptimized
          />
          <p className="text-sm text-muted-foreground">Sign in to continue</p>
        </CardHeader>
        <CardContent>
          {errorMessage && (
            <p
              role="alert"
              className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {errorMessage}
            </p>
          )}

          <LoginForm callbackURL={callbackURL} />

          <div className="mt-6 text-center text-sm text-muted-foreground">
            <Link href="/" className="underline hover:text-foreground">
              Homepage
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
