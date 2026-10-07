"use client"

import Link from "next/link"
import React from "react"
import { FOOTER_LINKS } from "./footer-links"

/**
 * The link row under the sidebar tree.
 *
 * Three kinds of destination, and the difference is the whole of this
 * component: an outside site opens in a new tab; `/docs` is the help site,
 * which renders without the app shell, so it needs a real page load
 * (`hardNavigate`); every other row is an app route and is followed *in
 * place*, through the router. That last case used to be an `origin + url`
 * absolute href, which Next treats as an external URL — so "Features" tore
 * the whole app down and rebuilt it as a bare page, losing the sidebar and
 * stopping the persistent player mid-lecture. Relative hrefs keep them in the
 * app they were opened from.
 *
 * The links sit on one condensed line (tight gaps, minimal padding) so the
 * row fits under a 300px sidebar; on anything narrower it wraps rather than
 * overflowing.
 */
export function Footer() {
  // A small pill that lifts and tints on hover, with the icon nudging larger.
  const linkClass =
    "group flex items-center gap-0.5 whitespace-nowrap rounded px-0.5 py-0.5 transition-all duration-200 ease-out hover:-translate-y-px hover:bg-muted hover:text-foreground motion-reduce:transition-none motion-reduce:hover:translate-y-0"

  return (
    <footer className="w-full py-1.5 border-t bg-background/50 backdrop-blur-sm text-muted-foreground text-xs font-medium">
      <div className="max-w-7xl mx-auto px-2 flex flex-wrap justify-center items-center gap-x-0.5 gap-y-0.5">
        {FOOTER_LINKS.map((link) => {
          const Icon = link.icon
          const isExternal = link.url.startsWith("http")
          const contents = (
            <>
              <Icon className="w-3.5 h-3.5 transition-transform duration-200 group-hover:scale-110 motion-reduce:transition-none" />
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
            </React.Fragment>
          )
        })}
      </div>
    </footer>
  )
}
