"use client";

/**
 * @fileoverview The markets the site opens itself, one division at a time:
 * this month's rating markets on the division's top five teams, then a
 * winner market for each major tournament still ahead, in date order.
 *
 * The presets are planned in `@debate/predictions` (`presets.ts`) and opened
 * by the board read; this only groups what the board returns.
 */

import { useMemo, type ReactNode } from "react";
import { CalendarDays, Medal } from "lucide-react";
import {
  MAJOR_TOURNAMENTS,
  PRESET_DIVISIONS,
  PRESET_TOP_TEAMS,
  type PredictionMarket,
  type PredictionWallet,
} from "@debate/predictions";

import { cn } from "../../lib/ui/lib/utils";
import { MarketCard } from "./MarketCard";

const tournamentOrder = new Map(MAJOR_TOURNAMENTS.map((tournament, index) => [tournament.slug, index]));

export interface FeaturedMarketsProps {
  /** Open preset markets from the board. */
  markets: readonly PredictionMarket[];
  wallet: PredictionWallet | null;
  now: number;
  division: string;
  onDivisionChange: (dataset: string) => void;
  onChanged: () => void;
  /** Renders one titled section; the panel passes its own card chrome. */
  section: (props: { title: string; icon: ReactNode; description: ReactNode; action?: ReactNode; children: ReactNode }) => ReactNode;
}

export function FeaturedMarkets({ markets, wallet, now, division, onDivisionChange, onChanged, section }: FeaturedMarketsProps) {
  const { topTeams, majors } = useMemo(() => {
    const inDivision = markets.filter((market) => market.preset?.dataset === division);
    return {
      topTeams: inDivision
        .filter((market) => market.preset?.group === "top-teams")
        .sort((a, b) => b.outcomes[0].price - a.outcomes[0].price || a.title.localeCompare(b.title)),
      majors: inDivision
        .filter((market) => market.preset?.group === "majors")
        .sort(
          (a, b) =>
            a.closesAt - b.closesAt ||
            (tournamentOrder.get(a.preset?.tournament ?? "") ?? 0) - (tournamentOrder.get(b.preset?.tournament ?? "") ?? 0),
        ),
    };
  }, [markets, division]);

  const label = PRESET_DIVISIONS.find((d) => d.dataset === division)?.label ?? division;

  const picker = (
    <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Division">
      {PRESET_DIVISIONS.map((option) => (
        <button
          key={option.dataset}
          type="button"
          role="tab"
          aria-selected={division === option.dataset}
          onClick={() => onDivisionChange(option.dataset)}
          className={cn(
            "h-7 rounded-full border px-3 text-xs font-medium",
            division === option.dataset ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-accent",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );

  const grid = (list: readonly PredictionMarket[]) => (
    <div className="grid gap-3 lg:grid-cols-2">
      {list.map((market) => (
        <MarketCard key={market.id} market={market} wallet={wallet} now={now} onChanged={onChanged} />
      ))}
    </div>
  );

  return (
    <>
      {section({
        title: `Top ${PRESET_TOP_TEAMS} teams`,
        icon: <Medal className="h-4 w-4" />,
        description: `Will each of the ${PRESET_TOP_TEAMS} highest-rated ${label} teams gain Glicko rating by the end of the month? These settle themselves; a new set opens every month.`,
        children: (
          <>
            {picker}
            {topTeams.length === 0 ? (
              <p className="text-sm text-muted-foreground">No {label} rankings to open these from yet.</p>
            ) : (
              grid(topTeams)
            )}
          </>
        ),
      })}
      {section({
        title: "Major tournaments",
        icon: <CalendarDays className="h-4 w-4" />,
        description: `Who wins ${label} at the season's biggest tournaments. Each lists the top-rated teams plus everyone else; betting closes when the tournament starts.`,
        children:
          majors.length === 0 ? (
            <p className="text-sm text-muted-foreground">No {label} majors left this season.</p>
          ) : (
            grid(majors)
          ),
      })}
    </>
  );
}
