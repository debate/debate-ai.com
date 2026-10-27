"use client"

/**
 * @fileoverview Settings → General → My school: claim to be a school's coach or
 * administrator, back the claim with a school email (confirmed by a code) or
 * a written explanation, and follow it through moderator review. Schools the
 * user already owns link to their page, where the roster and logo are managed.
 *
 * @module components/schools/MySchoolSettings
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "../../lib/ui/primitives/button"
import { Badge } from "../../lib/ui/primitives/badge"
import { Input } from "../../lib/ui/primitives/input"
import {
  MAX_EXPLANATION_LENGTH,
  MIN_EXPLANATION_LENGTH,
  SCHOOL_ROLES,
  fetchMySchoolClaims,
  fetchSchoolNames,
  isSchoolEmail,
  schoolSlug,
  submitSchoolClaim,
  updateSchoolClaim,
  withdrawSchoolClaim,
  type ClaimStatus,
  type MySchoolClaimsResponse,
  type SchoolClaim,
  type SchoolRole,
} from "../../lib/schools/school-claims"

const selectClass = "border-input h-9 w-full rounded-md border bg-transparent px-2 text-sm shadow-xs dark:bg-input/30"
const textareaClass =
  "border-input w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"

const STATUS_LABEL: Record<ClaimStatus, string> = {
  awaiting_email: "Waiting on your code",
  pending: "Waiting on a moderator",
  approved: "Approved",
  rejected: "Not approved",
}

/** How the claimant backs the claim. */
type Method = "email" | "explanation"

/** The "My school" settings tab. */
export function MySchoolSettings() {
  const [data, setData] = useState<MySchoolClaimsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setData(await fetchMySchoolClaims())
      setError(null)
    } catch (err) {
      setError((err as Error).message)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (error) return <p className="text-sm text-destructive">{error}</p>
  if (!data) return <p className="text-sm text-muted-foreground">Loading…</p>
  if (!data.signedIn) {
    return <p className="text-sm text-muted-foreground">Sign in to claim your school&apos;s page.</p>
  }

  return (
    <div className="space-y-6 text-sm">
      {data.ownedSchools.length > 0 && (
        <section className="space-y-2">
          <h4 className="font-medium">Schools you manage</h4>
          <ul className="space-y-1">
            {data.ownedSchools.map((school) => (
              <li key={school.slug}>
                <Link href={`/@${school.slug}`} className="font-medium underline-offset-4 hover:underline">
                  {school.name}
                </Link>
                <span className="text-muted-foreground"> — set its teams, students and logo on the school page.</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.claims.length > 0 && (
        <section className="space-y-2">
          <h4 className="font-medium">Your claims</h4>
          <ul className="space-y-2">
            {data.claims.map((claim) => (
              <ClaimRow key={claim.id} claim={claim} onChange={load} />
            ))}
          </ul>
        </section>
      )}

      <ClaimForm onFiled={load} />
    </div>
  )
}

/** One of the user's claims, with the code entry when it waits on one. */
function ClaimRow({ claim, onChange }: { claim: SchoolClaim; onChange: () => void }) {
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const run = async (action: () => Promise<unknown>, done?: string) => {
    setBusy(true)
    setMessage(null)
    try {
      await action()
      if (done) setMessage(done)
      onChange()
    } catch (err) {
      setMessage((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{claim.schoolName}</span>
        <span className="text-muted-foreground">· {claim.role === "admin" ? "Administrator" : "Coach"}</span>
        <Badge variant={claim.status === "approved" ? "default" : claim.status === "rejected" ? "destructive" : "secondary"}>
          {STATUS_LABEL[claim.status]}
        </Badge>
        {claim.emailVerified && <Badge variant="outline">Verified {claim.schoolEmail}</Badge>}
      </div>
      {claim.reviewNote && <p className="mt-1 text-muted-foreground">Moderator: {claim.reviewNote}</p>}

      {claim.status === "awaiting_email" && (
        <form
          className="mt-2 flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            run(() => updateSchoolClaim(claim.id, { action: "verify", code: code.trim() }))
          }}
        >
          <span className="text-muted-foreground">Enter the code sent to {claim.schoolEmail}:</span>
          <Input
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            className="w-28"
            aria-label="Verification code"
          />
          <Button type="submit" size="sm" disabled={busy || code.length !== 6}>
            Verify
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => run(() => updateSchoolClaim(claim.id, { action: "resend" }), "A new code is on its way.")}
          >
            Send a new code
          </Button>
        </form>
      )}

      {claim.status !== "approved" && (
        <div className="mt-2 flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => run(() => withdrawSchoolClaim(claim.id))}
          >
            {claim.status === "rejected" ? "Dismiss" : "Withdraw"}
          </Button>
        </div>
      )}
      {message && <p className="mt-1 text-muted-foreground">{message}</p>}
    </li>
  )
}

/** The form that files a new claim. */
function ClaimForm({ onFiled }: { onFiled: () => void }) {
  const [schools, setSchools] = useState<string[]>([])
  const [schoolName, setSchoolName] = useState("")
  const [isNewSchool, setIsNewSchool] = useState(false)
  const [role, setRole] = useState<SchoolRole>("coach")
  const [method, setMethod] = useState<Method>("email")
  const [email, setEmail] = useState("")
  const [explanation, setExplanation] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    fetchSchoolNames()
      .then(setSchools)
      .catch(() => setSchools([]))
  }, [])

  // The list is thousands of names, so the dropdown is a type-to-filter list.
  const slugs = useMemo(() => new Set(schools.map(schoolSlug)), [schools])
  const picked = schoolName.trim() !== "" && slugs.has(schoolSlug(schoolName))
  const emailProblem = method === "email" && email.trim() !== "" && !isSchoolEmail(email.trim().toLowerCase())
  const explanationShort = method === "explanation" && explanation.trim().length < MIN_EXPLANATION_LENGTH
  const ready =
    schoolName.trim() !== "" &&
    (isNewSchool || picked) &&
    (method === "email" ? email.trim() !== "" && !emailProblem : !explanationShort)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      const { claim, delivery } = await submitSchoolClaim({
        schoolName: schoolName.trim(),
        isNewSchool,
        role,
        ...(method === "email" ? { schoolEmail: email.trim() } : { explanation: explanation.trim() }),
      })
      setMessage(
        claim.status === "awaiting_email"
          ? delivery === "logged"
            ? "Claim filed. Email isn't configured here, so the code was written to the server log."
            : `Claim filed. Check ${claim.schoolEmail} for a six-digit code and enter it above.`
          : "Claim filed. A moderator will review it and you'll get a notification.",
      )
      setSchoolName("")
      setEmail("")
      setExplanation("")
      setIsNewSchool(false)
      onFiled()
    } catch (err) {
      setMessage((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border p-4">
      <div>
        <h4 className="font-medium">Claim a school</h4>
        <p className="text-muted-foreground">
          Coaches and school administrators can manage their school&apos;s page: which teams and students are part of
          it, and its logo. A moderator approves each claim.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">{isNewSchool ? "New school's name" : "School"}</span>
          <Input
            value={schoolName}
            onChange={(event) => setSchoolName(event.target.value)}
            list={isNewSchool ? undefined : "school-claim-options"}
            maxLength={120}
            placeholder={isNewSchool ? "e.g. Lincoln High School" : "Start typing to search"}
            aria-invalid={!isNewSchool && schoolName.trim() !== "" && !picked}
          />
          {!isNewSchool && (
            <datalist id="school-claim-options">
              {schools.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          )}
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={isNewSchool}
              onChange={(event) => setIsNewSchool(event.target.checked)}
              className="h-3.5 w-3.5 accent-primary"
            />
            My school isn&apos;t listed — create it
          </label>
          {!isNewSchool && schoolName.trim() !== "" && !picked && (
            <span className="block text-xs text-muted-foreground">
              Pick a school from the list, or tick the box to create it.
            </span>
          )}
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">You are the school&apos;s</span>
          <select className={selectClass} value={role} onChange={(event) => setRole(event.target.value as SchoolRole)}>
            {SCHOOL_ROLES.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-muted-foreground">How should we confirm it?</legend>
        <div className="flex flex-wrap gap-4">
          <label className="flex cursor-pointer items-center gap-1.5">
            <input type="radio" name="claim-method" checked={method === "email"} onChange={() => setMethod("email")} />
            Verify my school email
          </label>
          <label className="flex cursor-pointer items-center gap-1.5">
            <input
              type="radio"
              name="claim-method"
              checked={method === "explanation"}
              onChange={() => setMethod("explanation")}
            />
            I&apos;ll explain instead
          </label>
        </div>
        {method === "email" ? (
          <div className="space-y-1">
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@yourschool.edu"
              aria-invalid={emailProblem}
            />
            <p className="text-xs text-muted-foreground">
              {emailProblem
                ? "Use the address your school gave you — personal addresses like Gmail can't verify a school."
                : "We'll email a six-digit code to confirm the address."}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            <textarea
              value={explanation}
              onChange={(event) => setExplanation(event.target.value)}
              rows={4}
              maxLength={MAX_EXPLANATION_LENGTH}
              className={textareaClass}
              placeholder="How you're connected to the school — your title, how long you've coached, a staff page that lists you…"
            />
            <p className="text-xs text-muted-foreground">
              At least {MIN_EXPLANATION_LENGTH} characters. A moderator reads this before approving.
            </p>
          </div>
        )}
      </fieldset>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={busy || !ready}>
          {busy ? "Filing…" : "Submit claim"}
        </Button>
        {message && <span className="text-muted-foreground">{message}</span>}
      </div>
    </form>
  )
}
