/**
 * @fileoverview The plain-text body format for emails an admin writes in the
 * Emails section (saved templates), parsed into blocks `CustomEmail` renders.
 *
 * Blocks are separated by blank lines:
 * - `# Title` is a heading.
 * - A block that is only `[Label](url)` is a button.
 * - Anything else is a paragraph; single new lines stay as line breaks and
 *   `[text](url)` inside it is a link.
 *
 * Link targets may be `https://`, `http://`, `mailto:` or a site path such as
 * `/research`; anything else (e.g. `javascript:`) stays as the literal text.
 */

export type InlinePart = { type: "text"; text: string } | { type: "link"; label: string; href: string };

export type BodyBlock =
  | { type: "heading"; text: string }
  | { type: "button"; label: string; href: string }
  | { type: "paragraph"; lines: InlinePart[][] };

const LINK = /\[([^\]\n]+)\]\(([^)\s]+)\)/g;
const BUTTON = /^\[([^\]\n]+)\]\(([^)\s]+)\)$/;

/** True for the link targets an email may carry. */
export function isSafeEmailHref(href: string): boolean {
  return /^(https?:\/\/|mailto:|\/(?!\/))/i.test(href);
}

function parseInline(line: string): InlinePart[] {
  const parts: InlinePart[] = [];
  let last = 0;
  for (const match of line.matchAll(LINK)) {
    const [whole, label, href] = match;
    if (!isSafeEmailHref(href)) continue;
    if (match.index > last) parts.push({ type: "text", text: line.slice(last, match.index) });
    parts.push({ type: "link", label, href });
    last = match.index + whole.length;
  }
  if (last < line.length) parts.push({ type: "text", text: line.slice(last) });
  return parts;
}

export function parseEmailBody(body: string): BodyBlock[] {
  const blocks: BodyBlock[] = [];
  for (const raw of body.replace(/\r\n?/g, "\n").split(/\n\s*\n/)) {
    const block = raw.trim();
    if (!block) continue;
    const heading = /^#{1,3}\s+(.+)$/.exec(block);
    if (heading && !block.includes("\n")) {
      blocks.push({ type: "heading", text: heading[1].trim() });
      continue;
    }
    const button = BUTTON.exec(block);
    if (button && isSafeEmailHref(button[2])) {
      blocks.push({ type: "button", label: button[1], href: button[2] });
      continue;
    }
    blocks.push({ type: "paragraph", lines: block.split("\n").map((line) => parseInline(line.trim())) });
  }
  return blocks;
}

/** A subject and body to begin a new template from: the Welcome email, as text. */
export const WELCOME_TEMPLATE_STARTER = {
  name: "Welcome",
  subject: "Welcome to Debate AI",
  body: [
    "# Welcome to Debate AI!",
    "Debate AI is one place for competitive debaters in Policy, LD and Public Forum to research evidence, cut cards, flow rounds and practice. Here's where most people start:",
    "[Research evidence](/research): search millions of cards and cut your own in the card editor.\n[Practice debates](/debate): flow a round with the smart timer, or open a real one.\n[Debate vs AI](/practice/versus-ai): argue a full round against an AI opponent, in any format.\n[Watch videos](/videos): NDT, Public Forum and LD rounds plus coaching lectures.\n[Explore the docs](/docs): guides for every tool, from cutting cards to flowing rounds.",
    "[Open Debate AI](/)",
  ].join("\n\n"),
} as const;
