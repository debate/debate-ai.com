/**
 * @fileoverview AI practice opponent personas — UI over `debate-speech-writer`'s
 * `opponent-personas.ts`, persisting the session's pick through
 * `state/opponentPersonaSelections.ts`.
 */

"use client";

import { useMemo } from "react";
import { UserRoundCog } from "lucide-react";

import {
  PanelRow,
  PanelSection,
  PanelShell,
  Pill,
  StatGrid,
  StatTile,
  SummaryText,
  type PanelTone,
} from "debate-ui/src/panels/panel-shell";
import { useStoreSnapshot } from "debate-ui/src/panels/use-store-snapshot";
import { Button } from "debate-ui/src/primitives/button";
import {
  buildOpponentPersonaPrompt,
  listOpponentPersonas,
  type OpponentPersona,
  type OpponentPersonaPace,
} from "debate-speech-writer/src/opponent/opponent-personas";
import {
  deleteOpponentPersonaSelection,
  getOpponentPersonaSelection,
  saveOpponentPersonaSelection,
  type OpponentPersonaSelection,
} from "debate-speech-writer/src/state/opponentPersonaSelections";

const PACE_TONE: Record<OpponentPersonaPace, PanelTone> = {
  slow: "positive",
  moderate: "info",
  fast: "warning",
};

/** Props for {@link OpponentPersonaPanel}. */
export interface OpponentPersonaPanelProps {
  /** Practice session the selection is stored under. */
  sessionId: string;
  /** Notified whenever the active persona changes. */
  onSelectPersona?: (persona: OpponentPersona) => void;
  /** Extra classes for the panel. */
  className?: string;
}

/**
 * Picks the AI practice opponent's persona.
 *
 * @param props - See {@link OpponentPersonaPanelProps}.
 * @returns The opponent persona panel.
 */
export function OpponentPersonaPanel({
  sessionId,
  onSelectPersona,
  className,
}: OpponentPersonaPanelProps) {
  const { data: selection, refresh } = useStoreSnapshot<OpponentPersonaSelection | undefined>(
    () => getOpponentPersonaSelection(sessionId),
    undefined,
  );

  const personas = useMemo(() => listOpponentPersonas(), []);
  const active = selection?.persona ?? null;

  const select = (persona: OpponentPersona) => {
    saveOpponentPersonaSelection({ sessionId, persona });
    onSelectPersona?.(persona);
    refresh();
  };

  return (
    <PanelShell
      title="Practice Opponent"
      description="The style of debater the AI plays against you."
      icon={<UserRoundCog className="h-4 w-4" />}
      className={className}
      data-testid="opponent-persona-panel"
      actions={
        selection ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              deleteOpponentPersonaSelection(sessionId);
              refresh();
            }}
          >
            Clear
          </Button>
        ) : null
      }
    >
      <StatGrid columns={3}>
        <StatTile label="Selected" value={active?.name ?? "None"} tone={active ? "info" : "neutral"} />
        <StatTile
          label="Pace"
          value={active?.pace ?? "—"}
          tone={active ? PACE_TONE[active.pace] : "neutral"}
        />
        <StatTile label="Personas" value={personas.length} />
      </StatGrid>

      <PanelSection title="Personas">
        <div className="flex flex-col gap-2">
          {personas.map((persona) => (
            <PanelRow
              key={persona.id}
              className={active?.id === persona.id ? "border-primary" : undefined}
              title={
                <button type="button" className="text-left" onClick={() => select(persona)}>
                  {persona.name}
                </button>
              }
              subtitle={persona.description}
              trailing={
                <>
                  <Pill tone={PACE_TONE[persona.pace]}>{persona.pace}</Pill>
                  {active?.id === persona.id ? <Pill tone="positive">selected</Pill> : null}
                </>
              }
            >
              <div className="flex flex-wrap gap-1">
                {persona.preferredArguments.map((argument) => (
                  <Pill key={argument}>{argument}</Pill>
                ))}
              </div>
            </PanelRow>
          ))}
        </div>
      </PanelSection>

      {active ? (
        <SummaryText label="Opponent prompt" text={buildOpponentPersonaPrompt(active)} />
      ) : null}
    </PanelShell>
  );
}
