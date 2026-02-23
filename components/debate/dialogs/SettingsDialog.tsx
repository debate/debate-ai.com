"use client"

/**
 * @fileoverview Settings Dialog Component
 *
 * Application settings dialog for configuring debate flow preferences.
 * Supports multiple setting types:
 * - Toggle switches for boolean settings
 * - Sliders for numeric range settings
 * - Radio buttons/dropdowns for option selection
 * - Custom text input for radio settings with customOption
 *
 * Settings are organized into groups and persisted to localStorage.
 *
 * @module components/debate/dialogs/SettingsDialog
 */

import { useState, useEffect } from "react"
import { settings, settingsGroups } from "@/lib/state/settings"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

/**
 * Props for the SettingsDialog component
 */
interface SettingsDialogProps {
  /** Whether the dialog is open */
  open: boolean
  /** Callback to change dialog open state */
  onOpenChange: (open: boolean) => void
}

/**
 * SettingsDialog - Application settings configuration
 *
 * Renders a form with all available settings organized by group.
 * Supports toggle, slider, and radio setting types with real-time
 * updates and localStorage persistence.
 *
 * @param props - Component props
 * @param props.open - Whether the dialog is open
 * @param props.onOpenChange - Callback to change dialog open state
 * @returns The settings dialog component
 *
 * @example
 * ```tsx
 * <SettingsDialog
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 * />
 * ```
 */
export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [settingsData, setSettingsData] = useState(settings.data)

  /**
   * Subscribe to settings changes to keep UI in sync.
   */
  useEffect(() => {
    const unsubscribe = settings.subscribe(Object.keys(settings.data), () => {
      setSettingsData({ ...settings.data })
    })
    return unsubscribe
  }, [])

  /**
   * Handle slider value changes and persist to localStorage.
   *
   * @param key - Setting key identifying which setting to update
   * @param value - New value array from the slider component
   */
  const handleSliderChange = (key: string, value: number[]) => {
    settings.setValue(key, value[0])
    settings.saveToLocalStorage()
  }

  /**
   * Handle toggle switch changes and persist to localStorage.
   *
   * @param key - Setting key identifying which setting to update
   * @param checked - New boolean value from the switch component
   */
  const handleToggleChange = (key: string, checked: boolean) => {
    settings.setValue(key, checked)
    settings.saveToLocalStorage()
  }

  /**
   * Handle radio button or select changes and persist to localStorage.
   *
   * @param key - Setting key identifying which setting to update
   * @param value - New option index as a string from the radio/select component
   */
  const handleRadioChange = (key: string, value: string) => {
    const index = Number.parseInt(value)
    settings.setValue(key, index)
    settings.saveToLocalStorage()
  }

  /**
   * Handle custom option text changes for radio settings that support free-form input.
   *
   * @param key - Setting key identifying which radio setting to update
   * @param value - Custom text value entered by the user
   */
  const handleCustomOptionChange = (key: string, value: string) => {
    const setting = settings.data[key] as RadioSetting
    if (setting.type === "radio" && setting.detail.customOption) {
      setting.detail.customOptionValue = value
      settings.saveToLocalStorage()
      setSettingsData({ ...settings.data })
    }
  }

  /**
   * Reset all settings to their default values and persist to localStorage.
   */
  const resetToDefaults = () => {
    settings.resetToAuto()
    settings.saveToLocalStorage()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Render settings by group */}
          {settingsGroups.map((group) => (
            <div key={group.name} className="space-y-4">
              <h3 className="text-lg font-semibold">{group.name}</h3>

              {group.settings.map((key) => {
                const setting = settingsData[key]

                // Skip debateStyle (handled in round dialog)
                if (key === "debateStyle") {
                  return null
                }

                // Render toggle settings
                if (setting.type === "toggle") {
                  return (
                    <div key={key} className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor={key}>{setting.name}</Label>
                        {setting.info && <p className="text-sm text-muted-foreground">{setting.info}</p>}
                      </div>
                      <Switch
                        id={key}
                        checked={setting.value as boolean}
                        onCheckedChange={(checked) => handleToggleChange(key, checked)}
                      />
                    </div>
                  )
                }

                // Render slider settings
                if (setting.type === "slider") {
                  const sliderSetting = setting as SliderSetting
                  return (
                    <div key={key} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor={key}>{setting.name}</Label>
                        <span className="text-sm text-muted-foreground">{sliderSetting.value}</span>
                      </div>
                      {setting.info && <p className="text-sm text-muted-foreground">{setting.info}</p>}
                      <Slider
                        id={key}
                        min={sliderSetting.detail.min}
                        max={sliderSetting.detail.max}
                        step={sliderSetting.detail.step}
                        value={[sliderSetting.value]}
                        onValueChange={(value: number[]) => handleSliderChange(key, value)}
                        className={sliderSetting.detail.hue ? "hue-slider" : ""}
                      />
                    </div>
                  )
                }

                // Render radio settings
                if (setting.type === "radio") {
                  const radioSetting = setting as RadioSetting

                  // Use Select dropdown for fontSize
                  if (key === "fontSize") {
                    return (
                      <div key={key} className="space-y-2">
                        <Label htmlFor={key}>{setting.name}</Label>
                        {setting.info && <p className="text-sm text-muted-foreground">{setting.info}</p>}
                        <Select
                          value={radioSetting.value.toString()}
                          onValueChange={(value: string) => handleRadioChange(key, value)}
                        >
                          <SelectTrigger id={key} className="w-full">
                            <SelectValue placeholder="Select font size" />
                          </SelectTrigger>
                          <SelectContent>
                            {radioSetting.detail.options.map((option, index) => (
                              <SelectItem key={index} value={index.toString()}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )
                  }

                  // Use RadioGroup for other radio settings
                  return (
                    <div key={key} className="space-y-2">
                      <Label>{setting.name}</Label>
                      {setting.info && <p className="text-sm text-muted-foreground">{setting.info}</p>}
                      <RadioGroup
                        value={radioSetting.value.toString()}
                        onValueChange={(value: string) => handleRadioChange(key, value)}
                      >
                        {radioSetting.detail.options.map((option, index) => (
                          <div key={index} className="flex items-center space-x-2">
                            <RadioGroupItem value={index.toString()} id={`${key}-${index}`} />
                            <Label htmlFor={`${key}-${index}`}>{option}</Label>
                          </div>
                        ))}
                        {/* Custom option input if enabled */}
                        {radioSetting.detail.customOption && (
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem
                              value={radioSetting.detail.options.length.toString()}
                              id={`${key}-custom`}
                            />
                            <Label htmlFor={`${key}-custom`}>Custom:</Label>
                            <Input
                              value={radioSetting.detail.customOptionValue || ""}
                              onChange={(e) => handleCustomOptionChange(key, e.target.value)}
                              placeholder="Enter custom value"
                              className="flex-1"
                            />
                          </div>
                        )}
                      </RadioGroup>
                    </div>
                  )
                }

                return null
              })}
            </div>
          ))}

          {/* Reset button */}
          <div className="pt-4 border-t">
            <Button onClick={resetToDefaults} variant="outline" className="w-full bg-transparent">
              Reset to Defaults
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
