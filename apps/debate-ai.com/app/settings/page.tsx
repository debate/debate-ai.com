import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { ArrowLeft } from "lucide-react"
import { UserSettingsPanel, WordLimitPresetsPanel } from "debate-round"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "debate-ui/src/primitives/tabs"
import { FavoriteToolsSettings } from "@/components/settings/FavoriteToolsSettings"
import { EditorPreferencesPanel } from "debate-settings"
import { EbbFlowPreferencesPanel } from "@/components/settings/EbbFlowPreferencesPanel"

export const metadata: Metadata = {
  title: "Settings",
  description:
    "Manage your debate style, font size, theme, favorite-tools, word-limit-preset, CardMirror, and Ebb Flow preferences",
}

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-background p-3 sm:p-6">
      <div className="mb-4 max-w-lg mx-auto px-4 sm:px-6">
        <Link
          href="/debate"
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-background hover:bg-accent text-sm font-medium text-foreground transition-colors"
          aria-label="Back to debate flow"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </div>

      <Tabs defaultValue="account" className="max-w-lg mx-auto">
        <TabsList className="mx-4 sm:mx-6 mb-2">
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="debate-settings">Debate Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="account">
          <Suspense>
            <UserSettingsPanel />
          </Suspense>
          <Suspense>
            <FavoriteToolsSettings />
          </Suspense>
          <Suspense>
            <WordLimitPresetsPanel />
          </Suspense>
        </TabsContent>

        <TabsContent value="debate-settings">
          <Suspense>
            <EditorPreferencesPanel />
          </Suspense>
          <EbbFlowPreferencesPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}
