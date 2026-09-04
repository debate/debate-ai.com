import type { Decision, Side } from "../model/types";

/** Compact relative time like "2h ago", "3d ago", "just now". */
export function relativeTime(ts: number, now: number = Date.now()): string {
    const s = Math.max(0, Math.floor((now - ts) / 1000));
    if (s < 45) return "just now";
    const m = Math.floor(s / 60);
    if (m < 60) return `${m} min ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}d ago`;
    const w = Math.floor(d / 7);
    if (w < 5) return `${w}w ago`;
    const mo = Math.floor(d / 30);
    if (mo < 12) return `${mo}mo ago`;
    return `${Math.floor(d / 365)}y ago`;
}

export interface ResultLabel {
    text: string;
    side: Side | null;
}

/** Map a decision to a colored result label. */
export function resultLabel(decision: Decision | undefined): ResultLabel {
    if (!decision?.vote) return { text: "undecided", side: null };
    return {
        text: decision.vote === "aff" ? "Aff" : "Neg",
        side: decision.vote,
    };
}
