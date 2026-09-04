/**
 * @fileoverview The selectable bot roster — ported from the `allBots` array
 * duplicated across the upstream `frontend/src/Pages/BotSelection.tsx` and
 * `frontend/src/Pages/DebateRoom.tsx`. Upstream kept two copies that had
 * already drifted (only one carried `specialMessage`); this is the single
 * merged copy both ported screens read.
 *
 * Ratings and levels match `backend/services/personalities.go`, so a bot
 * picked here resolves to the same persona server-side.
 *
 * @module ui/bots
 */

/** A bot as the picker shows it. Ported from the upstream `Bot` interface. */
export interface PracticeBot {
  name: string
  level: string
  desc: string
  /** Path under the host app's public dir — see `BOT_AVATAR_BASE_PATH`. */
  avatar: string
  quote: string
  rating: number
  specialMessage: string
}

/**
 * Where the ported avatars live in debate-ai.com's `public/`. Upstream
 * served them from `/images/`, which would collide in a shared app.
 */
export const BOT_AVATAR_BASE_PATH = "/practice-vs-ai"

const avatar = (file: string) => `${BOT_AVATAR_BASE_PATH}/${file}`

/** Difficulty tiers, weakest first — the picker's accordion order. */
export const BOT_LEVELS = ["Easy", "Medium", "Hard", "Expert", "Legends"] as const

export const ALL_BOTS: PracticeBot[] = [
  {
    name: "Rookie Rick",
    level: "Easy",
    desc: "A beginner who stumbles over logic.",
    avatar: avatar("rookie_rick.jpg"),
    quote: "Uh, wait, what's your point again?",
    rating: 1200,
    specialMessage: "Get ready for a charming, underdog performance!",
  },
  {
    name: "Casual Casey",
    level: "Easy",
    desc: "Friendly but not too sharp.",
    avatar: avatar("casual_casey.jpg"),
    quote: "Let's just chill and chat, okay?",
    rating: 1300,
    specialMessage: "Relax and enjoy the laid-back debate vibe!",
  },
  {
    name: "Moderate Mike",
    level: "Medium",
    desc: "Balanced and reasonable.",
    avatar: avatar("moderate_mike.jpg"),
    quote: "I see your side, but here's mine.",
    rating: 1500,
    specialMessage: "A balanced challenge awaits you!",
  },
  {
    name: "Sassy Sarah",
    level: "Medium",
    desc: "Witty with decent arguments.",
    avatar: avatar("sassy_sarah.jpg"),
    quote: "Oh honey, you're in for it now!",
    rating: 1600,
    specialMessage: "Prepare for sass and a bit of spice in the debate!",
  },
  {
    name: "Innovative Iris",
    level: "Medium",
    desc: "A creative thinker",
    avatar: avatar("innovative_iris.jpg"),
    quote: "Fresh ideas fuel productive debates.",
    rating: 1550,
    specialMessage: "Expect creative insights and fresh ideas!",
  },
  {
    name: "Tough Tony",
    level: "Hard",
    desc: "Logical and relentless.",
    avatar: avatar("tough_tony.jpg"),
    quote: "Prove it or step aside.",
    rating: 1700,
    specialMessage: "Brace yourself for a no-nonsense, hard-hitting debate!",
  },
  {
    name: "Expert Emma",
    level: "Hard",
    desc: "Master of evidence and rhetoric.",
    avatar: avatar("expert_emma.jpg"),
    quote: "Facts don't care about your feelings.",
    rating: 1800,
    specialMessage: "Expert-level debate incoming – sharpen your wit!",
  },
  {
    name: "Grand Greg",
    level: "Expert",
    desc: "Unbeatable debate titan.",
    avatar: avatar("grand_greg.jpg"),
    quote: "Checkmate. Your move.",
    rating: 2000,
    specialMessage: "A legendary showdown is about to begin!",
  },
  {
    name: "Yoda",
    level: "Legends",
    desc: "Wise, cryptic, and patient. Speaks in riddles.",
    avatar: avatar("yoda.jpeg"),
    quote:
      "Hmm, strong your point is. But ask yourself, does the tree fall because it wills, or because the wind commands?",
    rating: 2400,
    specialMessage: "Prepare for wisdom wrapped in riddles!",
  },
  {
    name: "Tony Stark",
    level: "Legends",
    desc: "Witty, arrogant, and clever. Loves quick comebacks.",
    avatar: avatar("tony.webp"),
    quote:
      "Nice try, but your logic's running on fumes. Step aside, I'll show you how a genius does it.",
    rating: 2200,
    specialMessage: "Get ready for sharp wit and genius banter!",
  },
  {
    name: "Professor Dumbledore",
    level: "Legends",
    desc: "Calm, strategic, and insightful. Sees the bigger picture.",
    avatar: avatar("dumbledore.avif"),
    quote:
      "A valid point, but have you considered its ripple effects? Let us explore the deeper truth.",
    rating: 2500,
    specialMessage: "A strategic and insightful debate awaits!",
  },
  {
    name: "Rafiki",
    level: "Legends",
    desc: "Quirky, playful, and humorous. Teaches through stories.",
    avatar: avatar("rafiki.jpeg"),
    quote:
      "Haha! You think too hard, my friend! The answer's right there, like a monkey on a branch!",
    rating: 1800,
    specialMessage: "Expect laughter and surprising wisdom!",
  },
  {
    name: "Darth Vader",
    level: "Legends",
    desc: "Powerful, stern, and intimidating. Uses forceful logic.",
    avatar: avatar("darthvader.jpg"),
    quote:
      "Your reasoning falters. Submit to the strength of my argument, or be crushed.",
    rating: 2300,
    specialMessage: "Brace for an intense, commanding debate!",
  },
]

/** Look up a bot by name, falling back to the first of the roster. */
export function findBot(name: string | null | undefined): PracticeBot {
  return ALL_BOTS.find((bot) => bot.name === name) ?? ALL_BOTS[0]
}

/** Topics the picker offers alongside a free-text box. Ported from upstream. */
export const PREDEFINED_TOPICS: string[] = [
  "Should AI rule the world?",
  "Is space exploration worth the cost?",
  "Should social media be regulated?",
  "Is climate change humanity's fault?",
  "Should college education be free?",
]

/** Default per-phase clocks in seconds. Ported from upstream. */
export const DEFAULT_PHASE_TIMINGS: { name: string; time: number }[] = [
  { name: "Opening Statements", time: 240 },
  { name: "Cross-Examination", time: 180 },
  { name: "Closing Statements", time: 180 },
]

/** Upstream's topic length cap, enforced in the picker. */
export const MAX_TOPIC_LENGTH = 200

/** Upstream's per-phase clock bounds, enforced in the picker. */
export const MIN_PHASE_SECONDS = 60
export const MAX_PHASE_SECONDS = 600
