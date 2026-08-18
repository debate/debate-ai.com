"use client"

/**
 * @fileoverview Full-screen sign-in route (`/login`).
 *
 * Only page chrome lives here — the controls come from {@link LoginForm}, which
 * the settings-menu dialog renders too.
 */

import Image from "next/image"
import Link from "next/link"

import { Card, CardContent, CardHeader } from "debate-ui/src/primitives/card"
import { LoginForm } from "./LoginForm"
import { APP_NAME } from "@/lib/config/site"

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg overflow-hidden">
              <Image
                src="/apple-touch-icon.png"
                alt=""
                width={40}
                height={40}
                className="h-full w-full object-cover"
                unoptimized
              />
            </div>
            <span className="text-2xl font-bold">{APP_NAME}</span>
          </div>
          <p className="text-sm text-muted-foreground">Sign in to continue</p>
        </CardHeader>
        <CardContent>
          <LoginForm />

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
