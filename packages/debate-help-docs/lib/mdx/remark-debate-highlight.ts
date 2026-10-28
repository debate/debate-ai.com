/**
 * @file remark-debate-highlight.ts
 * @description Turns `==text==` in MDX prose into `<mark class="debate-hl">`,
 * the policy-style highlighting that the docs page's "Highlights" toggle shows
 * or hides (`components/guides/highlight-toggle.tsx`).
 *
 * A highlight may span inline formatting — `==a **bold** claim==` — as long
 * as it opens and closes within one paragraph, list item or table cell.
 * Code, inline code and JSX attributes are left alone, since their content is
 * not a `text` node. An unclosed `==` stays literal text.
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

/** Rebuilds one parent's children, pairing markers into highlight nodes. */
function rewriteChildren(children: MdNode[]): MdNode[] {
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
        result.push(highlightNode(open));
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

function walk(node: MdNode): void {
  if (!node.children || SKIP.has(node.type)) return;
  for (const child of node.children) walk(child);
  node.children = rewriteChildren(node.children);
}

/** Remark plugin: `==text==` → `<mark class="debate-hl">text</mark>`. */
export function remarkDebateHighlight() {
  return (tree: MdNode) => {
    walk(tree);
  };
}

/** Removes `==` highlight markers, for plain-text and Markdown exports. */
export function stripDebateHighlights(markdown: string): string {
  return markdown.replace(/==(?=\S)([\s\S]*?\S)==/g, '$1');
}
