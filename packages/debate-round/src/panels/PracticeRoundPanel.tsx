/**
 * @fileoverview Practice round simulator — UI over
 * `round/practice-round-simulator.ts`, persisting the setup and post-round
 * feedback per round through `state/practiceRounds.ts`.
 */

"use client";

import { useMemo, useState } from "react";
import { Play } from "lucide-react";

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
import { debateStyleMap, type DebateStyleKey } from "debate-timer/src/formats/debate-format-times";
import {
  judgeParadigmIds,
  type BuiltinJudgeParadigmId,
} from "debate-speech-writer/src/judge/judge-paradigms";
import {
  opponentPersonaIds,
  type BuiltinOpponentPersonaId,
} from "debate-speech-writer/src/opponent/opponent-personas";
import type { Flow } from "debate-core/src/types/flow";

import {
  buildPracticeRoundFeedback,
  buildPracticeRoundFeedbackText,
  buildPracticeRoundSetup,
  buildPracticeRoundSetupText,
} from "../round/practice-round-simulator";
import type { AiVersusSide } from "../round/ai-versus-speech-order";
import {
  deletePracticeRound,
  getPracticeRound,
  savePracticeRound,
  type PracticeRoundRecord,
} from "../state/practiceRounds";

/** Props for {@link PracticeRoundPanel}. */
export interface PracticeRoundPanelProps {
  /** Round id the setup and feedback are stored under. */
  roundId: string;
  /** Debate format. */
  styleKey?: DebateStyleKey;
  /** Which side the human debater takes. */
  userSide?: AiVersusSide;
  /**
   * Flow from the finished round. Supplying it enables the post-round
   * feedback section.
   */
  flow?: Pick<Flow, "children" | "columns">;
  /** Side key used when generating feedback, e.g. "aff". */
  feedbackSideKey?: string;
  /** Extra classes for the panel. */
  className?: string;
}

/**
 * Configures a practice round and shows its post-round feedback.
 *
 * @param props - See {@link PracticeRoundPanelProps}.
 * @returns The practice round panel.
 */
export function PracticeRoundPanel({
  roundId,
  styleKey = "policy",
  userSide = "primary",
  flow,
  feedbackSideKey = "aff",
  className,
}: PracticeRoundPanelProps) {
  const { data: record, refresh } = useStoreSnapshot<PracticeRoundRecord | undefined>(
    () => getPracticeRound(roundId),
    undefined,
  );

  const [style, setStyle] = useState<DebateStyleKey>(styleKey);
  const [side, setSide] = useState<AiVersusSide>(userSide);
  const [paradigmId, setParadigmId] = useState<BuiltinJudgeParadigmId>(judgeParadigmIds[0]);
  const [personaId, setPersonaId] = useState<BuiltinOpponentPersonaId | "">("");

  const setup = useMemo(
    () =>
      buildPracticeRoundSetup({
        styleKey: style,
        userSide: side,
        judgeParadigm: paradigmId,
        ...(personaId ? { opponentPersona: personaId } : {}),
      }),
    [style, side, paradigmId, personaId],
  );

  const feedback = useMemo(
    () => (flow ? buildPracticeRoundFeedback(flow, feedbackSideKey, setup.judgeParadigm) : null),
    [flow, feedbackSideKey, setup.judgeParadigm],
  );

  const saveSetup = () => {
    savePracticeRound({ roundId, setup, ...(feedback ? { feedback } : {}) });
    refresh();
  };

  return (
    <PanelShell
      title="Practice Round Simulator"
      description="Format, judge paradigm and opponent persona for a practice round."
      icon={<Play className="h-4 w-4" />}
      className={className}
      data-testid="practice-round-panel"
      actions={
        <Button size="sm" variant="outline" onClick={saveSetup}>
          {record ? "Update saved round" : "Save round"}
        </Button>
      }
    >
      <StatGrid columns={3}>
        <StatTile label="Speeches" value={setup.speechOrder.length} />
        <StatTile label="Judge" value={setup.judgeParadigm.name} tone="info" />
        <StatTile
          label="Opponent"
          value={setup.opponentPersona ? setup.opponentPersona.name : "None"}
        />
      </StatGrid>

      <PanelSection title="Format">
        <div className="flex flex-wrap gap-1.5">
          {debateStyleMap.map((key) => (
            <button key={key} type="button" onClick={() => setStyle(key)}>
              <Pill tone={style === key ? "info" : "neutral"}>{key}</Pill>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(["primary", "secondary"] as const).map((option) => (
            <button key={option} type="button" onClick={() => setSide(option)}>
              <Pill tone={side === option ? "positive" : "neutral"}>{option}</Pill>
            </button>
          ))}
        </div>
      </PanelSection>

      <PanelSection title="Judge paradigm">
        <div className="flex flex-wrap gap-1.5">
          {judgeParadigmIds.map((id) => (
            <button key={id} type="button" onClick={() => setParadigmId(id)}>
              <Pill tone={paradigmId === id ? "info" : "neutral"}>{id}</Pill>
            </button>
          ))}
        </div>
      </PanelSection>

      <PanelSection title="Opponent persona">
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setPersonaId("")}>
            <Pill tone={personaId === "" ? "info" : "neutral"}>none</Pill>
          </button>
          {opponentPersonaIds.map((id) => (
            <button key={id} type="button" onClick={() => setPersonaId(id)}>
              <Pill tone={personaId === id ? "info" : "neutral"}>{id}</Pill>
            </button>
          ))}
        </div>
      </PanelSection>

      <PanelSection title="Setup briefing">
        <div className="flex flex-col gap-2">
          {setup.sections.map((section) => (
            <PanelRow key={section.title} title={section.title} subtitle={section.body} />
          ))}
        </div>
        <SummaryText label="Plain text" text={buildPracticeRoundSetupText(setup)} />
      </PanelSection>

      <PanelSection title="Post-round feedback">
        {feedback ? (
          <>
            <div className="flex flex-col gap-2">
              {feedback.sections.map((section) => (
                <PanelRow key={section.title} title={section.title} subtitle={section.body} />
              ))}
            </div>
            <SummaryText label="Plain text" text={buildPracticeRoundFeedbackText(feedback)} />
          </>
        ) : (
          <EmptyState
            title="No feedback yet"
            message="Feedback is generated from the round's flow once the round is done."
          />
        )}
      </PanelSection>

      {record ? (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              deletePracticeRound(roundId);
              refresh();
            }}
          >
            Delete saved round
          </Button>
        </div>
      ) : null}
    </PanelShell>
  );
}
