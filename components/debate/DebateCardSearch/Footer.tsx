"use client"

import Link from "next/link"
import React, { useEffect, useState } from "react"
import { Code2, MessageSquare, Calendar, Trophy, BookOpen, BookMarked, MessageCircle, Shield, FileText } from "lucide-react"

const FOOTER_LINKS = [
  { url: "https://github.com/debate", text: "Github", icon: Code2 },
  { url: "https://www.reddit.com/r/Debate+policydebate", text: "Debate Reddit", icon: MessageSquare },
  { url: "https://www.tabroom.com/index/index.mhtml", text: "Tournaments", icon: Calendar },
  { url: "https://www.debate.land", text: "Rankings", icon: Trophy },
  { url: "https://debate-decoded.ghost.io", text: "Community Blog", icon: BookOpen },
  { url: "https://opencaselist.com", text: "Research", icon: BookMarked },
  { url: "https://discord.gg/SJdBqBz3tV", text: "Support", icon: MessageCircle },
  { url: "/legal/privacy", text: "Privacy", icon: Shield },
  { url: "https://docs.google.com/document/d/1hq7-DE6ls2ryVtOttxR4BNpRdP7xUbBr0M3SMYefek8/edit", text: "Rules", icon: FileText },
]


export function Footer() {
  const [origin, setOrigin] = useState("")
  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  return (
    <footer className="w-full py-6 border-t bg-background/50 backdrop-blur-sm text-muted-foreground text-[10px] uppercase tracking-wider font-medium">
      <div className="max-w-7xl mx-auto px-4 flex flex-wrap justify-center items-center gap-x-4 gap-y-2">
        {FOOTER_LINKS.map((link, index) => {
          const href = link.url.startsWith("/") && origin ? origin + link.url : link.url
          const Icon = link.icon
          return (
            <React.Fragment key={link.text}>
              <Link
                href={href}
                target={href.startsWith("http") ? "_blank" : "_self"}
                rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
                className="hover:text-foreground transition-colors flex items-center gap-1.5"
              >
                <Icon className="w-3 h-3" />
                {link.text}
              </Link>
              {index < FOOTER_LINKS.length - 1 && (
                <span className="text-muted-foreground/30 hidden sm:inline">•</span>
              )}
            </React.Fragment>
          )
        })}
      </div>
    </footer>
  )
}
