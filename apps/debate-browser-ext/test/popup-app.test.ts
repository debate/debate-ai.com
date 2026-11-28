import { act, createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { click, render } from './helpers/render';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  isSignedIn: vi.fn(),
  getSettings: vi.fn(),
  checkPage: vi.fn(),
  annotate: vi.fn(),
  openReaderForTab: vi.fn(),
  requestTimerWindow: vi.fn(),
  openLocalApp: vi.fn(),
}));

vi.mock('wxt/browser', () => ({ browser: { tabs: { query: mocks.query } } }));
vi.mock('@/src/auth/session', () => ({ isSignedIn: mocks.isSignedIn }));
vi.mock('@/src/settings/settings', () => ({ getSettings: mocks.getSettings }));
vi.mock('@/src/reader/panel', () => ({ openReaderForTab: mocks.openReaderForTab }));
vi.mock('@/src/timer/window', () => ({ requestTimerWindow: mocks.requestTimerWindow }));
vi.mock('@/src/settings/open', () => ({ openLocalApp: mocks.openLocalApp }));
vi.mock('@/src/reuse/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/src/reuse/api')>()),
  checkPageForExistingCards: mocks.checkPage,
  annotateReuseCard: mocks.annotate,
}));

import App from '@/entrypoints/popup/App';
import type { CardAnnotation, ReuseMatch } from '@/src/reuse/api';

const PAGE = 'https://example.com/article';

const cardMatch = (cardId: number, extra: Partial<ReuseMatch> = {}): ReuseMatch => ({
  id: `m${cardId}`,
  card: {
    cardId,
    tag: `Tag ${cardId}`,
    cite: `Cite ${cardId}`,
    fullcite: '',
    author: 'Smith',
    year: 2021,
    quotes: [],
    caselist: 'openev',
    event: 'cx',
    level: 'varsity',
    side: 'aff',
    duplicateCount: 1,
  },
  ...extra,
});

const ANNOTATION: CardAnnotation = {
  claim: 'Warming is bad',
  supportScore: 5,
  authorQuality: { rating: 'strong' as const, qualifications: 'Climate scientist', concerns: '' },
  flaws: [],
};

const settings = (overrides: Record<string, unknown> = {}) => ({
  apiBase: 'https://debate-ai.com',
  skipDomains: '',
  autoCheck: true,
  ...overrides,
});

const mount = () => render(createElement(App));
const buttonByText = (container: HTMLElement, text: string) =>
  Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes(text)) as
    | HTMLButtonElement
    | undefined;
const status = (container: HTMLElement) => container.querySelector('.rounded-md.p-2')!.textContent;

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.query.mockResolvedValue([{ id: 7, url: PAGE }]);
  mocks.getSettings.mockResolvedValue(settings());
  mocks.isSignedIn.mockResolvedValue(false);
  mocks.checkPage.mockResolvedValue({ alreadyCut: false, matches: [] });
  mocks.openReaderForTab.mockResolvedValue(undefined);
  mocks.requestTimerWindow.mockResolvedValue(undefined);
  vi.spyOn(window, 'close').mockImplementation(() => {});
  window.history.replaceState({}, '', '/popup.html');
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('the page check', () => {
  it('checks the active tab on open and says it is safe to cut when nothing matches', async () => {
    const { container } = await mount();

    expect(mocks.checkPage).toHaveBeenCalledWith(PAGE, 'https://debate-ai.com');
    expect(status(container)).toBe('No existing cards found for this page — safe to cut.');
    expect(container.textContent).toContain(PAGE);
  });

  it('lists the existing entries and pluralizes the count', async () => {
    mocks.checkPage.mockResolvedValue({ alreadyCut: true, matches: [cardMatch(1), cardMatch(2)] });
    const { container } = await mount();

    expect(status(container)).toBe('Already cut: 2 existing entries.');
    expect(container.querySelectorAll('ul > li')).toHaveLength(2);

    mocks.checkPage.mockResolvedValue({ alreadyCut: true, matches: [cardMatch(3)] });
    await click(buttonByText(container, 'Check again')!);
    expect(status(container)).toBe('Already cut: 1 existing entry.');
  });

  it('checks the URL it was opened for rather than the active tab, with no reader button', async () => {
    window.history.replaceState({}, '', '/popup.html?url=' + encodeURIComponent('https://other.org/x'));
    const { container } = await mount();

    expect(mocks.checkPage).toHaveBeenCalledWith('https://other.org/x', 'https://debate-ai.com');
    expect(buttonByText(container, 'Read this page')).toBeUndefined();
  });

  it('reports a failed check, and falls back to a generic message for a non-Error', async () => {
    mocks.checkPage.mockRejectedValue(new Error('Server is down'));
    const { container } = await mount();
    expect(status(container)).toBe('Server is down');

    mocks.checkPage.mockRejectedValue('nope');
    await click(buttonByText(container, 'Check again')!);
    expect(status(container)).toBe('Reuse check failed.');
  });

  it('does not check a page that is not on the web', async () => {
    mocks.query.mockResolvedValue([{ id: 1, url: 'chrome://extensions' }]);
    const { container } = await mount();

    expect(mocks.checkPage).not.toHaveBeenCalled();
    expect(status(container)).toBe('Open a web page to check it for existing cards.');
    expect(buttonByText(container, 'Read this page')).toBeUndefined();
    expect(buttonByText(container, 'Check again')).toBeUndefined();
  });

  it('shows a placeholder when there is no active tab URL', async () => {
    mocks.query.mockResolvedValue([]);
    const { container } = await mount();
    expect(container.textContent).toContain('(no active tab URL)');
  });

  it('skips whitelisted sites until the reader asks to check anyway', async () => {
    mocks.getSettings.mockResolvedValue(settings({ skipDomains: 'EXAMPLE.com\n' }));
    const { container } = await mount();

    expect(mocks.checkPage).not.toHaveBeenCalled();
    expect(status(container)).toMatch(/skip-check whitelist/);

    await click(buttonByText(container, 'Check anyway')!);
    expect(mocks.checkPage).toHaveBeenCalledTimes(1);
  });

  it('waits for a click when automatic checking is off', async () => {
    mocks.getSettings.mockResolvedValue(settings({ autoCheck: false }));
    const { container } = await mount();

    expect(mocks.checkPage).not.toHaveBeenCalled();
    expect(status(container)).toMatch(/Automatic checking is off/);

    await click(buttonByText(container, 'Check this page')!);
    expect(mocks.checkPage).toHaveBeenCalledTimes(1);
  });
});

describe('annotating matches', () => {
  const cut = (matches: ReuseMatch[]) =>
    mocks.checkPage.mockResolvedValue({ alreadyCut: true, matches });

  it('does not annotate on its own when signed out', async () => {
    cut([cardMatch(1)]);
    await mount();
    expect(mocks.annotate).not.toHaveBeenCalled();
  });

  it('annotates the first three unannotated corpus cards on its own when signed in', async () => {
    mocks.isSignedIn.mockResolvedValue(true);
    mocks.annotate.mockResolvedValue(ANNOTATION);
    cut([
      cardMatch(1),
      cardMatch(2, { annotation: ANNOTATION }),
      { id: 'no-card', cite: 'Loose cite' },
      cardMatch(3),
      cardMatch(4),
      cardMatch(5),
    ]);
    await mount();

    expect(mocks.annotate.mock.calls.map(([id]) => id)).toEqual([1, 3, 4]);
    expect(mocks.annotate).toHaveBeenCalledWith(1, 'https://debate-ai.com');
  });

  it('surfaces an annotation failure on that card only', async () => {
    mocks.isSignedIn.mockResolvedValue(true);
    mocks.annotate.mockRejectedValue(new Error('Model unavailable'));
    cut([cardMatch(1)]);
    const { container } = await mount();

    expect(container.textContent).toContain('Model unavailable');
  });

  it('falls back to a generic message when the failure is not an Error', async () => {
    mocks.isSignedIn.mockResolvedValue(true);
    mocks.annotate.mockRejectedValue('boom');
    cut([cardMatch(1)]);
    const { container } = await mount();

    expect(container.textContent).toContain('Annotation failed.');
  });
});

describe('the entry points', () => {
  it('puts the article panel on the active tab, then closes the popup', async () => {
    const { container } = await mount();
    await click(buttonByText(container, 'Read this page')!);

    expect(mocks.openReaderForTab).toHaveBeenCalledWith({ id: 7, url: PAGE });
    expect(window.close).toHaveBeenCalled();
  });

  it('still closes the popup when the panel cannot be shown', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mocks.openReaderForTab.mockRejectedValue(new Error('no access'));
    const { container } = await mount();
    await click(buttonByText(container, 'Read this page')!);

    expect(warn).toHaveBeenCalled();
    expect(window.close).toHaveBeenCalled();
  });

  it('opens the local app and the timer window, closing the popup each time', async () => {
    const { container } = await mount();

    await click(buttonByText(container, 'Open Debate AI (local)')!);
    expect(mocks.openLocalApp).toHaveBeenCalledTimes(1);
    expect(window.close).toHaveBeenCalledTimes(1);

    await click(buttonByText(container, 'Open debate timer')!);
    expect(mocks.requestTimerWindow).toHaveBeenCalledTimes(1);
    expect(window.close).toHaveBeenCalledTimes(2);
  });

  it('links to the Android app in a new tab without leaking the opener', async () => {
    const { container } = await mount();
    const link = container.querySelector('a[href*="play.google.com"]')!;
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  it('does not set state after it is unmounted mid-load', async () => {
    let resolveTabs!: (tabs: unknown[]) => void;
    mocks.query.mockReturnValue(new Promise((resolve) => (resolveTabs = resolve)));
    const { unmount } = await mount();
    await unmount();
    await act(async () => resolveTabs([{ id: 1, url: PAGE }]));

    expect(mocks.checkPage).not.toHaveBeenCalled();
  });
});
