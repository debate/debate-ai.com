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
  /** Category of the evidence (e.g., "DA", "CP", "K", "T", "I") */
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
  /** Short citation (author year) */
  cite_short: string
  /** Full citation */
  cite: string
  /** Length of highlighted text in characters */
  highlightLength: number
  /** Total text length */
  textLength: number
  /** HTML content of the card */
  html: string
  /** Publication year (2-digit) */
  year: string
  /** Page reference */
  page: string
  /** School name */
  school?: string
  /** Team code */
  team?: string
  /** Side: Aff or Neg */
  side?: string
  /** Tournament name */
  tournament?: string
  /** Round identifier */
  round?: string
  /** Event type (e.g., "CX", "LD", "PF") */
  event?: string
}

/**
 * Sample search results for demo purposes
 */
export const demoSearchResults: SearchResult[] = []
