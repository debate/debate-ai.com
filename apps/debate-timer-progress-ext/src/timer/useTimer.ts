import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  BUTTON_NAMES,
  NEXT_SPEECH,
  SPEECH_NAMES,
  type ButtonName,
  speechTimesFor,
  toNumber,
  toTimeString,
} from './constants';
import {
  appendTimelog,
  getDebateType,
  getSavedTimes,
  setDebateType as persistDebateType,
  setSavedTimes,
} from './storage';

interface Snapshot {
  count: number;
  type: string;
  activeButton: ButtonName | null;
}

/** public/res/beep_final.mp3, resolved against the popup's extension-root base URL. */
const BEEP_URL = '/res/beep_final.mp3';

/** All timer state + behavior, ported from js/timer.js, js/init.js, js/buttons.js. */
export function useTimer() {
  const [ready, setReady] = useState(false);
  const [debateType, setDebateTypeState] = useState(0);
  const [speechTimes, setSpeechTimes] = useState<number[]>(() =>
    speechTimesFor(0)
  );

  const [count, setCount] = useState(0);
  const [countText, setCountText] = useState('0:00');
  const [ticking, setTicking] = useState(false);
  const [type, setType] = useState('');
  const [activeButton, setActiveButton] = useState<ButtonName | null>(null);
  const [affPrep, setAffPrep] = useState(0);
  const [negPrep, setNegPrep] = useState(0);

  // Always-fresh mirror of state for the interval + event callbacks.
  const s = useRef({
    count,
    ticking,
    type,
    activeButton,
    affPrep,
    negPrep,
    speechTimes,
  });
  useEffect(() => {
    s.current = {
      count,
      ticking,
      type,
      activeButton,
      affPrep,
      negPrep,
      speechTimes,
    };
  });

  const undoRef = useRef<Snapshot | null>(null);
  const beepRef = useRef<HTMLAudioElement | null>(null);

  /* ------------------------------------------------------------------ *
   *  Primitive operations (mirror the old Timer.* methods)
   * ------------------------------------------------------------------ */

  // Timer.record -> Timeline.add(type, isTicking)
  const record = useCallback((isTicking: boolean) => {
    void appendTimelog({
      type: s.current.type,
      start: isTicking,
      time: Date.now(),
    });
  }, []);

  // Timer.set(count, buttonId)
  const doSet = useCallback((newCount: number, button?: ButtonName) => {
    undoRef.current = {
      count: s.current.count,
      type: s.current.type,
      activeButton: s.current.activeButton,
    };

    setCount(newCount);
    setCountText(toTimeString(newCount));

    if (button) {
      const idx = BUTTON_NAMES.indexOf(button);
      setType(SPEECH_NAMES[idx] ?? button);
      setActiveButton(button);
    }
  }, []);

  // process()'s per-second session autosave
  const saveSession = useCallback((currentCount: number) => {
    const { type: t, activeButton: btn, affPrep: a, negPrep: n } = s.current;
    void setSavedTimes({
      updated_ts: Date.now(),
      aff: toTimeString(t === 'Aff Prep' ? currentCount : a),
      neg: toTimeString(t === 'Neg Prep' ? currentCount : n),
      type: btn ?? '',
      count: toTimeString(currentCount),
    });
  }, []);

  const beep = useCallback(() => {
    try {
      const el = beepRef.current ?? new Audio(BEEP_URL);
      beepRef.current = el;
      el.currentTime = 0;
      void el.play();
    } catch {
      /* autoplay may be blocked; ignore */
    }
  }, []);

  /* ------------------------------------------------------------------ *
   *  Composite operations
   * ------------------------------------------------------------------ */

  const stop = useCallback(() => {
    setTicking(false);
    record(false);
  }, [record]);

  const play = useCallback(() => {
    setTicking(true);
    record(true);
  }, [record]);

  /** Label a button currently shows: minutes for speeches, m:ss bank for prep. */
  const buttonLabel = useCallback((button: ButtonName): string => {
    const times = s.current.speechTimes;
    switch (button) {
      case 'constructive':
        return String(times[0]);
      case 'rebuttal':
        return String(times[1]);
      case 'crossx':
        return String(times[2]);
      case 'aff':
        return toTimeString(s.current.affPrep);
      case 'neg':
        return toTimeString(s.current.negPrep);
    }
  }, []);

  /** Same as clicking a speech-time or prep button in the old UI. */
  const selectButton = useCallback(
    (button: ButtonName) => {
      if (s.current.ticking) stop();
      const seconds =
        button === 'aff' || button === 'neg'
          ? toNumber(buttonLabel(button))
          : Number(buttonLabel(button)) * 60;
      doSet(seconds || 0, button);
    },
    [buttonLabel, doSet, stop]
  );

  // final() -> beep + auto-advance to next speech (artwork/spin dropped).
  // selectButton() performs the single stop, matching the old btn-click path.
  const final = useCallback(() => {
    const idx = (SPEECH_NAMES as readonly string[]).indexOf(s.current.type);
    const nextBtn = NEXT_SPEECH[idx] ?? 'constructive';
    beep();
    selectButton(nextBtn);
  }, [beep, selectButton]);

  // process(), one call per second while ticking
  const tickRef = useRef<() => void>(() => {});
  tickRef.current = () => {
    const { count: c, type: t } = s.current;
    if (c <= 0) return;

    const next = c - 1;
    setCount(next);
    setCountText(toTimeString(next));
    if (t === 'Aff Prep') setAffPrep(next);
    if (t === 'Neg Prep') setNegPrep(next);

    saveSession(next);

    if (next === 0) final();
  };

  useEffect(() => {
    if (!ticking) return;
    const id = window.setInterval(() => tickRef.current(), 1000);
    return () => window.clearInterval(id);
  }, [ticking]);

  /* ------------------------------------------------------------------ *
   *  Public actions used by the UI
   * ------------------------------------------------------------------ */

  const togglePlay = useCallback(() => {
    if (s.current.ticking) stop();
    else play();
  }, [play, stop]);

  const commitCountEdit = useCallback(
    (text: string) => {
      doSet(toNumber(text));
    },
    [doSet]
  );

  const startFromEdit = useCallback(
    (text: string) => {
      doSet(toNumber(text));
      if (!s.current.ticking) play();
    },
    [doSet, play]
  );

  const resetPrep = useCallback((side?: 'aff' | 'neg') => {
    const full = s.current.speechTimes[3] * 60;
    if (side !== 'neg') setAffPrep(full);
    if (side !== 'aff') setNegPrep(full);
    const btn = s.current.activeButton;
    if ((btn === 'aff' && side !== 'neg') || (btn === 'neg' && side !== 'aff')) {
      setCount(full);
      setCountText(toTimeString(full));
    }
  }, []);

  const changeDebateType = useCallback(async (index: number) => {
    await persistDebateType(index); // also clears savedTimes
    const times = speechTimesFor(index);
    setDebateTypeState(index);
    setSpeechTimes(times);
    setAffPrep(times[3] * 60);
    setNegPrep(times[3] * 60);
    setTicking(false);
    undoRef.current = null;
    setType(SPEECH_NAMES[0]);
    setActiveButton('constructive');
    setCount(times[0] * 60);
    setCountText(toTimeString(times[0] * 60));
  }, []);

  const undo = useCallback(() => {
    const u = undoRef.current;
    if (!u) return;
    if (s.current.ticking) {
      setTicking(false);
      record(false);
    }
    setCount(u.count);
    setCountText(toTimeString(u.count));
    setType(u.type);
    setActiveButton(u.activeButton);
    undoRef.current = null;
  }, [record]);

  /* ------------------------------------------------------------------ *
   *  Init: load debate type, seed constructive, resume saved session
   * ------------------------------------------------------------------ */

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const dt = await getDebateType();
      const times = speechTimesFor(dt);
      if (cancelled) return;

      setDebateTypeState(dt);
      setSpeechTimes(times);
      setAffPrep(times[3] * 60);
      setNegPrep(times[3] * 60);
      setType(SPEECH_NAMES[0]);
      setActiveButton('constructive');
      setCount(times[0] * 60);
      setCountText(toTimeString(times[0] * 60));

      const saved = await getSavedTimes();
      if (!cancelled && saved) {
        setAffPrep(toNumber(saved.aff));
        setNegPrep(toNumber(saved.neg));

        const btn = saved.type as ButtonName;
        if ((BUTTON_NAMES as readonly string[]).includes(btn)) {
          const idx = BUTTON_NAMES.indexOf(btn);
          setType(SPEECH_NAMES[idx] ?? btn);
          setActiveButton(btn);
        }
        const c = toNumber(saved.count);
        setCount(c);
        setCountText(toTimeString(c));
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* Ctrl/Cmd+Z to undo the last time switch. */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (
        (e.key === 'z' || e.key === 'Z') &&
        (e.ctrlKey || e.metaKey) &&
        !e.shiftKey
      ) {
        if (!undoRef.current) return;
        e.preventDefault();
        undo();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo]);

  /* Circular meter: 0 when fresh, 1 when time is up (matches old progress()). */
  const progress = useMemo(() => {
    const idx = (SPEECH_NAMES as readonly string[]).indexOf(type);
    const total = (speechTimes[idx] ?? 0) * 60;
    return total > 0 ? Math.max(0, 1 - count / total) : 0;
  }, [count, type, speechTimes]);

  return {
    ready,
    debateType,
    speechTimes,
    count,
    countText,
    ticking,
    type,
    activeButton,
    affPrep,
    negPrep,
    progress,
    buttonLabel,
    selectButton,
    togglePlay,
    commitCountEdit,
    startFromEdit,
    setCountText,
    resetPrep,
    changeDebateType,
    undo,
  };
}
