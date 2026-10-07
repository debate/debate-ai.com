"use client";

/**
 * @fileoverview The board of everyone volunteering for practice rounds: who is
 * open to challenges, who volunteers to judge, and what each is comfortable
 * with — ranked by how well they suit the viewer (`lib/practice-partners/match.ts`).
 *
 * "Challenge" opens the challenge form inline under that volunteer's card
 * rather than in a dialog: the card is what the challenger is reading while
 * they fill it in, and a dialog would cover it.
 */

import { useMemo, useState, type ReactNode } from "react";
import { Gavel, Sparkles, Swords } from "lucide-react";
import { CommentAvatar } from "@debate/comments";

import { cn } from "../../lib/ui/lib/utils";
import { rankVolunteers } from "../../lib/practice-partners/match";
import {
  PRACTICE_FORMATS,
  PRACTICE_LEVELS,
  PRACTICE_SPEEDS,
  PRACTICE_STYLES,
  optionLabel,
  type NewChallenge,
  type PracticeFormat,
  type PracticePreferences,
  type PracticeVolunteer,
} from "../../lib/practice-partners/types";
import { ChallengeForm } from "./ChallengeForm";

type RoleFilter = "debaters" | "judges";

export interface VolunteerBoardProps {
  volunteers: readonly PracticeVolunteer[];
  /** The viewer's preferences, for ranking; `null` before they have a profile. */
  viewerPreferences: PracticePreferences | null;
  /** Ids the viewer already has a challenge waiting on — their button says so instead. */
  pendingOpponentIds: ReadonlySet<string>;
  onChallenge: (challenge: NewChallenge) => Promise<void>;
}

function Tag({ children, strong = false }: { children: ReactNode; strong?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px]",
        strong ? "border-primary/50 bg-primary/10 font-medium text-foreground" : "border-border text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

export function VolunteerBoard({ volunteers, viewerPreferences, pendingOpponentIds, onChallenge }: VolunteerBoardProps) {
  const [role, setRole] = useState<RoleFilter>("debaters");
  const [format, setFormat] = useState<PracticeFormat | "any">("any");
  const [challenging, setChallenging] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const judges = useMemo(() => volunteers.filter((volunteer) => volunteer.asJudge), [volunteers]);
  const debaterCount = volunteers.filter((volunteer) => volunteer.asCompetitor).length;

  const ranked = useMemo(() => {
    return rankVolunteers(viewerPreferences, volunteers).filter(({ volunteer }) => {
      if (role === "debaters" ? !volunteer.asCompetitor : !volunteer.asJudge) return false;
      if (format !== "any" && volunteer.formats.length > 0 && !volunteer.formats.includes(format)) return false;
      return true;
    });
  }, [viewerPreferences, volunteers, role, format]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Show" className="inline-flex rounded-full border border-border bg-muted/40 p-0.5">
          {(
            [
              { id: "debaters", label: `Debaters (${debaterCount})`, icon: Swords },
              { id: "judges", label: `Judges (${judges.length})`, icon: Gavel },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={role === tab.id}
              onClick={() => setRole(tab.id)}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors",
                role === tab.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <tab.icon className="h-3.5 w-3.5" aria-hidden="true" />
              {tab.label}
            </button>
          ))}
        </div>

        <label className="sr-only" htmlFor="practice-board-format">
          Format
        </label>
        <select
          id="practice-board-format"
          value={format}
          onChange={(event) => setFormat(event.target.value as PracticeFormat | "any")}
          className="h-8 rounded-full border border-border bg-background px-3 text-xs text-foreground"
        >
          <option value="any">Any format</option>
          {PRACTICE_FORMATS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>

      </div>

      {ranked.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          {role === "debaters" ? "No debaters match these filters." : "No judges match these filters."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {ranked.map(({ volunteer, match }) => {
            const id = volunteer.person.id;
            const pending = pendingOpponentIds.has(id);
            return (
              <li key={id} className="rounded-lg border border-border bg-background p-3">
                <div className="flex items-start gap-3">
                  <CommentAvatar name={volunteer.person.name} imageUrl={volunteer.person.imageUrl} seed={id} className="h-9 w-9" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-sm font-medium">{volunteer.person.name}</p>
                      <span className="text-xs text-muted-foreground">
                        {optionLabel(PRACTICE_LEVELS, volunteer.level)} · {optionLabel(PRACTICE_SPEEDS, volunteer.speed)}
                      </span>
                      {match.label ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                          <Sparkles className="h-3 w-3" aria-hidden="true" />
                          {match.label}
                        </span>
                      ) : null}
                      {volunteer.asCompetitor && volunteer.asJudge ? (
                        <span className="text-[11px] text-muted-foreground">Debates &amp; judges</span>
                      ) : null}
                    </div>

                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {volunteer.formats.map((formatId) => (
                        <Tag key={formatId} strong={match.sharedFormats.includes(formatId)}>
                          {optionLabel(PRACTICE_FORMATS, formatId)}
                        </Tag>
                      ))}
                      {volunteer.styles.map((styleId) => (
                        <Tag key={styleId} strong={match.sharedStyles.includes(styleId)}>
                          {optionLabel(PRACTICE_STYLES, styleId)}
                        </Tag>
                      ))}
                    </div>

                    {volunteer.availability ? (
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Available:</span> {volunteer.availability}
                      </p>
                    ) : null}
                    {volunteer.note ? (
                      <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">{volunteer.note}</p>
                    ) : null}
                  </div>

                  {role === "debaters" ? (
                    <button
                      type="button"
                      disabled={pending || challenging === id}
                      onClick={() => {
                        setChallenging(id);
                        setSentTo(null);
                      }}
                      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Swords className="h-3.5 w-3.5" aria-hidden="true" />
                      {pending ? "Challenge sent" : "Challenge"}
                    </button>
                  ) : null}
                </div>

                {sentTo === id ? (
                  <p role="status" className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">
                    Challenge sent — {volunteer.person.name} has been notified.
                  </p>
                ) : null}

                {challenging === id ? (
                  <ChallengeForm
                    opponent={volunteer}
                    viewerFormats={viewerPreferences?.formats ?? []}
                    judges={judges}
                    onCancel={() => setChallenging(null)}
                    onSubmit={async (challenge) => {
                      await onChallenge(challenge);
                      setChallenging(null);
                      setSentTo(id);
                    }}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
