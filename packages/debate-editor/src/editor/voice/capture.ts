/**
 * Microphone capture (renderer side): getUserMedia → 16 kHz mono s16le
 * PCM chunks pushed to the main-process recognizer. The renderer never
 * processes the audio beyond format conversion + resample; recognition
 * lives in main (SPEC-voice.md §10).
 */

const TARGET_RATE = 16000;

/**
 * Downsample a mono Float32 buffer captured at `inRate` to `TARGET_RATE`
 * (16 kHz) with a box-average per output sample (cheap anti-aliasing).
 * Returns the input unchanged when already at the target rate. Each capture
 * buffer is resampled independently — the sub-sample phase error at buffer
 * boundaries is inaudible to the recognizer. Exported for unit testing.
 */
export function downsampleTo16k(input: Float32Array, inRate: number): Float32Array {
  if (inRate === TARGET_RATE) return input;
  const ratio = inRate / TARGET_RATE;
  const outLen = Math.max(0, Math.floor(input.length / ratio));
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    let n = 0;
    for (let j = start; j < end; j++) {
      sum += input[j] as number;
      n++;
    }
    out[i] = n > 0 ? sum / n : (input[Math.min(start, input.length - 1)] ?? 0);
  }
  return out;
}

export class MicCapture {
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private node: ScriptProcessorNode | null = null;

  get running(): boolean {
    return this.stream !== null;
  }

  async start(onChunk: (pcm: ArrayBuffer) => void, deviceId?: string): Promise<void> {
    if (this.stream) return;
    this.stream = await this.acquireStream(deviceId);
    // Use the device's NATIVE rate and downsample to 16 kHz ourselves.
    // Forcing `{ sampleRate: 16000 }` makes the input source emit silence on
    // macOS Core Audio (the HAL can't reconcile a 16 kHz context with a
    // 44.1/48 kHz input device); Linux/PulseAudio happened to resample it.
    const ctx = new AudioContext();
    this.ctx = ctx;
    // The context is created after an `await` (outside the user-gesture
    // tick), so Chromium can start it SUSPENDED — in which case the
    // ScriptProcessor never fires and no audio is ever captured. Resume it.
    try {
      await ctx.resume();
    } catch {
      /* may reject if the context was torn down mid-start */
    }
    const inRate = ctx.sampleRate;

    const source = ctx.createMediaStreamSource(this.stream);
    // ScriptProcessor is deprecated but dependency-free and fine for a mono
    // tap; an AudioWorklet swap is mechanical if it goes.
    this.node = ctx.createScriptProcessor(4096, 1, 1);
    this.node.onaudioprocess = (e) => {
      const f32 = e.inputBuffer.getChannelData(0);
      const ds = downsampleTo16k(f32, inRate);
      const i16 = new Int16Array(ds.length);
      for (let i = 0; i < ds.length; i++) {
        const s = Math.max(-1, Math.min(1, ds[i] as number));
        i16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      onChunk(i16.buffer);
    };
    source.connect(this.node);
    this.node.connect(ctx.destination); // required for processing to run
  }

  /** Open the mic. When a specific device is requested but missing — a
   *  deviceId saved on another machine, an unplugged mic — Chromium throws
   *  NotFoundError/OverconstrainedError for the `exact` constraint; fall
   *  back to the system default instead of failing outright. (If there's
   *  genuinely no input device, the default request throws too and the
   *  caller surfaces "microphone unavailable".) */
  private async acquireStream(deviceId?: string): Promise<MediaStream> {
    const constraints = (id?: string): MediaStreamConstraints => ({
      audio: {
        deviceId: id ? { exact: id } : undefined,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    if (deviceId) {
      try {
        return await navigator.mediaDevices.getUserMedia(constraints(deviceId));
      } catch (err) {
        const name = (err as DOMException)?.name;
        if (name !== 'NotFoundError' && name !== 'OverconstrainedError') throw err;
        // Selected mic isn't on this machine — try the default.
      }
    }
    return navigator.mediaDevices.getUserMedia(constraints(undefined));
  }

  stop(): void {
    this.node?.disconnect();
    this.node = null;
    void this.ctx?.close();
    this.ctx = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }
}
