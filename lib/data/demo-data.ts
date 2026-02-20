/**
 * @fileoverview Demo data types and sample data for research features
 *
 * Contains type definitions and sample data for search results
 * and research evidence cards.
 *
 * @module lib/data/demo-data
 */

/**
 * Search result type representing a research evidence card
 */
export interface SearchResult {
  /** Unique identifier */
  id: number
  /** Category of the evidence (e.g., "Affirmative", "Negative") */
  category: string
  /** Research field or topic area */
  researchField: string
  /** Number of times this evidence has been read */
  readCount: number
  /** Word count of the evidence */
  word_count: number
  /** Name of the argument block this belongs to */
  argBlock: string
  /** Brief summary of the evidence */
  summary: string
  /** Tag line for the evidence */
  tag: string
  /** Full content of the evidence */
  content?: string
  /** Source citation */
  citation?: string
}

/**
 * Sample search results for demo purposes
 */
export const demoSearchResults: SearchResult[] = []
