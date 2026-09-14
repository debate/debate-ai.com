"use client"

import Link from "next/link"
import React from "react"
import { FOOTER_LINKS } from "./footer-links"

/**
 * The link row under the sidebar tree.
 *
 * Three kinds of destination, and the difference is the whole of this
 * component: an outside site opens in a new tab; `/docs` is a statically
 * exported build served from `public/`, so it needs a real page load
 * (`hardNavigate`); every other row is an app route and is followed *in
 * place*, through the router. That last case used to be an `origin + url`
 * absolute href, which Next treats as an external URL — so "Features" tore
 * the whole app down and rebuilt it as a bare page, losing the sidebar and
 * stopping the persistent player mid-lecture. Relative hrefs keep them in the
 * app they were opened from.
 */
export function Footer() {
  const midpoint = Math.ceil(FOOTER_LINKS.length / 2)
  const rows = [FOOTER_LINKS.slice(0, midpoint), FOOTER_LINKS.slice(midpoint)]

  const linkClass = "hover:text-foreground transition-colors flex items-center gap-1"

  return (
    <footer className="w-full py-6 border-t bg-background/50 backdrop-blur-sm text-muted-foreground text-xs font-medium">
      <div className="max-w-7xl mx-auto px-4 flex flex-col gap-y-2">
        {rows.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className="flex flex-wrap justify-center items-center gap-x-3 gap-y-2"
          >
            {row.map((link, index) => {
              const Icon = link.icon
              const isExternal = link.url.startsWith("http")
              const contents = (
                <>
                  <Icon className="w-3.5 h-3.5" />
                  {link.text}
                </>
              )

              return (
                <React.Fragment key={link.text}>
                  {isExternal || link.hardNavigate ? (
                    <a
                      href={link.url}
                      target={isExternal ? "_blank" : "_self"}
                      rel={isExternal ? "noopener noreferrer" : undefined}
                      className={linkClass}
                    >
                      {contents}
                    </a>
                  ) : (
                    <Link href={link.url} prefetch={false} className={linkClass}>
                      {contents}
                    </Link>
                  )}
                  {index < row.length - 1 && (
                    <span className="text-muted-foreground/30 hidden sm:inline">•</span>
                  )}
                </React.Fragment>
              )
            })}
          </div>
        ))}
      </div>
    </footer>
  )
}
