import type React from "react"
import type { Metadata, Viewport } from "next"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { CategoryDockProvider, PersistentVideoPlayer } from "debate-videos"
import { CategoryDock } from "@/components/layout/CategoryDock"
import { AppSidebarShell } from "@/components/layout/AppSidebarShell"
import { OneTap } from "@/components/layout/OneTap"
import { ServiceWorkerRegistrar } from "@/components/layout/ServiceWorkerRegistrar"
import { Toaster } from "sonner"

export const metadata: Metadata = {
  title: "Debate AI",
  description: "Debate round and research management",
  manifest: "/site.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Debate AI",
  },
  icons: {
    apple: [{ url: "/apple-touch-icon.png" }],
  },
}

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Applies the persisted font-family choice before paint (avoiding a
            flash of the default font) and keeps it in sync with the picker in
            `UserSettingsPanel` — ported from qwksearch-research-agent's
            `apps/qwksearch-web/app/layout.tsx` bootstrap script. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){function apply(){try{var f=localStorage.getItem('fontFamily');var v=f&&f!=='system-default'?f:'';document.documentElement.style.fontFamily=v;if(document.body)document.body.style.fontFamily=v;}catch(e){}}apply();window.addEventListener('client-config-changed',apply);window.addEventListener('storage',apply);})();`,
          }}
        />
        {/* The qwksearch embed's API base URL is set by
            components/qwksearch/base-url.ts, imported first from the /doc
            chunk itself — a head script here couldn't cover client-side
            navigation into /doc, where the chunk (and the api-client module
            inside it) evaluates long after any head script ran. */}
      </head>
      <body className="theme-root">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <CategoryDockProvider>
            <div className="w-screen h-screen overflow-auto pb-[70px] md:pb-0">
              <CategoryDock />
              <AppSidebarShell>{children}</AppSidebarShell>
            </div>
            <PersistentVideoPlayer />
            <OneTap />
            <ServiceWorkerRegistrar />
            {/* Sign-in and sign-out report through toasts; without a mounted
                toaster every one of those messages was dropped silently. */}
            <Toaster position="top-center" richColors closeButton />
          </CategoryDockProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
