"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";

export type SettingType = "toggle" | "radio" | "slider";

export interface ToggleSetting {
  name: string;
  type: "toggle";
  value: boolean;
  auto: boolean;
  info?: string;
}

export interface RadioSetting {
  name: string;
  type: "radio";
  value: number;
  auto: number;
  options: string[];
  customOption?: boolean;
  customOptionValue?: string;
  info?: string;
}

export interface SliderSetting {
  name: string;
  type: "slider";
  value: number;
  auto: number;
  min: number;
  max: number;
  step: number;
  hue?: boolean;
  info?: string;
}

export type Setting = ToggleSetting | RadioSetting | SliderSetting;

export interface Settings {
  debateStyle: RadioSetting;
  colorTheme: RadioSetting;
  columnWidth: SliderSetting;
  accentHue: SliderSetting;
  accentSecondaryHue: SliderSetting;
  transitionSpeed: SliderSetting;
  fontSize: SliderSetting;
  fontWeight: SliderSetting;
  fontWeightBold: SliderSetting;
  fontFamily: RadioSetting;
  buttonSize: SliderSetting;
  lineWidth: SliderSetting;
  borderRadius: SliderSetting;
  padding: SliderSetting;
  gap: SliderSetting;
  sidebarWidth: SliderSetting;
  showUndoRedoButtons: ToggleSetting;
  showBoxCreationButtons: ToggleSetting;
  showBoxFormatButtons: ToggleSetting;
}

const defaultSettings: Settings = {
  debateStyle: {
    name: "Debate style",
    type: "radio",
    value: 0,
    auto: 0,
    options: [
      "Policy",
      "Public Forum",
      "Lincoln Douglas",
      "Congress",
      "College Policy",
      "World Schools",
      "Big Questions",
      "NOF SPAR",
      "Parli",
    ],
    info: "Already created flows won't be affected by this setting",
  },
  colorTheme: {
    name: "Color theme",
    type: "radio",
    value: 0,
    auto: 0,
    options: ["System default", "Light theme", "Dark theme"],
  },
  columnWidth: {
    name: "Column width",
    type: "slider",
    value: 150,
    auto: 150,
    min: 50,
    max: 300,
    step: 1,
  },
  accentHue: {
    name: "Primary color hue",
    type: "slider",
    value: 192,
    auto: 192,
    min: 0,
    max: 360,
    step: 1,
    hue: true,
    info: "This color will be used for aff",
  },
  accentSecondaryHue: {
    name: "Secondary color hue",
    type: "slider",
    value: 26,
    auto: 26,
    min: 0,
    max: 360,
    step: 1,
    hue: true,
    info: "This color will be used for neg",
  },
  transitionSpeed: {
    name: "Transition duration",
    type: "slider",
    value: 300,
    auto: 300,
    min: 0,
    max: 1000,
    step: 1,
  },
  fontSize: {
    name: "Font size",
    type: "slider",
    value: 0.9,
    auto: 0.9,
    min: 0.2,
    max: 2,
    step: 0.01,
  },
  fontWeight: {
    name: "Font weight",
    type: "slider",
    value: 300,
    auto: 300,
    min: 100,
    max: 900,
    step: 50,
  },
  fontWeightBold: {
    name: "Font weight bold",
    type: "slider",
    value: 700,
    auto: 700,
    min: 100,
    max: 900,
    step: 50,
  },
  fontFamily: {
    name: "Font",
    type: "radio",
    value: 0,
    auto: 0,
    options: ["Merriweather Sans", "Helvetica", "Georgia", "Courier New"],
    customOption: true,
    customOptionValue: "",
    info: "Type in a custom font name if it is installed on your computer",
  },
  buttonSize: {
    name: "Button size",
    type: "slider",
    value: 20,
    auto: 20,
    min: 10,
    max: 50,
    step: 1,
  },
  lineWidth: {
    name: "Line width",
    type: "slider",
    value: 4,
    auto: 4,
    min: 0,
    max: 8,
    step: 1,
  },
  borderRadius: {
    name: "Border radius",
    type: "slider",
    value: 8,
    auto: 8,
    min: 0,
    max: 30,
    step: 1,
  },
  padding: {
    name: "Padding",
    type: "slider",
    value: 8,
    auto: 8,
    min: 0,
    max: 30,
    step: 1,
  },
  gap: {
    name: "Grid gap",
    type: "slider",
    value: 8,
    auto: 8,
    min: 0,
    max: 30,
    step: 1,
  },
  sidebarWidth: {
    name: "Sidebar width",
    type: "slider",
    value: 184,
    auto: 184,
    min: 50,
    max: 500,
    step: 1,
  },
  showUndoRedoButtons: {
    name: "Undo/redo buttons",
    type: "toggle",
    value: true,
    auto: true,
  },
  showBoxCreationButtons: {
    name: "Cell creation/deletion buttons",
    type: "toggle",
    value: true,
    auto: true,
  },
  showBoxFormatButtons: {
    name: "Cell format buttons",
    type: "toggle",
    value: true,
    auto: true,
  },
};

interface SettingsContextType {
  settings: Settings;
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]["value"]) => void;
  resetToDefaults: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);

  // Load settings from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("flowSettings");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSettings((prev) => ({ ...prev, ...parsed }));
      } catch (e) {
        console.error("Failed to load settings:", e);
      }
    }
  }, []);

  // Save settings to localStorage when they change
  useEffect(() => {
    localStorage.setItem("flowSettings", JSON.stringify(settings));
  }, [settings]);

  const setSetting = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]["value"]) => {
    setSettings((prev) => ({
      ...prev,
      [key]: { ...prev[key], value },
    }));
  }, []);

  const resetToDefaults = useCallback(() => {
    setSettings(defaultSettings);
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, setSetting, resetToDefaults }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}

export const settingsGroups = [
  {
    name: "General",
    settings: ["debateStyle"],
  },
  {
    name: "Appearance",
    settings: ["columnWidth", "accentHue", "accentSecondaryHue"],
  },
  {
    name: "Font",
    settings: ["fontFamily", "fontSize"],
  },
];
