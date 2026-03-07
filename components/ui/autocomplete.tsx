/**
 * @fileoverview Searchable input with dropdown suggestions.
 * Supports both fixed options and asynchronous fetching.
 */

"use client"


import { useState, useRef, useCallback, useEffect } from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"

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
}

/**
 * Searchable input with dropdown suggestions that also allows free-form custom entry.
 * Selecting a suggestion fills the input; typing anything not in the list is kept as-is on blur.
 * Pass `fetchOptions` for async/server-side searching (skips client-side filtering).
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
}: AutocompleteProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value)
  const [asyncOptions, setAsyncOptions] = useState<string[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
    onChange(newVal)
    setOpen(true)
    if (fetchOptions) {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(async () => {
        const results = await fetchOptions(newVal)
        setAsyncOptions(results)
      }, 200)
    }
  }

  const handleSelect = (school: string) => {
    setQuery(school)
    onChange(school)
    setOpen(false)
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
      <Input
        placeholder={placeholder}
        value={query}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={async () => {
          setOpen(true)
          if (fetchOptions && asyncOptions.length === 0) {
            const results = await fetchOptions(query)
            setAsyncOptions(results)
          }
        }}
        onBlur={handleBlur}
        disabled={disabled}
        className={className}
      />
      {open && filtered.length > 0 && (
      <div
        className={cn(
          "absolute top-full left-0 right-0 z-50 mt-1 rounded-md border bg-popover shadow-md overflow-hidden",
          dropdownClassName,
        )}
      >
        {filtered.map((school) => {
          const isSelected = value === school
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
