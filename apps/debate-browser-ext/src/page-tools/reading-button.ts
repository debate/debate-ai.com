/**
 * The reading-mode button: a small, half-transparent arrow tab on the far
 * left edge of a page the extension has detected an article on
 * (src/article/detect.ts). Clicking it opens the article panel.
 *
 * Drawn in a closed shadow root so the site's CSS can't restyle it and its
 * styles can't leak into the site.
 */

const HOST_ID = 'debate-ai-reading-button';

const STYLE = `
:host { all: initial; }
button {
  position: fixed; left: 0; top: 50%; transform: translateY(-50%);
  z-index: 2147483646;
  width: 18px; height: 44px; padding: 0; margin: 0;
  display: flex; align-items: center; justify-content: center;
  border: 0; border-radius: 0 8px 8px 0;
  background: rgba(17, 24, 39, 0.35); color: #fff;
  opacity: 0.5; cursor: pointer;
  transition: opacity 150ms, width 150ms, background 150ms;
}
button:hover, button:focus-visible { opacity: 1; width: 24px; background: rgba(17, 24, 39, 0.75); outline: none; }
svg { width: 14px; height: 14px; }
`;

const ARROW =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';

/** Shows the button (once) and calls `onOpen` when it is clicked. */
export function showReadingButton(wordCount: number, onOpen: () => void): void {
  if (document.getElementById(HOST_ID)) return;
  const host = document.createElement('div');
  host.id = HOST_ID;
  const root = host.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent = STYLE;
  const button = document.createElement('button');
  button.type = 'button';
  const label = `Open in reading mode (${wordCount.toLocaleString()} words)`;
  button.title = label;
  button.setAttribute('aria-label', label);
  button.innerHTML = ARROW;
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    onOpen();
  });
  root.append(style, button);
  (document.body || document.documentElement).appendChild(host);
}

/** Takes the button off the page, e.g. after a route change to a non-article. */
export function hideReadingButton(): void {
  document.getElementById(HOST_ID)?.remove();
}
