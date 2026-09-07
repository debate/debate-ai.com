/**
 * @file code-example.tsx
 * @description Interactive component displaying various code examples.
 */
"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Copy, Check } from "lucide-react"
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import bash from 'highlight.js/lib/languages/bash'
import 'highlight.js/styles/github-dark.css'

hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('bash', bash)

const codeExamples = {
  basic: `// Example usage
const data = await fetchExample('users');`,
}

type TabKey = keyof typeof codeExamples

const tabLabels: Record<TabKey, string> = {
  basic: "Basic",
}

const tabLanguages: Record<TabKey, string> = {
  basic: "javascript",
}

export function CodeExample() {
  const [activeTab, setActiveTab] = useState<TabKey>("basic")
  const [copied, setCopied] = useState(false)
  const codeRef = useRef<HTMLElement>(null)

  const copyCode = () => {
    navigator.clipboard.writeText(codeExamples[activeTab])
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  useEffect(() => {
    if (codeRef.current) {
      delete codeRef.current.dataset.highlighted
      hljs.highlightElement(codeRef.current)
    }
  }, [activeTab])

  return (
    <section className="py-20 md:py-32 border-b border-border">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Docs, <span className="text-primary">Made Simple</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            The Debate AI documentation site, built on the Fumadocs starter template.
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-4 py-3 overflow-x-auto">
              <div className="flex gap-1">
                {(Object.keys(codeExamples) as TabKey[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1.5 text-sm rounded-md transition-colors whitespace-nowrap ${activeTab === tab
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                      }`}
                  >
                    {tabLabels[tab]}
                  </button>
                ))}
              </div>
              <Button variant="ghost" size="sm" onClick={copyCode} className="gap-2 ml-2 flex-shrink-0">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <pre className="p-6 overflow-x-auto text-sm max-h-[400px] overflow-y-auto">
              <code ref={codeRef} className={`font-mono language-${tabLanguages[activeTab]}`} style={{ fontFamily: 'var(--font-mono)' }}>{codeExamples[activeTab]}</code>
            </pre>
          </div>
        </div>
      </div>
    </section>
  )
}
