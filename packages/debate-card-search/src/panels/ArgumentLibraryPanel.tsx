/**
 * @fileoverview Common Argument Library folder/collection browser — the UI
 * follow-up named "(b) a folder/collection browser UI" under the "📚 Common
 * Argument Library" bullet in TODO.md.
 *
 * Reads the persisted evidence repository together with every tagged
 * Contributions Feed submission via
 * `state/evidenceLibraryEntries.ts`'s `buildCombinedPersistedArgumentLibrary`
 * (itself a thin composition of `argument-library.ts`'s pure
 * `buildArgumentLibrary` against both persisted stores) and renders it as
 * topic folders (each split into case-area subgroups) plus cross-cutting tag
 * collections, reusing the existing organizing logic directly rather than
 * introducing new logic here. Closes follow-up (a) named under the "📚
 * Common Argument Library" bullet in TODO.md — a Contributions Feed
 * submission tagged with topic/case-area now appears here too, not just a
 * dedicated `/cards/library` evidence-library entry.
 *
 * A "Rename/merge tag" form closes `docs/features/evidence-library.md`'s
 * "No tag rename/merge tool" Known gap: picking an existing tag and typing a
 * new name calls `state/evidenceLibraryEntries.ts`'s
 * `renameTagAcrossCombinedPersistedStores`, rewriting the tag on every
 * persisted evidence-library entry *and* every Contributions Feed submission
 * that carries it — merging into an existing tag name instead of duplicating
 * it when the target is already in use. Rewriting both stores closes the
 * follow-on "only rewrites this evidence-library repository's own entries"
 * gap: this browser shows the combined library, so a tag listed here may come
 * from either store.
 *
 * @module panels/ArgumentLibraryPanel
 */

"use client"

import { useEffect, useState } from "react"
import { Badge } from "debate-ui/src/primitives/badge"
import { Button } from "debate-ui/src/primitives/button"
import { Input } from "debate-ui/src/primitives/input"
import { Label } from "debate-ui/src/primitives/label"
import {
  buildCombinedPersistedArgumentLibrary,
  renameTagAcrossCombinedPersistedStores,
} from "../state/evidenceLibraryEntries"
import { buildLibrarySummaryText, filterCardsByTags } from "../lib/argument-library"
import type { ArgumentLibrary, LibraryCard } from "../lib/argument-library"

/**
 * Renders the Common Argument Library: every persisted evidence entry
 * organized into topic folders (split into case-area subgroups) and
 * cross-cutting tag collections, with an optional tag filter.
 *
 * Reads localStorage on mount only (client-side), so it renders an empty
 * state during SSR/hydration rather than throwing.
 */
export function ArgumentLibraryPanel() {
  const [library, setLibrary] = useState<ArgumentLibrary | null>(null)
  const [activeTags, setActiveTags] = useState<string[]>([])
  const [renameOldTag, setRenameOldTag] = useState("")
  const [renameNewTag, setRenameNewTag] = useState("")
  const [renameMessage, setRenameMessage] = useState<string | null>(null)

  useEffect(() => {
    setLibrary(buildCombinedPersistedArgumentLibrary())
  }, [])

  function handleRenameTag() {
    try {
      const { entriesChanged, contributionsChanged, totalChanged } =
        renameTagAcrossCombinedPersistedStores(renameOldTag, renameNewTag)
      setLibrary(buildCombinedPersistedArgumentLibrary())
      setActiveTags((current) => current.map((tag) => (tag === renameOldTag.trim() ? renameNewTag.trim() : tag)))
      setRenameMessage(
        totalChanged === 0
          ? `Nothing carries "${renameOldTag.trim()}" — nothing changed.`
          : `Renamed "${renameOldTag.trim()}" to "${renameNewTag.trim()}" on ${entriesChanged} ${
              entriesChanged === 1 ? "evidence entry" : "evidence entries"
            } and ${contributionsChanged} ${
              contributionsChanged === 1 ? "contribution" : "contributions"
            }.`,
      )
      setRenameOldTag("")
      setRenameNewTag("")
    } catch (error) {
      setRenameMessage(error instanceof Error ? error.message : String(error))
    }
  }

  if (library === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading argument library…</div>
  }

  if (library.topicFolders.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        No argument library entries yet. The library fills in as cards and reusable blocks are
        submitted to the shared evidence repository, or as Contributions Feed submissions are
        tagged with a topic and case area.
      </div>
    )
  }

  function toggleTag(tag: string) {
    setActiveTags((current) =>
      current.includes(tag) ? current.filter((existing) => existing !== tag) : [...current, tag],
    )
  }

  const allCards = library.topicFolders.flatMap((folder) =>
    folder.caseAreas.flatMap((group) => group.cards),
  )
  const filteredCards = activeTags.length > 0 ? filterCardsByTags(allCards, activeTags, "any") : null

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div>
        <h1 className="mb-1 text-xl font-semibold text-foreground">Common Argument Library</h1>
        <p className="text-sm text-muted-foreground">{buildLibrarySummaryText(library)}</p>
      </div>

      {library.tagCollections.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {library.tagCollections.map((collection) => (
            <Button
              key={collection.tag}
              size="sm"
              variant={activeTags.includes(collection.tag) ? "default" : "outline"}
              onClick={() => toggleTag(collection.tag)}
            >
              {collection.tag} ({collection.cards.length})
            </Button>
          ))}
          {activeTags.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setActiveTags([])}>
              Clear filter
            </Button>
          )}
        </div>
      )}

      {library.tagCollections.length > 0 && (
        <div className="rounded-lg border border-border p-3 space-y-2">
          <div className="text-sm font-medium text-foreground">Rename/merge tag</div>
          <p className="text-xs text-muted-foreground">
            Rewrites the tag on every evidence-library entry and every Contributions Feed
            submission that carries it. Renaming into an existing tag name merges the two.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <Label htmlFor="rename-tag-old" className="text-xs">
                Existing tag
              </Label>
              <select
                id="rename-tag-old"
                value={renameOldTag}
                onChange={(e) => setRenameOldTag(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Choose a tag…</option>
                {library.tagCollections.map((collection) => (
                  <option key={collection.tag} value={collection.tag}>
                    {collection.tag} ({collection.cards.length})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="rename-tag-new" className="text-xs">
                New name
              </Label>
              <Input
                id="rename-tag-new"
                value={renameNewTag}
                onChange={(e) => setRenameNewTag(e.target.value)}
                placeholder="new-tag-name"
                className="h-9"
              />
            </div>
            <Button
              size="sm"
              disabled={!renameOldTag.trim() || !renameNewTag.trim()}
              onClick={handleRenameTag}
            >
              Rename/merge
            </Button>
          </div>
          {renameMessage && <p className="text-xs text-muted-foreground">{renameMessage}</p>}
        </div>
      )}

      {filteredCards ? (
        <TagFilterResults cards={filteredCards} tags={activeTags} />
      ) : (
        <div className="space-y-4">
          {library.topicFolders.map((folder) => (
            <div key={folder.topic} className="rounded-lg border border-border p-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="font-medium text-foreground">{folder.topic}</span>
                <Badge variant="outline">
                  {folder.cardCount} card{folder.cardCount === 1 ? "" : "s"}
                </Badge>
              </div>
              <div className="space-y-3">
                {folder.caseAreas.map((group) => (
                  <div key={group.caseArea}>
                    <div className="mb-1 text-xs font-medium uppercase text-muted-foreground">
                      {group.caseArea}
                    </div>
                    <div className="space-y-1.5">
                      {group.cards.map((card) => (
                        <LibraryCardRow key={card.id} card={card} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TagFilterResults({ cards, tags }: { cards: LibraryCard[]; tags: string[] }) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        {cards.length} card{cards.length === 1 ? "" : "s"} tagged {tags.join(", ")}
      </p>
      {cards.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No cards match this tag filter.
        </div>
      ) : (
        <div className="space-y-1.5">
          {cards.map((card) => (
            <LibraryCardRow key={card.id} card={card} />
          ))}
        </div>
      )}
    </div>
  )
}

function LibraryCardRow({ card }: { card: LibraryCard }) {
  return (
    <div className="rounded-md border border-border p-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-foreground">{card.argBlock}</span>
        <Badge variant="outline">{card.topic}</Badge>
        <Badge variant="outline">{card.caseArea}</Badge>
      </div>
      {card.tags.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {card.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
