export class Settings {
  data: { [key: string]: Setting };
  callbacks: { [key: string]: ((key: string) => void)[] } = { any: [] };

  constructor(settings: { [key: string]: Setting }) {
    this.data = settings;
  }

  init() {
    this.loadFromLocalStorage();
  }

  setValue(key: string, value: boolean | number): void {
    this.data[key].value = value;
    if (this.callbacks[key]) {
      for (const callback of this.callbacks[key]) {
        callback(key);
      }
    }
    for (const callback of this.callbacks.any) {
      callback(key);
    }
  }

  subscribe(keys: string[], callback: (key: string) => void): () => void {
    for (const key of keys) {
      if (!this.callbacks[key]) {
        this.callbacks[key] = [];
      }
      this.callbacks[key].push(callback);
      callback(key);
    }
    return () => {
      for (const key of keys) {
        this.callbacks[key] = this.callbacks[key].filter(
          (el) => el !== callback,
        );
      }
    };
  }

  saveToLocalStorage() {
    const jsonData: { [key: string]: number | boolean | string } = {};
    for (const key of Object.keys(this.data)) {
      if (this.data[key].value !== this.data[key].auto) {
        jsonData[key] = this.data[key].value;
        if (this.data[key].type === "radio") {
          const setting = this.data[key] as RadioSetting;
          if (setting.detail.customOptionValue) {
            jsonData[key + "Custom"] = setting.detail.customOptionValue;
          }
        }
      }
    }
    localStorage.setItem("settings", JSON.stringify(jsonData));
  }

  loadFromLocalStorage() {
    const settingsObj = localStorage.getItem("settings");
    if (settingsObj) {
      const jsonData = JSON.parse(settingsObj);
      try {
        for (const key in jsonData) {
          if (this.data[key] == null) return;
          if (this.data[key].type === "radio") {
            const setting = this.data[key] as RadioSetting;
            if (jsonData[key + "Custom"]) {
              setting.detail.customOptionValue = jsonData[key + "Custom"];
            }
          }
          this.setValue(key, jsonData[key]);
        }
      } catch (e) {
        console.log(e);
        localStorage.setItem("settings", JSON.stringify({}));
        this.resetToAuto();
      }
    }
  }

  resetToAuto() {
    for (const key in this.data) {
      this.setValue(key, this.data[key].auto);
    }
  }
}

export const settings = new Settings({
  debateStyle: {
    name: "Debate style",
    type: "radio",
    value: 0,
    auto: 0,
    detail: {
      options: [
        "Public Forum",
        "Lincoln Douglas", //1
        "Policy",
        "College Policy",
        "Congress",
        "World Schools", //3
        "Big Questions",
        "NOF SPAR", //1
        "Parlimentary",
      ],
    },
    info: "Already created flows won't be affected by this setting",
  },
  fontSize: {
    name: "Font size",
    type: "radio",
    value: 14,
    auto: 14,
    detail: {
      options: ["12px", "13px", "14px", "15px", "16px", "18px", "20px"],
    },
  },
});

export const settingsGroups = [
  { name: "General", settings: ["debateStyle", "fontSize"] },
];
