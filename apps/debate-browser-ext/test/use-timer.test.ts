import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderHook } from './helpers/render-hook';
import { resetStorage } from './helpers/memory-browser';

const mem = vi.hoisted(() => ({ sync: {} as Record<string, unknown>, local: {} as Record<string, unknown> }));

vi.mock('wxt/browser', async () => {
  const { memoryBrowser } = await import('./helpers/memory-browser');
  return { browser: memoryBrowser(mem) };
});

import { useTimer } from '@/src/timer/useTimer';

const NOW = new Date('2026-01-01T12:00:00Z');
const play = vi.fn();
let audioCreated = 0;

class FakeAudio {
  currentTime = 1;
  constructor(public src: string) {
    audioCreated++;
  }
  play() {
    return play();
  }
}

async function mount() {
  const hook = await renderHook(() => useTimer());
  await act(async () => {});
  return hook;
}

/** One real second per iteration, flushed between ticks so the hook sees each new count. */
async function tick(seconds: number) {
  for (let i = 0; i < seconds; i++) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
  }
}

const pressUndo = (init: KeyboardEventInit = { key: 'z', ctrlKey: true }) =>
  act(async () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { cancelable: true, ...init }));
  });

beforeEach(() => {
  resetStorage(mem);
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
  vi.setSystemTime(NOW);
  play.mockReset();
  audioCreated = 0;
  vi.stubGlobal('Audio', FakeAudio);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('loading', () => {
  it('starts on a full Constructive for the default format, with full prep banks', async () => {
    const { result } = await mount();
    const t = result.current;

    expect(t.ready).toBe(true);
    expect(t.debateType).toBe(0);
    expect(t.type).toBe('Constructive');
    expect(t.activeButton).toBe('constructive');
    expect(t.count).toBe(8 * 60);
    expect(t.countText).toBe('8:00');
    expect(t.affPrep).toBe(8 * 60);
    expect(t.negPrep).toBe(8 * 60);
    expect(t.ticking).toBe(false);
    expect(t.progress).toBe(0);
  });

  it('uses the stored debate type for the speech lengths', async () => {
    mem.local.debatetype = 3;
    const { result } = await mount();

    expect(result.current.speechTimes).toEqual([4, 3, 2, 2, 2]);
    expect(result.current.countText).toBe('4:00');
    expect(result.current.affPrep).toBe(120);
    expect(result.current.buttonLabel('rebuttal')).toBe('3');
    expect(result.current.buttonLabel('aff')).toBe('2:00');
  });

  it('resumes a saved session that is still fresh', async () => {
    mem.local.debatetype = 1;
    mem.local.savedTimes = { updated_ts: Date.now() - 60_000, aff: '3:05', neg: '9:59', type: 'rebuttal', count: '4:12' };
    const { result } = await mount();

    expect(result.current.affPrep).toBe(185);
    expect(result.current.negPrep).toBe(599);
    expect(result.current.activeButton).toBe('rebuttal');
    expect(result.current.type).toBe('Rebuttal');
    expect(result.current.count).toBe(252);
    expect(result.current.countText).toBe('4:12');
    expect(result.current.ticking).toBe(false);
  });

  it('ignores a saved session older than an hour', async () => {
    mem.local.savedTimes = { updated_ts: Date.now() - 2 * 3600_000, aff: '1:00', neg: '1:00', type: 'neg', count: '0:10' };
    const { result } = await mount();

    expect(result.current.type).toBe('Constructive');
    expect(result.current.affPrep).toBe(480);
  });

  it('keeps the seeded speech when the saved session names no known button', async () => {
    mem.local.savedTimes = { updated_ts: Date.now(), aff: '2:00', neg: '2:00', type: '', count: '1:30' };
    const { result } = await mount();

    expect(result.current.activeButton).toBe('constructive');
    expect(result.current.count).toBe(90);
  });
});

describe('running the clock', () => {
  it('counts down once a second, logs the play and pause, and autosaves the session', async () => {
    const { result } = await mount();

    await act(async () => result.current.togglePlay());
    expect(result.current.ticking).toBe(true);
    await tick(3);
    expect(result.current.count).toBe(477);
    expect(result.current.countText).toBe('7:57');
    expect(result.current.progress).toBeCloseTo(3 / 480);

    await act(async () => result.current.togglePlay());
    expect(result.current.ticking).toBe(false);
    await tick(2);
    expect(result.current.count).toBe(477);

    expect(mem.local.timelog).toEqual([
      { type: 'Constructive', start: true, time: NOW.getTime() },
      { type: 'Constructive', start: false, time: NOW.getTime() + 3000 },
    ]);
    expect(mem.local.savedTimes).toEqual({
      updated_ts: NOW.getTime() + 3000,
      aff: '8:00',
      neg: '8:00',
      type: 'constructive',
      count: '7:57',
    });
  });

  it('draws the running prep time down from its own bank', async () => {
    const { result } = await mount();

    await act(async () => result.current.selectButton('aff'));
    expect(result.current.type).toBe('Aff Prep');
    expect(result.current.count).toBe(480);

    await act(async () => result.current.togglePlay());
    await tick(5);
    expect(result.current.affPrep).toBe(475);
    expect(result.current.negPrep).toBe(480);
    expect((mem.local.savedTimes as { aff: string }).aff).toBe('7:55');

    await act(async () => result.current.selectButton('constructive'));
    expect(result.current.ticking).toBe(false);
    expect(result.current.count).toBe(480);

    await act(async () => result.current.selectButton('aff'));
    expect(result.current.count).toBe(475);
  });

  it('beeps at zero and moves on to the next speech', async () => {
    const { result } = await mount();

    await act(async () => result.current.commitCountEdit('0:02'));
    expect(result.current.count).toBe(2);
    await act(async () => result.current.togglePlay());
    await tick(2);

    expect(play).toHaveBeenCalledTimes(1);
    expect(result.current.type).toBe('Cross-x');
    expect(result.current.activeButton).toBe('crossx');
    expect(result.current.count).toBe(3 * 60);
    expect(result.current.ticking).toBe(false);
  });

  it('goes from an exhausted prep bank to the Rebuttal, and reuses one audio element', async () => {
    mem.local.debatetype = 5;
    const { result } = await mount();

    await act(async () => result.current.selectButton('neg'));
    await act(async () => result.current.commitCountEdit('0:01'));
    await act(async () => result.current.togglePlay());
    await tick(1);

    expect(result.current.negPrep).toBe(0);
    expect(result.current.type).toBe('Rebuttal');
    expect(result.current.count).toBe(2 * 60);

    await act(async () => result.current.commitCountEdit('0:01'));
    await act(async () => result.current.togglePlay());
    await tick(1);
    expect(play).toHaveBeenCalledTimes(2);
    expect(audioCreated).toBe(1);
  });

  it('does not tick below zero', async () => {
    const { result } = await mount();
    await act(async () => result.current.commitCountEdit('0:00'));
    await act(async () => result.current.togglePlay());
    await tick(3);

    expect(result.current.count).toBe(0);
    expect(play).not.toHaveBeenCalled();
  });

  it('survives a browser that blocks the beep', async () => {
    play.mockImplementation(() => {
      throw new Error('NotAllowedError');
    });
    const { result } = await mount();
    await act(async () => result.current.commitCountEdit('0:01'));
    await act(async () => result.current.togglePlay());
    await tick(1);

    expect(result.current.type).toBe('Cross-x');
  });

  it('starts the clock from an edited time, and only starts it once', async () => {
    const { result } = await mount();

    await act(async () => result.current.startFromEdit('1:30'));
    expect(result.current.count).toBe(90);
    expect(result.current.ticking).toBe(true);

    await act(async () => result.current.startFromEdit('2:00'));
    expect(result.current.count).toBe(120);
    const starts = (mem.local.timelog as { start: boolean }[]).filter((entry) => entry.start);
    expect(starts).toHaveLength(1);
  });
});

describe('undo', () => {
  it('returns to the speech and time before the last switch, then has nothing left to undo', async () => {
    const { result } = await mount();

    await act(async () => result.current.selectButton('rebuttal'));
    expect(result.current.type).toBe('Rebuttal');
    expect(result.current.count).toBe(300);

    await act(async () => result.current.undo());
    expect(result.current.type).toBe('Constructive');
    expect(result.current.activeButton).toBe('constructive');
    expect(result.current.count).toBe(480);

    await act(async () => result.current.selectButton('crossx'));
    await act(async () => result.current.undo());
    await act(async () => result.current.undo());
    expect(result.current.type).toBe('Constructive');
  });

  it('pauses the clock, and logs it, when it undoes a running speech', async () => {
    const { result } = await mount();
    await act(async () => result.current.startFromEdit('3:00'));
    await tick(1);

    await act(async () => result.current.undo());

    expect(result.current.ticking).toBe(false);
    expect(result.current.count).toBe(480);
    expect((mem.local.timelog as { start: boolean }[]).at(-1)?.start).toBe(false);
  });

  it('undoes on Ctrl+Z and Cmd+Z, but not on Shift+Ctrl+Z or a bare Z', async () => {
    const { result } = await mount();
    await act(async () => result.current.selectButton('rebuttal'));

    await pressUndo({ key: 'z', ctrlKey: true, shiftKey: true });
    await pressUndo({ key: 'z' });
    expect(result.current.type).toBe('Rebuttal');

    await pressUndo({ key: 'Z', metaKey: true });
    expect(result.current.type).toBe('Constructive');
  });

  it('leaves Ctrl+Z to the page when there is nothing to undo', async () => {
    await mount();
    const event = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, cancelable: true });
    await act(async () => void window.dispatchEvent(event));
    expect(event.defaultPrevented).toBe(false);
  });

  it('stops listening for keys once unmounted', async () => {
    const { result, unmount } = await mount();
    await act(async () => result.current.selectButton('rebuttal'));
    await unmount();

    const event = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });
});

describe('prep banks', () => {
  it('refills one side or both, updating the clock only when that side is on screen', async () => {
    const { result } = await mount();
    await act(async () => result.current.selectButton('aff'));
    await act(async () => result.current.commitCountEdit('1:00'));

    await act(async () => result.current.resetPrep('neg'));
    expect(result.current.count).toBe(60);
    expect(result.current.negPrep).toBe(480);

    await act(async () => result.current.resetPrep('aff'));
    expect(result.current.count).toBe(480);
    expect(result.current.countText).toBe('8:00');
  });

  it('refills both banks when no side is named', async () => {
    mem.local.savedTimes = { updated_ts: Date.now(), aff: '1:00', neg: '2:00', type: 'neg', count: '2:00' };
    const { result } = await mount();

    await act(async () => result.current.resetPrep());

    expect(result.current.affPrep).toBe(480);
    expect(result.current.negPrep).toBe(480);
    expect(result.current.count).toBe(480);
  });
});

describe('changing the debate format', () => {
  it('persists it, resets the clock to that format and discards the old session', async () => {
    const { result } = await mount();
    await act(async () => result.current.startFromEdit('3:00'));
    await tick(2);

    await act(async () => {
      await result.current.changeDebateType(2);
    });

    expect(mem.local.debatetype).toBe(2);
    expect(mem.local.savedTimes).toBe(0);
    expect(result.current.ticking).toBe(false);
    expect(result.current.speechTimes).toEqual([6, 7, 3, 4, 4]);
    expect(result.current.type).toBe('Constructive');
    expect(result.current.count).toBe(360);
    expect(result.current.affPrep).toBe(240);

    await act(async () => result.current.undo());
    expect(result.current.count).toBe(360);
  });
});
