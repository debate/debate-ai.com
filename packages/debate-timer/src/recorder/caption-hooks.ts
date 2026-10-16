/**
 * @fileoverview Hooks shared by the captions ticker
 * (`recorder/SpeechCaptionsTicker.tsx`) and the full-transcript modal
 * (`recorder/SpeechTranscriptDialog.tsx`). All must run inside the
 * recording's `AudioPlayerProvider`.
 *
 * @module recorder/caption-hooks
 */

"use client"

import { useEffect, useMemo, useState } from "react"
import { useAudioPlayer, useAudioPlayerTime } from "./audio-player"
import { activeCaptionIndex, buildCaptionWords, type CaptionWord } from "./speech-captions"
import { loadSpokenTranscript, SPOKEN_WORDS_EVENT, type SpokenTranscript } from "./spoken-words-store"

/** The speech's saved transcript and its timed caption words, kept fresh as it's transcribed. */
export function useCaptionWords(speechName: string, durationSeconds?: number) {
    const player = useAudioPlayer()
    const [transcript, setTranscript] = useState<SpokenTranscript | null>(null)

    useEffect(() => {
        setTranscript(loadSpokenTranscript(speechName))
        const onUpdate = (e: Event) => {
            const detail = (e as CustomEvent<{ speechName: string }>).detail
            if (detail?.speechName === speechName) setTranscript(loadSpokenTranscript(speechName))
        }
        window.addEventListener(SPOKEN_WORDS_EVENT, onUpdate)
        return () => window.removeEventListener(SPOKEN_WORDS_EVENT, onUpdate)
    }, [speechName])

    const words = useMemo(
        () => buildCaptionWords(transcript, durationSeconds ?? player.duration),
        [transcript, durationSeconds, player.duration],
    )
    return { transcript, words }
}

/** Index of the word playing now in `track`, or -1 when another track (or nothing) is playing. */
export function useActiveCaptionIndex(words: readonly CaptionWord[], track: { id: string }): number {
    const player = useAudioPlayer()
    const time = useAudioPlayerTime()
    return player.isItemActive(track.id) ? activeCaptionIndex(words, time) : -1
}

/** Seeks `track` to a time, starting it if it isn't the one loaded. */
export function useCaptionSeek(track: { id: string; src: string }) {
    const player = useAudioPlayer()
    return (start: number) => {
        if (!player.isItemActive(track.id)) {
            void player.play(track).then(() => player.seek(start))
            return
        }
        player.seek(start)
        if (!player.isPlaying) void player.play()
    }
}
