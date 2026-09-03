/**
 * Clod — persona for the AI "thinking…" indicator. While the model
 * composes a reply, the placeholder cycles through time-of-day-
 * appropriate activities ("Clod is making toast…") instead of a
 * plain "Thinking…". Activity lists ported from the Card Formatting
 * Tools utility (`reference-docs/Card Formatting Tools.py`).
 *
 * The data is exposed via public helpers so the configurator dialog
 * (the easter-egg shift+right-click in settings) can read defaults
 * to seed its text areas and revert-to-defaults buttons.
 */

export type ClodTimePeriod = 'morning' | 'day' | 'evening' | 'night';

export interface ClodTimeRange {
  /** Start hour, 0–23. */
  start: number;
  /** End hour, 0–23. Periods may cross midnight (start > end). */
  end: number;
}

export type ClodTimePeriodRanges = Record<ClodTimePeriod, ClodTimeRange>;

export const DEFAULT_CLOD_TIME_PERIODS: ClodTimePeriodRanges = {
  morning: { start: 5, end: 9 },
  day: { start: 9, end: 20 },
  evening: { start: 20, end: 23 },
  night: { start: 23, end: 5 },
};

/** Hard-coded activity lists per time-of-day. The configurator can
 *  override these per period in settings; an empty override array
 *  falls back to these defaults. */
export const CLOD_ACTIVITIES_BY_TIME: Record<ClodTimePeriod, readonly string[]> = {
  morning: [
    'Clod is stretching…',
    'Clod is yawning adorably…',
    'Clod is making breakfast…',
    'Clod is eating scrambled eggs…',
    'Clod is sipping orange juice…',
    'Clod is brushing his teeth…',
    'Clod is doing the warrior pose…',
    'Clod is practicing sun salutations…',
    'Clod is reading the morning news…',
    'Clod is watering his plants…',
    'Clod is enjoying his morning coffee…',
    'Clod is basking in a sunbeam…',
    'Clod is watching the sunrise…',
    'Clod is flossing…',
    'Clod is greeting each of his houseplants…',
    'Clod is preparing his daily schedule…',
    'Clod is doing morning stretches…',
    'Clod is listening to morning radio…',
    'Clod is making toast…',
    'Clod is arranging his breakfast cereal by size…',
    'Clod is packing his lunch…',
    'Clod is feeding his goldfish…',
    'Clod is opening the curtains…',
  ],
  day: [
    'Clod is flopping on his back…',
    'Clod is reading to his friend Long Cat…',
    'Clod is learning about birds…',
    'Clod is asking his friend Long Cat about his day…',
    'Clod is nyoyning contentedly…',
    'Clod is trying to scratch his back…',
    'Clod is burrowing…',
    'Clod is on the hunt for knowledge…',
    'Clod is watching raindrops on the window…',
    'Clod is rolling around…',
    'Clod is sunbathing…',
    'Clod is reading about the Strong Force…',
    'Clod is enjoying Mozart…',
    'Clod is investigating a houseplant…',
    'Clod found a mud puddle…',
    'Clod is attempting to play the piano…',
    'Clod is organizing scientific journals…',
    'Clod is balancing a book on his head…',
    'Clod is composing a nyoyn symphony…',
    'Clod is typing enthusiastically…',
    'Clod is rolling down a gentle slope…',
    'Clod is solving a Rubik’s cube…',
    'Clod is attempting yoga poses…',
    'Clod is building a fort of textbooks…',
    'Clod is trying to take a selfie…',
    'Clod is debating quantum mechanics…',
    'Clod is juggling plush balls…',
    'Clod is alphabetizing his thoughts…',
    'Clod is blending in with round fruits…',
    'Clod is writing a research paper…',
    'Clod is rolling uphill for exercise…',
    'Clod is solving a crossword puzzle…',
    'Clod is making a sandwich…',
    'Clod is practicing his victory dance…',
    'Clod is knitting a tiny scarf…',
    'Clod is directing a one-Clod play…',
    'Clod is playing chess against himself…',
    'Clod is examining a clock’s gears…',
    'Clod is painting a self-portrait…',
    'Clod is measuring his roundness…',
    'Clod is performing a magic trick…',
    'Clod is learning a new language…',
    'Clod is building a fruit solar system…',
    'Clod is composing a song about learning…',
    'Clod is concentrating on Sudoku…',
    'Clod is creating origami shapes…',
    'Clod is trying to understand why fish don’t drown…',
    'Clod is recreating famous artworks…',
    'Clod is attempting to moonwalk…',
    'Clod is sorting his button collection…',
    'Clod is trying to lick his elbow…',
    'Clod is writing a haiku about fluff…',
    'Clod is designing a better wheel (rounder)…',
    'Clod is inventing a new board game…',
    'Clod is learning to play the harmonica…',
    'Clod is trying to catch dust motes in sunbeams…',
    'Clod is building a house of cards…',
    'Clod is trying to solve a maze…',
    'Clod is practicing his evil laugh…',
    'Clod is drawing faces on foggy windows…',
    'Clod is attempting to juggle soap bubbles…',
    'Clod is trying to understand why doors exist…',
    'Clod is writing a letter to his future self…',
    'Clod is trying to break a world record…',
    'Clod is learning to speak whale…',
    'Clod is practicing his royal wave…',
    'Clod is trying to count to infinity…',
    'Clod is inventing a new ice cream flavor…',
    'Clod is writing a mystery novel…',
    'Clod is trying to remember where he left his keys…',
    'Clod is planning a trip around the world…',
    'Clod is attempting to break dance…',
    'Clod is learning semaphore…',
    'Clod is trying to perfect his yodel…',
    'Clod is inventing a new martial art…',
    'Clod is practicing his acceptance speech…',
    'Clod is trying to grow a bonsai tree…',
    'Clod is learning to read Braille…',
    'Clod is trying to make friends with his shadow…',
    'Clod is inventing a new element…',
    'Clod is planning a surprise party for his friend Long Cat…',
    'Clod is trying to catch his own tail…',
    'Clod is writing a self-help book…',
    'Clod is learning to walk a tightrope…',
    'Clod is trying to predict the weather…',
    'Clod is inventing a new dance move…',
    'Clod is trying to build a perpetual motion machine…',
    'Clod is learning to read tea leaves…',
    'Clod is practicing his stage dive…',
    'Clod is trying to fold a fitted sheet…',
    'Clod is inventing a new sport…',
    'Clod is attempting to solve world hunger…',
    'Clod is trying to communicate with plants…',
    'Clod is writing an opera about lint…',
    'Clod is learning to throw a boomerang…',
    'Clod is trying to build a time machine…',
    'Clod is inventing a new programming language…',
    'Clod is attempting to break the sound barrier…',
    'Clod is trying to decipher ancient hieroglyphs…',
    'Clod is writing a cookbook for clouds…',
    'Clod is learning to play the theremin…',
    'Clod is trying to put on shoes…',
    'Clod is making instant noodles…',
    'Clod is practicing French with his friend Long Cat…',
    'Clod is turning a mountain into three perfect molehills…',
    'Clod is SNEAKING…',
    'Clod is looking for his ankles…',
    'Clod is thinking deeply…',
    'Clod is putting on his tiny professor glasses…',
    'Clod is simplifying complex concepts…',
    'Clod is breaking things down into manageable bits…',
    'Clod is preparing a tiny lecture…',
    'Clod is drawing diagrams on a whiteboard…',
    'Clod is organizing his thoughts…',
    'Clod is creating an explainer video…',
    'Clod is turning on his ELI5 mode…',
    'Clod is making an educational poster…',
    'Clod is crafting the perfect analogy…',
    'Clod is attempting to hypnotize himself…',
    'Clod is trying to prove the existence of ghosts…',
    'Clod is attempting to summon a spirit…',
  ],
  evening: [
    'Clod is winding down for the day…',
    'Clod is drinking lavender tea…',
    'Clod is putting on his cozy pajamas…',
    'Clod is dimming the lights…',
    'Clod is journaling about his day…',
    'Clod is watching the sunset…',
    'Clod is reading a bedtime story…',
    'Clod is taking a warm bath…',
    'Clod is listening to relaxing music…',
    'Clod is doing gentle evening stretches…',
    'Clod is preparing tomorrow’s outfit…',
    'Clod is enjoying a cup of chamomile…',
    'Clod is fluffing his pillows…',
    'Clod is setting his alarm clock…',
    'Clod is brushing his teeth…',
    'Clod is turning off electronics…',
    'Clod is lighting a calming candle…',
    'Clod is meditating peacefully…',
    'Clod is stargazing…',
    'Clod is studying a map of the stars…',
    'Clod is putting on his nightcap…',
    'Clod is reading poetry by candlelight…',
    'Clod is arranging his slippers…',
    'Clod is practicing deep breathing…',
    'Clod is listening to crickets chirping…',
    'Clod is doing a crossword puzzle in bed…',
    'Clod is organizing his nightstand…',
    'Clod is applying moisturizer…',
    'Clod is counting his blessings…',
    'Clod is adjusting his pillow just right…',
    'Clod is sipping herbal tea slowly…',
    'Clod is reading one more chapter…',
    'Clod is listening to nature sounds…',
    'Clod is warming up his fuzzy socks…',
    'Clod is humming a lullaby…',
    'Clod is checking tomorrow’s weather…',
    'Clod is tidying up his bedside table…',
  ],
  night: [
    'Clod is taking a nap…',
    'Clod is snuggling with research papers…',
    'Clod is exploring a pillow case…',
    'Clod is dreaming of round things…',
    'Clod is counting sheep…',
    'Clod is snoring softly…',
    'Clod is tossing and turning…',
    'Clod is hugging his teddy bear…',
    'Clod is sleep-talking about physics…',
    'Clod is having sweet dreams…',
    'Clod is curled up in a ball…',
    'Clod is sleeping soundly…',
    'Clod is dreaming of adventures…',
    'Clod is getting a glass of water…',
    'Clod is recharging his batteries…',
    'Clod is floating on dream clouds…',
    'Clod is visiting dreamland…',
    'Clod is practicing lucid dreaming…',
    'Clod is mumbling equations in his sleep…',
  ],
};

/** Holiday-specific activities — when an entry exists for today's
 *  date, it REPLACES the day-period activities for that calendar
 *  day. (Other periods stay default.) */
export type ClodHoliday =
  | 'christmas'
  | 'new_years'
  | 'halloween'
  | 'valentines'
  | 'groundhog'
  | 'leapday'
  | 'earthday'
  | 'piday';

export const CLOD_HOLIDAY_ACTIVITIES: Record<ClodHoliday, readonly string[]> = {
  christmas: [
    'Clod is wrapping presents…',
    'Clod is decorating a miniature Christmas tree…',
    'Clod is baking sugar cookies…',
    'Clod is singing Christmas carols…',
    'Clod is hanging stockings by the fireplace…',
    'Clod is writing letters to Santa…',
    'Clod is untangling Christmas lights…',
    'Clod is making paper snowflakes…',
    'Clod is drinking hot cocoa with marshmallows…',
    'Clod is building a gingerbread house…',
    'Clod is wrapping himself as a present…',
    'Clod is arranging ornaments on the tree…',
    'Clod is making a wish list…',
    'Clod is leaving cookies for Santa…',
    'Clod is wearing a tiny Santa hat…',
    'Clod is reading “Twas the Night Before Christmas…',
    'Clod is jingling sleigh bells…',
    'Clod is making snow angels…',
    'Clod is getting tangled in tinsel…',
    'Clod is interviewing a reindeer…',
    'Clod is sledding down a gentle hill…',
    'Clod is warming up by the fireplace…',
    'Clod is watching snowflakes fall…',
    'Clod is making candy canes…',
    'Clod is polishing his tiny jingle bells…',
    'Clod is practicing his ho-ho-ho…',
    'Clod is building a snowman…',
  ],
  new_years: [
    'Clod is making New Year’s resolutions…',
    'Clod is practicing his countdown…',
    'Clod is wearing a tiny party hat…',
    'Clod is blowing noise makers…',
    'Clod is reflecting on the past year…',
    'Clod is planning goals for the new year…',
    'Clod is organizing a time capsule…',
    'Clod is writing in his new diary…',
    'Clod is practicing confetti throws…',
    'Clod is learning about different time zones…',
    'Clod is making sparkling apple cider…',
    'Clod is designing a vision board…',
    'Clod is trying to stay awake until midnight…',
    'Clod is practicing his celebration dance…',
    'Clod is cleaning and organizing for a fresh start…',
    'Clod is watching fireworks through the window…',
    'Clod is toasting with a tiny glass…',
    'Clod is writing thank you notes for the year…',
    'Clod is setting up a photo booth…',
    'Clod is making friendship bracelets for the new year…',
    'Clod is reading about calendar systems…',
    'Clod is practicing midnight cheers…',
    'Clod is creating a gratitude jar…',
    'Clod is planning his first day of the new year…',
    'Clod is making lucky charms…',
    'Clod is dreaming about new adventures…',
  ],
  halloween: [
    'Clod is trying on different costumes…',
    'Clod is carving a tiny pumpkin…',
    'Clod is practicing spooky faces…',
    'Clod is sorting Halloween candy…',
    'Clod is decorating with fake spider webs…',
    'Clod is making paper bats…',
    'Clod is telling ghost stories…',
    'Clod is bobbing for apples…',
    'Clod is practicing his scary roar…',
    'Clod is making Halloween treats…',
    'Clod is designing jack-o’-lantern faces…',
    'Clod is wearing a tiny witch hat…',
    'Clod is creating spooky sound effects…',
    'Clod is organizing his trick-or-treat bag…',
    'Clod is making orange and black decorations…',
    'Clod is learning about different monsters…',
    'Clod is practicing his monster walk…',
    'Clod is building a Skittles Galton board…',
    'Clod is making candy corn art…',
    'Clod is reading scary stories (not too scary)…',
    'Clod is making paper ghosts…',
    'Clod is trying to look frightening (but still adorable)…',
    'Clod is brewing pretend potions…',
    'Clod is dancing the monster mash…',
    'Clod is making Halloween masks…',
    'Clod is planning his costume reveal…',
  ],
  valentines: [
    'Clod is making paper hearts…',
    'Clod is writing valentine cards…',
    'Clod is arranging flowers in a tiny vase…',
    'Clod is baking heart-shaped cookies…',
    'Clod is practicing love songs…',
    'Clod is making friendship bracelets…',
    'Clod is decorating with pink and red hearts…',
    'Clod is writing love poems…',
    'Clod is making chocolate treats…',
    'Clod is preparing valentine surprises…',
    'Clod is making paper roses…',
    'Clod is writing letters to friends…',
    'Clod is making heart-shaped art…',
    'Clod is analyzing the chemistry of chocolate…',
    'Clod is practicing compliments…',
    'Clod is studying the physics of butterflies in stomach…',
    'Clod is making pink lemonade…',
    'Clod is decorating mailboxes for valentines…',
    'Clod is making strawberry treats…',
    'Clod is spreading love and kindness…',
  ],
  groundhog: [
    'Clod is looking for his shadow…',
    'Clod is practicing weather predictions…',
    'Clod is emerging from his burrow…',
    'Clod is studying meteorology…',
    'Clod is making shadow puppets…',
    'Clod is digging a cozy burrow…',
    'Clod is measuring shadow lengths…',
    'Clod is petitioning the groundhog council…',
    'Clod is preparing his weather forecast…',
    'Clod is polishing his prediction skills…',
    'Clod is studying cloud patterns…',
    'Clod is writing weather reports…',
    'Clod is hibernating (but just for practice)…',
    'Clod is making a weather vane…',
    'Clod is learning about seasons…',
    'Clod is drawing weather maps…',
    'Clod is making groundhog day decorations…',
    'Clod is preparing for spring (or not)…',
    'Clod is being a weather prognosticator…',
  ],
  leapday: [
    'Clod is taking a giant leap…',
    'Clod is celebrating the extra day…',
    'Clod is surprised it’s still February…',
    'Clod is practicing his best leap…',
    'Clod is making the most of February 29th…',
    'Clod is time traveling (sort of)…',
    'Clod is leaping over obstacles…',
    'Clod is making a leap day time capsule…',
    'Clod is doing 29 jumping jacks…',
    'Clod is writing in his quadrennial diary…',
    'Clod is making leap-themed art…',
    'Clod is making a leap day wish…',
    'Clod is making every moment count…',
    'Clod is leaping into new adventures…',
    'Clod is calculating the Gregorian calendar correction…',
    'Clod is explaining why years divisible by 100 aren’t leap years (unless divisible by 400)…',
    'Clod is synchronizing atomic clocks…',
    'Clod is discussing the 365.2425 day problem…',
    'Clod is writing a leap second algorithm…',
    'Clod is calculating orbital mechanics…',
    'Clod is explaining Julian vs Gregorian calendars…',
    'Clod is discussing the Y2K leap year bug…',
    'Clod is calculating his age in leap seconds…',
    'Clod is modeling Earth’s axial precession…',
    'Clod is calculating the drift of sidereal time…',
    'Clod is explaining Unix timestamp overflow…',
    'Clod is learning about Caesar’s 365.25 day approximation…',
    'Clod is modeling planetary orbital resonances…',
    'Clod is debugging datetime libraries…',
    'Clod is drinking 24.25 percent of his coffee…',
  ],
  earthday: [
    'Clod is planting tiny seeds…',
    'Clod is recycling…',
    'Clod is hugging trees…',
    'Clod is cleaning up the neighborhood…',
    'Clod is learning about ecosystems…',
    'Clod is saving water drops…',
    'Clod is creating eco-friendly art…',
    'Clod is turning off unnecessary lights…',
    'Clod is making a bird feeder…',
    'Clod is studying renewable energy…',
    'Clod is reducing, reusing, and recycling…',
    'Clod is making earth-friendly pledges…',
    'Clod is creating a butterfly garden…',
    'Clod is learning about climate science…',
    'Clod is making reusable bags…',
    'Clod is caring for houseplants…',
    'Clod is picking up litter…',
    'Clod is making natural cleaning products…',
    'Clod is appreciating nature’s beauty…',
    'Clod is creating a worm bin…',
    'Clod is saving the bees…',
    'Clod is making our planet proud…',
  ],
  piday: [
    'Clod is calculating pi to many digits…',
    'Clod is baking circular pies…',
    'Clod is measuring circumferences…',
    'Clod is celebrating at 3:14…',
    'Clod is making pizza (it’s round!)…',
    'Clod is drawing perfect circles…',
    'Clod is memorizing digits of pi…',
    'Clod is eating a pie…',
    'Clod is measuring his own roundness…',
    'Clod is making pi puns…',
    'Clod is learning about irrational numbers…',
    'Clod is rolling in circles…',
    'Clod is making a pi day chain…',
    'Clod is celebrating circular foods…',
    'Clod is doing geometry puzzles…',
    'Clod is putting on his pi day shirt…',
    'Clod is calculating areas of circles…',
    'Clod is hosting a pi recitation contest…',
    'Clod is making circular art…',
    'Clod is ranking his favorite mathematical constants…',
    'Clod is baking exactly 3.14 pies…',
    'Clod is making friends with spheres…',
    'Clod is celebrating infinite possibilities…',
    'Clod is being transcendental…',
    'Clod is explaining why π is transcendental…',
    'Clod is discussing Euler’s identity: e^(iπ) + 1 = 0…',
    'Clod is calculating spherical volume…',
    'Clod is explaining why π appears in the normal distribution…',
    'Clod is calculating digits of π in hexadecimal…',
    'Clod is reading Lambert’s irrationality proof…',
    'Clod is implementing spigot algorithms for π…',
  ],
};

/** Return today's holiday key, or null if today isn't on the list.
 *  Holidays only replace the DAY-period activity pool. */
export function getCurrentHoliday(now: Date = new Date()): ClodHoliday | null {
  const month = now.getMonth() + 1;
  const day = now.getDate();
  if (month === 1 && day === 1) return 'new_years';
  if (month === 2 && day === 2) return 'groundhog';
  if (month === 2 && day === 14) return 'valentines';
  if (month === 2 && day === 29) return 'leapday';
  if (month === 3 && day === 14) return 'piday';
  if (month === 4 && day === 22) return 'earthday';
  if (month === 10 && day === 31) return 'halloween';
  if (month === 12 && day === 25) return 'christmas';
  return null;
}

/** Compute the current time period based on the configured ranges
 *  and the supplied clock. Handles ranges that cross midnight. */
export function currentClodPeriod(
  ranges: ClodTimePeriodRanges = DEFAULT_CLOD_TIME_PERIODS,
  now: Date = new Date(),
): ClodTimePeriod {
  const hour = now.getHours();
  for (const period of ['morning', 'day', 'evening', 'night'] as const) {
    const { start, end } = ranges[period];
    if (start > end) {
      if (hour >= start || hour < end) return period;
    } else if (hour >= start && hour < end) {
      return period;
    }
  }
  return 'day';
}

/** Pick an activity pool for the current moment. Custom overrides
 *  (a non-empty user array for the current period) replace the
 *  built-in pool entirely; an empty array uses defaults. Holidays
 *  trump the day period. */
export function activitiesForNow(opts: {
  customByTime?: Partial<Record<ClodTimePeriod, readonly string[]>>;
  ranges?: ClodTimePeriodRanges;
  now?: Date;
}): readonly string[] {
  const now = opts.now ?? new Date();
  const period = currentClodPeriod(opts.ranges ?? DEFAULT_CLOD_TIME_PERIODS, now);
  if (period === 'day') {
    const holiday = getCurrentHoliday(now);
    if (holiday) return CLOD_HOLIDAY_ACTIVITIES[holiday];
  }
  const custom = opts.customByTime?.[period];
  if (custom && custom.length > 0) return custom;
  return CLOD_ACTIVITIES_BY_TIME[period];
}

export function pickRandomActivity(pool: readonly string[]): string {
  if (pool.length === 0) return 'Clod is thinking…';
  return pool[Math.floor(Math.random() * pool.length)]!;
}

// ----------------------- persona templating ---------------------
//
// Built-in activity strings are written with the canonical Clod
// persona (proper noun "Clod", male pronouns). When the user
// customizes the persona via the easter-egg configurator we
// substitute Clod / his / him / himself with the configured
// name and pronoun set at render time. Word-boundary regexes
// avoid stomping on substrings inside other words (e.g. "his" in
// "history", "him" in "shimmer").

export interface AiPersonaPronouns {
  /** Subject — "he" / "she" / "they". */
  subject: string;
  /** Object — "him" / "her" / "them". */
  object: string;
  /** Possessive determiner — "his" / "her" / "their". */
  possessive: string;
  /** Reflexive — "himself" / "herself" / "themself". */
  reflexive: string;
}

export interface AiPersona {
  /** Display name for the AI commenter ("Clod" by default). */
  name: string;
  pronouns: AiPersonaPronouns;
}

/** Built-in pronoun presets. The configurator picks one of these
 *  by id; `'custom'` lets the user fill in all four explicitly. */
export const PRONOUN_PRESETS: Record<'he' | 'she' | 'they' | 'it', AiPersonaPronouns> = {
  he:   { subject: 'he',   object: 'him',  possessive: 'his',   reflexive: 'himself' },
  she:  { subject: 'she',  object: 'her',  possessive: 'her',   reflexive: 'herself' },
  they: { subject: 'they', object: 'them', possessive: 'their', reflexive: 'themself' },
  it:   { subject: 'it',   object: 'it',   possessive: 'its',   reflexive: 'itself' },
};

const CLOD_PRONOUNS = PRONOUN_PRESETS.he;

/** Replace the canonical Clod tokens (`Clod`, `his`, `him`,
 *  `himself`) with the configured persona's name and pronouns.
 *  Word-boundary regex so we don't munge substrings inside other
 *  words. Idempotent for the default persona (Clod + he/him). */
/** Compose the one-line in-flight narration for an AI feature from a
 *  gerund phrase: the persona voice ("Clod is skeletonizing…", with
 *  the CONFIGURED name, never a hardcoded "Clod") when clod mode is
 *  on, the plain capitalized gerund ("Skeletonizing…") when it's off.
 *  Pure — callers pass mode + name — so the thinking pill and any
 *  toast narrating an in-flight step compose through one function and
 *  the persona voice can never fork. Stage strings passed here must be
 *  gerund phrases with NO trailing ellipsis (this adds it); anything
 *  else reads as nonsense in the clod branch ("Clod is Cite 3 of 12…").
 */
export function inFlightLine(gerund: string, clodEnabled: boolean, personaName: string): string {
  return clodEnabled
    ? `${personaName.trim() || 'Clod'} is ${gerund}…`
    : `${gerund.charAt(0).toUpperCase()}${gerund.slice(1)}…`;
}

export function personalizeActivity(text: string, persona: AiPersona): string {
  let out = text;
  // Order matters: longer tokens first so "himself" replaces before
  // "him" tries to.
  if (persona.pronouns.reflexive !== CLOD_PRONOUNS.reflexive) {
    out = out.replace(/\bhimself\b/g, persona.pronouns.reflexive);
  }
  if (persona.pronouns.object !== CLOD_PRONOUNS.object) {
    out = out.replace(/\bhim\b/g, persona.pronouns.object);
  }
  if (persona.pronouns.possessive !== CLOD_PRONOUNS.possessive) {
    out = out.replace(/\bhis\b/g, persona.pronouns.possessive);
  }
  if (persona.pronouns.subject !== CLOD_PRONOUNS.subject) {
    out = out.replace(/\bhe\b/g, persona.pronouns.subject);
  }
  if (persona.name !== 'Clod') {
    out = out.replace(/\bClod\b/g, persona.name);
  }
  return out;
}
