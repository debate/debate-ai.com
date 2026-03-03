"use client"

/**
 * @fileoverview MicSelector component
 *
 * Microphone input selector with device management and live waveform preview.
 * Matches the ElevenLabs MicSelector API:
 *   <MicSelector value={deviceId} onValueChange={setDeviceId} muted={muted} onMutedChange={setMuted} />
 */

import {
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react"
import { Mic, MicOff, ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { LiveWaveform } from "@/components/debate/DebateRound/SpeechRecorder/live-waveform"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AudioDevice {
    deviceId: string
    label: string
    groupId: string
}

export interface UseAudioDevicesReturn {
    devices: AudioDevice[]
    loading: boolean
    error: string | null
    hasPermission: boolean
    loadDevices: () => Promise<void>
}

// ---------------------------------------------------------------------------
// useAudioDevices hook
// ---------------------------------------------------------------------------

export function useAudioDevices(): UseAudioDevicesReturn {
    const [devices, setDevices] = useState<AudioDevice[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [hasPermission, setHasPermission] = useState(false)

    const loadDevices = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            // Request permission first so labels are populated
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            stream.getTracks().forEach((t) => t.stop())
            setHasPermission(true)

            const all = await navigator.mediaDevices.enumerateDevices()
            const audioInputs = all
                .filter((d) => d.kind === "audioinput")
                .map((d) => ({
                    deviceId: d.deviceId,
                    // Strip trailing metadata like " (USB)" appended by some browsers
                    label: d.label.replace(/\s*\(.*?\)\s*$/, "") || `Microphone ${d.deviceId.slice(0, 4)}`,
                    groupId: d.groupId,
                }))
            setDevices(audioInputs)
        } catch (err) {
            setError(err instanceof Error ? err.message : "Microphone access denied")
            setHasPermission(false)
        } finally {
            setLoading(false)
        }
    }, [])

    // Re-enumerate when devices change (plug/unplug)
    useEffect(() => {
        const handler = () => { void loadDevices() }
        navigator.mediaDevices.addEventListener("devicechange", handler)
        return () => navigator.mediaDevices.removeEventListener("devicechange", handler)
    }, [loadDevices])

    return { devices, loading, error, hasPermission, loadDevices }
}


// MicSelector component
// ---------------------------------------------------------------------------

export interface MicSelectorProps {
    /** Selected device ID (controlled) */
    value?: string
    /** Callback when device selection changes */
    onValueChange?: (deviceId: string) => void
    /** Mute state (controlled) */
    muted?: boolean
    /** Callback when mute state changes */
    onMutedChange?: (muted: boolean) => void
    /** Disables the selector dropdown */
    disabled?: boolean
    /** Optional CSS classes for the container */
    className?: string
}

export function MicSelector({
    value,
    onValueChange,
    muted,
    onMutedChange,
    disabled,
    className,
}: MicSelectorProps) {
    const { devices, loading, loadDevices } = useAudioDevices()
    const [open, setOpen] = useState(false)
    const [previewStream, setPreviewStream] = useState<MediaStream | null>(null)
    const previewStreamRef = useRef<MediaStream | null>(null)

    // Controlled mute state with internal fallback
    const [internalMuted, setInternalMuted] = useState(false)
    const isMuted = muted !== undefined ? muted : internalMuted
    const setMuted = (m: boolean) => {
        setInternalMuted(m)
        onMutedChange?.(m)
    }

    // Auto-select first device once loaded
    useEffect(() => {
        if (devices.length > 0 && !value) {
            onValueChange?.(devices[0].deviceId)
        }
    }, [devices, value, onValueChange])

    // Start/stop live waveform preview when dropdown opens/closes or mic is unmuted
    useEffect(() => {
        if (!open && isMuted) {
            if (previewStreamRef.current) {
                previewStreamRef.current.getTracks().forEach((t) => t.stop())
                previewStreamRef.current = null
                setPreviewStream(null)
            }
            return
        }

        const constraints: MediaStreamConstraints = {
            audio: value ? { deviceId: { exact: value } } : true,
        }
        navigator.mediaDevices.getUserMedia(constraints)
            .then((stream) => {
                previewStreamRef.current = stream
                setPreviewStream(stream)
            })
            .catch(() => { /* permission denied */ })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, isMuted, value])

    const handleOpen = async (o: boolean) => {
        if (o && devices.length === 0) {
            await loadDevices()
        }
        setOpen(o)
    }

    const selectedDevice = devices.find((d) => d.deviceId === value)
    const selectedLabel = selectedDevice?.label ?? (devices[0]?.label ?? "Microphone")

    return (
        <div className={cn("flex items-center", className)}>
            {/* Mute / unmute toggle */}
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-r-none relative overflow-hidden"
                            onClick={() => setMuted(!isMuted)}
                            disabled={disabled}
                            title={isMuted ? "Unmute microphone" : "Mute microphone"}
                        >
                            {isMuted ? (
                                <MicOff className="h-4 w-4" />
                            ) : (
                                <div className="absolute inset-1 flex items-center justify-center pointer-events-none opacity-80 ">
                                    <LiveWaveform
                                        active={!isMuted}
                                        stream={previewStream}
                                        mode="scrolling"
                                        height={30}
                                        barWidth={30}
                                        barGap={1}
                                        barRadius={1}
                                        sensitivity={2.0}
                                        fadeEdges={true}
                                        fadeWidth={4}
                                        className="w-full h-full -ml-[40px] "
                                    />
                                </div>
                            )}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                        <p>Record when Speech Starts</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>

            {/* Device selector dropdown */}
            <DropdownMenu open={open} onOpenChange={handleOpen}>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-3 rounded-l-none border-l border-border px-0"
                        disabled={disabled}
                        title="Select microphone"
                    >
                        <ChevronDown className="h-2.5 w-2.5" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">

                    {/* Live waveform preview */}
                    {open && (
                        <div className="px-1.5 pt-1.5 pb-1">
                            <LiveWaveform
                                active={open}
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
                    <DropdownMenuSeparator />

                    {devices.length === 0 && !loading && (
                        <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                            No microphones found
                        </DropdownMenuItem>
                    )}

                    {devices.map((device) => (
                        <DropdownMenuItem
                            key={device.deviceId}
                            onClick={() => {
                                onValueChange?.(device.deviceId)
                                setOpen(false)
                            }}
                            className={cn(
                                "text-xs cursor-pointer",
                                device.deviceId === value && "font-medium bg-accent"
                            )}
                        >
                            <Mic className="h-3 w-3 mr-2 flex-shrink-0" />
                            <span className="truncate">{device.label}</span>
                        </DropdownMenuItem>
                    ))}

                    <DropdownMenuSeparator />
                    <div className="px-2 py-1 text-[10px] text-muted-foreground">
                        Currently: {selectedLabel}
                    </div>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    )
}
