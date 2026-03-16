const fs = require("fs")
// Read from existing split files (original was already split)
const existingLectures = require("../../new-videos-debatedrills-lectures.json")
const existingRounds = require("../../new-videos-debatedrills-rounds.json")
// Strip old category (last element) from lectures to get raw data
const lectures = existingLectures.map(v => v.slice(0, 6))
const rounds = existingRounds
// Reconstruct full data for stats
const data = [...lectures, ...rounds.map(v => v.slice(0, 6))]

console.log(`Rounds: ${rounds.length}`)
console.log(`Lectures: ${lectures.length}`)

// --- Process lectures: add category ---
function classifyLecture(title, description) {
  const t = title.toLowerCase()
  const d = (description || "").toLowerCase()
  const both = t + " " + d

  // Topic Lectures
  if (/topic\s*(analysis|analyses|lecture|breakdown|overview|discussion|webinar)/i.test(title)) return "Topic Lectures"
  if (/\btopic\b/i.test(title) && /\b(prep|strategy|file|guide)\b/i.test(title)) return "Topic Lectures"

  // Novice & Introductory
  if (/\b(intro to|introduction|beginner|novice|basics|abc.?s of|getting started|what is)\b/i.test(title)) return "Novice & Introductory"

  // Affirmative Strategy
  if (/\b(1ac|2ac|1ar|aff strategy|aff case|affirmative|case writing|contention|constructing a contention|conceptualizing aff)\b/i.test(both)) return "Affirmative Strategy"

  // Negative Strategy
  if (/\b(neg strategy|negative|2nr|1nr|2nc|1nc|neg prep|block writing|case neg)\b/i.test(both)) return "Negative Strategy"

  // Kritik / Critical Theory
  if (/\b(kritik|k\b|critical theory|afropessimism|cap k|settler colonial|baudrillard|security k|queer theory|deleuze|foucault)\b/i.test(both)) return "Kritik / Critical Theory"

  // Counterplans & Theory
  if (/\b(counterplan|cp\b|conditionality|theory|competition|solvency advocate|perm)\b/i.test(both)) return "Counterplans & Theory"

  // Topicality & Framework
  if (/\b(topicality|framework|t vs|fairness|fiat|plan text|reasonability)\b/i.test(both)) return "Topicality & Framework"

  // Disadvantages
  if (/\b(disadvantage|disad|politics da|da\b|risk analysis|elections da|economy da|link comparison)\b/i.test(both)) return "Disadvantages"

  // Impact Calculus & Evidence
  if (/\b(impact|magnitude|probability|timeframe|evidence comparison|risk assessment|weighing|meta.?weighing)\b/i.test(both)) return "Impact Calculus & Evidence"

  // Speaking & Delivery
  if (/\b(speaking|delivery|speaker|vocal|roadmap|cx technique|persuasi|presentation|crossfire|cross.?exam)\b/i.test(both)) return "Speaking & Delivery"

  // Research & Flowing
  if (/\b(research|flowing|flow|card cutting|verbatim|paperless|evidence)\b/i.test(both)) return "Research & Flowing"

  // Public Forum
  if (/\b(public forum|pf\b|summary speech|final focus|rebuttal strategy)\b/i.test(both)) return "Public Forum"

  // Demo Debates
  if (/\b(demo|demonstration|sample|example|model)\b/i.test(title)) return "Demo Debates"

  // Judge & Tournament Skills
  if (/\b(judge|tournament|prefs|post.?round|mental|preparing for tournament)\b/i.test(both)) return "Judge & Tournament Skills"

  // Philosophy & IR Theory
  if (/\b(philosophy|kant|ir theory|political economy|critical ir|environmental theory)\b/i.test(both)) return "Philosophy & IR Theory"

  // Camp & Coaching Advice
  if (/\b(camp|institute|lab|workshop|seminar|coaching|team leadership)\b/i.test(both)) return "Camp & Coaching Advice"

  // Documentaries & Culture
  if (/\b(documentary|anti.?blackness|panel|community|humor|culture|interview|podcast|commentary|recap|reaction)\b/i.test(both)) return "Documentaries & Culture"

  // Fallback: check for "DebateDrills Academy" pattern — these are skill-focused
  if (/DebateDrills Academy/i.test(title)) return "Affirmative Strategy"

  // Strategy catch-all
  if (/\b(strategy|strat|tactic|technique|approach|conceptualiz|turning the round)\b/i.test(title)) return "Affirmative Strategy"

  return "Novice & Introductory"
}

const lectureOutput = lectures.map(v => {
  const category = classifyLecture(v[1], v[5])
  return [...v, category]
})

// --- Process rounds: parse title + description for extra fields ---
function parseDebateStyle(title) {
  const t = title.toLowerCase()
  if (/\b(ld|lincoln.?douglas)\b/i.test(t)) return 3
  if (/\b(pf|public\s*forum)\b/i.test(t)) return 2
  if (/\b(cx|policy|cross.?x)\b/i.test(t)) return 1
  if (/\b(college|ndt|ceda)\b/i.test(t)) return 4
  return 3 // default to LD for DebateDrills
}

function parseRoundLevel(title) {
  // Elim rounds
  const elimMatch = title.match(/\b(Finals?|Semifinals?|Semis|Quarterfinals?|Quarters|Octafinals?|Octas|Doubles?|Triples?|Runoffs?)\b/i)
  if (elimMatch) return elimMatch[1]
  // Prelim rounds
  const roundMatch = title.match(/\bR(?:ound\s*)?(\d+)\b/i)
  if (roundMatch) return `R${roundMatch[1]}`
  return null
}

function parseTournament(title) {
  // Pattern: "YEAR Tournament Name FORMAT ROUND: ..."
  // Try to extract everything before the format/round indicator
  const match = title.match(/^(\d{4}\s+.+?)\s+(?:LD|PF|CX|Policy|Lincoln|Public)\b/i)
  if (match) return match[1].trim()
  // Try: everything before "R1:", "Round 1:", "Finals:", etc.
  const match2 = title.match(/^(.+?)\s+(?:R\d+|Round\s+\d+|Finals?|Semi|Quarter|Octa|Double|Triple)\b/i)
  if (match2) {
    let t = match2[1].trim()
    // Remove year prefix if it's just a year
    // Remove trailing format words
    t = t.replace(/\s+(LD|PF|CX|Policy)$/i, "").trim()
    return t
  }
  return null
}

function parseTeams(title) {
  // Pattern: "... : Team1 vs Team2" or "... : Team1 vs. Team2"
  const match = title.match(/:\s*(.+?)\s+vs\.?\s+(.+)$/i)
  if (match) return { aff: match[1].trim(), neg: match[2].trim() }
  return { aff: null, neg: null }
}

function parseWinner(description) {
  if (!description) return null
  if (/for the affirmative/i.test(description)) return true
  if (/for the negative/i.test(description)) return false
  if (/aff(?:irmative)?\s+win/i.test(description)) return true
  if (/neg(?:ative)?\s+win/i.test(description)) return false
  return null
}

function parseJudgeDecision(description) {
  if (!description) return null
  // Pattern: "3-0 for the affirmative (Judge1, Judge2, Judge3)"
  // Pattern: "2-1 for the negative (Judge1, Judge2, Judge3*)"
  const match = description.match(/(\d+-\d+)\s+for the (?:affirmative|negative)\s*\(([^)]+)\)/i)
  if (match) return `${match[1]} (${match[2].trim()})`
  return null
}

const roundOutput = rounds.map(v => {
  const [id, title, date, channel, views, desc] = v
  const style = parseDebateStyle(title)
  const tournament = parseTournament(title)
  const roundLevel = parseRoundLevel(title)
  const { aff, neg } = parseTeams(title)
  const winner = parseWinner(desc)
  const judgeDecision = parseJudgeDecision(desc)

  return [
    id,           // video id
    title,        // title
    date,         // date
    channel,      // channel
    views,        // views
    desc,         // description
    style,        // debate style (1=Policy, 2=PF, 3=LD, 4=College)
    tournament,   // tournament name
    roundLevel,   // round level
    aff,          // aff team
    neg,          // neg team
    winner,       // winner (true=aff, false=neg, null=unknown)
    judgeDecision, // judge decision
    null,         // 1AC
    null,         // 2NR
    false,        // top 100
    null          // speech docs URL
  ]
})

fs.writeFileSync("new-videos-debatedrills-lectures.json", JSON.stringify(lectureOutput, null, 2) + "\n")
// Rounds already processed — don't overwrite
// fs.writeFileSync("new-videos-debatedrills-rounds.json", JSON.stringify(roundOutput, null, 2) + "\n")

console.log(`\nWrote ${lectureOutput.length} lectures to new-videos-debatedrills-lectures.json`)

// Show category distribution for lectures
const cats = {}
lectureOutput.forEach(v => { cats[v[v.length-1]] = (cats[v[v.length-1]] || 0) + 1 })
console.log("\nLecture categories:", cats)

// Show sample parsed round
console.log("\nSample parsed round:")
console.log(JSON.stringify(roundOutput[0], null, 2))
console.log(JSON.stringify(roundOutput[6], null, 2))
