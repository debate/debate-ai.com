"use client";

/**
 * @fileoverview "Volunteer as a judge" — the form a judge fills in to be
 * listed in the judge pool for hire.
 *
 * The weekends come from the circuit calendar (`lib/judge-pool/season-calendar.ts`):
 * one row per upcoming weekend, labelled with its calendar week letter and the
 * majors running that weekend, so a judge can see which tournaments they would
 * be judging. Up to three can be picked; the rest disable once three are on.
 */

import { useMemo, useState, type FormEvent } from "react";
import { Check, Loader2, Plane, UserCheck, X } from "lucide-react";

import { cn } from "@debate-ai/round/src/ui/lib/utils";
import { PRACTICE_FORMATS } from "../../practice-partners/types";
import { isoDay, upcomingWeekends, weekendRangeLabel } from "../season-calendar";
import {
  DEFAULT_JUDGE_LISTING,
  MAX_JUDGE_STATES,
  MAX_JUDGE_WEEKENDS,
  MAX_PHILOSOPHY_LENGTH,
  US_STATES,
  type JudgeListingInput,
  type UsState,
} from "../types";
import { ChipGroup, Field, RoleToggle, inputClass } from "../../practice-partners/ui/PracticeProfileForm";

/** The upcoming weekends as checkable rows, at most {@link MAX_JUDGE_WEEKENDS} on. */
export function WeekendPicker({
  selected,
  onChange,
  today = isoDay(),
}: {
  selected: readonly string[];
  onChange: (next: string[]) => void;
  today?: string;
}) {
  const weekends = useMemo(() => upcomingWeekends(today), [today]);
  const full = selected.length >= MAX_JUDGE_WEEKENDS;

  if (weekends.length === 0) {
    return <p className="text-sm text-muted-foreground">The season's weekends have all passed. Next season's calendar isn't out yet.</p>;
  }

  return (
    <ul role="group" aria-label="Weekends you can judge" className="flex max-h-80 flex-col gap-1 overflow-y-auto rounded-lg border border-border p-1">
      {weekends.map((weekend) => {
        const on = selected.includes(weekend.key);
        const disabled = !on && full;
        return (
          <li key={weekend.key}>
            <button
              type="button"
              role="checkbox"
              aria-checked={on}
              disabled={disabled}
              onClick={() => onChange(on ? selected.filter((key) => key !== weekend.key) : [...selected, weekend.key].sort())}
              className={cn(
                "flex w-full items-start gap-3 rounded-md px-2 py-1.5 text-left transition-colors",
                on ? "bg-primary/10" : "hover:bg-accent",
                disabled && "cursor-not-allowed opacity-40 hover:bg-transparent",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                  on ? "border-primary bg-primary text-primary-foreground" : "border-border",
                )}
              >
                {on ? <Check className="h-3 w-3" /> : null}
              </span>
              <span className="w-9 shrink-0 text-xs font-bold tabular-nums text-muted-foreground">
                {weekend.week}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{weekendRangeLabel(weekend.key)}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {weekend.majors.length > 0
                    ? weekend.majors.map((event) => `${event.name} (${event.formats.join("/")})`).join(", ")
                    : weekend.championships
                      ? "Championship season"
                      : "No majors on the calendar"}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function StatePicker({ selected, onChange }: { selected: readonly UsState[]; onChange: (next: UsState[]) => void }) {
  const full = selected.length >= MAX_JUDGE_STATES;
  return (
    <div className="flex flex-col gap-2">
      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((id) => (
            <span key={id} className="inline-flex h-7 items-center gap-1 rounded-full border border-primary bg-primary px-2.5 text-xs font-medium text-primary-foreground">
              {US_STATES.find((state) => state.id === id)?.label ?? id}
              <button
                type="button"
                aria-label={`Remove ${id}`}
                onClick={() => onChange(selected.filter((state) => state !== id))}
                className="rounded-full hover:opacity-80"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <select
        id="judge-states"
        value=""
        disabled={full}
        onChange={(event) => {
          const id = event.target.value as UsState;
          if (id && !selected.includes(id)) onChange([...selected, id]);
        }}
        className={cn(inputClass, "h-9")}
      >
        <option value="">{full ? `Up to ${MAX_JUDGE_STATES} states` : "Add a state…"}</option>
        {US_STATES.filter((state) => !selected.includes(state.id)).map((state) => (
          <option key={state.id} value={state.id}>
            {state.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export interface JudgeListingFormProps {
  initial: JudgeListingInput | null;
  /** Resolves once stored; rejects with a message fit to show. */
  onSave: (listing: JudgeListingInput) => Promise<void>;
  onCancel?: () => void;
}

export function JudgeListingForm({ initial, onSave, onCancel }: JudgeListingFormProps) {
  const [listing, setListing] = useState<JudgeListingInput>(initial ?? DEFAULT_JUDGE_LISTING);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = <K extends keyof JudgeListingInput>(key: K, value: JudgeListingInput[K]) =>
    setListing((current) => ({ ...current, [key]: value }));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave(listing);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not save your judge listing.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <RoleToggle
          on={listing.active}
          onToggle={() => update("active", !listing.active)}
          icon={<UserCheck className="h-4 w-4" />}
          title="List me for hire"
          description="Show me in the judge pool so tournaments can ask me to judge."
        />
        <RoleToggle
          on={listing.canTravel}
          onToggle={() => update("canTravel", !listing.canTravel)}
          icon={<Plane className="h-4 w-4" />}
          title="Able to travel"
          description="I'll judge tournaments outside my state."
        />
      </div>

      <Field
        label={`Weekends you can judge (${listing.weekends.length} of ${MAX_JUDGE_WEEKENDS})`}
        hint="From the circuit calendar's season weeks. Pick up to three upcoming weekends."
      >
        <WeekendPicker selected={listing.weekends} onChange={(weekends) => update("weekends", weekends)} />
      </Field>

      <Field label="States you're in" htmlFor="judge-states">
        <StatePicker selected={listing.states} onChange={(states) => update("states", states)} />
      </Field>

      <Field label="Formats you judge">
        <ChipGroup label="Formats you judge" options={PRACTICE_FORMATS} selected={listing.formats} onChange={(formats) => update("formats", formats)} />
      </Field>

      <Field label="Judge philosophy" htmlFor="judge-philosophy" hint="Your paradigm: what you vote on, speed, how you evaluate theory and Ks.">
        <textarea
          id="judge-philosophy"
          value={listing.philosophy}
          onChange={(event) => update("philosophy", event.target.value)}
          maxLength={MAX_PHILOSOPHY_LENGTH}
          rows={5}
          placeholder="e.g. Tech over truth. Fine with speed if you're clear. I default to offense/defense…"
          className={cn(inputClass, "resize-y py-2 leading-6")}
        />
      </Field>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="h-9 rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Cancel
          </button>
        ) : null}
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-9 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          {saving ? "Saving…" : "Save judge listing"}
        </button>
      </div>
    </form>
  );
}
