/**
 * @fileoverview Shared evidence library — search UI over
 * `lib/shared-evidence-library.ts` reading and writing the persisted entries
 * in `state/evidenceLibraryEntries.ts`.
 */

"use client";

import { useMemo, useState } from "react";
import { Library, Trash2 } from "lucide-react";

import {
  EmptyState,
  LabeledField,
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
import { Textarea } from "debate-ui/src/primitives/textarea";

import {
  buildEvidenceSearchSummaryText,
  searchEvidenceLibrary,
  type EvidenceEntryKind,
  type EvidenceLibraryEntry,
  type EvidenceSearchQuery,
} from "../lib/shared-evidence-library";
import {
  deleteEvidenceLibraryEntry,
  listEvidenceLibraryEntries,
  saveEvidenceLibraryEntry,
} from "../state/evidenceLibraryEntries";

const EMPTY_DRAFT = {
  argBlock: "",
  topic: "",
  caseArea: "",
  cite: "",
  tags: "",
  text: "",
  kind: "card" as EvidenceEntryKind,
};

/** Props for {@link EvidenceLibraryPanel}. */
export interface EvidenceLibraryPanelProps {
  /**
   * Entries to search. Defaults to the persisted library, which is what the
   * squad-wide panel wants; pass a list to search an in-memory set instead.
   */
  entries?: EvidenceLibraryEntry[];
  /** Invoked when a result is clicked. */
  onSelectEntry?: (entry: EvidenceLibraryEntry) => void;
  /** Hides the add-entry form when the caller owns entry creation. */
  readOnly?: boolean;
  /** Extra classes for the panel. */
  className?: string;
}

/**
 * Keyword/tag/cite/topic search across the shared evidence library.
 *
 * @param props - See {@link EvidenceLibraryPanelProps}.
 * @returns The evidence library panel.
 */
export function EvidenceLibraryPanel({
  entries,
  onSelectEntry,
  readOnly = false,
  className,
}: EvidenceLibraryPanelProps) {
  const { data: persisted, refresh } = useStoreSnapshot<EvidenceLibraryEntry[]>(
    listEvidenceLibraryEntries,
    [],
  );
  const allEntries = entries ?? persisted;

  const [text, setText] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [topic, setTopic] = useState("");
  const [caseArea, setCaseArea] = useState("");
  const [kind, setKind] = useState<EvidenceEntryKind | "">("");
  const [tagMode, setTagMode] = useState<"any" | "all">("any");
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [showSummary, setShowSummary] = useState(false);

  const query = useMemo<EvidenceSearchQuery>(() => {
    const tags = tagsInput
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    return {
      ...(text.trim() ? { text: text.trim() } : {}),
      ...(tags.length > 0 ? { tags, tagMode } : {}),
      ...(topic.trim() ? { topic: topic.trim() } : {}),
      ...(caseArea.trim() ? { caseArea: caseArea.trim() } : {}),
      ...(kind ? { kind } : {}),
    };
  }, [text, tagsInput, tagMode, topic, caseArea, kind]);

  const results = useMemo(
    () => searchEvidenceLibrary(allEntries, query),
    [allEntries, query],
  );

  const addEntry = () => {
    if (!draft.argBlock.trim() || !draft.text.trim()) return;
    saveEvidenceLibraryEntry({
      id: `entry-${Date.now()}`,
      argBlock: draft.argBlock.trim(),
      topic: draft.topic.trim() || "Untagged",
      caseArea: draft.caseArea.trim() || "General",
      cite: draft.cite.trim(),
      kind: draft.kind,
      text: draft.text.trim(),
      wordCount: draft.text.trim().split(/\s+/).filter(Boolean).length,
      tags: draft.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    });
    setDraft(EMPTY_DRAFT);
    refresh();
  };

  const removeEntry = (id: string) => {
    deleteEvidenceLibraryEntry(id);
    refresh();
  };

  return (
    <PanelShell
      title="Shared Evidence Library"
      description="Search the squad's cards and blocks by keyword, tag, cite or topic."
      icon={<Library className="h-4 w-4" />}
      className={className}
      data-testid="evidence-library-panel"
      actions={
        <Button variant="ghost" size="sm" onClick={() => setShowSummary((v) => !v)}>
          {showSummary ? "Hide summary" : "Summary"}
        </Button>
      }
    >
      <StatGrid columns={3}>
        <StatTile label="Entries" value={allEntries.length} />
        <StatTile label="Matches" value={results.length} tone="info" />
        <StatTile
          label="Top score"
          value={results.length > 0 ? results[0].relevanceScore.toFixed(2) : "—"}
        />
      </StatGrid>

      <PanelSection
        title="Search"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => setTagMode((m) => (m === "any" ? "all" : "any"))}
          >
            Tags: {tagMode}
          </Button>
        }
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <LabeledField label="Keywords">
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="warming impact" />
          </LabeledField>
          <LabeledField label="Tags (comma separated)">
            <Input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="impact, 2024" />
          </LabeledField>
          <LabeledField label="Topic">
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} />
          </LabeledField>
          <LabeledField label="Case area">
            <Input value={caseArea} onChange={(e) => setCaseArea(e.target.value)} />
          </LabeledField>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(["", "card", "block"] as const).map((option) => (
            <button key={option || "any"} type="button" onClick={() => setKind(option)}>
              <Pill tone={kind === option ? "info" : "neutral"}>
                {option === "" ? "Any kind" : option}
              </Pill>
            </button>
          ))}
        </div>
      </PanelSection>

      <PanelSection title="Results">
        {results.length === 0 ? (
          <EmptyState
            title="No matching evidence"
            message={
              allEntries.length === 0
                ? "Add an entry below to start the library."
                : "Try fewer keywords or switch tag matching to any."
            }
          />
        ) : (
          <div className="flex flex-col gap-2">
            {results.map(({ entry, relevanceScore }) => (
              <PanelRow
                key={entry.id}
                title={
                  <button type="button" className="text-left" onClick={() => onSelectEntry?.(entry)}>
                    {entry.argBlock}
                  </button>
                }
                subtitle={`${entry.topic} · ${entry.caseArea}${entry.cite ? ` · ${entry.cite}` : ""}`}
                trailing={
                  <>
                    <Pill tone="info">{relevanceScore.toFixed(2)}</Pill>
                    {readOnly ? null : (
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Delete ${entry.argBlock}`}
                        onClick={() => removeEntry(entry.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </>
                }
              >
                <p className="text-muted-foreground line-clamp-3 text-xs">{entry.text}</p>
                {entry.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {entry.tags.map((tag) => (
                      <Pill key={tag}>{tag}</Pill>
                    ))}
                  </div>
                ) : null}
              </PanelRow>
            ))}
          </div>
        )}
      </PanelSection>

      {readOnly ? null : (
        <PanelSection title="Add entry" description="Saved to this browser's shared library.">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <LabeledField label="Argument block">
              <Input
                value={draft.argBlock}
                onChange={(e) => setDraft({ ...draft, argBlock: e.target.value })}
              />
            </LabeledField>
            <LabeledField label="Cite">
              <Input value={draft.cite} onChange={(e) => setDraft({ ...draft, cite: e.target.value })} />
            </LabeledField>
            <LabeledField label="Topic">
              <Input value={draft.topic} onChange={(e) => setDraft({ ...draft, topic: e.target.value })} />
            </LabeledField>
            <LabeledField label="Case area">
              <Input
                value={draft.caseArea}
                onChange={(e) => setDraft({ ...draft, caseArea: e.target.value })}
              />
            </LabeledField>
            <LabeledField label="Tags (comma separated)" className="sm:col-span-2">
              <Input value={draft.tags} onChange={(e) => setDraft({ ...draft, tags: e.target.value })} />
            </LabeledField>
            <LabeledField label="Text" className="sm:col-span-2">
              <Textarea
                value={draft.text}
                rows={3}
                onChange={(e) => setDraft({ ...draft, text: e.target.value })}
              />
            </LabeledField>
          </div>
          <div className="flex items-center gap-2">
            {(["card", "block"] as const).map((option) => (
              <button key={option} type="button" onClick={() => setDraft({ ...draft, kind: option })}>
                <Pill tone={draft.kind === option ? "info" : "neutral"}>{option}</Pill>
              </button>
            ))}
            <Button size="sm" onClick={addEntry} disabled={!draft.argBlock.trim() || !draft.text.trim()}>
              Add to library
            </Button>
          </div>
        </PanelSection>
      )}

      {showSummary ? (
        <SummaryText
          label="Plain-text summary"
          text={buildEvidenceSearchSummaryText(results, query)}
        />
      ) : null}
    </PanelShell>
  );
}
