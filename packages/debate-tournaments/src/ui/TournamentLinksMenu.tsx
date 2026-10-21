"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { CalendarClock, ChevronDown, Download, ExternalLink } from "lucide-react";
import type { TournamentInvite, TournamentSource } from "./client";
import { buttonVariants, cn } from "./primitives";
import { formatDate, useTournaments } from "./shared";
import {
  TABROOM_CLASSIC_ORIGIN,
  sidebarFromInvite,
  tabroomTournamentLinks,
  type SidebarLink,
  type TournamentSidebar,
} from "../sidebar";

/** Tabroom's own pages that this site also has, so the menu opens ours and links Tabroom's beside it. */
const OWN_PAGES: Record<string, "tournament" | "rounds" | "results"> = {
  Invitation: "tournament",
  Pairings: "rounds",
  Results: "results",
};

/** Sidebar groups shown first, in this order; any other group Tabroom adds follows them. */
const GROUP_ORDER = ["Pages & Uploads", "Circuits"];
/** Groups covered by the common Tabroom links, which are shown instead. */
const COMMON_GROUPS = new Set(["General"]);

/**
 * The tournament's sidebar from Tabroom — uploads and pages, circuits, past
 * editions, dates and deadlines — plus the pages every Tabroom tournament has,
 * in a dropdown beside the tournament tabs. A live tournament's sidebar is
 * scraped by the host (`client.sidebar`) the first time the menu is hovered or
 * opened; until then, and when that fails, it is built from the invite. Empty
 * groups are left out.
 */
export function TournamentLinksMenu({ invite, source = "hosted" }: { invite: TournamentInvite; source?: TournamentSource }) {
  const { client, hrefs, Link } = useTournaments();
  const [open, setOpen] = useState(false);
  const [scraped, setScraped] = useState<TournamentSidebar | null>(null);
  const requested = useRef(false);
  const root = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const live = source === "tabroom";

  const load = () => {
    if (!live || requested.current) return;
    requested.current = true;
    client.sidebar(invite.id).then((found) => {
      if (found) setScraped(found);
      else requested.current = false;
    });
  };

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const sidebar =
    scraped ??
    sidebarFromInvite(invite, {
      fileUrl: (file) => client.fileUrl(invite.id, file),
      pageHref: (page) =>
        live
          ? `${TABROOM_CLASSIC_ORIGIN}/index/tourn/main.mhtml?webpage_id=${page.id}&tourn_id=${invite.id}`
          : `${hrefs.tournament(invite.id)}#page-${page.id}`,
      formatDate: (value, withTime) => formatDate(value, invite.tz, withTime),
    });
  const common = live ? tabroomTournamentLinks(invite.id, invite.webname) : [];
  const commonHrefs = new Set(common.map((l) => l.href));
  // Anything in Tabroom's General box the common list doesn't already carry.
  const extraGeneral = sidebar.groups
    .filter((g) => COMMON_GROUPS.has(g.title))
    .flatMap((g) => g.links)
    .filter((l) => !commonHrefs.has(l.href) && !/main\.mhtml\?tourn_id=\d+$/.test(l.href));
  const groups = sidebar.groups
    .filter((g) => !COMMON_GROUPS.has(g.title))
    .sort((a, b) => rank(a.title) - rank(b.title));
  const [leading, trailing] = [
    groups.filter((g) => GROUP_ORDER.includes(g.title)),
    groups.filter((g) => !GROUP_ORDER.includes(g.title)),
  ];
  const pastEditions = sidebar.pastEditions ?? common.find((l) => l.label === "Past Years' Editions")?.href ?? null;
  const tabroomLinks = [...common.filter((l) => l.label !== "Past Years' Editions"), ...extraGeneral];

  if (groups.length === 0 && sidebar.deadlines.length === 0 && tabroomLinks.length === 0) return null;

  return (
    <div ref={root} className="relative" onPointerEnter={load} onFocus={load}>
      <button
        type="button"
        className={buttonVariants({ variant: "outline", size: "sm", className: "h-9" })}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          load();
          setOpen((v) => !v);
        }}
      >
        Info &amp; links
        <ChevronDown className={cn("transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <div
          id={panelId}
          className="absolute left-0 top-full z-50 mt-1 max-h-[70vh] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto rounded-md border bg-popover p-1 text-sm text-popover-foreground shadow-md sm:left-auto sm:right-0"
        >
          {leading.map((g) => (
            <Group key={g.title} title={g.title}>
              {g.links.map((l) => (
                <OutLink key={l.href + l.label} link={l} />
              ))}
              {g.title === "Circuits" && pastEditions ? <OutLink link={{ label: "Past Years' Editions", href: pastEditions }} strong /> : null}
            </Group>
          ))}
          {pastEditions && !leading.some((g) => g.title === "Circuits") ? (
            <Group title="Past Years' Editions">
              <OutLink link={{ label: "Past Years' Editions", href: pastEditions }} strong />
            </Group>
          ) : null}
          {sidebar.deadlines.length > 0 && (
            <Group title="Dates & Deadlines" aside={sidebar.tz ?? undefined}>
              <dl className="px-2 pb-1">
                {sidebar.deadlines.map((d) => (
                  <div key={d.label} className="flex items-baseline justify-between gap-3 py-1" title={d.note}>
                    <dt className="flex items-center gap-1.5 font-medium">
                      <CalendarClock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                      {d.label}
                    </dt>
                    <dd className="text-right text-muted-foreground tabular-nums">{d.value}</dd>
                  </div>
                ))}
              </dl>
            </Group>
          )}
          {tabroomLinks.length > 0 && (
            <Group title="On Tabroom">
              {tabroomLinks.map((l) => {
                const own = OWN_PAGES[l.label];
                if (!own) return <OutLink key={l.href} link={l} />;
                const href = own === "tournament" ? hrefs.tournament(invite.id) : own === "rounds" ? hrefs.rounds(invite.id) : hrefs.results(invite.id);
                return (
                  <div key={l.href} className="flex items-center rounded-sm hover:bg-accent hover:text-accent-foreground">
                    <Link href={href} className="min-w-0 flex-1 truncate px-2 py-1.5">
                      {l.label}
                    </Link>
                    <a
                      href={l.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-1.5 text-muted-foreground hover:text-foreground"
                      title={`${l.label} on Tabroom`}
                      aria-label={`${l.label} on Tabroom`}
                    >
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    </a>
                  </div>
                );
              })}
            </Group>
          )}
          {trailing.map((g) => (
            <Group key={g.title} title={g.title}>
              {g.links.map((l) => (
                <OutLink key={l.href + l.label} link={l} />
              ))}
            </Group>
          ))}
        </div>
      )}
    </div>
  );
}

function rank(title: string): number {
  const i = GROUP_ORDER.indexOf(title);
  return i < 0 ? GROUP_ORDER.length : i;
}

function Group({ title, aside, children }: { title: string; aside?: string; children: ReactNode }) {
  return (
    <section className="border-b py-1 last:border-b-0">
      <h3 className="flex items-center justify-between px-2 py-1 text-xs font-semibold text-muted-foreground">
        {title}
        {aside ? <span className="font-normal">{aside}</span> : null}
      </h3>
      {children}
    </section>
  );
}

/** A sidebar link; Tabroom pages and files open in a new tab, a hosted tournament's own pages in place. */
function OutLink({ link, strong }: { link: SidebarLink; strong?: boolean }) {
  const { Link } = useTournaments();
  const external = /^(https?:|mailto:)/.test(link.href);
  const className = cn(
    "flex items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-accent hover:text-accent-foreground",
    strong && "font-medium",
  );
  const body = (
    <>
      <span className="min-w-0 flex-1 truncate">{link.label}</span>
      {link.download ? (
        <Download className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
      ) : external && !link.href.startsWith("mailto:") ? (
        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
      ) : null}
    </>
  );
  if (!external) {
    return (
      <Link href={link.href} className={className} title={link.title}>
        {body}
      </Link>
    );
  }
  return (
    <a href={link.href} target="_blank" rel="noopener noreferrer" className={className} title={link.title ?? link.label}>
      {body}
    </a>
  );
}
