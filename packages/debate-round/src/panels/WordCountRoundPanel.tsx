/**
 * @fileoverview Word-count-only speech format — UI over
 * `debate-timer`'s `word-count-format.ts`, persisting the round's submitted
 * speeches through `state/wordCountRounds.ts`.
 *
 * A word-count round replaces the speech clock with a word budget: the live
 * composer counts as you type and blocks nothing, but flags the moment a
 * speech runs past its limit.
 */

"use client";

import { useMemo, useState } from "react";
import { CaseSensitive } from "lucide-react";

import {
  EmptyState,
  LabeledField,
  MeterBar,
  PanelRow,
  PanelSection,
  PanelShell,
  Pill,
  StatGrid,
  StatTile,
} from "debate-ui/src/panels/panel-shell";
import { useStoreSnapshot } from "debate-ui/src/panels/use-store-snapshot";
import { Button } from "debate-ui/src/primitives/button";
import { Textarea } from "debate-ui/src/primitives/textarea";
import {
  getWordCountStatus,
  wordCountStyles,
  type WordCountStyleKey,
} from "debate-timer/src/formats/word-count-format";

import {
  deleteWordCountRound,
  getWordCountRound,
  saveWordCountRound,
  type WordCountRoundRecord,
  type WordCountSpeechSubmission,
} from "../state/wordCountRounds";

/** Props for {@link WordCountRoundPanel}. */
export interface WordCountRoundPanelProps {
  /** Round id the submitted speeches are stored under. */
  roundId: string;
  /** Word-count format. */
  styleKey?: WordCountStyleKey;
  /** Extra classes for the panel. */
  className?: string;
}

/**
 * Word-budget speech composer and per-speech status for a word-count round.
 *
 * @param props - See {@link WordCountRoundPanelProps}.
 * @returns The word-count round panel.
 */
export function WordCountRoundPanel({
  roundId,
  styleKey = "practicePublicForum",
  className,
}: WordCountRoundPanelProps) {
  const { data: record, refresh } = useStoreSnapshot<WordCountRoundRecord | undefined>(
    () => getWordCountRound(roundId),
    undefined,
  );

  const style = wordCountStyles[record?.styleKey ?? styleKey];
  const submitted: WordCountSpeechSubmission[] = record?.submittedSpeeches ?? [];
  const [draft, setDraft] = useState("");

  const nextSpeech = style.speeches[submitted.length] ?? null;
  const draftStatus = useMemo(
    () => (nextSpeech ? getWordCountStatus(draft, nextSpeech.wordLimit) : null),
    [draft, nextSpeech],
  );

  const statuses = useMemo(
    () =>
      submitted.map((speech, index) => {
        const definition = style.speeches[index];
        return {
          speech,
          limit: definition?.wordLimit ?? 0,
          status: getWordCountStatus(speech.text, definition?.wordLimit ?? 0),
        };
      }),
    [submitted, style],
  );

  const overLimitCount = statuses.filter((entry) => entry.status.overLimit).length;

  const submitSpeech = () => {
    if (!nextSpeech || !draft.trim()) return;
    saveWordCountRound({
      roundId,
      styleKey: record?.styleKey ?? styleKey,
      submittedSpeeches: [
        ...submitted,
        {
          name: nextSpeech.name,
          speaker: nextSpeech.speaker ?? (nextSpeech.secondary ? "neg" : "aff"),
          text: draft.trim(),
        },
      ],
    });
    setDraft("");
    refresh();
  };

  return (
    <PanelShell
      title="Word-Count Round"
      description="Speeches limited by word budget instead of a clock."
      icon={<CaseSensitive className="h-4 w-4" />}
      className={className}
      data-testid="word-count-round-panel"
      actions={<Pill tone="info">{record?.styleKey ?? styleKey}</Pill>}
    >
      <StatGrid columns={3}>
        <StatTile label="Speeches" value={`${submitted.length}/${style.speeches.length}`} />
        <StatTile
          label="Next"
          value={nextSpeech ? nextSpeech.name : "Round over"}
          tone={nextSpeech ? "info" : "positive"}
        />
        <StatTile
          label="Over limit"
          value={overLimitCount}
          tone={overLimitCount > 0 ? "critical" : "positive"}
        />
      </StatGrid>

      {nextSpeech ? (
        <PanelSection
          title={`${nextSpeech.name} — ${nextSpeech.wordLimit} words`}
          description={`Speaker ${nextSpeech.speaker ?? (nextSpeech.secondary ? "neg" : "aff")}.`}
        >
          <LabeledField label="Speech text">
            <Textarea rows={6} value={draft} onChange={(e) => setDraft(e.target.value)} />
          </LabeledField>
          {draftStatus ? (
            <MeterBar
              value={draftStatus.count}
              max={nextSpeech.wordLimit}
              tone={draftStatus.overLimit ? "critical" : draftStatus.percentUsed > 0.9 ? "warning" : "info"}
              label={`${draftStatus.count} / ${nextSpeech.wordLimit} words`}
              caption={
                draftStatus.overLimit
                  ? `${Math.abs(draftStatus.remaining)} over`
                  : `${draftStatus.remaining} left`
              }
            />
          ) : null}
          <div className="flex justify-end">
            <Button size="sm" onClick={submitSpeech} disabled={!draft.trim()}>
              Submit {nextSpeech.name}
            </Button>
          </div>
        </PanelSection>
      ) : (
        <EmptyState title="Round complete" message="Every speech in this format has been given." />
      )}

      <PanelSection title="Submitted speeches">
        {statuses.length === 0 ? (
          <EmptyState title="Nothing submitted yet" />
        ) : (
          <div className="flex flex-col gap-2">
            {statuses.map((entry, index) => (
              <PanelRow
                key={`${entry.speech.name}-${index}`}
                leading={`${index + 1}`}
                title={entry.speech.name}
                subtitle={entry.speech.speaker}
                trailing={
                  entry.status.overLimit ? (
                    <Pill tone="critical">{Math.abs(entry.status.remaining)} over</Pill>
                  ) : (
                    <Pill tone="positive">{entry.status.remaining} left</Pill>
                  )
                }
              >
                <MeterBar
                  value={entry.status.count}
                  max={entry.limit}
                  tone={entry.status.overLimit ? "critical" : "positive"}
                  caption={`${entry.status.count} / ${entry.limit} words`}
                />
              </PanelRow>
            ))}
          </div>
        )}
      </PanelSection>

      {submitted.length > 0 ? (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              deleteWordCountRound(roundId);
              refresh();
            }}
          >
            Reset round
          </Button>
        </div>
      ) : null}
    </PanelShell>
  );
}
