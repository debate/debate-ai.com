"use client";

/**
 * @fileoverview Practice Partners — challenge other debaters to a virtual
 * practice round, volunteer to be challenged, and volunteer to judge.
 *
 * One read (`GET /api/practice-partners`) fills four blocks, top to bottom in
 * the order a debater acts on them:
 *
 * 1. **Your practice profile** — the two roles (open to challenges, volunteer
 *    to judge) and the formats, styles, speed and level you're comfortable
 *    with. Collapsed to a summary once saved.
 * 2. **Your challenges** — waiting on you first (answer these), then upcoming
 *    rounds (with the webcam room code), then challenges you sent, then a few
 *    closed ones.
 * 3. **Rounds needing a judge** — accepted rounds with an empty judge seat,
 *    shown only when you volunteer to judge.
 * 4. **Find a practice partner** — the board, ranked by match.
 *
 * Every write refreshes the whole board rather than patching local state: a
 * challenge answered on one side changes what the other side's buttons may do,
 * and one read is cheaper than getting that derivation wrong twice.
 *
 * Mounted in the Coach workspace's Practice tab and at `/practice-partners`.
 * `/practice-partners#judge` (the sidebar's "Judge Practice Rounds") scrolls
 * to the rounds needing a judge — or, for someone not volunteering yet, to
 * the profile where they turn that on.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Gavel, Handshake, Inbox, Loader2, Pencil, Swords, UserRound } from "lucide-react";

import { cn } from "../../lib/ui/lib/utils";
import { availableChallengeActions } from "../../lib/practice-partners/challenge-actions";
import { actOnChallenge, createChallenge, fetchPracticeBoard, savePracticeProfile } from "../../lib/practice-partners/client";
import {
  PRACTICE_FORMATS,
  PRACTICE_LEVELS,
  PRACTICE_SPEEDS,
  PRACTICE_STYLES,
  optionLabel,
  type ChallengeAction,
  type PracticeBoardResponse,
  type PracticeChallenge,
  type PracticeProfileInput,
} from "../../lib/practice-partners/types";
import { ChallengeCard } from "./ChallengeCard";
import { PracticeProfileForm } from "./PracticeProfileForm";
import { VolunteerBoard } from "./VolunteerBoard";

type LoadState = "loading" | "ready" | "signed-out" | "error";

/** How many declined/cancelled challenges to keep on screen. */
const CLOSED_SHOWN = 5;

/** Anchor of the "Rounds needing a judge" block. */
export const JUDGE_ANCHOR = "judge";
/** Anchor of the profile block, where "volunteer to judge" is switched on. */
export const PROFILE_ANCHOR = "practice-profile";

/**
 * Where a `#judge` link lands: the open judge seats for a volunteer judge,
 * otherwise the profile, so they can volunteer first.
 */
export function judgeLinkTarget(isJudge: boolean): string {
  return isJudge ? JUDGE_ANCHOR : PROFILE_ANCHOR;
}

/** Actions that mean "this is waiting on you". */
const ANSWER_ACTIONS = new Set<ChallengeAction>(["accept", "decline", "confirm-judge", "decline-judge"]);

function Block({
  id,
  title,
  icon,
  description,
  action,
  children,
}: {
  id?: string;
  title: string;
  icon: ReactNode;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="flex scroll-mt-4 flex-col gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 text-muted-foreground" aria-hidden="true">
            {icon}
          </span>
          <div>
            <h2 className="text-base font-semibold leading-none">{title}</h2>
            {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
          </div>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function SubHeading({ children, count }: { children: ReactNode; count: number }) {
  return (
    <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums">{count}</span>
    </h3>
  );
}

function ProfileSummary({ profile }: { profile: PracticeProfileInput }) {
  const roles = [profile.asCompetitor ? "Open to challenges" : null, profile.asJudge ? "Volunteering to judge" : null].filter(
    Boolean,
  );
  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex flex-wrap gap-1.5">
        {roles.length > 0 ? (
          roles.map((role) => (
            <span key={role} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {role}
            </span>
          ))
        ) : (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Hidden from the board</span>
        )}
      </div>
      <p className="text-muted-foreground">
        {[
          profile.formats.map((id) => optionLabel(PRACTICE_FORMATS, id)).join(", ") || "Any format",
          optionLabel(PRACTICE_LEVELS, profile.level),
          optionLabel(PRACTICE_SPEEDS, profile.speed),
          profile.styles.map((id) => optionLabel(PRACTICE_STYLES, id)).join(", ") || "Any style",
        ].join(" · ")}
      </p>
      {profile.availability ? <p className="text-xs text-muted-foreground">Available: {profile.availability}</p> : null}
    </div>
  );
}

export function PracticePartnersPanel({ className }: { className?: string }) {
  const [board, setBoard] = useState<PracticeBoardResponse | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [showClosed, setShowClosed] = useState(false);

  const load = useCallback(async () => {
    try {
      const next = await fetchPracticeBoard();
      if (!next) {
        setLoadState("signed-out");
        return;
      }
      setBoard(next);
      setLoadState("ready");
      setError(null);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not load the practice board.");
      setLoadState((current) => (current === "ready" ? current : "error"));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const viewerId = board?.viewer.id ?? "";
  const profile = board?.profile ?? null;
  const isJudge = Boolean(profile?.asJudge);

  const groups = useMemo(() => {
    const waiting: PracticeChallenge[] = [];
    const upcoming: PracticeChallenge[] = [];
    const sent: PracticeChallenge[] = [];
    const closed: PracticeChallenge[] = [];
    for (const challenge of board?.challenges ?? []) {
      const actions = availableChallengeActions(challenge, viewerId, isJudge);
      if (actions.some((action) => ANSWER_ACTIONS.has(action))) waiting.push(challenge);
      else if (challenge.status === "accepted") upcoming.push(challenge);
      else if (challenge.status === "pending") sent.push(challenge);
      else closed.push(challenge);
    }
    // Upcoming rounds soonest first; a round with no time set goes last.
    upcoming.sort((a, b) => (a.proposedAt ?? Infinity) - (b.proposedAt ?? Infinity));
    return { waiting, upcoming, sent, closed };
  }, [board?.challenges, viewerId, isJudge]);

  // `#judge` can only resolve once the board is on screen, and to a block
  // that depends on the viewer's profile, so it is scrolled to by hand.
  useEffect(() => {
    if (loadState !== "ready" || window.location.hash !== `#${JUDGE_ANCHOR}`) return;
    document.getElementById(judgeLinkTarget(isJudge))?.scrollIntoView({ block: "start" });
  }, [loadState, isJudge]);

  const pendingOpponentIds = useMemo(
    () =>
      new Set(
        (board?.challenges ?? [])
          .filter((challenge) => challenge.status === "pending" && challenge.challenger.id === viewerId)
          .map((challenge) => challenge.opponent.id),
      ),
    [board?.challenges, viewerId],
  );

  async function handleAction(challengeId: string, action: ChallengeAction) {
    await actOnChallenge(challengeId, action);
    await load();
  }

  if (loadState === "loading") {
    return (
      <div className={cn("flex items-center gap-2 py-8 text-sm text-muted-foreground", className)}>
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading practice partners…
      </div>
    );
  }

  if (loadState === "signed-out") {
    return (
      <Block
        title="Practice Partners"
        icon={<Handshake className="h-4 w-4" />}
        description="Challenge other debaters to a virtual practice round, volunteer to be challenged, or volunteer to judge."
      >
        <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <a href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </a>{" "}
          to see who&rsquo;s looking for a practice round and to put yourself on the board.
        </p>
      </Block>
    );
  }

  if (loadState === "error" || !board) {
    return (
      <p role="alert" className={cn("text-sm text-destructive", className)}>
        {error ?? "Could not load the practice board."}{" "}
        <button type="button" onClick={() => void load()} className="font-medium underline">
          Try again
        </button>
      </p>
    );
  }

  const showForm = !profile || editingProfile;
  const activeCount = groups.waiting.length + groups.upcoming.length + groups.sent.length;

  const renderCards = (list: PracticeChallenge[]) => (
    <ul className="flex flex-col gap-2">
      {list.map((challenge) => (
        <ChallengeCard
          key={challenge.id}
          challenge={challenge}
          viewerId={viewerId}
          viewerIsJudgeVolunteer={isJudge}
          onAction={handleAction}
        />
      ))}
    </ul>
  );

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Block
        id={PROFILE_ANCHOR}
        title="Your practice profile"
        icon={<UserRound className="h-4 w-4" />}
        description={
          showForm
            ? "Put yourself on the board as a debater, a judge, or both — and say what you're comfortable with."
            : undefined
        }
        action={
          !showForm ? (
            <button
              type="button"
              onClick={() => setEditingProfile(true)}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-xs font-medium hover:bg-accent"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              Edit
            </button>
          ) : null
        }
      >
        {showForm ? (
          <PracticeProfileForm
            initial={profile}
            onCancel={profile ? () => setEditingProfile(false) : undefined}
            onSave={async (next) => {
              await savePracticeProfile(next);
              setEditingProfile(false);
              await load();
            }}
          />
        ) : (
          <ProfileSummary profile={profile} />
        )}
      </Block>

      <Block
        title="Your challenges"
        icon={<Inbox className="h-4 w-4" />}
        description={
          activeCount === 0 && groups.closed.length === 0
            ? "Nothing yet. Challenge someone from the board below — they'll get a notification."
            : undefined
        }
      >
        {groups.waiting.length > 0 ? (
          <div className="flex flex-col gap-2">
            <SubHeading count={groups.waiting.length}>Waiting on you</SubHeading>
            {renderCards(groups.waiting)}
          </div>
        ) : null}
        {groups.upcoming.length > 0 ? (
          <div className="flex flex-col gap-2">
            <SubHeading count={groups.upcoming.length}>Upcoming rounds</SubHeading>
            {renderCards(groups.upcoming)}
          </div>
        ) : null}
        {groups.sent.length > 0 ? (
          <div className="flex flex-col gap-2">
            <SubHeading count={groups.sent.length}>Sent</SubHeading>
            {renderCards(groups.sent)}
          </div>
        ) : null}
        {groups.closed.length > 0 ? (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setShowClosed((current) => !current)}
              className="self-start text-xs font-medium text-muted-foreground hover:text-foreground"
              aria-expanded={showClosed}
            >
              {showClosed ? "Hide" : "Show"} closed challenges ({groups.closed.length})
            </button>
            {showClosed ? renderCards(groups.closed.slice(0, CLOSED_SHOWN)) : null}
          </div>
        ) : null}
      </Block>

      {isJudge ? (
        <Block
          id={JUDGE_ANCHOR}
          title="Rounds needing a judge"
          icon={<Gavel className="h-4 w-4" />}
          description="Accepted practice rounds with an empty judge seat. Pick one up and both debaters are notified."
        >
          {board.openToJudge.length > 0 ? (
            renderCards(board.openToJudge)
          ) : (
            <p className="text-sm text-muted-foreground">Every accepted round has a judge right now. Check back later.</p>
          )}
        </Block>
      ) : null}

      <Block
        title="Find a practice partner"
        icon={<Swords className="h-4 w-4" />}
        description="Everyone who asked to be challenged or volunteered to judge, best matches for your profile first."
      >
        {!profile?.asCompetitor ? (
          <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            You can challenge anyone here. Switch on &ldquo;Open to challenges&rdquo; in your profile so they can challenge you back.
          </p>
        ) : null}
        <VolunteerBoard
          volunteers={board.volunteers}
          viewerPreferences={profile}
          pendingOpponentIds={pendingOpponentIds}
          onChallenge={async (challenge) => {
            await createChallenge(challenge);
            await load();
          }}
        />
      </Block>
    </div>
  );
}
