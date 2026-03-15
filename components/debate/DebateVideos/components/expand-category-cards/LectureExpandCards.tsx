"use client";

import { useState, useMemo, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import categoryDescriptions from "../../panels/debate-lectures-category-descriptions.json";

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
    if (!videosData || videosData.length === 0) return [];

    const getVideoViews = (videoId: string): number => {
      const video = videosData.find((v) => v[0] === videoId);
      return video ? (video[7] || 0) : 0;
    };

    // Extract unique categories from video data (index 6)
    const categoryMap = new Map<string, { videos: any[], maxViews: number, mostViewedId: string }>();

    videosData.forEach((video) => {
      const categoryLabel = video[6];
      if (typeof categoryLabel === 'string') {
        if (!categoryMap.has(categoryLabel)) {
          categoryMap.set(categoryLabel, { videos: [], maxViews: 0, mostViewedId: video[0] });
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

    // Find overall most viewed video for "All Videos" category
    let overallMaxViews = 0;
    let overallMostViewedVideoId = videosData[0]?.[0] || "yaaAW-wtVKE";
    videosData.forEach((video) => {
      const views = video[7] || 0;
      if (views > overallMaxViews) {
        overallMaxViews = views;
        overallMostViewedVideoId = video[0];
      }
    });

    // Create "All Videos" category
    const allVideosCategory = {
      key: "all",
      label: "All Videos",
      description: "Browse all debate lecture videos across every category",
      videoCount: videosData.length,
      thumbnail: `https://img.youtube.com/vi/${overallMostViewedVideoId}/maxresdefault.jpg`,
      maxViews: overallMaxViews,
    };

    // Build categories array from the extracted data
    const categoriesArray = Array.from(categoryMap.entries())
      .map(([label, data]) => {
        // Get description from the descriptions file
        const description = categoryDescriptions[label as keyof typeof categoryDescriptions] || "Debate lecture videos";

        return {
          key: label.toLowerCase().replace(/\s+/g, '_').replace(/[&/]/g, '_'),
          label,
          description,
          videoCount: data.videos.length,
          thumbnail: `https://img.youtube.com/vi/${data.mostViewedId}/maxresdefault.jpg`,
          maxViews: data.maxViews,
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

  const handlePrevious = () => {
    const newIndex = expandedCard > 0 ? expandedCard - 1 : categories.length - 1;
    setExpandedCard(newIndex);
    onCategorySelect?.(categories[newIndex].key);
  };

  const handleNext = () => {
    const newIndex = expandedCard < categories.length - 1 ? expandedCard + 1 : 0;
    setExpandedCard(newIndex);
    onCategorySelect?.(categories[newIndex].key);
  };

  return (
    <div className="w-full bg-gradient-to-br from-gray-950 via-gray-900 to-black rounded-2xl overflow-hidden">
      <div className="relative flex items-center justify-center p-4 transition-all duration-300 ease-in-out w-full">
        <div className="w-full overflow-hidden rounded-2xl">
          <div className="flex w-full items-start justify-start overflow-x-visible bg-gradient-to-br from-gray-950 via-gray-900 to-black py-8">
            <div className="relative w-full px-4">
              {/* Header */}

              {/* Navigation Arrows */}
              <div className="flex items-center justify-center gap-4 mb-6">
                <button
                  onClick={handlePrevious}
                  className="p-3 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 transition-all duration-300 hover:scale-110"
                  aria-label="Previous category"
                >
                  <ChevronLeft className="w-5 h-5 text-white" />
                </button>
                <div className="text-center">
                  <h3 className="text-xl font-bold text-white">
                    {categories[expandedCard]?.label}
                  </h3>
                  <p className="text-sm text-gray-400">
                    {expandedCard + 1} / {categories.length}
                  </p>
                </div>
                <button
                  onClick={handleNext}
                  className="p-3 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 transition-all duration-300 hover:scale-110"
                  aria-label="Next category"
                >
                  <ChevronRight className="w-5 h-5 text-white" />
                </button>
              </div>

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
