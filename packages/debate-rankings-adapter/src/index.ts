/**
 * @fileoverview Web UI entry point for the rankings.
 *
 * `packages/debate-rankings` is a git submodule of upstream
 * github.com/debate/debate-rankings, kept byte-for-byte as upstream ships it so
 * `git submodule update --remote` is all a refresh takes. What only this site
 * needs — matching a round video's team label to a rankings row — lives here
 * instead, and the web UI imports from this package rather than the submodule
 * directly.
 * @module debate-rankings-adapter
 */

export * from "debate-rankings";
export {
  entryInitials,
  findTeamRanking,
  normalizeSchool,
  parseTeamLabel,
  schoolMatchScore,
  type TeamLabel,
} from "./team-lookup";
