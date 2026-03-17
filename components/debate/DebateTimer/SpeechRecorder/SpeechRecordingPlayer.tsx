/**
 * @fileoverview Component for managing and playing speech recordings stored in local storage.
 */

"use client"


import { useEffect, useState, type RefObject, useRef } from "react"
import { createPortal } from "react-dom"
import { Trash2, RefreshCw, MoreVertical, Clock, Upload, Mic, Check, MicOff, Users, Gauge } from "lucide-react"
import {
    AudioPlayerButton,
    AudioPlayerProgress,
    AudioPlayerProvider,
    AudioPlayerTime,
    AudioPlayerDuration,
    useAudioPlayer,
} from "./audio-player"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel,
    DropdownMenuSub,
    DropdownMenuSubTrigger,
    DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useAudioDevices } from "./mic-selector"
import { LiveWaveform } from "./live-waveform"

interface StoredRecording {
    key: string
    speechName: string
    speechLabel: string
    recordedAt: string
    audio: string
    durationSeconds?: number
}

/** Format seconds as m:ss, e.g. 312.4 → "5:12" */
function formatDuration(s: number): string {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, "0")}`
}

/** Shows inline progress scrubber only when audio is not playing (paused state). */
function InlineProgressWhenPaused({ className }: { className?: string }) {
    const player = useAudioPlayer()
    if (player.isPlaying) return <div className={className} />
    return <AudioPlayerProgress className={className} />
}

/** Player row component that has access to the audio player context */
function PlayerRow({
    track,
    rec,
    speechName,
    speechLabel,
    micDeviceId,
    onMicDeviceChange,
    recordingEnabled,
    onRecordingEnabledChange,
    onResetSpeechTime,
    onSwitchToCrossX,
    onResetPrepTimers,
    handleDelete,
    progressBarPortalRef,
    hideInlineMenu,
}: {
    track: { id: string; src: string }
    rec: StoredRecording
    speechName: string
    speechLabel?: string
    micDeviceId?: string
    onMicDeviceChange?: (deviceId: string) => void
    recordingEnabled?: boolean
    onRecordingEnabledChange?: (enabled: boolean) => void
    onResetSpeechTime?: () => void
    onSwitchToCrossX?: () => void
    onResetPrepTimers?: () => void
    handleDelete: (key: string) => void
    progressBarPortalRef?: RefObject<HTMLDivElement | null>
    hideInlineMenu?: boolean
}) {
    const player = useAudioPlayer()

    return (
        <div className="flex items-center gap-2 rounded-md bg-muted/50 px-2.5 py-2 text-xs group">
            {/* Play / Pause */}
            <AudioPlayerButton
                item={track}
                variant="ghost"
                size="icon"
                className="h-7 w-7 flex-shrink-0"
            />

            {/* Times - Two rows: current time on top, total duration below */}
            <div className="flex flex-col items-center justify-center text-[10px] tabular-nums min-w-max leading-tight">
                <AudioPlayerTime className="text-[10px] tabular-nums text-foreground font-medium" />
                <div className="text-muted-foreground">
                    {rec.durationSeconds != null ? (
                        <span>{formatDuration(rec.durationSeconds)}</span>
                    ) : (
                        <AudioPlayerDuration className="text-[10px] tabular-nums" />
                    )}
                </div>
            </div>

            {/* Scrubber — hidden when portaled to top bar */}
            {!progressBarPortalRef && (
                <AudioPlayerProgress className="flex-1 h-5" />
            )}
            {progressBarPortalRef && (
                <InlineProgressWhenPaused className="flex-1 h-5" />
            )}

            {/* Menu with Mic Selector, Reset, Cross-X, Upload, Delete, Playback Speed */}
            {!hideInlineMenu && (
                <SpeechRecordingMenu
                    speechName={speechName}
                    speechLabel={speechLabel}
                    micDeviceId={micDeviceId}
                    onMicDeviceChange={onMicDeviceChange}
                    recordingEnabled={recordingEnabled}
                    onRecordingEnabledChange={onRecordingEnabledChange}
                    onResetSpeechTime={onResetSpeechTime}
                    onSwitchToCrossX={onSwitchToCrossX}
                    onResetPrepTimers={onResetPrepTimers}
                    onDeleteRecording={handleDelete}
                    recordingKey={rec.key}
                    inHeader={false}
                    playbackRate={player.playbackRate}
                    onPlaybackRateChange={player.setPlaybackRate}
                    speeds={[0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]}
                />
            )}
        </div>
    )
}

/** Renders the seekable progress bar into an external container via portal when playing. */
function PortaledProgress({
    portalRef,
    onPlayingChange,
}: {
    portalRef: RefObject<HTMLDivElement | null>
    onPlayingChange?: (playing: boolean) => void
}) {
    const player = useAudioPlayer()
    useEffect(() => {
        onPlayingChange?.(player.isPlaying)
    }, [player.isPlaying, onPlayingChange])

    if (!player.isPlaying || !portalRef.current) return null
    return createPortal(
        <AudioPlayerProgress className="absolute inset-0 w-full h-full [&_[data-slot=slider-thumb]]:opacity-100 [&_[data-slot=slider-thumb]>div]:size-2.5" />,
        portalRef.current,
    )
}

interface SpeechRecordingMenuProps {
    /** Name of the speech for upload/delete operations */
    speechName: string
    /** Display label for the speech */
    speechLabel?: string
    /** Selected microphone device ID */
    micDeviceId?: string
    /** Callback when microphone device changes */
    onMicDeviceChange?: (deviceId: string) => void
    /** Whether recording is enabled */
    recordingEnabled?: boolean
    /** Callback when recording enabled state changes */
    onRecordingEnabledChange?: (enabled: boolean) => void
    /** Callback to reset the speech timer */
    onResetSpeechTime?: () => void
    /** Callback to switch timer to Cross-X (3 min) */
    onSwitchToCrossX?: () => void
    /** Callback to reset prep timers to their defaults */
    onResetPrepTimers?: () => void
    /** Callback to delete a recording */
    onDeleteRecording?: (key: string) => void
    /** The recording key if deleting from player context */
    recordingKey?: string
    /** Whether this is rendered in the header (vs in player) */
    inHeader?: boolean
    /** Custom button variant/styling */
    buttonClassName?: string
    /** Available playback speeds */
    speeds?: readonly number[]
    /** Current playback rate */
    playbackRate?: number
    /** Callback when playback rate changes */
    onPlaybackRateChange?: (rate: number) => void
}

interface SpeechRecordingPlayerProps {
    /** Name of the currently selected speech — used as localStorage key suffix */
    speechName: string
    /** Full display label (e.g. "1AC — johnsmith") */
    speechLabel?: string
    className?: string
    /** Ref to an external container where the seekable progress bar is portaled when playing. */
    progressBarPortalRef?: RefObject<HTMLDivElement | null>
    /** Callback fired when audio playing state changes. */
    onPlayingChange?: (playing: boolean) => void
    /** Callback to reset the speech timer. */
    onResetSpeechTime?: () => void
    /** Callback to switch timer to Cross-X (3 min). */
    onSwitchToCrossX?: () => void
    /** Callback to reset prep timers to their defaults. */
    onResetPrepTimers?: () => void
    /** Selected microphone device ID */
    micDeviceId?: string
    /** Callback when microphone device changes */
    onMicDeviceChange?: (deviceId: string) => void
    /** Whether recording is enabled */
    recordingEnabled?: boolean
    /** Callback when recording enabled state changes */
    onRecordingEnabledChange?: (enabled: boolean) => void
    /** Whether to hide the inline menu button in player rows */
    hideInlineMenu?: boolean
}

/**
 * Load the single recording for a given speech from localStorage.
 * Key format: `debate-recording-{speechName}` (exact match).
 */
function loadRecordings(speechName: string): StoredRecording[] {
    const key = `debate-recording-${speechName}`
    const raw = localStorage.getItem(key)
    if (!raw) return []
    try {
        const parsed = JSON.parse(raw) as Omit<StoredRecording, "key">
        return [{ ...parsed, key, speechLabel: parsed.speechLabel ?? parsed.speechName }]
    } catch {
        return []
    }
}

/**
 * Menu button for speech recording controls (mic selector, timer controls, upload, delete).
 * Can be used in the player row or in the header bar.
 */
export function SpeechRecordingMenu({
    speechName,
    speechLabel,
    micDeviceId,
    onMicDeviceChange,
    recordingEnabled = true,
    onRecordingEnabledChange,
    onResetSpeechTime,
    onSwitchToCrossX,
    onResetPrepTimers,
    onDeleteRecording,
    recordingKey,
    inHeader = false,
    buttonClassName,
    speeds = [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
    playbackRate = 1,
    onPlaybackRateChange,
}: SpeechRecordingMenuProps) {
    const fileInputRef = useRef<HTMLInputElement>(null)
    const { devices, loading: loadingDevices, loadDevices } = useAudioDevices()
    const [previewStream, setPreviewStream] = useState<MediaStream | null>(null)
    const previewStreamRef = useRef<MediaStream | null>(null)
    const [menuOpen, setMenuOpen] = useState(false)

    const handleUploadAudio = () => {
        fileInputRef.current?.click()
    }

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        if (!file.type.startsWith("audio/")) {
            alert("Please select an audio file")
            return
        }

        const reader = new FileReader()
        reader.onload = async (e) => {
            const audioData = e.target?.result as string
            if (!audioData) return

            const audio = new Audio(audioData)
            await new Promise((resolve) => {
                audio.onloadedmetadata = resolve
            })

            const durationSeconds = audio.duration
            const key = `debate-recording-${speechName}`
            const recording = {
                speechName,
                speechLabel: speechLabel || speechName,
                recordedAt: new Date().toISOString(),
                audio: audioData,
                durationSeconds,
            }
            localStorage.setItem(key, JSON.stringify(recording))
            window.dispatchEvent(new CustomEvent("debate-recording-saved"))
        }
        reader.readAsDataURL(file)
        event.target.value = ""
    }

    const handleMenuOpenChange = async (open: boolean) => {
        setMenuOpen(open)

        if (open) {
            if (devices.length === 0) {
                await loadDevices()
            }

            const constraints: MediaStreamConstraints = {
                audio: micDeviceId ? { deviceId: { exact: micDeviceId } } : true,
            }
            try {
                const stream = await navigator.mediaDevices.getUserMedia(constraints)
                previewStreamRef.current = stream
                setPreviewStream(stream)
            } catch {
                // Permission denied or error
            }
        } else {
            if (previewStreamRef.current) {
                previewStreamRef.current.getTracks().forEach((t) => t.stop())
                previewStreamRef.current = null
                setPreviewStream(null)
            }
        }
    }

    const handleMicDeviceSelect = (deviceId: string) => {
        onMicDeviceChange?.(deviceId)

        if (menuOpen && previewStreamRef.current) {
            previewStreamRef.current.getTracks().forEach((t) => t.stop())

            const constraints: MediaStreamConstraints = {
                audio: { deviceId: { exact: deviceId } },
            }
            navigator.mediaDevices.getUserMedia(constraints)
                .then((stream) => {
                    previewStreamRef.current = stream
                    setPreviewStream(stream)
                })
                .catch(() => { /* error */ })
        }
    }

    const selectedDevice = devices.find((d) => d.deviceId === micDeviceId)
    const selectedLabel = selectedDevice?.label ?? (devices[0]?.label ?? "Microphone")

    return (
        <>
            <DropdownMenu open={menuOpen} onOpenChange={handleMenuOpenChange}>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                            inHeader ? "h-6 w-6 shrink-0" : "h-5 w-5 flex-shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity",
                            buttonClassName
                        )}
                    >
                        <MoreVertical className={inHeader ? "h-3.5 w-3.5" : "h-3 w-3"} />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                    {/* Share with Opponents & Judge - First menu item */}
                    <DropdownMenuItem onClick={() => { /* TODO: Implement sharing */ }}>
                        <Users className="h-4 w-4 mr-2" />
                        Share with Opponents
                    </DropdownMenuItem>

                    {/* Playback Speed submenu */}
                    {onPlaybackRateChange && (
                        <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                                <Gauge className="h-4 w-4 mr-2" />
                                Playback Speed
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                                {speeds.map((speed) => (
                                    <DropdownMenuItem
                                        key={speed}
                                        onClick={() => onPlaybackRateChange(speed)}
                                        className={cn(
                                            "cursor-pointer",
                                            playbackRate === speed && "bg-accent"
                                        )}
                                    >
                                        <span className="flex-1 font-mono">
                                            {speed === 1 ? "Normal" : `${speed * 100}% Speed`}
                                        </span>
                                        {playbackRate === speed && <Check className="h-4 w-4 ml-2" />}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuSubContent>
                        </DropdownMenuSub>
                    )}

                    {/* Recording toggle */}
                    {onRecordingEnabledChange && (
                        <DropdownMenuItem
                            onClick={() => onRecordingEnabledChange(!recordingEnabled)}
                            className={cn(
                                "cursor-pointer",
                                !recordingEnabled && "bg-accent"
                            )}
                        >
                            <MicOff className="h-4 w-4 mr-2" />
                            <span className="flex-1">Don't record audio</span>
                            {!recordingEnabled && <Check className="h-4 w-4 ml-2" />}
                        </DropdownMenuItem>
                    )}

                    {/* Timer control actions */}
                    {onResetSpeechTime && (
                        <DropdownMenuItem onClick={onResetSpeechTime}>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Reset Speech Timer
                        </DropdownMenuItem>
                    )}

                    {onSwitchToCrossX && (
                        <DropdownMenuItem onClick={onSwitchToCrossX}>
                            <Clock className="h-4 w-4 mr-2" />
                            Set Timer Cross-X
                        </DropdownMenuItem>
                    )}

                    {onResetPrepTimers && (
                        <DropdownMenuItem onClick={onResetPrepTimers}>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Reset Prep Timers
                        </DropdownMenuItem>
                    )}

                    {/* Audio file actions */}
                    <DropdownMenuItem onClick={handleUploadAudio}>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Speech Audio
                    </DropdownMenuItem>
                    {onDeleteRecording && recordingKey && (
                        <DropdownMenuItem
                            onClick={() => {
                                if (window.confirm("Delete this recording? This cannot be undone.")) {
                                    onDeleteRecording(recordingKey)
                                }
                            }}
                            className="text-destructive focus:text-destructive"
                        >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Recording
                        </DropdownMenuItem>
                    )}

                    {/* Microphone selector section — at the bottom */}
                    <DropdownMenuLabel className="text-xs text-muted-foreground">
                        Microphone Input
                    </DropdownMenuLabel>

                    {/* Live waveform preview */}
                    {menuOpen && (
                        <div className="px-1.5 pt-1 pb-1.5">
                            <LiveWaveform
                                active={menuOpen}
                                stream={previewStream}
                                mode="scrolling"
                                height={28}
                                barWidth={2}
                                barGap={1}
                                barRadius={1}
                                sensitivity={1.5}
                                fadeEdges={true}
                                fadeWidth={16}
                                className="rounded bg-muted/50 w-full"
                            />
                        </div>
                    )}

                    {devices.length === 0 && !loadingDevices && (
                        <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                            No microphones found
                        </DropdownMenuItem>
                    )}

                    {devices.map((device) => (
                        <DropdownMenuItem
                            key={device.deviceId}
                            onClick={() => handleMicDeviceSelect(device.deviceId)}
                            className={cn(
                                "text-xs cursor-pointer",
                                device.deviceId === micDeviceId && "font-medium bg-accent"
                            )}
                        >
                            <Mic className="h-3 w-3 mr-2 flex-shrink-0" />
                            <span className="truncate flex-1">{device.label}</span>
                            {device.deviceId === micDeviceId && (
                                <Check className="h-3 w-3 ml-2 flex-shrink-0" />
                            )}
                        </DropdownMenuItem>
                    ))}

                    <div className="px-2 py-1 text-[10px] text-muted-foreground">
                        Currently: {selectedLabel}
                    </div>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Hidden file input for audio upload */}
            <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={handleFileChange}
                className="hidden"
            />
        </>
    )
}

export function SpeechRecordingPlayer({
    speechName,
    speechLabel,
    className,
    progressBarPortalRef,
    onPlayingChange,
    onResetSpeechTime,
    onSwitchToCrossX,
    onResetPrepTimers,
    micDeviceId,
    onMicDeviceChange,
    recordingEnabled = true,
    onRecordingEnabledChange,
    hideInlineMenu = false,
}: SpeechRecordingPlayerProps) {
    const [recordings, setRecordings] = useState<StoredRecording[]>([])

    // Reload whenever the speech name changes
    useEffect(() => {
        setRecordings(loadRecordings(speechName))
    }, [speechName])

    // Track whether the timer is actively recording this speech right now
    const [isLiveRecording, setIsLiveRecording] = useState(false)

    useEffect(() => {
        const onStarted = (e: Event) => {
            const detail = (e as CustomEvent<{ speechName: string }>).detail
            if (detail.speechName === speechName) setIsLiveRecording(true)
        }
        const onSaved = () => {
            setIsLiveRecording(false)
            setRecordings(loadRecordings(speechName))
        }
        window.addEventListener("debate-recording-started", onStarted)
        window.addEventListener("debate-recording-saved", onSaved)
        return () => {
            window.removeEventListener("debate-recording-started", onStarted)
            window.removeEventListener("debate-recording-saved", onSaved)
        }
    }, [speechName])

    const handleDelete = (key: string) => {
        if (!window.confirm("Delete this recording? This cannot be undone.")) return
        localStorage.removeItem(key)
        setRecordings((prev) => prev.filter((r) => r.key !== key))
    }

    if (recordings.length === 0 && !isLiveRecording) return null

    return (
        <div className={cn("flex flex-col gap-1 w-full", className)}>
            {recordings.map((rec) => {
                const track = { id: rec.key, src: rec.audio }
                const label = rec.speechLabel || speechLabel || speechName
                return (
                    <AudioPlayerProvider key={rec.key} initialPlaybackRate={0.75}>
                        {/* Portal seekable progress to top bar when playing */}
                        {progressBarPortalRef && (
                            <PortaledProgress
                                portalRef={progressBarPortalRef}
                                onPlayingChange={onPlayingChange}
                            />
                        )}
                        <PlayerRow
                            track={track}
                            rec={rec}
                            speechName={speechName}
                            speechLabel={speechLabel}
                            micDeviceId={micDeviceId}
                            onMicDeviceChange={onMicDeviceChange}
                            recordingEnabled={recordingEnabled}
                            onRecordingEnabledChange={onRecordingEnabledChange}
                            onResetSpeechTime={onResetSpeechTime}
                            onSwitchToCrossX={onSwitchToCrossX}
                            onResetPrepTimers={onResetPrepTimers}
                            handleDelete={handleDelete}
                            progressBarPortalRef={progressBarPortalRef}
                            hideInlineMenu={hideInlineMenu}
                        />
                    </AudioPlayerProvider>
                )
            })}
        </div>
    )
}
