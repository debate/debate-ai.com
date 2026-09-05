/**
 * @file hero-section.tsx
 * @description Hero section component for the documentation landing page.
 */
"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Github, BookOpen } from "lucide-react"

export function HeroSection() {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <div className="absolute inset-0 animated-grid-bg" />
      <div className="absolute inset-0 grid-glow" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/50 to-background" />

      <div className="container mx-auto px-4  relative">
        <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
          <Badge variant="outline" className="mb-6 px-4 py-1.5 border-primary/30 text-primary">
            Documentation
          </Badge>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-balance mb-4">
            <span className="shimmer-text">Debate AI</span> Docs
          </h1>

          <p className="text-base md:text-lg text-muted-foreground max-w-2xl mb-6 text-pretty">
            Feature specs and package references for debate-ai.com — CARDS, FIAT, LEARN, STREAM, and REASON.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4 mb-12">
            <Button onClick={() => window.location.href = "/docs"} size="lg" className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
              <BookOpen className="h-4 w-4" />
              Documentation
            </Button>

            <Button onClick={() => window.location.href = "https://github.com/debate/debate-ai.com"} variant="outline" size="lg" className="gap-2 bg-transparent">
              <Github className="h-4 w-4" />
              GitHub
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
