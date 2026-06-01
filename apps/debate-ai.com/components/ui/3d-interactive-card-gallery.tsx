"use client"

import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

const cards = [
  {
    id: 1,
    title: "Cosmic Exploration",
    description: "Journey through the nebulae and discover celestial wonders beyond imagination.",
    image: "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80",
    gradient: "from-indigo-500 via-purple-500 to-pink-500",
    category: "Astronomy"
  },
  {
    id: 2,
    title: "Quantum Computing",
    description: "Exploring the future of computation through quantum mechanical phenomena.",
    image: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80",
    gradient: "from-cyan-500 via-blue-500 to-indigo-500",
    category: "Technology"
  },
  {
    id: 3,
    title: "Neural Networks",
    description: "The intersection of biology and technology in the field of artificial intelligence.",
    image: "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80",
    gradient: "from-green-400 via-emerald-500 to-teal-500",
    category: "AI"
  },
  {
    id: 4,
    title: "Biometric Authentication",
    description: "Securing digital identity through unique biological characteristics.",
    image: "https://images.unsplash.com/photo-1614064641938-3bbee52942c7?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80",
    gradient: "from-amber-500 via-orange-500 to-red-500",
    category: "Security"
  },
  {
    id: 5,
    title: "Quantum Entanglement",
    description: "The mysterious connection between particles that transcends space and time.",
    image: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80",
    gradient: "from-purple-500 via-violet-500 to-fuchsia-500",
    category: "Physics"
  }
];

const InteractiveCardGallery = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const galleryRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 0);

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!galleryRef.current) return;

    const rect = galleryRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;

    setMousePosition({ x, y });
  };

  const nextCard = () => {
    setActiveIndex((prev) => (prev + 1) % cards.length);
  };

  const prevCard = () => {
    setActiveIndex((prev) => (prev - 1 + cards.length) % cards.length);
  };

  const handleCardClick = (index: number) => {
    setActiveIndex(index);
  };

  const calculateCardStyles = (index: number) => {
    const diff = index - activeIndex;

    // For mobile devices, stack cards vertically
    if (windowWidth < 768) {
      return {
        zIndex: cards.length - Math.abs(diff),
        transform: diff === 0
          ? 'translateY(0) scale(1)'
          : `translateY(${diff * 20}px) scale(${1 - Math.abs(diff) * 0.1})`,
        opacity: 1 - Math.abs(diff) * 0.2,
      };
    }

    // For desktop, create a horizontal carousel effect
    return {
      zIndex: cards.length - Math.abs(diff),
      transform: diff === 0
        ? 'translateX(0) scale(1)'
        : `translateX(${diff * 60}%) scale(${1 - Math.abs(diff) * 0.2})`,
      opacity: 1 - Math.abs(diff) * 0.3,
      filter: diff === 0 ? 'blur(0px)' : 'blur(2px)',
    };
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      {/* Background gradient blur */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-gray-900 to-black opacity-90 z-0"
        style={{
          backgroundImage: `radial-gradient(circle at ${(mousePosition.x + 0.5) * 100}% ${(mousePosition.y + 0.5) * 100}%, rgba(50, 50, 150, 0.3), transparent 40%)`,
        }}
      >
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white opacity-10"
            style={{
              width: `${Math.random() * 10 + 2}px`,
              height: `${Math.random() * 10 + 2}px`,
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              animation: `float ${Math.random() * 10 + 20}s linear infinite`,
              animationDelay: `${Math.random() * 20}s`,
            }}
          />
        ))}
      </div>

      {/* Main container */}
      <div
        ref={galleryRef}
        className="relative w-full h-full flex flex-col items-center justify-center z-10 px-4 sm:px-6"
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mb-12 text-center"
        >
          <h1 className="text-4xl md:text-6xl font-extrabold text-white mb-4 bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-600">
            Interactive Knowledge Gallery
          </h1>
          <p className="text-gray-300 text-xl max-w-2xl mx-auto">
            Explore cutting-edge concepts through this immersive visual experience
          </p>
        </motion.div>

        {/* Cards container */}
        <div className="relative w-full max-w-6xl h-[500px] flex items-center justify-center">
          {cards.map((card, index) => (
            <motion.div
              key={card.id}
              className="absolute w-full max-w-lg rounded-2xl cursor-pointer transition-all duration-300 ease-out"
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
                  className="absolute inset-0 rounded-2xl opacity-20"
                  style={{
                    transform: isHovering ? `perspective(1000px) rotateY(${mousePosition.x * 10}deg) rotateX(${-mousePosition.y * 10}deg)` : 'none',
                    transition: "transform 0.2s ease-out",
                    background: `linear-gradient(135deg, ${index === activeIndex ? '#ffffff10' : '#ffffff05'} 0%, ${index === activeIndex ? '#ffffff01' : '#ffffff00'} 100%)`,
                  }}
                />
              )}
              <div
                className="relative w-full overflow-hidden rounded-2xl"
                style={{
                  transform: index === activeIndex && isHovering ? `perspective(1000px) rotateY(${mousePosition.x * 5}deg) rotateX(${-mousePosition.y * 5}deg)` : 'none',
                  transition: "transform 0.2s ease-out",
                }}
              >
                {/* Card image and overlay */}
                <div className="relative aspect-[16/9] w-full overflow-hidden rounded-t-2xl">
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black opacity-60 z-10" />
                  <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-40 mix-blend-overlay z-10`} />
                  <img
                    src={card.image}
                    alt={card.title}
                    className="absolute inset-0 w-full h-full object-cover z-0"
                  />
                  <div className="absolute top-4 right-4 z-20">
                    <span className="px-3 py-1 bg-black/50 backdrop-blur-sm rounded-full text-xs font-medium text-white">
                      {card.category}
                    </span>
                  </div>
                </div>

                {/* Card content */}
                <div
                  className="relative p-6 bg-gradient-to-b from-gray-900 to-black rounded-b-2xl"
                  style={{
                    backdropFilter: "blur(10px)",
                    WebkitBackdropFilter: "blur(10px)",
                  }}
                >
                  <h3 className="text-2xl font-bold text-white mb-2">{card.title}</h3>
                  <p className="text-gray-300 mb-4">{card.description}</p>

                  {index === activeIndex && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.1 }}
                      className="flex items-center justify-between"
                    >
                      <div className="flex space-x-2">
                        {[...Array(5)].map((_, i) => (
                          <div
                            key={i}
                            className={`w-2 h-2 rounded-full ${i === activeIndex % 5 ? 'bg-white' : 'bg-gray-600'}`}
                          />
                        ))}
                      </div>
                      <button
                        className={`px-4 py-2 rounded-lg bg-gradient-to-r ${card.gradient} text-white text-sm font-medium transform transition hover:scale-105`}
                      >
                        Explore
                      </button>
                    </motion.div>
                  )}

                  {/* Interactive elements that appear only on active card */}
                  {index === activeIndex && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3 }}
                      className="absolute -right-3 -bottom-3 w-24 h-24"
                    >
                      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 opacity-20 animate-pulse" />
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Navigation controls */}
        <div className="mt-10 flex items-center justify-center space-x-8 z-20">
          <button
            onClick={prevCard}
            className="p-3 rounded-full bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-all duration-200 group"
          >
            <svg className="w-6 h-6 text-white group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="flex space-x-2">
            {cards.map((_, index) => (
              <button
                key={index}
                onClick={() => handleCardClick(index)}
                className={`w-3 h-3 rounded-full transition-all duration-200 ${
                  index === activeIndex
                    ? 'bg-white w-6'
                    : 'bg-white/30 hover:bg-white/50'
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>

          <button
            onClick={nextCard}
            className="p-3 rounded-full bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-all duration-200 group"
          >
            <svg className="w-6 h-6 text-white group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            transform: translateY(-100px) translateX(100px);
          }
          100% {
            transform: translateY(-200px) translateX(0);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default InteractiveCardGallery;