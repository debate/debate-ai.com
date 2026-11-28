import { act, createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { render } from './helpers/render';
import { resetStorage, type MemoryStorage } from './helpers/memory-browser';

const mem = vi.hoisted<MemoryStorage>(() => ({ sync: {}, local: {} }));

vi.mock('wxt/browser', async () => {
  const { memoryBrowser } = await import('./helpers/memory-browser');
  return { browser: memoryBrowser(mem) };
});

import { SettingsPanel } from '@/entrypoints/options/SettingsPanel';
import { DEBATE_TYPES } from '@/src/timer/constants';

const setValue = (el: HTMLInputElement | HTMLTextAreaElement, value: string) =>
  act(async () => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
    Object.getOwnPropertyDescriptor(proto.prototype, 'value')!.set!.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });

const toggle = (el: HTMLInputElement) =>
  act(async () => {
    el.click();
  });

const saveButton = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Save')!;

const pressSave = (container: HTMLElement) =>
  act(async () => {
    saveButton(container).click();
  });

const input = (container: HTMLElement, selector: string) =>
  container.querySelector(selector) as HTMLInputElement;

beforeEach(() => {
  resetStorage(mem);
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('SettingsPanel', () => {
  it('renders nothing until the saved settings have loaded, then shows them', async () => {
    Object.assign(mem.sync, {
      apiBase: 'https://staging.example.com',
      skipDomains: 'wiki.example.com',
      maxFollowupQuestions: 6,
      summarizePrompt: 'Be brief',
      timerWindowWidth: 500,
      autoCheck: false,
      searchShortcut: false,
    });
    const { container } = await render(createElement(SettingsPanel));

    expect(input(container, '#api-base').value).toBe('https://staging.example.com');
    expect(input(container, '#skip-domains').value).toBe('wiki.example.com');
    expect(input(container, '#max-followups').value).toBe('6');
    expect(input(container, '#summarize-prompt').value).toBe('Be brief');
    expect(input(container, '[aria-label="Timer window width"]').value).toBe('500');
    expect(input(container, '#skip-domains').closest('section')!.querySelectorAll('input[type=checkbox]')[0]).toHaveProperty(
      'checked',
      false,
    );
  });

  it('saves every edited field, trims the API base and reports the stored value', async () => {
    const onApiBaseSaved = vi.fn();
    const { container } = await render(createElement(SettingsPanel, { onApiBaseSaved }));

    await setValue(input(container, '#api-base'), '  https://staging.example.com  ');
    await setValue(input(container, '#skip-domains'), 'a.com\nb.com');
    await setValue(input(container, '#summarize-prompt'), 'Give me the main claim');
    await setValue(input(container, '#max-followups'), '7');
    await setValue(input(container, '[aria-label="Timer window width"]'), '640');
    await setValue(input(container, '[aria-label="Timer window height"]'), '480');
    const [articleButton, searchShortcut, autoCheck] = Array.from(
      container.querySelectorAll<HTMLInputElement>('input[type=checkbox]'),
    );
    await toggle(articleButton);
    await toggle(searchShortcut);
    await toggle(autoCheck);
    expect(container.textContent).not.toContain('Saved.');

    await pressSave(container);

    expect(mem.sync).toMatchObject({
      apiBase: 'https://staging.example.com',
      skipDomains: 'a.com\nb.com',
      summarizePrompt: 'Give me the main claim',
      maxFollowupQuestions: 7,
      timerWindowWidth: 640,
      timerWindowHeight: 480,
      articleButton: false,
      searchShortcut: false,
      autoCheck: false,
    });
    expect(onApiBaseSaved).toHaveBeenCalledWith('https://staging.example.com');
    expect(container.textContent).toContain('Saved.');
  });

  it('clears the "Saved." note after two seconds', async () => {
    const { container } = await render(createElement(SettingsPanel));
    vi.useFakeTimers();
    await pressSave(container);
    expect(container.textContent).toContain('Saved.');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(container.textContent).not.toContain('Saved.');
  });

  it('hides a stale "Saved." as soon as something is edited again', async () => {
    const { container } = await render(createElement(SettingsPanel));
    await pressSave(container);
    expect(container.textContent).toContain('Saved.');

    await setValue(input(container, '#summarize-prompt'), 'Changed');
    expect(container.textContent).not.toContain('Saved.');
  });

  it('leaves the timer session alone when the debate format was not changed', async () => {
    const savedTimes = { updated_ts: Date.now() };
    mem.local.debatetype = 2;
    mem.local.savedTimes = savedTimes;
    const { container } = await render(createElement(SettingsPanel));

    await pressSave(container);

    expect(mem.local.savedTimes).toBe(savedTimes);
    expect(mem.local.debatetype).toBe(2);
  });

  it('switches the debate format on save, which also drops the resumable session', async () => {
    // jsdom has no layout, which Radix's listbox positioning expects.
    Element.prototype.scrollIntoView = vi.fn();
    mem.local.debatetype = 0;
    mem.local.savedTimes = { updated_ts: Date.now() };
    const { container } = await render(createElement(SettingsPanel));

    const trigger = container.querySelector('#format') as HTMLElement;
    await act(async () => {
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    const option = Array.from(document.querySelectorAll('[role=option]')).find(
      (o) => o.textContent === DEBATE_TYPES[1],
    ) as HTMLElement;
    await act(async () => {
      option.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      option.click();
    });
    await pressSave(container);

    expect(mem.local.debatetype).toBe(1);
    expect(mem.local.savedTimes).toBe(0);
  });
});
