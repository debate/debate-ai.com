"use client";

/**
 * @fileoverview The practice profile form: which roles a debater volunteers
 * for, and the formats, styles, speed, level and availability they are
 * comfortable with.
 *
 * The two roles are big toggle cards rather than checkboxes in a list, because
 * they are the decision the form exists for — everything under them is what a
 * partner reads before deciding to ask. The option lists come from
 * `lib/practice-partners/types.ts`, the same lists the API validates against.
 */

import { useState, type FormEvent, type ReactNode } from "react";
import { Check, Gavel, Loader2, Swords } from "lucide-react";

import { cn } from "../../lib/ui/lib/utils";
import {
  DEFAULT_PRACTICE_PROFILE,
  MAX_AVAILABILITY_LENGTH,
  MAX_PROFILE_NOTE_LENGTH,
  PRACTICE_FORMATS,
  PRACTICE_LEVELS,
  PRACTICE_SPEEDS,
  PRACTICE_STYLES,
  type PracticeLevel,
  type PracticeProfileInput,
  type PracticeSpeed,
} from "../../lib/practice-partners/types";

const inputClass =
  "w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

/** A row of toggleable chips over one option list. */
export function ChipGroup<T extends string>({
  options,
  selected,
  onChange,
  label,
  highlight = [],
}: {
  options: readonly { id: T; label: string }[];
  selected: readonly T[];
  onChange: (next: T[]) => void;
  label: string;
  /** Ids to mark as shared with the viewer (read-only emphasis). */
  highlight?: readonly T[];
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const on = selected.includes(option.id);
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? selected.filter((id) => id !== option.id) : [...selected, option.id])}
            className={cn(
              "inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs font-medium transition-colors",
              on
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-foreground hover:bg-accent",
              highlight.includes(option.id) && !on && "border-primary/60",
            )}
          >
            {on ? <Check className="h-3 w-3" aria-hidden="true" /> : null}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function RoleToggle({
  on,
  onToggle,
  icon,
  title,
  description,
}: {
  on: boolean;
  onToggle: () => void;
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className={cn(
        "flex flex-1 items-start gap-3 rounded-lg border p-3 text-left transition-colors",
        on ? "border-primary bg-primary/10" : "border-border bg-background hover:bg-accent",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border",
          on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted text-muted-foreground",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-sm font-medium">
          {title}
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            {on ? "On" : "Off"}
          </span>
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
      </span>
    </button>
  );
}

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export interface PracticeProfileFormProps {
  initial: PracticeProfileInput | null;
  /** Resolves once stored; rejects with a message fit to show. */
  onSave: (profile: PracticeProfileInput) => Promise<void>;
  onCancel?: () => void;
}

export function PracticeProfileForm({ initial, onSave, onCancel }: PracticeProfileFormProps) {
  const [profile, setProfile] = useState<PracticeProfileInput>(initial ?? DEFAULT_PRACTICE_PROFILE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = <K extends keyof PracticeProfileInput>(key: K, value: PracticeProfileInput[K]) =>
    setProfile((current) => ({ ...current, [key]: value }));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave(profile);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not save your practice profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <RoleToggle
          on={profile.asCompetitor}
          onToggle={() => update("asCompetitor", !profile.asCompetitor)}
          icon={<Swords className="h-4 w-4" />}
          title="Open to challenges"
          description="List me as a debater other members can challenge to a practice round."
        />
        <RoleToggle
          on={profile.asJudge}
          onToggle={() => update("asJudge", !profile.asJudge)}
          icon={<Gavel className="h-4 w-4" />}
          title="Volunteer to judge"
          description="List me as a judge, and show me practice rounds that still need one."
        />
      </div>

      <Field label="Formats" hint="The formats you'll debate or judge.">
        <ChipGroup
          label="Formats"
          options={PRACTICE_FORMATS}
          selected={profile.formats}
          onChange={(formats) => update("formats", formats)}
        />
      </Field>

      <Field label="Styles you're comfortable with" hint="Leave empty for “anything goes”.">
        <ChipGroup
          label="Styles"
          options={PRACTICE_STYLES}
          selected={profile.styles}
          onChange={(styles) => update("styles", styles)}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Speed" htmlFor="practice-speed">
          <select
            id="practice-speed"
            value={profile.speed}
            onChange={(event) => update("speed", event.target.value as PracticeSpeed)}
            className={cn(inputClass, "h-9")}
          >
            {PRACTICE_SPEEDS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Experience" htmlFor="practice-level">
          <select
            id="practice-level"
            value={profile.level}
            onChange={(event) => update("level", event.target.value as PracticeLevel)}
            className={cn(inputClass, "h-9")}
          >
            {PRACTICE_LEVELS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Availability" htmlFor="practice-availability">
        <input
          id="practice-availability"
          value={profile.availability}
          onChange={(event) => update("availability", event.target.value)}
          maxLength={MAX_AVAILABILITY_LENGTH}
          placeholder="e.g. weeknights after 7pm ET, Saturday mornings"
          className={cn(inputClass, "h-9")}
        />
      </Field>

      <Field label="Note for partners" htmlFor="practice-note">
        <textarea
          id="practice-note"
          value={profile.note}
          onChange={(event) => update("note", event.target.value)}
          maxLength={MAX_PROFILE_NOTE_LENGTH}
          rows={3}
          placeholder="What you want to work on, what you're running this topic, anything a partner or judge should know."
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
          {saving ? "Saving…" : "Save practice profile"}
        </button>
      </div>
    </form>
  );
}
