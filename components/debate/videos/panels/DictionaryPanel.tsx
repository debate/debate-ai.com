"use client"

/**
 * @fileoverview Dictionary Panel Component
 *
 * Searchable glossary of debate terminology.
 * Features:
 * - Full-text search across terms and definitions
 * - 200+ debate terms and definitions
 * - Prioritized results (term matches before definition matches)
 * - Responsive scrollable list
 *
 * @module components/debate/videos/panels/DictionaryPanel
 */

import { useState, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Search, ArrowRight } from "lucide-react"
import { dictionaryDebate } from "@/lib/debate-data/dictionary-debate"

/**
 * DictionaryPanel - Searchable debate terminology glossary
 *
 * Provides a searchable interface to browse debate terms
 * and their definitions. Search matches both term names
 * and definition content.
 *
 * @returns The dictionary panel component
 *
 * @example
 * ```tsx
 * <DictionaryPanel />
 * ```
 */
export function DictionaryPanel() {
  /** Current search input value */
  const [searchTerm, setSearchTerm] = useState("")

  /**
   * Filtered and sorted debate terms based on the current search input.
   *
   * Filtering logic:
   * 1. All search words must appear in term OR definition
   * 2. Results matching the term name are prioritized
   * 3. Definition-only matches follow
   *
   * @returns Filtered array of debate dictionary entries sorted by relevance
   */
  const filteredDebateTerms = useMemo(() => {
    // Return all terms if no search
    if (searchTerm.trim().length === 0) {
      return dictionaryDebate
    }

    // Split search into individual words
    const words = searchTerm
      .toLowerCase()
      .split(" ")
      .filter((word) => word.trim() !== "")

    // Find entries matching all search words
    const matchingTerms = dictionaryDebate.filter((entry) =>
      words.every((word) => entry.term.toLowerCase().includes(word) || entry.definition.toLowerCase().includes(word))
    )

    // Separate matches in term name vs. definition only
    const termNameMatches = matchingTerms.filter((entry) => entry.term.toLowerCase().includes(words[0]))

    const otherMatches = matchingTerms.filter((entry) => !entry.term.toLowerCase().includes(words[0]))

    // Return term name matches first, then other matches
    return [...termNameMatches, ...otherMatches]
  }, [searchTerm])

  return (
    <div className="w-full h-[calc(100vh-200px)] flex flex-col">
      {/* Search input */}
      <div className="relative mb-4 px-4 sm:px-6 pt-6">
        <Search className="absolute left-7 sm:left-9 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
        <Input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search 200+ debate terms..."
          className="pl-10 w-full h-12 text-base border-2 focus:border-indigo-500 rounded-lg"
        />
      </div>

      {/* Results list */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-6">
        {filteredDebateTerms.length === 0 ? (
          // Empty state when no matches
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <Search className="text-gray-300 mb-4" size={64} />
            <p className="text-gray-500 text-lg">No results found for "{searchTerm}"</p>
            <p className="text-gray-400 text-sm mt-2">Try different keywords or check spelling</p>
          </div>
        ) : (
          // Term cards list
          <div className="space-y-3">
            {filteredDebateTerms.map((entry, index) => (
              <Card
                key={index}
                className="p-4 hover:shadow-md transition-all duration-200 border border-gray-200 hover:border-indigo-300 bg-white"
              >
                <div className="flex items-start gap-3">
                  {/* Arrow indicator */}
                  <ArrowRight className="text-indigo-500 flex-shrink-0 mt-1" size={18} />
                  <div className="flex-1 min-w-0">
                    {/* Term name */}
                    <h3 className="font-bold text-gray-900 mb-1 text-base">{entry.term}</h3>
                    {/* Definition */}
                    <p className="text-gray-600 text-sm leading-relaxed">{entry.definition}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
