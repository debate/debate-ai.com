/**
 * @fileoverview Quick-link cards shown above the lecture category grid.
 * Each card routes to /videos/<slug> or /rank.
 */

"use client";

import React from "react";
import Link from "next/link";
import Image, { StaticImageData } from "next/image";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { cn } from "@/lib/utils";
import { IconBook, IconTrophyGoat, IconLeaderboard, IconRoundsYoutube, IconTrophy, IconLectures } from "@/components/icons";

interface QuickLink {
  id: string;
  title: string;
  href?: string;
  action?: "lectures";
  icon?: React.ReactNode;
  logo?: string | StaticImageData;
  gradient: string;
  iconBg: string;
}

const QUICK_LINKS: QuickLink[] = [

  {
    id: "policy",
    title: "Policy Debates",
    href: "/videos/policy",
    logo: "https://i.imgur.com/CMuiSKj.png",
    gradient: "from-red-500/20 via-rose-500/10 to-transparent",
    iconBg: "bg-red-500/15 ring-1 ring-red-500/30",
  },
  {
    id: "pf",
    title: "PF Debates",
    href: "/videos/pf",
    logo: "https://i.imgur.com/92V0FBF.png",
    gradient: "from-emerald-500/20 via-green-500/10 to-transparent",
    iconBg: "bg-emerald-500/15 ring-1 ring-emerald-500/30",
  },
  {
    id: "ld",
    title: "LD Debates",
    href: "/videos/ld",
    logo: "https://i.imgur.com/3xFjCvO.png",
    gradient: "from-sky-500/20 via-blue-500/10 to-transparent",
    iconBg: "bg-sky-500/15 ring-1 ring-sky-500/30",
  },
  {
    id: "college",
    title: "College Debates",
    href: "/videos/college",
    logo: "https://i.imgur.com/cFmTAdJ.png",
    gradient: "from-purple-500/20 via-violet-500/10 to-transparent",
    iconBg: "bg-purple-500/15 ring-1 ring-purple-500/30",
  },
  {
    id: "lectures",
    title: "Lecture Categories",
    action: "lectures",
    logo: IconLectures,
    gradient: "from-cyan-500/20 via-teal-500/10 to-transparent",
    iconBg: "bg-cyan-500/15 ring-1 ring-cyan-500/30",
  },
  {
    id: "topPicks",
    title: "Greatest of All-Time",
    href: "/videos/topPicks",
    logo: IconTrophyGoat,
    gradient: "from-amber-500/20 via-yellow-500/10 to-transparent",
    iconBg: "bg-amber-500/15 ring-1 ring-amber-500/30",
  },
  {
    id: "favorites",
    title: "Favorites",
    href: "/videos/favorites",
    logo: IconTrophy,
    gradient: "from-rose-500/20 via-pink-500/10 to-transparent",
    iconBg: "bg-rose-500/15 ring-1 ring-rose-500/30",
  },
  {
    id: "dictionary",
    title: "Glossary of Terms",
    href: "/videos/dictionary",
    logo: IconBook,
    gradient: "from-indigo-500/20 via-blue-500/10 to-transparent",
    iconBg: "bg-indigo-500/15 ring-1 ring-indigo-500/30",
  },
  {
    id: "rankings",
    title: "Rankings",
    href: "/videos/rankings",
    logo: IconLeaderboard,
    gradient: "from-yellow-500/20 via-amber-500/10 to-transparent",
    iconBg: "bg-yellow-500/15 ring-1 ring-yellow-500/30",
  },
];

interface QuickLinksGridProps {
  counts?: Record<string, number>;
  onLecturesClick?: () => void;
  lecturesActive?: boolean;
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

function CardInner({ link, count, active }: { link: QuickLink; count?: number; active?: boolean }) {
  return (
    <>
      <GlowingEffect
        spread={30}
        glow={true}
        disabled={false}
        proximity={48}
        inactiveZone={0.01}
        borderWidth={1.5}
      />
      <div
        className={cn(
          "relative flex h-full flex-col overflow-hidden rounded-md border-[0.75px] bg-background p-3 shadow-sm dark:shadow-[0px_0px_20px_0px_rgba(45,45,45,0.2)] transition-all",
          "bg-gradient-to-br",
          link.gradient,
          active && "ring-2 ring-primary",
        )}
      >
        {count != null && (
          <span className="absolute top-2 right-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted/70 backdrop-blur-sm text-muted-foreground">
            {formatCount(count)}
          </span>
        )}
        <div className="flex items-center justify-center h-16 w-full">
          <div
            className={cn(
              "rounded-md p-1.5 flex items-center justify-center transition-transform group-hover:scale-110",
              link.iconBg,
            )}
          >
            {link.logo ? (
              <Image
                src={link.logo as string}
                alt={link.title}
                width={56}
                height={56}
                className="h-12 w-12 object-contain"
              />
            ) : (
              link.icon
            )}
          </div>
        </div>
        <h3 className="mt-auto text-xs leading-tight font-semibold font-sans tracking-[-0.01em] text-foreground text-center min-h-[2rem] flex items-center justify-center">
          {link.title}
        </h3>
      </div>
    </>
  );
}

export function QuickLinksGrid({ counts, onLecturesClick, lecturesActive }: QuickLinksGridProps) {
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] xl:grid-cols-4 gap-2 mb-4">
      {QUICK_LINKS.map((link) => {
        const count = counts?.[link.id];
        if (link.action === "lectures") {
          return (
            <li key={link.id} className="list-none">
              <button
                type="button"
                onClick={onLecturesClick}
                className={cn(
                  "relative h-full w-full block rounded-lg border-[0.75px] border-border p-1 hover:border-primary/60 transition-colors group text-left",
                  lecturesActive && "border-primary/60",
                )}
              >
                <CardInner link={link} count={count} active={lecturesActive} />
              </button>
            </li>
          );
        }
        return (
          <li key={link.id} className="list-none">
            <Link
              href={link.href!}
              className="relative h-full w-full block rounded-lg border-[0.75px] border-border p-1 hover:border-primary/60 transition-colors group"
            >
              <CardInner link={link} count={count} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
