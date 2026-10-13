/**
 * The search menu the backtick shortcut opens over selected text: the query,
 * then every engine in src/search/engines.ts, with Quick search selected so
 * Enter searches it straight away. Arrow keys move, Enter or a click opens the
 * results in a new tab, Escape or a click outside closes it.
 *
 * Drawn in a closed shadow root, like the reading-mode button, so the site's
 * CSS can't touch it.
 */
import { DEFAULT_SEARCH_ENGINE_ID, SEARCH_ENGINES, type SearchEngine } from '@/src/search/engines';

const HOST_ID = 'debate-ai-search-menu';
const MENU_WIDTH = 260;

const STYLE = `
:host { all: initial; }
.menu {
  position: fixed; z-index: 2147483647; width: ${MENU_WIDTH}px; box-sizing: border-box;
  padding: 6px; border-radius: 10px; border: 1px solid rgba(127, 127, 127, 0.3);
  background: rgba(255, 255, 255, 0.97); color: #111827;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  font: 13px/1.35 system-ui, -apple-system, "Segoe UI", sans-serif;
}
@media (prefers-color-scheme: dark) {
  .menu { background: rgba(24, 24, 27, 0.97); color: #f4f4f5; }
}
.query { padding: 4px 8px 6px; font-size: 11px; opacity: 0.65;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
button { display: flex; width: 100%; align-items: center; justify-content: space-between; gap: 8px;
  padding: 6px 8px; border: 0; border-radius: 6px; background: none; color: inherit;
  font: inherit; text-align: left; cursor: pointer; }
button[aria-selected="true"] { background: rgba(127, 127, 127, 0.18); }
.hint { font-size: 11px; opacity: 0.55; }
`;

let teardown: (() => void) | null = null;

export function closeSearchMenu(): void {
  teardown?.();
  teardown = null;
}

/**
 * Opens the menu for `query` next to `anchor` (the selection's bounding box),
 * replacing any menu already open. `apiBase` is the deployment the Debate AI
 * cards engine searches.
 */
export function openSearchMenu(query: string, anchor: DOMRect | null, apiBase: string): void {
  closeSearchMenu();

  const host = document.createElement('div');
  host.id = HOST_ID;
  const root = host.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent = STYLE;
  const menu = document.createElement('div');
  menu.className = 'menu';
  menu.setAttribute('role', 'listbox');
  menu.setAttribute('aria-label', `Search for “${query}”`);

  const heading = document.createElement('div');
  heading.className = 'query';
  heading.textContent = `Search “${query}”`;
  menu.appendChild(heading);

  let selected = Math.max(
    0,
    SEARCH_ENGINES.findIndex((engine) => engine.id === DEFAULT_SEARCH_ENGINE_ID),
  );
  const buttons = SEARCH_ENGINES.map((engine, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('role', 'option');
    const label = document.createElement('span');
    label.textContent = engine.label;
    button.appendChild(label);
    if (engine.id === DEFAULT_SEARCH_ENGINE_ID) {
      const hint = document.createElement('span');
      hint.className = 'hint';
      hint.textContent = 'Enter';
      button.appendChild(hint);
    }
    button.addEventListener('mouseenter', () => select(index));
    button.addEventListener('click', (event) => {
      event.preventDefault();
      search(engine);
    });
    menu.appendChild(button);
    return button;
  });

  function select(index: number) {
    selected = (index + buttons.length) % buttons.length;
    buttons.forEach((button, i) => button.setAttribute('aria-selected', String(i === selected)));
  }

  function search(engine: SearchEngine) {
    window.open(engine.url(query, apiBase), '_blank', 'noopener');
    closeSearchMenu();
  }

  // Below the selection when there is room, above it otherwise, and always
  // inside the viewport.
  const menuHeight = 40 + buttons.length * 30;
  const rect = anchor ?? new DOMRect(window.innerWidth / 2, window.innerHeight / 3, 0, 0);
  const left = Math.min(Math.max(8, rect.left), window.innerWidth - MENU_WIDTH - 8);
  const below = rect.bottom + 6;
  const top =
    below + menuHeight <= window.innerHeight ? below : Math.max(8, rect.top - menuHeight - 6);
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;

  root.append(style, menu);
  (document.body || document.documentElement).appendChild(host);
  select(selected);

  // Captured on the window so the page's own handlers don't see the keys the
  // menu uses while it is open.
  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      closeSearchMenu();
    } else if (event.key === 'ArrowDown') {
      select(selected + 1);
    } else if (event.key === 'ArrowUp') {
      select(selected - 1);
    } else if (event.key === 'Enter') {
      search(SEARCH_ENGINES[selected]);
    } else {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  const onPointer = (event: Event) => {
    if (!event.composedPath().includes(host)) closeSearchMenu();
  };
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('pointerdown', onPointer, true);
  window.addEventListener('scroll', closeSearchMenu, { capture: true, passive: true });

  teardown = () => {
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('pointerdown', onPointer, true);
    window.removeEventListener('scroll', closeSearchMenu, true);
    host.remove();
  };
}
