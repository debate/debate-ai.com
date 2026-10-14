"use client"

/**
 * @fileoverview The owner-managed part of a school page: the school's logo,
 * who manages the page, and the roster of teams and students. Owners (users
 * with an approved claim) and staff get controls to add and remove roster
 * entries and to set or delete the logo; everyone else sees the result.
 *
 * Shows only a claim link for a school with no logo, owners or roster, and
 * nothing at all until the data loads.
 *
 * @module components/schools/SchoolOwnerPanel
 */

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ImagePlus, Trash2, X } from "lucide-react"
import { Button } from "../../lib/ui/primitives/button"
import { Input } from "../../lib/ui/primitives/input"
import {
  MAX_LOGO_DATA_URL_LENGTH,
  addSchoolMember,
  fetchSchoolPage,
  removeSchoolMember,
  setSchoolLogo,
  type SchoolMember,
  type SchoolMemberKind,
  type SchoolPageData,
} from "../../lib/schools/school-claims"

/** Longest side of a stored logo, in pixels. */
const LOGO_SIZE = 256

/**
 * Reads an image file into a PNG data URL no larger than {@link LOGO_SIZE}
 * on its longest side, so a phone photo fits under the API's cap.
 */
async function logoDataUrl(file: File): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error("That file isn't an image this browser can read."))
      element.src = url
    })
    const scale = Math.min(1, LOGO_SIZE / Math.max(image.width, image.height))
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, Math.round(image.width * scale))
    canvas.height = Math.max(1, Math.round(image.height * scale))
    canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height)
    const png = canvas.toDataURL("image/png")
    return png.length <= MAX_LOGO_DATA_URL_LENGTH ? png : canvas.toDataURL("image/webp", 0.85)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * Loads a school page's owner-managed data. The page loads it rather than the
 * panel, because a created school with no rankings needs its name before the
 * profile decides whether there is a page to show at all.
 */
export function useSchoolPageData(slug: string) {
  const [data, setData] = useState<SchoolPageData | null>(null)
  useEffect(() => {
    let cancelled = false
    setData(null)
    fetchSchoolPage(slug)
      .then((loaded) => {
        if (!cancelled) setData(loaded)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [slug])
  return [data, setData] as const
}

/**
 * @param props.slug - The `/schools/[school]` segment.
 * @param props.data - The page data, from {@link useSchoolPageData}.
 * @param props.onData - Takes the page data each edit answers with.
 */
export function SchoolOwnerPanel({
  slug,
  data,
  onData,
}: {
  slug: string
  data: SchoolPageData | null
  onData: (data: SchoolPageData) => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const run = useCallback(async (action: () => Promise<SchoolPageData>) => {
    setBusy(true)
    setError(null)
    try {
      onData(await action())
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }, [onData])

  if (!data) return null
  const empty = !data.logo && data.owners.length === 0 && data.members.length === 0
  if (empty && !data.canManage) {
    return (
      <p className="mt-2 text-sm text-muted-foreground">
        Coach or run this program?{" "}
        <Link href="/settings?category=my-school" className="underline underline-offset-4">
          Claim this school&apos;s page
        </Link>
        .
      </p>
    )
  }

  const teams = data.members.filter((member) => member.kind === "team")
  const students = data.members.filter((member) => member.kind === "student")

  return (
    <section className="mt-3 rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex flex-col items-center gap-2">
          {data.logo ? (
            <img src={data.logo} alt={`${data.name ?? "School"} logo`} className="h-20 w-20 rounded-md object-contain" />
          ) : data.canManage ? (
            <div className="flex h-20 w-20 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
              No logo
            </div>
          ) : null}
          {data.canManage && (
            <div className="flex gap-1">
              <input
                ref={fileInput}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  event.target.value = ""
                  if (file) run(async () => setSchoolLogo(slug, await logoDataUrl(file)))
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => fileInput.current?.click()}
                aria-label={data.logo ? "Change logo" : "Set logo"}
              >
                <ImagePlus /> {data.logo ? "Change" : "Set logo"}
              </Button>
              {data.logo && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => run(() => setSchoolLogo(slug, null))}
                  aria-label="Delete logo"
                >
                  <Trash2 />
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-3 text-sm">
          {data.owners.length > 0 && (
            <p className="text-muted-foreground">
              Managed by{" "}
              {data.owners
                .map((owner) => `${owner.name} (${owner.role === "admin" ? "administrator" : "coach"})`)
                .join(", ")}
            </p>
          )}
          {data.owners.length === 0 && (
            <p className="text-muted-foreground">
              Coach here?{" "}
              <Link href="/settings?category=my-school" className="underline underline-offset-4">
                Claim this school
              </Link>
              .
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <RosterList
              title="Teams"
              kind="team"
              members={teams}
              canManage={data.canManage}
              busy={busy}
              onAdd={(body) => run(() => addSchoolMember(slug, body))}
              onRemove={(id) => run(() => removeSchoolMember(slug, id))}
            />
            <RosterList
              title="Students"
              kind="student"
              members={students}
              canManage={data.canManage}
              busy={busy}
              onAdd={(body) => run(() => addSchoolMember(slug, body))}
              onRemove={(id) => run(() => removeSchoolMember(slug, id))}
            />
          </div>
          {error && <p className="text-destructive">{error}</p>}
        </div>
      </div>
    </section>
  )
}

/** One roster column (teams or students), with an add form for managers. */
function RosterList({
  title,
  kind,
  members,
  canManage,
  busy,
  onAdd,
  onRemove,
}: {
  title: string
  kind: SchoolMemberKind
  members: SchoolMember[]
  canManage: boolean
  busy: boolean
  onAdd: (body: { kind: SchoolMemberKind; name: string; email?: string }) => void
  onRemove: (id: string) => void
}) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  if (!canManage && members.length === 0) return null

  return (
    <div>
      <h3 className="mb-1 font-medium">
        {title} <span className="text-muted-foreground">· {members.length}</span>
      </h3>
      {members.length === 0 ? (
        <p className="text-muted-foreground">None listed yet.</p>
      ) : (
        <ul className="space-y-0.5">
          {members.map((member) => (
            <li key={member.id} className="flex items-center gap-1">
              <span className="min-w-0 truncate">{member.name}</span>
              {member.email && <span className="truncate text-xs text-muted-foreground">{member.email}</span>}
              {canManage && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onRemove(member.id)}
                  className="ml-auto rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label={`Remove ${member.name}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canManage && (
        <form
          className="mt-2 flex flex-wrap gap-1"
          onSubmit={(event) => {
            event.preventDefault()
            if (!name.trim()) return
            onAdd({ kind, name: name.trim(), ...(email.trim() ? { email: email.trim() } : {}) })
            setName("")
            setEmail("")
          }}
        >
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={kind === "team" ? "Team, e.g. Lee & Lin" : "Student name"}
            maxLength={120}
            className="h-8 min-w-0 flex-1"
          />
          {kind === "student" && (
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email (optional)"
              className="h-8 min-w-0 flex-1"
            />
          )}
          <Button type="submit" size="sm" disabled={busy || !name.trim()}>
            Add
          </Button>
        </form>
      )}
    </div>
  )
}
