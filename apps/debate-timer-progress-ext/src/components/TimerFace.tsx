import { useCallback, useRef, useState } from 'react';

import { cn } from '@/lib/utils';
import type { ButtonName } from '@/src/timer/constants';
import type { useTimer } from '@/src/timer/useTimer';

/** Stroke circumference for r=90 (matches the old css stroke-dasharray: 565). */
const CIRCUMFERENCE = 2 * Math.PI * 90;

type TimerApi = ReturnType<typeof useTimer>;

interface Ripple {
  id: number;
  x: number;
  y: number;
}

export function TimerFace({ timer }: { timer: TimerApi }) {
  const {
    count: _count,
    countText,
    ticking,
    type,
    activeButton,
    progress,
    buttonLabel,
    selectButton,
    togglePlay,
    commitCountEdit,
    startFromEdit,
    setCountText,
    resetPrep,
  } = timer;

  const faceRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [ripples, setRipples] = useState<Ripple[]>([]);

  const addRipple = useCallback((clientX: number, clientY: number) => {
    const rect = faceRef.current?.getBoundingClientRect();
    if (!rect) return;
    const id = Date.now() + Math.random();
    setRipples((r) => [...r, { id, x: clientX - rect.left, y: clientY - rect.top }]);
    window.setTimeout(() => {
      setRipples((r) => r.filter((x) => x.id !== id));
    }, 1100);
  }, []);

  // Click anywhere on the face that isn't a button or the count input: play/pause.
  const handleFaceClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.altKey) return;
      const target = e.target as HTMLElement;
      if (target.closest('button') || target.closest('input')) return;
      // Allow selecting text while paused without toggling.
      if (!ticking && String(window.getSelection() ?? '').length) return;

      addRipple(e.clientX, e.clientY);
      togglePlay();
    },
    [ticking, togglePlay, addRipple]
  );

  // Count input: while running -> pause; while paused -> edit it.
  const handleCountClick = useCallback(
    (e: React.MouseEvent<HTMLInputElement>) => {
      e.stopPropagation();
      if (ticking) {
        togglePlay();
      } else {
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    },
    [ticking, togglePlay]
  );

  const handleCountKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        startFromEdit(e.currentTarget.value);
        inputRef.current?.blur();
        return;
      }
      if (e.key.length === 1 && !/[0-9:]/.test(e.key) && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
      }
    },
    [startFromEdit]
  );

  const speechBtn = (name: Extract<ButtonName, 'constructive' | 'rebuttal' | 'crossx'>) => (
    <button
      type="button"
      className={cn('tbtn', `t-${name}`)}
      onClick={(e) => {
        e.stopPropagation();
        selectButton(name);
      }}
    >
      {buttonLabel(name)}
    </button>
  );

  const prepBtn = (name: Extract<ButtonName, 'aff' | 'neg'>, label: string) => (
    <button
      type="button"
      className={cn('pbtn', `p-${name}`)}
      title={`${label} prep — double-click to reset`}
      onClick={(e) => {
        e.stopPropagation();
        selectButton(name);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        resetPrep(name);
      }}
    >
      {buttonLabel(name)}
    </button>
  );

  return (
    <div
      ref={faceRef}
      className={cn('timer-face', activeButton ?? undefined, ticking && 'playing')}
      onClick={handleFaceClick}
    >
      <svg
        className="progress-container"
        viewBox="0 0 200 200"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <circle
          className="progress"
          r="90"
          cx="100"
          cy="100"
          style={{ strokeDashoffset: progress * CIRCUMFERENCE }}
        />
      </svg>

      <div className="timer-title">{type}</div>

      <div className="btn-times">
        {speechBtn('constructive')}
        {speechBtn('rebuttal')}
        {speechBtn('crossx')}
      </div>

      <input
        ref={inputRef}
        className="count"
        type="text"
        inputMode="numeric"
        maxLength={5}
        value={countText}
        readOnly={ticking}
        aria-label="Time remaining"
        onClick={handleCountClick}
        onChange={(e) =>
          setCountText(e.target.value.replace(/[^0-9:]/g, '').slice(0, 5))
        }
        onBlur={(e) => commitCountEdit(e.target.value)}
        onKeyDown={handleCountKeyDown}
      />

      <div className="btn-prep">
        {prepBtn('aff', 'Aff')}
        {prepBtn('neg', 'Neg')}
      </div>

      {ripples.map((r) => (
        <span key={r.id} className="ripple" style={{ left: r.x, top: r.y }} />
      ))}
    </div>
  );
}
