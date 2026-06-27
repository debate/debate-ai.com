/**
 * AI image alt-text — ported from CardMirror's `ai/image-ai.ts`
 * (`runGenerateAltText` only; see below for what's cut).
 *
 * Given an `image` node in the doc, sends it to Claude with a
 * description prompt and inserts a `[ALT TEXT: …]` paragraph right
 * after the textblock containing the image, plus writes the result to
 * the image node's `alt` attribute.
 *
 * Cut from this v1 port:
 *  - `runGenerateTable` (table-from-image extraction) — a sizeable
 *    separate feature (JSON table schema, two-pass repair prompt,
 *    building a real `table`/`table_row`/`table_cell` tree with
 *    colspan/rowspan + bold/italic). Deferred as a follow-up; not
 *    needed to bring AI parity for the alt-text path.
 *  - The `condenseWarningDelimiter`-aware bracket choice — reason-editor
 *    has no such setting, so the bracket is hardcoded to `[...]`.
 *  - The "keep current / regenerate" `promptForChoice` dialog, the
 *    edit-coordinator region lease, and the `AiActivity` loading
 *    overlay — replaced with a plain `window.confirm()` and a
 *    post-reply check that the image is still where we left it
 *    (mirrors the snapshot-and-recheck pattern used by the other AI
 *    modules here).
 */

import type { Node as PMNode } from "@tiptap/pm/model";
import { NodeSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { callAnthropic, VISION_MEDIA_TYPES, type AnthropicContentBlock } from "./anthropic-client.js";

const ALT_TEXT_SYSTEM_PROMPT = `You write short, plain-English alt text for images embedded in debate evidence documents. Keep the description to ONE sentence, under 25 words, factual, no commentary. Do not start with "An image of" or similar filler. Just describe what's visible.

You may also receive surrounding text from the document (the card's tag, cite, and the paragraphs immediately before and after the image) as context. Use it to decide which features of the image are salient enough to mention — but the alt text describes the IMAGE itself, not the surrounding text. Do not quote or summarize the context in the alt text.`;

/** If the current selection is a `NodeSelection` over an `image` node,
 *  return its position + node. Toolbar wiring uses this to find the
 *  target for the alt-text command. */
export function getSelectedImage(view: EditorView): { pos: number; node: PMNode } | null {
  const sel = view.state.selection;
  if (sel instanceof NodeSelection && sel.node.type.name === "image") {
    return { pos: sel.from, node: sel.node };
  }
  return null;
}

/** Locate the textblock containing the image (a `paragraph`,
 *  `card_body`, `cite_paragraph`, etc.) so the AI follow-up can be
 *  inserted as a SIBLING of the same type right after it — inserting a
 *  same-type sibling at the textblock's `after()` position always fits
 *  the parent's schema, where a raw `$pos.after(depth)` insert of an
 *  arbitrary node can get bounced elsewhere by PM's structural
 *  fitting. */
function findImageContainerInsertion(
  view: EditorView,
  imagePos: number,
): { insertPos: number; sameTypeBlock: PMNode } | null {
  const $pos = view.state.doc.resolve(imagePos);
  if ($pos.depth < 1) return null;
  const containingBlock = $pos.node($pos.depth);
  if (!containingBlock.isTextblock) return null;
  return {
    insertPos: $pos.after($pos.depth),
    sameTypeBlock: containingBlock,
  };
}

interface ImageContext {
  tag: string;
  cite: string;
  paragraphBefore: string;
  paragraphAfter: string;
}

/** Gather the four pieces of surrounding context shipped with the
 *  image: the enclosing card's tag and cite (if any), plus the
 *  textblock siblings immediately before and after the image's
 *  containing textblock. Each piece may be empty — the caller filters
 *  empties out before building the prompt. */
function gatherImageContext(view: EditorView, imagePos: number): ImageContext {
  const ctx: ImageContext = { tag: "", cite: "", paragraphBefore: "", paragraphAfter: "" };
  const doc = view.state.doc;
  const $pos = doc.resolve(imagePos);

  // Locate the textblock containing the image. `resolve(imagePos)`
  // lands at the image's position; depth points at the textblock when
  // the parent is a textblock containing inline content.
  let blockDepth = $pos.depth;
  while (blockDepth > 0 && !$pos.node(blockDepth).isTextblock) blockDepth--;
  if (blockDepth === 0) return ctx;

  // Walk ancestors to find the enclosing `card`, if any.
  for (let d = blockDepth - 1; d >= 0; d--) {
    const node = $pos.node(d);
    if (node.type.name === "card") {
      node.forEach((child) => {
        if (child.type.name === "tag" && !ctx.tag) {
          ctx.tag = child.textContent.trim();
        } else if (child.type.name === "cite_paragraph" && !ctx.cite) {
          ctx.cite = child.textContent.trim();
        }
      });
      break;
    }
  }

  // Sibling textblocks at the same level as the image's textblock.
  const parent = $pos.node(blockDepth - 1);
  const idx = $pos.index(blockDepth - 1);
  const siblingTextAt = (i: number): string => {
    if (i < 0 || i >= parent.childCount) return "";
    const child = parent.child(i);
    if (!child.isTextblock) return "";
    return child.textContent.trim();
  };
  ctx.paragraphBefore = siblingTextAt(idx - 1);
  ctx.paragraphAfter = siblingTextAt(idx + 1);

  return ctx;
}

/** Render the gathered context as a single text block to prepend to
 *  the user message. Returns `''` when nothing useful was gathered
 *  (e.g., a doc-level paragraph with no neighbors). */
function formatImageContextForPrompt(ctx: ImageContext): string {
  const lines: string[] = [];
  if (ctx.tag) lines.push(`Card tag: ${ctx.tag}`);
  if (ctx.cite) lines.push(`Cite: ${ctx.cite}`);
  if (ctx.paragraphBefore) lines.push(`Paragraph before the image: ${ctx.paragraphBefore}`);
  if (ctx.paragraphAfter) lines.push(`Paragraph after the image: ${ctx.paragraphAfter}`);
  if (lines.length === 0) return "";
  return `Context from the surrounding document:\n${lines.join("\n")}`;
}

/** Apply the alt-text result to the doc: write `altText` to the image
 *  node's `alt` attribute AND insert a sibling textblock containing
 *  the `[ALT TEXT: …]` bracket below the image's containing textblock.
 *  Both writes happen in a single transaction so undo lands the doc
 *  back where it started. Throws if the insertion point can't be
 *  resolved or the image moved/vanished since `imagePos` was captured. */
function applyAltTextResult(
  view: EditorView,
  imagePos: number,
  altText: string,
  options: { writeAttribute: boolean },
): void {
  const labelText = `[ALT TEXT: ${altText}]`;
  const target = findImageContainerInsertion(view, imagePos);
  if (!target) {
    throw new Error("Could not locate insertion point.");
  }
  // Confirm the image is still where we expect — the user could have
  // typed during the API roundtrip and shifted positions. If it moved
  // or vanished, refuse rather than mutating the wrong node.
  const live = view.state.doc.nodeAt(imagePos);
  if (!live || live.type.name !== "image") {
    throw new Error("Image moved while generating — alt text not applied.");
  }
  const sibling = target.sameTypeBlock.type.create(null, view.state.schema.text(labelText));
  let tr = view.state.tr;
  if (options.writeAttribute) {
    // setNodeMarkup on the atomic image keeps the doc size unchanged, so
    // the insertPos resolved above remains valid afterwards.
    tr = tr.setNodeMarkup(imagePos, undefined, { ...live.attrs, alt: altText });
  }
  tr = tr.insert(target.insertPos, sibling);
  view.dispatch(tr.scrollIntoView());
}

/** Entry point. Given an `image` node and its position (from
 *  `getSelectedImage`), generates alt text via Claude's vision API and
 *  applies it. If the image already carries alt text, asks via
 *  `window.confirm()` whether to keep it (free, no API call) or
 *  regenerate. Throws on an unsupported image format, an empty AI
 *  reply, or if the image moved while the request was in flight. */
export async function runAiAltText(
  view: EditorView,
  imagePos: number,
  imageNode: PMNode,
): Promise<void> {
  const contentType = String(imageNode.attrs["contentType"] ?? "");
  const data = String(imageNode.attrs["data"] ?? "");
  const existingAlt = String(imageNode.attrs["alt"] ?? "").trim();

  if (existingAlt) {
    const regenerate = window.confirm(
      `This image already has alt text:\n\n"${existingAlt}"\n\nClick OK to regenerate with AI, or Cancel to keep it.`,
    );
    if (!regenerate) {
      applyAltTextResult(view, imagePos, existingAlt, { writeAttribute: false });
      return;
    }
  }

  if (!VISION_MEDIA_TYPES.has(contentType) || !data) {
    throw new Error(
      `AI vision doesn't support ${contentType || "this image type"}. Try PNG / JPEG / GIF / WebP.`,
    );
  }

  const contextText = formatImageContextForPrompt(gatherImageContext(view, imagePos));
  const userContent: AnthropicContentBlock[] = [];
  if (contextText) userContent.push({ type: "text", text: contextText });
  userContent.push({ type: "image", source: { type: "base64", media_type: contentType, data } });
  userContent.push({ type: "text", text: "Write the alt text for this image." });

  const reply = await callAnthropic({
    system: ALT_TEXT_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
  });
  const altText = reply.text.trim().replace(/\s+/g, " ");
  if (!altText) {
    throw new Error("AI returned an empty response.");
  }
  applyAltTextResult(view, imagePos, altText, { writeAttribute: true });
}
