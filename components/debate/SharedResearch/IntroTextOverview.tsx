/**
 * @module IntroTextOverview
 * @fileoverview Introductory landing page shown when no research card is selected.
 * Displays an overview of the CARDS platform, features, and vision.
 */

"use client"

import { Card, CardContent } from "@/components/ui/card"

/**
 * IntroTextOverview - Landing page for the CARDS search interface.
 *
 * Renders product information including platform overview, feature list,
 * Chrome extension download link, and the project's vision statement.
 * Displayed as the default view when no search result is selected.
 */
export function IntroTextOverview() {
  return (
    <div className="h-full overflow-y-auto p-4 bg-background max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between mb-2">
        <img
          width="128"
          src="/images/logo-collective-mind.png"
          alt="Building Blocks Icon"
        />
        <div className="flex flex-col items-end">
          <h2 className="text-xl font-bold text-right">CARDS: Crowdsourced Annotated Research for Debates Search</h2>
          <a
            className="mt-2 px-6 py-3 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            target="_blank"
            href="https://chromewebstore.google.com/detail/debate-timer-chrome-mobil/noecbaibfhbmpapofcdkgchfifmoinfj"
            rel="noopener noreferrer"
          >
            <img
              src="/images/download-extension.png"
              alt="Install Chrome Extension"
              className="h-14"
            />
          </a>
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
              <li>Search within summaries, cites, highlighted and full text over millions of research quotes.</li>
              <li>Scout what evidence selected teams and schools frequently read.</li>
              <li>Sort by Speeches Read In Count (statistics from over a decade in all styles).</li>
              <li>
                Use Characters Highlighted to match speech times (~1500 char/min) and to read aloud summaries while audience
                reads highlighted on-screen.
              </li>
              <li>Collaborate on topic outlines, share evidence, and download Topic Starter outlines.</li>
              <li>Use arrow keys to navigate between results.</li>
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
          <p className="text-base text-muted-foreground leading-relaxed">
            The Debate Singularity is here: AI now researches topics in depth, highlights key quotes, outlines both sides
            of arguments, coaches debate preparation, surfaces relevant quotes, exposes flaws in evidence cards, and crafts
            strategic closing speeches that compare competing cards.
            We must integrate AI into debate to unlock the next stage of emergent compexity for socio-political governance.

            <br />
            <br />

            Using Language Models can distill the essence of collective thought into a vector space where every point has
            a weighted value representing its contribution to the overall decision-making process. AI collective
            consciousness will be able to synthesize complex arguments and evaluate them according to their validity and
            relevance no matter who proposed them, leading to direct democratic AI-based economy where public votes reward
            influence and AI global governance. AI agents will learn what arguments and sources are more persuasive in
            different contexts and to different profiles of readers. Crowdsourced automation with AI agents create topic
            argument outlines, similar to what Github does for reusable code, which AI can learn to weigh complex
            decisions. Github shows people go deeper if they can reuse well-established arguments.

            AI will show its reasoning based on what
            sentences and cites it used from the collective evidence, so that people can see it is aligned with our
            interests via sentence-by-sentence interpretability. People can have many practice rounds via AI to simulate
            a tree of possible outcomes and responses, so that we can surface the most persuasive arguments to all.


          </p>
          <p className="text-base text-muted-foreground leading-relaxed">

            Key metadata is extracted for LLM analysis, enabling LLMs to review the full text, identify logic flaws or
            unsupported claims, and flag overstatements. LLMs also extend warrants, summarize support, and suggest where
            each card fits within the Topic Research Unified Tree Hierarchy (TRUTH). The system is built for
            intersubjective, consensus-driven research claim to find ground truth on issues and evaluate any claim's
            proximity to accepted truths and human values. This can reduce LLM hallucination and steer alignment with
            common social values as AI gains capacity to replace human leaders of organizations.


          </p>
        </CardContent>
      </Card>
    </div>
  )
}
