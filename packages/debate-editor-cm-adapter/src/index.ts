/**
 * @fileoverview Web UI entry point for upstream CardMirror.
 *
 * Re-exports CardMirror's core API unchanged and adds what a web page needs
 * on top: loading a `.docx` straight from a `File`, saving one back as a
 * downloadable `Blob`, and reading a document's outline and cards without
 * mounting an editor.
 * @module debate-editor-cm-adapter
 */

import type { Node as PMNode } from "prosemirror-model";
import { fromDocxFull, toDocx, type ExportOptions } from "./upstream";

export * from "./upstream";

/** MIME type of a Word document, for downloads and file pickers. */
export const DOCX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** The outline levels of a debate document, outermost first. */
export type OutlineKind = "pocket" | "hat" | "block" | "tag";

const OUTLINE_LEVELS: Record<OutlineKind, 1 | 2 | 3 | 4> = { pocket: 1, hat: 2, block: 3, tag: 4 };

/** One heading of the Pocket > Hat > Block > Tag outline. */
export interface OutlineItem {
  kind: OutlineKind;
  /** 1 for a pocket through 4 for a card tag. */
  level: 1 | 2 | 3 | 4;
  text: string;
  /** Stable heading id CardMirror keeps across round trips, or "". */
  id: string;
}

/** A card's parts, as plain text. */
export interface CardText {
  tag: string;
  cite: string;
  /** The card's body paragraphs, joined by newlines. */
  body: string;
}

/**
 * Reads a `.docx` into a CardMirror document, with its comment threads and
 * the doc id CardMirror stamps into files it saves.
 *
 * @param input - A `File`/`Blob` from a picker or drop, or the raw bytes.
 */
export async function importDocx(input: Blob | ArrayBuffer | Uint8Array) {
  const bytes = input instanceof Blob ? new Uint8Array(await input.arrayBuffer()) : input;
  return fromDocxFull(bytes);
}

/**
 * Writes a CardMirror document out as a `.docx` `Blob`, ready for a
 * download link or an upload.
 */
export async function exportDocxBlob(doc: PMNode, options?: ExportOptions): Promise<Blob> {
  const bytes = await toDocx(doc, options);
  // Copy into a fresh ArrayBuffer-backed view so `Blob` accepts it whatever
  // buffer type `toDocx` handed back.
  return new Blob([new Uint8Array(bytes)], { type: DOCX_MIME_TYPE });
}

/** Every pocket, hat, block and card tag in document order. */
export function outlineOf(doc: PMNode): OutlineItem[] {
  const items: OutlineItem[] = [];
  doc.descendants((node) => {
    const kind = node.type.name as OutlineKind;
    if (kind in OUTLINE_LEVELS) {
      items.push({ kind, level: OUTLINE_LEVELS[kind], text: node.textContent, id: String(node.attrs["id"] ?? "") });
      // Heading content is inline; nothing below it to visit.
      return false;
    }
    return true;
  });
  return items;
}

/**
 * Every card in the document, as tag, cite and body text.
 *
 * `cite` is only filled from `cite_paragraph` nodes, which CardMirror creates
 * while editing. A `.docx` has no such paragraph style — Verbatim marks a cite
 * with character styles inside an ordinary paragraph — so after
 * {@link importDocx} the cite line is the first line of `body`.
 */
export function cardsOf(doc: PMNode): CardText[] {
  const cards: CardText[] = [];
  doc.descendants((node) => {
    if (node.type.name !== "card") return true;
    let tag = "";
    const cites: string[] = [];
    const body: string[] = [];
    node.forEach((child) => {
      if (child.type.name === "tag") tag = child.textContent;
      else if (child.type.name === "cite_paragraph") cites.push(child.textContent);
      else if (child.type.name === "card_body") body.push(child.textContent);
    });
    cards.push({ tag, cite: cites.join("\n"), body: body.join("\n") });
    return false;
  });
  return cards;
}
