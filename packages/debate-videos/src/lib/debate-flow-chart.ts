/**
 * @fileoverview The whole round as one mind map — the watch page's
 * "Flow chart" button.
 *
 * A debater reviewing a round wants to see how the arguments clashed: which
 * negative position answered which affirmative contention, where an
 * argument was extended, what got dropped. This module turns the round's
 * per-speech LLM outlines (`speech-summary.ts`) into a request for a graph —
 * argument bubbles with sub-bubbles for their warrants, each tagged aff or
 * neg, plus links between bubbles that answer or extend each other — and
 * reads the model's JSON reply back into a `DebateFlowChart` the D3 view
 * (`components/videos/watch/flow-chart/`) draws: aff in blue, neg in red.
 *
 * The instructions part of the prompt is the viewer's to edit in the modal;
 * the reply format below it is fixed so the parser always knows the shape.
 *
 * Pure prompt building and parsing only; `speech-ai-client.ts` makes the
 * network call.
 * @module lib/debate-flow-chart
 */

import type { RoundSpeech, SpeechSide } from "./round-speeches";

/** The side a bubble belongs to — only the two teams get bubbles. */
export type FlowChartSide = "aff" | "neg";

/** One bubble: an argument, or (with `parent`) a warrant or sub-point of one. */
export interface FlowChartNode {
  id: string;
  side: FlowChartSide;
  /** A short tag, as on a flow: `DA — Midterms`. */
  label: string;
  /** One or two plain sentences on what the argument says and why it matters. */
  explanation: string;
  /** The bubble this one hangs off; absent for a top-level argument. */
  parent?: string;
  /** The speech the argument was first made in, e.g. `1NC`. */
  speech?: string;
}

/** How two related bubbles connect. */
export type FlowChartLinkKind = "answers" | "extends" | "related";

/** A link between two bubbles that clash or build on each other (not parent → child). */
export interface FlowChartLink {
  source: string;
  target: string;
  kind: FlowChartLinkKind;
  /** A few words on the connection, e.g. `non-unique: bill already dead`. */
  label?: string;
}

export interface DebateFlowChart {
  /** One line on what the round came down to. */
  summary?: string;
  nodes: FlowChartNode[];
  links: FlowChartLink[];
}

/** Most bubbles a chart keeps — beyond this a mind map stops being readable. */
export const MAX_FLOW_CHART_NODES = 40;
/** Most speech outlines one request sends, in characters. */
export const MAX_FLOW_CHART_OUTLINE_CHARS = 48_000;
/** How many of the round's last speeches get an outline generated when missing. */
export const MIN_SUMMARIZED_SPEECHES = 4;

/** The editable part of the prompt: what the chart should show. Shown in the modal. */
export const DEFAULT_FLOW_CHART_INSTRUCTIONS = `Build a mind map of this whole debate round from the speech outlines below.

- Make one bubble for each main argument (contention, advantage, off-case position, framework, or major answer), tagged with the side that made it.
- Under each main argument, add 1-4 sub-bubbles for its key warrants, evidence, link chain or impact.
- Connect bubbles on the same topic across the two sides: link each answer to the argument it responds to, and link a later speech's extension to the argument it extends.
- Explain every bubble clearly in one or two plain sentences, so someone who did not watch the round understands the argument and why it matters.
- Use short flow-style tags for the bubble labels (e.g. "DA — Midterms", "Contention 1: Jobs").
- Finish with a one-sentence summary of what the round came down to.`;

/** The fixed reply contract appended to the viewer's instructions. */
export const FLOW_CHART_SYSTEM_PROMPT = `You are an expert competitive debate coach who flows rounds for a living. You turn a round's speech-by-speech outlines into a mind map of the arguments and how they clash. Follow the user's instructions about what to include.

Reply with ONLY one JSON object, no Markdown fence or commentary, in this exact shape:
{"summary":"one sentence","nodes":[{"id":"a1","side":"aff","label":"short tag","text":"one or two plain sentences explaining it","speech":"1AC"},{"id":"a1w1","side":"aff","label":"warrant tag","text":"explanation","parent":"a1"}],"links":[{"from":"n1","to":"a1","kind":"answers","label":"few words"}]}

RULES:
- "side" is "aff" (affirmative / pro) or "neg" (negative / con) — never anything else.
- "id" is short and unique. A sub-bubble's "parent" is the id of its main argument and has the same side.
- "links" connect related bubbles: "answers" (from the answer to the argument it responds to), "extends" (from a later extension to the original), or "related" (same topic). Do not repeat parent links in "links".
- At most ${MAX_FLOW_CHART_NODES} nodes in total. Keep labels under 6 words and each "text" under 30 words.
- Stay faithful to the outlines: no arguments, evidence or answers that are not in them.`;

const SIDE_NAMES: Record<SpeechSide, string> = {
  aff: "Affirmative / Pro",
  neg: "Negative / Con",
  cx: "Cross-examination",
  neutral: "Neutral",
};

/** One speech as the chart request sends it. */
export interface FlowChartSpeechOutline {
  label: string;
  heading: string;
  side: SpeechSide;
  outline: string;
}

export interface FlowChartPromptInput {
  /** The viewer's instructions (the modal's textarea). Empty falls back to the default. */
  instructions?: string;
  speeches: FlowChartSpeechOutline[];
  videoTitle?: string;
  format?: string;
  aff?: string | null;
  neg?: string | null;
}

/** The user turn: the viewer's instructions, the round, then every speech outline in order. */
export function buildFlowChartPrompt(input: FlowChartPromptInput): string {
  const lines: string[] = [(input.instructions?.trim() || DEFAULT_FLOW_CHART_INSTRUCTIONS), ""];
  if (input.videoTitle) lines.push(`Round: ${input.videoTitle}`);
  if (input.format) lines.push(`Format: ${input.format}`);
  if (input.aff) lines.push(`Affirmative / Pro: ${input.aff}`);
  if (input.neg) lines.push(`Negative / Con: ${input.neg}`);
  lines.push("", "Speech outlines, in the order they were given:");
  let budget = MAX_FLOW_CHART_OUTLINE_CHARS;
  for (const speech of input.speeches) {
    const outline = speech.outline.trim();
    if (!outline || budget <= 0) continue;
    const clipped = outline.length > budget ? `${outline.slice(0, budget)}\n(cut off)` : outline;
    budget -= clipped.length;
    lines.push("", `## ${speech.heading || speech.label} (${SIDE_NAMES[speech.side]})`, clipped);
  }
  return lines.join("\n");
}

/** Whether a speech belongs on the chart: a real speech by one of the two teams. */
export function isFlowChartSpeech(speech: Pick<RoundSpeech, "side" | "isSpeech">): boolean {
  return speech.isSpeech && (speech.side === "aff" || speech.side === "neg");
}

/**
 * The speeches whose outline has to be generated before the chart: of the
 * round's last `count` team speeches that have a transcript, the ones with no
 * outline yet. With `all`, every team speech with a transcript is considered.
 */
export function speechesToSummarize(
  speeches: RoundSpeech[],
  outlines: Record<string, string | undefined>,
  { count = MIN_SUMMARIZED_SPEECHES, all = false }: { count?: number; all?: boolean } = {},
): RoundSpeech[] {
  const candidates = speeches.filter((speech) => isFlowChartSpeech(speech) && speech.parts.transcript?.trim());
  const considered = all ? candidates : candidates.slice(-count);
  return considered.filter((speech) => !outlines[speech.key]?.trim());
}

/** The outlines the chart is built from, in round order. */
export function flowChartOutlines(
  speeches: RoundSpeech[],
  outlines: Record<string, string | undefined>,
): FlowChartSpeechOutline[] {
  const result: FlowChartSpeechOutline[] = [];
  for (const speech of speeches) {
    const outline = outlines[speech.key]?.trim();
    if (!outline || speech.side === "neutral") continue;
    result.push({ label: speech.label, heading: speech.heading, side: speech.side, outline });
  }
  return result;
}

function normalizeSide(value: unknown): FlowChartSide | null {
  if (typeof value !== "string") return null;
  const side = value.trim().toLowerCase();
  if (/^(aff|affirmative|pro|gov|government|prop|proposition)$/.test(side)) return "aff";
  if (/^(neg|negative|con|opp|opposition)$/.test(side)) return "neg";
  return null;
}

function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function normalizeKind(value: unknown): FlowChartLinkKind {
  const kind = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (kind.startsWith("answer") || kind === "responds" || kind === "rebuts" || kind === "clash") return "answers";
  if (kind.startsWith("extend")) return "extends";
  return "related";
}

/**
 * Every complete `{…}` object in the text, innermost-out, skipping braces in
 * strings — so a reply cut off by the token limit still yields the bubbles
 * written before the cut.
 */
function completeObjects(text: string): unknown[] {
  const found: unknown[] = [];
  const stack: number[] = [];
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") stack.push(i);
    else if (char === "}" && stack.length > 0) {
      const start = stack.pop() as number;
      try {
        found.push(JSON.parse(text.slice(start, i + 1)));
      } catch {
        // Not valid on its own; an enclosing object may still parse.
      }
    }
  }
  return found;
}

type Raw = Record<string, unknown>;

function rawNodesAndLinks(text: string): { nodes: Raw[]; links: Raw[]; summary?: unknown } {
  const unfenced = text.replace(/^\s*```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/, "");
  const start = unfenced.indexOf("{");
  if (start !== -1) {
    try {
      const whole = JSON.parse(unfenced.slice(start, unfenced.lastIndexOf("}") + 1)) as Raw;
      if (whole && Array.isArray(whole.nodes)) {
        return {
          nodes: whole.nodes.filter((n): n is Raw => !!n && typeof n === "object"),
          links: Array.isArray(whole.links) ? whole.links.filter((l): l is Raw => !!l && typeof l === "object") : [],
          summary: whole.summary,
        };
      }
    } catch {
      // Cut off or malformed — salvage what objects are complete below.
    }
  }
  const objects = completeObjects(unfenced).filter((o): o is Raw => !!o && typeof o === "object" && !Array.isArray(o));
  const summaryMatch = unfenced.match(/"summary"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  return {
    nodes: objects.filter((o) => "id" in o && ("side" in o || "label" in o)),
    links: objects.filter((o) => ("from" in o || "source" in o) && ("to" in o || "target" in o)),
    summary: summaryMatch ? summaryMatch[1].replace(/\\"/g, '"') : undefined,
  };
}

/**
 * Reads the model's reply into a chart: unknown sides are dropped (a child
 * takes its parent's side), parents and links that name no bubble are
 * dropped, duplicates are removed, and the chart is capped at
 * `MAX_FLOW_CHART_NODES` bubbles.
 *
 * @returns The chart, or `null` when the reply holds no usable bubble.
 */
export function parseFlowChartResponse(text: string): DebateFlowChart | null {
  const raw = rawNodesAndLinks(text);
  const byId = new Map<string, FlowChartNode>();
  const pendingSide: Array<{ node: Omit<FlowChartNode, "side">; parent?: string }> = [];
  const order = new Map<string, number>();

  for (const item of raw.nodes) {
    const id = cleanText(item.id ?? item.key, 40);
    const label = cleanText(item.label ?? item.title ?? item.name, 80);
    if (!id || !label || byId.has(id)) continue;
    const explanation = cleanText(item.text ?? item.explanation ?? item.description, 400);
    const parent = cleanText(item.parent, 40) || undefined;
    const speech = cleanText(item.speech, 20) || undefined;
    const side = normalizeSide(item.side);
    const node = { id, label, explanation, parent, speech };
    if (!order.has(id)) order.set(id, order.size);
    if (side) byId.set(id, { ...node, side });
    else if (parent) pendingSide.push({ node, parent });
  }
  // A sub-bubble with no side of its own takes its parent's.
  for (const { node, parent } of pendingSide) {
    const owner = parent ? byId.get(parent) : undefined;
    if (owner && !byId.has(node.id)) byId.set(node.id, { ...node, side: owner.side });
  }

  // Top-level bubbles first so the cap never strands a child without its parent.
  const all = [...byId.values()].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  for (const node of all) {
    if (node.parent && (!byId.has(node.parent) || node.parent === node.id)) delete node.parent;
  }
  // Break parent cycles: walk up from each node; a revisit means a loop.
  for (const node of all) {
    const seen = new Set<string>([node.id]);
    let current = node.parent ? byId.get(node.parent) : undefined;
    while (current) {
      if (seen.has(current.id)) {
        delete node.parent;
        break;
      }
      seen.add(current.id);
      current = current.parent ? byId.get(current.parent) : undefined;
    }
  }
  const depth = (node: FlowChartNode): number => {
    let d = 0;
    let current = node;
    while (current.parent && d < MAX_FLOW_CHART_NODES) {
      current = byId.get(current.parent) as FlowChartNode;
      d++;
    }
    return d;
  };
  const kept = all
    .map((node, index) => ({ node, index, depth: depth(node) }))
    .sort((a, b) => a.depth - b.depth || a.index - b.index)
    .slice(0, MAX_FLOW_CHART_NODES)
    .sort((a, b) => a.index - b.index)
    .map(({ node }) => node);
  if (kept.length === 0) return null;
  const keptIds = new Set(kept.map((node) => node.id));

  const links: FlowChartLink[] = [];
  const seenLinks = new Set<string>();
  for (const item of raw.links) {
    const source = cleanText(item.from ?? item.source, 40);
    const target = cleanText(item.to ?? item.target, 40);
    if (!keptIds.has(source) || !keptIds.has(target) || source === target) continue;
    const pair = [source, target].sort().join("\u0000");
    if (seenLinks.has(pair)) continue;
    const sourceNode = byId.get(source) as FlowChartNode;
    const targetNode = byId.get(target) as FlowChartNode;
    if (sourceNode.parent === target || targetNode.parent === source) continue;
    seenLinks.add(pair);
    const label = cleanText(item.label, 80) || undefined;
    links.push({ source, target, kind: normalizeKind(item.kind ?? item.type), ...(label ? { label } : {}) });
  }

  const summary = cleanText(raw.summary, 300) || undefined;
  return { ...(summary ? { summary } : {}), nodes: kept, links };
}

/** The chart as a readable outline, for the list under the graph and for copying. */
export function flowChartOutline(chart: DebateFlowChart): string {
  const children = new Map<string, FlowChartNode[]>();
  for (const node of chart.nodes) {
    if (!node.parent) continue;
    children.set(node.parent, [...(children.get(node.parent) ?? []), node]);
  }
  const lines: string[] = [];
  const write = (node: FlowChartNode, indent: number) => {
    const side = node.side === "aff" ? "AFF" : "NEG";
    const speech = node.speech ? ` (${node.speech})` : "";
    const explanation = node.explanation ? ` — ${node.explanation}` : "";
    lines.push(`${"  ".repeat(indent)}- [${side}] **${node.label}**${speech}${explanation}`);
    for (const child of children.get(node.id) ?? []) write(child, indent + 1);
  };
  for (const node of chart.nodes) if (!node.parent) write(node, 0);
  if (chart.summary) lines.push("", `**Bottom line:** ${chart.summary}`);
  return lines.join("\n");
}
