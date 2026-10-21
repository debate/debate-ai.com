/**
 * A tournament's Tabroom sidebar: the "Pages & Uploads", "Circuits", "Past
 * Years' Editions" and "Dates & Deadlines" boxes beside every invitation on
 * classic Tabroom (`www.tabroom.com/index/tourn/main.mhtml?tourn_id=…`), plus
 * the links every Tabroom tournament has (entries, judges, pairings, …).
 *
 * Tabroom's API (`api.tabroom.com/v1`) returns the uploads and pages but not
 * the circuits, deadlines or past editions, so the host app scrapes the
 * classic page (`parseTabroomSidebar`) and serves the result as JSON; see
 * `tabroom-beta-proxy.ts` in debate-webview. Plain string parsing, no DOM, so
 * it runs in a Cloudflare Worker. Tournaments hosted on this site build the
 * same shape from their invite instead (`sidebarFromInvite`).
 */

import type { TournamentInvite } from "./ui/client";

export const TABROOM_CLASSIC_ORIGIN = "https://www.tabroom.com";

/** Where a tournament's invitation (and its sidebar) lives on classic Tabroom. */
export const tabroomInviteUrl = (tournId: number) => `${TABROOM_CLASSIC_ORIGIN}/index/tourn/main.mhtml?tourn_id=${tournId}`;

export interface SidebarLink {
  label: string;
  href: string;
  /** Tabroom's tooltip, e.g. a circuit's full name. */
  title?: string;
  /** A posted file, downloaded rather than opened as a page. */
  download?: boolean;
}

export interface SidebarGroup {
  /** As Tabroom heads it: "Pages & Uploads", "Circuits", "Contacts", … */
  title: string;
  links: SidebarLink[];
}

export interface SidebarDeadline {
  label: string;
  /** As Tabroom prints it, in the tournament's time zone (e.g. "Thu Oct 15 at 3:00 PM"). */
  value: string;
  /** Tabroom's explanation of the deadline, when it gives one. */
  note?: string;
}

export interface TournamentSidebar {
  groups: SidebarGroup[];
  /** The tournament's earlier years, when Tabroom links them. */
  pastEditions: string | null;
  deadlines: SidebarDeadline[];
  /** The time zone abbreviation the deadlines are printed in, e.g. "CDT". */
  tz: string | null;
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  hellip: "…",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === "#") {
      const n = code[1]?.toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : whole;
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

/** An element's text: tags dropped, entities decoded, whitespace collapsed. */
function textOf(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function attr(tag: string, name: string): string | null {
  const match = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i").exec(tag);
  return match ? decodeEntities(match[1] ?? match[2] ?? "").trim() : null;
}

/** Resolves a sidebar href against the invite page; null for anything but http(s) and mailto. */
function resolveHref(href: string): string | null {
  try {
    const url = new URL(href, `${TABROOM_CLASSIC_ORIGIN}/index/tourn/`);
    return url.protocol === "https:" || url.protocol === "http:" || url.protocol === "mailto:" ? url.href : null;
  } catch {
    return null;
  }
}

const TOKEN =
  /<h6[^>]*>([\s\S]*?)<\/h6>|<h4[^>]*>([\s\S]*?)<\/h4>|(<a\b[^>]*>)([\s\S]*?)<\/a>|(<div\b[^>]*class\s*=\s*"[^"]*\brow\b[^"]*"[^>]*>)([\s\S]*?)<\/div>/gi;

/**
 * Reads the sidebar out of a classic Tabroom invitation page. Groups with no
 * links are left out; a page with no sidebar gives an empty one.
 */
export function parseTabroomSidebar(html: string): TournamentSidebar {
  const sidebar: TournamentSidebar = { groups: [], pastEditions: null, deadlines: [], tz: null };
  const start = html.search(/<div\b[^>]*class\s*=\s*"menu"/i);
  if (start < 0) return sidebar;
  const end = html.indexOf('id="footer"', start);
  const menu = html.slice(start, end < 0 ? undefined : end);

  let group: SidebarGroup | null = null;
  let inDeadlines = false;
  for (const m of menu.matchAll(TOKEN)) {
    const [, h6, h4, aTag, aBody, rowTag, rowBody] = m;
    if (h6 !== undefined) {
      inDeadlines = false;
      group = { title: textOf(h6), links: [] };
      sidebar.groups.push(group);
    } else if (h4 !== undefined) {
      inDeadlines = /deadline/i.test(textOf(h4));
      group = null;
      if (inDeadlines) {
        const tz = /<span[^>]*\bexplain\b[^>]*>\s*([A-Z]{2,5})\s*<\/span>/.exec(menu.slice(m.index ?? 0));
        sidebar.tz = tz?.[1] ?? null;
      }
    } else if (aTag !== undefined) {
      const href = resolveHref(attr(aTag, "href") ?? "");
      const label = textOf(aBody ?? "");
      if (!href || !label) continue;
      if (/\/past\.mhtml/.test(href)) {
        sidebar.pastEditions = href;
        continue;
      }
      if (!group) continue;
      const title = attr(aTag, "title");
      group.links.push({
        label,
        href,
        ...(title && title !== label ? { title } : {}),
        ...(/fa-download/.test(aBody ?? "") ? { download: true } : {}),
      });
    } else if (rowTag !== undefined && inDeadlines) {
      const cells = [...(rowBody ?? "").matchAll(/<span[^>]*>([\s\S]*?)<\/span>/gi)].map((c) => textOf(c[1] ?? ""));
      const [label, value] = cells;
      if (!label || !value) continue;
      const note = attr(rowTag, "title");
      sidebar.deadlines.push({ label, value, ...(note ? { note } : {}) });
    }
  }
  sidebar.groups = sidebar.groups.filter((g) => g.links.length > 0);
  return sidebar;
}

/**
 * The pages every Tabroom tournament has, on classic Tabroom: the tab strip
 * above each invitation (Invite, Entries, Judges, Pairings, Live Updates,
 * Results) and the sidebar's General box.
 */
export function tabroomTournamentLinks(tournId: number, webname?: string | null): SidebarLink[] {
  const page = (path: string) => `${TABROOM_CLASSIC_ORIGIN}/index/tourn/${path}tourn_id=${tournId}`;
  return [
    { label: "Invitation", href: page("main.mhtml?") },
    { label: "Entries", href: page("fields.mhtml?") },
    { label: "Judges", href: page("judges.mhtml?") },
    { label: "Pairings", href: page("postings/index.mhtml?") },
    { label: "Live Updates", href: page("updates/index.mhtml?") },
    { label: "Results", href: page("results/index.mhtml?") },
    { label: "Events & Divisions", href: page("events.mhtml?") },
    { label: "Institutions In Attendance", href: page("schools.mhtml?") },
    { label: "Email Archive", href: page("emails.mhtml?") },
    {
      label: "Past Years' Editions",
      href: webname
        ? `${TABROOM_CLASSIC_ORIGIN}/index/tourn/past.mhtml?webname=${encodeURIComponent(webname)}`
        : page("past.mhtml?"),
    },
  ];
}

/**
 * The same sidebar built from a tournament's invite: its uploads and pages,
 * contacts, and dates. Used for tournaments hosted on this site, and for a
 * Tabroom tournament whose classic page could not be read.
 */
export function sidebarFromInvite(
  invite: Pick<TournamentInvite, "Files" | "Webpages" | "Contacts" | "start" | "end" | "reg_start" | "reg_end" | "tz">,
  {
    fileUrl,
    pageHref,
    formatDate,
  }: {
    fileUrl: (file: TournamentInvite["Files"][number]) => string | null;
    pageHref: (page: TournamentInvite["Webpages"][number]) => string;
    formatDate: (value: string, withTime: boolean) => string;
  },
): TournamentSidebar {
  const uploads: SidebarLink[] = [];
  for (const file of invite.Files ?? []) {
    const href = fileUrl(file);
    const label = file.label || file.filename;
    if (href && label) uploads.push({ label, href, download: true });
  }
  const pages = (invite.Webpages ?? [])
    .filter((page) => page.title && page.special !== "main")
    .map((page) => ({ label: page.title as string, href: pageHref(page) }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const contacts = (invite.Contacts ?? [])
    .filter((c) => c.email)
    .map((c) => ({ label: [c.first, c.last].filter(Boolean).join(" ") || (c.email as string), href: `mailto:${c.email}` }));

  const deadlines: SidebarDeadline[] = [];
  if (invite.start) {
    const from = formatDate(invite.start, false);
    const to = invite.end ? formatDate(invite.end, false) : "";
    deadlines.push({ label: "Tournament Dates", value: to && to !== from ? `${from} to ${to}` : from });
  }
  if (invite.reg_start) deadlines.push({ label: "Registration Opens", value: formatDate(invite.reg_start, true) });
  if (invite.reg_end) deadlines.push({ label: "Registration Closes", value: formatDate(invite.reg_end, true) });

  return {
    groups: [
      { title: "Pages & Uploads", links: [...uploads, ...pages] },
      { title: "Contacts", links: contacts },
    ].filter((g) => g.links.length > 0),
    pastEditions: null,
    deadlines,
    tz: null,
  };
}
