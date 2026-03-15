import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

/**
 * @interface Article
 * Defines the structure for a single article card.
 * @param {string | number} id - A unique identifier for the article.
 * @param {string} imageSrc - URL for the article's image.
 * @param {string} title - The main heading of the article.
 * @param {string} linkText - The text for the call-to-action link.
 * @param {string} linkHref - The URL the article card will link to.
 */
interface Article {
  id: string | number;
  imageSrc: string;
  title: string;
  linkText: string;
  linkHref: string;
}

/**
 * @interface ArticleCardGridProps
 * Defines the props for the ArticleCardGrid component.
 * @param {string} title - The main title displayed above the grid.
 * @param {Article[]} articles - An array of article objects to display.
 */
interface ArticleCardGridProps {
  title: string;
  articles: Article[];
}

/**
 * A responsive grid of article cards with a title.
 * Features animations on load and hover.
 */
export const ArticleCardGrid: React.FC<ArticleCardGridProps> = ({ title, articles }) => {
  // Animation variant for the grid container to stagger children
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  // Animation variant for each card item
  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 100,
      },
    },
  };

  return (
    <section className="w-full max-w-6xl mx-auto py-12 px-4 md:px-6 bg-background text-foreground">
      <h2 className="text-3xl font-bold tracking-tight mb-8">
        {title}
      </h2>
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {articles.map((article) => (
          <motion.a
            key={article.id}
            href={article.linkHref}
            className="group block overflow-hidden rounded-lg bg-card border hover:border-primary/50 transition-colors duration-300"
            variants={itemVariants}
            whileHover={{ y: -8 }}
            transition={{ type: 'spring', stiffness: 300 }}
          >
            <div className="flex flex-col h-full">
              {/* Card Image */}
              <div className="overflow-hidden">
                 <img
                    src={article.imageSrc}
                    alt={article.title}
                    className="w-full h-48 object-cover transform group-hover:scale-105 transition-transform duration-300"
                  />
              </div>

              {/* Card Content */}
              <div className="p-6 flex flex-col flex-grow">
                <h3 className="text-lg font-semibold text-card-foreground mb-4 flex-grow">
                  {article.title}
                </h3>
                <div className="flex items-center text-sm font-medium text-primary mt-auto">
                  {article.linkText}
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </div>
              </div>
            </div>
          </motion.a>
        ))}
      </motion.div>
    </section>
  );
};
