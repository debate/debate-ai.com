"use client"

/**
 * @fileoverview Registered-user autocomplete for the Round Editor dialog's
 * debater/judge/spectator email fields — a user request: "this should be
 * linked and have autocomplete of registered user" (see TODO.md's "Create
 * New Round — registered-user autocomplete + invite notifications"
 * Completed entry).
 *
 * A purpose-built dropdown rather than a `../../ui/primitives/
 * autocomplete` reuse: that primitive's suggestions and stored value are
 * the same string (fine for schools/tournaments, which have nothing else to
 * show), but a useful user suggestion needs to *display* "Name — email"
 * while *storing* only the email — these fields are validated and later
 * sent to `/api/rounds/invite` as plain email strings. Typing anything not
 * matched by a suggestion is kept as-is, same free-text fallback as every
 * other field in this dialog — a non-registered invitee still gets an
 * email invite (see `useRoundEditorForm.ts`).
 *
 * @module dialogs/CreateRoundDialog/UserAutocomplete
 */

import { useEffect, useRef, useState } from "react"
import { Input } from "../../ui/primitives/input"
import { searchUsers, type UserSearchResult } from "../../cache/client-cache"

interface UserAutocompleteProps {
  id?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

/** Free-text email input with a dropdown of matching registered users, keyed off name/email substring search. */
export function UserAutocomplete({ id, value, onChange, placeholder, className }: UserAutocompleteProps) {
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<UserSearchResult[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  function scheduleSearch(query: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setResults(await searchUsers(query))
    }, 200)
  }

  function handleInput(newVal: string) {
    onChange(newVal)
    setOpen(true)
    scheduleSearch(newVal)
  }

  function handleSelect(matchedUser: UserSearchResult) {
    onChange(matchedUser.email)
    setOpen(false)
  }

  function handleBlur() {
    // Small delay so a click on an option fires before we close
    setTimeout(() => {
      if (!containerRef.current?.contains(document.activeElement)) setOpen(false)
    }, 150)
  }

  return (
    <div ref={containerRef} className="relative">
      <Input
        id={id}
        type="email"
        placeholder={placeholder}
        value={value}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={async () => {
          setOpen(true)
          if (value.trim()) setResults(await searchUsers(value))
        }}
        onBlur={handleBlur}
        className={className}
      />
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-md overflow-hidden">
          {results.map((matchedUser) => (
            <button
              key={matchedUser.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(matchedUser)}
              className="flex w-full items-center gap-2 px-2 py-1.5 text-xs text-left hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <span className="font-medium truncate">{matchedUser.name}</span>
              <span className="text-muted-foreground truncate">{matchedUser.email}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
