/**
 * @module IntroTextOverview
 * @fileoverview Introductory landing page shown when no research card is selected.
 * Displays an overview of the CARDS platform, features, debate topics history, and vision.
 */

"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { ChevronDown, ChevronUp, Trophy, BookOpen } from "lucide-react"

type DebateHistoryEntry = Record<string, string | undefined>
type DebateHistory = Record<string, DebateHistoryEntry>

const EVENT_LABELS: Record<string, string> = {
  ndt_topic: "NDT/CEDA",
  policy_topic: "Policy (HS)",
  ld_topic: "Lincoln-Douglas",
  pf_topic: "Public Forum",
  ndt_champion: "NDT Champion",
  policy_champion: "Policy Champion",
  ld_champion: "LD Champion",
  pf_champion: "PF Champion",
}

export function IntroTextOverview() {
  const [history, setHistory] = useState<DebateHistory>({})
  const [expandedYear, setExpandedYear] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)


  return (
    <div className="h-full overflow-y-auto p-4 bg-background max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col items-center gap-6 mb-12">
        <div className="flex items-center justify-center gap-8">
          <img
            width="128"
            src="/images/logo-collective-mind.png"
            alt="Building Blocks Icon"
            className="drop-shadow-sm"
          />
          <a
            className="hover:scale-105 transition-transform duration-200"
            target="_blank"
            href="https://chromewebstore.google.com/detail/debate-timer-chrome-mobil/noecbaibfhbmpapofcdkgchfifmoinfj"
            rel="noopener noreferrer"
          >
            <img
              src="/images/download-extension.png"
              alt="Install Chrome Extension"
              className="h-16"
            />
          </a>
        </div>

        <div className="text-center space-y-2 max-w-2xl">
          <p className="text-muted-foreground font-bold tracking-wide text-lg md:text-black-400 [font-variant:small-caps]">
            Crowdsourced Annotated Research for Debates - Search
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="shadow-md">
          <CardContent className="p-6">
            <h3 className="font-semibold text-lg border-b pb-2 mb-4">Overview</h3>
            <p className="text-lg leading-relaxed mb-4">
              Critical times call for critical thinkers to create a crowdsourced annotated research dataset, for AI models
              to recommend research quotes, to evolve crowdsourced chain-of-thought reasoning, unlock faster ways to read
              long articles, to monitor developments in a knowledge graph by topic modeling, and to provide a public service
              of answers to research.
              Debate should be a war of warrants where victories are vectorized as weights — weights
              which lead to the emergence of Collective Consciousness.

            </p>
            <p className="text-lg leading-relaxed">



            </p>
          </CardContent>
        </Card>

        <Card className="shadow-md bg-muted/30">
          <CardContent className="p-6 space-y-4">
            <h3 className="font-semibold text-lg border-b pb-2">Features & Capabilities</h3>
            <ul className="space-y-3 text-sm list-disc pl-4 marker:text-blue-500">
              Search within summaries, cites, highlighted and full text over millions of research quotes.
              Scout what evidence selected teams and schools frequently read.
              Sort by Speeches Read In Count (statistics from over a decade in all styles).

              Use Characters Highlighted to match speech times (~1500 char/min) and to read aloud summaries while audience
              reads highlighted on-screen.

              Collaborate on topic outlines, share evidence, and download Topic Starter outlines.
              Use arrow keys to navigate between results.
            </ul>

            <div className="pt-4 mt-auto">
              <a
                href="https://arxiv.org/html/2406.14657v3"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium transition-colors"
              >
                Read the Academic Paper &rarr;
              </a>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm border-l-4 border-l-blue-500">
        <CardContent className="p-6">
          <div className="text-black-400 text-muted-foreground leading-relaxed">
            <div className="space-y-8 text-black-100 leading-relaxed">
              <ol className="list-decimal list-inside space-y-2">

                <div className="font-bold text-lg text-blue-400 [font-variant:small-caps] tracking-wider">1. The Debate Singularity is Happening</div>
                <p className="text-black-400 leading-relaxed">
                  AI now researches topics in depth, highlights key quotes, frames both sides
                  of arguments, coaches preparation, exposes flaws in evidence cards, and crafts strategic closing speeches that
                  compare competing claims. Integrating AI into debate unlocks the next stage of emergent complexity in
                  socio-political governance.
                </p>



                <div className="font-bold text-lg text-blue-400 [font-variant:small-caps] tracking-wider">2. Collective Thought Engine</div>
                <p className="text-black-400 leading-relaxed">
                  Language Models can distill collective thought into a vector space where every point carries a weighted value,
                  reflecting its contribution to decision-making. This collective AI consciousness can synthesize complex
                  arguments, judge their validity and relevance, and support a democratic, AI-mediated economy where public votes
                  reward influence and insight.
                </p>
                <p className="text-black-400 leading-relaxed">
                  AI agents learn which arguments and sources persuade different audiences. Crowdsourced automation enables AI to
                  organize argument outlines—much like GitHub's reusable code model—helping it evaluate complex decisions with
                  greater depth and consistency.
                </p>



                <div className="font-bold text-lg text-blue-400 [font-variant:small-caps] tracking-wider">3. Transparent Reasoning</div>
                <p className="text-black-400 leading-relaxed">
                  AI reveals the exact sentences and citations behind its reasoning, allowing users to verify alignment with
                  collective interests through sentence-by-sentence interpretability.
                </p>



                <div className="font-bold text-lg text-blue-400 [font-variant:small-caps] tracking-wider">4. Outcome Simulation Trees</div>
                <p className="text-black-400 leading-relaxed">
                  Users can engage in multiple AI-powered practice rounds that map trees of possible outcomes and responses,
                  surfacing the most persuasive strategies across diverse contexts.
                </p>



                <div className="font-bold text-lg text-blue-400 [font-variant:small-caps] tracking-wider">5. Outlines of Current News Issues</div>
                <p className="text-black-400 leading-relaxed">
                  Each debate card fits into a broader narrative—a topic tree linking evidence, assumptions, and values within a
                  collective framework. This transformation shifts debate from isolated rounds to a shared model of
                  research crowdsourced to the public by a few thousand editors, like Wikipedia or Github.
                </p>



                <div className="font-bold text-lg text-blue-400 [font-variant:small-caps] tracking-wider">6. Solving Post-Self Alignment</div>
                <p className="text-black-400 leading-relaxed">
                  Recognizing the interconnectedness of research articles mirrors how we should relate to global citizens as part of an emergent collective
                  consciousness. Losing sight of that bigger picture fuels bias, tribalism, and division at the root of modern conflicts
                  between isolated social news bubbles. Only by mapping the whole internet as a debate outline
                  enables seeing how each idea fits into a whole greater than the sum of its parts.  This  set a socio-polical model to  build synergistic
                  consciousness ethical awareness across both discourse and institutional governance.  This can reduce LLM hallucination and steer alignment with common social values as AI gains capacity to replace human leaders of organizations.


                </p>



                <div className="font-bold text-lg text-blue-400 [font-variant:small-caps] tracking-wider">7. Topic Research Unified Tree Hierarchy (TRUTH)</div>
                <p className="text-black-400 leading-relaxed">
                  Key metadata extracted for LLM analysis allows models to detect logic flaws, flag overstatements, strengthen
                  warrants, and place each claim within the Topic Research Unified Tree Hierarchy (TRUTH). This consensus-driven
                  system seeks grounded truth, reduces hallucination, and aligns AI reasoning with shared human values—laying
                  groundwork for responsible AI governance.
                </p>

              </ol>
            </div>

          </div>
        </CardContent>
      </Card>
    </div>
  )
}
