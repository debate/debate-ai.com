/**
 * @fileoverview Grid-based lecture category gallery with icons and video counts
 */

"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import {
  Lightbulb,
  Shield,
  Brain,
  Scale,
  Gavel,
  AlertTriangle,
  Mic,
  BookOpen,
  Trophy,
  MessageSquare,
  Target,
  Zap,
  Globe,
  Film,
  Users,
  GraduationCap,
  LayoutGrid,
} from "lucide-react";
import { GlowingEffect } from "debate-ui/src/effects/glowing-effect";
import { cn } from "debate-ui/src/lib/utils";
import type { LectureCategoryFacet } from "../../types/videos";
import categoryDescriptions from "../../data/category-descriptions.json";

interface LectureCategoryGridGalleryProps {
  /** Slug of the category currently being browsed. */
  selectedCategory?: string;
  /**
   * Category cards from `/api/videos/meta` — label, slug, video count and
   * popularity. Counts are computed over the whole library server-side, since
   * the grid itself only holds the pages loaded so far.
   */
  categories?: LectureCategoryFacet[];
}

const typedCategoryDescriptions = categoryDescriptions as Record<string, string>;

// Map category labels to icons
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  "Affirmative Strategy": <Lightbulb className="h-4 w-4" />,
  "Negative Strategy": <Shield className="h-4 w-4" />,
  "Kritik / Critical Theory": <Brain className="h-4 w-4" />,
  "Counterplans & Theory": <Scale className="h-4 w-4" />,
  "Topicality & Framework": <Gavel className="h-4 w-4" />,
  Disadvantages: <AlertTriangle className="h-4 w-4" />,
  "Speaking & Delivery": <Mic className="h-4 w-4" />,
  "Research & Flowing": <BookOpen className="h-4 w-4" />,
  "PF & LD Topic Analysis": <Target className="h-4 w-4" />,
  "Policy Topic Lectures": <MessageSquare className="h-4 w-4" />,
  "Demo Debates": <Trophy className="h-4 w-4" />,
  "Judge & Tournament Skills": <Trophy className="h-4 w-4" />,
  "Impact Calculus & Evidence": <Zap className="h-4 w-4" />,
  "Philosophy & IR Theory": <Globe className="h-4 w-4" />,
  "Public Forum": <MessageSquare className="h-4 w-4" />,
  "All Lectures": <LayoutGrid className="h-4 w-4" />,
  "Documentaries & Culture": <Film className="h-4 w-4" />,
  "Camp & Coaching Advice": <Users className="h-4 w-4" />,
  "Novice & Introductory": <GraduationCap className="h-4 w-4" />,
};


export function LectureCategoryGridGallery({
  selectedCategory,
  categories,
}: LectureCategoryGridGalleryProps) {
  // Build category cards from the server-computed facets, most popular first.
  const cards = useMemo(() => {
    if (!categories || categories.length === 0) return [];

    const categoryCards = categories.map((category) => ({
      id: category.key,
      title: category.label,
      description:
        typedCategoryDescriptions[category.label] || "Debate lecture videos",
      videoCount: category.count,
      icon: CATEGORY_ICONS[category.label] || <BookOpen className="h-4 w-4" />,
      maxViews: category.maxViews,
    }));

    const totalCount = categoryCards.reduce((sum, c) => sum + c.videoCount, 0);
    const allLecturesCard = {
      id: "all",
      title: "All Lectures",
      description: "Browse every debate lecture across all categories",
      videoCount: totalCount,
      icon: CATEGORY_ICONS["All Lectures"],
      maxViews: Infinity,
    };

    return [allLecturesCard, ...categoryCards];
  }, [categories]);

  const buildHref = (categoryId: string) => {
    if (categoryId === "all") return "/videos";
    const isSame = selectedCategory === categoryId;
    return isSame ? "/videos" : `/videos/${encodeURIComponent(categoryId)}`;
  };

  return (
    <div className="w-full">


      <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
        {cards.map((card) => (
          <GridItem
            key={card.id}
            icon={card.icon}
            title={card.title}
            description={card.description}
            videoCount={card.videoCount}
            isSelected={selectedCategory === card.id}
            href={buildHref(card.id)}
          />
        ))}
      </ul>
    </div>
  );
}

interface GridItemProps {
  icon: React.ReactNode;
  title: string;
  description: React.ReactNode;
  videoCount: number;
  isSelected?: boolean;
  href: string;
  onClick?: () => void;
}

const GridItem = ({
  icon,
  title,
  description,
  videoCount,
  isSelected,
  href,
  onClick,
}: GridItemProps) => {
  return (
    <li className="list-none">
      <Link
        href={href}
        scroll={false}
        onClick={onClick}
        className="relative h-full w-full block rounded-lg border-[0.75px] border-border p-1 hover:border-primary/50 transition-colors"
      >
        <GlowingEffect
          spread={30}
          glow={true}
          disabled={false}
          proximity={48}
          inactiveZone={0.01}
          borderWidth={isSelected ? 2 : 1.5}
        />
        <div
          className={cn(
            "relative flex h-full items-center gap-1.5 overflow-hidden rounded-md border-[0.75px] bg-background p-1.5 shadow-sm dark:shadow-[0px_0px_20px_0px_rgba(45,45,45,0.2)] transition-all",
            isSelected && "border-primary bg-primary/5"
          )}
        >
          <div className="shrink-0 rounded-md border-[0.75px] border-border bg-muted p-1">
            {icon}
          </div>
          <span className="shrink-0 text-xs font-medium text-muted-foreground px-1.5 py-0.5 rounded-full bg-muted">
            {videoCount}
          </span>
          <h3 className="min-w-0 flex-1 text-xs leading-tight font-semibold font-sans tracking-[-0.01em] text-foreground line-clamp-2">
            {title}
          </h3>
        </div>
      </Link>
    </li>
  );
};
