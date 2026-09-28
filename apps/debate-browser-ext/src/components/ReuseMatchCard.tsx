import { Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { CardAnnotation, ReuseMatch } from '@/src/reuse/api';

/** Quotes shown per card before the rest are summarized as a count. */
const VISIBLE_QUOTES = 3;

const RATING_CLASSES: Record<CardAnnotation['authorQuality']['rating'], string> = {
  strong: 'bg-emerald-50 text-emerald-800',
  adequate: 'bg-sky-50 text-sky-800',
  weak: 'bg-red-50 text-red-800',
  unknown: 'bg-muted text-muted-foreground',
};

const SEVERITY_CLASSES: Record<CardAnnotation['flaws'][number]['severity'], string> = {
  high: 'bg-red-500',
  medium: 'bg-amber-500',
  low: 'bg-slate-400',
};

export interface AnnotationState {
  loading?: boolean;
  error?: string;
  annotation?: CardAnnotation;
}

interface ReuseMatchCardProps {
  match: ReuseMatch;
  /** Annotation fetched in this popup, which takes over from `match.annotation`. */
  state?: AnnotationState;
  onAnnotate?: () => void;
}

/**
 * One already-cut card for the page: its tag and cite, and — for a card from
 * the Parquet corpus — the author, year and highlighted quotes
 * debate-card-parser recovered, plus the LLM's flaws and author-quality read.
 */
export function ReuseMatchCard({ match, state, onAnnotate }: ReuseMatchCardProps) {
  const card = match.card;
  const annotation = state?.annotation ?? match.annotation;
  const title = card?.tag || match.argBlock || '(untitled)';
  const citeLine = card
    ? [
        [card.author, card.year].filter(Boolean).join(' ') || card.cite,
        card.caselist,
        [card.event.toUpperCase(), card.level].filter(Boolean).join(' '),
      ]
    : [match.cite, match.topic];

  return (
    <li className="rounded-md border border-dashed border-border p-2 text-xs">
      <div className="font-semibold leading-snug">{title}</div>
      <div className="text-muted-foreground">{citeLine.filter(Boolean).join(' — ')}</div>
      {card && card.duplicateCount > 1 && (
        <div className="text-[11px] text-muted-foreground">
          Read {card.duplicateCount.toLocaleString()}× across caselists
        </div>
      )}

      {card && card.quotes.length > 0 && (
        <ul className="mt-1.5 space-y-1">
          {card.quotes.slice(0, VISIBLE_QUOTES).map((quote, index) => (
            <li key={index} className="border-l-2 border-amber-400 pl-1.5 italic">
              “{quote}”
            </li>
          ))}
          {card.quotes.length > VISIBLE_QUOTES && (
            <li className="text-[11px] text-muted-foreground">
              +{card.quotes.length - VISIBLE_QUOTES} more highlighted
            </li>
          )}
        </ul>
      )}

      {annotation ? (
        <AnnotationView annotation={annotation} />
      ) : card && onAnnotate ? (
        <div className="mt-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-full text-xs"
            disabled={state?.loading}
            onClick={onAnnotate}
          >
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            {state?.loading ? 'Annotating…' : 'Find flaws & rate author'}
          </Button>
          {state?.error && <div className="mt-1 text-[11px] text-red-700">{state.error}</div>}
        </div>
      ) : null}
    </li>
  );
}

function AnnotationView({ annotation }: { annotation: CardAnnotation }) {
  const { authorQuality } = annotation;
  return (
    <div className="mt-2 space-y-1.5 rounded bg-muted/50 p-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${RATING_CLASSES[authorQuality.rating]}`}>
          Author: {authorQuality.rating}
        </span>
        <span className="rounded bg-background px-1.5 py-0.5 text-[11px] font-medium">
          Support {annotation.supportScore}/10
        </span>
      </div>
      {authorQuality.qualifications && <div>{authorQuality.qualifications}</div>}
      {authorQuality.concerns && <div className="text-red-800">⚠ {authorQuality.concerns}</div>}
      {annotation.flaws.length > 0 && (
        <ul className="space-y-1">
          {annotation.flaws.map((flaw, index) => (
            <li key={index} className="flex gap-1.5">
              <span
                className={`mt-1 h-2 w-2 shrink-0 rounded-full ${SEVERITY_CLASSES[flaw.severity]}`}
                title={`${flaw.severity} severity`}
              />
              <span>
                <span className="font-medium">{flaw.flaw}</span>
                {flaw.explanation && <span className="text-muted-foreground"> — {flaw.explanation}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
