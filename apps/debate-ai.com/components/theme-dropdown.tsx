/**
 * @fileoverview Theme dropdown component for selecting colour themes and toggling
 * light/dark mode. Persists selections to localStorage and a cookie, and applies
 * theme CSS classes to the document root. When signed in, also syncs the
 * selection to the account via `/api/settings` (TODO.md idea #17, follow-up
 * (2)) so it follows the user to another device, falling back to the
 * local-only behavior below when signed out.
 */

"use client"

import { useState, useEffect, useRef } from "react"
import { Moon, Sun } from "lucide-react"
import Image from "next/image"
import { Button } from "../lib/ui/primitives/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../lib/ui/primitives/dropdown-menu"
import { useTheme } from "next-themes"
import { IconThemePantone } from "../lib/ui/icons"
import {
  THEME_NAMES,
  isValidColorTheme,
  isValidThemeMode,
  fetchUserSettings,
  saveUserSettings,
  type ThemeMode,
} from "debate-round"

/** Registry of all available colour theme names — re-exported from `debate-round`'s `THEME_NAMES`, the same list `/api/settings` validates against. */
export const themeNames: readonly string[] = THEME_NAMES

/**
 * Map of theme names to their representative primary and secondary colour swatches
 * used in the dropdown preview dots.
 */
export const themeColors: Record<string, { primary: string; secondary: string }> = {
  "modern-minimal": { primary: "#3b82f6", secondary: "#f3f4f6" },
  "elegant-luxury": { primary: "#9b2c2c", secondary: "#fdf2d6" },
  cyberpunk: { primary: "#ff00c8", secondary: "#f0f0ff" },
  twitter: { primary: "#1e9df1", secondary: "#0f1419" },
  "mocha-mousse": { primary: "#A37764", secondary: "#BAAB92" },
  bubblegum: { primary: "#d04f99", secondary: "#8acfd1" },
  "amethyst-haze": { primary: "#8a79ab", secondary: "#dfd9ec" },
  "pink-lemonade": { primary: "#a84370", secondary: "#f1c4e6" },
  notebook: { primary: "#606060", secondary: "#dedede" },
  "doom-64": { primary: "#b71c1c", secondary: "#556b2f" },
  catppuccin: { primary: "#8839ef", secondary: "#ccd0da" },
  graphite: { primary: "#606060", secondary: "#e0e0e0" },
  perpetuity: { primary: "#06858e", secondary: "#d9eaea" },
  "kodama-grove": { primary: "#8d9d4f", secondary: "#decea0" },
  "cosmic-night": { primary: "#6e56cf", secondary: "#e4dfff" },
  tangerine: { primary: "#e05d38", secondary: "#f3f4f6" },
  "quantum-rose": { primary: "#e6067a", secondary: "#ffd6ff" },
  nature: { primary: "#2e7d32", secondary: "#e8f5e9" },
  "bold-tech": { primary: "#8b5cf6", secondary: "#f3f0ff" },
  "amber-minimal": { primary: "#f59e0b", secondary: "#f3f4f6" },
  supabase: { primary: "#72e3ad", secondary: "#fdfdfd" },
  "neo-brutalism": { primary: "#ff3333", secondary: "#ffff00" },
  "solar-dusk": { primary: "#B45309", secondary: "#E4C090" },
  claymorphism: { primary: "#6366f1", secondary: "#d6d3d1" },
  "pastel-dreams": { primary: "#a78bfa", secondary: "#e9d8fd" },
}

export function formatThemeName(name: string) {
  return name
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

/**
 * Hook that provides theme state and handlers for use in custom UI.
 */
export function useThemeState() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [colorTheme, setColorTheme] = useState("modern-minimal")
  const [mounted, setMounted] = useState(false)
  const [previewTheme, setPreviewTheme] = useState<string | null>(null)
  // Whether `/api/settings` resolved (i.e. the user is signed in) rather than
  // 401ing, so change handlers below know whether a sync push is worth
  // attempting instead of firing a doomed request on every theme change.
  const remoteAvailable = useRef(false)

  const applyColorTheme = (newTheme: string) => {
    themeNames.forEach((t) => document.documentElement.classList.remove(`theme-${t}`))
    document.documentElement.classList.add(`theme-${newTheme}`)
  }

  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem("color-theme")
    if (saved && themeNames.includes(saved)) {
      setColorTheme(saved)
      applyColorTheme(saved)
    } else {
      document.documentElement.classList.add("theme-modern-minimal")
    }

    let cancelled = false
    fetchUserSettings()
      .then((remote) => {
        if (cancelled || !remote) return
        remoteAvailable.current = true
        if (isValidColorTheme(remote.colorTheme) && remote.colorTheme !== (saved ?? "modern-minimal")) {
          setColorTheme(remote.colorTheme)
          localStorage.setItem("color-theme", remote.colorTheme)
          document.cookie = `color-theme=${remote.colorTheme}; path=/; max-age=31536000`
          applyColorTheme(remote.colorTheme)
        }
        if (isValidThemeMode(remote.themeMode)) {
          setTheme(remote.themeMode)
        }
      })
      .catch(() => {
        // Signed in but the load failed (network/server error) — keep the
        // local-only theme already applied above rather than blocking.
      })

    return () => {
      cancelled = true
    }
  }, [])

  /** Best-effort account sync — never blocks or surfaces an error to the caller, matching `UserSettingsPanel`'s local-first behavior. */
  const syncToAccount = (patch: { colorTheme?: string; themeMode?: ThemeMode }) => {
    if (!remoteAvailable.current) return
    saveUserSettings(patch).catch(() => {
      // Best-effort — the change already applied locally above.
    })
  }

  const handleThemeChange = (newTheme: string) => {
    setColorTheme(newTheme)
    localStorage.setItem("color-theme", newTheme)
    document.cookie = `color-theme=${newTheme}; path=/; max-age=31536000`
    applyColorTheme(newTheme)
    setPreviewTheme(null)
    syncToAccount({ colorTheme: newTheme })
  }

  const handleThemePreview = (themeName: string) => {
    setPreviewTheme(themeName)
    applyColorTheme(themeName)
  }

  const handlePreviewEnd = () => {
    if (previewTheme) {
      applyColorTheme(colorTheme)
      setPreviewTheme(null)
    }
  }

  const toggleLightDark = () => {
    const currentTheme = resolvedTheme || theme || "light"
    const newTheme = currentTheme === "dark" ? "light" : "dark"
    setTheme(newTheme)
    syncToAccount({ themeMode: newTheme })
  }

  /** Sets light/dark/system mode explicitly (vs. `toggleLightDark`'s light/dark flip) — mirrors the Appearance section pattern. */
  const setMode = (newMode: ThemeMode) => {
    setTheme(newMode)
    syncToAccount({ themeMode: newMode })
  }

  const isDark = (resolvedTheme || theme) === "dark"

  return { colorTheme, mounted, isDark, mode: theme, handleThemeChange, handleThemePreview, handlePreviewEnd, toggleLightDark, setMode }
}

/**
 * Dropdown component for selecting a colour theme and toggling light/dark mode.
 */
export function ThemeDropdown() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [colorTheme, setColorTheme] = useState("modern-minimal")
  const [mounted, setMounted] = useState(false)
  const [previewTheme, setPreviewTheme] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem("color-theme")
    if (saved && themeNames.includes(saved)) {
      setColorTheme(saved)
      themeNames.forEach((t) => document.documentElement.classList.remove(`theme-${t}`))
      document.documentElement.classList.add(`theme-${saved}`)
    } else {
      document.documentElement.classList.add("theme-modern-minimal")
    }
  }, [])

  /**
   * Persists and applies a new colour theme selection.
   * @param newTheme - The theme name to activate.
   */
  const handleThemeChange = (newTheme: string) => {
    setColorTheme(newTheme)
    localStorage.setItem("color-theme", newTheme)
    document.cookie = `color-theme=${newTheme}; path=/; max-age=31536000`

    themeNames.forEach((t) => document.documentElement.classList.remove(`theme-${t}`))
    document.documentElement.classList.add(`theme-${newTheme}`)

    setPreviewTheme(null)
  }

  /**
   * Temporarily applies a theme for hover preview without persisting it.
   * @param themeName - The theme name to preview.
   */
  const handleThemePreview = (themeName: string) => {
    setPreviewTheme(themeName)
    themeNames.forEach((t) => document.documentElement.classList.remove(`theme-${t}`))
    document.documentElement.classList.add(`theme-${themeName}`)
  }

  /** Restores the persisted theme after a preview ends (mouse leave or dropdown close). */
  const handlePreviewEnd = () => {
    if (previewTheme) {
      themeNames.forEach((t) => document.documentElement.classList.remove(`theme-${t}`))
      document.documentElement.classList.add(`theme-${colorTheme}`)
      setPreviewTheme(null)
    }
  }

  /**
   * Converts a kebab-case theme name to Title Case for display.
   * @param name - Kebab-case theme name string.
   * @returns Title-cased display name.
   */
  const formatThemeName = (name: string) => {
    return name
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  }

  /** Toggles between light and dark mode using next-themes. */
  const toggleLightDark = () => {
    const currentTheme = resolvedTheme || theme || "light"
    const newTheme = currentTheme === "dark" ? "light" : "dark"
    setTheme(newTheme)
  }

  if (!mounted) {
    return null
  }

  return (
    <DropdownMenu onOpenChange={(open) => !open && handlePreviewEnd()}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Image src={IconThemePantone} alt="Theme" width={20} height={20} className="h-5 w-5" unoptimized />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="bottom" className="w-56 max-h-[400px] overflow-y-auto">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Theme</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation()
              toggleLightDark()
            }}
          >
            {(resolvedTheme || theme) === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </Button>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="text-xs text-muted-foreground px-2 py-1.5">Current: {formatThemeName(colorTheme)}</div>
        <DropdownMenuSeparator />
        {themeNames.map((themeName) => {
          const colors = themeColors[themeName]
          return (
            <DropdownMenuItem
              key={themeName}
              onClick={() => handleThemeChange(themeName)}
              onMouseEnter={() => handleThemePreview(themeName)}
              onMouseLeave={handlePreviewEnd}
              className={`cursor-pointer ${colorTheme === themeName ? "bg-accent" : ""}`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <div
                      className="w-3 h-3 rounded-full border border-black/10"
                      style={{ backgroundColor: colors.primary }}
                    />
                    <div
                      className="w-3 h-3 rounded-full border border-black/10"
                      style={{ backgroundColor: colors.secondary }}
                    />
                  </div>
                  <span>{formatThemeName(themeName)}</span>
                </div>
                {colorTheme === themeName && <span className="text-xs">✓</span>}
              </div>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
