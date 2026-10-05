/**
 * @fileoverview Saved-to-account marker for a whole round, shown on the
 * `/debate` start screen's round cards. Same icons and wording as the flow
 * tab marker; renders nothing until this session has a baseline for the round.
 */

"use client"

import { useSyncExternalStore } from "react"
import { Cloud, CloudOff } from "lucide-react"
import type { Round } from "../types/flow"
import {
  getFlowAccountStatusVersion,
  getRoundAccountStatus,
  subscribeFlowAccountStatus,
} from "../state/flowAccountStatus"

export function RoundAccountMarker({ round }: { round: Round }) {
  useSyncExternalStore(subscribeFlowAccountStatus, getFlowAccountStatusVersion, getFlowAccountStatusVersion)
  const status = getRoundAccountStatus(round)
  if (status === "saved") {
    return (
      <Cloud className="h-3 w-3 shrink-0 text-muted-foreground" aria-label="Saved to your account" role="img">
        <title>Saved to your account</title>
      </Cloud>
    )
  }
  if (status === "unsaved") {
    return (
      <CloudOff className="h-3 w-3 shrink-0 text-amber-500" aria-label="Changed since last account save" role="img">
        <title>Changed since last account save</title>
      </CloudOff>
    )
  }
  return null
}
