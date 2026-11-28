import { act, createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { click, render } from './helpers/render';
import { resetStorage } from './helpers/memory-browser';

const mem = vi.hoisted(() => ({ sync: {} as Record<string, unknown>, local: {} as Record<string, unknown> }));

vi.mock('wxt/browser', async () => {
  const { memoryBrowser } = await import('./helpers/memory-browser');
  return { browser: memoryBrowser(mem) };
});

import { Timeline } from '@/src/components/Timeline';

// 2026-01-01 12:00:00 local time, so the axis labels are the same in any timezone.
const T0 = new Date(2026, 0, 1, 12, 0, 0).getTime();
const MIN = 60_000;

const entry = (type: string, start: boolean, offsetMs: number) => ({ type, start, time: T0 + offsetMs });

const labels = (container: HTMLElement) =>
  [...container.querySelectorAll('svg > g > text[font-weight="bold"]')].map((node) => node.textContent);
const bandTitles = (container: HTMLElement) =>
  [...container.querySelectorAll('rect > title')].map((node) => node.textContent);
const button = (container: HTMLElement, text: RegExp) =>
  [...container.querySelectorAll('button')].find((b) => text.test(b.textContent ?? ''))!;

beforeEach(() => {
  resetStorage(mem);
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  vi.setSystemTime(T0 + 10 * MIN);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('Timeline', () => {
  it('prompts for a first speech and disables Download and Clear when nothing is recorded', async () => {
    const { container } = await render(createElement(Timeline, { active: true }));

    expect(container.querySelector('svg')!.textContent).toContain('No timeline data yet');
    expect(button(container, /Download/).disabled).toBe(true);
    expect(button(container, /Clear/).disabled).toBe(true);
    expect(bandTitles(container)).toEqual([]);
  });

  it('does not read the log until the tab is active', async () => {
    mem.local.timelog = [entry('Constructive', true, 0), entry('Constructive', false, MIN)];
    const view = await render(createElement(Timeline, { active: false }));
    expect(view.container.querySelectorAll('rect > title')).toHaveLength(0);

    await view.rerender(createElement(Timeline, { active: true }));
    expect(bandTitles(view.container)).toContain('Constructive 1:00');
  });

  it('draws a band per speech and pause, with per-row totals and the pause share', async () => {
    mem.local.timelog = [
      entry('Constructive', true, 0),
      entry('Constructive', false, 3 * MIN),
      entry('Cross-x', true, 4 * MIN),
      entry('Cross-x', false, 5 * MIN),
    ];
    const { container } = await render(createElement(Timeline, { active: true }));

    expect(labels(container)).toEqual([
      'Constructive 3:00',
      'Rebuttal 0:00',
      'Cross-x 1:00',
      'Aff Prep 0:00',
      'Neg Prep 0:00',
      'Pause 1:00 20%',
    ]);
    expect(bandTitles(container)).toEqual(['Constructive 3:00', 'Cross-x 1:00', 'Pause 1:00']);
  });

  it('labels the axis with clock times at the ends and each quarter hour between', async () => {
    mem.local.timelog = [
      entry('Rebuttal', true, 0),
      entry('Rebuttal', false, 20 * MIN),
    ];
    const { container } = await render(createElement(Timeline, { active: true }));

    const clock = [...container.querySelectorAll('text[text-anchor="middle"]')].map((node) => node.textContent);
    expect(clock).toEqual(['12:00', '12:15', '12:20']);
  });

  it('counts a speech that is still running up to now', async () => {
    mem.local.timelog = [entry('Rebuttal', true, 0)];
    const { container } = await render(createElement(Timeline, { active: true }));

    expect(labels(container)[1]).toBe('Rebuttal 10:00');
    expect(bandTitles(container)).toEqual(['Rebuttal 10:00']);
  });

  it('drops entries older than two hours or with no usable type, and saves the pruned log', async () => {
    mem.local.timelog = [
      { type: 'Constructive', start: true, time: T0 - 3 * 3600_000 },
      { type: '', start: true, time: T0 },
      { type: 'ab', start: true, time: T0 },
      entry('Constructive', true, 0),
      entry('Constructive', false, MIN),
    ];
    const { container } = await render(createElement(Timeline, { active: true }));

    expect(mem.local.timelog).toEqual([entry('Constructive', true, 0), entry('Constructive', false, MIN)]);
    expect(bandTitles(container)).toEqual(['Constructive 1:00']);
  });

  it('leaves a clean log untouched, and skips entries of unknown speeches', async () => {
    const log = [entry('Mystery', true, 0), entry('Mystery', false, MIN)];
    mem.local.timelog = log;
    const { container } = await render(createElement(Timeline, { active: true }));

    expect(mem.local.timelog).toBe(log);
    expect(container.querySelector('svg')!.textContent).toContain('No timeline data yet');
  });

  it('asks twice before clearing, and un-asks after four seconds', async () => {
    mem.local.timelog = [entry('Constructive', true, 0), entry('Constructive', false, MIN)];
    const { container } = await render(createElement(Timeline, { active: true }));

    await click(button(container, /^Clear$/));
    expect(button(container, /Click again/)).toBeTruthy();
    expect(mem.local.timelog).toHaveLength(2);

    await act(async () => void vi.advanceTimersByTime(4000));
    expect(button(container, /^Clear$/)).toBeTruthy();
    expect(mem.local.timelog).toHaveLength(2);
  });

  it('clears the log, the bands and the prompt on the confirming click', async () => {
    mem.local.timelog = [entry('Constructive', true, 0), entry('Constructive', false, MIN)];
    const { container } = await render(createElement(Timeline, { active: true }));

    await click(button(container, /^Clear$/));
    await click(button(container, /Click again/));

    expect(mem.local.timelog).toEqual([]);
    expect(bandTitles(container)).toEqual([]);
    expect(container.querySelector('svg')!.textContent).toContain('No timeline data yet');
    expect(button(container, /Clear/).disabled).toBe(true);
  });

  it('shows the band under the pointer in a tooltip until the pointer leaves', async () => {
    mem.local.timelog = [entry('Neg Prep', true, 0), entry('Neg Prep', false, 90_000)];
    const { container } = await render(createElement(Timeline, { active: true }));

    const band = container.querySelector('rect[rx="2"]')!;
    await act(async () => {
      band.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 100, clientY: 80 }));
    });
    const tip = container.querySelector('.timeline-tooltip') as HTMLElement;
    expect(tip.textContent).toBe('Neg Prep  1:30');
    expect(tip.style.left).toBe('110px');
    expect(tip.style.top).toBe('56px');

    await act(async () => {
      container.querySelector('.timeline-plot')!.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
      container.querySelector('.timeline-plot')!.dispatchEvent(new MouseEvent('mouseleave'));
    });
    expect(container.querySelector('.timeline-tooltip')).toBeNull();
  });

  describe('Download', () => {
    it('rasterizes the chart at twice its size and saves it as a PNG named for the day', async () => {
      mem.local.timelog = [entry('Constructive', true, 0), entry('Constructive', false, MIN)];
      const { container } = await render(createElement(Timeline, { active: true }));

      let image!: { onload?: () => void; src: string };
      vi.stubGlobal(
        'Image',
        class {
          onload?: () => void;
          src = '';
          constructor() {
            image = this;
          }
        },
      );
      const context = { fillRect: vi.fn(), setTransform: vi.fn(), drawImage: vi.fn(), fillStyle: '' };
      const canvases: HTMLCanvasElement[] = [];
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
        canvases.push(this);
        return context as never;
      });
      vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(new Blob(['png'])));
      URL.createObjectURL = vi.fn(() => 'blob:png');
      URL.revokeObjectURL = vi.fn();
      const downloads: string[] = [];
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
        downloads.push(`${this.download}|${this.href}`);
      });

      await click(button(container, /Download/));
      expect(image.src).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
      expect(decodeURIComponent(image.src)).toContain('Constructive 1:00');

      image.onload!();

      expect(canvases[0].width).toBe(960);
      expect(canvases[0].height).toBe(480);
      expect(context.fillStyle).toBe('aliceblue');
      expect(context.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0);
      expect(context.drawImage).toHaveBeenCalledWith(image, 0, 0);
      expect(downloads).toEqual([expect.stringMatching(/^Debate [\d-]+\.png\|blob:png$/)]);
      expect(document.querySelector('a[download]')).toBeNull();

      vi.advanceTimersByTime(2000);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:png');
    });

    it('saves nothing when the canvas cannot be drawn on or encoded', async () => {
      mem.local.timelog = [entry('Constructive', true, 0), entry('Constructive', false, MIN)];
      const { container } = await render(createElement(Timeline, { active: true }));
      let image!: { onload?: () => void };
      vi.stubGlobal(
        'Image',
        class {
          onload?: () => void;
          src = '';
          constructor() {
            image = this;
          }
        },
      );
      const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext');
      const toBlob = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(null));
      URL.createObjectURL = vi.fn(() => 'blob:png');

      await click(button(container, /Download/));
      getContext.mockReturnValueOnce(null);
      image.onload!();
      expect(toBlob).not.toHaveBeenCalled();

      getContext.mockReturnValueOnce({ fillRect() {}, setTransform() {}, drawImage() {}, fillStyle: '' } as never);
      image.onload!();
      expect(toBlob).toHaveBeenCalledTimes(1);
      expect(URL.createObjectURL).not.toHaveBeenCalled();
    });
  });
});
