/**
 * @fileoverview Online debate versus AI — UI over `round/ai-versus-speech-order.ts`
 * with the round's submitted speeches persisted in `state/aiVersusRounds.ts`.
 *
 * Shows the speech order, whose turn it is, validates a submission before it
 * is recorded, and exposes the request the AI opponent would be given next.
 */

"use client";

import { useMemo, useState } from "react";
import { Bot } from "lucide-react";

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
import { Textarea } from "debate-ui/src/primitives/textarea";
import { debateStyleMap, type DebateStyleKey } from "debate-timer/src/formats/debate-format-times";

import {
  buildAiResponseRequest,
  buildAiVersusSpeechOrder,
  getNextSpeechSlot,
  isUsersTurn,
  validateSpeechSubmission,
  type AiVersusSide,
  type PriorSpeechRecord,
} from "../round/ai-versus-speech-order";
import {
  deleteAiVersusRound,
  getAiVersusRound,
  saveAiVersusRound,
  type AiVersusRoundRecord,
} from "../state/aiVersusRounds";

/** Props for {@link AiVersusRoundPanel}. */
export interface AiVersusRoundPanelProps {
  /** Round id the submitted speeches are stored under. */
  roundId: string;
  /** Debate format. Defaults to the stored round's format, then policy. */
  styleKey?: DebateStyleKey;
  /** Which side the human debater is on. */
  userSide?: AiVersusSide;
  /**
   * Produces the AI opponent's speech. Without it the panel shows the request
   * that would be sent and lets the text be pasted in by hand.
   */
  onRequestAiSpeech?: (request: ReturnType<typeof buildAiResponseRequest>) => void;
  /** Extra classes for the panel. */
  className?: string;
}

/**
 * Turn-ordered practice round against an AI opponent.
 *
 * @param props - See {@link AiVersusRoundPanelProps}.
 * @returns The AI versus round panel.
 */
export function AiVersusRoundPanel({
  roundId,
  styleKey,
  userSide,
  onRequestAiSpeech,
  className,
}: AiVersusRoundPanelProps) {
  const { data: record, refresh } = useStoreSnapshot<AiVersusRoundRecord | undefined>(
    () => getAiVersusRound(roundId),
    undefined,
  );

  const activeStyle: DebateStyleKey = styleKey ?? record?.styleKey ?? "policy";
  const activeSide: AiVersusSide = userSide ?? record?.userSide ?? "primary";
  const submitted: PriorSpeechRecord[] = record?.submittedSpeeches ?? [];

  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const order = useMemo(
    () => buildAiVersusSpeechOrder(activeStyle, activeSide),
    [activeStyle, activeSide],
  );
  const nextSlot = getNextSpeechSlot(order, submitted.length);
  const usersTurn = isUsersTurn(order, submitted.length);
  const aiRequest = useMemo(
    () => buildAiResponseRequest(order, submitted.length, submitted),
    [order, submitted],
  );

  const persist = (speeches: PriorSpeechRecord[]) => {
    saveAiVersusRound({
      roundId,
      styleKey: activeStyle,
      userSide: activeSide,
      submittedSpeeches: speeches,
    });
    refresh();
  };

  const submitSpeech = () => {
    if (!nextSlot) return;
    const validation = validateSpeechSubmission(order, submitted.length, nextSlot.name);
    if (!validation.valid) {
      setError(validation.reason);
      return;
    }
    setError(null);
    persist([...submitted, { name: nextSlot.name, speaker: nextSlot.speaker, text: text.trim() }]);
    setText("");
  };

  return (
    <PanelShell
      title="Debate vs AI"
      description="Speech order, turn validation and the AI's next request."
      icon={<Bot className="h-4 w-4" />}
      className={className}
      data-testid="ai-versus-round-panel"
      actions={
        <>
          <Pill tone="info">{activeStyle}</Pill>
          <Pill>{activeSide}</Pill>
        </>
      }
    >
      <StatGrid columns={3}>
        <StatTile label="Speeches" value={`${submitted.length}/${order.length}`} />
        <StatTile
          label="Next"
          value={nextSlot ? nextSlot.name : "Round over"}
          tone={nextSlot ? "info" : "positive"}
        />
        <StatTile
          label="Turn"
          value={nextSlot ? (usersTurn ? "You" : "AI") : "—"}
          tone={usersTurn ? "positive" : "neutral"}
        />
      </StatGrid>

      {error ? (
        <p className="border-rose-500/30 bg-rose-500/10 rounded-lg border px-3 py-2 text-xs text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : null}

      <PanelSection title="Speech order">
        <div className="flex flex-col gap-1">
          {order.map((slot, index) => {
            const done = index < submitted.length;
            const current = index === submitted.length;
            return (
              <div
                key={`${slot.index}-${slot.name}`}
                className={`flex items-center justify-between gap-2 rounded border px-2 py-1 text-xs ${
                  current ? "border-primary" : "border-border"
                } ${done ? "opacity-60" : ""}`}
              >
                <span className="flex items-center gap-2">
                  <span className="tabular-nums">{index + 1}.</span>
                  <span className={done ? "line-through" : ""}>{slot.name}</span>
                  {slot.cxRoles ? (
                    <span className="text-muted-foreground">
                      {slot.cxRoles.questioner} asks {slot.cxRoles.answerer}
                    </span>
                  ) : null}
                </span>
                <span className="flex items-center gap-1">
                  <Pill tone={slot.speaker === "user" ? "positive" : "info"}>{slot.speaker}</Pill>
                  <span className="text-muted-foreground tabular-nums">{slot.time}m</span>
                </span>
              </div>
            );
          })}
        </div>
      </PanelSection>

      {nextSlot ? (
        <PanelSection
          title={usersTurn ? `Your speech — ${nextSlot.name}` : `AI speech — ${nextSlot.name}`}
        >
          <LabeledField label="Speech text">
            <Textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} />
          </LabeledField>
          <div className="flex flex-wrap justify-end gap-2">
            {!usersTurn && aiRequest && onRequestAiSpeech ? (
              <Button variant="outline" size="sm" onClick={() => onRequestAiSpeech(aiRequest)}>
                Generate AI speech
              </Button>
            ) : null}
            <Button size="sm" onClick={submitSpeech} disabled={!text.trim()}>
              Submit {nextSlot.name}
            </Button>
          </div>
        </PanelSection>
      ) : (
        <EmptyState title="Round complete" message="Every speech in the order has been submitted." />
      )}

      <PanelSection title="Submitted speeches">
        {submitted.length === 0 ? (
          <EmptyState title="Nothing submitted yet" />
        ) : (
          <div className="flex flex-col gap-2">
            {submitted.map((speech, index) => (
              <PanelRow
                key={`${speech.name}-${index}`}
                leading={`${index + 1}`}
                title={speech.name}
                subtitle={speech.text.slice(0, 140)}
                trailing={<Pill tone={speech.speaker === "user" ? "positive" : "info"}>{speech.speaker}</Pill>}
              />
            ))}
          </div>
        )}
      </PanelSection>

      {aiRequest ? (
        <SummaryText
          label="Next AI request"
          text={`${aiRequest.slot.name}${aiRequest.isCrossExamination ? " (cross-ex)" : ""} — ${aiRequest.priorSpeeches.length} prior speech${aiRequest.priorSpeeches.length === 1 ? "" : "es"} in context`}
        />
      ) : null}

      {submitted.length > 0 ? (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              deleteAiVersusRound(roundId);
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

/** Debate formats the panel can start a round in. */
export const AI_VERSUS_STYLE_KEYS = debateStyleMap;
