/**
 * Search over the command registry, plus the per-speech "go to speech"
 * entries the speech switcher exposes. Powers the palette's command mode
 * (query prefixed with ">"): order-independent multi-token matching ranked
 * by relevance tier, same-tier ties in registry order.
 */

import { COMMANDS, type CommandId } from "../commands/registry";
import { speechTerms, type SpeechDef } from "../format/events";

import { rank } from "./match";

export interface CommandHit {
    id: CommandId;
    label: string;
}

const ALL = Object.values(COMMANDS);

/**
 * Rank commands against `query`; an empty query lists them all in order.
 * A command's `keywords` match in the secondary field, so a debater who
 * searches for the mark ("strikethrough") finds it, ranked below every
 * command whose label the query actually names.
 */
export function searchCommands(query: string): CommandHit[] {
    return rank(
        ALL,
        query,
        (c) => c.label,
        (c) => c.keywords ?? "",
        () => 0,
    ).map((c) => ({ id: c.id, label: c.label }));
}

export interface SpeechCommandHit {
    speechId: string;
    label: string;
}

/** The palette label for jumping the grid to `speech`. */
export function speechCommandLabel(speech: SpeechDef): string {
    return `Go to speech: ${speech.name}`;
}

/**
 * Rank the round's speeches as palette commands; an empty query lists them
 * all in speaking order. Dynamic, so these live outside the static registry.
 *
 * A speech's abbreviation and aliases match as strongly as its name, not as
 * weak context: "ns" is what a debater calls the Neg Summary, and it is also
 * buried inside "Co-ns-tructive", so matching it in the secondary field would
 * rank the speech the query names below two it does not.
 */
export function searchSpeechCommands(
    query: string,
    speeches: readonly SpeechDef[],
): SpeechCommandHit[] {
    return rank(
        speeches,
        query,
        (s) => `${speechCommandLabel(s)} ${speechTerms(s)}`,
        () => "",
        () => 0,
    ).map((s) => ({ speechId: s.id, label: speechCommandLabel(s) }));
}
