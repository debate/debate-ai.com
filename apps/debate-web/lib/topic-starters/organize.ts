/**
 * @fileoverview "Organize by argument" for the public Topic Starters: asks
 * the model which side and argument type each file is — an Aff case, or a
 * Neg DA, CP, T or K — so the catalogue can be refiled as `Aff/Case`,
 * `Neg/DA`, `Neg/CP`, `Neg/T`, `Neg/K` and so on.
 *
 * The model reads only each file's name and the folders above it, never the
 * file itself: debate files are named for what they are ("Elections DA",
 * "Cap K", "1AC - Warming"), and the stored `.cmir` is a multi-kilobyte
 * base64 blob per file. Its answer is a proposal — the route returns it as a
 * `reorganize` change the reader confirms, which then goes through the same
 * moderator queue as any other edit.
 *
 * @module lib/topic-starters/organize
 */

import {
  ARGUMENT_TYPES,
  sanitizeAssignments,
  type ArgumentAssignment,
  type TopicTreeRow,
} from "@debate-ai/reason-docs/lib/topic-starters/changes";
import type { ProviderKey } from "@/lib/ai/provider-key";

// The models the site's other AI routes already call in production.
const ANTHROPIC_MODEL = "claude-sonnet-4-6";
const OPENROUTER_MODEL = "anthropic/claude-sonnet-4.6";
const ANTHROPIC_VERSION = "2023-06-01";
const MAX_TOKENS = 8_000;

/** Files classified per model call — keeps each answer well inside MAX_TOKENS. */
export const ORGANIZE_BATCH_SIZE = 150;

/** Most files one organize run reads, so a run stays inside a Worker request. */
export const MAX_ORGANIZE_FILES = 600;

export const ORGANIZE_PROMPT = `You sort a competitive debate team's shared files (Policy, LD, Public Forum) by argument.

Each input line is one file: its numeric id, a tab, then its folder path and file name. For every file decide:
- side: "aff" when the file is for the affirmative (a 1AC, an aff case, plan, advantages, or aff answers to negative positions), "neg" when it is for the negative.
- type: the argument the file is about:
  "case" — an affirmative case, plan, advantage or contention, or the negative's on-case answers to one;
  "da" — a disadvantage (politics, elections, spending, tradeoff DAs) or answers to one;
  "cp" — a counterplan (PIC, agent, process, states, consult) or answers to one;
  "t" — topicality or answers to it;
  "k" — a kritik (critique: cap, security, setcol, afropess, biopower, ...) or answers to one;
  "theory" — theory or framework arguments that are none of the above;
  "other" — anything you cannot place.

Answers to an argument keep that argument's type and take the side that reads them ("AT Elections DA" in an aff file is side "aff", type "da"). Use the name and its folders only; when they say nothing, answer "other" with the side the folders suggest, or "neg".

Answer with a single JSON object and nothing else — no prose, no code fence:
{"files": [{"id": 12, "side": "neg", "type": "da"}]}
with exactly one entry per input id. type is one of ${ARGUMENT_TYPES.map((t) => `"${t}"`).join(", ")}.`;

/** Each published file with the folder path above it, as the model reads it. */
export function organizeInputLines(rows: readonly TopicTreeRow[]): Array<{ id: number; line: string }> {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const pathOf = (row: TopicTreeRow): string => {
    const parts: string[] = [];
    const seen = new Set<number>();
    let parentId = row.parentId;
    while (parentId != null && !seen.has(parentId)) {
      seen.add(parentId);
      const parent = byId.get(parentId);
      if (!parent) break;
      parts.unshift(parent.title);
      parentId = parent.parentId;
    }
    return [...parts, row.title].join(" / ");
  };
  return rows
    .filter((row) => !row.isFolder)
    .slice(0, MAX_ORGANIZE_FILES)
    .map((row) => ({ id: row.id, line: `${row.id}\t${pathOf(row).replace(/[\t\n]+/g, " ")}` }));
}

/**
 * Reads the model's answer into assignments, keeping only ids that were in
 * the batch it was asked about, so a hallucinated id can never move a file
 * the reader didn't see in the proposal.
 */
export function parseOrganizeReply(reply: string, askedIds: ReadonlySet<number>): ArgumentAssignment[] {
  const start = reply.indexOf("{");
  const end = reply.lastIndexOf("}");
  if (start < 0 || end <= start) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(reply.slice(start, end + 1));
  } catch {
    return [];
  }
  const files = parsed && typeof parsed === "object" ? (parsed as { files?: unknown }).files : null;
  return sanitizeAssignments(files).filter((assignment) => askedIds.has(assignment.itemId));
}

async function callModel(key: ProviderKey, content: string): Promise<string> {
  if (key.provider === "openrouter") {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key.key}`,
        "HTTP-Referer": "https://debate-ai.com",
        "X-Title": "Debate AI",
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        max_tokens: MAX_TOKENS,
        messages: [
          { role: "system", content: ORGANIZE_PROMPT },
          { role: "user", content },
        ],
      }),
    });
    if (!res.ok) throw new Error(`OpenRouter returned ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`);
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string | null } }>; error?: { message?: string } };
    if (json.error) throw new Error(`OpenRouter: ${json.error.message ?? "upstream error"}`);
    return json.choices?.[0]?.message?.content ?? "";
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key.key, "anthropic-version": ANTHROPIC_VERSION },
    body: JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens: MAX_TOKENS, system: ORGANIZE_PROMPT, messages: [{ role: "user", content }] }),
  });
  if (!res.ok) throw new Error(`Anthropic returned ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`);
  const json = (await res.json()) as { content?: Array<{ type?: string; text?: string }> };
  return (json.content ?? []).filter((block) => block.type === "text").map((block) => block.text ?? "").join("");
}

/**
 * Classifies every published file, a batch per model call, in parallel.
 * Throws with a reader-facing message when no batch came back usable.
 */
export async function classifyTopicStarters(
  key: ProviderKey,
  rows: readonly TopicTreeRow[],
  ask: (key: ProviderKey, content: string) => Promise<string> = callModel,
): Promise<ArgumentAssignment[]> {
  const lines = organizeInputLines(rows);
  if (lines.length === 0) return [];
  const batches: Array<typeof lines> = [];
  for (let index = 0; index < lines.length; index += ORGANIZE_BATCH_SIZE) {
    batches.push(lines.slice(index, index + ORGANIZE_BATCH_SIZE));
  }
  const errors: string[] = [];
  const results = await Promise.all(
    batches.map(async (batch) => {
      try {
        const reply = await ask(key, batch.map((entry) => entry.line).join("\n"));
        return parseOrganizeReply(reply, new Set(batch.map((entry) => entry.id)));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`topic-starters organize: ${message}`);
        errors.push(message);
        return [];
      }
    }),
  );
  const assignments = results.flat();
  if (assignments.length === 0) {
    throw new Error(errors[0] ? `The AI could not sort the files (${errors[0]}).` : "The AI returned an unreadable answer.");
  }
  return assignments;
}
