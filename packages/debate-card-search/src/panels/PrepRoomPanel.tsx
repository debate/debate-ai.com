/**
 * @fileoverview Collaboration prep room — UI over `lib/prep-room.ts`.
 *
 * One topic-scoped workspace combining the evidence for that topic, the draft
 * blocks pulled out of it, and the task routing for the topic's coverage gaps.
 */

"use client";

import { useMemo, useState } from "react";
import { Users } from "lucide-react";

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
import { useStoreSnapshot } from "debate-ui/src/panels/use-store-snapshot";
import { Button } from "debate-ui/src/primitives/button";
import { Input } from "debate-ui/src/primitives/input";

import {
  buildPrepRoom,
  buildPrepRoomSummaryText,
  searchPrepRoomEvidence,
} from "../lib/prep-room";
import type { EvidenceLibraryEntry } from "../lib/shared-evidence-library";
import type { ContributorAvailability } from "../lib/research-task-routing";
import type { TopicCoverageReport } from "../lib/topic-coverage";
import { listEvidenceLibraryEntries } from "../state/evidenceLibraryEntries";
import { listContributorAvailability } from "../state/contributorAvailability";

/** Props for {@link PrepRoomPanel}. */
export interface PrepRoomPanelProps {
  /** Topic the room is scoped to. */
  topic: string;
  /** Evidence pool. Defaults to the persisted evidence library. */
  entries?: EvidenceLibraryEntry[];
  /** Coverage report for the topic, used for the routing column. */
  coverageReport: TopicCoverageReport;
  /** Contributors available for routing. Defaults to persisted profiles. */
  contributors?: ContributorAvailability[];
  /** Invoked when an evidence row is clicked. */
  onSelectEntry?: (entry: EvidenceLibraryEntry) => void;
  /** Extra classes for the panel. */
  className?: string;
}

/**
 * Topic-scoped prep room: evidence, draft blocks and assignments together.
 *
 * @param props - See {@link PrepRoomPanelProps}.
 * @returns The prep room panel.
 */
export function PrepRoomPanel({
  topic,
  entries,
  coverageReport,
  contributors,
  onSelectEntry,
  className,
}: PrepRoomPanelProps) {
  const { data: persistedEntries } = useStoreSnapshot<EvidenceLibraryEntry[]>(
    listEvidenceLibraryEntries,
    [],
  );
  const { data: persistedContributors } = useStoreSnapshot<ContributorAvailability[]>(
    listContributorAvailability,
    [],
  );
  const [search, setSearch] = useState("");

  const room = useMemo(
    () =>
      buildPrepRoom({
        topic,
        entries: entries ?? persistedEntries,
        coverageReport,
        contributors: contributors ?? persistedContributors,
      }),
    [topic, entries, persistedEntries, coverageReport, contributors, persistedContributors],
  );

  const results = useMemo(
    () => (search.trim() ? searchPrepRoomEvidence(room, { text: search.trim() }) : []),
    [room, search],
  );

  return (
    <PanelShell
      title={`Prep Room — ${topic}`}
      description="Evidence, draft blocks and task assignments for one topic."
      icon={<Users className="h-4 w-4" />}
      className={className}
      data-testid="prep-room-panel"
    >
      <StatGrid columns={4}>
        <StatTile label="Evidence" value={room.entries.length} />
        <StatTile label="Draft blocks" value={room.draftBlocks.length} tone="info" />
        <StatTile label="Assigned" value={room.routing.assignments.length} tone="positive" />
        <StatTile
          label="Unassigned"
          value={room.routing.unassignedTasks.length}
          tone={room.routing.unassignedTasks.length > 0 ? "warning" : "neutral"}
        />
      </StatGrid>

      <PanelSection title="Search this room">
        <div className="flex items-center gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search evidence in this topic"
          />
          {search ? (
            <Button variant="ghost" size="sm" onClick={() => setSearch("")}>
              Clear
            </Button>
          ) : null}
        </div>
        {search.trim() ? (
          results.length === 0 ? (
            <EmptyState title="No matches in this room" />
          ) : (
            <div className="flex flex-col gap-1">
              {results.map(({ entry, relevanceScore }) => (
                <button
                  key={entry.id}
                  type="button"
                  className="hover:bg-muted/60 flex items-center justify-between gap-2 rounded px-2 py-1 text-left text-xs"
                  onClick={() => onSelectEntry?.(entry)}
                >
                  <span className="truncate">{entry.argBlock}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {relevanceScore.toFixed(2)}
                  </span>
                </button>
              ))}
            </div>
          )
        ) : null}
      </PanelSection>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <PanelSection title="Draft blocks">
          {room.draftBlocks.length === 0 ? (
            <EmptyState
              title="No draft blocks"
              message="Blocks added to the evidence library for this topic appear here."
            />
          ) : (
            <div className="flex flex-col gap-2">
              {room.draftBlocks.map((block) => (
                <PanelRow
                  key={block.id}
                  title={
                    <button type="button" className="text-left" onClick={() => onSelectEntry?.(block)}>
                      {block.argBlock}
                    </button>
                  }
                  subtitle={block.caseArea}
                  trailing={<Pill tone="info">{block.wordCount} w</Pill>}
                />
              ))}
            </div>
          )}
        </PanelSection>

        <PanelSection title="Assignments">
          {room.routing.assignments.length === 0 ? (
            <EmptyState title="Nothing routed" message="No open gaps matched an available contributor." />
          ) : (
            <div className="flex flex-col gap-1">
              {room.routing.assignments.map((assignment) => (
                <div
                  key={`${assignment.contributorId}-${assignment.task.argBlock}`}
                  className="border-border flex items-center justify-between gap-2 rounded border px-2 py-1 text-xs"
                >
                  <span className="truncate">{assignment.task.argBlock}</span>
                  <Pill tone="positive">{assignment.contributorId}</Pill>
                </div>
              ))}
            </div>
          )}
          {room.routing.unassignedTasks.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {room.routing.unassignedTasks.map((task) => (
                <Pill key={task.argBlock} tone="warning">
                  {task.argBlock}
                </Pill>
              ))}
            </div>
          ) : null}
        </PanelSection>
      </div>

      <PanelSection title="Evidence index">
        {room.evidenceIndex.topicFolders.length === 0 ? (
          <EmptyState title="No evidence for this topic yet" />
        ) : (
          <div className="flex flex-wrap gap-1">
            {room.evidenceIndex.tagCollections.map((collection) => (
              <Pill key={collection.tag}>
                {collection.tag} · {collection.cards.length}
              </Pill>
            ))}
          </div>
        )}
      </PanelSection>

      <SummaryText label="Plain-text summary" text={buildPrepRoomSummaryText(room)} />
    </PanelShell>
  );
}
