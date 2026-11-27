/**
 * @fileoverview The four main format cards — College Policy, HS Policy,
 * Individual and Forum — each just a logo, a label and a video count. They
 * open the lecture library's category bar and sit at the top of every
 * division page (`/videos/college`, `/videos/policy`, `/videos/ld`,
 * `/videos/pf`), the open one drawn selected.
 */

import React from "react";
import Link from "next/link";
import { Landmark } from "lucide-react";
import { DIVISION_CONFIG, type Division } from "@debate-ai/rankings/src/leaderboard/leaderboardUtils";
import { cn } from "../../../ui/lib/utils";
import type { DebateStyle } from "../../../types/videos";

/** One of the main round collections shown as a card at the top of the bar. */
export interface MainFormatBadge {
  id: string;
  title: string;
  href: string;
  /** Rankings division whose logo the card reuses. */
  division: Division;
  /** Debate style the card's division page filters to. */
  style: DebateStyle;
}

/** The cards, in display order. */
export const MAIN_FORMAT_BADGES: MainFormatBadge[] = [
  { id: "college", title: "College Policy", href: "/videos/college", division: "NDT", style: 4 },
  { id: "policy", title: "HS Policy", href: "/videos/policy", division: "VCX", style: 1 },
  { id: "ld", title: "Individual", href: "/videos/ld", division: "VLD", style: 3 },
  { id: "pf", title: "Forum", href: "/videos/pf", division: "VPF", style: 2 },
];

const DIVISION_LOGOS: Record<string, string> = Object.fromEntries(
  DIVISION_CONFIG.map((config) => [config.value, config.logoSrc]),
);

/** The card id of the division page a debate style filter belongs to. */
export function formatBadgeIdForStyle(style: DebateStyle | "" | null | undefined): string | undefined {
  if (!style) return undefined;
  return MAIN_FORMAT_BADGES.find((badge) => badge.style === style)?.id;
}

interface FormatBadgeCardsProps {
  /** Video totals keyed by card id (`college`, `policy`, `ld`, `pf`). */
  counts?: Record<string, number | undefined>;
  /** Id of the card to draw selected: the division page being viewed. */
  activeId?: string;
}

/** The row of four format cards. */
export function FormatBadgeCards({ counts, activeId }: FormatBadgeCardsProps) {
  return (
    <ul aria-label="Main categories" className="flex flex-wrap gap-2">
      {MAIN_FORMAT_BADGES.map((badge) => (
        <FormatBadgeLink
          key={badge.id}
          badge={badge}
          count={counts?.[badge.id]}
          isActive={activeId === badge.id}
        />
      ))}
    </ul>
  );
}

/** A main-collection card: the rankings logo (or a glyph) over its name and count. */
function FormatBadgeLink({
  badge,
  count,
  isActive,
}: {
  badge: MainFormatBadge;
  count?: number;
  isActive: boolean;
}) {
  const logo = DIVISION_LOGOS[badge.division];
  return (
    <li className="list-none">
      <Link
        href={badge.href}
        scroll={false}
        prefetch={false}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "group flex h-full flex-col items-center gap-0.5 overflow-hidden rounded-lg border-[0.75px] border-border bg-background text-center shadow-sm transition-colors hover:border-primary/50 hover:bg-accent",
          isActive && "border-primary bg-primary/10 hover:bg-primary/15",
        )}
      >
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" className="h-24 w-24 object-contain" loading="lazy" />
        ) : (
          <Landmark className="h-24 w-24 text-muted-foreground" aria-hidden />
        )}
        <span className="whitespace-nowrap text-sm font-semibold leading-tight text-foreground">
          {badge.title}
        </span>
        {count !== undefined && (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
            {count}
          </span>
        )}
      </Link>
    </li>
  );
}
