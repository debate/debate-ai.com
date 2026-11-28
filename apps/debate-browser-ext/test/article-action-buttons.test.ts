import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { click, render } from './helpers/render';

import { TooltipProvider } from '@/components/ui/tooltip';
import ArticleActionButtons, {
  ARTICLE_TOOLBAR_SHORTCUTS,
  READING_WIDTHS,
  formatToolbarShortcut,
  type ReadingWidth,
} from '@/src/components/article/ArticleActionButtons';

type Props = Parameters<typeof ArticleActionButtons>[0];

function handlers() {
  return {
    onAskClick: vi.fn(),
    onSuggestClick: vi.fn(),
    onCopyClick: vi.fn(),
    onCopyHighlightedClick: vi.fn(),
    onShareClick: vi.fn(),
    onCheckCardsClick: vi.fn(),
    onSaveClick: vi.fn(),
    onHighlightToggle: vi.fn(),
    onClearHighlights: vi.fn(),
    onLayoutToggle: vi.fn(),
    onReadingWidthChange: vi.fn(),
    onZoomIn: vi.fn(),
    onZoomOut: vi.fn(),
    onZoomReset: vi.fn(),
    onClose: vi.fn(),
  };
}

const baseProps = (overrides: Partial<Props> = {}): Props => ({
  isLoadingAI: false,
  isLoadingFollowups: false,
  isCheckingCards: false,
  isSaving: false,
  isSignedIn: true,
  isHighlightMode: false,
  layout: 'full',
  readingWidth: 'medium',
  ...handlers(),
  ...overrides,
});

const show = (props: Props) =>
  render(createElement(TooltipProvider, null, createElement(ArticleActionButtons, props)));

const buttons = (container: HTMLElement) => [...container.querySelectorAll('button')] as HTMLButtonElement[];
const withIcon = (container: HTMLElement, icon: string) =>
  container.querySelector(`svg.lucide-${icon}`)!.closest('button') as HTMLButtonElement;
const byText = (container: HTMLElement, text: string) => buttons(container).find((b) => b.textContent === text)!;

afterEach(() => {
  document.body.innerHTML = '';
});

describe('formatToolbarShortcut', () => {
  it('writes Escape as Esc, with no modifier', () => {
    expect(formatToolbarShortcut('close')).toBe('Esc');
  });

  it('uppercases the key under an Alt (or Option) prefix', () => {
    expect(formatToolbarShortcut('ask')).toMatch(/^(Alt\+|⌥)A$/);
    expect(formatToolbarShortcut('zoomIn')).toMatch(/^(Alt\+|⌥)=$/);
  });

  it('never gives two toolbar actions the same key', () => {
    const combos = Object.values(ARTICLE_TOOLBAR_SHORTCUTS).map(({ alt, key }) => `${alt}:${key}`);
    expect(new Set(combos).size).toBe(combos.length);
  });
});

describe('ArticleActionButtons', () => {
  it('wires the text buttons, the zoom controls and close to their handlers', async () => {
    const props = baseProps({ fontScale: 1.25 });
    const { container } = await show(props);

    await click(byText(container, 'Ask'));
    await click(byText(container, 'Suggest'));
    await click(byText(container, '125%'));
    expect(props.onAskClick).toHaveBeenCalledTimes(1);
    expect(props.onSuggestClick).toHaveBeenCalledTimes(1);
    expect(props.onZoomReset).toHaveBeenCalledTimes(1);

    const all = buttons(container);
    await click(all[all.length - 1]);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('shows the zoom as a rounded percentage, 100% by default', async () => {
    expect(byText((await show(baseProps())).container, '100%')).toBeTruthy();
    expect(byText((await show(baseProps({ fontScale: 0.8 }))).container, '80%')).toBeTruthy();
  });

  it('disables each busy action while it runs', async () => {
    const { container } = await show(
      baseProps({ isLoadingAI: true, isLoadingFollowups: true, isCheckingCards: true, isSaving: true }),
    );

    expect(byText(container, '…').disabled).toBe(true);
    expect(byText(container, 'Suggest').disabled).toBe(true);
    expect(buttons(container).filter((b) => b.disabled)).toHaveLength(4);
  });

  it('offers the full-page reading widths, marking the current one, and reports a change', async () => {
    const props = baseProps({ readingWidth: 'wide' });
    const { container } = await show(props);

    const radios = [...container.querySelectorAll('[role="radio"]')] as HTMLElement[];
    expect(radios.map((r) => r.textContent)).toEqual(Object.values(READING_WIDTHS).map((w) => w.label));
    expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual(['false', 'false', 'true']);

    await click(radios[0]);
    expect(props.onReadingWidthChange).toHaveBeenCalledWith('narrow' satisfies ReadingWidth);
  });

  it('hides the reading width in the side panel', async () => {
    const { container } = await show(baseProps({ layout: 'side' }));
    expect(container.querySelector('[role="radiogroup"]')).toBeNull();
  });

  it('shows the clear-highlights button only when something is highlighted and it can act', async () => {
    const none = await show(baseProps({ highlightCount: 0 }));
    const some = await show(baseProps({ highlightCount: 2 }));
    const noHandler = await show(baseProps({ highlightCount: 2, onClearHighlights: undefined }));

    expect(buttons(some.container).length).toBe(buttons(none.container).length + 1);
    expect(buttons(noHandler.container).length).toBe(buttons(none.container).length);
  });

  it('clears highlights when asked', async () => {
    const props = baseProps({ highlightCount: 1 });
    const { container } = await show(props);

    await click(withIcon(container, 'eraser'));
    expect(props.onClearHighlights).toHaveBeenCalledTimes(1);
  });

  it('links to the article in a new tab only when it has a URL', async () => {
    const withUrl = await show(baseProps({ articleUrl: 'https://example.com/post' }));
    const link = withUrl.container.querySelector('a')!;
    expect(link.getAttribute('href')).toBe('https://example.com/post');
    expect(link.target).toBe('_blank');
    expect(link.rel).toBe('noopener noreferrer');

    expect((await show(baseProps())).container.querySelector('a')).toBeNull();
  });

  it.each([
    ['clipboard', 'onCopyClick'],
    ['clipboard-list', 'onCopyHighlightedClick'],
    ['share-2', 'onShareClick'],
    ['highlighter', 'onHighlightToggle'],
    ['layers', 'onCheckCardsClick'],
    ['bookmark-plus', 'onSaveClick'],
    ['panel-right', 'onLayoutToggle'],
    ['zoom-out', 'onZoomOut'],
    ['zoom-in', 'onZoomIn'],
    ['x', 'onClose'],
  ] as const)('the %s button calls %s and nothing else', async (icon, handlerName) => {
    const props = baseProps();
    const { container } = await show(props);

    await click(withIcon(container, icon));

    for (const [name, handler] of Object.entries(props)) {
      if (name.startsWith('on')) expect(handler, name).toHaveBeenCalledTimes(name === handlerName ? 1 : 0);
    }
  });

  it('shows the maximize icon, still wired to the layout toggle, in the side panel', async () => {
    const props = baseProps({ layout: 'side' });
    const { container } = await show(props);

    await click(withIcon(container, 'maximize-2'));
    expect(props.onLayoutToggle).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.lucide-panel-right')).toBeNull();
  });
});
