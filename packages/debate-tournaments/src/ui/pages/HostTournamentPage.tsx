"use client";

/**
 * Creating a tournament from inside this app.
 *
 * The page posts to the package's own API (`POST {apiBase}/host/tourns`, see
 * `../../host/router`) rather than sending the host to Tabroom, and every
 * tournament gets its events written from the three styles in
 * `../../host/formats`: pick Policy, LD, Public Forum or any combination, then
 * customize each one — the division it runs in, how entries are written in
 * pairings, a per-school entry cap, a fee, and extra text for the invite.
 *
 * Nothing is created on Tabroom: the tournament lives in this site's hosting
 * API, and its admins manage it from the admin web view
 * (`./TournamentAdminPage`), which the demo tournament lets anyone try as a
 * mock admin.
 */

import { useState, type ComponentType, type FormEvent, type ReactNode } from "react";
import { CalendarRange, Check, Computer, MapPin, Plus, ShieldCheck } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  Textarea,
  buttonVariants,
} from "../primitives";
import { DEMO_TOURN_ID } from "../../host/demo-account";
import { BackLink, Section, useTournaments } from "../shared";
import { TOURNAMENT_FORMATS, formatSummary, type TournamentFormat } from "../../host/formats";
import type { CreateEventInput } from "../client";

export type ScheduledType = "virtual" | "in-person" | "long-term-online";

interface TournamentTypeOption {
  type: ScheduledType;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  details: string;
}

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

/** The per-format settings a host can change. */
interface EventDraft {
  level: "open" | "novice" | "jv";
  codeStyle: string;
  schoolCap: string;
  description: string;
  fee: string;
}

const eventDraft = (format: TournamentFormat): EventDraft => ({
  level: format.defaultLevel,
  codeStyle: format.defaultCodeStyle,
  schoolCap: "",
  description: "",
  fee: "",
});

const toEventInput = (formatId: string, draft: EventDraft): CreateEventInput => ({
  format: formatId as CreateEventInput["format"],
  level: draft.level,
  codeStyle: draft.codeStyle,
  schoolCap: draft.schoolCap.trim() === "" ? null : Number(draft.schoolCap),
  description: draft.description.trim(),
  fee: draft.fee.trim() === "" ? null : Number(draft.fee),
});

/** A `datetime-local` value as the ISO-8601-with-offset the API wants. */
const toIso = (value: string): string | undefined => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

const inThreeMonths = () => {
  const date = new Date();
  date.setMonth(date.getMonth() + 3);
  date.setHours(9, 0, 0, 0);
  return toLocalInput(date);
};

/** A `Date` as the `YYYY-MM-DDTHH:mm` a `datetime-local` input holds. */
function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Creates a tournament and links to the result. */
export function HostTournamentPage() {
  const { client, hrefs, Link } = useTournaments();

  const [name, setName] = useState("");
  const [scheduledType, setScheduledType] = useState<ScheduledType>("in-person");
  const [venue, setVenue] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("US");
  const [start, setStart] = useState(inThreeMonths);
  const [end, setEnd] = useState("");
  const [regEnd, setRegEnd] = useState("");
  const [currency, setCurrency] = useState("usd");
  const [picked, setPicked] = useState<string[]>(["policy"]);
  const [drafts, setDrafts] = useState<Record<string, EventDraft>>(() =>
    Object.fromEntries(TOURNAMENT_FORMATS.map((format) => [format.id, eventDraft(format)])),
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: number; name: string; webname: string } | null>(null);

  const toggle = (id: string) =>
    setPicked((current) => (current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]));

  const updateDraft = (id: string, patch: Partial<EventDraft>) =>
    setDrafts((current) => ({ ...current, [id]: { ...current[id], ...patch } }));

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const startIso = toIso(start);
    const endIso = toIso(end);
    if (!startIso || !endIso) {
      setError("Give the tournament a start and an end date.");
      return;
    }
    if (!picked.length) {
      setError("Pick at least one format to run.");
      return;
    }
    setSubmitting(true);
    try {
      const tournament = await client.createTournament({
        name: name.trim(),
        scheduledType,
        venue: venue.trim(),
        city: city.trim(),
        state: state.trim(),
        country: country.trim().toLowerCase(),
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        start: startIso,
        end: endIso,
        regEnd: toIso(regEnd),
        currency: currency.trim().toLowerCase(),
        events: picked.map((id) => toEventInput(id, drafts[id] ?? eventDraft(foundFormat(id)))),
      });
      setCreated(tournament);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "That tournament could not be created.");
    } finally {
      setSubmitting(false);
    }
  };

  if (created) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
        <BackLink href={hrefs.upcoming()}>All tournaments</BackLink>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Check className="h-4 w-4 text-emerald-600" aria-hidden />
              {created.name} is set up
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              You own it, and it is registered in every format you picked. Its admin view shows the events,
              entries, schools, judges, rooms and schedule as they fill in.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href={hrefs.admin(created.id)} className={buttonVariants({ size: "sm" })}>
                <ShieldCheck aria-hidden />
                Open the admin view
              </Link>
              <Link href={hrefs.tournament(created.id)} className={buttonVariants({ variant: "outline", size: "sm" })}>
                Public invite
              </Link>
              <Link href={hrefs.rounds(created.id)} className={buttonVariants({ variant: "outline", size: "sm" })}>
                Pairings
              </Link>
              <Link href={hrefs.upcoming()} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                All tournaments
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      <BackLink href={hrefs.upcoming()}>All tournaments</BackLink>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">Host a Tournament</h1>
          <p className="text-sm text-muted-foreground">
            Create it here: the tournament, its formats and your ownership are written to this site&rsquo;s hosting
            API, not to Tabroom, and you run it from its admin view. Sign in first.
          </p>
        </div>
        <Link href={hrefs.admin(DEMO_TOURN_ID)} className={buttonVariants({ variant: "outline", size: "sm" })}>
          <ShieldCheck aria-hidden />
          Try the demo admin
        </Link>
      </div>

      <form className="space-y-4" onSubmit={onSubmit}>
        <Section title="The tournament">
          <div className="grid gap-4 p-4 md:grid-cols-2">
            <Field label="Name" className="md:col-span-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Golden Gate Invitational" required minLength={3} maxLength={63} />
            </Field>
            <Field label="Starts">
              <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} required />
            </Field>
            <Field label="Ends">
              <Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} required />
            </Field>
            <Field label="Registration closes" hint="Leave blank to keep registration open until the tournament starts.">
              <Input type="datetime-local" value={regEnd} onChange={(e) => setRegEnd(e.target.value)} />
            </Field>
            <Field label="Entry fees are charged in" hint="ISO code, shown beside each entry fee.">
              <Input value={currency} onChange={(e) => setCurrency(e.target.value)} maxLength={3} placeholder="usd" />
            </Field>
          </div>
        </Section>

        <Section title="How it is held">
          <div className="grid gap-4 p-4 md:grid-cols-3">
            {TOURNAMENT_TYPES.map((option) => {
              const { icon: Icon } = option;
              const active = scheduledType === option.type;
              return (
                <button
                  key={option.type}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setScheduledType(option.type)}
                  className={`rounded-xl border p-3 text-left transition-colors ${
                    active ? "border-ring bg-accent/60" : "hover:bg-accent/40"
                  }`}
                >
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <Icon className="h-4 w-4" aria-hidden />
                    {option.title}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{option.description}</p>
                </button>
              );
            })}
          </div>
          <div className="grid gap-4 border-t p-4 md:grid-cols-4">
            <Field label="Venue" className="md:col-span-2">
              <Input
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                placeholder={scheduledType === "in-person" ? "Glenbrook High School" : "Online"}
                maxLength={63}
              />
            </Field>
            <Field label="City">
              <Input value={city} onChange={(e) => setCity(e.target.value)} maxLength={31} />
            </Field>
            <Field label="State / region">
              <Input value={state} onChange={(e) => setState(e.target.value)} maxLength={31} />
            </Field>
            <Field label="Country" hint="Two-letter code.">
              <Input value={country} onChange={(e) => setCountry(e.target.value)} maxLength={4} />
            </Field>
          </div>
        </Section>

        <Section title="Formats">
          <div className="divide-y">
            {TOURNAMENT_FORMATS.map((format) => {
              const active = picked.includes(format.id);
              const draft = drafts[format.id];
              return (
                <div key={format.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={active}
                          onClick={() => toggle(format.id)}
                          className={`inline-flex h-6 w-10 items-center rounded-full border transition-colors ${
                            active ? "bg-primary" : "bg-muted"
                          }`}
                        >
                          <span
                            className={`mx-0.5 h-4 w-4 rounded-full bg-background transition-transform ${
                              active ? "translate-x-4" : "translate-x-0"
                            }`}
                          />
                        </button>
                        {format.name}
                        {active ? <Badge variant="outline">{format.abbr}</Badge> : null}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{format.blurb}</p>
                    </div>
                  </div>

                  {active ? (
                    <div className="mt-3 grid gap-4 rounded-lg border bg-muted/30 p-3 md:grid-cols-2 lg:grid-cols-4">
                      <Field label="Division" hint="The category this format runs in.">
                        <Select value={draft.level} onChange={(e) => updateDraft(format.id, { level: e.target.value as EventDraft["level"] })}>
                          <option value="open">Open</option>
                          <option value="novice">Novice</option>
                          <option value="jv">JV</option>
                        </Select>
                      </Field>
                      <Field label="Entries written as" hint="How pairings and ballots name an entry.">
                        <Select value={draft.codeStyle} onChange={(e) => updateDraft(format.id, { codeStyle: e.target.value })}>
                          <option value="names">Names</option>
                          <option value="names_lastfirst">Names, last first</option>
                          <option value="initials">Initials</option>
                          <option value="last_names">Last names</option>
                          <option value="code_name">Code and name</option>
                          <option value="school_names">School and names</option>
                          <option value="school_number">School number</option>
                          <option value="numbers">Numbers</option>
                        </Select>
                      </Field>
                      <Field label="Entries per school" hint="Blank for no cap.">
                        <Input
                          type="number"
                          min={1}
                          max={50}
                          value={draft.schoolCap}
                          onChange={(e) => updateDraft(format.id, { schoolCap: e.target.value })}
                        />
                      </Field>
                      <Field label="Entry fee" hint={`Blank for free, in ${currency.toLowerCase() || "usd"}.`}>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={draft.fee}
                          onChange={(e) => updateDraft(format.id, { fee: e.target.value })}
                        />
                      </Field>
                      <Field label="Invite note" className="md:col-span-2 lg:col-span-4" hint={formatSummary(format)}>
                        <Textarea
                          value={draft.description}
                          onChange={(e) => updateDraft(format.id, { description: e.target.value })}
                          maxLength={2000}
                          placeholder="Anything else entrants should know about this format."
                        />
                      </Field>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </Section>

        {error ? (
          <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={submitting || !picked.length}>
            <Plus aria-hidden />
            {submitting ? "Creating…" : "Create tournament"}
          </Button>
          <p className="text-xs text-muted-foreground">
            {picked.length
              ? `Runs ${picked.map((id) => foundFormat(id).name).join(", ")}.`
              : "Pick at least one format above."}
          </p>
        </div>
      </form>

    </div>
  );
}

function foundFormat(id: string): TournamentFormat {
  return TOURNAMENT_FORMATS.find((format) => format.id === id) ?? TOURNAMENT_FORMATS[0];
}

function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <Label>{label}</Label>
      <div className="mt-1">{children}</div>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
