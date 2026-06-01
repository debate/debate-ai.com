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
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { cn } from "@/lib/utils";
import categoryDescriptions from "../../data/category-descriptions.json";

interface LectureCategoryGridGalleryProps {
  selectedCategory?: string;
  videosData?: any[];
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
  videosData,
}: LectureCategoryGridGalleryProps) {
  // Build category cards from video data
  const cards = useMemo(() => {
    if (!videosData || videosData.length === 0) return [];

    // Extract unique categories from video data (index 6)
    const categoryMap = new Map<
      string,
      { videos: any[]; maxViews: number; mostViewedId: string }
    >();

    videosData.forEach((video) => {
      const categoryLabel = video[6];
      if (typeof categoryLabel === "string" && categoryLabel !== "Awards") {
        if (!categoryMap.has(categoryLabel)) {
          categoryMap.set(categoryLabel, {
            videos: [],
            maxViews: 0,
            mostViewedId: video[0],
          });
        }
        const catData = categoryMap.get(categoryLabel)!;
        catData.videos.push(video);

        const views = video[7] || 0;
        if (views > catData.maxViews) {
          catData.maxViews = views;
          catData.mostViewedId = video[0];
        }
      }
    });

    // Build cards from extracted categories
    const categoryCards = Array.from(categoryMap.entries())
      .map(([label, data]) => {
        const description =
          typedCategoryDescriptions[label] ||
          "Debate lecture videos";
        const normalizedKey = label
          .toLowerCase()
          .replace(/\s+/g, "_")
          .replace(/[&/]/g, "_");

        return {
          id: normalizedKey,
          title: label,
          description,
          videoCount: data.videos.length,
          icon: CATEGORY_ICONS[label] || <BookOpen className="h-4 w-4" />,
          maxViews: data.maxViews,
        };
      })
      .sort((a, b) => b.maxViews - a.maxViews); // Sort by popularity

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
  }, [videosData]);

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
