import { CircularTimerFace, type CircularTimerButton } from '@debate/timer/src/timers/circular/CircularTimerFace';

import type { ButtonName } from '@/src/timer/constants';
import type { useTimer } from '@/src/timer/useTimer';

type TimerApi = ReturnType<typeof useTimer>;

/**
 * The timer window's clock face: the shared circular progress timer from
 * @debate/timer, driven by this extension's `useTimer`.
 */
export function TimerFace({ timer }: { timer: TimerApi }) {
  const {
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

  const speechBtn = (name: Extract<ButtonName, 'constructive' | 'rebuttal' | 'crossx'>): CircularTimerButton => ({
    key: name,
    label: buttonLabel(name),
    accent: name,
    onClick: () => selectButton(name),
  });

  const prepBtn = (name: Extract<ButtonName, 'aff' | 'neg'>, label: string): CircularTimerButton => ({
    key: name,
    label: buttonLabel(name),
    accent: name,
    title: `${label} prep — double-click to reset`,
    onClick: () => selectButton(name),
    onDoubleClick: () => resetPrep(name),
  });

  return (
    <CircularTimerFace
      className="mt-1"
      progress={progress}
      countText={countText}
      title={type}
      ticking={ticking}
      accent={activeButton}
      onToggle={togglePlay}
      onCountTextChange={setCountText}
      onCountCommit={commitCountEdit}
      onCountSubmit={startFromEdit}
      speechButtons={[speechBtn('constructive'), speechBtn('rebuttal'), speechBtn('crossx')]}
      prepButtons={[prepBtn('aff', 'Aff'), prepBtn('neg', 'Neg')]}
    />
  );
}
