import type { Metadata } from "next"
import Link from "next/link"
import { Card, CardHeader, CardTitle, CardDescription } from "../../lib/ui/primitives/card"
import { FavoriteToolButton } from "@/components/tools/FavoriteToolButton"
import { FavoritesController } from "@/components/tools/FavoritesController"
import { MySavedItems } from "./MySavedItems"
import { ToolsSearch } from "./ToolsSearch"
import { ALL_TOOLS, TOOL_GROUPS } from "./tool-groups"

export const metadata: Metadata = {
  title: "Tools",
  description: "Every workspace, research, and practice tool in one place",
}

export default function ToolsPage() {
  return (
    <div className="min-h-screen bg-background p-3 sm:p-6 pb-24">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-foreground">Tools</h1>
          <p className="mt-1 text-sm text-muted-foreground">Every workspace, research, and practice tool in one place.</p>
        </div>
        <MySavedItems />
        <ToolsSearch />

        {/* Hidden until FavoritesController (mounted below) finds a match —
            avoids a flash of an empty "Favorites" heading before the
            client-only favorites list (localStorage + account) loads. */}
        <section data-favorites-section hidden className="mb-8">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">Favorites</h2>
          <div className="flex flex-wrap gap-2">
            {ALL_TOOLS.map((tool) => (
              <div key={tool.href} hidden data-tool-href={tool.href} className="relative shrink-0">
                <Link
                  href={tool.href}
                  className="flex items-center gap-2 rounded-full border border-border bg-background py-1.5 pl-3 pr-9 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:border-accent-foreground/20"
                >
                  <tool.icon className="h-4 w-4 shrink-0" />
                  {tool.label}
                </Link>
                <FavoriteToolButton
                  href={tool.href}
                  label={tool.label}
                  className="absolute right-1 top-1/2 -translate-y-1/2"
                />
              </div>
            ))}
          </div>
        </section>
        <FavoritesController />

        <div className="flex flex-col gap-10" data-tools-grid>
          {TOOL_GROUPS.map((group) => (
            <section key={group.heading} data-tool-section>
              <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">{group.heading}</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.tools.map((tool) => (
                  <div
                    key={tool.href}
                    className="relative h-full"
                    data-tool-search={[tool.label, tool.description, ...(tool.highlights ?? [])].join(" ").toLowerCase()}
                  >
                    <Link href={tool.href} className="block h-full">
                      <Card className="h-full py-4 transition-colors hover:bg-accent hover:border-accent-foreground/20">
                        <CardHeader className="px-4">
                          <div className="flex items-center gap-2 pr-7">
                            <tool.icon className="h-5 w-5 shrink-0 text-foreground" />
                            <CardTitle className="text-base">{tool.label}</CardTitle>
                          </div>
                          <CardDescription>{tool.description}</CardDescription>
                          {tool.highlights && tool.highlights.length > 0 && (
                            <ul className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
                              {tool.highlights.map((highlight) => (
                                <li key={highlight} className="flex gap-1.5">
                                  <span aria-hidden="true">·</span>
                                  <span>{highlight}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </CardHeader>
                      </Card>
                    </Link>
                    <FavoriteToolButton href={tool.href} label={tool.label} className="absolute right-2 top-2" />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
