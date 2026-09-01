import type React from "react"
import type { Metadata, Viewport } from "next"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { CategoryDockProvider, PersistentVideoPlayer } from "debate-videos"
import { CategoryDock } from "@/components/layout/CategoryDock"
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
      <body className="theme-root">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <CategoryDockProvider>
            <div className="flex w-screen h-screen overflow-hidden">
              <CategoryDock />
              <main className="flex-1 min-w-0 h-screen overflow-y-auto pb-[70px] md:pb-0">
                {children}
              </main>
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
