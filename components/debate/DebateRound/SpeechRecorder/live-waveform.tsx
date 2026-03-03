"use client"

/**
 * @fileoverview LiveWaveform Component
 *
 * Real-time canvas-based audio waveform visualizer with microphone input.
 * Matches the ElevenLabs LiveWaveform documented API.
 *
 * Modes:
 *  - "static"    : Symmetric frequency-band bars mirrored vertically
 *  - "scrolling" : Historical RMS volume bars scrolling left
 */

import {
    forwardRef,
    HTMLAttributes,
    useEffect,
    useRef,
} from "react"
import { cn } from "@/lib/utils"

export interface LiveWaveformProps extends Omit<HTMLAttributes<HTMLDivElement>, "onError"> {
    /** Whether to actively listen to microphone input */
    active?: boolean
    /** Show processing animation when not active */
    processing?: boolean
    /** Width of each bar in pixels */
    barWidth?: number
    /** Height multiplier for each bar in pixels */
    barHeight?: number
    /** Gap between bars in pixels */
    barGap?: number
    /** Border radius of bars */
    barRadius?: number
    /** Color of the bars (defaults to currentColor via CSS var) */
    barColor?: string
    /** Whether to fade the edges of the waveform */
    fadeEdges?: boolean
    /** Width of the fade effect in pixels */
    fadeWidth?: number
    /** Height of the waveform */
    height?: string | number
    /** Audio sensitivity multiplier */
    sensitivity?: number
    /** Audio analyser smoothing (0–1) */
    smoothingTimeConstant?: number
    /** FFT size for audio analysis */
    fftSize?: number
    /** Number of bars to keep in history (scrolling mode) */
    historySize?: number
    /** Update rate in milliseconds */
    updateRate?: number
    /** Visualization mode */
    mode?: "scrolling" | "static"
    /** Error callback */
    onError?: (error: Error) => void
    /** Callback when stream is ready */
    onStreamReady?: (stream: MediaStream) => void
    /** Callback when stream ends */
    onStreamEnd?: () => void
    /**
     * Optional pre-existing stream. When provided, LiveWaveform will use this
     * stream instead of calling getUserMedia (deviceId selection from parent).
     */
    stream?: MediaStream | null
}

export const LiveWaveform = forwardRef<HTMLDivElement, LiveWaveformProps>(
    function LiveWaveform(
        {
            active = false,
            processing = false,
            barWidth = 3,
            barHeight = 4,
            barGap = 1,
            barRadius = 1.5,
            barColor,
            fadeEdges = true,
            fadeWidth = 24,
            height = 64,
            sensitivity = 1,
            smoothingTimeConstant = 0.8,
            fftSize = 256,
            historySize = 60,
            updateRate = 30,
            mode = "static",
            onError,
            onStreamReady,
            onStreamEnd,
            stream: externalStream,
            className,
            style,
            ...props
        },
        ref,
    ) {
        const canvasRef = useRef<HTMLCanvasElement>(null)
        const rafRef = useRef<number | null>(null)
        const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
        const audioCtxRef = useRef<AudioContext | null>(null)
        const analyserRef = useRef<AnalyserNode | null>(null)
        const streamRef = useRef<MediaStream | null>(null)
        const historyRef = useRef<number[]>([])
        // Processing animation phase
        const phaseRef = useRef(0)

        // Resolve bar color from CSS variable if not explicitly set
        const getBarColor = (canvas: HTMLCanvasElement) => {
            if (barColor) return barColor
            return getComputedStyle(canvas).getPropertyValue("--foreground")
                ? `hsl(${getComputedStyle(canvas).getPropertyValue("--foreground")})`
                : getComputedStyle(canvas).color
        }

        const drawStatic = (
            ctx: CanvasRenderingContext2D,
            data: Uint8Array,
            w: number,
            h: number,
            color: string,
        ) => {
            ctx.clearRect(0, 0, w, h)

            const step = barWidth + barGap
            const count = Math.floor(w / step)
            const binStep = Math.floor(data.length / 2 / count)

            ctx.fillStyle = color
            for (let i = 0; i < count; i++) {
                // Average across a bin range
                let sum = 0
                for (let j = 0; j < binStep; j++) {
                    sum += data[i * binStep + j]
                }
                const avg = sum / binStep / 255
                const amp = Math.max(avg * barHeight * 8 * sensitivity, 2)
                const x = i * step
                const y = (h - amp) / 2

                if (barRadius > 0) {
                    ctx.beginPath()
                    ctx.roundRect(x, y, barWidth, amp, barRadius)
                    ctx.fill()
                } else {
                    ctx.fillRect(x, y, barWidth, amp)
                }
            }

            applyFade(ctx, w, h)
        }

        const drawScrolling = (
            ctx: CanvasRenderingContext2D,
            data: Uint8Array,
            w: number,
            h: number,
            color: string,
        ) => {
            // Compute RMS of all bins
            let sum = 0
            for (let i = 0; i < data.length; i++) sum += (data[i] / 255) ** 2
            const rms = Math.sqrt(sum / data.length) * sensitivity * barHeight * 6

            // Maintain rolling history
            historyRef.current.push(Math.max(rms, 1))
            if (historyRef.current.length > historySize) historyRef.current.shift()

            ctx.clearRect(0, 0, w, h)
            ctx.fillStyle = color

            const step = barWidth + barGap
            const maxBars = Math.floor(w / step)
            const history = historyRef.current.slice(-maxBars)

            for (let i = 0; i < history.length; i++) {
                const amp = Math.min(history[i], h)
                const x = w - (history.length - i) * step
                const y = (h - amp) / 2

                if (barRadius > 0) {
                    ctx.beginPath()
                    ctx.roundRect(x, y, barWidth, amp, barRadius)
                    ctx.fill()
                } else {
                    ctx.fillRect(x, y, barWidth, amp)
                }
            }

            applyFade(ctx, w, h)
        }

        const drawProcessing = (
            ctx: CanvasRenderingContext2D,
            w: number,
            h: number,
            color: string,
        ) => {
            ctx.clearRect(0, 0, w, h)
            ctx.fillStyle = color

            const step = barWidth + barGap
            const count = Math.floor(w / step)
            phaseRef.current += 0.08

            for (let i = 0; i < count; i++) {
                const wave = Math.sin(i * 0.4 + phaseRef.current)
                const amp = Math.max((wave * 0.5 + 0.5) * barHeight * 4, 2)
                const x = i * step
                const y = (h - amp) / 2
                if (barRadius > 0) {
                    ctx.beginPath()
                    ctx.roundRect(x, y, barWidth, amp, barRadius)
                    ctx.fill()
                } else {
                    ctx.fillRect(x, y, barWidth, amp)
                }
            }

            applyFade(ctx, w, h)
        }

        const drawIdle = (
            ctx: CanvasRenderingContext2D,
            w: number,
            h: number,
            color: string,
        ) => {
            ctx.clearRect(0, 0, w, h)
            ctx.fillStyle = color

            const step = barWidth + barGap
            const count = Math.floor(w / step)
            for (let i = 0; i < count; i++) {
                const x = i * step
                const y = (h - 2) / 2
                if (barRadius > 0) {
                    ctx.beginPath()
                    ctx.roundRect(x, y, barWidth, 2, barRadius)
                    ctx.fill()
                } else {
                    ctx.fillRect(x, y, barWidth, 2)
                }
            }
        }

        const applyFade = (
            ctx: CanvasRenderingContext2D,
            w: number,
            h: number,
        ) => {
            if (!fadeEdges) return
            // Left fade
            const leftGrad = ctx.createLinearGradient(0, 0, fadeWidth, 0)
            leftGrad.addColorStop(0, "rgba(0,0,0,1)")
            leftGrad.addColorStop(1, "rgba(0,0,0,0)")
            ctx.globalCompositeOperation = "destination-out"
            ctx.fillStyle = leftGrad
            ctx.fillRect(0, 0, fadeWidth, h)
            // Right fade
            const rightGrad = ctx.createLinearGradient(w - fadeWidth, 0, w, 0)
            rightGrad.addColorStop(0, "rgba(0,0,0,0)")
            rightGrad.addColorStop(1, "rgba(0,0,0,1)")
            ctx.fillStyle = rightGrad
            ctx.fillRect(w - fadeWidth, 0, fadeWidth, h)
            ctx.globalCompositeOperation = "source-over"
        }

        useEffect(() => {
            const canvas = canvasRef.current
            if (!canvas) return

            // Scale for HiDPI
            const dpr = window.devicePixelRatio || 1
            const rect = canvas.getBoundingClientRect()
            canvas.width = rect.width * dpr
            canvas.height = rect.height * dpr
            const ctx = canvas.getContext("2d")
            if (!ctx) return
            ctx.scale(dpr, dpr)
            const w = rect.width
            const h = rect.height
            const color = getBarColor(canvas)

            // Pre-fill history so bars span the full width from the first frame
            historyRef.current = new Array(historySize).fill(1)
            let mounted = true

            const tick = (data: Uint8Array) => {
                if (!mounted) return
                if (mode === "scrolling") drawScrolling(ctx, data, w, h, color)
                else drawStatic(ctx, data, w, h, color)
            }

            const startAudio = async (s: MediaStream) => {
                streamRef.current = s
                onStreamReady?.(s)
                const audioCtx = new AudioContext()
                audioCtxRef.current = audioCtx
                const source = audioCtx.createMediaStreamSource(s)
                const analyser = audioCtx.createAnalyser()
                analyser.fftSize = fftSize
                analyser.smoothingTimeConstant = smoothingTimeConstant
                source.connect(analyser)
                analyserRef.current = analyser
                const data = new Uint8Array(analyser.frequencyBinCount)

                intervalRef.current = setInterval(() => {
                    if (!mounted) return
                    analyser.getByteFrequencyData(data)
                    tick(data)
                }, updateRate)
            }

            const cleanup = () => {
                mounted = false
                if (rafRef.current) cancelAnimationFrame(rafRef.current)
                if (intervalRef.current) clearInterval(intervalRef.current)
                if (analyserRef.current) analyserRef.current.disconnect()
                if (audioCtxRef.current) void audioCtxRef.current.close()
                // Only stop the stream if we created it ourselves (not external)
                if (!externalStream && streamRef.current) {
                    streamRef.current.getTracks().forEach((t) => t.stop())
                    onStreamEnd?.()
                }
                streamRef.current = null
            }

            if (!active && !processing) {
                drawIdle(ctx, w, h, color)
                return cleanup
            }

            if (!active && processing) {
                const animate = () => {
                    if (!mounted) return
                    drawProcessing(ctx, w, h, color)
                    rafRef.current = requestAnimationFrame(animate)
                }
                animate()
                return cleanup
            }

            // active = true
            if (externalStream) {
                void startAudio(externalStream).catch((e) => onError?.(e instanceof Error ? e : new Error(String(e))))
            } else {
                navigator.mediaDevices
                    .getUserMedia({ audio: true })
                    .then((s) => {
                        if (!mounted) { s.getTracks().forEach((t) => t.stop()); return }
                        void startAudio(s)
                    })
                    .catch((e) => onError?.(e instanceof Error ? e : new Error(String(e))))
            }

            return cleanup
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [active, processing, mode, externalStream])

        const heightValue = typeof height === "number" ? `${height}px` : height

        return (
            <div
                ref={ref}
                className={cn("relative w-full overflow-hidden", className)}
                style={{ height: heightValue, ...style }}
                {...props}
            >
                <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full"
                />
            </div>
        )
    }
)

LiveWaveform.displayName = "LiveWaveform"
