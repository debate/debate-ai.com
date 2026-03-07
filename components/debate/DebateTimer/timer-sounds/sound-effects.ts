type SoundEffect = "finalBeep"

export function playSoundEffect(effect: SoundEffect): void {
  const src = effect === "finalBeep" ? "/audio/final-bwong.mp3" : null
  if (!src) return
  try {
    const audio = new Audio(src)
    audio.play().catch(() => {})
  } catch {
    // Ignore errors (e.g. SSR or blocked autoplay)
  }
}
