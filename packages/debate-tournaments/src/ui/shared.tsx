"use client";

/**
 * Small building blocks shared by the tournament pages: the data hook, the
 * host-supplied link component, and loading/error/empty states. Styled with
 * the host's Tailwind tokens (`bg-card`, `text-muted-foreground`, …) so the
 * pages pick up its theme.
 */

import { createContext, useContext, useEffect, useState, type ComponentType, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import type { TournamentHrefs } from "../routes";
import type { TournamentsClient } from "./client";

export type LinkLike = ComponentType<{ href: string; className?: string; children?: ReactNode }>;

const PlainLink: LinkLike = ({ href, className, children }) => (
  <a href={href} className={className}>
    {children}
  </a>
);

export interface TournamentsContextValue {
  client: TournamentsClient;
  hrefs: TournamentHrefs;
  Link: LinkLike;
}

export const TournamentsContext = createContext<TournamentsContextValue | null>(null);

export function useTournaments(): TournamentsContextValue {
  const ctx = useContext(TournamentsContext);
  if (!ctx) throw new Error("Tournament pages must render inside <TournamentsApp>.");
  return ctx;
}

export const defaultLink = PlainLink;

type State<T> = { status: "loading" } | { status: "error"; error: Error } | { status: "ready"; data: T };

/** Runs `load` whenever `key` changes, cancelling the previous request. */
export function useApi<T>(key: string, load: (signal: AbortSignal) => Promise<T>): State<T> {
  const [state, setState] = useState<State<T>>({ status: "loading" });
  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    load(controller.signal).then(
      (data) => !controller.signal.aborted && setState({ status: "ready", data }),
      (error) => !controller.signal.aborted && setState({ status: "error", error }),
    );
    return () => controller.abort();
    // `load` is recreated each render; `key` identifies the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground" role="status">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      {label}
    </div>
  );
}

export function ErrorNote({ error }: { error: Error }) {
  return (
    <div className="m-4 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive" role="alert">
      {error.message}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="p-6 text-sm text-muted-foreground">{children}</p>;
}

/** Renders a loaded state, or its loading/error placeholder. */
export function Loaded<T>({ state, children }: { state: State<T>; children: (data: T) => ReactNode }) {
  if (state.status === "loading") return <Loading />;
  if (state.status === "error") return <ErrorNote error={state.error} />;
  return <>{children(state.data)}</>;
}

export function Section({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="rounded-lg border bg-card text-card-foreground">
      <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {actions}
      </header>
      <div>{children}</div>
    </section>
  );
}

/** Formats a stored UTC timestamp in the tournament's time zone. */
export function formatDate(value: string | null | undefined, tz?: string | null, withTime = false): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  try {
    return date.toLocaleString("en-US", {
      timeZone: tz || "UTC",
      month: "short",
      day: "numeric",
      year: withTime ? undefined : "numeric",
      ...(withTime ? { hour: "numeric", minute: "2-digit", timeZoneName: "short" } : {}),
    });
  } catch {
    return date.toISOString().slice(0, 10);
  }
}
