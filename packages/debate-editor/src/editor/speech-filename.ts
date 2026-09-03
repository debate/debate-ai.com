/** Speech-doc filename templating. Verbatim names a new speech doc
 *  from a fixed pattern; we let the user set the pattern instead.
 *
 *  Everything here is pure (the caller passes the clock) so the
 *  settings-UI live preview, the three creation call sites, and the
 *  tests all share one code path with no hidden state.
 *
 *  The extension is NOT part of the template. `defaultSpeechDocFormat`
 *  owns it, so a user editing the template can never produce a doc
 *  whose extension disagrees with its bytes. */

// Re-exported from its own file to avoid an import cycle with
// settings.ts: settings.ts needs the default for `DEFAULTS`, and
// this module needs `settings` for the `formatSpeechFilename`
// wrapper below.
export { DEFAULT_SPEECH_FILENAME_TEMPLATE } from './speech-filename-default.js';

import { settings } from './settings.js';

// English-only, on purpose. `toLocaleString` would make a filename
// depend on the machine locale, which makes filenames inconsistent
// across a team and makes the tests flaky.
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Token alternation for `formatDate`, LONGEST FIRST. Order is
 *  load-bearing: with `YY` before `YYYY`, a year would render as two
 *  glued two-digit years. The leading `[...]` branch is the escape
 *  hatch for a literal letter inside a date format.
 *
 *  Doubled token = zero-padded, single = not. That is the day.js /
 *  moment / Luxon convention, which is what most people have already
 *  half-absorbed from other tools. */
const DATE_TOKEN_RE =
  /\[([^\]]*)\]|YYYY|YY|MMMM|MMM|MM|M|dddd|ddd|DD|D|HH|H|hh|h|mm|m|ss|s|A|a/g;

/** Format a date with readable tokens (`YYYY-MM-DD`, `h-mmA`) rather
 *  than strftime's `%Y-%m-%d`. Anything that is not a token is
 *  literal, so separators need no escaping.
 *
 *  Letters ARE tokens, so a literal word inside a date format needs
 *  brackets: `{date:h-mmA [on] MMM D}`. Text outside the `{date:...}`
 *  block never needs them — that is the point of scoping tokens to
 *  the block instead of the whole template. */
export function formatDate(fmt: string, d: Date): string {
  const p2 = (n: number) => String(n).padStart(2, '0');
  const hour24 = d.getHours();
  const hour12 = hour24 % 12 || 12; // 0 -> 12, 13 -> 1
  const tokens: Record<string, string> = {
    YYYY: String(d.getFullYear()),
    YY: String(d.getFullYear()).slice(-2),
    MMMM: MONTHS_FULL[d.getMonth()]!,
    MMM: MONTHS_SHORT[d.getMonth()]!,
    MM: p2(d.getMonth() + 1),
    M: String(d.getMonth() + 1),
    dddd: DAYS_FULL[d.getDay()]!,
    ddd: DAYS_SHORT[d.getDay()]!,
    DD: p2(d.getDate()),
    D: String(d.getDate()),
    HH: p2(hour24),
    H: String(hour24),
    hh: p2(hour12),
    h: String(hour12),
    mm: p2(d.getMinutes()),
    m: String(d.getMinutes()),
    ss: p2(d.getSeconds()),
    s: String(d.getSeconds()),
    A: hour24 < 12 ? 'AM' : 'PM',
    a: hour24 < 12 ? 'am' : 'pm',
  };
  return fmt.replace(DATE_TOKEN_RE, (whole, literal?: string) =>
    // `literal` is undefined for a token match, and '' for an empty
    // `[]`, so test against undefined rather than truthiness.
    literal !== undefined ? literal : (tokens[whole] ?? whole),
  );
}

/** Substitute the template fields. `{speech}` is the text the user
 *  typed at the "Which speech?" prompt (1NC, 2AC vs Hogwarts…);
 *  `{date:FMT}` is a token-formatted date. An unknown field stays
 *  literal, so a typo is visible in the settings preview instead of
 *  silently eating part of the name. */
export function renderSpeechName(
  template: string,
  speech: string,
  now: Date,
): string {
  return template.replace(/\{(speech|date:[^}]*)\}/g, (_whole, body: string) =>
    body === 'speech' ? speech : formatDate(body.slice('date:'.length), now),
  );
}

/** Make a rendered name safe to use as one path segment.
 *
 *  This is a trust boundary, not cosmetics. The result flows into
 *  `joinSpeechDocPath` and then straight to a filesystem write with
 *  no further checks, so a speech name of `1NC/../../evil` would
 *  otherwise write outside the user's chosen folder. */
export function sanitizeFilename(name: string): string {
  const cleaned = name
    // Path separators and the colon become a hyphen rather than
    // vanishing. These three are exactly the characters that show up
    // in a legitimate date format, and deleting them silently mushes
    // the digits together: `DD/MM/YYYY` would give `12042026` and
    // `hh:mm` would give `0705`. A hyphen keeps the fields readable
    // and is still a single path segment.
    .replace(/[/\\:]/g, '-')
    // The rest of the Windows-illegal set is dropped. Unlike the
    // three above, these never appear in a date format on purpose.
    .replace(/[*?"<>|]/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.]+/, '')
    .slice(0, 200)
    // Trim again: the slice can expose new trailing junk, and a
    // trailing dot or space is silently dropped by Windows.
    .replace(/[\s.]+$/, '');
  // Windows refuses the DOS device names as a basename regardless of
  // extension (CON.docx is as unwritable as CON). Not hypothetical
  // here: "Con" is the negative side's name in Public Forum, so a
  // template of just {speech} produces exactly this. Prefix rather
  // than drop, so the name stays recognizable.
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(cleaned)) {
    return `_${cleaned}`;
  }
  return cleaned || 'Speech';
}

/** Render, sanitize, then append the extension. The one entry point
 *  the creation call sites and the settings preview both use. */
export function renderSpeechFilename(
  template: string,
  speech: string,
  format: 'cmir' | 'docx',
  now: Date,
): string {
  return `${sanitizeFilename(renderSpeechName(template, speech, now))}.${format}`;
}

/** The wrapper the creation call sites use: reads the template and
 *  the format setting, stamps the current time. Same signature as
 *  the two per-file copies it replaces, so no call site changes. */
export function formatSpeechFilename(
  speech: string,
  format: 'cmir' | 'docx',
): string {
  return renderSpeechFilename(
    settings.get('speechDocFilenameTemplate'),
    speech,
    format,
    new Date(),
  );
}
