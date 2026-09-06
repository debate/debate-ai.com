/**
 * @file footer.tsx
 * @description Footer component for the documentation landing page.
 */
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Github, BookOpen } from "lucide-react"

export function Footer() {
  return (
    <footer className="py-20 md:py-32">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-bold mb-6 text-balance">
            Explore the <span className="text-primary">Docs</span>
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Feature specs, package references, and more for debate-ai.com.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link href="/docs">
              <Button size="lg" className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                <BookOpen className="h-4 w-4" />
                Read the Docs
              </Button>
            </Link>
            <Link href="https://github.com/debate/debate-ai.com" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="lg" className="gap-2 bg-transparent">
                <Github className="h-4 w-4" />
                Star on GitHub
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
