/**
 * @fileoverview A scrolling ticker of the 20 best college partnerships of all
 * time, under the trophy on the Greatest of All-Time banner. The teams come
 * from the "All seasons: NDT points" table in its default mode ("teams, with
 * partners' points"), so the ticker follows that table's weights. Each item
 * shows the team as the site names it (school logo, else school name, then
 * the debaters' last names), a "#1 ALL TIME" badge and its NDT years, and
 * links to the team's page, which lists its videos. Cards are white so dark
 * wordmark logos stay readable on the black banner.
 *
 * The NDT history loads after mount, so the banner renders without it and
 * the ticker fades in once ready. The list is drawn twice and slid left by
 * half its width for a seamless loop; the copy is hidden from screen readers
 * and the keyboard. Hovering or focusing pauses it, and readers who prefer
 * reduced motion get a still row they can scroll by hand.
 *
 * @module components/category-gallery/GoatTopTeamsTicker
 */

"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  loadNdtAllTimeTopTeams,
  type NdtAllTimeTopTeam,
} from "@debate-ai/rankings/src/leaderboard/profile/ndtAllTimeRanks";
import { TeamLabel } from "@debate-ai/rankings/src/leaderboard/team-label/TeamLabel";

/** How many teams the ticker shows. */
export const GOAT_TICKER_TEAMS = 20;

/** Seconds per team for one full loop, so the speed stays even whatever the count. */
const SECONDS_PER_TEAM = 3.5;

const TICKER_CSS = `
.goat-ticker-track { animation: goat-ticker-scroll var(--goat-ticker-duration, 70s) linear infinite; }
.goat-ticker:hover .goat-ticker-track, .goat-ticker:focus-within .goat-ticker-track { animation-play-state: paused; }
@keyframes goat-ticker-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
@media (prefers-reduced-motion: reduce) {
  .goat-ticker { overflow-x: auto; }
  .goat-ticker-track { animation: none; }
  .goat-ticker-copy { display: none; }
}
`;

/** `2014–2015`, or one year when the team debated a single NDT. */
export function teamYears(team: Pick<NdtAllTimeTopTeam, "firstYear" | "lastYear">): string {
  return team.firstYear === team.lastYear ? String(team.firstYear) : `${team.firstYear}–${team.lastYear}`;
}

function TickerItem({ team, hidden }: { team: NdtAllTimeTopTeam; hidden?: boolean }) {
  return (
    <li className="shrink-0 px-1.5">
      <Link
        href={team.href}
        tabIndex={hidden ? -1 : undefined}
        title={`${team.team}, ${team.schoolName}: #${team.rank} team of all time (${team.total} NDT points). Watch their videos`}
        className="flex h-full flex-col items-center gap-1 rounded-lg border border-white/20 bg-white px-3 py-2 text-slate-900 shadow-sm transition-colors hover:border-sky-400 hover:bg-sky-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
      >
        <span className="rounded-full bg-gradient-to-r from-amber-300 to-yellow-500 px-2 py-px text-[10px] font-extrabold uppercase tracking-wide text-black">
          #{team.rank} All Time
        </span>
        <TeamLabel
          bare
          school={team.schoolName}
          debaters={team.debaters}
          title={`${team.schoolName} ${team.debaters}`}
          className="text-xs [&_img]:h-5 [&_svg]:h-5"
        />
        <span className="text-[10px] tabular-nums text-slate-500">{teamYears(team)}</span>
      </Link>
    </li>
  );
}

/**
 * The ticker itself, given its teams. Split from {@link GoatTopTeamsTicker}
 * so it renders on the server in tests.
 */
export function GoatTopTeamsTickerRow({ teams }: { teams: NdtAllTimeTopTeam[] }) {
  if (teams.length === 0) return null;
  const style = { "--goat-ticker-duration": `${teams.length * SECONDS_PER_TEAM}s` } as React.CSSProperties;
  return (
    <section
      aria-label={`Top ${teams.length} teams of all time`}
      className="goat-ticker relative z-20 w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_6%,#000_94%,transparent)]"
    >
      <style>{TICKER_CSS}</style>
      <div className="goat-ticker-track flex w-max" style={style}>
        <ul className="flex">
          {teams.map((team) => (
            <TickerItem key={team.href + team.rank} team={team} />
          ))}
        </ul>
        <ul className="goat-ticker-copy flex" aria-hidden>
          {teams.map((team) => (
            <TickerItem key={team.href + team.rank} team={team} hidden />
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Loads the all-time top teams and shows them scrolling; nothing until they load. */
export function GoatTopTeamsTicker() {
  const [teams, setTeams] = useState<NdtAllTimeTopTeam[]>([]);
  useEffect(() => {
    let live = true;
    loadNdtAllTimeTopTeams(GOAT_TICKER_TEAMS)
      .then((top) => {
        if (live) setTeams(top);
      })
      .catch(() => {
        // The banner simply shows no ticker.
      });
    return () => {
      live = false;
    };
  }, []);
  return <GoatTopTeamsTickerRow teams={teams} />;
}
