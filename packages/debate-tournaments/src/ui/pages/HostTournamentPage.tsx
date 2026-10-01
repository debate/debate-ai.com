"use client";

import { type ComponentType } from "react";
import { CalendarRange, Computer, MapPin, ExternalLink } from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle, buttonVariants } from "../primitives";
import { BackLink, Section, useTournaments } from "../shared";

export type ScheduledType = "virtual" | "in-person" | "long-term-online";

interface TournamentTypeOption {
  type: ScheduledType;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  details: string;
};

const TOURNAMENT_TYPES: TournamentTypeOption[] = [
  {
    type: "virtual",
    title: "Virtual",
    description: "Fully remote tournament — rounds happen online via video.",
    icon: Computer,
    details: "All rounds are run remotely. Participants join from anywhere with a stable internet connection.",
  },
  {
    type: "in-person",
    title: "In-Person",
    description: "A physical tournament at a single location.",
    icon: MapPin,
    details: "Rounds happen at a physical venue. Best for local clubs and leagues.",
  },
  {
    type: "long-term-online",
    title: "Long-Term Online",
    description: "Online tournament spread across multiple days or weeks.",
    icon: CalendarRange,
    details: "Schedule rounds over an extended period — ideal for online leagues and mail-in style rounds.",
  },
];

/** A page for starting your own tournament. Presents the three scheduled
 * tournament types (virtual, in-person, long-term online), each linking to
 * Tabroom's creation flow. Read-only — the actual tournament is hosted on
 * Tabroom. */
export function HostTournamentPage() {
  const { hrefs } = useTournaments();
  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      <BackLink href={hrefs.upcoming()}>All tournaments</BackLink>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Host a Tournament</h1>
        <p className="text-sm text-muted-foreground">
          Tournaments are hosted on Tabroom. Pick a format to get started, then create the tournament there.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {TOURNAMENT_TYPES.map((option) => (
          <TournamentTypeCard key={option.type} option={option} />
        ))}
      </div>

      <Section title="How it works">
        <ul className="divide-y text-sm">
          <li className="flex items-start gap-3 px-4 py-3">
            <Badge variant="outline" className="mt-0.5">
              1
            </Badge>
            <span>
              <strong className="font-medium">Choose a format.</strong> Virtual, in-person, or long-term online — whichever works for your schedule.
            </span>
          </li>
          <li className="flex items-start gap-3 px-4 py-3">
            <Badge variant="outline" className="mt-0.5">
              2
            </Badge>
            <span>
              <strong className="font-medium">Create on Tabroom.</strong> Tabroom handles registration, pairings, ballots and results.
            </span>
          </li>
          <li className="flex items-start gap-3 px-4 py-3">
            <Badge variant="outline" className="mt-0.5">
              3
            </Badge>
            <span>
              <strong className="font-medium">Share the invitation.</strong> Once your tournament is published, it appears in the upcoming list above.
            </span>
          </li>
        </ul>
      </Section>
    </div>
  );
}

function TournamentTypeCard({ option }: { option: TournamentTypeOption }) {
  const { icon: Icon } = option;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="h-5 w-5" />
          {option.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{option.description}</p>
        <p className="text-xs text-muted-foreground">{option.details}</p>
        <a
          href="https://beta.tabroom.com/user/home"
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Create on Tabroom
          <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
        </a>
      </CardContent>
    </Card>
  );
}
