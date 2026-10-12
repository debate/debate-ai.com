"use client";

import { ExternalLink } from "lucide-react";
import { buttonVariants } from "../primitives";
import { BackLink, useTournaments } from "../shared";

/** The Tabroom site framed for this specific tournament, so you can register,
 * submit ballots and access Tabroom-only admin tools without leaving the app.
 * Linked to from the Tabroom tab in the tournament nav. */
export function TabroomTournamentPage({ tournId, name }: { tournId: number; name?: string }) {
  const { hrefs } = useTournaments();
  const src = `https://beta.tabroom.com/invite/${tournId}`;
  return (
    <div className="space-y-3">
      <BackLink href={hrefs.tournament(tournId)}>{name || "Tournament"} overview</BackLink>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          You are viewing Tabroom's own page for this tournament. Use it to register, enter ballots and manage entries.
        </p>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Open in new tab
          <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
        </a>
      </div>
      <div className="rounded-lg border bg-card">
        <iframe
          src={src}
          title={`Tabroom: ${name ?? tournId}`}
          loading="lazy"
          className="h-[calc(100dvh-140px)] w-full border-0"
        />
      </div>
    </div>
  );
}
