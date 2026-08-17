/**
 * @fileoverview Flow-in-speech annotations — UI over `flow/flow-annotations.ts`
 * backed by the persisted annotations in `state/flowAnnotations.ts`.
 *
 * Lists a speech's timestamped annotations, highlights the one covering the
 * current playback position, and can add an annotation at that position.
 */

"use client";

import { useMemo, useState } from "react";
import { Bookmark, Trash2 } from "lucide-react";

import {
  EmptyState,
  LabeledField,
  PanelRow,
  PanelSection,
  PanelShell,
  Pill,
  StatGrid,
  StatTile,
} from "debate-ui/src/panels/panel-shell";
import { useStoreSnapshot } from "debate-ui/src/panels/use-store-snapshot";
import { Button } from "debate-ui/src/primitives/button";
import { Input } from "debate-ui/src/primitives/input";
import type { Box, Flow } from "debate-core/src/types/flow";

import {
  createFlowAnnotation,
  findAnnotationAtPlaybackPosition,
  getAnnotationsForSpeech,
  resolveAnnotationBox,
  sortAnnotationsByTimestamp,
  type FlowAnnotation,
} from "../flow/flow-annotations";
import {
  deleteFlowAnnotation,
  listFlowAnnotationsForFlow,
  saveFlowAnnotation,
} from "../state/flowAnnotations";

/** Formats a millisecond offset as `m:ss`. */
function formatTimestamp(timestampMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(timestampMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** Props for {@link FlowAnnotationsPanel}. */
export interface FlowAnnotationsPanelProps {
  /** The flow annotations are attached to. */
  flow: Pick<Flow, "id" | "children">;
  /** Speech whose recording is being reviewed. */
  speechId: string;
  /** Current playback position in ms, used to highlight and to add at. */
  playbackMs?: number;
  /** Annotations to show. Defaults to the persisted annotations for the flow. */
  annotations?: FlowAnnotation[];
  /** Box path a newly added annotation is attached to. */
  activeBoxPath?: number[];
  /** Invoked when an annotation row is clicked, e.g. to seek the player. */
  onSeek?: (annotation: FlowAnnotation) => void;
  /** Extra classes for the panel. */
  className?: string;
}

/**
 * Timestamped annotations tying a speech recording to flow boxes.
 *
 * @param props - See {@link FlowAnnotationsPanelProps}.
 * @returns The annotations panel.
 */
export function FlowAnnotationsPanel({
  flow,
  speechId,
  playbackMs = 0,
  annotations,
  activeBoxPath = [0],
  onSeek,
  className,
}: FlowAnnotationsPanelProps) {
  const { data: persisted, refresh } = useStoreSnapshot<FlowAnnotation[]>(
    () => listFlowAnnotationsForFlow(flow.id),
    [],
  );
  const source = annotations ?? persisted;
  const editable = annotations === undefined;
  const [note, setNote] = useState("");

  const forSpeech = useMemo(
    () => sortAnnotationsByTimestamp(getAnnotationsForSpeech(source, speechId)),
    [source, speechId],
  );
  const active = useMemo(
    () => findAnnotationAtPlaybackPosition(source, speechId, playbackMs),
    [source, speechId, playbackMs],
  );

  const addAnnotation = () => {
    saveFlowAnnotation(
      createFlowAnnotation({
        id: `annotation-${Date.now()}`,
        flowId: flow.id,
        boxPath: activeBoxPath,
        speechId,
        timestampMs: playbackMs,
        createdAt: Date.now(),
        ...(note.trim() ? { note: note.trim() } : {}),
      }),
    );
    setNote("");
    refresh();
  };

  const boxFor = (annotation: FlowAnnotation): Box | null =>
    resolveAnnotationBox({ children: flow.children }, annotation);

  return (
    <PanelShell
      title="Flow Annotations"
      description={`Timestamped marks on ${speechId}.`}
      icon={<Bookmark className="h-4 w-4" />}
      className={className}
      data-testid="flow-annotations-panel"
      actions={<Pill tone="info">{formatTimestamp(playbackMs)}</Pill>}
    >
      <StatGrid columns={3}>
        <StatTile label="On this speech" value={forSpeech.length} />
        <StatTile label="On this flow" value={source.length} />
        <StatTile
          label="At playhead"
          value={active ? formatTimestamp(active.timestampMs) : "—"}
          tone={active ? "positive" : "neutral"}
        />
      </StatGrid>

      <PanelSection title="Annotations">
        {forSpeech.length === 0 ? (
          <EmptyState
            title="No annotations yet"
            message={editable ? "Add one at the current playback position." : undefined}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {forSpeech.map((annotation) => {
              const box = boxFor(annotation);
              return (
                <PanelRow
                  key={annotation.id}
                  className={active?.id === annotation.id ? "border-primary" : undefined}
                  leading={formatTimestamp(annotation.timestampMs)}
                  title={
                    <button
                      type="button"
                      className="text-left"
                      onClick={() => onSeek?.(annotation)}
                    >
                      {annotation.note ?? box?.content ?? "(no note)"}
                    </button>
                  }
                  subtitle={box ? box.content : `box ${annotation.boxPath.join(".")}`}
                  trailing={
                    editable ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Delete annotation at ${formatTimestamp(annotation.timestampMs)}`}
                        onClick={() => {
                          deleteFlowAnnotation(annotation.id);
                          refresh();
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    ) : null
                  }
                />
              );
            })}
          </div>
        )}
      </PanelSection>

      {editable ? (
        <PanelSection title="Add annotation">
          <div className="flex items-end gap-2">
            <LabeledField label={`Note at ${formatTimestamp(playbackMs)}`} className="flex-1">
              <Input value={note} onChange={(e) => setNote(e.target.value)} />
            </LabeledField>
            <Button size="sm" onClick={addAnnotation}>
              Mark
            </Button>
          </div>
        </PanelSection>
      ) : null}
    </PanelShell>
  );
}
