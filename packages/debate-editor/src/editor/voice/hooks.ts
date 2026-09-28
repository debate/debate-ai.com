/** Late-bound entry points so settings UI can open voice flows without
 *  importing the controller (which imports the editor). */
let calibrationOpener: (() => void) | null = null;

export function setVoiceCalibrationOpener(fn: (() => void) | null): void {
  calibrationOpener = fn;
}

/** Open the calibration flow; false when no editor has registered one. */
export function requestVoiceCalibration(): boolean {
  if (!calibrationOpener) return false;
  calibrationOpener();
  return true;
}
