"use client";

/**
 * @fileoverview The comment author's avatar: their picture, or their initials
 * on a neutral tile when they have none.
 *
 * A plain `<img>` rather than a next/image host image — these are third-party
 * profile URLs (a Google avatar, a Discord avatar) on arbitrary hosts, which is
 * exactly the case remote patterns have to be widened for, and the network cost
 * of one 32px tile per comment is not worth a proxy.
 */

import { useState } from "react";

import { getInitials } from "./format";
import { cn } from "./cn";

/** Deterministic tile colour, so the same person is the same colour everywhere. */
const FALLBACK_TINTS = [
  "bg-rose-500/15 text-rose-600 dark:text-rose-300",
  "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  "bg-sky-500/15 text-sky-600 dark:text-sky-300",
  "bg-violet-500/15 text-violet-600 dark:text-violet-300",
];

function tintFor(seed: string): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index++) {
    hash = (hash * 31 + seed.charCodeAt(index)) | 0;
  }
  return FALLBACK_TINTS[Math.abs(hash) % FALLBACK_TINTS.length];
}

export interface CommentAvatarProps {
  name: string;
  imageUrl?: string | null;
  /** Stable identity for the fallback tint — the comment or user id. */
  seed?: string;
  className?: string;
}

export function CommentAvatar({ name, imageUrl, seed, className }: CommentAvatarProps) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(imageUrl) && !failed;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full",
        "text-[11px] font-semibold uppercase",
        !showImage && tintFor(seed ?? name),
        className,
      )}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl as string}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span aria-hidden="true">{getInitials(name)}</span>
      )}
    </span>
  );
}
