#!/usr/bin/env python3
"""Encode mp3 files to base64 and print JS object entries."""
import base64
from pathlib import Path

files = {
    "finalBwong": "final-bwong.mp3",
    "popDown": "sound-pop-down.mp3",
    "popUpOff": "sound-pop-up-off.mp3",
    "popUpOn": "sound-pop-up-on.mp3",
}

dir = Path(__file__).parent

for key, filename in files.items():
    data = (dir / filename).read_bytes()
    b64 = base64.b64encode(data).decode()
    print(f'  {key}:\n    "{b64}",')
