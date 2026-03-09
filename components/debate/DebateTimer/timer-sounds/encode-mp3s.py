#!/usr/bin/env python3
"""Encode mp3 files to base64 and write sound-data.ts + sound-effects.ts."""
import base64
import re
from pathlib import Path

all_sounds = {
    "boop": None,
    "buzz": None,
    "bounce": None,
    "shutter": None,
    "bloop": None,
    "finalBwong": "final-bwong.mp3",
    "popDown": "sound-pop-down.mp3",
    "popUpOff": "sound-pop-up-off.mp3",
    "popUpOn": "sound-pop-up-on.mp3",
}

dir = Path(__file__).parent
ts_file = dir / "sound-effects.ts"
data_file = dir / "sound-data.ts"

# Parse existing base64 values from the current TS file
ts_content = ts_file.read_text()
existing = {}
for m in re.finditer(r'(\w+)Data\s*=\s*\n?\s*"([A-Za-z0-9+/=]+)"', ts_content):
    existing[m.group(1)] = m.group(2)

sound_names = list(all_sounds.keys())

# --- Write sound-data.ts ---
data_lines = []
for key in sound_names:
    if all_sounds[key]:
        data = (dir / all_sounds[key]).read_bytes()
        b64 = base64.b64encode(data).decode()
    else:
        b64 = existing[key]
    data_lines.append(f"export const {key} =")
    data_lines.append(f'  "{b64}";')
    data_lines.append("")

data_file.write_text("\n".join(data_lines))

# --- Write sound-effects.ts ---
ts_lines = []
ts_lines.append('import * as sounds from "./sound-data";')
ts_lines.append("")

# Type
ts_lines.append("export type SoundEffect =")
for i, name in enumerate(sound_names):
    sep = ";" if i == len(sound_names) - 1 else ""
    ts_lines.append(f'  | "{name}"{sep}')
ts_lines.append("")

# Function
ts_lines.append("/**")
ts_lines.append(" * Play sound effect to enhance UI interactions")
ts_lines.append(" * @param {SoundEffect} effectName - name of sound effect")
ts_lines.append(" */")
ts_lines.append("export function playSoundEffect(effectName: SoundEffect) {")
ts_lines.append('  if (typeof Audio === "undefined") return { error: "Could not play sound" };')
ts_lines.append("  try {")
ts_lines.append("    void new Audio(")
ts_lines.append('      "data:audio/mp3;base64," + sounds[effectName],')
ts_lines.append("    ).play();")
ts_lines.append("  } catch (e: any) {")
ts_lines.append("    return { error: e.message };")
ts_lines.append("  }")
ts_lines.append("  return { error: false };")
ts_lines.append("}")
ts_lines.append("")

ts_file.write_text("\n".join(ts_lines))
print(f"Done — wrote {len(sound_names)} exports to sound-data.ts and updated sound-effects.ts")
