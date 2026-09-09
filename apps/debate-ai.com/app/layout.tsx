import type React from "react"
import type { Metadata, Viewport } from "next"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { AppShell } from "@/components/layout/AppShell"

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
        {/* Applies the persisted colour theme's `theme-<name>` class to <html>
            before paint. `useThemeState` re-applies the same class on mount,
            but only after hydration — and since `globals.css` now takes the
            body typeface from the theme's `--font-sans`, waiting for that
            effect would show a flash of the fallback font (and of the fallback
            palette) on every load. The name is read back from localStorage, so
            it is sanitised to the kebab-case shape `THEME_NAMES` uses before
            being turned into a class. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('color-theme');if(!t||!/^[a-z0-9-]+$/.test(t))t='modern-minimal';document.documentElement.classList.add('theme-'+t);}catch(e){document.documentElement.classList.add('theme-modern-minimal');}})();`,
          }}
        />
        {/* Applies the persisted font-family choice before paint (avoiding a
            flash of the default font) and keeps it in sync with the picker in
            `UserSettingsPanel` — ported from qwksearch-research-agent's
            `apps/qwksearch-web/app/layout.tsx` bootstrap script. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){function apply(){try{var f=localStorage.getItem('fontFamily');var v=f&&f!=='system-default'?f:'';document.documentElement.style.fontFamily=v;if(document.body)document.body.style.fontFamily=v;}catch(e){}}apply();window.addEventListener('client-config-changed',apply);window.addEventListener('storage',apply);})();`,
          }}
        />
        {/* Marks a document that the app shell is running inside a frame,
            before first paint. The shell's dock, sidebar and player stay in
            the top document; without this the framed page would render its
            own copies for the frame or two it takes React to mount and find
            out it is embedded. `AppShell` unmounts them right after. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(window.self!==window.top)document.documentElement.setAttribute('data-embedded','1');}catch(e){document.documentElement.setAttribute('data-embedded','1');}})();`,
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
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  )
}
