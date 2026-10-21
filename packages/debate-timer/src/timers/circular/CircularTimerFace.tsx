/// <reference path="./css-module.d.ts" />
"use client"

/**
 * @fileoverview The circular progress timer face: a round dial whose ring
 * depletes as time runs out, with the countdown in digital-clock digits, a
 * row of speech buttons above it and prep buttons below. Clicking anywhere
 * else on the face plays or pauses, with a ripple.
 *
 * Moved here from the browser extension's timer window
 * (apps/debate-browser-ext/src/components/TimerFace.tsx, which now wraps
 * this) so the round sidebar's Timer section and its pop-out can show the
 * same dial. Purely presentational: it owns no timer state, so callers drive
 * `progress`, `countText` and `ticking` themselves.
 *
 * @module timers/circular/CircularTimerFace
 */

import type React from "react"
import { useCallback, useRef, useState, type CSSProperties, type ReactNode } from "react"
import { cn } from "../../ui/lib/utils"
import "./circular-timer-face.css"

/** Ring/count colour schemes, one per kind of timer (the extension's palette). */
export type CircularTimerAccent = "constructive" | "rebuttal" | "crossx" | "aff" | "neg"

/** A text button on the face (a speech length above the count, a prep clock below). */
export interface CircularTimerButton {
  key: string
  label: ReactNode
  accent?: CircularTimerAccent
  title?: string
  /** Marks the button whose timer the face is showing. */
  active?: boolean
  onClick: () => void
  onDoubleClick?: () => void
}

export interface CircularTimerFaceProps {
  /** 0 (full time left) to 1 (time's up). Clamped to that range. */
  progress: number
  /** The countdown, e.g. "4:59". */
  countText: string
  /** Small label above the buttons, e.g. the speech name. */
  title?: ReactNode
  /** Whether the timer is running — the face darkens and the ring brightens. */
  ticking: boolean
  /** Colour scheme for the ring and count. */
  accent?: CircularTimerAccent | null
  /** Play/pause, from a click on the face (or on the count while running). */
  onToggle: () => void
  /** Makes the count editable while paused; called with each keystroke's text. */
  onCountTextChange?: (text: string) => void
  /** The edited count when the field loses focus. */
  onCountCommit?: (text: string) => void
  /** The edited count when Enter is pressed (the extension starts the timer from it). */
  onCountSubmit?: (text: string) => void
  /** Buttons above the count. */
  speechButtons?: CircularTimerButton[]
  /** Buttons below the count. */
  prepButtons?: CircularTimerButton[]
  /** Accessible name for the count. */
  countLabel?: string
  className?: string
  /** Set `--dt-ctimer-size` here to size the dial (default 340px, never wider than its container). */
  style?: CSSProperties
}

/** Stroke circumference for the r=90 ring in the 200x200 viewBox. */
const CIRCUMFERENCE = 2 * Math.PI * 90

interface Ripple {
  id: number
  x: number
  y: number
}

/** The circular progress timer face. */
export function CircularTimerFace({
  progress,
  countText,
  title,
  ticking,
  accent,
  onToggle,
  onCountTextChange,
  onCountCommit,
  onCountSubmit,
  speechButtons,
  prepButtons,
  countLabel = "Time remaining",
  className,
  style,
}: CircularTimerFaceProps) {
  const faceRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [ripples, setRipples] = useState<Ripple[]>([])
  const editable = Boolean(onCountTextChange)
  const clamped = Math.min(1, Math.max(0, progress))

  const addRipple = useCallback((clientX: number, clientY: number) => {
    const rect = faceRef.current?.getBoundingClientRect()
    if (!rect) return
    const id = Date.now() + Math.random()
    setRipples((r) => [...r, { id, x: clientX - rect.left, y: clientY - rect.top }])
    window.setTimeout(() => {
      setRipples((r) => r.filter((x) => x.id !== id))
    }, 1100)
  }, [])

  // Click anywhere on the face that isn't a button or the count input: play/pause.
  const handleFaceClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.altKey) return
      const target = e.target as HTMLElement
      if (target.closest("button") || target.closest("input")) return
      // Allow selecting text while paused without toggling.
      if (!ticking && String(window.getSelection() ?? "").length) return

      addRipple(e.clientX, e.clientY)
      onToggle()
    },
    [ticking, onToggle, addRipple],
  )

  // Count input: while running -> pause; while paused -> edit it (or play, when read-only).
  const handleCountClick = useCallback(
    (e: React.MouseEvent<HTMLInputElement>) => {
      e.stopPropagation()
      if (ticking || !editable) {
        addRipple(e.clientX, e.clientY)
        onToggle()
      } else {
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    },
    [ticking, editable, onToggle, addRipple],
  )

  const handleCountKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault()
        onCountSubmit?.(e.currentTarget.value)
        inputRef.current?.blur()
        return
      }
      if (e.key.length === 1 && !/[0-9:]/.test(e.key) && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
      }
    },
    [onCountSubmit],
  )

  const renderButton = (b: CircularTimerButton, kind: "speech" | "prep") => (
    <button
      key={b.key}
      type="button"
      title={b.title}
      aria-pressed={b.active}
      className={cn(
        "dt-ctimer__btn",
        kind === "prep" && "dt-ctimer__btn--prep",
        b.accent && `dt-ctimer__btn--${b.accent}`,
        b.active && "dt-ctimer__btn--active",
      )}
      onClick={(e) => {
        e.stopPropagation()
        b.onClick()
      }}
      onDoubleClick={
        b.onDoubleClick
          ? (e) => {
              e.stopPropagation()
              b.onDoubleClick?.()
            }
          : undefined
      }
    >
      {b.label}
    </button>
  )

  return (
    <div
      ref={faceRef}
      className={cn("dt-ctimer", accent && `dt-ctimer--${accent}`, ticking && "dt-ctimer--playing", className)}
      style={style}
      onClick={handleFaceClick}
    >
      <svg className="dt-ctimer__ring" viewBox="0 0 200 200" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <circle
          className="dt-ctimer__progress"
          r="90"
          cx="100"
          cy="100"
          style={{ strokeDasharray: CIRCUMFERENCE, strokeDashoffset: clamped * CIRCUMFERENCE }}
        />
      </svg>

      <div className="dt-ctimer__title">{title}</div>

      {speechButtons && speechButtons.length > 0 && (
        <div className="dt-ctimer__speeches">{speechButtons.map((b) => renderButton(b, "speech"))}</div>
      )}

      <input
        ref={inputRef}
        className="dt-ctimer__count"
        type="text"
        inputMode="numeric"
        maxLength={5}
        value={countText}
        readOnly={ticking || !editable}
        aria-label={countLabel}
        onClick={handleCountClick}
        onChange={(e) => onCountTextChange?.(e.target.value.replace(/[^0-9:]/g, "").slice(0, 5))}
        onBlur={(e) => onCountCommit?.(e.target.value)}
        onKeyDown={handleCountKeyDown}
      />

      {prepButtons && prepButtons.length > 0 && (
        <div className="dt-ctimer__preps">{prepButtons.map((b) => renderButton(b, "prep"))}</div>
      )}

      {ripples.map((r) => (
        <span key={r.id} className="dt-ctimer__ripple" style={{ left: r.x, top: r.y }} />
      ))}
    </div>
  )
}

/** Formats milliseconds as the face's "m:ss" count (rounding up, so 0:00 means done). */
export function formatCircularTimerCount(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`
}
