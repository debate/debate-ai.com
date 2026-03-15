"use client";

import { useState, useMemo, useRef } from "react";
import lectureCategories from "@/lib/debate-data/debate-lectures-categories.json";

interface LectureExpandCardsProps {
  onCategorySelect?: (categoryKey: string) => void;
  selectedCategory?: string;
  videosData?: any[];
}

export function LectureExpandCards({
  onCategorySelect,
  selectedCategory,
  videosData,
}: LectureExpandCardsProps) {
  const categories = useMemo(() => {
    const getVideoViews = (videoId: string): number => {
      if (!videosData) return 0;
      const video = videosData.find((v) => v[0] === videoId);
      return video ? (video[7] || 0) : 0;
    };

    // Get all video IDs from all categories to find most viewed overall
    const allVideoIds: string[] = [];
    Object.values(lectureCategories.categories).forEach(cat => {
      allVideoIds.push(...cat.video_ids);
    });

    // Find most viewed video across all videos
    let overallMaxViews = 0;
    let overallMostViewedVideoId = allVideoIds[0] || "yaaAW-wtVKE";
    allVideoIds.forEach((videoId) => {
      const views = getVideoViews(videoId);
      if (views > overallMaxViews) {
        overallMaxViews = views;
        overallMostViewedVideoId = videoId;
      }
    });

    // Create "All Videos" category
    const allVideosCategory = {
      key: "all",
      label: "All Videos",
      description: "Browse all debate lecture videos across every category",
      videoCount: videosData?.length || 0,
      thumbnail: `https://img.youtube.com/vi/${overallMostViewedVideoId}/maxresdefault.jpg`,
      maxViews: overallMaxViews,
    };

    const categoriesArray = Object.entries(lectureCategories.categories)
      .map(([key, category]) => {
        // Find most viewed video for thumbnail
        let maxViews = 0;
        let mostViewedVideoId = category.video_ids[0];

        category.video_ids.forEach((videoId) => {
          const views = getVideoViews(videoId);
          if (views > maxViews) {
            maxViews = views;
            mostViewedVideoId = videoId;
          }
        });

        return {
          key,
          label: category.label,
          description: category.description,
          videoCount: category.video_ids.length,
          thumbnail: `https://img.youtube.com/vi/${mostViewedVideoId}/maxresdefault.jpg`,
          maxViews,
        };
      })
      .sort((a, b) => b.maxViews - a.maxViews); // Sort by popularity

    // Add "All Videos" as the first category
    return [allVideosCategory, ...categoriesArray];
  }, [videosData]);

  const [expandedCard, setExpandedCard] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const getCardWidth = (index: number) => {
    if (index === expandedCard) {
      return "28rem"; // Expanded width
    }
    return "3rem"; // Collapsed width - very narrow for more cards visible
  };

  const handleCardClick = (index: number, categoryKey: string) => {
    if (!isDragging) {
      setExpandedCard(index);
      onCategorySelect?.(categoryKey);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollContainerRef.current) return;
    setIsDragging(false);
    setStartX(e.pageX - scrollContainerRef.current.offsetLeft);
    setScrollLeft(scrollContainerRef.current.scrollLeft);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!scrollContainerRef.current) return;
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - startX) * 2; // Scroll speed multiplier
    if (Math.abs(walk) > 5) {
      setIsDragging(true);
    }
    scrollContainerRef.current.scrollLeft = scrollLeft - walk;
  };

  const handleMouseUp = () => {
    setTimeout(() => setIsDragging(false), 100);
  };

  return (
    <div className="w-full bg-gradient-to-br from-gray-950 via-gray-900 to-black rounded-2xl overflow-hidden">
      <div className="relative flex items-center justify-center p-4 transition-all duration-300 ease-in-out w-full">
        <div className="w-full overflow-hidden rounded-2xl">
          <div className="flex w-full items-start justify-start overflow-x-visible bg-gradient-to-br from-gray-950 via-gray-900 to-black py-8">
            <div className="relative w-full px-4">
              {/* Header */}


              {/* Expandable Cards */}
              <div
                ref={scrollContainerRef}
                className="flex gap-2 overflow-x-scroll scrollbar-hide pb-2 cursor-grab active:cursor-grabbing select-none"
                style={{
                  WebkitOverflowScrolling: 'touch',
                  scrollSnapType: 'x proximity',
                  scrollBehavior: 'smooth',
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                {categories.map((category, idx) => {
                  const isExpanded = idx === expandedCard;
                  return (
                    <div
                      key={category.key}
                      className="relative cursor-pointer overflow-hidden rounded-2xl transition-all duration-500 ease-in-out group flex-shrink-0"
                      style={{
                        width: getCardWidth(idx),
                        height: "28rem",
                        scrollSnapAlign: 'start',
                      }}
                      onMouseEnter={() => setExpandedCard(idx)}
                      onClick={() => handleCardClick(idx, category.key)}
                    >
                      {/* Background Image */}
                      <img
                        className="w-full h-full object-cover"
                        src={category.thumbnail}
                        alt={category.label}
                        loading="lazy"
                      />

                      {/* Gradient Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />

                      {/* Content Overlay */}
                      <div className="absolute inset-0 flex flex-col justify-end p-4">
                        {/* Collapsed State - Vertical Text */}
                        {!isExpanded && (
                          <div className="flex flex-col items-center justify-end h-full">
                            <div
                              className="writing-mode-vertical text-white font-bold text-lg tracking-wider transform rotate-180"
                              style={{ writingMode: "vertical-rl" }}
                            >
                              {category.label}
                            </div>
                          </div>
                        )}

                        {/* Expanded State - Full Info */}
                        {isExpanded && (
                          <div className="flex flex-col gap-2 animate-in fade-in duration-300">
                            <div className="inline-flex items-center gap-2 mb-2">
                              <span className="px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-semibold text-white border border-white/20">
                                {category.videoCount} videos
                              </span>
                            </div>

                            <h3 className="text-2xl font-bold text-white mb-1 line-clamp-2">
                              {category.label}
                            </h3>

                            <p className="text-gray-300 text-sm line-clamp-3">
                              {category.description}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Hover Effect Border */}
                      <div className="absolute inset-0 border-2 border-transparent group-hover:border-white/20 rounded-2xl transition-all duration-300 pointer-events-none" />
                    </div>
                  );
                })}
              </div>

              {/* Mobile Notice */}
              <div className="mt-6 text-center text-gray-500 text-xs md:hidden">
                Swipe horizontally to explore categories
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
