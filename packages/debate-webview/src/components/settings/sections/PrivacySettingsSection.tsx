"use client"

/**
 * @fileoverview Settings → Privacy: the recording release, how published
 * recordings show the user (audio and video or audio only; anonymous, a
 * username or the real name), a link to the privacy policy, and a form to
 * ask for all or part of their data to be deleted.
 *
 * The release is stored per account through `/api/settings/privacy` and
 * validated by `lib/privacy/recording-release.ts`, which publishers ask
 * before sharing a recording. Deletion requests go to
 * `/api/settings/privacy/deletion-requests`, where an admin works them.
 *
 * @module components/settings/sections/PrivacySettingsSection
 */

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  DEFAULT_RECORDING_PRIVACY,
  DELETION_CATEGORIES,
  MAX_DELETION_DETAILS_LENGTH,
  MAX_USERNAME_LENGTH,
  RECORDING_RELEASE_PARAGRAPHS,
  mayPublishRecording,
  publicCreditName,
  type DeletionCategory,
  type DeletionScope,
  type RecordingPrivacy,
} from "../../../lib/privacy/recording-release"

interface DeletionRequest {
  id: number
  scope: string
  categories: string[]
  details: string
  status: string
  createdAt: string
}

const boxStyle = {
  marginBottom: 16,
  padding: 14,
  borderRadius: 10,
  border: "1px solid var(--pmd-border, rgba(127, 127, 127, 0.25))",
} as const
const headingStyle = { margin: "0 0 8px", fontSize: 14, fontWeight: 600 } as const
const hintStyle = { margin: "0 0 10px", fontSize: 12, opacity: 0.65 } as const
const optionStyle = { display: "flex", alignItems: "flex-start", gap: 8, padding: "4px 0", fontSize: 13, cursor: "pointer" } as const
const inputStyle = {
  padding: "6px 8px",
  borderRadius: 6,
  border: "1px solid rgba(127, 127, 127, 0.35)",
  background: "transparent",
  color: "inherit",
  fontSize: 13,
} as const
const buttonStyle = {
  padding: "6px 14px",
  borderRadius: 8,
  border: "none",
  background: "#24A0ED",
  color: "#fff",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
} as const

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(DELETION_CATEGORIES.map((c) => [c.id, c.label]))

async function readError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null
  return body?.error ?? `Request failed (${res.status})`
}

function Radio<T extends string>({
  name,
  value,
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  name: string
  value: T
  checked: boolean
  onChange: (value: T) => void
  label: string
  hint?: string
  disabled?: boolean
}) {
  return (
    <label style={{ ...optionStyle, opacity: disabled ? 0.5 : 1 }}>
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => onChange(value)}
        style={{ marginTop: 3 }}
      />
      <span>
        {label}
        {hint && <span style={{ display: "block", fontSize: 12, opacity: 0.6 }}>{hint}</span>}
      </span>
    </label>
  )
}

/** The recording release text, agreement, and publishing/credit choices. */
function RecordingReleaseBox({ accountName }: { accountName: string | null }) {
  const [privacy, setPrivacy] = useState<RecordingPrivacy | null>(null)
  const [signedOut, setSignedOut] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [username, setUsername] = useState("")

  useEffect(() => {
    let cancelled = false
    fetch("/api/settings/privacy")
      .then(async (res) => {
        if (cancelled) return
        if (res.status === 401) {
          setSignedOut(true)
          return
        }
        if (!res.ok) throw new Error(await readError(res))
        const body = (await res.json()) as { privacy: RecordingPrivacy }
        setPrivacy(body.privacy)
        setUsername(body.privacy.username)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
          setPrivacy({ ...DEFAULT_RECORDING_PRIVACY })
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const save = useCallback(
    async (patch: Partial<RecordingPrivacy>) => {
      setError(null)
      setSaved(false)
      const res = await fetch("/api/settings/privacy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }).catch(() => null)
      if (!res) {
        setError("Could not reach the server. Your choice was not saved.")
        return
      }
      if (!res.ok) {
        setError(await readError(res))
        return
      }
      const body = (await res.json()) as { privacy: RecordingPrivacy }
      setPrivacy(body.privacy)
      setSaved(true)
    },
    [],
  )

  if (signedOut) {
    return (
      <section style={boxStyle}>
        <h4 style={headingStyle}>Recording release</h4>
        <p style={{ margin: 0, fontSize: 13 }}>
          <Link href="/login" style={{ textDecoration: "underline" }}>
            Sign in
          </Link>{" "}
          to choose whether your recordings can be published and how you are credited.
        </p>
      </section>
    )
  }
  if (!privacy) return <p style={{ fontSize: 13, opacity: 0.7 }}>Loading…</p>

  const released = mayPublishRecording(privacy)
  const preview = publicCreditName(privacy, { name: accountName })

  return (
    <>
      <section style={boxStyle} aria-labelledby="privacy-release-heading">
        <h4 id="privacy-release-heading" style={headingStyle}>
          Recording release
        </h4>
        <div style={{ fontSize: 13, lineHeight: 1.55, maxHeight: 240, overflowY: "auto", paddingRight: 6 }}>
          {RECORDING_RELEASE_PARAGRAPHS.map((paragraph) => (
            <p key={paragraph.slice(0, 32)} style={{ margin: "0 0 10px" }}>
              {paragraph}
            </p>
          ))}
        </div>
        <Radio
          name="release"
          value="released"
          checked={released}
          onChange={() => void save({ release: "released" })}
          label="I agree: publish my recordings and video with the choices below"
        />
        <Radio
          name="release"
          value="not-released"
          checked={!released}
          onChange={() => void save({ release: "not-released" })}
          label="Don't publish my recordings"
          hint="Nothing you record is shared. This is the default."
        />
        {released && privacy.releasedAt && (
          <p style={{ ...hintStyle, margin: "6px 0 0" }}>Agreed on {new Date(privacy.releasedAt).toLocaleDateString()}.</p>
        )}
      </section>

      <section style={boxStyle} aria-labelledby="privacy-media-heading">
        <h4 id="privacy-media-heading" style={headingStyle}>
          What is published
        </h4>
        <Radio
          name="media"
          value="audio-video"
          checked={privacy.media === "audio-video"}
          onChange={(media) => void save({ media })}
          label="Audio and video"
        />
        <Radio
          name="media"
          value="audio-only"
          checked={privacy.media === "audio-only"}
          onChange={(media) => void save({ media })}
          label="Audio only"
          hint="Your camera is left out; only your voice is published."
        />
      </section>

      <section style={boxStyle} aria-labelledby="privacy-credit-heading">
        <h4 id="privacy-credit-heading" style={headingStyle}>
          How you are credited
        </h4>
        <Radio
          name="credit"
          value="anonymous"
          checked={privacy.credit === "anonymous"}
          onChange={(credit) => void save({ credit })}
          label="Anonymous contributor"
          hint="Your name is hidden."
        />
        <Radio
          name="credit"
          value="username"
          checked={privacy.credit === "username"}
          onChange={(credit) => void save({ credit, username })}
          label="Username"
          disabled={!username.trim()}
          hint={username.trim() ? undefined : "Type a username below first."}
        />
        <div style={{ display: "flex", gap: 8, margin: "2px 0 6px 24px" }}>
          <input
            type="text"
            value={username}
            maxLength={MAX_USERNAME_LENGTH}
            onChange={(e) => setUsername(e.target.value)}
            onBlur={() => {
              if (username.trim() !== privacy.username && (username.trim() || privacy.credit !== "username")) {
                void save({ username: username.trim() })
              }
            }}
            placeholder="Public username"
            aria-label="Public username"
            style={{ ...inputStyle, width: 220 }}
          />
        </div>
        <Radio
          name="credit"
          value="real-name"
          checked={privacy.credit === "real-name"}
          onChange={(credit) => void save({ credit })}
          label="Real name"
          hint={accountName ? undefined : "Your account has no name yet, so you'll show as anonymous."}
        />
        {privacy.credit === "real-name" && (
          <div style={{ marginLeft: 24 }}>
            <Radio
              name="realNameFormat"
              value="full"
              checked={privacy.realNameFormat === "full"}
              onChange={(realNameFormat) => void save({ realNameFormat })}
              label="Full name"
            />
            <Radio
              name="realNameFormat"
              value="first-initial"
              checked={privacy.realNameFormat === "first-initial"}
              onChange={(realNameFormat) => void save({ realNameFormat })}
              label="First name and last initial"
            />
          </div>
        )}
        <p style={{ ...hintStyle, margin: "8px 0 0" }}>
          Shown as: <strong>{preview}</strong>
        </p>
      </section>
      {error && <p style={{ color: "#d33", fontSize: 13, margin: "0 0 12px" }}>{error}</p>}
      {saved && !error && <p style={{ ...hintStyle, margin: "0 0 12px" }}>Saved.</p>}
    </>
  )
}

/** Request deletion of all or part of the user's data. */
function DeletionRequestBox() {
  const [scope, setScope] = useState<DeletionScope>("part")
  const [categories, setCategories] = useState<DeletionCategory[]>([])
  const [details, setDetails] = useState("")
  const [requests, setRequests] = useState<DeletionRequest[]>([])
  const [signedOut, setSignedOut] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch("/api/settings/privacy/deletion-requests")
      .then(async (res) => {
        if (cancelled) return
        if (res.status === 401) setSignedOut(true)
        else if (res.ok) setRequests(((await res.json()) as { requests: DeletionRequest[] }).requests)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const toggle = (id: DeletionCategory) =>
    setCategories((current) => (current.includes(id) ? current.filter((c) => c !== id) : [...current, id]))

  const submit = async () => {
    if (scope === "all" && !window.confirm("Ask us to delete all of your Debate AI data, including your account?")) return
    setBusy(true)
    setError(null)
    setSent(false)
    const res = await fetch("/api/settings/privacy/deletion-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope, categories: scope === "part" ? categories : [], details }),
    }).catch(() => null)
    setBusy(false)
    if (!res) {
      setError("Could not reach the server. Your request was not sent.")
      return
    }
    if (!res.ok) {
      setError(await readError(res))
      return
    }
    const { request } = (await res.json()) as { request: DeletionRequest }
    setRequests((current) => [request, ...current])
    setCategories([])
    setDetails("")
    setSent(true)
  }

  return (
    <section style={boxStyle} aria-labelledby="privacy-deletion-heading">
      <h4 id="privacy-deletion-heading" style={headingStyle}>
        Request deletion of your data
      </h4>
      {signedOut ? (
        <p style={{ margin: 0, fontSize: 13 }}>
          <Link href="/login" style={{ textDecoration: "underline" }}>
            Sign in
          </Link>{" "}
          to ask us to delete data tied to your account.
        </p>
      ) : (
        <>
          <p style={hintStyle}>We review every request and follow up by email. Nothing is deleted until we do.</p>
          <Radio
            name="deletion-scope"
            value="part"
            checked={scope === "part"}
            onChange={setScope}
            label="Delete part of my data"
          />
          {scope === "part" && (
            <div style={{ marginLeft: 24, display: "grid", gap: 2 }}>
              {DELETION_CATEGORIES.map((category) => (
                <label key={category.id} style={optionStyle}>
                  <input
                    type="checkbox"
                    checked={categories.includes(category.id)}
                    onChange={() => toggle(category.id)}
                    style={{ marginTop: 3 }}
                  />
                  <span>{category.label}</span>
                </label>
              ))}
            </div>
          )}
          <Radio
            name="deletion-scope"
            value="all"
            checked={scope === "all"}
            onChange={setScope}
            label="Delete all of my data and my account"
          />
          <label style={{ display: "block", fontSize: 13, margin: "10px 0 4px" }} htmlFor="privacy-deletion-details">
            Suggested deletions
          </label>
          <textarea
            id="privacy-deletion-details"
            value={details}
            maxLength={MAX_DELETION_DETAILS_LENGTH}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Links to specific recordings, videos, posts or anything else you want removed"
            rows={4}
            style={{ ...inputStyle, width: "100%", boxSizing: "border-box", resize: "vertical" }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
            <button type="button" style={{ ...buttonStyle, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={() => void submit()}>
              Send request
            </button>
            {sent && <span style={{ fontSize: 12, opacity: 0.7 }}>Request sent.</span>}
          </div>
          {error && <p style={{ color: "#d33", fontSize: 13, margin: "8px 0 0" }}>{error}</p>}
          {requests.length > 0 && (
            <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0" }}>
              {requests.map((request) => (
                <li key={request.id} style={{ padding: "6px 0", borderTop: "1px solid rgba(127, 127, 127, 0.15)", fontSize: 12 }}>
                  <strong>
                    {request.scope === "all"
                      ? "All data"
                      : request.categories.map((c) => CATEGORY_LABEL[c] ?? c).join(", ") || "Part of my data"}
                  </strong>
                  <span style={{ opacity: 0.6 }}>
                    {" "}
                    · {new Date(request.createdAt).toLocaleDateString()} · {request.status}
                  </span>
                  {request.details && <p style={{ margin: "2px 0 0", whiteSpace: "pre-wrap", opacity: 0.8 }}>{request.details}</p>}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}

/**
 * The whole Privacy tab. `accountName` is the signed-in user's name, used
 * only to preview how a real-name credit reads.
 */
export function PrivacySettingsSection({ accountName = null }: { accountName?: string | null }) {
  return (
    <div style={{ maxWidth: 720 }}>
      <RecordingReleaseBox accountName={accountName} />
      <section style={boxStyle} aria-labelledby="privacy-policy-heading">
        <h4 id="privacy-policy-heading" style={headingStyle}>
          Privacy policy
        </h4>
        <p style={{ margin: 0, fontSize: 13 }}>
          Read how we collect, use and protect your data in our{" "}
          <Link href="/legal/privacy" style={{ textDecoration: "underline" }}>
            privacy policy
          </Link>
          .
        </p>
      </section>
      <DeletionRequestBox />
    </div>
  )
}
