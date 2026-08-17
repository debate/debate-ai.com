/**
 * @fileoverview LLM card scoring — UI over `lib/llm-card-scoring.ts`.
 *
 * Ranks cards by the deterministic heuristic score and breaks each one into
 * its relevance / clarity / uniqueness / evidence-quality / usability parts,
 * flagging likely duplicates.
 */

"use client";

import { useMemo, useState } from "react";
import { Gauge } from "lucide-react";

import {
  EmptyState,
  MeterBar,
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
  DEFAULT_CARD_SCORE_WEIGHTS,
  buildCardScoreSummaryText,
  rankCardScores,
  type CardScoreBreakdown,
  type CardScoreWeights,
  type ScoredCard,
} from "../lib/llm-card-scoring";

/** Props for {@link CardScoringPanel}. */
export interface CardScoringPanelProps {
  /** Cards to score. */
  cards: ScoredCard[];
  /**
   * Corpus the uniqueness score compares against. Defaults to the texts of
   * the cards being scored.
   */
  corpusTexts?: string[];
  /** Component weights. */
  weights?: CardScoreWeights;
  /** Optional label lookup so rows can show a title instead of the card id. */
  titleFor?: (card: ScoredCard) => string;
  /** Invoked when a card row is clicked. */
  onSelectCard?: (card: ScoredCard) => void;
  /** Extra classes for the panel. */
  className?: string;
}

/**
 * Ranks cards by heuristic quality score.
 *
 * @param props - See {@link CardScoringPanelProps}.
 * @returns The card scoring panel.
 */
export function CardScoringPanel({
  cards,
  corpusTexts,
  weights = DEFAULT_CARD_SCORE_WEIGHTS,
  titleFor,
  onSelectCard,
  className,
}: CardScoringPanelProps) {
  const [hideDuplicates, setHideDuplicates] = useState(false);
  const [openCardId, setOpenCardId] = useState<string | null>(null);

  const ranked = useMemo(
    () => rankCardScores(cards, corpusTexts ?? cards.map((card) => card.text), weights),
    [cards, corpusTexts, weights],
  );
  const byId = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards]);
  const duplicates = ranked.filter((row) => row.isLikelyDuplicate).length;
  const visible = hideDuplicates ? ranked.filter((row) => !row.isLikelyDuplicate) : ranked;
  const averageScore =
    ranked.length > 0
      ? ranked.reduce((sum, row) => sum + row.overallScore, 0) / ranked.length
      : 0;

  return (
    <PanelShell
      title="Card Scoring"
      description="Heuristic quality score per card, with duplicate detection."
      icon={<Gauge className="h-4 w-4" />}
      className={className}
      data-testid="card-scoring-panel"
      actions={
        <Button variant="outline" size="sm" onClick={() => setHideDuplicates((v) => !v)}>
          {hideDuplicates ? "Show duplicates" : "Hide duplicates"}
        </Button>
      }
    >
      <StatGrid columns={3}>
        <StatTile label="Cards scored" value={ranked.length} />
        <StatTile label="Average score" value={averageScore.toFixed(2)} tone="info" />
        <StatTile
          label="Likely duplicates"
          value={duplicates}
          tone={duplicates > 0 ? "warning" : "positive"}
        />
      </StatGrid>

      <PanelSection title="Ranked cards">
        {visible.length === 0 ? (
          <EmptyState
            title="No cards to score"
            message={
              hideDuplicates && ranked.length > 0
                ? "Every scored card was flagged as a likely duplicate."
                : "Pass cards to this panel to see their scores."
            }
          />
        ) : (
          <div className="flex flex-col gap-2">
            {visible.map((row, index) => (
              <ScoreRow
                key={row.cardId}
                rank={index + 1}
                breakdown={row}
                card={byId.get(row.cardId)}
                open={openCardId === row.cardId}
                titleFor={titleFor}
                onToggle={() => setOpenCardId(openCardId === row.cardId ? null : row.cardId)}
                onSelect={onSelectCard}
              />
            ))}
          </div>
        )}
      </PanelSection>
    </PanelShell>
  );
}

function ScoreRow({
  rank,
  breakdown,
  card,
  open,
  titleFor,
  onToggle,
  onSelect,
}: {
  rank: number;
  breakdown: CardScoreBreakdown;
  card?: ScoredCard;
  open: boolean;
  titleFor?: (card: ScoredCard) => string;
  onToggle: () => void;
  onSelect?: (card: ScoredCard) => void;
}) {
  return (
    <PanelRow
      leading={`#${rank}`}
      title={
        <button type="button" className="text-left" aria-expanded={open} onClick={onToggle}>
          {card && titleFor ? titleFor(card) : breakdown.cardId}
        </button>
      }
      subtitle={card ? `${card.argBlockKeywords.join(", ") || "no keywords"}` : undefined}
      trailing={
        <>
          {breakdown.isLikelyDuplicate ? <Pill tone="warning">duplicate?</Pill> : null}
          <span className="font-semibold">{breakdown.overallScore.toFixed(2)}</span>
          {card && onSelect ? (
            <Button variant="ghost" size="sm" onClick={() => onSelect(card)}>
              Open
            </Button>
          ) : null}
        </>
      }
    >
      <div className="grid grid-cols-1 gap-1 sm:grid-cols-5">
        <MeterBar value={breakdown.relevanceScore} max={1} tone="info" label="Relevance" />
        <MeterBar value={breakdown.clarityScore} max={1} tone="info" label="Clarity" />
        <MeterBar value={breakdown.uniquenessScore} max={1} tone="warning" label="Unique" />
        <MeterBar value={breakdown.evidenceQualityScore} max={1} tone="positive" label="Evidence" />
        <MeterBar value={breakdown.usabilityScore} max={1} tone="positive" label="Usability" />
      </div>
      {open ? <SummaryText text={buildCardScoreSummaryText(breakdown)} /> : null}
    </PanelRow>
  );
}
