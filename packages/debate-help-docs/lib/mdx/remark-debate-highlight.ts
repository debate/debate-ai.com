/**
 * @file remark-debate-highlight.ts
 * @description Turns `==text==` in MDX prose into `<mark class="debate-hl">`,
 * the policy-style highlighting that the Synergy Slayer pages' "Underlining" toggle shows
 * or hides (`components/guides/highlight-toggle.tsx`).
 *
 * A highlight may span inline formatting — `==a **bold** claim==` — as long
 * as it opens and closes within one paragraph, list item or table cell.
 * Code, inline code and JSX attributes are left alone, since their content is
 * not a `text` node. An unclosed `==` stays literal text.
 *
 * Only the Synergy Slayer of Critiques pages render highlights. Everywhere
 * else the markers are dropped and the words read as plain prose.
 */

/** The minimal mdast shape this plugin touches. */
interface MdNode {
  type: string;
  value?: string;
  children?: MdNode[];
  data?: Record<string, unknown>;
}

/** Class every authored highlight carries; styled in `styles/docs.css`. */
export const DEBATE_HIGHLIGHT_CLASS = 'debate-hl';

const MARKER = '==';

/** Content folder whose pages render highlights and show the toggle. */
export const SYNERGY_SLAYER_DIR = 'learn/critiques/synergy-slayer-critiques/';

/** Wraps a Synergy Slayer page's body; the toggle's CSS applies only inside. */
export const SYNERGY_SLAYER_CLASS = 'synergy-slayer-doc';

/**
 * Whether a docs page (by its content-relative path, or an absolute file path)
 * is one of the Synergy Slayer pages that keep their highlights.
 */
export function isSynergySlayerPage(path: string | undefined): boolean {
  if (!path) return false;
  const normalized = path.replace(/\\/g, '/');
  return normalized.startsWith(SYNERGY_SLAYER_DIR) || normalized.includes(`/${SYNERGY_SLAYER_DIR}`);
}

/** A highlight node: rendered as `<mark class="debate-hl">`. */
function highlightNode(children: MdNode[]): MdNode {
  return {
    type: 'debateHighlight',
    children,
    data: { hName: 'mark', hProperties: { className: [DEBATE_HIGHLIGHT_CLASS] } },
  };
}

/**
 * Splits text nodes at every `==`, so markers become standalone tokens that
 * can be paired across sibling nodes.
 */
function tokenize(children: MdNode[]): (MdNode | typeof MARKER)[] {
  const out: (MdNode | typeof MARKER)[] = [];
  for (const child of children) {
    if (child.type !== 'text' || !child.value?.includes(MARKER)) {
      out.push(child);
      continue;
    }
    const parts = child.value.split(MARKER);
    parts.forEach((part, i) => {
      if (i > 0) out.push(MARKER);
      if (part) out.push({ type: 'text', value: part });
    });
  }
  return out;
}

/**
 * Rebuilds one parent's children, pairing markers into highlight nodes, or,
 * with `highlight` false, unwrapping them into plain text.
 */
function rewriteChildren(children: MdNode[], highlight: boolean): MdNode[] {
  const tokens = tokenize(children);
  if (!tokens.includes(MARKER)) return children;

  const result: MdNode[] = [];
  let open: MdNode[] | null = null;
  const pushText = (target: MdNode[], value: string) => {
    const last = target[target.length - 1];
    if (last?.type === 'text') last.value += value;
    else target.push({ type: 'text', value });
  };

  for (const token of tokens) {
    if (token === MARKER) {
      if (open) {
        if (highlight) result.push(highlightNode(open));
        else for (const node of open) {
          if (node.type === 'text') pushText(result, node.value ?? '');
          else result.push(node);
        }
        open = null;
      } else {
        open = [];
      }
    } else if (open) {
      open.push(token);
    } else if (token.type === 'text') {
      pushText(result, token.value ?? '');
    } else {
      result.push(token);
    }
  }
  // Unclosed: put the marker and what followed it back as they were.
  if (open) {
    pushText(result, MARKER);
    for (const node of open) {
      if (node.type === 'text') pushText(result, node.value ?? '');
      else result.push(node);
    }
  }
  return result;
}

const SKIP = new Set(['code', 'inlineCode', 'math', 'inlineMath', 'yaml', 'mdxjsEsm', 'mdxFlowExpression', 'mdxTextExpression']);

function walk(node: MdNode, highlight: boolean): void {
  if (!node.children || SKIP.has(node.type)) return;
  for (const child of node.children) walk(child, highlight);
  node.children = rewriteChildren(node.children, highlight);
}

/**
 * Remark plugin: `==text==` → `<mark class="debate-hl">text</mark>` on the
 * Synergy Slayer pages, and plain `text` on every other page.
 */
export function remarkDebateHighlight() {
  return (tree: MdNode, file?: { path?: string; history?: string[] }) => {
    walk(tree, isSynergySlayerPage(file?.path ?? file?.history?.[0]));
  };
}

/** Removes `==` highlight markers, for plain-text and Markdown exports. */
export function stripDebateHighlights(markdown: string): string {
  return markdown.replace(/==(?=\S)([\s\S]*?\S)==/g, '$1');
}
