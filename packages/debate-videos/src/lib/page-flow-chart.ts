/**
 * @fileoverview The same argument mind map as the watch page's flow chart,
 * drawn from one written page instead of a round's speeches — the docs
 * toolbar's "Flow chart" button.
 *
 * A page has no speeches, so its sections stand in for them: the page's
 * Markdown is split at its headings (`pageFlowChartSections`), each section
 * gets a short tag (`§1`, `§2`, …) that bubbles carry in place of a speech
 * label, and the chart's columns are the page's sections in order. Sides
 * keep their colours but mean "the page's own claims" (aff, blue) and "the
 * views it raises or answers" (neg, red).
 *
 * The reply contract and parser are the round chart's
 * (`parseFlowChartResponse` in `debate-flow-chart.ts`), so the D3 view draws
 * a page chart unchanged. Pure prompt building only; `speech-ai-client.ts`
 * makes the network call.
 * @module lib/page-flow-chart
 */

import { MAX_FLOW_CHART_NODES, MAX_FLOW_CHART_OUTLINE_CHARS } from "./debate-flow-chart";

/** One section of the page, as the chart request sends it. */
export interface PageFlowChartSection {
  /** The tag bubbles carry for this section: `§1`, `§2`, … */
  label: string;
  /** The section's heading, or `Introduction` for text before the first one. */
  heading: string;
  /** The section's Markdown, heading line excluded. */
  text: string;
}

/** Most sections a page is split into; the rest fold into the last one. */
export const MAX_PAGE_FLOW_CHART_SECTIONS = 16;

/** The editable part of the prompt for a page. Shown in the modal. */
export const DEFAULT_PAGE_FLOW_CHART_INSTRUCTIONS = `Build a mind map of the arguments on this page from its sections below.

- Make one bubble for each main claim or argument the page makes, tagged "aff", and one for each opposing view, objection or position the page describes or answers, tagged "neg".
- Under each main argument, add 1-4 sub-bubbles for its key reasons, evidence, examples or impacts.
- Connect bubbles that clash or build on each other: link each answer to the view it responds to, and link a later section's development of a point to where it was first made.
- Explain every bubble clearly in one or two plain sentences, so someone who has not read the page understands the argument and why it matters.
- Use short flow-style tags for the bubble labels (e.g. "Cap K — Alt", "Perm: do both").
- Tag every bubble with the section it comes from.
- Finish with a one-sentence summary of the page's bottom line.`;

/** The fixed reply contract for a page: the round chart's JSON shape, with sections for speeches. */
export const PAGE_FLOW_CHART_SYSTEM_PROMPT = `You are an expert competitive debate coach. You turn a written page — an article, a guide or a critique — into a mind map of its arguments and how they clash. Follow the user's instructions about what to include.

Reply with ONLY one JSON object, no Markdown fence or commentary, in this exact shape:
{"summary":"one sentence","nodes":[{"id":"a1","side":"aff","label":"short tag","text":"one or two plain sentences explaining it","speech":"§1"},{"id":"a1w1","side":"aff","label":"reason tag","text":"explanation","parent":"a1"}],"links":[{"from":"n1","to":"a1","kind":"answers","label":"few words"}]}

RULES:
- "side" is "aff" (a claim the page itself makes or defends) or "neg" (an opposing view, objection or position the page describes or answers) — never anything else.
- "speech" is the tag of the section the argument comes from, exactly as written in square brackets in the section headings (e.g. "§2"). Give every node one, sub-bubbles included.
- "id" is short and unique. A sub-bubble's "parent" is the id of its main argument and has the same side.
- "links" connect related bubbles: "answers" (from the answer to the view it responds to), "extends" (from a later development to the original point), or "related" (same topic). Do not repeat parent links in "links".
- At most ${MAX_FLOW_CHART_NODES} nodes in total. Keep labels under 6 words and each "text" under 30 words.
- Stay faithful to the page: no arguments, evidence or answers that are not in it.`;

/** Drops YAML frontmatter, HTML comments and MDX import/export lines, which carry no argument. */
function stripMarkdownNoise(markdown: string): string {
  return markdown
    .replace(/^﻿?---\r?\n[\s\S]*?\r?\n---\r?\n/, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/^(import|export)\s.*$/gm, "");
}

/**
 * Splits a page's Markdown into sections at its headings: at `#`/`##`
 * headings, or also at `###` when the page has fewer than two of those.
 * Headings inside code fences don't count, text before the first heading
 * becomes an `Introduction` section, and empty sections are dropped.
 */
export function pageFlowChartSections(markdown: string): PageFlowChartSection[] {
  const lines = stripMarkdownNoise(markdown).split(/\r?\n/);
  const headings: Array<{ line: number; level: number; text: string }> = [];
  let fence: string | null = null;
  lines.forEach((line, index) => {
    const fenceMatch = /^\s*(```|~~~)/.exec(line);
    if (fenceMatch) {
      if (fence === null) fence = fenceMatch[1];
      else if (fence === fenceMatch[1]) fence = null;
      return;
    }
    if (fence !== null) return;
    const heading = /^(#{1,3})\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading) headings.push({ line: index, level: heading[1].length, text: heading[2] });
  });
  const topLevel = headings.filter((heading) => heading.level <= 2);
  const splits = topLevel.length >= 2 ? topLevel : headings;

  const raw: Array<{ heading: string; text: string }> = [];
  const firstLine = splits[0]?.line ?? lines.length;
  raw.push({ heading: "Introduction", text: lines.slice(0, firstLine).join("\n") });
  splits.forEach((split, index) => {
    const end = splits[index + 1]?.line ?? lines.length;
    raw.push({ heading: cleanHeading(split.text), text: lines.slice(split.line + 1, end).join("\n") });
  });

  const kept = raw.map((section) => ({ ...section, text: section.text.trim() })).filter((section) => section.text);
  if (kept.length > MAX_PAGE_FLOW_CHART_SECTIONS) {
    const rest = kept.splice(MAX_PAGE_FLOW_CHART_SECTIONS - 1);
    kept.push({
      heading: rest[0].heading,
      text: rest.map((section) => `### ${section.heading}\n${section.text}`).join("\n\n"),
    });
  }
  return kept.map((section, index) => ({ label: `§${index + 1}`, ...section }));
}

/** A heading's plain text: Markdown emphasis, links and inline code removed. */
function cleanHeading(text: string): string {
  return text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export interface PageFlowChartPromptInput {
  /** The reader's instructions (the modal's textarea). Empty falls back to the default. */
  instructions?: string;
  title?: string;
  sections: PageFlowChartSection[];
}

/** The user turn: the reader's instructions, the page title, then every section in order. */
export function buildPageFlowChartPrompt(input: PageFlowChartPromptInput): string {
  const lines: string[] = [input.instructions?.trim() || DEFAULT_PAGE_FLOW_CHART_INSTRUCTIONS, ""];
  if (input.title) lines.push(`Page: ${input.title}`);
  lines.push("", "The page's sections, in order:");
  let budget = MAX_FLOW_CHART_OUTLINE_CHARS;
  for (const section of input.sections) {
    const text = section.text.trim();
    if (!text || budget <= 0) continue;
    const clipped = text.length > budget ? `${text.slice(0, budget)}\n(cut off)` : text;
    budget -= clipped.length;
    lines.push("", `## ${section.heading} [${section.label}]`, clipped);
  }
  return lines.join("\n");
}
