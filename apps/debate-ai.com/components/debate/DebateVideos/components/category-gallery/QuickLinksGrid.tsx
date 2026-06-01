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
import { IconBook, IconTrophyGoat, IconLeaderboard, IconTrophy, IconRoundsYoutube, IconLectures } from "@/components/icons";

interface QuickLink {
  id: string;
  title: string;
  href: string;
  icon?: React.ReactNode;
  logo?: string | StaticImageData;
  gradient: string;
  iconBg: string;
}

const QUICK_LINKS: QuickLink[] = [
  {
    id: "college",
    title: "College Debates",
    href: "/videos/college",
    logo: "https://i.imgur.com/cFmTAdJ.png",
    gradient: "from-purple-500/20 via-violet-500/10 to-transparent",
    iconBg: "bg-purple-500/15 ring-1 ring-purple-500/30",
  },
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
    id: "lectures",
    title: "Lectures",
    href: "/videos/lectures",
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
  showLectures?: boolean;
  onToggleLectures?: () => void;
  activeId?: string;
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

function CardBody({ link, showLectures, count, isActive }: { link: QuickLink; showLectures?: boolean; count?: number; isActive?: boolean }) {
  return (
    <>
      <GlowingEffect spread={30} glow proximity={48} inactiveZone={0.01} borderWidth={1.5} />
      <div
        className={cn(
          "relative flex h-full flex-col overflow-hidden rounded-md border-[0.75px] bg-background p-2 shadow-sm dark:shadow-[0px_0px_20px_0px_rgba(45,45,45,0.2)] transition-all bg-gradient-to-br",
          link.gradient,
          isActive && "ring-1 ring-primary/50",
        )}
      >
        <div className="flex items-center justify-center h-14 w-full">
          <div className={cn("rounded-md p-1.5 flex items-center justify-center transition-transform group-hover:scale-110", link.iconBg)}>
            {link.logo ? (
              <Image src={link.logo as string} alt={link.title} width={48} height={48} className="h-10 w-10 object-contain" />
            ) : (
              link.icon
            )}
          </div>
        </div>
        <h3 className="mt-auto text-xs leading-tight font-semibold font-sans tracking-[-0.01em] text-foreground text-center min-h-[2rem] flex items-center justify-center">
          {link.title}
        </h3>
        {count != null && count > 0 && (
          <span className="absolute top-1 right-1 text-[10px] font-semibold text-foreground/60 leading-none">
            {formatCount(count)}
          </span>
        )}
      </div>
    </>
  );
}

export function QuickLinksGrid({ counts, showLectures = false, onToggleLectures, activeId }: QuickLinksGridProps) {
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2 mb-4">
      {QUICK_LINKS.map((link) => {
        const isActive = activeId === link.id;
        return (
          <li key={link.id} className="list-none">
            <Link
              href={link.href}
              className={cn(
                "relative h-full w-full block rounded-lg border-[0.75px] border-border p-1 hover:border-primary/60 transition-colors group",
                isActive && "border-primary/60",
              )}
            >
              <CardBody link={link} showLectures={showLectures} count={counts?.[link.id]} isActive={isActive} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
