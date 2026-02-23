/**
 * @fileoverview QuoteView component that parses HTML into structured quote cards
 * organised by headings and renders them using EditableQuoteCard.
 */

"use client"

import type React from "react"

import { useEffect, useState, useCallback, useRef } from "react"
import { htmlToCards, type HeadingSection } from "./quote-view-utils"
import { EditableQuoteCard } from "./EditableQuoteCard"
import { ChevronDown, ChevronRight } from "lucide-react"
import "./quote-view.css"

/** Props for the QuoteView component. */
interface QuoteViewProps {
  /** Raw HTML string to parse into quote cards. */
  html: string
  /** Optional file name displayed in the view header. */
  fileName?: string
  /** When false the component renders a loading placeholder instead of cards. */
  active?: boolean
  /** Display mode controlling which heading levels and card parts are visible. */
  viewMode?: ViewMode
}

/**
 * Renders parsed HTML as a hierarchical list of collapsible quote cards.
 * Cards are grouped under their nearest heading section and support inline
 * editing via EditableQuoteCard.
 * @param html - HTML markup to parse and display as cards.
 * @param fileName - Optional label forwarded to the parser.
 * @param active - Activates parsing and rendering when true.
 * @param viewMode - Controls which heading levels and card elements are shown.
 * @returns The card view element, or an empty/loading placeholder.
 */
export function QuoteView({ html, fileName, active = true, viewMode = "read" }: QuoteViewProps) {
  const [sections, setSections] = useState<HeadingSection[]>([])
  const [cardCount, setCardCount] = useState<number>(0)
  const [totalWords, setTotalWords] = useState<number>(0)
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())
  const containerRef = useRef<HTMLDivElement>(null)
  const prevFileNameRef = useRef<string | undefined>(fileName)

  useEffect(() => {
    if (!active) return

    const result = htmlToCards(html, fileName)
    setSections(result.sections)
    setCardCount(result.metadata.cardCount)
    setTotalWords(result.metadata.totalWords)
  }, [active, html, fileName])

  useEffect(() => {
    if (fileName !== prevFileNameRef.current && containerRef.current) {
      containerRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
      prevFileNameRef.current = fileName
    }
  }, [fileName])

  /**
   * Updates the HTML of a specific card identified by its id within the section tree.
   * @param cardId - The id of the card to update.
   * @param newHtml - The replacement HTML string for the card body.
   */
  const handleCardUpdate = useCallback((cardId: string, newHtml: string) => {
    setSections((prevSections) => {
      function updateCardInSection(section: HeadingSection): HeadingSection {
        const updatedCards = section.cards.map((card) => (card.id === cardId ? { ...card, html: newHtml } : card))
        const updatedSubsections = section.subsections?.map(updateCardInSection)
        return {
          ...section,
          cards: updatedCards,
          subsections: updatedSubsections,
        }
      }
      return prevSections.map(updateCardInSection)
    })
  }, [])

  /**
   * Toggles the collapsed state of a heading section.
   * @param sectionId - The unique identifier of the section to toggle.
   */
  const toggleSectionCollapse = useCallback((sectionId: string) => {
    setCollapsedSections((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId)
      } else {
        newSet.add(sectionId)
      }
      return newSet
    })
  }, [])

  if (!active) {
    return (
      <div className="quote-view-loading">
        <p>Loading editor...</p>
      </div>
    )
  }

  if (sections.length === 0 || cardCount === 0) {
    return (
      <div className="quote-view-wrapper">
        <div className="quote-view-header">
          <div className="quote-view-stats">
            <span className="stat-item">
              <strong>0</strong> cards
            </span>
          </div>
        </div>
        <div className="quote-view-empty">
          <p>No quote cards detected in this document.</p>
          <p>Add blockquotes or highlighted text to see quote cards here.</p>
        </div>
      </div>
    )
  }

  /**
   * Determines whether a section should be rendered given the current viewMode.
   * @param section - The section to evaluate.
   * @returns True if the section should be rendered.
   */
  const shouldRenderSection = (section: HeadingSection): boolean => {
    if (!section.heading) return true

    const headingLevel = section.heading.type

    switch (viewMode) {
      case "h1-only":
        return headingLevel === 1
      case "h2-only":
        return headingLevel <= 2
      case "h3-only":
        return headingLevel <= 3
      default:
        return true
    }
  }

  /**
   * Filters a list of subsections to only those visible under the current viewMode.
   * @param subsections - Array of subsections to filter, or undefined.
   * @returns Filtered array of HeadingSection items.
   */
  const filterSubsections = (subsections: HeadingSection[] | undefined): HeadingSection[] => {
    if (!subsections) return []
    return subsections.filter(shouldRenderSection)
  }

  /**
   * Recursively renders a heading section and its cards/subsections.
   * @param section - The section data to render.
   * @param depth - Current nesting depth, used for CSS class naming.
   * @param index - Positional index within the parent list.
   * @returns A React element representing the section.
   */
  const renderSection = (section: HeadingSection, depth: number = 0, index: number = 0): React.ReactElement => {
    const sectionId = section.heading?.id ? `${section.heading.id}-${depth}-${index}` : `section-${depth}-${index}`
    const isCollapsed = collapsedSections.has(sectionId)
    const filteredSubsections = filterSubsections(section.subsections)
    const hasContent = section.cards.length > 0 || filteredSubsections.length > 0

    return (
      <div key={sectionId} className={`quote-section quote-section-depth-${depth}`}>
        {section.heading && (
          <div className="quote-section-header">
            <button
              type="button"
              onClick={() => toggleSectionCollapse(sectionId)}
              className="quote-section-collapse-btn"
              title={isCollapsed ? "Expand section" : "Collapse section"}
            >
              {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </button>
            {section.heading.type === 1 && <h1 className="quote-section-heading">{section.heading.text}</h1>}
            {section.heading.type === 2 && <h2 className="quote-section-heading">{section.heading.text}</h2>}
            {section.heading.type === 3 && <h3 className="quote-section-heading">{section.heading.text}</h3>}
          </div>
        )}

        {!isCollapsed && hasContent && (
          <div className="quote-section-content">
            {section.cards.map((card) => (
              <EditableQuoteCard
                key={card.id}
                cardId={card.id || ""}
                summary={card.summary || ""}
                author={card.author}
                year={card.year ? String(card.year) : null}
                cite={card.cite}
                url={card.url}
                html={card.html}
                words={card.words}
                boldWords={card.boldWords || 0}
                highlightedWords={card.highlightedWords || 0}
                onUpdate={handleCardUpdate}
                viewMode={viewMode}
              />
            ))}

            {filteredSubsections.map((subsection, subIndex) => renderSection(subsection, depth + 1, subIndex))}
          </div>
        )}
      </div>
    )
  }

  const filteredSections = sections.filter(shouldRenderSection)

  return (
    <div className="quote-view-wrapper" ref={containerRef}>
      <div className="quote-view-header">
        <div className="quote-view-stats">
          <span className="stat-item">
            <strong>{cardCount}</strong> {cardCount === 1 ? "card" : "cards"}
          </span>
          <span className="stat-separator">•</span>
          <span className="stat-item">
            <strong>{totalWords}</strong> {totalWords === 1 ? "word" : "words"}
          </span>
        </div>
      </div>

      <div className="quote-view-container">
        <div className="quote-view">{filteredSections.map((section, index) => renderSection(section, 0, index))}</div>
      </div>
    </div>
  )
}
