# debate-timer

Round timing: the per-speech timer, the prep timer, per-format speech times, and the
speech recorder (mic selection, live waveform, playback) that records while the timer runs.

```tsx
import { SpeechTimer, PrepTimer, useSpeechRecorder } from "debate-timer"
import { debateStyles, type DebateStyleKey } from "debate-timer/debate-format-times"
```

Speech times are the source of truth for which columns a flow gets, so `debate-round`
depends on this package rather than the other way around.
