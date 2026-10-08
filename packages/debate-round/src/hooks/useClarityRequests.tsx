"use client"

/**
 * @fileoverview Wires the judge's "Tell the debater to be more clear" request
 * (rules in `round/clarity-request.ts`) into a live round: the judge's speech
 * timer menus get the item through {@link ClarityRequestProvider}, and every
 * device listens for the room event and toasts when it is the speaker.
 *
 * @module hooks/useClarityRequests
 */

import { createContext, useCallback, useContext, useEffect, useRef } from "react"
import { MessageSquareWarning } from "lucide-react"
import { toast } from "sonner"
import type { SpeechMenuAction } from "@debate/timer/src/recorder/SpeechRecordingPlayer"
import type { Round } from "../types/flow"
import type { SpeakerSpeech } from "../round/my-speeches"
import {
  CLARITY_REQUEST_LABEL,
  CLARITY_REQUEST_MESSAGE,
  isRoundJudge,
  parseClarityRequest,
  shouldShowClarityRequest,
  takeClarityRequestSlot,
} from "../round/clarity-request"

/** Sends a request for one speech; null when the viewer isn't the round's judge. */
const ClarityRequestContext = createContext<((speechName: string) => void) | null>(null)

export const ClarityRequestProvider = ClarityRequestContext.Provider

/** The speech menu item for the judge, or null for everyone else. */
export function useClarityRequestAction(speechName: string): SpeechMenuAction | null {
  const request = useContext(ClarityRequestContext)
  if (!request) return null
  return {
    key: "clarity-request",
    label: CLARITY_REQUEST_LABEL,
    icon: <MessageSquareWarning className="h-4 w-4 mr-2" />,
    onSelect: () => request(speechName),
  }
}

interface UseClarityRequestsOptions {
  /** Whether the device is in a round room at all. */
  inRoom: boolean
  round: Round | null | undefined
  viewerEmails: readonly (string | null | undefined)[]
  /** The format's timer speeches, to find who gives a speech by name. */
  speeches: readonly (SpeakerSpeech & { name: string })[]
  /** Whether this device's own timer for `speechName` is running. */
  isSpeechTimerRunning: (speechName: string) => boolean
  /** Broadcasts a request to the room (`useTimerSync`'s `sendClarityRequest`). */
  send: (speechName: string) => void
}

/**
 * Listens for clarity requests and toasts the speaker; returns the judge's
 * send function (rate limited per speech), or null when the viewer can't send.
 */
export function useClarityRequests({
  inRoom,
  round,
  viewerEmails,
  speeches,
  isSpeechTimerRunning,
  send,
}: UseClarityRequestsOptions): ((speechName: string) => void) | null {
  // Latest inputs for the window listener, so it binds once.
  const latest = useRef({ round, viewerEmails, speeches, isSpeechTimerRunning })
  latest.current = { round, viewerEmails, speeches, isSpeechTimerRunning }

  useEffect(() => {
    const onRequest = (event: Event) => {
      const request = parseClarityRequest((event as CustomEvent).detail?.payload)
      if (!request) return
      const { round, viewerEmails, speeches, isSpeechTimerRunning } = latest.current
      const name = request.speechName.toUpperCase()
      const speech = speeches.find((s) => s.name.toUpperCase() === name && s.name !== "CX")
      const show = shouldShowClarityRequest({
        round,
        viewerEmails,
        speech,
        speechTimerRunning: isSpeechTimerRunning(request.speechName),
      })
      if (!show) return
      // The page keeps more than one room socket, so the same request can
      // arrive twice; a shared toast id shows it once.
      toast.warning(CLARITY_REQUEST_MESSAGE, {
        id: `clarity-request-${request.speechName}-${request.sentAt}`,
        description: request.speechName,
        duration: 8000,
      })
    }
    window.addEventListener("room-clarity-request", onRequest)
    return () => window.removeEventListener("room-clarity-request", onRequest)
  }, [])

  const lastSent = useRef(new Map<string, number>())
  const request = useCallback(
    (speechName: string) => {
      if (!takeClarityRequestSlot(lastSent.current, speechName, Date.now())) {
        toast("Request already sent. Try again in a few seconds.")
        return
      }
      send(speechName)
      toast.success(`Asked the ${speechName} speaker to be more clear`)
    },
    [send],
  )

  return inRoom && isRoundJudge(round, viewerEmails) ? request : null
}
