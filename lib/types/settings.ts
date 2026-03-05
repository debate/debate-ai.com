export type SettingBasic<T> = {
    name: string;
    value: T;
    auto: T;
    type: string;
    info?: string;
};

export type ToggleSetting = SettingBasic<boolean> & {
    type: "toggle";
};

export type RadioSetting = SettingBasic<number> & {
    type: "radio";
    detail: {
        options: string[];
        customOption?: boolean;
        customOptionValue?: string;
    };
};

export type SliderSetting = SettingBasic<number> & {
    type: "slider";
    detail: {
        min: number;
        max: number;
        step: number;
        hue?: boolean;
    };
};

export type Setting = ToggleSetting | RadioSetting | SliderSetting;
