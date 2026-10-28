"use client";

/**
 * @fileoverview Judge Pool — judges list themselves for hire on circuit
 * weekends, and tournament organizers hire them.
 *
 * One read (`GET /api/judge-pool`) fills three blocks:
 *
 * 1. **Volunteer as a judge** — the viewer's listing: up to three upcoming
 *    weekends from the circuit calendar, their states, whether they travel,
import { getTournamentLogo } from "../tournament-logo-map"
 *    formats and judge philosophy. Collapsed to a summary once saved.
 * 2. **Hire requests** — requests sent to the viewer as a judge (accept or
 *    decline) and the ones they sent as an organizer (cancel).
 * 3. **Hire a judge** — the pool, filtered by weekend, tournament state and
 *    format. A judge fits a state if they're in it or will travel. "Hire"
 *    opens a short request: tournament, weekend, pay offer, message.
 *
 * Payment isn't taken on the site yet; the panel says so where it matters.
 * Mounted below Practice Partners in the Prep Workspace's Practice Partners
 * tab (`/practice/prep?section=partners`), anchored
 * `#judge-pool`, which is where every hire notification links.
 */

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Briefcase, ChevronDown, ChevronUp, Inbox, Loader2, MapPin, Pencil, Plane, Scale, Send } from "lucide-react";

import { cn } from "@debate-ai/round/src/ui/lib/utils";
import { getTournamentLogo } from "../tournament-logo-map"
import { PRACTICE_FORMATS, optionLabel, type PracticeFormat } from "../../practice-partners/types";
import { actOnHireRequest, fetchJudgePool, saveJudgeListing, sendHireRequest } from "../client";
import { filterJudgePool } from "../filter";
import { isoDay, upcomingWeekends, weekendLabel } from "../season-calendar";
import {
  MAX_HIRE_MESSAGE_LENGTH,
  MAX_OFFER_LENGTH,
  MAX_TOURNAMENT_NAME_LENGTH,
  US_STATES,
  type HireAction,
  type JudgeHireRequest,
  type JudgeListingInput,
  type JudgePoolEntry,
  type JudgePoolResponse,
  type NewHireRequest,
  type UsState,
} from "../types";
import { availableHireActions } from "../validation";
import { Block, SubHeading } from "../../practice-partners/ui/PracticePartnersPanel";
import { Field, inputClass } from "../../practice-partners/ui/PracticeProfileForm";
import { JudgeListingForm } from "./JudgeListingForm";

/** Anchor of the panel; hire notifications link here. */
export const JUDGE_POOL_ANCHOR = "judge-pool";

type LoadState = "loading" | "ready" | "signed-out" | "error";

const PAYMENTS_NOTE = "Payment isn't handled on the site yet — agree on pay with the judge once they accept.";

const stateName = (id: string) => US_STATES.find((state) => state.id === id)?.label ?? id;

const pillClass = "rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground";
const buttonClass =
  "inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-xs font-medium hover:bg-accent disabled:opacity-40";
const primaryButtonClass =
  "inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40";

function ListingFacts({ listing }: { listing: JudgeListingInput }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {listing.weekends.map((key) => (
        <span key={key} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
          {weekendLabel(key)}
        </span>
      ))}
      <span className={cn(pillClass, "inline-flex items-center gap-1")}>
        <MapPin className="h-3 w-3" aria-hidden="true" />
        {listing.states.map(stateName).join(", ") || "No state"}
      </span>
      {listing.canTravel ? (
        <span className={cn(pillClass, "inline-flex items-center gap-1")}>
          <Plane className="h-3 w-3" aria-hidden="true" />
          Will travel
        </span>
      ) : null}
      <span className={pillClass}>{listing.formats.map((id) => optionLabel(PRACTICE_FORMATS, id)).join(", ") || "Any format"}</span>
    </div>
  );
}

function ListingSummary({ listing }: { listing: JudgeListingInput }) {
  return (
    <div className="flex flex-col gap-2 text-sm">
      {listing.active ? (
        listing.weekends.length > 0 ? (
          <span className="self-start rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Listed for hire</span>
        ) : (
          <span className="self-start rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            Your weekends have passed. Pick new ones to stay listed.
          </span>
        )
      ) : (
        <span className="self-start rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Not listed</span>
      )}
      <ListingFacts listing={listing} />
      {listing.philosophy ? <p className="line-clamp-3 whitespace-pre-line text-xs text-muted-foreground">{listing.philosophy}</p> : null}
    </div>
  );
}

const STATUS_LABEL: Record<JudgeHireRequest["status"], string> = {
  pending: "Waiting",
  accepted: "Accepted",
  declined: "Declined",
  cancelled: "Called off",
};

const ACTION_LABEL: Record<HireAction, string> = { accept: "Accept", decline: "Decline", cancel: "Call off" };

function HireCard({
  hire,
  viewerId,
  onAction,
}: {
  hire: JudgeHireRequest;
  viewerId: string;
  onAction: (id: string, action: HireAction) => Promise<void>;
}) {
  const [busy, setBusy] = useState<HireAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const asJudge = hire.judge.id === viewerId;
  const actions = availableHireActions(
    { status: hire.status, organizerId: hire.organizer.id, judgeId: hire.judge.id },
    viewerId,
  );

  async function run(action: HireAction) {
    setBusy(action);
    setError(null);
    try {
      await onAction(hire.id, action);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not update that hire request.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border bg-background p-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          {(() => {
            const logo = getTournamentLogo(hire.tournamentName);
            if (logo) {
              const LogoComp = typeof logo === "string" ? null : logo;
              const logoSrc = typeof logo === "string" ? logo : null;
              return LogoComp ? (
                <LogoComp className="h-5 w-auto mb-1" />
              ) : logoSrc ? (
                <img src={logoSrc} alt={hire.tournamentName} className="h-5 w-auto mb-1" />
              ) : (
                <p className="font-medium">{hire.tournamentName}</p>
              );
            }
            return <p className="font-medium">{hire.tournamentName}</p>;
          })()}
          <p className="text-xs text-muted-foreground">
            {weekendLabel(hire.weekend)} · {asJudge ? `from ${hire.organizer.name}` : `judge: ${hire.judge.name}`}
          </p>
        </div>
        <span className={pillClass}>{STATUS_LABEL[hire.status]}</span>
      </div>
      {hire.offer ? <p className="text-xs">Offer: {hire.offer}</p> : null}
      {hire.message ? <p className="whitespace-pre-line text-xs text-muted-foreground">{hire.message}</p> : null}
      {actions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <button
              key={action}
              type="button"
              disabled={busy !== null}
              onClick={() => void run(action)}
              className={action === "accept" ? primaryButtonClass : buttonClass}
            >
              {busy === action ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
              {ACTION_LABEL[action]}
            </button>
          ))}
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </li>
  );
}

function HireForm({
  entry,
  defaultWeekend,
  onSend,
  onCancel,
}: {
  entry: JudgePoolEntry;
  defaultWeekend?: string;
  onSend: (request: NewHireRequest) => Promise<void>;
  onCancel: () => void;
}) {
  const [request, setRequest] = useState<NewHireRequest>({
    judgeId: entry.judge.id,
    weekend: defaultWeekend && entry.weekends.includes(defaultWeekend) ? defaultWeekend : entry.weekends[0] ?? "",
    tournamentName: "",
    offer: "",
    message: "",
  });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const update = <K extends keyof NewHireRequest>(key: K, value: NewHireRequest[K]) =>
    setRequest((current) => ({ ...current, [key]: value }));
  const prefix = `hire-${entry.judge.id}`;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setError(null);
    try {
      await onSend(request);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not send your hire request.");
      setSending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Tournament" htmlFor={`${prefix}-tournament`}>
          <input
            id={`${prefix}-tournament`}
            required
            value={request.tournamentName}
            onChange={(event) => update("tournamentName", event.target.value)}
            maxLength={MAX_TOURNAMENT_NAME_LENGTH}
            placeholder="e.g. Bay Area Invitational"
            className={cn(inputClass, "h-9")}
          />
        </Field>
        <Field label="Weekend" htmlFor={`${prefix}-weekend`}>
          <select
            id={`${prefix}-weekend`}
            value={request.weekend}
            onChange={(event) => update("weekend", event.target.value)}
            className={cn(inputClass, "h-9")}
          >
            {entry.weekends.map((key) => (
              <option key={key} value={key}>
                {weekendLabel(key)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Pay offer" htmlFor={`${prefix}-offer`} hint={PAYMENTS_NOTE}>
        <input
          id={`${prefix}-offer`}
          value={request.offer}
          onChange={(event) => update("offer", event.target.value)}
          maxLength={MAX_OFFER_LENGTH}
          placeholder="e.g. $300 for the weekend + hotel"
          className={cn(inputClass, "h-9")}
        />
      </Field>
      <Field label="Message" htmlFor={`${prefix}-message`}>
        <textarea
          id={`${prefix}-message`}
          value={request.message}
          onChange={(event) => update("message", event.target.value)}
          maxLength={MAX_HIRE_MESSAGE_LENGTH}
          rows={3}
          placeholder="Divisions, number of rounds, how to reach you."
          className={cn(inputClass, "resize-y py-2 leading-6")}
        />
      </Field>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} disabled={sending} className={buttonClass}>
          Cancel
        </button>
        <button type="submit" disabled={sending} className={primaryButtonClass}>
          {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Send className="h-3.5 w-3.5" aria-hidden="true" />}
          Send hire request
        </button>
      </div>
    </form>
  );
}

function JudgeCard({
  entry,
  filterWeekend,
  onHire,
}: {
  entry: JudgePoolEntry;
  filterWeekend: string;
  onHire: (request: NewHireRequest) => Promise<void>;
}) {
  const [hiring, setHiring] = useState(false);
  const [showPhilosophy, setShowPhilosophy] = useState(false);
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border bg-background p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {entry.judge.imageUrl ? (
            <img src={entry.judge.imageUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
          ) : (
            <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
              {entry.judge.name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <p className="truncate text-sm font-medium">{entry.judge.name}</p>
        </div>
        {!hiring ? (
          <button type="button" onClick={() => setHiring(true)} className={primaryButtonClass}>
            <Briefcase className="h-3.5 w-3.5" aria-hidden="true" />
            Hire
          </button>
        ) : null}
      </div>
      <ListingFacts listing={entry} />
      {entry.philosophy ? (
        <div className="text-xs">
          <button
            type="button"
            onClick={() => setShowPhilosophy((current) => !current)}
            aria-expanded={showPhilosophy}
            className="inline-flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground"
          >
            Judge philosophy
            {showPhilosophy ? <ChevronUp className="h-3 w-3" aria-hidden="true" /> : <ChevronDown className="h-3 w-3" aria-hidden="true" />}
          </button>
          {showPhilosophy ? <p className="mt-1 whitespace-pre-line text-muted-foreground">{entry.philosophy}</p> : null}
        </div>
      ) : null}
      {hiring ? (
        <HireForm
          entry={entry}
          defaultWeekend={filterWeekend}
          onCancel={() => setHiring(false)}
          onSend={async (request) => {
            await onHire(request);
            setHiring(false);
          }}
        />
      ) : null}
    </li>
  );
}

export function JudgePoolPanel({ className }: { className?: string }) {
  const [data, setData] = useState<JudgePoolResponse | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [weekend, setWeekend] = useState("");
  const [state, setState] = useState<UsState | "">("");
  const [format, setFormat] = useState<PracticeFormat | "">("");

  const load = useCallback(async () => {
    try {
      const next = await fetchJudgePool();
      if (!next) {
        setLoadState("signed-out");
        return;
      }
      setData(next);
      setLoadState("ready");
      setError(null);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not load the judge pool.");
      setLoadState((current) => (current === "ready" ? current : "error"));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (loadState !== "ready" || window.location.hash !== `#${JUDGE_POOL_ANCHOR}`) return;
    document.getElementById(JUDGE_POOL_ANCHOR)?.scrollIntoView({ block: "start" });
  }, [loadState]);

  const weekendOptions = useMemo(() => upcomingWeekends(isoDay()), []);
  const filtered = useMemo(
    () => filterJudgePool(data?.pool ?? [], { weekend, state, format }),
    [data?.pool, weekend, state, format],
  );

  if (loadState === "loading") {
    return (
      <div className={cn("flex items-center gap-2 py-8 text-sm text-muted-foreground", className)}>
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading the judge pool…
      </div>
    );
  }

  if (loadState === "signed-out") {
    return (
      <div id={JUDGE_POOL_ANCHOR} className={className}>
        <Block
          title="Judge pool"
          icon={<Scale className="h-4 w-4" />}
          description="Volunteer to judge tournaments on circuit weekends, or hire a judge for yours."
        >
          <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            <a href="/login" className="font-medium text-primary hover:underline">
              Sign in
            </a>{" "}
            to list yourself as a judge or hire one.
          </p>
        </Block>
      </div>
    );
  }

  if (loadState === "error" || !data) {
    return (
      <p role="alert" className={cn("text-sm text-destructive", className)}>
        {error ?? "Could not load the judge pool."}{" "}
        <button type="button" onClick={() => void load()} className="font-medium underline">
          Try again
        </button>
      </p>
    );
  }

  const viewerId = data.viewer.id;
  const showForm = !data.listing || editing;
  const received = data.hires.filter((hire) => hire.judge.id === viewerId);
  const sent = data.hires.filter((hire) => hire.organizer.id === viewerId);

  async function handleHireAction(id: string, action: HireAction) {
    await actOnHireRequest(id, action);
    await load();
  }

  return (
    <div id={JUDGE_POOL_ANCHOR} className={cn("flex scroll-mt-4 flex-col gap-4", className)}>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Block
        title="Volunteer as a judge"
        icon={<Scale className="h-4 w-4" />}
        description={
          showForm
            ? "Get hired to judge tournaments: pick up to three upcoming circuit weekends, where you are, whether you'll travel, and your judge philosophy."
            : undefined
        }
        action={
          !showForm ? (
            <button type="button" onClick={() => setEditing(true)} className={buttonClass}>
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              Edit
            </button>
          ) : null
        }
      >
        {showForm ? (
          <JudgeListingForm
            initial={data.listing}
            onCancel={data.listing ? () => setEditing(false) : undefined}
            onSave={async (next) => {
              await saveJudgeListing(next);
              setEditing(false);
              await load();
            }}
          />
        ) : (
          <ListingSummary listing={data.listing!} />
        )}
      </Block>

      {data.hires.length > 0 ? (
        <Block title="Hire requests" icon={<Inbox className="h-4 w-4" />}>
          {received.length > 0 ? (
            <div className="flex flex-col gap-2">
              <SubHeading count={received.length}>To judge</SubHeading>
              <ul className="flex flex-col gap-2">
                {received.map((hire) => (
                  <HireCard key={hire.id} hire={hire} viewerId={viewerId} onAction={handleHireAction} />
                ))}
              </ul>
            </div>
          ) : null}
          {sent.length > 0 ? (
            <div className="flex flex-col gap-2">
              <SubHeading count={sent.length}>You sent</SubHeading>
              <ul className="flex flex-col gap-2">
                {sent.map((hire) => (
                  <HireCard key={hire.id} hire={hire} viewerId={viewerId} onAction={handleHireAction} />
                ))}
              </ul>
            </div>
          ) : null}
        </Block>
      ) : null}

      <Block
        title="Hire a judge"
        icon={<Briefcase className="h-4 w-4" />}
        description="Judges who want to be hired for a tournament. Filter by your weekend, state and format, read their philosophy, and send a request."
      >
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">{PAYMENTS_NOTE}</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <select aria-label="Weekend" value={weekend} onChange={(event) => setWeekend(event.target.value)} className={cn(inputClass, "h-9")}>
            <option value="">Any weekend</option>
            {weekendOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {weekendLabel(option.key)}
                {option.majors.length > 0 ? ` · ${option.majors.map((event) => event.name).join(", ")}` : ""}
              </option>
            ))}
          </select>
          <select
            aria-label="Tournament state"
            value={state}
            onChange={(event) => setState(event.target.value as UsState | "")}
            className={cn(inputClass, "h-9")}
          >
            <option value="">Any state</option>
            {US_STATES.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Format"
            value={format}
            onChange={(event) => setFormat(event.target.value as PracticeFormat | "")}
            className={cn(inputClass, "h-9")}
          >
            <option value="">Any format</option>
            {PRACTICE_FORMATS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        {state ? <p className="text-xs text-muted-foreground">Judges in {stateName(state)} first, then judges who'll travel.</p> : null}
        {filtered.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {filtered.map((entry) => (
              <JudgeCard
                key={entry.judge.id}
                entry={entry}
                filterWeekend={weekend}
                onHire={async (request) => {
                  await sendHireRequest(request);
                  await load();
                }}
              />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            {data.pool.length === 0 ? "No judges are listed yet." : "No listed judge fits those filters."}
          </p>
        )}
      </Block>
    </div>
  );
}
