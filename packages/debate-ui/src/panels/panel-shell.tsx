/**
 * @fileoverview Shared layout primitives for feature panels.
 *
 * The debate packages ship a large amount of pure "slice" logic (coverage
 * reports, leaderboards, quest boards, drill sets, briefings...) whose output
 * all reads the same way on screen: a titled panel, a row of headline stats,
 * a few sections of rows, and often the slice's own `build*SummaryText`
 * output as copyable plain text. These primitives capture that shape once so
 * each feature panel only has to describe its own data.
 */

"use client";

import * as React from "react";

import { cn } from "../lib/utils";

/**
 * Semantic colouring shared by stat tiles, meters and pills.
 *
 * `neutral` is the default surface treatment; the rest map onto the coverage/
 * status vocabulary used across the slices (covered vs thin vs missing,
 * approved vs changes-requested, on-track vs behind).
 */
export type PanelTone = "neutral" | "info" | "positive" | "warning" | "critical";

const TONE_TEXT: Record<PanelTone, string> = {
  neutral: "text-foreground",
  info: "text-sky-600 dark:text-sky-400",
  positive: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
  critical: "text-rose-600 dark:text-rose-400",
};

const TONE_SURFACE: Record<PanelTone, string> = {
  neutral: "bg-muted/50 border-border",
  info: "bg-sky-500/10 border-sky-500/30",
  positive: "bg-emerald-500/10 border-emerald-500/30",
  warning: "bg-amber-500/10 border-amber-500/30",
  critical: "bg-rose-500/10 border-rose-500/30",
};

const TONE_FILL: Record<PanelTone, string> = {
  neutral: "bg-foreground/40",
  info: "bg-sky-500",
  positive: "bg-emerald-500",
  warning: "bg-amber-500",
  critical: "bg-rose-500",
};

/** Tailwind text colour class for a tone, for callers rendering their own nodes. */
export function toneTextClass(tone: PanelTone = "neutral"): string {
  return TONE_TEXT[tone];
}

/** Tailwind background/border class pair for a tone. */
export function toneSurfaceClass(tone: PanelTone = "neutral"): string {
  return TONE_SURFACE[tone];
}

/** Props for {@link PanelShell}. */
export interface PanelShellProps {
  /** Panel heading. */
  title: string;
  /** One-line explanation of what the panel shows. */
  description?: string;
  /** Optional leading icon node (usually a lucide icon element). */
  icon?: React.ReactNode;
  /** Controls rendered on the right of the header (buttons, selects). */
  actions?: React.ReactNode;
  /** Panel body. */
  children?: React.ReactNode;
  /** Extra classes for the outer element. */
  className?: string;
  /** Test id for render assertions. */
  "data-testid"?: string;
}

/**
 * Outer container for a feature panel: bordered surface, header row and body.
 *
 * @param props - See {@link PanelShellProps}.
 * @returns The panel element.
 *
 * @example
 * ```tsx
 * <PanelShell title="Topic Coverage" description="Cards per tracked argument">
 *   <StatGrid>…</StatGrid>
 * </PanelShell>
 * ```
 */
export function PanelShell({
  title,
  description,
  icon,
  actions,
  children,
  className,
  "data-testid": testId,
}: PanelShellProps) {
  return (
    <section
      data-slot="panel"
      data-testid={testId}
      className={cn(
        "bg-card text-card-foreground flex flex-col gap-4 rounded-xl border p-4 shadow-sm",
        className,
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          {icon ? <span className="text-muted-foreground mt-0.5">{icon}</span> : null}
          <div>
            <h2 className="text-base leading-none font-semibold">{title}</h2>
            {description ? (
              <p className="text-muted-foreground mt-1 text-sm">{description}</p>
            ) : null}
          </div>
        </div>
        {actions ? <div className="flex flex-shrink-0 items-center gap-2">{actions}</div> : null}
      </header>
      {children}
    </section>
  );
}

/** Props for {@link PanelSection}. */
export interface PanelSectionProps {
  /** Section heading. */
  title: string;
  /** Optional supporting copy. */
  description?: string;
  /** Controls rendered on the right of the section heading. */
  actions?: React.ReactNode;
  /** Section body. */
  children?: React.ReactNode;
  /** Extra classes for the outer element. */
  className?: string;
}

/**
 * A titled block inside a panel.
 *
 * @param props - See {@link PanelSectionProps}.
 * @returns The section element.
 */
export function PanelSection({
  title,
  description,
  actions,
  children,
  className,
}: PanelSectionProps) {
  return (
    <div data-slot="panel-section" className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            {title}
          </h3>
          {description ? (
            <p className="text-muted-foreground text-xs">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}

/**
 * Responsive grid wrapper for {@link StatTile}s.
 *
 * @param props - Standard div props plus `columns` (defaults to 3).
 * @returns The grid element.
 */
export function StatGrid({
  columns = 3,
  className,
  ...props
}: React.ComponentProps<"div"> & { columns?: 2 | 3 | 4 }) {
  const columnClass =
    columns === 2
      ? "sm:grid-cols-2"
      : columns === 4
        ? "sm:grid-cols-2 lg:grid-cols-4"
        : "sm:grid-cols-3";
  return (
    <div
      data-slot="stat-grid"
      className={cn("grid grid-cols-1 gap-2", columnClass, className)}
      {...props}
    />
  );
}

/** Props for {@link StatTile}. */
export interface StatTileProps {
  /** Short metric name. */
  label: string;
  /** The metric value. */
  value: React.ReactNode;
  /** Optional secondary line under the value. */
  hint?: string;
  /** Semantic colour for the value. */
  tone?: PanelTone;
}

/**
 * A single headline metric.
 *
 * @param props - See {@link StatTileProps}.
 * @returns The stat tile element.
 */
export function StatTile({ label, value, hint, tone = "neutral" }: StatTileProps) {
  return (
    <div
      data-slot="stat-tile"
      className={cn("rounded-lg border px-3 py-2", TONE_SURFACE[tone])}
    >
      <div className="text-muted-foreground text-xs font-medium">{label}</div>
      <div className={cn("text-xl font-semibold tabular-nums", TONE_TEXT[tone])}>{value}</div>
      {hint ? <div className="text-muted-foreground text-xs">{hint}</div> : null}
    </div>
  );
}

/** Props for {@link MeterBar}. */
export interface MeterBarProps {
  /** Current value. */
  value: number;
  /** Value representing a full bar. Values `<= 0` render an empty bar. */
  max: number;
  /** Optional label rendered above the bar. */
  label?: string;
  /** Optional value caption rendered opposite the label. */
  caption?: string;
  /** Semantic colour of the filled portion. */
  tone?: PanelTone;
}

/**
 * Horizontal progress meter used for quest/goal/coverage progress.
 *
 * @param props - See {@link MeterBarProps}.
 * @returns The meter element.
 */
export function MeterBar({ value, max, label, caption, tone = "info" }: MeterBarProps) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const percent = Math.round(ratio * 100);
  return (
    <div data-slot="meter" className="flex flex-col gap-1">
      {label || caption ? (
        <div className="flex items-baseline justify-between gap-2 text-xs">
          {label ? <span className="font-medium">{label}</span> : <span />}
          {caption ? <span className="text-muted-foreground tabular-nums">{caption}</span> : null}
        </div>
      ) : null}
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={Math.max(max, 0)}
        className="bg-muted h-2 w-full overflow-hidden rounded-full"
      >
        <div className={cn("h-full rounded-full", TONE_FILL[tone])} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

/** Props for {@link Pill}. */
export interface PillProps {
  /** Pill text. */
  children: React.ReactNode;
  /** Semantic colour. */
  tone?: PanelTone;
  /** Extra classes. */
  className?: string;
}

/**
 * Small status chip. Kept separate from the shadcn `Badge` so panels can use
 * the same tone vocabulary as stat tiles and meters.
 *
 * @param props - See {@link PillProps}.
 * @returns The pill element.
 */
export function Pill({ children, tone = "neutral", className }: PillProps) {
  return (
    <span
      data-slot="pill"
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        TONE_SURFACE[tone],
        TONE_TEXT[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Props for {@link EmptyState}. */
export interface EmptyStateProps {
  /** Headline shown when there is nothing to render. */
  title: string;
  /** Optional guidance on how to populate the panel. */
  message?: string;
}

/**
 * Placeholder shown when a panel has no data yet.
 *
 * @param props - See {@link EmptyStateProps}.
 * @returns The empty-state element.
 */
export function EmptyState({ title, message }: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className="text-muted-foreground border-border rounded-lg border border-dashed px-3 py-6 text-center text-sm"
    >
      <p className="font-medium">{title}</p>
      {message ? <p className="mt-1 text-xs">{message}</p> : null}
    </div>
  );
}

/** Props for {@link SummaryText}. */
export interface SummaryTextProps {
  /** Plain-text summary, usually a slice's `build*SummaryText` output. */
  text: string;
  /** Optional heading above the block. */
  label?: string;
}

/**
 * Renders a slice's plain-text summary verbatim, preserving its line breaks.
 *
 * @param props - See {@link SummaryTextProps}.
 * @returns The summary block.
 */
export function SummaryText({ text, label }: SummaryTextProps) {
  return (
    <div data-slot="summary-text" className="flex flex-col gap-1">
      {label ? (
        <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          {label}
        </h3>
      ) : null}
      <pre className="bg-muted/50 text-muted-foreground overflow-x-auto rounded-lg border px-3 py-2 text-xs whitespace-pre-wrap">
        {text}
      </pre>
    </div>
  );
}

/** Props for {@link LabeledField}. */
export interface LabeledFieldProps {
  /** Field label. */
  label: string;
  /** Optional hint under the control. */
  hint?: string;
  /** The control itself. */
  children: React.ReactNode;
  /** Extra classes. */
  className?: string;
}

/**
 * Label + control wrapper for the small forms panels use to add records.
 *
 * @param props - See {@link LabeledFieldProps}.
 * @returns The field element.
 */
export function LabeledField({ label, hint, children, className }: LabeledFieldProps) {
  return (
    <label data-slot="field" className={cn("flex flex-col gap-1 text-xs", className)}>
      <span className="text-muted-foreground font-medium">{label}</span>
      {children}
      {hint ? <span className="text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

/** Props for {@link PanelRow}. */
export interface PanelRowProps {
  /** Primary text. */
  title: React.ReactNode;
  /** Secondary text under the title. */
  subtitle?: React.ReactNode;
  /** Right-aligned metric or controls. */
  trailing?: React.ReactNode;
  /** Optional leading rank/index badge. */
  leading?: React.ReactNode;
  /** Extra body rendered under the title block (meters, chips, notes). */
  children?: React.ReactNode;
  /** Extra classes. */
  className?: string;
}

/**
 * A single list row: leading marker, title/subtitle, trailing metric.
 *
 * @param props - See {@link PanelRowProps}.
 * @returns The row element.
 */
export function PanelRow({
  title,
  subtitle,
  trailing,
  leading,
  children,
  className,
}: PanelRowProps) {
  return (
    <div
      data-slot="panel-row"
      className={cn("border-border flex flex-col gap-2 rounded-lg border px-3 py-2", className)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          {leading ? (
            <span className="text-muted-foreground mt-0.5 text-xs font-semibold tabular-nums">
              {leading}
            </span>
          ) : null}
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{title}</div>
            {subtitle ? (
              <div className="text-muted-foreground text-xs">{subtitle}</div>
            ) : null}
          </div>
        </div>
        {trailing ? (
          <div className="flex flex-shrink-0 items-center gap-2 text-sm tabular-nums">
            {trailing}
          </div>
        ) : null}
      </div>
      {children}
    </div>
  );
}
