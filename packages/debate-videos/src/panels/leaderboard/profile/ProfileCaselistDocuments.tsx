/**
 * @fileoverview Caselist documents section of a team or school profile:
 * every DOCX file unpacked from openCaselist archives whose school/team
 * matches the profile, newest first.
 * @module panels/leaderboard/profile/ProfileCaselistDocuments
 */

"use client"

import { useEffect, useState } from "react"
import { Download, FileText, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "../../../ui/primitives/button"
import { Card, CardContent, CardHeader, CardTitle } from "../../../ui/primitives/card"
import { Badge } from "../../../ui/primitives/badge"
import { ScrollArea } from "../../../ui/primitives/scroll-area"

interface CaselistDocument {
  id: number
  pathHash: string
  caselistSlug: string
  caselistLabel: string
  school: string
  team: string | null
  side: string | null
  fileName: string
  archivePath: string
  html: string
  cardCount: number
  ingestedAt: number
  archiveDate: string | null
}

interface ProfileCaselistDocumentsProps {
  /** School name to search for. */
  school?: string
  /** Team name to search for. */
  team?: string
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function getSideBadge(side: string | null) {
  if (!side) return null
  return (
    <Badge variant={side === "Aff" ? "default" : "secondary"} className="text-xs">
      {side}
    </Badge>
  )
}

export function ProfileCaselistDocuments({ school, team }: ProfileCaselistDocumentsProps) {
  const [documents, setDocuments] = useState<CaselistDocument[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())
  const [total, setTotal] = useState(0)

  useEffect(() => {
    if (!school && !team) return

    const controller = new AbortController()

    async function fetchDocuments() {
      setIsLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams()
        if (school) params.set("school", school)
        if (team) params.set("team", team)
        params.set("limit", "50")

        const response = await fetch(`/api/caselist-documents?${params.toString()}`, {
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.status}`)
        }

        const data = await response.json()
        setDocuments(data.documents)
        setTotal(data.total)
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          setError(err.message)
        }
      } finally {
        setIsLoading(false)
      }
    }

    fetchDocuments()

    return () => controller.abort()
  }, [school, team])

  const toggleExpanded = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (!school && !team) return null

  const headerText = school
    ? `Files from ${school}${team ? ` / ${team}` : ""}`
    : `Files from ${team}`

  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold text-foreground">{headerText}</h2>
        <span className="text-sm text-muted-foreground">
          {isLoading ? "Loading…" : `${total} document${total !== 1 ? "s" : ""} found`}
        </span>
      </div>

      {error ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Error: {error}</p>
      ) : isLoading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Loading documents…</div>
      ) : documents.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No caselist documents found.</p>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => {
            const isExpanded = expandedIds.has(doc.id)
            return (
              <Card key={doc.id} className="overflow-hidden transition-all">
                <CardHeader
                  className="px-4 py-3 cursor-pointer hover:bg-muted/50"
                  onClick={() => toggleExpanded(doc.id)}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-base font-medium text-foreground truncate flex-1 min-w-0">
                      {doc.fileName}
                    </CardTitle>
                    {getSideBadge(doc.side)}
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      {doc.caselistLabel}
                    </Badge>
                    {doc.team && (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        {doc.team}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">
                      {formatDate(doc.ingestedAt)}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="px-4 pb-4 space-y-3 border-t">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">School:</span>{" "}
                        <span className="font-medium">{doc.school}</span>
                      </div>
                      {doc.team && (
                        <div>
                          <span className="text-muted-foreground">Team:</span>{" "}
                          <span className="font-medium">{doc.team}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-muted-foreground">Side:</span>{" "}
                        <span className="font-medium">{doc.side || "—"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Cards:</span>{" "}
                        <span className="font-medium">{doc.cardCount}</span>
                      </div>
                      {doc.archiveDate && (
                        <div>
                          <span className="text-muted-foreground">Archive:</span>{" "}
                          <span className="font-medium">{doc.archiveDate}</span>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t">
                      <ScrollArea className="max-h-96 rounded border bg-muted/30 p-3 font-mono text-sm">
                        <div dangerouslySetInnerHTML={{ __html: doc.html }} />
                      </ScrollArea>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const blob = new Blob([doc.html], { type: "text/html" })
                          const url = URL.createObjectURL(blob)
                          const a = document.createElement("a")
                          a.href = url
                          a.download = doc.fileName.replace(/\.docx$/i, ".html")
                          a.click()
                          URL.revokeObjectURL(url)
                        }}
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Download HTML
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(doc.html)
                        }}
                      >
                        Copy HTML
                      </Button>
                    </div>
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {total > documents.length && (
        <div className="mt-6 text-center text-sm text-muted-foreground">
          Showing {documents.length} of {total} documents.{" "}
          <a href={`/search?caselist=1${school ? `&school=${encodeURIComponent(school)}` : ""}${team ? `&team=${encodeURIComponent(team)}` : ""}`} className="underline">
            View all
          </a>
        </div>
      )}
    </section>
  )
}