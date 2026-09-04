/**
 * Guards the port of Go `backend/services/personalities.go` — that every
 * persona the `GetBotPersonality` switch carried survived the conversion,
 * with the ratings and levels the Go source declared.
 */
import { describe, expect, it } from "vitest"
import {
  BOT_PERSONALITIES,
  DEFAULT_BOT_PERSONALITY,
  getBotPersonality,
  listBotPersonalities,
} from "../src/backend/personalities"
import { ALL_BOTS } from "../src/ui/bots"

describe("bot personalities", () => {
  it("carries all thirteen personas from the Go switch", () => {
    expect(listBotPersonalities()).toHaveLength(13)
    expect(Object.keys(BOT_PERSONALITIES)).toContain("Yoda")
    expect(Object.keys(BOT_PERSONALITIES)).toContain("Darth Vader")
  })

  it("keeps every persona's fields populated", () => {
    for (const bot of listBotPersonalities()) {
      expect(bot.name).toBeTruthy()
      expect(bot.tone).toBeTruthy()
      expect(bot.catchphrases.length).toBeGreaterThan(0)
      expect(bot.universeTies.length).toBeGreaterThan(0)
      expect(bot.signatureMoves.length).toBeGreaterThan(0)
      expect(Object.keys(bot.interactionModifiers).length).toBeGreaterThan(0)
      expect(bot.rating).toBeGreaterThan(0)
    }
  })

  it("falls back to the neutral default, reusing the requested name", () => {
    const unknown = getBotPersonality("Nobody At All")
    expect(unknown.name).toBe("Nobody At All")
    expect(unknown.level).toBe(DEFAULT_BOT_PERSONALITY.level)
    expect(unknown.tone).toBe(DEFAULT_BOT_PERSONALITY.tone)
  })

  it("matches the picker's roster on name, level and rating", () => {
    for (const bot of ALL_BOTS) {
      const persona = BOT_PERSONALITIES[bot.name]
      expect(persona, `missing persona for ${bot.name}`).toBeDefined()
      expect(persona.level).toBe(bot.level)
      expect(persona.rating).toBe(bot.rating)
    }
  })
})
