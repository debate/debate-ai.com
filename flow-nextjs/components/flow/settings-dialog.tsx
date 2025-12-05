"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Settings as SettingsIcon, RotateCcw } from "lucide-react";
import { useSettings } from "@/contexts/settings-context";
import { cn } from "@/lib/utils";

interface SettingsDialogProps {
  trigger?: React.ReactNode;
}

export function SettingsDialog({ trigger }: SettingsDialogProps) {
  const { settings, updateSetting, resetSetting, resetAllSettings } = useSettings();

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="icon">
            <SettingsIcon className="h-5 w-5" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Flow Settings</DialogTitle>
          <DialogDescription>
            Customize your Flow experience. Changes are saved automatically.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[60vh] pr-4">
          <div className="space-y-6">
            {/* Debate Style */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <Label>{settings.debateStyle.name}</Label>
                  {settings.debateStyle.info && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {settings.debateStyle.info}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => resetSetting("debateStyle")}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
              <RadioGroup
                value={settings.debateStyle.value.toString()}
                onValueChange={(value) =>
                  updateSetting("debateStyle", parseInt(value))
                }
              >
                {settings.debateStyle.options.map((option, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <RadioGroupItem value={index.toString()} id={`debate-${index}`} />
                    <Label htmlFor={`debate-${index}`} className="cursor-pointer">
                      {option}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <Separator />

            {/* Color Theme */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{settings.colorTheme.name}</Label>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => resetSetting("colorTheme")}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
              <RadioGroup
                value={settings.colorTheme.value.toString()}
                onValueChange={(value) =>
                  updateSetting("colorTheme", parseInt(value))
                }
              >
                {settings.colorTheme.options.map((option, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <RadioGroupItem value={index.toString()} id={`theme-${index}`} />
                    <Label htmlFor={`theme-${index}`} className="cursor-pointer">
                      {option}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <Separator />

            {/* Font Family */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{settings.fontFamily.name}</Label>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => resetSetting("fontFamily")}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
              <RadioGroup
                value={settings.fontFamily.value.toString()}
                onValueChange={(value) =>
                  updateSetting("fontFamily", parseInt(value))
                }
              >
                {settings.fontFamily.options.map((option, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <RadioGroupItem value={index.toString()} id={`font-${index}`} />
                    <Label htmlFor={`font-${index}`} className="cursor-pointer">
                      {option}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <Separator />

            {/* Slider Settings */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Layout & Appearance</h3>

              {/* Column Width */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{settings.columnWidth.name}</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {settings.columnWidth.value}px
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => resetSetting("columnWidth")}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Slider
                  value={[settings.columnWidth.value]}
                  onValueChange={(value) => updateSetting("columnWidth", value[0])}
                  min={settings.columnWidth.min}
                  max={settings.columnWidth.max}
                  step={settings.columnWidth.step}
                />
              </div>

              {/* Primary Color Hue */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{settings.accentHue.name}</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {settings.accentHue.value}°
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => resetSetting("accentHue")}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Slider
                  value={[settings.accentHue.value]}
                  onValueChange={(value) => updateSetting("accentHue", value[0])}
                  min={settings.accentHue.min}
                  max={settings.accentHue.max}
                  step={settings.accentHue.step}
                />
              </div>

              {/* Secondary Color Hue */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{settings.accentSecondaryHue.name}</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {settings.accentSecondaryHue.value}°
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => resetSetting("accentSecondaryHue")}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Slider
                  value={[settings.accentSecondaryHue.value]}
                  onValueChange={(value) => updateSetting("accentSecondaryHue", value[0])}
                  min={settings.accentSecondaryHue.min}
                  max={settings.accentSecondaryHue.max}
                  step={settings.accentSecondaryHue.step}
                />
              </div>

              {/* Transition Speed */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{settings.transitionSpeed.name}</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {settings.transitionSpeed.value}ms
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => resetSetting("transitionSpeed")}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Slider
                  value={[settings.transitionSpeed.value]}
                  onValueChange={(value) => updateSetting("transitionSpeed", value[0])}
                  min={settings.transitionSpeed.min}
                  max={settings.transitionSpeed.max}
                  step={settings.transitionSpeed.step}
                />
              </div>

              {/* Font Size */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{settings.fontSize.name}</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {settings.fontSize.value}px
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => resetSetting("fontSize")}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Slider
                  value={[settings.fontSize.value]}
                  onValueChange={(value) => updateSetting("fontSize", value[0])}
                  min={settings.fontSize.min}
                  max={settings.fontSize.max}
                  step={settings.fontSize.step}
                />
              </div>

              {/* Font Weight */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{settings.fontWeight.name}</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {settings.fontWeight.value}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => resetSetting("fontWeight")}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Slider
                  value={[settings.fontWeight.value]}
                  onValueChange={(value) => updateSetting("fontWeight", value[0])}
                  min={settings.fontWeight.min}
                  max={settings.fontWeight.max}
                  step={settings.fontWeight.step}
                />
              </div>

              {/* Font Weight Bold */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{settings.fontWeightBold.name}</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {settings.fontWeightBold.value}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => resetSetting("fontWeightBold")}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Slider
                  value={[settings.fontWeightBold.value]}
                  onValueChange={(value) => updateSetting("fontWeightBold", value[0])}
                  min={settings.fontWeightBold.min}
                  max={settings.fontWeightBold.max}
                  step={settings.fontWeightBold.step}
                />
              </div>

              {/* Button Size */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{settings.buttonSize.name}</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {settings.buttonSize.value}px
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => resetSetting("buttonSize")}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Slider
                  value={[settings.buttonSize.value]}
                  onValueChange={(value) => updateSetting("buttonSize", value[0])}
                  min={settings.buttonSize.min}
                  max={settings.buttonSize.max}
                  step={settings.buttonSize.step}
                />
              </div>

              {/* Line Width */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{settings.lineWidth.name}</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {settings.lineWidth.value}px
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => resetSetting("lineWidth")}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Slider
                  value={[settings.lineWidth.value]}
                  onValueChange={(value) => updateSetting("lineWidth", value[0])}
                  min={settings.lineWidth.min}
                  max={settings.lineWidth.max}
                  step={settings.lineWidth.step}
                />
              </div>

              {/* Border Radius */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{settings.borderRadius.name}</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {settings.borderRadius.value}px
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => resetSetting("borderRadius")}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Slider
                  value={[settings.borderRadius.value]}
                  onValueChange={(value) => updateSetting("borderRadius", value[0])}
                  min={settings.borderRadius.min}
                  max={settings.borderRadius.max}
                  step={settings.borderRadius.step}
                />
              </div>

              {/* Padding */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{settings.padding.name}</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {settings.padding.value}px
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => resetSetting("padding")}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Slider
                  value={[settings.padding.value]}
                  onValueChange={(value) => updateSetting("padding", value[0])}
                  min={settings.padding.min}
                  max={settings.padding.max}
                  step={settings.padding.step}
                />
              </div>

              {/* Gap */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{settings.gap.name}</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {settings.gap.value}px
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => resetSetting("gap")}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Slider
                  value={[settings.gap.value]}
                  onValueChange={(value) => updateSetting("gap", value[0])}
                  min={settings.gap.min}
                  max={settings.gap.max}
                  step={settings.gap.step}
                />
              </div>

              {/* Sidebar Width */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{settings.sidebarWidth.name}</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {settings.sidebarWidth.value}px
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => resetSetting("sidebarWidth")}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Slider
                  value={[settings.sidebarWidth.value]}
                  onValueChange={(value) => updateSetting("sidebarWidth", value[0])}
                  min={settings.sidebarWidth.min}
                  max={settings.sidebarWidth.max}
                  step={settings.sidebarWidth.step}
                />
              </div>
            </div>

            <Separator />

            {/* Toggle Settings */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">UI Preferences</h3>

              {/* Show Undo/Redo Buttons */}
              <div className="flex items-center justify-between">
                <Label htmlFor="show-undo-redo">{settings.showUndoRedoButtons.name}</Label>
                <Switch
                  id="show-undo-redo"
                  checked={settings.showUndoRedoButtons.value}
                  onCheckedChange={(checked) =>
                    updateSetting("showUndoRedoButtons", checked)
                  }
                />
              </div>

              {/* Show Box Creation Buttons */}
              <div className="flex items-center justify-between">
                <Label htmlFor="show-box-creation">
                  {settings.showBoxCreationButtons.name}
                </Label>
                <Switch
                  id="show-box-creation"
                  checked={settings.showBoxCreationButtons.value}
                  onCheckedChange={(checked) =>
                    updateSetting("showBoxCreationButtons", checked)
                  }
                />
              </div>

              {/* Show Box Format Buttons */}
              <div className="flex items-center justify-between">
                <Label htmlFor="show-box-format">
                  {settings.showBoxFormatButtons.name}
                </Label>
                <Switch
                  id="show-box-format"
                  checked={settings.showBoxFormatButtons.value}
                  onCheckedChange={(checked) =>
                    updateSetting("showBoxFormatButtons", checked)
                  }
                />
              </div>
            </div>

            <Separator />

            {/* Reset All Button */}
            <div className="flex justify-end">
              <Button variant="outline" onClick={resetAllSettings}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset All Settings
              </Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
