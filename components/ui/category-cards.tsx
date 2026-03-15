"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface CategoryCardProps {
  className?: string;
  thumbnail?: string;
  title?: string;
  description?: string;
  videoCount?: number;
  categoryKey?: string;
  onHover?: () => void;
  onLeave?: () => void;
  isActive?: boolean;
  onTap?: () => void;
  onClick?: () => void;
}

function CategoryCard({
  className,
  thumbnail,
  title = "Category",
  description = "Category description",
  videoCount = 0,
  categoryKey,
  onHover,
  onLeave,
  isActive,
  onTap,
  onClick,
}: CategoryCardProps) {
  const handleClick = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();

    // Check if it's a touch device
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    if (isTouchDevice) {
      // On mobile: first tap activates, second tap selects
      if (!isActive) {
        onTap?.();
      } else {
        onClick?.();
      }
    } else {
      // On desktop: click to select
      onClick?.();
    }
  };

  return (
    <div
      onClick={handleClick}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      className={cn(
        "relative flex h-[220px] w-[320px] select-none flex-col rounded-2xl border border-border bg-card/90 backdrop-blur-sm overflow-hidden transition-all duration-300 hover:border-primary/50 hover:bg-card cursor-pointer hover:shadow-xl shrink-0",
        isActive && "ring-2 ring-primary/70 shadow-lg",
        className
      )}
    >
      {/* Thumbnail */}
      <div className="relative h-24 sm:h-32 w-full overflow-hidden">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/20 via-primary/10 to-background flex items-center justify-center">
            <span className="text-4xl sm:text-6xl opacity-50">📚</span>
          </div>
        )}
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-transparent" />
      </div>

      {/* Content */}
      <div className="px-4 sm:px-5 py-3 sm:py-4 flex flex-col flex-1">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-bold text-foreground text-sm sm:text-lg leading-tight flex-1">
            {title}
          </h3>
          <span className="text-xs sm:text-sm text-muted-foreground bg-muted px-2 py-1 rounded-full ml-2 shrink-0">
            {videoCount} videos
          </span>
        </div>

        <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed line-clamp-2 sm:line-clamp-3">
          {description}
        </p>
      </div>
    </div>
  );
}

interface CategoryCardsProps {
  cards?: CategoryCardProps[];
  onCategorySelect?: (categoryKey: string) => void;
}

export default function CategoryCards({ cards, onCategorySelect }: CategoryCardsProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const getCardClassName = (index: number, baseClassName: string) => {
    // On hover, expand the card horizontally to reveal more info
    const focusedIndex = hoveredIndex ?? activeIndex;

    if (focusedIndex === index) {
      return baseClassName + " !scale-105 !z-50";
    }
    return baseClassName;
  };

  const handleTap = (index: number) => {
    if (activeIndex === index) {
      // Already active, will select on next tap
      return;
    }
    setActiveIndex(index);
  };

  const handleCardClick = (categoryKey?: string) => {
    if (categoryKey && onCategorySelect) {
      onCategorySelect(categoryKey);
    }
  };

  const defaultCards: CategoryCardProps[] = [
    {
      className:
        "[grid-area:stack] hover:-translate-y-10 before:absolute before:w-[100%] before:outline-1 before:rounded-2xl before:outline-border before:h-[100%] before:content-[''] before:bg-blend-overlay before:bg-background/60 grayscale-[100%] hover:before:opacity-0 before:transition-opacity before:duration-500 hover:grayscale-0 before:left-0 before:top-0",
      title: "Affirmative Strategy",
      description: "1AC construction, 2AC, 1AR, aff writing, case selection",
      videoCount: 28,
      categoryKey: "affirmative_strategy",
    },
    {
      className:
        "[grid-area:stack] translate-x-8 sm:translate-x-16 translate-y-6 sm:translate-y-10 hover:-translate-y-1 before:absolute before:w-[100%] before:outline-1 before:rounded-2xl before:outline-border before:h-[100%] before:content-[''] before:bg-blend-overlay before:bg-background/60 grayscale-[100%] hover:before:opacity-0 before:transition-opacity before:duration-500 hover:grayscale-0 before:left-0 before:top-0",
      title: "Kritik / Critical Theory",
      description: "K fundamentals, afropessimism, cap K, settler colonialism, Baudrillard, security K, queer theory",
      videoCount: 50,
      categoryKey: "kritik_critical_theory",
    },
    {
      className: "[grid-area:stack] translate-x-16 sm:translate-x-32 translate-y-12 sm:translate-y-20 hover:translate-y-6 sm:hover:translate-y-10",
      title: "Speaking & Delivery",
      description: "Top speaker tips, speaking drills, roadmapping, vocal delivery, CX technique",
      videoCount: 22,
      categoryKey: "speaking_and_delivery",
    },
  ];

  const displayCards = cards || defaultCards;

  return (
    <div className="w-full overflow-x-auto my-6 mb-8">
      <div className="flex gap-4 px-4 pb-4 min-w-max">
        {displayCards.map((cardProps, index) => (
          <CategoryCard
            key={index}
            {...cardProps}
            className={getCardClassName(index, cardProps.className || "")}
            onHover={() => setHoveredIndex(index)}
            onLeave={() => setHoveredIndex(null)}
            isActive={activeIndex === index}
            onTap={() => handleTap(index)}
            onClick={() => handleCardClick(cardProps.categoryKey)}
          />
        ))}
      </div>
    </div>
  );
}

// Demo component
function Component() {
  return (
    <div className="flex min-h-[500px] w-full items-center justify-center bg-background p-8">
      <CategoryCards />
    </div>
  );
}

export { CategoryCard, CategoryCards, Component };
export type { CategoryCardProps, CategoryCardsProps };
