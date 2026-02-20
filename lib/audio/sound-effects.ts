/**
 * Sound effects utility for playing audio cues
 */

const soundEffects = {
  finalBeep: "/audio/final-bwong.mp3",
} as const

type SoundEffectName = keyof typeof soundEffects

/**
 * Play a sound effect by name
 */
export function playSoundEffect(name: SoundEffectName, volume = 0.5): void {
  if (typeof window === "undefined") return

  const audio = new Audio(soundEffects[name])
  audio.volume = volume
  audio.play().catch(() => {
    // Ignore autoplay errors
  })
}
