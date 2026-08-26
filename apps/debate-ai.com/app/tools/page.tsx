import type { Metadata } from "next"
import Link from "next/link"
import { Card, CardHeader, CardTitle, CardDescription } from "debate-ui/src/primitives/card"
import { Badge } from "debate-ui/src/primitives/badge"
import { TOOL_GROUPS } from "@/lib/tools-registry"
import { NEWS_ITEMS, findLatestNewsItemForHref } from "debate-card-search/src/lib/news-stream"

export const metadata: Metadata = {
  title: "Tools",
  description: "Every workspace, research, and practice tool in one place",
}

export default function ToolsPage() {
  return (
    <div className="min-h-screen bg-background p-3 sm:p-6 pb-24">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Tools</h1>
            <p className="mt-1 text-sm text-muted-foreground">Every workspace, research, and practice tool in one place.</p>
          </div>
          <Link
            href="/reason-editor"
            className="hidden sm:inline-flex h-9 items-center rounded-md border border-border px-3 text-xs text-muted-foreground hover:bg-accent"
            title="Open the command palette from anywhere in the app"
          >
            Press Ctrl/Cmd+Shift+Space for the command menu
          </Link>
        </div>
        <div className="flex flex-col gap-10">
          {TOOL_GROUPS.map((group) => (
            <section key={group.heading}>
              <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">{group.heading}</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.tools.map((tool) => {
                  const latestNews = findLatestNewsItemForHref(NEWS_ITEMS, tool.href)
                  return (
                    <Link key={tool.href} href={tool.href} className="block">
                      <Card className="h-full py-4 transition-colors hover:bg-accent hover:border-accent-foreground/20">
                        <CardHeader className="px-4">
                          <div className="flex items-center gap-2">
                            <tool.icon className="h-5 w-5 shrink-0 text-foreground" />
                            <CardTitle className="text-base">{tool.label}</CardTitle>
                            {latestNews && (
                              <Badge variant="outline" className="ml-auto shrink-0 text-[10px]">
                                Updated
                              </Badge>
                            )}
                          </div>
                          <CardDescription>{tool.description}</CardDescription>
                          {latestNews && (
                            <p className="mt-1 text-xs text-muted-foreground">{latestNews.summary}</p>
                          )}
                        </CardHeader>
                      </Card>
                    </Link>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
