/**
 * @file author-names.ts
 * @description Reads the author part of a Chicago bibliography entry into
 * people and organizations, and decides which spellings are one author.
 *
 * - `parseAuthorPart` turns `Carlin, Diana, and David Levasseur`, `Foster,
 *   Peter, et al.`, `Krause, Keith, and Michael C. Williams, eds.`,
 *   `Gulakov, Alex [posting as Synergy]` or `Cleveland Clinic` into a list of
 *   people (family, given, suffix) or one institution, plus whether the byline
 *   had `et al.` and what role the byline's `ed.` / `dir.` gave them. It reuses
 *   `parseChicagoByline` and `isInstitutionAuthor` for the heavy lifting.
 * - `mergeNameVariants` groups the spellings of one person (`Williams, Michael
 *   C.` and `Williams, M.`) while keeping apart people who share a surname
 *   (`Mark Engler` and `Paul Engler`, `Lana` and `Lilly Wachowski`).
 * - `slugify` and `foldName` make the URL segment and the search key.
 *
 * Pure string work, so it runs in the sync script and in tests.
 */
import { parseChicagoByline } from '../citation-styles';
import { isInstitutionAuthor } from '../reference-display';
import type { AuthorKind, AuthorRole } from './types';

/** One person as a byline gives them. */
export interface PersonName {
  /** Family name with any particle (`van Munster`, `De Vogli`). */
  family: string;
  /** Given names and initials (`George C.`), without particles that belong to the family name. */
  given: string;
  /** `Jr.`, `III`, or empty. */
  suffix: string;
}

/** What `parseAuthorPart` found. */
export interface ParsedAuthorPart {
  kind: AuthorKind;
  /** People in byline order; empty for an institution. */
  people: PersonName[];
  /** The organization's name; empty for people. */
  institution: string;
  etAl: boolean;
  role: AuthorRole;
  /** A pen name or handle the byline mentions: `Gulakov, Alex [posting as Synergy]` → `Synergy`. */
  alias: string;
}

const PARTICLES = new Set(['van', 'von', 'der', 'den', 'de', 'del', 'della', 'di', 'da', 'du', 'la', 'le', 'ter', 'ten', 'bin', 'ibn', 'al', 'el', 'zu']);

const ROLE_TAIL = /,?\s*\b(eds?|dirs?|trans|comps?)\.?$/i;

const SPECIAL_LETTERS: Record<string, string> = {
  æ: 'ae',
  œ: 'oe',
  ø: 'o',
  ß: 'ss',
  đ: 'd',
  ł: 'l',
  ð: 'd',
  þ: 'th',
};

/** Lowercase ASCII: `Žižek` → `zizek`, `Wæver` → `waever`, `Ó Tuathail` → `o tuathail`. */
export function foldName(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[æœøßđłðþ]/g, (letter) => SPECIAL_LETTERS[letter] ?? letter);
}

/** `Slavoj Žižek` → `slavoj-zizek`; `Rosemary O’Kane` → `rosemary-okane`. */
export function slugify(text: string): string {
  return foldName(text)
    .replace(/['’‘`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** The search key of a name: lowercase ASCII words, no punctuation, single spaces. */
export function searchKey(text: string): string {
  return foldName(text)
    .replace(/['’‘`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Moves `van`, `de` and friends that ended up on the given names to the family name. */
function withParticles(person: PersonName): PersonName {
  const words = person.given.split(/\s+/).filter(Boolean);
  let family = person.family;
  while (words.length > 1 && PARTICLES.has(words[words.length - 1]!.toLowerCase())) {
    family = `${words.pop()} ${family}`;
  }
  return { family, given: words.join(' '), suffix: person.suffix };
}

/** `Fryer, Roland G. Jr.` leaves `Jr.` on the given names; moves it to the suffix. */
function splitSuffix(person: PersonName): PersonName {
  if (person.suffix) return person;
  const match = /^(.*?)[,\s]+(Jr|Sr|II|III|IV)\.?$/.exec(person.given);
  return match?.[1] ? { ...person, given: match[1], suffix: person.given.slice(match[1].length).replace(/^[,\s]+/, '') } : person;
}

/** `George C.`, `Jr.`: how a name is shown, given names first. */
export function displayName(person: PersonName): string {
  return [person.given, person.family, person.suffix].filter(Boolean).join(' ');
}

/** `Edwards, George C., III`: how a name sorts in a bibliography. */
export function sortName(person: PersonName): string {
  const given = [person.given, person.suffix].filter(Boolean).join(' ');
  return given ? `${person.family}, ${given}` : person.family;
}

/**
 * Reads the author part of a Chicago entry (everything before the title).
 * An organization is a byline with no comma (`Cleveland Clinic`, `Wired`) or
 * one `isInstitutionAuthor` recognizes (`U.S. Department of Education, Office
 * for Civil Rights`, named by the part before the comma).
 */
export function parseAuthorPart(authorPart: string, citationHtml = ''): ParsedAuthorPart {
  let text = authorPart.replace(/\s+/g, ' ').trim();
  const alias = /\[\s*posting as ([^\]]+)\]/i.exec(text)?.[1]?.trim() ?? '';
  text = text.replace(/\s*\[[^\]]*\]/g, '').trim();

  let role: AuthorRole = 'author';
  text = text.replace(ROLE_TAIL, (_, tag: string) => {
    const lower = tag.toLowerCase();
    if (lower.startsWith('ed')) role = 'editor';
    else if (lower.startsWith('dir')) role = 'director';
    return '';
  });

  if (!text.includes(',') || isInstitutionAuthor(text, citationHtml)) {
    const etAl = /,?\s*et al\.?$/.test(text);
    const institution = text.replace(/,?\s*et al\.?$/, '').split(',')[0]!.trim();
    return { kind: 'institution', people: [], institution, etAl, role, alias };
  }

  const byline = parseChicagoByline(text);
  const people = byline.people
    .filter((person) => person.family)
    .map((person) => withParticles(splitSuffix({ family: person.family.trim(), given: person.given.trim(), suffix: person.suffix.trim() })));
  return { kind: 'person', people, institution: '', etAl: byline.etAl, role, alias };
}

/** `George C.` → `['george', 'c']`. */
function givenTokens(given: string): string[] {
  return foldName(given)
    .replace(/[.']/g, ' ')
    .split(/[\s]+/)
    .filter(Boolean);
}

/** Whether two spellings could be one person: same family name and compatible given names, initials matching full names. */
export function namesCompatible(a: PersonName, b: PersonName): boolean {
  if (searchKey(a.family).replace(/ /g, '') !== searchKey(b.family).replace(/ /g, '')) return false;
  if (a.suffix && b.suffix && searchKey(a.suffix) !== searchKey(b.suffix)) return false;
  const ta = givenTokens(a.given);
  const tb = givenTokens(b.given);
  if (ta.length === 0 || tb.length === 0) return ta.length === tb.length;
  const shared = Math.min(ta.length, tb.length);
  for (let i = 0; i < shared; i++) {
    const x = ta[i]!;
    const y = tb[i]!;
    if (x.length > 1 && y.length > 1) {
      if (x !== y) return false;
    } else if (x[0] !== y[0]) {
      return false;
    }
  }
  return true;
}

/** One person after merging: the spelling shown, and every spelling that led here. */
export interface MergedPerson {
  canonical: PersonName;
  /** Distinct spellings seen (display form), canonical first. */
  variants: string[];
  /** Index into the input's spellings, so callers can map each one to its person. */
  members: number[];
}

/**
 * Groups spellings of one person. Longest spellings seed the groups; a
 * shorter one joins the single group it is compatible with. A spelling
 * compatible with two incompatible groups (`J. Smith` with `John` and `Jane`)
 * is left alone and reported in `ambiguous`.
 *
 * @param spellings - Every distinct spelling, in a stable order.
 * @param counts - How often each was seen; the commonest of equal-length spellings becomes the canonical one.
 */
export function mergeNameVariants(
  spellings: PersonName[],
  counts: number[] = spellings.map(() => 1),
): { people: MergedPerson[]; ambiguous: number[] } {
  const order = spellings
    .map((_, index) => index)
    .sort((x, y) => {
      const lengthDiff = givenTokens(spellings[y]!.given).join('').length - givenTokens(spellings[x]!.given).join('').length;
      return lengthDiff || (counts[y] ?? 1) - (counts[x] ?? 1) || displayName(spellings[x]!).localeCompare(displayName(spellings[y]!));
    });
  const groups: MergedPerson[] = [];
  const ambiguous: number[] = [];
  for (const index of order) {
    const spelling = spellings[index]!;
    const fits = groups.filter((group) => namesCompatible(group.canonical, spelling));
    if (fits.length === 1) {
      const group = fits[0]!;
      group.members.push(index);
      group.variants.push(displayName(spelling));
    } else {
      if (fits.length > 1) ambiguous.push(index);
      groups.push({ canonical: spelling, variants: [displayName(spelling)], members: [index] });
    }
  }
  return { people: groups, ambiguous };
}
