/**
 * @fileoverview Common argument library browser — UI over `lib/argument-library.ts`.
 *
 * Presents the topic-folder / case-area tree and the tag collections the
 * library slice derives from a flat card list, with tag filtering in either
 * "any" or "all" mode.
 */

"use client";

import { useMemo, useState } from "react";
import { FolderTree } from "lucide-react";

import {
  EmptyState,
  PanelRow,
  PanelSection,
  PanelShell,
  Pill,
  StatGrid,
  StatTile,
  SummaryText,
} from "debate-ui/src/panels/panel-shell";
import { Button } from "debate-ui/src/primitives/button";

import {
  buildArgumentLibrary,
  buildLibrarySummaryText,
  filterCardsByTags,
  type LibraryCard,
  type TopicFolder,
} from "../lib/argument-library";

/** Props for {@link ArgumentLibraryPanel}. */
export interface ArgumentLibraryPanelProps {
  /** Every card in the library. */
  cards: LibraryCard[];
  /** Invoked when a card row is clicked. */
  onSelectCard?: (card: LibraryCard) => void;
  /** Extra classes for the panel. */
  className?: string;
}

/**
 * Browses cards as topic folders, case areas and tag collections.
 *
 * @param props - See {@link ArgumentLibraryPanelProps}.
 * @returns The argument library panel.
 */
export function ArgumentLibraryPanel({
  cards,
  onSelectCard,
  className,
}: ArgumentLibraryPanelProps) {
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [tagMode, setTagMode] = useState<"any" | "all">("any");
  const [openTopic, setOpenTopic] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);

  const filteredCards = useMemo(
    () => (activeTags.length === 0 ? cards : filterCardsByTags(cards, activeTags, tagMode)),
    [cards, activeTags, tagMode],
  );
  const library = useMemo(() => buildArgumentLibrary(filteredCards), [filteredCards]);
  const allTags = useMemo(() => buildArgumentLibrary(cards).tagCollections, [cards]);

  const toggleTag = (tag: string) =>
    setActiveTags((current) =>
      current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag],
    );

  return (
    <PanelShell
      title="Argument Library"
      description="Cards organised by topic folder, case area and tag."
      icon={<FolderTree className="h-4 w-4" />}
      className={className}
      data-testid="argument-library-panel"
      actions={
        <Button variant="ghost" size="sm" onClick={() => setShowSummary((v) => !v)}>
          {showSummary ? "Hide summary" : "Summary"}
        </Button>
      }
    >
      <StatGrid columns={3}>
        <StatTile label="Cards" value={filteredCards.length} hint={`${cards.length} total`} />
        <StatTile label="Topic folders" value={library.topicFolders.length} />
        <StatTile label="Tag collections" value={library.tagCollections.length} />
      </StatGrid>

      {allTags.length > 0 ? (
        <PanelSection
          title="Filter by tag"
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTagMode((m) => (m === "any" ? "all" : "any"))}
            >
              Match {tagMode}
            </Button>
          }
        >
          <div className="flex flex-wrap gap-1.5">
            {allTags.map((collection) => {
              const active = activeTags.includes(collection.tag);
              return (
                <button
                  key={collection.tag}
                  type="button"
                  onClick={() => toggleTag(collection.tag)}
                  aria-pressed={active}
                >
                  <Pill tone={active ? "info" : "neutral"}>
                    {collection.tag} · {collection.cards.length}
                  </Pill>
                </button>
              );
            })}
            {activeTags.length > 0 ? (
              <Button variant="ghost" size="sm" onClick={() => setActiveTags([])}>
                Clear
              </Button>
            ) : null}
          </div>
        </PanelSection>
      ) : null}

      <PanelSection title="Topic folders">
        {library.topicFolders.length === 0 ? (
          <EmptyState
            title="No cards match"
            message={
              activeTags.length > 0
                ? "Loosen the tag filter or switch to match any."
                : "Add cards to the library to browse them here."
            }
          />
        ) : (
          <div className="flex flex-col gap-2">
            {library.topicFolders.map((folder) => (
              <TopicFolderRow
                key={folder.topic}
                folder={folder}
                open={openTopic === folder.topic}
                onToggle={() =>
                  setOpenTopic((current) => (current === folder.topic ? null : folder.topic))
                }
                onSelectCard={onSelectCard}
              />
            ))}
          </div>
        )}
      </PanelSection>

      {showSummary ? (
        <SummaryText label="Plain-text summary" text={buildLibrarySummaryText(library)} />
      ) : null}
    </PanelShell>
  );
}

function TopicFolderRow({
  folder,
  open,
  onToggle,
  onSelectCard,
}: {
  folder: TopicFolder;
  open: boolean;
  onToggle: () => void;
  onSelectCard?: (card: LibraryCard) => void;
}) {
  return (
    <PanelRow
      title={
        <button type="button" className="text-left" onClick={onToggle} aria-expanded={open}>
          {open ? "▾" : "▸"} {folder.topic}
        </button>
      }
      subtitle={`${folder.caseAreas.length} case area${folder.caseAreas.length === 1 ? "" : "s"}`}
      trailing={<Pill tone="info">{folder.cardCount} cards</Pill>}
    >
      {open ? (
        <div className="flex flex-col gap-2 pl-3">
          {folder.caseAreas.map((group) => (
            <div key={group.caseArea} className="flex flex-col gap-1">
              <div className="text-muted-foreground text-xs font-semibold">{group.caseArea}</div>
              <ul className="flex flex-col gap-1">
                {group.cards.map((card) => (
                  <li key={card.id}>
                    <button
                      type="button"
                      className="hover:bg-muted/60 flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-xs"
                      onClick={() => onSelectCard?.(card)}
                    >
                      <span className="truncate">{card.argBlock}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {card.wordCount} w
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </PanelRow>
  );
}
