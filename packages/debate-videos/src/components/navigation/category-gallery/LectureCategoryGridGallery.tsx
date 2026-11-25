/**
 * @fileoverview Grid-based lecture category gallery with icons and video
 * counts — the category bar at the top of the lecture library, and the only
 * place the categories are listed (the sidebar has a single Lectures row).
 * Each card highlights its background on hover and links straight to its
 * category; the open one is drawn selected.
 *
 * The cards are grouped under a few headings (Getting started, Strategy,
 * Topics & ideas, Formats) so the list reads as sections rather than one
 * long run. A category not named in {@link LECTURE_CATEGORY_SECTIONS} lands
 * in a trailing "More" section, so a new category never goes missing.
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
  Presentation,
  Vote,
} from "lucide-react";
import { GlowingEffect } from "../../../ui/effects/glowing-effect";
import { cn } from "../../../ui/lib/utils";
import { lectureCategoryHref } from "../../../panels/lectureRouteConfig";
import { lectureCategoryDisplayLabel, type LectureCategoryFacet } from "../../../types/videos";
import categoryDescriptions from "../../../data/category-descriptions.json";

interface LectureCategoryGridGalleryProps {
  /** Slug of the category currently being browsed. */
  selectedCategory?: string;
  /**
   * Category cards from `/api/videos/meta` — label, slug, video count and
   * popularity. Counts are computed over the whole library server-side, since
   * the grid itself only holds the pages loaded so far.
   */
  categories?: LectureCategoryFacet[];
  /**
   * `"grid"` (default) renders the multi-column tile gallery. `"list"` stacks
   * a single column, meant for the persistent left sidebar.
   */
  layout?: "grid" | "list";
  /**
   * Round collections linked from the bar but not lecture categories
   * (Atlantic, Parliamentary, Congress, Speech on All Videos). They are
   * listed at the end of the Formats section.
   */
  extraLinks?: LectureGalleryExtraLink[];
}

/** A non-category card shown in the Formats section, e.g. `/videos/parli`. */
export interface LectureGalleryExtraLink {
  id: string;
  title: string;
  href: string;
  count: number;
  icon: React.ReactNode;
  description?: string;
}

/**
 * The headings the category cards are grouped under, each with its
 * categories (by display label) in the order they are shown.
 */
export const LECTURE_CATEGORY_SECTIONS: { title: string; labels: string[] }[] = [
  {
    title: "Getting started",
    labels: [
      "Novice & Introductory",
      "Camp & Coaching Advice",
      "Judge & Tournament Skills",
      "Research & Flowing",
      "Speaking & Delivery",
    ],
  },
  {
    title: "Strategy",
    labels: [
      "Affirmative Strategy",
      "Negative Strategy",
      "Counterplans & Theory",
      "Disadvantages",
      "Topicality & Framework",
      "Critique / Critical Theory",
      "Impact Calculus & Evidence",
      "Round Analysis",
    ],
  },
  {
    title: "Topics & ideas",
    labels: [
      "Topic Lectures",
      "Policy Topic Lectures",
      "PF & LD Topic Analysis",
      "Philosophy & IR Theory",
      "Documentaries & Culture",
    ],
  },
  {
    title: "Formats",
    labels: ["Public Forum", "WSD", "NSDA Speech", "Demo Debates", "Congress", "Speech"],
  },
];

/** Heading for categories no section names. */
const OTHER_SECTION_TITLE = "More";

const typedCategoryDescriptions = categoryDescriptions as Record<string, string>;

// Map category labels to icons
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  "Affirmative Strategy": <Lightbulb className="h-4 w-4" />,
  "Negative Strategy": <Shield className="h-4 w-4" />,
  "Critique / Critical Theory": <Brain className="h-4 w-4" />,
  "Counterplans & Theory": <Scale className="h-4 w-4" />,
  "Topicality & Framework": <Gavel className="h-4 w-4" />,
  Disadvantages: <AlertTriangle className="h-4 w-4" />,
  "Speaking & Delivery": <Mic className="h-4 w-4" />,
  "Research & Flowing": <BookOpen className="h-4 w-4" />,
  "Topic Lectures": <Presentation className="h-4 w-4" />,
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
  "WSD": <Globe className="h-4 w-4" />, // Example icon, adjust as needed
  "ACC": <Users className="h-4 w-4" />, // Example icon, adjust as needed
  "Congress": <Vote className="h-4 w-4" />,
  "Speech": <Mic className="h-4 w-4" />, // Example icon, adjust as needed
  "NSDA Speech": <Mic className="h-4 w-4" />,
};


export function LectureCategoryGridGallery({
  selectedCategory,
  categories,
  layout = "grid",
  extraLinks,
}: LectureCategoryGridGalleryProps) {
  // Build category cards from the server-computed facets, most popular first.
  const selectedId = selectedCategory ?? "all";
  const cards = useMemo(() => {
    if (!categories || categories.length === 0) return null;

    const categoryCards = categories.map((category) => ({
      id: category.key,
      // The stored label places the card in its section; the title is what shows.
      label: category.label,
      title: lectureCategoryDisplayLabel(category.label),
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

    return { allLecturesCard, categoryCards };
  }, [categories]);

  // Group the category cards under their section headings. Empty sections
  // are dropped; the extra collection links close out Formats.
  const sections = useMemo(() => {
    if (!cards) return [];
    const byLabel = new Map(cards.categoryCards.map((card) => [card.label, card]));
    const placed = new Set<string>();
    const grouped: { title: string; items: GallerySectionItem[] }[] = LECTURE_CATEGORY_SECTIONS.map(
      (section) => {
        const items: GallerySectionItem[] = [];
        for (const label of section.labels) {
          const card = byLabel.get(label);
          if (!card) continue;
          placed.add(label);
          items.push({ ...card, href: lectureCategoryHref(card.id), selected: selectedId === card.id });
        }
        return { title: section.title, items };
      },
    );
    const rest = cards.categoryCards.filter((card) => !placed.has(card.label));
    if (rest.length > 0) {
      grouped.push({
        title: OTHER_SECTION_TITLE,
        items: rest.map((card) => ({
          ...card,
          href: lectureCategoryHref(card.id),
          selected: selectedId === card.id,
        })),
      });
    }
    if (extraLinks && extraLinks.length > 0) {
      let formats = grouped.find((section) => section.title === "Formats");
      if (!formats) {
        formats = { title: "Formats", items: [] };
        grouped.push(formats);
      }
      for (const link of extraLinks) {
        formats.items.push({
          id: link.id,
          title: link.title,
          description: link.description ?? "Debate videos",
          videoCount: link.count,
          icon: link.icon,
          href: link.href,
          selected: false,
        });
      }
    }
    return grouped.filter((section) => section.items.length > 0);
  }, [cards, extraLinks, selectedId]);

  if (!cards) return null;

  const gridClass = cn(
    "grid gap-2",
    layout === "list" ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
  );

  // A plain link per category: this is the page's category bar, so a click
  // always lands on that category ("All Lectures" is its own card, above the
  // sections).
  const all = cards.allLecturesCard;
  return (
    <div className="w-full flex flex-col gap-4">
      <ul className={gridClass}>
        <GridItem
          icon={all.icon}
          title={all.title}
          description={all.description}
          videoCount={all.videoCount}
          isSelected={selectedId === all.id}
          href={lectureCategoryHref(all.id)}
        />
      </ul>
      {sections.map((section) => (
        <section key={section.title} aria-label={section.title}>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {section.title}
          </h2>
          <ul className={gridClass}>
            {section.items.map((item) => (
              <GridItem
                key={item.id}
                icon={item.icon}
                title={item.title}
                description={item.description}
                videoCount={item.videoCount}
                isSelected={item.selected}
                href={item.href}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

interface GallerySectionItem {
  id: string;
  title: string;
  description: React.ReactNode;
  videoCount: number;
  icon: React.ReactNode;
  href: string;
  selected: boolean;
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

export const GridItem = ({
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
        // See `TreeItem`: the gallery renders a tile per lecture category, and
        // prefetching every one of them on mount competed with the video feed.
        prefetch={false}
        onClick={onClick}
        aria-current={isSelected ? "page" : undefined}
        className="group relative h-full w-full block rounded-lg border-[0.75px] border-border p-1 hover:border-primary/50 transition-colors"
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
            "relative flex h-full items-center gap-1.5 overflow-hidden rounded-md border-[0.75px] bg-background p-1.5 shadow-sm dark:shadow-[0px_0px_20px_0px_rgba(45,45,45,0.2)] transition-colors",
            "group-hover:bg-accent group-focus-visible:bg-accent",
            isSelected && "border-primary bg-primary/10 group-hover:bg-primary/15"
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
