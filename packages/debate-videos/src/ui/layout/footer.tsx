"use client"

import Link from "next/link"
import React, { useEffect, useState } from "react"
import { FOOTER_LINKS } from "./footer-links"


export function Footer() {
  const [origin, setOrigin] = useState("")
  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  const midpoint = Math.ceil(FOOTER_LINKS.length / 2)
  const rows = [FOOTER_LINKS.slice(0, midpoint), FOOTER_LINKS.slice(midpoint)]

  return (
    <footer className="w-full py-6 border-t bg-background/50 backdrop-blur-sm text-muted-foreground text-xs font-medium">
      <div className="max-w-7xl mx-auto px-4 flex flex-col gap-y-2">
        {rows.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className="flex flex-wrap justify-center items-center gap-x-3 gap-y-2"
          >
            {row.map((link, index) => {
              const href = link.url.startsWith("/") && origin ? origin + link.url : link.url
              const Icon = link.icon
              return (
                <React.Fragment key={link.text}>
                  <Link
                    href={href}
                    target={href.startsWith("http") ? "_blank" : "_self"}
                    rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
                    className="hover:text-foreground transition-colors flex items-center gap-1"
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {link.text}
                  </Link>
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
