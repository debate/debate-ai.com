/**
 * @file page.tsx
 * @description Home page component for the documentation site.
 */
import { HeroSection } from "@/components/DocsHomepage/hero-section"
import { FeaturesGrid } from "@/components/DocsHomepage/features-grid"
import { ToolGuides } from "@/components/DocsHomepage/tool-guides"
import { Footer } from "@/components/DocsHomepage/footer"
import "./docs-home.css"

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <HeroSection />
      <ToolGuides />
      <FeaturesGrid />
      <Footer />
    </main>
  )
}
