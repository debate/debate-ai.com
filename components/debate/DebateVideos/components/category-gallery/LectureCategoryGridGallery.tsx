"use client";

import React, { useMemo } from "react";
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
  Award,
  Film,
  Users,
  GraduationCap,
} from "lucide-react";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { cn } from "@/lib/utils";
import categoryDescriptions from "@/lib/debate-data/debate-metadata/debate-lectures-category-descriptions.json";

interface LectureCategoryGridGalleryProps {
  onCategorySelect?: (categoryKey: string) => void;
  selectedCategory?: string;
  videosData?: any[];
}

type CategoryDescriptions = {
  categories: Record<string, { description: string }>;
};

const typedCategoryDescriptions = categoryDescriptions as CategoryDescriptions;

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
  Awards: <Award className="h-4 w-4" />,
  "Documentaries & Culture": <Film className="h-4 w-4" />,
  "Camp & Coaching Advice": <Users className="h-4 w-4" />,
  "Novice & Introductory": <GraduationCap className="h-4 w-4" />,
};

// Define grid areas for responsive layout
const GRID_AREAS = [
  "md:[grid-area:1/1/2/7] xl:[grid-area:1/1/2/5]",
  "md:[grid-area:1/7/2/13] xl:[grid-area:2/1/3/5]",
  "md:[grid-area:2/1/3/7] xl:[grid-area:1/5/3/8]",
  "md:[grid-area:2/7/3/13] xl:[grid-area:1/8/2/13]",
  "md:[grid-area:3/1/4/13] xl:[grid-area:2/8/3/13]",
  "md:[grid-area:4/1/5/7] xl:[grid-area:3/1/4/5]",
  "md:[grid-area:4/7/5/13] xl:[grid-area:3/5/4/8]",
  "md:[grid-area:5/1/6/7] xl:[grid-area:3/8/4/13]",
  "md:[grid-area:5/7/6/13] xl:[grid-area:4/1/5/7]",
  "md:[grid-area:6/1/7/13] xl:[grid-area:4/7/5/13]",
];

export function LectureCategoryGridGallery({
  onCategorySelect,
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
      if (typeof categoryLabel === "string") {
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
    return Array.from(categoryMap.entries())
      .map(([label, data]) => {
        const description =
          typedCategoryDescriptions.categories[label]?.description ||
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
  }, [videosData]);

  const handleCategoryClick = (categoryId: string) => {
    onCategorySelect?.(categoryId);
  };

  return (
    <div className="w-full">
      <div className="mb-6">
        <h2 className="text-2xl md:text-3xl font-bold mb-2">
          Debate Lecture Categories
        </h2>
        <p className="text-muted-foreground text-sm md:text-base">
          Explore {cards.length} curated categories •{" "}
          {cards.reduce((sum, c) => sum + c.videoCount, 0)} total videos
        </p>
      </div>

      <ul className="grid grid-cols-1 grid-rows-none gap-4 md:grid-cols-12 md:grid-rows-3 lg:gap-4 xl:max-h-[60rem] xl:grid-rows-4">
        {cards.slice(0, 10).map((card, index) => (
          <GridItem
            key={card.id}
            area={GRID_AREAS[index % GRID_AREAS.length]}
            icon={card.icon}
            title={card.title}
            description={card.description}
            videoCount={card.videoCount}
            isSelected={selectedCategory === card.id}
            onClick={() => handleCategoryClick(card.id)}
          />
        ))}
      </ul>
    </div>
  );
}

interface GridItemProps {
  area: string;
  icon: React.ReactNode;
  title: string;
  description: React.ReactNode;
  videoCount: number;
  isSelected?: boolean;
  onClick?: () => void;
}

const GridItem = ({
  area,
  icon,
  title,
  description,
  videoCount,
  isSelected,
  onClick,
}: GridItemProps) => {
  return (
    <li className={cn("min-h-[14rem] list-none", area)}>
      <button
        onClick={onClick}
        className="relative h-full w-full rounded-[1.25rem] border-[0.75px] border-border p-2 md:rounded-[1.5rem] md:p-3 hover:border-primary/50 transition-colors"
      >
        <GlowingEffect
          spread={40}
          glow={true}
          disabled={false}
          proximity={64}
          inactiveZone={0.01}
          borderWidth={isSelected ? 3 : 2}
        />
        <div
          className={cn(
            "relative flex h-full flex-col justify-between gap-6 overflow-hidden rounded-xl border-[0.75px] bg-background p-6 shadow-sm dark:shadow-[0px_0px_27px_0px_rgba(45,45,45,0.3)] md:p-6 transition-all",
            isSelected && "border-primary bg-primary/5"
          )}
        >
          <div className="relative flex flex-1 flex-col justify-between gap-3">
            <div className="flex items-start justify-between gap-2">
              <div className="w-fit rounded-lg border-[0.75px] border-border bg-muted p-2">
                {icon}
              </div>
              <span className="text-xs font-medium text-muted-foreground px-2 py-1 rounded-full bg-muted">
                {videoCount} videos
              </span>
            </div>
            <div className="space-y-3">
              <h3 className="pt-0.5 text-xl leading-[1.375rem] font-semibold font-sans tracking-[-0.04em] md:text-2xl md:leading-[1.875rem] text-balance text-foreground">
                {title}
              </h3>
              <h2 className="[&_b]:md:font-semibold [&_strong]:md:font-semibold font-sans text-sm leading-[1.125rem] md:text-base md:leading-[1.375rem] text-muted-foreground">
                {description}
              </h2>
            </div>
          </div>
        </div>
      </button>
    </li>
  );
};
