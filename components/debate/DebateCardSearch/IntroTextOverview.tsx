/**
 * @module IntroTextOverview
 * @fileoverview Introductory landing page shown when no research card is selected.
 * Displays an overview of the CARDS platform, features, debate topics history, and vision.
 */

"use client"

import { Card, CardContent } from "@/components/ui/card"
import { DownloadAppButton } from "react-native-app-buttons"

type DebateHistoryEntry = Record<string, string | undefined>
type DebateHistory = Record<string, DebateHistoryEntry>

export function IntroTextOverview() {

  return (
    <div className="h-full overflow-y-auto p-4 bg-background max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col items-center gap-6 mb-12">
        <div className="flex items-center justify-center gap-8">
          <img
            width="128"
            src="https://i.imgur.com/VbJF0Bx.png"
            alt="Building Blocks Icon"
            className="drop-shadow-sm"
          />
          <div className="flex flex-col gap-2">
            <DownloadAppButton platform="chrome-extension" appId="noecbaibfhbmpapofcdkgchfifmoinfj" />
          </div>
        </div>

        <div className="text-center space-y-2 max-w-2xl">
          <p className="text-muted-foreground font-bold tracking-wide text-lg md:text-black-400 [font-variant:small-caps]">
            Crowdsourced Annotated Research for Debating Solutions (CARDS)
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

          </CardContent>
        </Card>

        <Card className="shadow-md bg-muted/30">
          <CardContent className="p-6 space-y-4">
            <h3 className="font-semibold text-lg border-b pb-2">Features & Capabilities</h3>
            <ul className="space-y-3 text-md list-disc pl-4 marker:text-blue-500">
              Search within summaries, cites, highlighted and full text over millions of research quotes.
              Scout what evidence selected teams and schools frequently read.
              Sort by Speeches Read In Count (statistics from over a decade in all styles).

              Use Words Bold & Highlighted to match speech times (~300 w/min) and to read aloud warranted summaries
              while judge & opponents reads highlighted quotes on-screen, which makes context more understandable and publically persuasive.

              Collaborate on topic outlines, share evidence, and download Topic Starter outlines.
            </ul>

          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm border-l-4 border-l-blue-500">
        <CardContent className="p-6">
          <div className="text-black-400 text-muted-foreground leading-relaxed">
            <div className="space-y-8 text-black-100 leading-relaxed">
              <ol className="list-decimal list-inside space-y-2">


                   <a
                href="https://debate-ai.com/legal/debate-ai-paper.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="group block"
              >
                <div className="relative overflow-hidden rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-100 dark:from-blue-950/40 dark:via-indigo-950/30 dark:to-blue-900/40 dark:border-blue-800 p-5 transition-all duration-300 ease-out hover:shadow-lg hover:shadow-blue-200/60 dark:hover:shadow-blue-900/60 hover:-translate-y-0.5 hover:border-blue-300 dark:hover:border-blue-600">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-400/0 via-blue-400/5 to-indigo-400/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="relative flex items-center gap-4">
                    <div className="flex-shrink-0 flex items-center justify-center w-11 h-11 rounded-lg bg-blue-100 dark:bg-blue-900/60 border border-blue-200 dark:border-blue-700 text-2xl transition-transform duration-300 group-hover:scale-110">
                      📝
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-blue-900 dark:text-blue-100 text-base leading-tight">
                        Debate AI Collective Consciousness
                      </div>
                      <div className="text-blue-600 dark:text-blue-400 text-sm mt-0.5">
                        Research Paper (PDF)
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-blue-400 dark:text-blue-500 transition-transform duration-300 group-hover:translate-x-1">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                    </div>
                  </div>
                </div>
              </a>



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

                <p className="text-black-400 leading-relaxed">
                  Debate Garden aggregates perspectives across the ideological spectrum, highlighting the most persuasive
                  arguments on every side of an issue. As public trust in media and institutional expertise has declined,
                  achieving genuine neutrality requires presenting all viewpoints — not just the mainstream consensus.
                  Rather than offering reductive caricatures of opposing positions, this platform equips users with the
                  strongest, most rigorously reasoned arguments available.
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
                  enables seeing how each idea fits into a whole greater than the sum of its parts.  This  sets a socio-polical model to  build synergistic
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



         

            {/* <div className="pt-4 mt-auto">
              <a
                href="https://arxiv.org/html/2406.14657v3"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium transition-colors"
              >
                OpenDebateEvidence (Paper) &rarr;
              </a>
            </div> */}

          </div>
        </CardContent>
      </Card>
    </div>
  )
}
