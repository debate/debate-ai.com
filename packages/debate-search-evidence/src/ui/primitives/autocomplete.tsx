/**
 * @fileoverview Searchable input with dropdown suggestions.
 * Supports both fixed options and asynchronous fetching.
 */

"use client"


import { useState, useRef, useCallback, useEffect, type KeyboardEvent } from "react"
import { Check } from "lucide-react"
import { cn } from "../lib/utils"
import { inlineCompletionSuffix } from "../../lib/search-query"
import { Input } from "./input"

interface AutocompleteProps {
  value: string
  onChange: (value: string) => void
  options?: string[]
  fetchOptions?: (query: string) => Promise<string[]>
  placeholder?: string
  className?: string
  disabled?: boolean
  dropdownClassName?: string
  optionClassName?: string
  /**
   * Called when the user commits a value — Enter, a clicked suggestion, or an
   * accepted inline completion — as opposed to each keystroke. Without it a
   * commit is reported through `onChange` like any other edit.
   */
  onCommit?: (value: string) => void
  /**
   * Shows the rest of the top suggestion inline as ghost text after the caret;
   * Tab or → at the end of the text accepts it. Only for `fetchOptions`
   * completions, which continue the typed text.
   */
  inlineCompletion?: boolean
}

/**
 * Searchable input with dropdown suggestions that also allows free-form custom entry.
 * Selecting a suggestion fills the input; typing anything not in the list is kept as-is on blur.
 * Pass `fetchOptions` for async/server-side searching (skips client-side filtering).
 *
 * ↑/↓ step through the suggestions and load each into the input as it is
 * reached, Enter commits, Escape closes the list.
 */
export function Autocomplete({
  value,
  onChange,
  options = [],
  fetchOptions,
  placeholder,
  className,
  disabled,
  dropdownClassName,
  optionClassName,
  onCommit,
  inlineCompletion = false,
}: AutocompleteProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value)
  const [asyncOptions, setAsyncOptions] = useState<string[]>([])
  /** Suggestion reached with the arrow keys; -1 while the typed text stands. */
  const [activeIndex, setActiveIndex] = useState(-1)
  /** What was typed before arrowing into the list, so ↑ past the top restores it. */
  const typedRef = useRef(value)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /**
   * Sequence number of the newest suggestion request. A slow answer for an
   * earlier prefix would otherwise replace the suggestions for the newer one.
   */
  const fetchSeq = useRef(0)

  const loadOptions = useCallback(
    async (q: string) => {
      if (!fetchOptions) return
      const seq = ++fetchSeq.current
      const results = await fetchOptions(q)
      if (seq === fetchSeq.current) setAsyncOptions(results)
    },
    [fetchOptions],
  )

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    },
    [],
  )

  // Keep local query in sync when parent resets the value (e.g. clear filters)
  useEffect(() => {
    setQuery(value)
  }, [value])

  const filtered = fetchOptions
    ? asyncOptions
    : query
      ? options.filter((o) => o.toLowerCase().includes(query.toLowerCase())).slice(0, 10)
      : options.slice(0, 10)

  const handleInput = (newVal: string) => {
    setQuery(newVal)
    typedRef.current = newVal
    setActiveIndex(-1)
    onChange(newVal)
    setOpen(true)
    if (fetchOptions) {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      // Retire the suggestions for the old text now, not when the next answer lands.
      fetchSeq.current++
      setAsyncOptions((prev) => prev.filter((o) => o.toLowerCase().startsWith(newVal.toLowerCase())))
      debounceRef.current = setTimeout(() => void loadOptions(newVal), 200)
    }
  }

  const commit = (next: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    fetchSeq.current++
    setQuery(next)
    typedRef.current = next
    setActiveIndex(-1)
    setOpen(false)
    if (onCommit) onCommit(next)
    else onChange(next)
  }

  const handleSelect = (school: string) => commit(school)

  /** Loads the suggestion at `index` (or the typed text for -1) into the input. */
  const moveTo = (index: number) => {
    setActiveIndex(index)
    const next = index < 0 ? typedRef.current : filtered[index]
    setQuery(next)
    onChange(next)
  }

  const ghost =
    inlineCompletion && fetchOptions && open && activeIndex < 0
      ? inlineCompletionSuffix(query, asyncOptions[0])
      : ""

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return
    const atEnd = e.currentTarget.selectionStart === query.length && e.currentTarget.selectionEnd === query.length
    switch (e.key) {
      case "ArrowDown":
        if (filtered.length === 0) return
        e.preventDefault()
        setOpen(true)
        moveTo(activeIndex + 1 >= filtered.length ? -1 : activeIndex + 1)
        return
      case "ArrowUp":
        if (filtered.length === 0) return
        e.preventDefault()
        moveTo(activeIndex <= -1 ? filtered.length - 1 : activeIndex - 1)
        return
      case "Tab":
      case "ArrowRight":
        if (!ghost || !atEnd || e.shiftKey) return
        e.preventDefault()
        commit(query + ghost)
        return
      case "Enter":
        // Left alone for plain fields, so Enter still submits a surrounding form.
        if (!onCommit && activeIndex < 0) return
        e.preventDefault()
        commit(query)
        return
      case "Escape":
        if (!open) return
        e.preventDefault()
        if (activeIndex >= 0) moveTo(-1)
        setOpen(false)
        return
    }
  }

  const handleBlur = useCallback(() => {
    // Small delay so a click on an option fires before we close
    setTimeout(() => {
      if (!containerRef.current?.contains(document.activeElement)) {
        setOpen(false)
      }
    }, 150)
  }, [])

  return (
    <div ref={containerRef} className="relative">
      {ghost && (
        /* Same box, padding and font as the input, so the suffix sits right
           after the typed text; the typed part is transparent. */
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 flex h-9 items-center overflow-hidden whitespace-pre rounded-md border border-transparent px-3 py-1 text-base md:text-sm",
            className,
          )}
        >
          <span className="text-transparent">{query}</span>
          <span className="text-muted-foreground/60">{ghost}</span>
        </div>
      )}
      <Input
        placeholder={placeholder}
        value={query}
        onChange={(e) => handleInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          setOpen(true)
          if (fetchOptions && asyncOptions.length === 0) void loadOptions(query)
        }}
        onBlur={handleBlur}
        disabled={disabled}
        className={cn(ghost && "bg-transparent dark:bg-transparent", className)}
        role="combobox"
        aria-expanded={open && filtered.length > 0}
        aria-autocomplete={inlineCompletion ? "both" : "list"}
      />
      {open && filtered.length > 0 && (
      <div
        className={cn(
          "absolute top-full left-0 right-0 z-50 mt-1 rounded-md border bg-popover shadow-md overflow-hidden",
          dropdownClassName,
        )}
      >
        {filtered.map((school, index) => {
          const isSelected = value === school || index === activeIndex
          return (
            <button
              key={school}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(school)}
              className={cn(
                "flex w-full items-center gap-1.5 px-2 py-1 text-xs text-left hover:bg-accent hover:text-accent-foreground transition-colors",
                optionClassName,
                isSelected && "bg-accent/50",
              )}
            >
                {isSelected ? (
                  <Check className="h-3 w-3 shrink-0 text-primary" />
                ) : (
                  <span className="w-3 shrink-0" />
                )}
                {school}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
