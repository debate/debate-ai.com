/**
 * @file remark-drop-title-heading.ts
 * @description Drops a page's leading `#` heading when it only repeats the
 * frontmatter title (alone, or followed by a subtitle).
 *
 * Every docs page now opens with its title in a page header
 * (`components/fumadocs/layout/docs-page-header.tsx`). Most pages also start
 * their body with `# <same title>`, which would show the title twice; this
 * removes that heading at compile time, so content files stay as written.
 * A first heading that says something else (a stylised paper title, say) is
 * kept. The table of contents is built later (rehype), so it never lists the
 * dropped heading.
 */

interface MdNode {
  type: string;
  depth?: number;
  value?: string;
  children?: MdNode[];
}

/** Plain text of a node and its children. */
function textOf(node: MdNode): string {
  if (typeof node.value === 'string') return node.value;
  return node.children?.map(textOf).join('') ?? '';
}

/** Letters and digits only, lowercased, so punctuation and quote styles don't matter. */
export function normalizeTitle(text: string): string {
  return text
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

/** Index of the heading to drop in `children`, or -1 when none should be. */
export function titleHeadingIndex(children: MdNode[], title: unknown): number {
  if (typeof title !== 'string' || !title.trim()) return -1;
  // The first heading of the body, if nothing but imports/exports precede it.
  const index = children.findIndex((node) => node.type !== 'mdxjsEsm' && node.type !== 'yaml');
  const first = children[index];
  if (!first || first.type !== 'heading' || first.depth !== 1) return -1;
  // Also when the heading is the title plus a subtitle ("Video Library — SQL-backed feed").
  return normalizeTitle(textOf(first)).startsWith(normalizeTitle(title)) ? index : -1;
}

export function remarkDropTitleHeading() {
  return (tree: MdNode, file: { data: Record<string, unknown> }) => {
    const frontmatter = file.data.frontmatter as { title?: unknown } | undefined;
    if (!tree.children) return;
    const index = titleHeadingIndex(tree.children, frontmatter?.title);
    if (index >= 0) tree.children.splice(index, 1);
  };
}
