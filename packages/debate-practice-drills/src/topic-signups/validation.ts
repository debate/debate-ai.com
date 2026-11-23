/**
 * @fileoverview Parses a `POST /api/topic-signups` body into a
 * {@link TopicActionRequest}, trimming and capping every string so the route
 * only stores what this accepts. Pure, shared by the route and its tests.
 *
 * @module debate-practice-rounds/topic-signups/validation
 */

import { cleanTopicText, topicKey } from "@debate-ai/rankings/src/topics/topic-signup-link"
import {
  MAX_NOTE_LENGTH,
  MAX_NOTE_TITLE_LENGTH,
  MAX_SIGNUP_NOTE_LENGTH,
  MAX_SQUAD_ABOUT_LENGTH,
  MAX_SQUAD_NAME_LENGTH,
  TOPIC_NOTE_KINDS,
  TOPIC_SIGNUP_ROLES,
  TOPIC_SIGNUP_SIDES,
  type TopicAction,
  type TopicNoteKind,
  type TopicSignupRole,
  type TopicSignupSide,
} from "./types"

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string }

/** The parsed target topic plus the action. */
export interface ParsedTopicAction {
  topic: { key: string; text: string; format: string | null; source: string | null }
  action: TopicAction
}

const str = (value: unknown, max: number): string =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : ""
const longStr = (value: unknown, max: number): string =>
  typeof value === "string" ? value.replace(/\r\n/g, "\n").trim().slice(0, max) : ""

function oneOf<T extends string>(list: readonly T[], value: unknown, fallback: T): T {
  return list.includes(value as T) ? (value as T) : fallback
}

/** An http(s) URL, or `null` for anything else. */
export function cleanUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null
  try {
    const url = new URL(value.trim())
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString().slice(0, 500) : null
  } catch {
    return null
  }
}

/** Parses the topic fields alone (the GET's query, or a write's body). */
export function parseTopicTarget(
  value: { topic?: unknown; format?: unknown; source?: unknown },
): Parsed<ParsedTopicAction["topic"]> {
  const text = typeof value.topic === "string" ? cleanTopicText(value.topic) : ""
  const key = topicKey(text)
  if (!key) return { ok: false, error: "Name a resolution." }
  return {
    ok: true,
    value: { key, text, format: str(value.format, 40) || null, source: str(value.source, 120) || null },
  }
}

export function parseTopicAction(payload: unknown): Parsed<ParsedTopicAction> {
  if (!payload || typeof payload !== "object") return { ok: false, error: "Invalid request." }
  const body = payload as Record<string, unknown>
  const topic = parseTopicTarget(body)
  if (!topic.ok) return topic

  const done = (action: TopicAction): Parsed<ParsedTopicAction> => ({ ok: true, value: { topic: topic.value, action } })

  switch (body.action) {
    case "signup":
      return done({
        action: "signup",
        role: oneOf<TopicSignupRole>(TOPIC_SIGNUP_ROLES, body.role, "debate"),
        side: oneOf<TopicSignupSide>(TOPIC_SIGNUP_SIDES, body.side, "either"),
        note: str(body.note, MAX_SIGNUP_NOTE_LENGTH),
      })
    case "withdraw":
      return done({ action: "withdraw" })
    case "create-squad": {
      const name = str(body.name, MAX_SQUAD_NAME_LENGTH)
      if (!name) return { ok: false, error: "Give the squad a name." }
      return done({ action: "create-squad", name, about: str(body.about, MAX_SQUAD_ABOUT_LENGTH) })
    }
    case "join-squad":
    case "leave-squad": {
      const squadId = str(body.squadId, 64)
      if (!squadId) return { ok: false, error: "Which squad?" }
      return done({ action: body.action, squadId })
    }
    case "add-note": {
      const kind = oneOf<TopicNoteKind>(TOPIC_NOTE_KINDS, body.kind, "argument")
      const url = cleanUrl(body.url)
      if (typeof body.url === "string" && body.url.trim() && !url) {
        return { ok: false, error: "Links must start with http:// or https://." }
      }
      const title = str(body.title, MAX_NOTE_TITLE_LENGTH)
      const text = longStr(body.body, MAX_NOTE_LENGTH)
      if (!title && !text && !url) return { ok: false, error: "Write something to add." }
      return done({ action: "add-note", kind, title, url, body: text })
    }
    case "delete-note": {
      const noteId = str(body.noteId, 64)
      if (!noteId) return { ok: false, error: "Which note?" }
      return done({ action: "delete-note", noteId })
    }
    default:
      return { ok: false, error: "Unknown action." }
  }
}
