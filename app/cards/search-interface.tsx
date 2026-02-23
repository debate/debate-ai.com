"use client"

import { useState, useEffect } from "react"
import { Search, GripVertical, Bot } from "lucide-react"
import { ResearchSearchSidebar } from "@/components/debate/shared-cards/ResearchSearchSidebar"
import { CardContentViewer } from "@/components/debate/shared-cards/CardContentViewer"
import { AiAnalysisSidebar } from "@/components/debate/shared-cards/AiAnalysisSidebar"

export function SearchInterface() {
  const [searchTerm, setSearchTerm] = useState("")
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [selectedResult, setSelectedResult] = useState<any | null>(null)
  const [selectedIndex, setSelectedIndex] = useState<number>(-1)
  const [sortBy, setSortBy] = useState("_text_match:desc")
  const [viewMode, setViewMode] = useState<"read" | "highlight" | "underline">("read")
  const [loading, setLoading] = useState(true)
  const [customPrompt, setCustomPrompt] = useState("")
  const [aiResult, setAiResult] = useState("")
  const [generating, setGenerating] = useState(false)
  const [showResearchSearchSidebar, setShowResearchSearchSidebar] = useState(false)
  const [showAiAnalysisSidebar, setShowAiAnalysisSidebar] = useState(false)
  const [isAiAnalysisSidebarCollapsed, setIsAiAnalysisSidebarCollapsed] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && selectedIndex > 0) {
        e.preventDefault()
        selectResult(searchResults[selectedIndex - 1], selectedIndex - 1)
      } else if (e.key === "ArrowRight" && selectedIndex < searchResults.length - 1) {
        e.preventDefault()
        selectResult(searchResults[selectedIndex + 1], selectedIndex + 1)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [selectedIndex, searchResults])

  const performSearch = () => {
    if (!searchTerm.trim()) return

    setLoading(true)

    // Simulate search with demo data
    setTimeout(() => {
      const filtered = searchResults.filter(
        (result) =>
          result.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
          result.cite.toLowerCase().includes(searchTerm.toLowerCase()),
      )
      setSearchResults(filtered.length > 0 ? filtered : searchResults)
      if (filtered.length > 0) {
        setSelectedResult(filtered[0])
        setSelectedIndex(0)
      }
      setLoading(false)
    }, 500)
  }

  const selectResult = (result: any, index: number) => {
    setSelectedResult(result)
    setSelectedIndex(index)
    setShowResearchSearchSidebar(false)
  }

  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true)
      try {
        const response = await fetch(`/api/search?sort=${sortBy}`)
        const data = await response.json()
        setSearchResults(data.results)
        setSelectedResult(null)
        setSelectedIndex(-1)
      } catch (error) {
        console.error("Failed to fetch search results:", error)
        setSearchResults([])
        setSelectedResult(null)
        setSelectedIndex(-1)
      } finally {
        setLoading(false)
      }
    }

    fetchResults()
  }, [sortBy])

  const handleGenerate = async () => {
    if (!selectedResult) return
    setGenerating(true)
    setAiResult("Analyzing...")

    setTimeout(() => {
      setAiResult(`Analysis of "${selectedResult.tag}":\n\nThis research card discusses ${selectedResult.summary}`)
      setGenerating(false)
    }, 2000)
  }

  const handleCopy = () => {
    if (!selectedResult) return
    const content = `${customPrompt}\n\n${selectedResult.tag}\n${selectedResult.cite}\n${selectedResult.summary}`
    navigator.clipboard.writeText(content)
  }

  return (
    <div className="h-screen flex flex-col relative">
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Mobile Overlay / Desktop Inline */}
        <div
          className={`
          md:block md:relative md:w-80
          ${showResearchSearchSidebar ? "fixed inset-0 z-40 md:z-0" : "hidden"}
        `}
        >
          {showResearchSearchSidebar && (
            <div className="md:hidden absolute inset-0 bg-black/50 z-0" onClick={() => setShowResearchSearchSidebar(false)} />
          )}
          <div className="relative z-10 h-full">
            <ResearchSearchSidebar
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              sortBy={sortBy}
              setSortBy={setSortBy}
              searchResults={searchResults}
              selectedIndex={selectedIndex}
              selectResult={selectResult}
              isLoading={loading}
              onClose={() => setShowResearchSearchSidebar(false)}
            />
          </div>
        </div>

        {/* Resize Handle - Desktop Only */}
        <div className="hidden md:block w-1 hover:w-2 bg-border hover:bg-primary/50 cursor-col-resize transition-all relative group">
          <GripVertical className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        {/* Middle Content */}
        <div className="flex-1 overflow-hidden">
          <CardContentViewer
            selectedResult={selectedResult}
            viewMode={viewMode}
            setViewMode={setViewMode}
            wordCount={selectedResult?.word_count || 0}
          />
        </div>

        {/* Resize Handle - Desktop Only - only show when sidebar is not collapsed */}
        {!isAiAnalysisSidebarCollapsed && (
          <div className="hidden md:block w-1 hover:w-2 bg-border hover:bg-primary/50 cursor-col-resize transition-all relative group">
            <GripVertical className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        )}

        {/* Right Sidebar - Mobile Overlay / Desktop Inline */}
        <div
          className={`
          md:relative md:w-64
          ${showAiAnalysisSidebar ? "fixed inset-0 z-40 md:z-0" : "hidden"}
          ${isAiAnalysisSidebarCollapsed ? "md:hidden" : "md:block"}
        `}
        >
          {showAiAnalysisSidebar && (
            <div className="md:hidden absolute inset-0 bg-black/50 z-0" onClick={() => setShowAiAnalysisSidebar(false)} />
          )}
          <div className="relative z-10 h-full">
            <AiAnalysisSidebar
              selectedResult={selectedResult}
              customPrompt={customPrompt}
              setCustomPrompt={setCustomPrompt}
              aiResult={aiResult}
              generating={generating}
              handleGenerate={handleGenerate}
              handleCopy={handleCopy}
              onClose={() => setShowAiAnalysisSidebar(false)}
              onCollapse={() => setIsAiAnalysisSidebarCollapsed(true)}
            />
          </div>
        </div>
      </div>

      <div
        className={`md:fixed md:bottom-4 md:right-4 ${isAiAnalysisSidebarCollapsed ? "md:block" : "md:hidden"} fixed bottom-20 right-4 flex flex-col gap-3 z-30`}
      >
        <button
          onClick={() => {
            setShowAiAnalysisSidebar(true)
            setIsAiAnalysisSidebarCollapsed(false)
          }}
          className="w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all flex items-center justify-center"
          aria-label="Open AI Analysis"
        >
          <Bot className="h-6 w-6" />
        </button>
        <button
          onClick={() => setShowResearchSearchSidebar(true)}
          className="md:hidden w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all flex items-center justify-center"
          aria-label="Open Search"
        >
          <Search className="h-6 w-6" />
        </button>
      </div>
    </div>
  )
}
