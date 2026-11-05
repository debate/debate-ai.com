/**
 * The pages of one section, gathered for reading mode: every page's rendered
 * content, in order, so a whole paper reads as one document.
 *
 * Each page is fetched as the HTML the site already serves and only its
 * content element is kept, so everything the page renders (highlights, card
 * underlining, figures) comes along exactly as it looks on the page.
 */

/** A page of the section, in reading order. */
export interface SectionPage {
  url: string;
  title: string;
}

/** A page's content, ready to show. `html` is empty when it could not be loaded. */
export interface LoadedSectionPage extends SectionPage {
  html: string;
}

/**
 * The inner HTML of the first `selector` match in `html`, with scripts,
 * styles and `id`s removed (ids would clash with the page underneath, and
 * with each other once pages are stacked). Empty when there is no match.
 */
export function extractContent(html: string, selector: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const content = doc.querySelector(selector);
  if (!content) return '';
  return cleanContent(content);
}

/** `element`'s inner HTML as {@link extractContent} cleans it, without changing `element`. */
export function cleanContent(element: Element): string {
  const copy = element.cloneNode(true) as Element;
  copy.querySelectorAll('script, style, noscript, template').forEach((node) => node.remove());
  copy.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'));
  return copy.innerHTML;
}

/**
 * Loads every page's content (at most `concurrency` requests at once), in the
 * order given. `local` can supply a page without a request (the page already
 * open). A page that fails comes back with empty `html`.
 */
export async function loadSectionPages(
  pages: SectionPage[],
  {
    selector,
    local,
    concurrency = 4,
    signal,
    fetcher = fetch,
  }: {
    selector: string;
    local?: (page: SectionPage) => string | null;
    concurrency?: number;
    signal?: AbortSignal;
    fetcher?: typeof fetch;
  },
): Promise<LoadedSectionPage[]> {
  const loaded: LoadedSectionPage[] = pages.map((page) => ({ ...page, html: '' }));
  let next = 0;
  const worker = async () => {
    while (next < pages.length && !signal?.aborted) {
      const index = next++;
      const page = pages[index]!;
      const own = local?.(page);
      if (own != null) {
        loaded[index]!.html = own;
        continue;
      }
      try {
        const response = await fetcher(page.url, { signal, credentials: 'same-origin' });
        if (response.ok) loaded[index]!.html = extractContent(await response.text(), selector);
      } catch {
        // Left empty: the reader sees the page's title with a note instead.
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, pages.length)) }, worker));
  return loaded;
}
