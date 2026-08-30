"use client"

/**
 * Account settings — profile, preferences (persisted to /api/user/settings),
 * and a "My Data" view over the cloud-saved Documents and Rounds. Reachable
 * from the dock's Settings menu (components/layout/CategoryDock.tsx).
 */

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { FileText, Flag, Loader2, LogIn, Trash2 } from "lucide-react"
import { Button } from "debate-ui/src/primitives/button"
import { Input } from "debate-ui/src/primitives/input"
import { Label } from "debate-ui/src/primitives/label"
import { Switch } from "debate-ui/src/primitives/switch"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "debate-ui/src/primitives/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "debate-ui/src/primitives/tabs"
import { themeNames, themeColors, formatThemeName, useThemeState } from "@/components/theme-dropdown"
import { authClient } from "@/lib/auth/client"
import { useSession } from "@/lib/hooks/useSession"
import { cn } from "debate-ui/src/lib/utils"

interface SavedSettings {
  colorTheme: string | null
  colorMode: string | null
  defaultRoundPrivate: boolean
}

interface DocRow {
  id: number
  title: string
  updatedAt: string | number
}

interface RoundRow {
  id: number
  title: string
  format: string | null
  updatedAt: string | number
}

function formatDate(value: string | number) {
  const ms = typeof value === "number" ? value * (value < 1e12 ? 1000 : 1) : Date.parse(value)
  return Number.isFinite(ms) ? new Date(ms).toLocaleString() : "—"
}

function ProfileTab({ name, email }: { name: string; email: string }) {
  const [value, setValue] = useState(name)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const save = useCallback(async () => {
    setSaving(true)
    setSaved(false)
    try {
      await authClient.updateUser({ name: value.trim() || name })
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }, [value, name])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Your display name and account email.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 max-w-sm">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="settings-name">Display name</Label>
          <Input id="settings-name" value={value} onChange={(e) => { setValue(e.target.value); setSaved(false) }} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Email</Label>
          <p className="text-sm text-muted-foreground">{email}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={save} disabled={saving || value.trim() === name}>
            {saving && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
            Save
          </Button>
          {saved && <span className="text-xs text-muted-foreground">Saved</span>}
        </div>
      </CardContent>
    </Card>
  )
}

function PreferencesTab({
  settings,
  onSave,
}: {
  settings: SavedSettings
  onSave: (patch: Partial<SavedSettings>) => void
}) {
  const themeState = useThemeState()
  const [defaultRoundPrivate, setDefaultRoundPrivate] = useState(settings.defaultRoundPrivate)

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Applies immediately and is saved to your account.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between max-w-sm">
            <Label>Dark mode</Label>
            <Switch
              checked={themeState.isDark}
              onCheckedChange={() => {
                themeState.toggleLightDark()
                onSave({ colorMode: themeState.isDark ? "light" : "dark" })
              }}
            />
          </div>
          <div>
            <Label className="mb-2 block">Color theme</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {themeNames.map((name) => {
                const colors = themeColors[name]
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => {
                      themeState.handleThemeChange(name)
                      onSave({ colorTheme: name })
                    }}
                    className={cn(
                      "flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-accent",
                      themeState.colorTheme === name && "border-primary bg-accent",
                    )}
                  >
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full border border-black/10" style={{ backgroundColor: colors.primary }} />
                      <span className="w-2.5 h-2.5 rounded-full border border-black/10" style={{ backgroundColor: colors.secondary }} />
                    </span>
                    <span className="truncate">{formatThemeName(name)}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rounds</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between max-w-sm">
            <div>
              <Label>Default new rounds to private</Label>
              <p className="text-xs text-muted-foreground">Applies the next time you create a round in FIAT.</p>
            </div>
            <Switch
              checked={defaultRoundPrivate}
              onCheckedChange={(checked) => {
                setDefaultRoundPrivate(checked)
                onSave({ defaultRoundPrivate: checked })
              }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function MyDataTab() {
  const [docs, setDocs] = useState<DocRow[] | null>(null)
  const [rounds, setRounds] = useState<RoundRow[] | null>(null)

  const load = useCallback(() => {
    fetch("/api/doc/documents").then((r) => r.json()).then(setDocs)
    fetch("/api/rounds").then((r) => r.json()).then(setRounds)
  }, [])

  useEffect(load, [load])

  const deleteDoc = async (id: number) => {
    await fetch(`/api/doc/documents/${id}`, { method: "DELETE" })
    setDocs((prev) => prev?.filter((d) => d.id !== id) ?? null)
  }

  const deleteRound = async (id: number) => {
    await fetch(`/api/rounds/${id}`, { method: "DELETE" })
    setRounds((prev) => prev?.filter((r) => r.id !== id) ?? null)
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileText className="h-4 w-4" /> Reason Editor Documents</CardTitle>
          <CardDescription>Saved to your account from <Link href="/reason-editor" className="underline">/reason-editor</Link>.</CardDescription>
        </CardHeader>
        <CardContent>
          {docs === null ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : docs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No documents yet.</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {docs.map((doc) => (
                <li key={doc.id} className="flex items-center justify-between py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{doc.title || "Untitled"}</p>
                    <p className="text-xs text-muted-foreground">Updated {formatDate(doc.updatedAt)}</p>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => deleteDoc(doc.id)} title="Delete">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Flag className="h-4 w-4" /> FIAT Rounds</CardTitle>
          <CardDescription>Saved to your account from <Link href="/debate" className="underline">/debate</Link>.</CardDescription>
        </CardHeader>
        <CardContent>
          {rounds === null ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : rounds.length === 0 ? (
            <p className="text-sm text-muted-foreground">No rounds saved to your account yet.</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {rounds.map((round) => (
                <li key={round.id} className="flex items-center justify-between py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{round.title || "Untitled Round"}</p>
                    <p className="text-xs text-muted-foreground">
                      {round.format ? `${round.format} · ` : ""}Updated {formatDate(round.updatedAt)}
                    </p>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => deleteRound(round.id)} title="Delete">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function SettingsPage() {
  const { user, isAuthenticated, isLoading } = useSession()
  const [settings, setSettings] = useState<SavedSettings | null>(null)

  useEffect(() => {
    if (!isAuthenticated) return
    fetch("/api/user/settings")
      .then((r) => r.json())
      .then((row) =>
        setSettings({
          colorTheme: row.colorTheme ?? null,
          colorMode: row.colorMode ?? null,
          defaultRoundPrivate: !!row.defaultRoundPrivate,
        }),
      )
  }, [isAuthenticated])

  const savePatch = useCallback((patch: Partial<SavedSettings>) => {
    setSettings((prev) => (prev ? { ...prev, ...patch } : prev))
    fetch("/api/user/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    })
  }, [])

  if (isLoading || (isAuthenticated && !settings)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center">
        <LogIn className="h-8 w-8 text-muted-foreground" />
        <h1 className="text-lg font-semibold">Sign in to see your settings</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Settings, saved documents, and saved rounds are tied to your account. Sign in from the dock's Settings menu to get started.
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-3 sm:p-6 pb-24">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Signed in as {user?.email}</p>
        </div>
        <Tabs defaultValue="preferences">
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="preferences">Preferences</TabsTrigger>
            <TabsTrigger value="data">My Data</TabsTrigger>
          </TabsList>
          <TabsContent value="profile">
            <ProfileTab name={user?.name ?? ""} email={user?.email ?? ""} />
          </TabsContent>
          <TabsContent value="preferences">
            {settings && <PreferencesTab settings={settings} onSave={savePatch} />}
          </TabsContent>
          <TabsContent value="data">
            <MyDataTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
