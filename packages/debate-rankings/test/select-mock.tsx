/**
 * Native `<select>` stand-in for `src/ui/primitives/select` (Radix Select),
 * whose listbox can't be opened in jsdom. Use from a test file with:
 *
 *   vi.mock("../src/ui/primitives/select", () => import("./select-mock"))
 *
 * `SelectTrigger`'s `id` is forwarded onto the `<select>` (via context) so a
 * test can find the control by the same id the real trigger carries, and
 * `onValueChange` fires from the native `change` event.
 */

import { createContext, useContext, useState, type ReactNode } from "react"

const TriggerId = createContext<{ id?: string; setId: (id?: string) => void }>({ setId: () => {} })

export function Select({
  value,
  defaultValue,
  onValueChange,
  children,
  disabled,
}: {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  children?: ReactNode
  disabled?: boolean
}) {
  const [id, setId] = useState<string | undefined>()
  return (
    <TriggerId.Provider value={{ id, setId }}>
      <select
        data-testid="select"
        id={id}
        disabled={disabled}
        value={value ?? defaultValue ?? ""}
        onChange={(e) => onValueChange?.(e.target.value)}
      >
        <option value="" />
        {children}
      </select>
    </TriggerId.Provider>
  )
}

export function SelectTrigger({ id }: { id?: string; children?: ReactNode; className?: string }) {
  const ctx = useContext(TriggerId)
  if (id && ctx.id !== id) queueMicrotask(() => ctx.setId(id))
  return null
}

export function SelectValue(_: { placeholder?: string }) {
  return null
}

export function SelectContent({ children }: { children?: ReactNode }) {
  return <>{children}</>
}

export function SelectGroup({ children }: { children?: ReactNode }) {
  return <>{children}</>
}

export function SelectLabel({ children }: { children?: ReactNode }) {
  return <>{children}</>
}

export function SelectSeparator() {
  return null
}

export function SelectScrollUpButton() {
  return null
}

export function SelectScrollDownButton() {
  return null
}

export function SelectItem({ value, children, disabled }: { value: string; children?: ReactNode; disabled?: boolean }) {
  return (
    <option value={value} disabled={disabled}>
      {typeof children === "string" || typeof children === "number" ? children : value}
    </option>
  )
}
