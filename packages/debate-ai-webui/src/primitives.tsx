/**
 * @fileoverview The handful of presentational pieces every screen shares.
 *
 * Deliberately plain elements with `dai-` class names rather than shadcn/Radix
 * copies: this UI is embedded in hosts that have their own design system (the
 * extension's Options page is Tailwind + shadcn, a native wrapper may have
 * neither), so the package ships one stylesheet of its own and depends on no
 * CSS framework being present. See `styles.css`.
 *
 * @module primitives
 */

import type { ReactNode } from "react";

/** The three states every request-backed screen renders between. */
export function AsyncBoundary({
  loading,
  error,
  empty,
  emptyText,
  onRetry,
  children,
}: {
  loading: boolean;
  error: string | undefined;
  /** Whether a *successful* load produced nothing to show. */
  empty: boolean;
  emptyText: string;
  onRetry?: () => void;
  children: ReactNode;
}) {
  if (error) {
    return (
      <div className="dai-notice dai-notice-error" role="alert">
        <p>{error}</p>
        {onRetry && (
          <button type="button" className="dai-button" onClick={onRetry}>
            Try again
          </button>
        )}
      </div>
    );
  }
  // The spinner only replaces the content when there is nothing to keep: a
  // reload with rows already on screen dims them instead (see `dai-loading`),
  // so the layout doesn't jump on every keystroke.
  if (loading && empty) {
    return (
      <p className="dai-muted" role="status">
        Loading…
      </p>
    );
  }
  if (empty) return <p className="dai-muted">{emptyText}</p>;
  return <div className={loading ? "dai-loading" : undefined}>{children}</div>;
}

/** A labelled text input — the search box every screen opens with. */
export function SearchField({
  id,
  label,
  placeholder,
  value,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  hint?: ReactNode;
}) {
  return (
    <div className="dai-field">
      <label className="dai-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="dai-input"
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint && <p className="dai-hint">{hint}</p>}
    </div>
  );
}

/** A labelled `<select>` over a fixed option list. */
export function SelectField({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="dai-field">
      <label className="dai-label" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className="dai-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** A small caption above a list, e.g. "128 cards". */
export function ResultCount({ count, noun }: { count: number; noun: string }) {
  return (
    <p className="dai-count">
      {count.toLocaleString()} {count === 1 ? noun : `${noun}s`}
    </p>
  );
}

/** One row in a screen's result list. */
export function Card({
  title,
  subtitle,
  meta,
  children,
  href,
  onOpen,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Short facts rendered as pills under the title. */
  meta?: (string | undefined)[];
  children?: ReactNode;
  /** Makes the title a link to the web app or the source. */
  href?: string;
  /** Used instead of `href` when the host opens routes itself. */
  onOpen?: () => void;
}) {
  const heading = href ? (
    <a className="dai-card-title" href={href} target="_blank" rel="noreferrer noopener">
      {title}
    </a>
  ) : onOpen ? (
    <button type="button" className="dai-card-title dai-card-title-button" onClick={onOpen}>
      {title}
    </button>
  ) : (
    <span className="dai-card-title">{title}</span>
  );

  const pills = (meta ?? []).filter((entry): entry is string => Boolean(entry && entry.trim()));

  return (
    <article className="dai-card">
      {heading}
      {subtitle && <p className="dai-card-subtitle">{subtitle}</p>}
      {pills.length > 0 && (
        <p className="dai-pills">
          {pills.map((entry) => (
            <span className="dai-pill" key={entry}>
              {entry}
            </span>
          ))}
        </p>
      )}
      {children}
    </article>
  );
}
