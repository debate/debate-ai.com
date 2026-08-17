/**
 * @fileoverview Video-lecture-training coach AI — UI over
 * `debate-speech-writer`'s `team-coach-materials.ts`, backed by the persisted
 * materials in `state/coachMaterials.ts`.
 *
 * The library groups a squad's lecture transcripts and camp handouts; asking
 * a question retrieves the most relevant ones and shows the grounded prompt
 * that would be sent to the coach AI.
 */

"use client";

import { useMemo, useState } from "react";
import { BookOpen, Trash2 } from "lucide-react";

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
  buildCoachMaterialLibrary,
  buildCoachMaterialLibrarySummaryText,
  buildGroundedCoachPrompt,
  excerptMaterialText,
  findRelevantMaterials,
  type CoachMaterial,
  type CoachMaterialKind,
} from "debate-speech-writer/src/coach/team-coach-materials";
import {
  deleteCoachMaterial,
  listCoachMaterials,
  saveCoachMaterial,
} from "debate-speech-writer/src/state/coachMaterials";

const KINDS: CoachMaterialKind[] = [
  "lecture_transcript",
  "camp_material",
  "instructional_document",
  "practice_recording",
];

const KIND_LABEL: Record<CoachMaterialKind, string> = {
  lecture_transcript: "Lecture",
  camp_material: "Camp",
  instructional_document: "Doc",
  practice_recording: "Recording",
};

const EMPTY_DRAFT = {
  title: "",
  topic: "",
  tags: "",
  text: "",
  kind: "lecture_transcript" as CoachMaterialKind,
};

/** Props for {@link CoachMaterialsPanel}. */
export interface CoachMaterialsPanelProps {
  /** Materials to search. Defaults to the persisted coach materials. */
  materials?: CoachMaterial[];
  /** Extra classes for the panel. */
  className?: string;
}

/**
 * Grounding-materials library for the coach AI.
 *
 * @param props - See {@link CoachMaterialsPanelProps}.
 * @returns The coach materials panel.
 */
export function CoachMaterialsPanel({ materials, className }: CoachMaterialsPanelProps) {
  const { data: persisted, refresh } = useStoreSnapshot<CoachMaterial[]>(listCoachMaterials, []);
  const source = materials ?? persisted;
  const editable = materials === undefined;

  const [question, setQuestion] = useState("");
  const [topic, setTopic] = useState("");
  const [draft, setDraft] = useState(EMPTY_DRAFT);

  const library = useMemo(() => buildCoachMaterialLibrary(source), [source]);
  const matches = useMemo(
    () =>
      question.trim()
        ? findRelevantMaterials(source, question.trim(), {
            ...(topic.trim() ? { topic: topic.trim() } : {}),
          })
        : [],
    [source, question, topic],
  );

  const addMaterial = () => {
    if (!draft.title.trim() || !draft.text.trim()) return;
    saveCoachMaterial({
      id: `material-${Date.now()}`,
      kind: draft.kind,
      title: draft.title.trim(),
      ...(draft.topic.trim() ? { topic: draft.topic.trim() } : {}),
      tags: draft.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      text: draft.text.trim(),
    });
    setDraft(EMPTY_DRAFT);
    refresh();
  };

  return (
    <PanelShell
      title="Coach Materials"
      description="Lecture transcripts and camp handouts the coach AI answers from."
      icon={<BookOpen className="h-4 w-4" />}
      className={className}
      data-testid="coach-materials-panel"
    >
      <StatGrid columns={3}>
        <StatTile label="Materials" value={library.totalMaterials} />
        <StatTile label="Groups" value={library.groups.length} />
        <StatTile label="Matches" value={matches.length} tone="info" />
      </StatGrid>

      <PanelSection title="Ask the coach">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_1fr]">
          <LabeledField label="Question">
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="How do I collapse in the 2NR?"
            />
          </LabeledField>
          <LabeledField label="Topic filter (optional)">
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} />
          </LabeledField>
        </div>

        {question.trim() ? (
          matches.length === 0 ? (
            <EmptyState
              title="No relevant materials"
              message="Try different wording, or clear the topic filter."
            />
          ) : (
            <>
              <div className="flex flex-col gap-2">
                {matches.map((match) => (
                  <PanelRow
                    key={match.material.id}
                    title={match.material.title}
                    subtitle={excerptMaterialText(match.material.text, 160)}
                    trailing={
                      <>
                        <Pill>{KIND_LABEL[match.material.kind]}</Pill>
                        <Pill tone="info">{match.relevance.toFixed(2)}</Pill>
                      </>
                    }
                  />
                ))}
              </div>
              <SummaryText
                label="Grounded prompt"
                text={buildGroundedCoachPrompt(question.trim(), matches)}
              />
            </>
          )
        ) : null}
      </PanelSection>

      <PanelSection title="Library">
        {library.groups.length === 0 ? (
          <EmptyState
            title="No materials yet"
            message={editable ? "Add a lecture transcript or handout below." : undefined}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {library.groups.map((group) => (
              <PanelRow
                key={group.kind}
                title={KIND_LABEL[group.kind]}
                subtitle={`${group.materials.length} material${group.materials.length === 1 ? "" : "s"}`}
              >
                <ul className="flex flex-col gap-1">
                  {group.materials.map((material) => (
                    <li
                      key={material.id}
                      className="flex items-center justify-between gap-2 text-xs"
                    >
                      <span className="truncate">
                        {material.title}
                        {material.topic ? (
                          <span className="text-muted-foreground"> · {material.topic}</span>
                        ) : null}
                      </span>
                      {editable ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Delete ${material.title}`}
                          onClick={() => {
                            deleteCoachMaterial(material.id);
                            refresh();
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </PanelRow>
            ))}
          </div>
        )}
        {library.totalMaterials > 0 ? (
          <SummaryText text={buildCoachMaterialLibrarySummaryText(library)} />
        ) : null}
      </PanelSection>

      {editable ? (
        <PanelSection title="Add material">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <LabeledField label="Title">
              <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </LabeledField>
            <LabeledField label="Topic">
              <Input value={draft.topic} onChange={(e) => setDraft({ ...draft, topic: e.target.value })} />
            </LabeledField>
            <LabeledField label="Tags (comma separated)">
              <Input value={draft.tags} onChange={(e) => setDraft({ ...draft, tags: e.target.value })} />
            </LabeledField>
            <LabeledField label="Text" className="sm:col-span-3">
              <Textarea
                rows={4}
                value={draft.text}
                onChange={(e) => setDraft({ ...draft, text: e.target.value })}
              />
            </LabeledField>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {KINDS.map((kind) => (
              <button key={kind} type="button" onClick={() => setDraft({ ...draft, kind })}>
                <Pill tone={draft.kind === kind ? "info" : "neutral"}>{KIND_LABEL[kind]}</Pill>
              </button>
            ))}
            <Button
              size="sm"
              onClick={addMaterial}
              disabled={!draft.title.trim() || !draft.text.trim()}
            >
              Add material
            </Button>
          </div>
        </PanelSection>
      ) : null}
    </PanelShell>
  );
}
