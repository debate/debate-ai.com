"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { CheckCircle2, ExternalLink, XCircle } from "lucide-react";
import {
  emailsMatch,
  validateJudgeBallot,
  type BallotAccountCheck,
  type BallotDestination,
  type BallotSide,
  type StoredJudgeBallot,
} from "../../ballots";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Select, Textarea, buttonVariants } from "../primitives";
import { BackLink, Empty, ErrorNote, Loaded, useApi, useTournaments } from "../shared";

/** The pairing fields a link from a round's pairings (`?event=…&round=…`) can prefill. */
const PREFILL = ["event", "round", "room", "aff", "neg"] as const;
type Prefill = Partial<Record<(typeof PREFILL)[number], string>>;

function readPrefill(): Prefill {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const out: Prefill = {};
  for (const key of PREFILL) {
    const value = params.get(key);
    if (value) out[key] = value;
  }
  return out;
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal, credentials: "same-origin", headers: { accept: "application/json" } });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error((body && (body.error || body.detail)) || `Request failed (${res.status})`);
  return body as T;
}

/**
 * A judge's ballot for one round of this tournament. It can be submitted only
 * when the email of the Tabroom account it names matches the email the judge
 * is signed in with — checked here as they type, and again by the host's API,
 * which is the check that counts. The ballot always lands in the host's own
 * ballot API; "Tabroom" sends it on to Tabroom as well, with the judge's own
 * Tabroom token, which is passed through and never stored.
 */
export function BallotPage({ tournId, name, events = [] }: { tournId: number; name?: string; events?: readonly string[] }) {
  const { hrefs, ballotApiBase } = useTournaments();
  const base = (ballotApiBase ?? "").replace(/\/+$/, "");
  const [refresh, setRefresh] = useState(0);
  const account = useApi(`ballot-account:${base}`, (signal) =>
    base ? getJson<BallotAccountCheck>(`${base}/account`, signal) : Promise.reject(new Error("No ballot API.")),
  );
  const mine = useApi(`ballots:${base}:${tournId}:${refresh}`, (signal) =>
    !base ? Promise.resolve([]) : getJson<{ ballots: StoredJudgeBallot[] }>(`${base}?tournId=${tournId}`, signal).then((r) => r.ballots),
  );

  if (!ballotApiBase) return <Empty>Ballot submission is not set up on this site.</Empty>;
  return (
    <div className="space-y-4">
      <BackLink href={hrefs.tournament(tournId)}>{name || "Tournament"} overview</BackLink>
      <Loaded state={account}>
        {(check) =>
          check.signedIn && check.email ? (
            <BallotForm
              tournId={tournId}
              tournamentName={name}
              events={events}
              account={check}
              base={base}
              onSubmitted={() => setRefresh((n) => n + 1)}
            />
          ) : (
            <Empty>Sign in to Debate AI to submit a ballot. Your account email must match your Tabroom account.</Empty>
          )
        }
      </Loaded>
      {account.status === "ready" && account.data.signedIn ? (
        <Loaded state={mine}>{(ballots) => <SubmittedBallots ballots={ballots} />}</Loaded>
      ) : null}
    </div>
  );
}

function BallotForm({
  tournId,
  tournamentName,
  events,
  account,
  base,
  onSubmitted,
}: {
  tournId: number;
  tournamentName?: string;
  events: readonly string[];
  account: BallotAccountCheck;
  base: string;
  onSubmitted: () => void;
}) {
  const [prefill] = useState(readPrefill);
  const [tabroomEmail, setTabroomEmail] = useState(account.tabroomPerson?.email ?? account.email ?? "");
  const [event, setEvent] = useState(prefill.event ?? "");
  const [round, setRound] = useState(prefill.round ?? "");
  const [room, setRoom] = useState(prefill.room ?? "");
  const [aff, setAff] = useState(prefill.aff ?? "");
  const [neg, setNeg] = useState(prefill.neg ?? "");
  const [winner, setWinner] = useState<BallotSide | "">("");
  const [lowPointWin, setLowPointWin] = useState(false);
  const [points, setPoints] = useState<Array<{ speaker: string; side: BallotSide; points: string }>>([
    { speaker: "", side: "aff", points: "" },
    { speaker: "", side: "aff", points: "" },
    { speaker: "", side: "neg", points: "" },
    { speaker: "", side: "neg", points: "" },
  ]);
  const [rfd, setRfd] = useState("");
  const [destination, setDestination] = useState<BallotDestination>("local");
  const [tabroomToken, setTabroomToken] = useState("");
  const [status, setStatus] = useState<{ kind: "idle" | "sending" } | { kind: "done"; ballot: StoredJudgeBallot } | { kind: "error"; message: string }>({
    kind: "idle",
  });

  useEffect(() => {
    if (!account.tabroomForwarding && destination === "tabroom") setDestination("local");
  }, [account.tabroomForwarding, destination]);

  const match = emailsMatch(tabroomEmail, account.email);
  const sending = status.kind === "sending";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const speakerPoints = points
      .filter((p) => p.speaker.trim() || p.points.trim())
      .map((p) => ({ speaker: p.speaker, side: p.side, points: Number(p.points) }));
    const payload = {
      tournId,
      tournamentName,
      event,
      round,
      room,
      aff,
      neg,
      winner,
      lowPointWin,
      ...(speakerPoints.length ? { speakerPoints } : {}),
      rfd,
      tabroomEmail,
      destination,
    };
    const checked = validateJudgeBallot(payload);
    if (!checked.ok) return setStatus({ kind: "error", message: checked.errors.join(" ") });
    if (!match) return setStatus({ kind: "error", message: "Your Tabroom account email must match the email you are signed in with." });

    setStatus({ kind: "sending" });
    try {
      const res = await fetch(base, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          ...(destination === "tabroom" && tabroomToken.trim() ? { "x-tabroom-token": tabroomToken.trim() } : {}),
        },
        body: JSON.stringify(checked.ballot),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        const message = body?.errors?.join?.(" ") || body?.error || `Ballot was not submitted (${res.status}).`;
        return setStatus({ kind: "error", message });
      }
      setStatus({ kind: "done", ballot: body.ballot as StoredJudgeBallot });
      onSubmitted();
    } catch {
      setStatus({ kind: "error", message: "The ballot could not be sent. Check your connection and try again." });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Submit a ballot</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={submit} aria-label="Judge ballot">
          <div className="space-y-1.5">
            <Label htmlFor="ballot-tabroom-email">Tabroom account email</Label>
            <Input
              id="ballot-tabroom-email"
              type="email"
              autoComplete="email"
              value={tabroomEmail}
              onChange={(e) => setTabroomEmail(e.target.value)}
              required
            />
            <p className={`flex items-center gap-1.5 text-xs ${match ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`} role="status">
              {match ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> : <XCircle className="h-3.5 w-3.5" aria-hidden />}
              {match
                ? `Matches your Debate AI account (${account.email}).`
                : `Must match the email you are signed in to Debate AI with (${account.email}).`}
            </p>
            {account.tabroomPerson ? (
              <p className="text-xs text-muted-foreground">Tabroom account: {account.tabroomPerson.name}</p>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field id="ballot-event" label="Event">
              <Input id="ballot-event" list="ballot-events" value={event} onChange={(e) => setEvent(e.target.value)} placeholder="VCX" required />
              <datalist id="ballot-events">
                {events.map((abbr) => (
                  <option key={abbr} value={abbr} />
                ))}
              </datalist>
            </Field>
            <Field id="ballot-round" label="Round">
              <Input id="ballot-round" value={round} onChange={(e) => setRound(e.target.value)} placeholder="3 or Octas" required />
            </Field>
            <Field id="ballot-room" label="Room (optional)">
              <Input id="ballot-room" value={room} onChange={(e) => setRoom(e.target.value)} />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="ballot-aff" label="Aff / Pro entry">
              <Input id="ballot-aff" value={aff} onChange={(e) => setAff(e.target.value)} required />
            </Field>
            <Field id="ballot-neg" label="Neg / Con entry">
              <Input id="ballot-neg" value={neg} onChange={(e) => setNeg(e.target.value)} required />
            </Field>
          </div>

          <fieldset className="space-y-1.5">
            <legend className="text-xs font-medium text-muted-foreground">Decision</legend>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              {(["aff", "neg"] as const).map((side) => (
                <label key={side} className="flex items-center gap-1.5">
                  <input type="radio" name="ballot-winner" value={side} checked={winner === side} onChange={() => setWinner(side)} required />
                  {side === "aff" ? `Aff wins${aff ? ` (${aff})` : ""}` : `Neg wins${neg ? ` (${neg})` : ""}`}
                </label>
              ))}
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={lowPointWin} onChange={(e) => setLowPointWin(e.target.checked)} />
                Low-point win
              </label>
            </div>
          </fieldset>

          <fieldset className="space-y-1.5">
            <legend className="text-xs font-medium text-muted-foreground">Speaker points (optional)</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {points.map((row, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Badge variant="outline" className="w-10 justify-center uppercase">
                    {row.side}
                  </Badge>
                  <Input
                    aria-label={`Speaker ${i + 1} name`}
                    placeholder="Speaker"
                    value={row.speaker}
                    onChange={(e) => setPoints((rows) => rows.map((r, j) => (j === i ? { ...r, speaker: e.target.value } : r)))}
                  />
                  <Input
                    aria-label={`Speaker ${i + 1} points`}
                    className="w-24"
                    inputMode="decimal"
                    placeholder="28.5"
                    value={row.points}
                    onChange={(e) => setPoints((rows) => rows.map((r, j) => (j === i ? { ...r, points: e.target.value } : r)))}
                  />
                </div>
              ))}
            </div>
          </fieldset>

          <Field id="ballot-rfd" label="Reason for decision">
            <Textarea id="ballot-rfd" rows={6} value={rfd} onChange={(e) => setRfd(e.target.value)} />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="ballot-destination" label="Send to">
              <Select id="ballot-destination" value={destination} onChange={(e) => setDestination(e.target.value as BallotDestination)}>
                <option value="local">Debate AI only</option>
                <option value="tabroom" disabled={!account.tabroomForwarding}>
                  Tabroom (and keep a copy here){account.tabroomForwarding ? "" : " — not set up on this site"}
                </option>
              </Select>
            </Field>
            {destination === "tabroom" ? (
              <Field id="ballot-tabroom-token" label="Your Tabroom API token">
                <Input
                  id="ballot-tabroom-token"
                  type="password"
                  autoComplete="off"
                  value={tabroomToken}
                  onChange={(e) => setTabroomToken(e.target.value)}
                  required
                />
              </Field>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={!match || sending}>
              {sending ? "Submitting…" : "Submit ballot"}
            </Button>
            <a
              href={`https://www.tabroom.com/user/home.mhtml`}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "link", size: "sm" })}
            >
              Open my Tabroom ballots
              <ExternalLink className="ml-1 h-3.5 w-3.5" />
            </a>
          </div>
          {status.kind === "error" ? <ErrorNote error={new Error(status.message)} /> : null}
          {status.kind === "done" ? <SubmittedNote ballot={status.ballot} /> : null}
        </form>
      </CardContent>
    </Card>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function tabroomNote(ballot: StoredJudgeBallot): string {
  switch (ballot.tabroomStatus) {
    case "sent":
      return "Sent to Tabroom.";
    case "failed":
      return `Tabroom did not accept it${ballot.tabroomDetail ? `: ${ballot.tabroomDetail}` : "."} A copy is saved here.`;
    case "unavailable":
      return "Tabroom submission is not available, so it was saved here only.";
    default:
      return "Saved to Debate AI.";
  }
}

function SubmittedNote({ ballot }: { ballot: StoredJudgeBallot }) {
  return (
    <p className="flex items-center gap-1.5 text-sm" role="status">
      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
      Ballot submitted. {tabroomNote(ballot)}
    </p>
  );
}

function SubmittedBallots({ ballots }: { ballots: StoredJudgeBallot[] }) {
  if (!ballots.length) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your ballots at this tournament</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y text-sm">
          {ballots.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                {b.event} {b.round}: {b.aff} vs {b.neg} — <strong>{b.winner === "aff" ? b.aff : b.neg}</strong>
                {b.lowPointWin ? " (low-point win)" : ""}
              </span>
              <Badge variant={b.tabroomStatus === "sent" ? "secondary" : "outline"}>
                {b.tabroomStatus === "sent" ? "On Tabroom" : b.tabroomStatus === "failed" ? "Tabroom failed" : "Debate AI"}
              </Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
