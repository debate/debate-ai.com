import type React from "react"
import type { Metadata, Viewport } from "next"
import "@debate/webview/styles/app.css"
import { ThemeProvider } from "@debate/webview/components/theme-provider"
import { AppShell } from "@debate/webview/components/layout/AppShell"
import { Amplitude } from "@/app/amplitude"
import { LoadingProvider } from "@debate/webview/components/layout/LoadingProvider"
import { webFontsBootstrapScript } from "@debate/webview/styles/web-fonts"
import { siteOrigin } from "@/lib/seo/site-url"

export const metadata: Metadata = {
  // Every relative `alternates.canonical` and Open Graph URL in the app
  // resolves against this. Without it, a page's canonical is built from
  // Next's `http://localhost:3000` fallback — which is what the video pages
  // were publishing, telling Google the canonical of every round and lecture
  // lives on a development URL.
  //
  // Read through `siteOrigin()` rather than a constant so it follows
  // CANONICAL_SITE_URL when a deployment sets one; the Worker entry publishes
  // the bindings before any request work, so the value is resolved by the time
  // this module is first imported.
  metadataBase: new URL(siteOrigin()),
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
        {/* The font picker's and colour themes' Google webfonts, attached so
            they don't hold up first paint (see styles/web-fonts.ts). */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <script dangerouslySetInnerHTML={{ __html: webFontsBootstrapScript() }} />
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
          {/* The navigation progress bar sits above the whole app shell, so
              every page transition that runs past its show delay (150 ms)
              shows a slim bar across the top instead of a page that looks
              stuck. Quicker transitions never show it. */}
          <LoadingProvider />
          <Amplitude />
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  )
}
