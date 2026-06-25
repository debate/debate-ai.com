/**
 * Parse `word/comments.xml` (+ optional `word/commentsExtended.xml`)
 * into the `Thread[]` shape consumed by the comments plugin.
 *
 * OOXML's thread model:
 *   - `comments.xml` carries `<w:comment w:id="N" w:author="…"
 *     w:date="…" w:initials="…">` elements, each containing
 *     paragraphs of text. Every comment has its own integer id.
 *   - `commentsExtended.xml` carries `<w15:commentEx w15:paraId="…"
 *     w15:paraIdParent="…"/>` mappings. Each comment paragraph in
 *     comments.xml has a `w14:paraId` attribute; commentsExtended
 *     uses these to link replies to their parent comment.
 *
 * On import we flatten the resulting graph: every connected
 * component (root + transitive replies) becomes one `Thread`
 * keyed by the root comment's id, with replies in chronological
 * order under it.
 */

import { parseXml, attrs as attrsOf, children as childrenOf, findChild, textContent } from '../ooxml/parse.js';
import type { Thread, Comment } from '../comments-plugin.js';

/** Parse comments + extended-comments XML strings into threads. */
export function importComments(
  commentsXml: string | null,
  commentsExtendedXml: string | null,
): Thread[] {
  if (!commentsXml) return [];

  // First pass: collect every <w:comment> with its id, metadata,
  // body text, and any per-paragraph w14:paraId we'll need to
  // reconstruct parent links.
  interface Raw {
    id: string;
    author: string;
    initials: string;
    date: string;
    text: string;
    /** w14:paraId on the FIRST paragraph of this comment (which is
     *  what commentsExtended.xml's paraId attrs reference). */
    paraId: string | null;
  }
  const raws = new Map<string, Raw>();

  const root = parseXml(commentsXml);
  const commentsEl = findChild(root, 'w:comments');
  if (!commentsEl) return [];

  for (const node of childrenOf(commentsEl, 'w:comments')) {
    if (!('w:comment' in node)) continue;
    const a = attrsOf(node);
    const id = a['w:id'];
    if (!id) continue;
    const children = childrenOf(node, 'w:comment');
    const firstP = children.find((c) => 'w:p' in c);
    const paraId = firstP ? (attrsOf(firstP)['w14:paraId'] ?? null) : null;
    raws.set(id, {
      id,
      author: a['w:author'] ?? '',
      initials: a['w:initials'] ?? '',
      date: a['w:date'] ?? '',
      // Plain-text body for now — strip formatting. Multi-paragraph
      // comments collapse to newline-separated plain text.
      text: extractCommentText(node),
      paraId,
    });
  }

  // Second pass: build the paraId → parentParaId map from extended.
  const parentByParaId = new Map<string, string>();
  if (commentsExtendedXml) {
    const extRoot = parseXml(commentsExtendedXml);
    // Top-level element name varies (`w15:commentsEx`); we walk
    // generically to avoid hard-coding namespace prefixes.
    const walk = (nodes: ReturnType<typeof parseXml>): void => {
      for (const n of nodes) {
        for (const key of Object.keys(n)) {
          if (key === ':@' || key === '#text') continue;
          if (key.endsWith(':commentEx')) {
            const ea = attrsOf(n);
            const paraId = ea['w15:paraId'] ?? ea['paraId'];
            const parentId = ea['w15:paraIdParent'] ?? ea['paraIdParent'];
            if (paraId && parentId) parentByParaId.set(paraId, parentId);
          }
          const value = (n as Record<string, unknown>)[key];
          if (Array.isArray(value)) walk(value as ReturnType<typeof parseXml>);
        }
      }
    };
    walk(extRoot);
  }

  // Resolve each raw comment's parent comment-id by chasing
  // paraIdParent → owning comment.
  const commentIdByParaId = new Map<string, string>();
  for (const r of raws.values()) {
    if (r.paraId) commentIdByParaId.set(r.paraId, r.id);
  }
  const parentCommentId = (raw: Raw): string | null => {
    if (!raw.paraId) return null;
    const parentParaId = parentByParaId.get(raw.paraId);
    if (!parentParaId) return null;
    return commentIdByParaId.get(parentParaId) ?? null;
  };

  // Group into threads. A thread is identified by the id of its
  // top-most ancestor (no parent). Replies trace up to that root.
  const rootOf = (raw: Raw): string => {
    let current = raw;
    const seen = new Set<string>();
    while (true) {
      const pid = parentCommentId(current);
      if (!pid || seen.has(pid)) return current.id;
      seen.add(pid);
      const next = raws.get(pid);
      if (!next) return current.id;
      current = next;
    }
  };

  const threadsByRoot = new Map<string, Comment[]>();
  for (const raw of raws.values()) {
    const rootId = rootOf(raw);
    const pid = parentCommentId(raw);
    const comment: Comment = {
      id: raw.id,
      author: raw.author,
      initials: raw.initials,
      date: raw.date,
      text: raw.text,
      kind: 'human',
      parentId: pid,
    };
    const list = threadsByRoot.get(rootId) ?? [];
    list.push(comment);
    threadsByRoot.set(rootId, list);
  }

  // Sort each thread: root first, then replies by date ascending.
  // Equal-or-missing dates fall back to id order, which is also
  // chronological for Word-generated docs.
  const out: Thread[] = [];
  for (const [rootId, comments] of threadsByRoot) {
    comments.sort((a, b) => {
      if (a.id === rootId) return -1;
      if (b.id === rootId) return 1;
      const ad = a.date || '';
      const bd = b.date || '';
      if (ad !== bd) return ad < bd ? -1 : 1;
      return Number(a.id) - Number(b.id);
    });
    out.push({ id: rootId, comments });
  }
  return out;
}

/** Extract plain text from all paragraphs inside a `<w:comment>`,
 *  joining paragraphs with newlines. */
function extractCommentText(commentNode: ReturnType<typeof parseXml>[number]): string {
  const paragraphs: string[] = [];
  for (const c of childrenOf(commentNode, 'w:comment')) {
    if (!('w:p' in c)) continue;
    paragraphs.push(textContent(c));
  }
  return paragraphs.join('\n');
}
