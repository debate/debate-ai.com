import type React from "react"
import type { Metadata, Viewport } from "next"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { CategoryDockProvider } from "@/components/category-dock-context"
import { CategoryDock } from "@/components/debate/DebateVideos/components/CategoryDock"
import Template from "./template"

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
            <div className="w-screen h-screen overflow-auto pb-[70px] md:pb-0">
              <CategoryDock />
              <Template>{children}</Template>
            </div>
          </CategoryDockProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
