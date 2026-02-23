/**
 * @fileoverview Theme dropdown component for selecting colour themes and toggling
 * light/dark mode. Persists selections to localStorage and a cookie, and applies
 * theme CSS classes to the document root.
 */

"use client"

import { useState, useEffect } from "react"
import { Moon, Sun } from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useTheme } from "next-themes"

/** Registry of all available colour theme names. */
const themeNames = [
  "modern-minimal",
  "elegant-luxury",
  "cyberpunk",
  "twitter",
  "mocha-mousse",
  "amethyst-haze",
  "notebook",
  "doom-64",
  "catppuccin",
  "graphite",
  "perpetuity",
  "kodama-grove",
  "cosmic-night",
  "tangerine",
  "nature",
  "bold-tech",
  "amber-minimal",
  "supabase",
  "neo-brutalism",
  "quantum-rose",
  "solar-dusk",
  "bubblegum",
  "pink-lemonade",
  "claymorphism",
  "pastel-dreams",
]

/**
 * Map of theme names to their representative primary and secondary colour swatches
 * used in the dropdown preview dots.
 */
const themeColors: Record<string, { primary: string; secondary: string }> = {
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

/**
 * Dropdown component for selecting a colour theme and toggling light/dark mode.
 * Applies the chosen theme as a CSS class on `document.documentElement` and
 * persists the selection to localStorage and a one-year cookie.
 * Returns null before the component has mounted (SSR hydration guard).
 * @returns The theme dropdown element, or null while unmounted.
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
      console.log("[v0] Theme mounted:", { saved, classList: document.documentElement.className })
    } else {
      document.documentElement.classList.add("theme-modern-minimal")
      console.log("[v0] Default theme applied:", document.documentElement.className)
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

    console.log("[v0] Theme changed:", { newTheme, classList: document.documentElement.className })

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
    console.log("[v0] Theme preview:", { themeName, classList: document.documentElement.className })
  }

  /** Restores the persisted theme after a preview ends (mouse leave or dropdown close). */
  const handlePreviewEnd = () => {
    if (previewTheme) {
      themeNames.forEach((t) => document.documentElement.classList.remove(`theme-${t}`))
      document.documentElement.classList.add(`theme-${colorTheme}`)
      console.log("[v0] Theme preview ended, restored:", { colorTheme, classList: document.documentElement.className })
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
    console.log("[v0] Toggling theme:", { currentTheme, newTheme })
    setTheme(newTheme)
  }

  if (!mounted) {
    return null
  }

  return (
    <DropdownMenu onOpenChange={(open) => !open && handlePreviewEnd()}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Image src="/icons/icon-theme-pantone.svg" alt="Theme" width={20} height={20} className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 max-h-[400px] overflow-y-auto">
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
