/**
 * Drops the description's "1AC: …" / "2NR: …" lines when the round already
 * records that argument (it shows under the team name instead).
 */
export function stripArgumentLines(
  description: string,
  arg1AC?: string | null,
  arg2NR?: string | null,
): string {
  return description
    .split("\n")
    .filter((line) => {
      if (arg1AC?.trim() && /^\s*1AC\s*:/i.test(line)) return false
      if (arg2NR?.trim() && /^\s*2NR\s*:/i.test(line)) return false
      return true
    })
    .join("\n")
    .trim()
}
