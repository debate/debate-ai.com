/**
 * @fileoverview Team brainstorm boards — UI over `lib/team-brainstorm-assist.ts`
 * reading and writing the persisted ideas in `state/brainstormIdeas.ts`.
 *
 * Generates a prompt per coverage gap, collects ideas against it and ranks
 * them, flagging near-duplicate suggestions.
 */

"use client";

import { useMemo, useState } from "react";
import { Lightbulb, ThumbsUp } from "lucide-react";

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
import { Textarea } from "debate-ui/src/primitives/textarea";

import {
  buildBrainstormBoardsForCoverageGaps,
  buildBrainstormSummaryText,
  type BrainstormBoard,
  type BrainstormCategory,
  type BrainstormIdea,
} from "../lib/team-brainstorm-assist";
import type { TopicCoverageReport } from "../lib/topic-coverage";
import {
  deleteBrainstormIdea,
  listBrainstormIdeas,
  saveBrainstormIdea,
} from "../state/brainstormIdeas";

const CATEGORIES: BrainstormCategory[] = ["argument", "impact_framing", "frontline", "response"];

/** Props for {@link BrainstormBoardPanel}. */
export interface BrainstormBoardPanelProps {
  /** Coverage report whose gaps seed the boards. */
  coverageReport: TopicCoverageReport;
  /** Ideas to rank. Defaults to the persisted idea store. */
  ideas?: BrainstormIdea[];
  /** Contributor attributed to ideas added here. */
  contributorId?: string;
  /** Categories to generate boards for. */
  categories?: BrainstormCategory[];
  /** Extra classes for the panel. */
  className?: string;
}

/**
 * Brainstorm boards for the squad's coverage gaps.
 *
 * @param props - See {@link BrainstormBoardPanelProps}.
 * @returns The brainstorm panel.
 */
export function BrainstormBoardPanel({
  coverageReport,
  ideas,
  contributorId = "me",
  categories: initialCategories,
  className,
}: BrainstormBoardPanelProps) {
  const { data: persisted, refresh } = useStoreSnapshot<BrainstormIdea[]>(listBrainstormIdeas, []);
  const source = ideas ?? persisted;
  const editable = ideas === undefined;

  const [categories, setCategories] = useState<BrainstormCategory[]>(
    initialCategories ?? ["argument", "impact_framing"],
  );
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const boards = useMemo(
    () => buildBrainstormBoardsForCoverageGaps(coverageReport, source, categories),
    [coverageReport, source, categories],
  );

  const totalIdeas = boards.reduce((sum, board) => sum + board.ideas.length, 0);
  const duplicates = boards.reduce(
    (sum, board) => sum + board.ideas.filter((idea) => idea.isLikelyDuplicate).length,
    0,
  );

  const boardKey = (board: BrainstormBoard) => `${board.argBlock}::${board.category}`;

  const addIdea = (board: BrainstormBoard) => {
    const key = boardKey(board);
    const text = (drafts[key] ?? "").trim();
    if (!text) return;
    saveBrainstormIdea({
      id: `idea-${Date.now()}`,
      argBlock: board.argBlock,
      category: board.category,
      contributorId,
      text,
      upvotes: 0,
    });
    setDrafts({ ...drafts, [key]: "" });
    refresh();
  };

  const upvote = (idea: BrainstormIdea) => {
    saveBrainstormIdea({ ...idea, upvotes: idea.upvotes + 1 });
    refresh();
  };

  const toggleCategory = (category: BrainstormCategory) =>
    setCategories((current) =>
      current.includes(category)
        ? current.filter((item) => item !== category)
        : [...current, category],
    );

  return (
    <PanelShell
      title="Team Brainstorm"
      description="Prompts and ranked ideas for the squad's coverage gaps."
      icon={<Lightbulb className="h-4 w-4" />}
      className={className}
      data-testid="brainstorm-board-panel"
      actions={
        <div className="flex flex-wrap gap-1">
          {CATEGORIES.map((category) => (
            <button key={category} type="button" onClick={() => toggleCategory(category)}>
              <Pill tone={categories.includes(category) ? "info" : "neutral"}>
                {category.replace("_", " ")}
              </Pill>
            </button>
          ))}
        </div>
      }
    >
      <StatGrid columns={3}>
        <StatTile label="Boards" value={boards.length} />
        <StatTile label="Ideas" value={totalIdeas} tone="info" />
        <StatTile
          label="Likely duplicates"
          value={duplicates}
          tone={duplicates > 0 ? "warning" : "neutral"}
        />
      </StatGrid>

      {boards.length === 0 ? (
        <EmptyState
          title="No boards"
          message="Boards appear for each under-covered argument. Pick at least one category."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {boards.map((board) => {
            const key = boardKey(board);
            return (
              <PanelSection
                key={key}
                title={`${board.argBlock} · ${board.category.replace("_", " ")}`}
                description={board.prompt}
              >
                {board.ideas.length === 0 ? (
                  <EmptyState title="No ideas yet" />
                ) : (
                  <div className="flex flex-col gap-2">
                    {board.ideas.map((idea, index) => (
                      <PanelRow
                        key={idea.id}
                        leading={`#${index + 1}`}
                        title={idea.text}
                        subtitle={idea.contributorId}
                        trailing={
                          <>
                            {idea.isLikelyDuplicate ? <Pill tone="warning">duplicate?</Pill> : null}
                            <Pill tone="info">{idea.popularityScore.toFixed(2)}</Pill>
                            <span className="tabular-nums">{idea.upvotes}</span>
                            {editable ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  aria-label={`Upvote idea ${idea.id}`}
                                  onClick={() => upvote(idea)}
                                >
                                  <ThumbsUp className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    deleteBrainstormIdea(idea.id);
                                    refresh();
                                  }}
                                >
                                  Remove
                                </Button>
                              </>
                            ) : null}
                          </>
                        }
                      />
                    ))}
                  </div>
                )}

                {editable ? (
                  <div className="flex items-end gap-2">
                    <Textarea
                      rows={2}
                      value={drafts[key] ?? ""}
                      placeholder="Add an idea"
                      onChange={(e) => setDrafts({ ...drafts, [key]: e.target.value })}
                    />
                    <Button size="sm" onClick={() => addIdea(board)}>
                      Add
                    </Button>
                  </div>
                ) : null}

                {board.ideas.length > 0 ? (
                  <SummaryText text={buildBrainstormSummaryText(board)} />
                ) : null}
              </PanelSection>
            );
          })}
        </div>
      )}
    </PanelShell>
  );
}
