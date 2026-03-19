"use client"

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import categoryDescriptions from '@/lib/debate-data/debate-metadata/debate-lectures-category-descriptions.json';

interface LectureCategoryGalleryProps {
  onCategorySelect?: (categoryKey: string) => void;
  selectedCategory?: string;
  videosData?: any[]; // For getting most viewed video per category
}

type CategoryDescriptions = {
  categories: Record<string, { description: string }>;
};

const typedCategoryDescriptions = categoryDescriptions as CategoryDescriptions;

// Map category labels to gradient colors
const CATEGORY_GRADIENTS: Record<string, string> = {
  "Affirmative Strategy": "from-blue-500 via-cyan-500 to-teal-500",
  "Negative Strategy": "from-red-500 via-rose-500 to-pink-500",
  "Kritik / Critical Theory": "from-purple-500 via-violet-500 to-fuchsia-500",
  "Counterplans & Theory": "from-orange-500 via-amber-500 to-yellow-500",
  "Topicality & Framework": "from-indigo-500 via-purple-500 to-pink-500",
  "Disadvantages": "from-cyan-500 via-blue-500 to-indigo-500",
  "Speaking & Delivery": "from-green-400 via-emerald-500 to-teal-500",
  "Research & Flowing": "from-amber-500 via-orange-500 to-red-500",
  "Policy Topic Lectures": "from-purple-500 via-violet-500 to-fuchsia-500",
  "Demo Debates": "from-indigo-500 via-blue-500 to-cyan-500",
  "Judge & Tournament Skills": "from-pink-500 via-rose-500 to-red-500",
  "Impact Calculus & Evidence": "from-yellow-500 via-orange-500 to-red-500",
  "Philosophy & IR Theory": "from-violet-500 via-purple-500 to-indigo-500",
  "Public Forum": "from-teal-500 via-cyan-500 to-blue-500",
  "Awards": "from-fuchsia-500 via-pink-500 to-rose-500",
  "Documentaries & Culture": "from-rose-500 via-pink-500 to-fuchsia-500",
  "Camp & Coaching Advice": "from-emerald-500 via-green-500 to-teal-500",
  "Novice & Introductory": "from-sky-500 via-blue-500 to-indigo-500",
  "PF & LD Topic Analysis": "from-lime-500 via-green-500 to-emerald-500",
};

export function LectureCategoryGallery({ onCategorySelect, selectedCategory, videosData }: LectureCategoryGalleryProps) {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const galleryRef = useRef<HTMLDivElement>(null);

  // Convert categories to card format - ensure ALL categories from JSON are included
  const cards = useMemo(() => {
    if (!videosData || videosData.length === 0) return [];

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

    // Build cards from extracted categories
    return Array.from(categoryMap.entries())
      .map(([label, data]) => {
        const description = typedCategoryDescriptions.categories[label]?.description || "Debate lecture videos";
        const normalizedKey = label.toLowerCase().replace(/\s+/g, '_').replace(/[&/]/g, '_');

        return {
          id: normalizedKey,
          title: label,
          description,
          videoCount: data.videos.length,
          image: `https://img.youtube.com/vi/${data.mostViewedId}/maxresdefault.jpg`,
          gradient: CATEGORY_GRADIENTS[label] || "from-gray-500 via-gray-600 to-gray-700",
          maxViews: data.maxViews,
        };
      })
      .sort((a, b) => b.maxViews - a.maxViews); // Sort by popularity
  }, [videosData]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!galleryRef.current) return;

    const rect = galleryRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;

    setMousePosition({ x, y });
  };

  const handleCardClick = (categoryId: string) => {
    onCategorySelect?.(categoryId);
  };

  return (
    <div className="relative w-full h-[600px] bg-gradient-to-br from-gray-950 via-gray-900 to-black overflow-hidden rounded-2xl">
      {/* Background gradient blur */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-gray-900 to-black opacity-90 z-0"
        style={{
          backgroundImage: `radial-gradient(circle at ${(mousePosition.x + 0.5) * 100}% ${(mousePosition.y + 0.5) * 100}%, rgba(100, 50, 200, 0.2), transparent 40%)`,
        }}
      >
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10"></div>
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(15)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white opacity-5"
            style={{
              width: `${Math.random() * 8 + 2}px`,
              height: `${Math.random() * 8 + 2}px`,
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              animation: `float ${Math.random() * 10 + 15}s linear infinite`,
              animationDelay: `${Math.random() * 15}s`,
            }}
          />
        ))}
      </div>

      {/* Main container */}
      <div
        ref={galleryRef}
        className="relative w-full h-full flex flex-col items-center justify-center z-10 px-4 sm:px-6 py-8"
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mb-8 text-center"
        >
          <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-2 bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-600">
            Debate Lecture Categories
          </h2>
          <p className="text-gray-400 text-sm md:text-base max-w-2xl mx-auto">
            Explore {cards.length} curated categories • {cards.reduce((sum, c) => sum + c.videoCount, 0)} total videos
          </p>
        </motion.div>

        {/* Cards container */}
        <div className="relative w-full max-w-5xl h-[380px] flex items-center justify-center mb-6">
          {cards.map((card, index) => (
            <motion.div
              key={card.id}
              className="absolute w-full max-w-md rounded-xl cursor-pointer transition-all duration-300 ease-out"
              style={{
                ...calculateCardStyles(index),
                transition: "all 0.5s cubic-bezier(0.19, 1, 0.22, 1)",
              }}
              whileHover={{
                scale: index === activeIndex ? 1.02 : 1,
                transition: { duration: 0.2 }
              }}
              onClick={() => handleCardClick(index)}
            >
              {index === activeIndex && (
                <div
                  className="absolute inset-0 rounded-xl opacity-20"
                  style={{
                    transform: isHovering ? `perspective(1000px) rotateY(${mousePosition.x * 8}deg) rotateX(${-mousePosition.y * 8}deg)` : 'none',
                    transition: "transform 0.2s ease-out",
                    background: `linear-gradient(135deg, #ffffff10 0%, #ffffff01 100%)`,
                  }}
                />
              )}
              <div
                className="relative w-full overflow-hidden rounded-xl border border-white/10"
                style={{
                  transform: index === activeIndex && isHovering ? `perspective(1000px) rotateY(${mousePosition.x * 4}deg) rotateX(${-mousePosition.y * 4}deg)` : 'none',
                  transition: "transform 0.2s ease-out",
                }}
              >
                {/* Card image and overlay */}
                <div className="relative aspect-[16/9] w-full overflow-hidden rounded-t-xl">
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/30 to-black/70 z-10" />
                  <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-30 mix-blend-overlay z-10`} />
                  <img
                    src={card.image}
                    alt={card.title}
                    className="absolute inset-0 w-full h-full object-cover z-0"
                    loading="lazy"
                  />
                  <div className="absolute top-3 right-3 z-20">
                    <span className="px-2.5 py-1 bg-black/60 backdrop-blur-md rounded-full text-xs font-semibold text-white border border-white/20">
                      {card.videoCount} videos
                    </span>
                  </div>
                </div>

                {/* Card content */}
                <div
                  className="relative p-4 bg-gradient-to-b from-gray-900/95 to-black/95 rounded-b-xl backdrop-blur-lg"
                  style={{
                    backdropFilter: "blur(12px)",
                    WebkitBackdropFilter: "blur(12px)",
                  }}
                >
                  <h3 className="text-lg md:text-xl font-bold text-white mb-1.5 line-clamp-1">{card.title}</h3>
                  <p className="text-gray-400 text-xs md:text-sm mb-3 line-clamp-2">{card.description}</p>

                  {index === activeIndex && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.1 }}
                      className="flex items-center justify-between"
                    >
                      <div className="flex space-x-1.5">
                        {cards.slice(0, Math.min(5, cards.length)).map((_, i) => (
                          <div
                            key={i}
                            className={`w-1.5 h-1.5 rounded-full transition-all ${i === activeIndex % 5 ? 'bg-white w-4' : 'bg-gray-600'}`}
                          />
                        ))}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onCategorySelect?.(card.id);
                        }}
                        className={`px-3 py-1.5 rounded-lg bg-gradient-to-r ${card.gradient} text-white text-xs font-semibold transform transition hover:scale-105 shadow-lg`}
                      >
                        View Videos
                      </button>
                    </motion.div>
                  )}

                  {/* Decorative element */}
                  {index === activeIndex && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3 }}
                      className="absolute -right-2 -bottom-2 w-16 h-16 pointer-events-none"
                    >
                      <div className={`absolute inset-0 rounded-full bg-gradient-to-r ${card.gradient} opacity-15 animate-pulse`} />
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Navigation controls */}
        <div className="flex items-center justify-center space-x-6 z-20">
          <button
            onClick={prevCard}
            className="p-2.5 rounded-full bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-all duration-200 group border border-white/10"
            aria-label="Previous category"
          >
            <svg className="w-5 h-5 text-white group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="flex space-x-1.5">
            {cards.map((_, index) => (
              <button
                key={index}
                onClick={() => handleCardClick(index)}
                className={`h-2 rounded-full transition-all duration-200 ${index === activeIndex
                  ? 'bg-white w-8'
                  : 'bg-white/30 hover:bg-white/50 w-2'
                  }`}
                aria-label={`Go to category ${index + 1}`}
              />
            ))}
          </div>

          <button
            onClick={nextCard}
            className="p-2.5 rounded-full bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-all duration-200 group border border-white/10"
            aria-label="Next category"
          >
            <svg className="w-5 h-5 text-white group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* CSS for floating animation */}
      <style jsx>{`
        @keyframes float {
          0% {
            transform: translateY(0) translateX(0);
          }
          50% {
            transform: translateY(-80px) translateX(80px);
          }
          100% {
            transform: translateY(-160px) translateX(0);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
