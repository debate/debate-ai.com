/**
 * @fileoverview Lecture category gallery with icons and video counts — the
 * category bar at the top of the lecture library, and the only place the
 * categories are listed (the sidebar has a single Lectures row). Each card
 * highlights its background on hover and links straight to its category; the
 * open one is drawn selected.
 *
 * The top of the bar is a row of badges for the main round collections —
 * College Policy, HS Policy, Individual and Forum — drawn with the logos the
 * rankings page shows beside its topic names. Parli has no logo and is listed
 * under Formats instead.
 *
 * Below it the cards are laid out as columns: a heading (General,
 * Strategy, Topics & ideas, Formats) with its categories listed underneath.
 * A category not named in {@link LECTURE_CATEGORY_SECTIONS} lands in a
 * trailing "More" column, so a new category never goes missing.
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
  Landmark,
  Presentation,
  Vote,
  Swords,
  Megaphone,
  Archive,
} from "lucide-react";
import { FormatBadgeCards, MAIN_FORMAT_BADGES } from "./FormatBadgeCards";
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
   * (Atlantic, Congress, Speech on All Videos). They are listed at the end of
   * the Formats section, after Parli.
   */
  extraLinks?: LectureGalleryExtraLink[];
  /**
   * Video totals per main round collection, keyed by {@link MAIN_FORMAT_BADGES}
   * id (`college`, `policy`, `ld`, `pf`); `parli` is the total on its Formats
   * card. A badge without a total shows none.
   */
  formatCounts?: Record<string, number | undefined>;
  /**
   * Which part of the bar to draw: `"all"` (default) is everything,
   * `"rounds"` the format badges and the Formats section (the Debate Rounds
   * page), `"lectures"` the sections other than Formats (Strategy Lectures),
   * `"formats"` only the four format cards (the division pages).
   */
  scope?: GalleryScope;
  /** Id of the format card to draw selected: the division page being viewed. */
  activeFormatId?: string;
}

/** The parts of the bar a page can ask for; see `scope`. */
export type GalleryScope = "all" | "rounds" | "lectures" | "formats";

export { MAIN_FORMAT_BADGES };

/** Parli's card in the Formats section, ahead of any collection links. */
const PARLI_LINK = { id: "parli", title: "Parli", href: "/videos/parli" };

/** A non-category card shown in the Formats section, e.g. `/videos/atlantic`. */
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
    title: "General",
    labels: [
      "Novice & Introductory",
      "Camp & Coaching Advice",
      "Judge & Tournament Skills",
      "Research & Flowing",
      "Speaking & Delivery",
      "Miscellaneous",
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
    ],
  },
  {
    title: "Topics & ideas",
    labels: [
      "Topic Lectures",
      "Policy Topic Lectures",
      "PF & LD Topic Analysis",
      "Public Forum",
      "Round Analysis",
      "Philosophy & IR Theory",
      "Documentaries & Culture",
      "NSDA Speech",
    ],
  },
  {
    title: "Formats",
    labels: ["WSD", "Demo Debates", "Open Public", "Open Super Debates", "Congress", "Speech"],
  },
];

/** Title of the section holding the formats: Worlds, Parli, Demo Debates … */
const FORMATS_SECTION_TITLE = "Formats";

/**
 * Whether a stored lecture category label sits in the Formats section — the
 * categories Debate Rounds lists, rather than Strategy Lectures.
 */
export function isFormatsSectionLabel(label: string): boolean {
  return LECTURE_CATEGORY_SECTIONS.some(
    (section) => section.title === FORMATS_SECTION_TITLE && section.labels.includes(label),
  );
}

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
  "Documentaries & Culture": <Film className="h-4 w-4" />,
  "Camp & Coaching Advice": <Users className="h-4 w-4" />,
  "Novice & Introductory": <GraduationCap className="h-4 w-4" />,
  "WSD": <Globe className="h-4 w-4" />, // Example icon, adjust as needed
  "ACC": <Users className="h-4 w-4" />, // Example icon, adjust as needed
  "Congress": <Vote className="h-4 w-4" />,
  "Speech": <Mic className="h-4 w-4" />, // Example icon, adjust as needed
  "NSDA Speech": <Mic className="h-4 w-4" />,
  "Open Public": <Megaphone className="h-4 w-4" />,
  "Open Super Debates": <Swords className="h-4 w-4" />,
  "Miscellaneous": <Archive className="h-4 w-4" />,
};


export function LectureCategoryGridGallery({
  selectedCategory,
  categories,
  layout = "grid",
  extraLinks,
  formatCounts,
  scope = "all",
  activeFormatId,
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

    return { categoryCards };
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
    let formats = grouped.find((section) => section.title === FORMATS_SECTION_TITLE);
    if (!formats) {
      formats = { title: FORMATS_SECTION_TITLE, items: [] };
      grouped.push(formats);
    }
    const links = extraLinks ?? [];
    if (!links.some((link) => link.id === PARLI_LINK.id)) {
      formats.items.push({
        ...PARLI_LINK,
        description: "Parliamentary debate rounds",
        videoCount: formatCounts?.parli ?? 0,
        icon: <Landmark className="h-4 w-4" />,
        selected: false,
      });
    }
    for (const link of links) {
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
    return grouped.filter((section) => {
      if (section.items.length === 0) return false;
      if (scope === "all") return true;
      return (section.title === FORMATS_SECTION_TITLE) === (scope === "rounds");
    });
  }, [cards, extraLinks, formatCounts, selectedId, scope]);

  if (scope === "formats") {
    return (
      <div className="w-full">
        <FormatBadgeCards counts={formatCounts} activeId={activeFormatId} />
      </div>
    );
  }

  if (!cards) return null;

  const pillListClass = cn(
    "grid gap-1.5",
    layout === "list" ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
  );

  return (
    <div className="w-full flex flex-col gap-4">
      {scope !== "lectures" && <FormatBadgeCards counts={formatCounts} activeId={activeFormatId} />}
      <div className="flex flex-col gap-3">
        {sections.map((section) => (
          <section key={section.title} aria-label={section.title} className="min-w-0">
            <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {section.title}
            </h2>
            <ul className={pillListClass}>
              {section.items.map((item) => (
                <GalleryPill
                  key={item.id}
                  icon={item.icon}
                  title={item.title}
                  videoCount={item.videoCount}
                  isSelected={item.selected}
                  href={item.href}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

/** A compact pill linking to one category or collection in the bottom lists. */
function GalleryPill({
  icon,
  title,
  videoCount,
  isSelected,
  href,
}: Pick<GridItemProps, "icon" | "title" | "videoCount" | "isSelected" | "href">) {
  return (
    <li className="min-w-0 list-none">
      <Link
        href={href}
        scroll={false}
        prefetch={false}
        aria-current={isSelected ? "page" : undefined}
        className={cn(
          "flex h-full min-w-0 items-center gap-1.5 rounded-full border-[0.75px] border-border bg-background px-2 py-1 shadow-sm transition-colors hover:border-primary/50 hover:bg-accent focus-visible:bg-accent",
          isSelected && "border-primary bg-primary/10 hover:bg-primary/15",
        )}
      >
        <span className="shrink-0 text-muted-foreground">{icon}</span>
        <span className="min-w-0 flex-1 truncate text-xs font-medium leading-tight text-foreground">
          {title}
        </span>
        <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
          {videoCount}
        </span>
      </Link>
    </li>
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
