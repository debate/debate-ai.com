/** @fileoverview Settings-panel types for the round workspace. */

/** Shared fields of every setting in the round workspace's settings panel. */
export type SettingBasic<T> = {
  /** Label shown beside the control. */
  name: string;
  /** The value the user has chosen. */
  value: T;
  /** The value used when the user has not chosen one. */
  auto: T;
  /** Which control renders the setting: "toggle", "radio" or "slider". */
  type: string;
  /** Help text shown under the label. */
  info?: string;
};

/** An on/off setting. */
export type ToggleSetting = SettingBasic<boolean> & {
  type: "toggle";
};

/** A pick-one setting; `value` is the index of the chosen option. */
export type RadioSetting = SettingBasic<number> & {
  type: "radio";
  /** The options the control offers. */
  detail: {
    /** Option labels, in display order. */
    options: string[];
    /** True when the user may type their own option. */
    customOption?: boolean;
    /** The text of the user's own option, when they typed one. */
    customOptionValue?: string;
  };
};

/** A numeric range setting. */
export type SliderSetting = SettingBasic<number> & {
  type: "slider";
  /** The range the slider covers. */
  detail: {
    /** Lowest value. */
    min: number;
    /** Highest value. */
    max: number;
    /** Distance between selectable values. */
    step: number;
    /** True when the slider picks a colour hue rather than a plain number. */
    hue?: boolean;
  };
};

/** Any one setting. */
export type Setting = ToggleSetting | RadioSetting | SliderSetting;
