/**
 * The little bit of Markdown a model's answer actually uses, rendered to HTML.
 *
 * The panel this was ported from hands the model's reply straight to
 * `dangerouslySetInnerHTML`, which is safe there only because the reply has
 * been through a server. Here it has not, so the text is HTML-escaped *first*
 * and the handful of inline rules are applied to the escaped string. Nothing
 * the model emits can introduce a tag; the only tags present are the ones
 * added below.
 *
 * Deliberately not a Markdown parser: headings, bold, italic, inline code,
 * bullets and paragraphs are what answers to "summarize this article" contain.
 */

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ESCAPES[char]);
}

/** Bold, italic and inline code, applied to already-escaped text. */
function inline(escaped: string): string {
  return escaped
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/(^|[\s(])_([^_\n]+)_/g, '$1<em>$2</em>');
}

/** Renders a model's reply as safe HTML. */
export function renderMarkdown(text: string): string {
  if (!text?.trim()) return '';

  const blocks: string[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length === 0) return;
    blocks.push(`<ul>${listItems.map((item) => `<li>${item}</li>`).join('')}</ul>`);
    listItems = [];
  };

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      flushList();
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flushList();
      const level = Math.min(heading[1].length + 1, 6);
      blocks.push(`<h${level}>${inline(escapeHtml(heading[2]))}</h${level}>`);
      continue;
    }

    const bullet = /^\s*(?:[-*+]|\d+[.)])\s+(.*)$/.exec(line);
    if (bullet) {
      listItems.push(inline(escapeHtml(bullet[1])));
      continue;
    }

    flushList();
    blocks.push(`<p>${inline(escapeHtml(line))}</p>`);
  }

  flushList();
  return blocks.join('');
}
