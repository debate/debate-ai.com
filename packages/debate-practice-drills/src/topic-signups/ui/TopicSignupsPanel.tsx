"use client"

/**
 * @fileoverview Topic Sign-ups — the Practice Debates tab
 * (`/practice/debates?section=topics&topic=…`) that every listed resolution
 * links to: the 100 years of Policy / LD / PF / College topics, the
 * topic-area explorer and the 700 philosophical resolutions on Topics &
 * Statistics.
 *
 * With a topic in the URL it shows that topic's board, top to bottom:
 *
 * 1. **Sign up to debate this topic** — debate it (Aff, Neg or either) or
 *    research only, with a short note. Withdraw any time.
 * 2. **Debaters signed up** — everyone else on this topic, so partners can
 *    find each other (blocked accounts are left out by the API).
 * 3. **Research squads** — start a squad for the topic, or join one
 *    (up to {@link MAX_SQUAD_MEMBERS} members).
 * 4. **Add new information** — evidence, arguments, links and questions
 *    anyone signed in can add, listed newest first.
 *
 * Without a topic it lists the most active boards, plus a box to open a board
 * for any resolution typed in. Every write returns the whole board.
 *
 * @module debate-practice-rounds/topic-signups/ui/TopicSignupsPanel
 */

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react"
import { useSearchParams } from "next/navigation"
import { BookOpen, Loader2, MessageSquarePlus, Search, Trash2, UserPlus, Users } from "lucide-react"

import { cn } from "@debate-ai/round/src/ui/lib/utils"
import {
  parseTopicSignupParams,
  topicSignupHref,
  type TopicSignupTarget,
} from "@debate-ai/rankings/src/topics/topic-signup-link"
import { fetchActiveTopics, fetchTopicBoard, postTopicAction } from "../client"
import {
  MAX_NOTE_LENGTH,
  MAX_SQUAD_MEMBERS,
  TOPIC_NOTE_KINDS,
  TOPIC_NOTE_KIND_LABELS,
  TOPIC_SIGNUP_ROLES,
  TOPIC_SIGNUP_ROLE_LABELS,
  TOPIC_SIGNUP_SIDES,
  TOPIC_SIGNUP_SIDE_LABELS,
  type ActiveTopic,
  type TopicAction,
  type TopicBoardResponse,
  type TopicNoteKind,
  type TopicSignupRole,
  type TopicSignupSide,
} from "../types"

/** Where readers pick a resolution from. */
export const TOPIC_LISTS_HREF = "/practice/statistics"

type LoadState = "loading" | "ready" | "signed-out" | "error"

/** Props for {@link TopicSignupsPanel}. */
export interface TopicSignupsPanelProps {
  /** The topic to open; read from the URL when omitted. */
  target?: TopicSignupTarget | null
}

/** The Topic Sign-ups tab. Reads its topic from the URL unless given one. */
export function TopicSignupsPanel({ target: given }: TopicSignupsPanelProps) {
  const params = useSearchParams()
  const target = given !== undefined ? given : params ? parseTopicSignupParams(params) : null
  return target ? <TopicBoard target={target} /> : <ActiveTopicsList />
}

function TopicBoard({ target }: { target: TopicSignupTarget }) {
  const [board, setBoard] = useState<TopicBoardResponse | null>(null)
  const [loadState, setLoadState] = useState<LoadState>("loading")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const next = await fetchTopicBoard(target)
      if (!next) {
        setLoadState("signed-out")
        return
      }
      setBoard(next)
      setLoadState("ready")
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't load this topic.")
      setLoadState((current) => (current === "ready" ? current : "error"))
    }
    // The board is keyed by the text; format / source only label it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.text])

  useEffect(() => {
    setLoadState("loading")
    void load()
  }, [load])

  const act = useCallback(
    async (action: TopicAction): Promise<boolean> => {
      setBusy(true)
      try {
        setBoard(await postTopicAction(target, action))
        setError(null)
        return true
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "That didn't save. Try again.")
        return false
      } finally {
        setBusy(false)
      }
    },
    [target],
  )

  return (
    <div className="flex flex-col gap-4">
      <TopicHeader target={target} />
      {loadState === "loading" ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading this topic…
        </p>
      ) : loadState === "signed-out" ? (
        <Block title="Sign in to debate this topic" icon={<UserPlus className="h-4 w-4" />}>
          <p className="text-sm text-muted-foreground">
            Sign in to sign up for this resolution, find partners, start a research squad and add research.
          </p>
          <a
            href={`/login?callbackURL=${encodeURIComponent(topicSignupHref(target))}`}
            className="self-start rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Sign in
          </a>
        </Block>
      ) : loadState === "error" || !board ? (
        <p role="alert" className="rounded-xl border border-destructive/40 p-4 text-sm text-destructive">
          {error ?? "Couldn't load this topic."}
        </p>
      ) : (
        <>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          {board.viewer.isGuest ? (
            <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              You're on a guest account — create an account to sign up, join a squad or add research.
            </p>
          ) : null}
          <SignupForm board={board} busy={busy} onAct={act} />
          <SignupsList board={board} />
          <SquadsBlock board={board} busy={busy} onAct={act} />
          <NotesBlock board={board} busy={busy} onAct={act} />
        </>
      )}
    </div>
  )
}

function TopicHeader({ target }: { target: TopicSignupTarget }) {
  return (
    <header className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {target.format ? (
          <span className="rounded-full border border-border px-2 py-0.5 font-semibold">{target.format}</span>
        ) : null}
        {target.source ? <span>{target.source}</span> : null}
        <a href={TOPIC_LISTS_HREF} className="ml-auto font-medium text-primary hover:underline">
          All topics
        </a>
      </div>
      <h2 className="text-lg font-semibold leading-snug text-foreground">
        {/^resolved\b/i.test(target.text) ? target.text : `Resolved: ${target.text}`}
      </h2>
    </header>
  )
}

function SignupForm({
  board,
  busy,
  onAct,
}: {
  board: TopicBoardResponse
  busy: boolean
  onAct: (action: TopicAction) => Promise<boolean>
}) {
  const mine = board.mine
  const [role, setRole] = useState<TopicSignupRole>(mine?.role ?? "debate")
  const [side, setSide] = useState<TopicSignupSide>(mine?.side ?? "either")
  const [note, setNote] = useState(mine?.note ?? "")

  const submit = (event: FormEvent) => {
    event.preventDefault()
    void onAct({ action: "signup", role, side, note })
  }

  return (
    <Block
      title={mine ? "You're signed up" : "Sign up to debate this topic"}
      icon={<UserPlus className="h-4 w-4" />}
      description={
        mine
          ? "Others on this topic can see you and invite you to a squad. Change your sign-up or withdraw below."
          : "Put your name down to debate this resolution or research it, so partners and squads can find you."
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-3">
        <fieldset className="flex flex-wrap gap-2" aria-label="I want to">
          {TOPIC_SIGNUP_ROLES.map((value) => (
            <Choice key={value} active={role === value} onClick={() => setRole(value)}>
              {TOPIC_SIGNUP_ROLE_LABELS[value]}
            </Choice>
          ))}
        </fieldset>
        {role === "debate" ? (
          <fieldset className="flex flex-wrap gap-2" aria-label="Side">
            {TOPIC_SIGNUP_SIDES.map((value) => (
              <Choice key={value} active={side === value} onClick={() => setSide(value)}>
                {TOPIC_SIGNUP_SIDE_LABELS[value]}
              </Choice>
            ))}
          </fieldset>
        ) : null}
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Note (format, level, when you're free)</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={280}
            placeholder="e.g. Varsity LD, free weekday evenings"
            className="h-9 rounded-md border border-border bg-background px-3 text-sm"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={busy || board.viewer.isGuest}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {mine ? "Update sign-up" : "Sign up"}
          </button>
          {mine ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onAct({ action: "withdraw" })}
              className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
            >
              Withdraw
            </button>
          ) : null}
        </div>
      </form>
    </Block>
  )
}

function SignupsList({ board }: { board: TopicBoardResponse }) {
  return (
    <Block
      title="Find partners"
      icon={<Users className="h-4 w-4" />}
      description="Everyone else signed up for this topic. Invite them into your research squad, or challenge them from Online Challenges."
    >
      {board.signups.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nobody else has signed up yet — be the first, and share the link.</p>
      ) : (
        <ul className="divide-y divide-border">
          {board.signups.map((s) => (
            <li key={s.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2 text-sm">
              <span className="font-medium text-foreground">{s.person.name}</span>
              <span className="text-xs text-muted-foreground">
                {TOPIC_SIGNUP_ROLE_LABELS[s.role]}
                {s.role === "debate" ? ` · ${TOPIC_SIGNUP_SIDE_LABELS[s.side]}` : ""}
              </span>
              {s.note ? <span className="w-full text-muted-foreground sm:w-auto">{s.note}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </Block>
  )
}

function SquadsBlock({
  board,
  busy,
  onAct,
}: {
  board: TopicBoardResponse
  busy: boolean
  onAct: (action: TopicAction) => Promise<boolean>
}) {
  const [name, setName] = useState("")
  const [about, setAbout] = useState("")

  const create = async (event: FormEvent) => {
    event.preventDefault()
    if (await onAct({ action: "create-squad", name, about })) {
      setName("")
      setAbout("")
    }
  }

  return (
    <Block
      title="Research squads"
      icon={<Users className="h-4 w-4" />}
      description={`Start a squad to research this topic together, or join one (up to ${MAX_SQUAD_MEMBERS} members).`}
    >
      {board.squads.length === 0 ? (
        <p className="text-sm text-muted-foreground">No squads yet.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {board.squads.map((squad) => {
            const full = squad.members.length >= MAX_SQUAD_MEMBERS
            return (
              <li key={squad.id} className="flex flex-col gap-1.5 rounded-lg border border-border p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium text-foreground">{squad.name}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {squad.members.length}/{MAX_SQUAD_MEMBERS}
                  </span>
                </div>
                {squad.about ? <p className="text-sm text-muted-foreground">{squad.about}</p> : null}
                <p className="text-xs text-muted-foreground">{squad.members.map((m) => m.name).join(", ")}</p>
                <button
                  type="button"
                  disabled={busy || board.viewer.isGuest || (!squad.joined && full)}
                  onClick={() => void onAct({ action: squad.joined ? "leave-squad" : "join-squad", squadId: squad.id })}
                  className={cn(
                    "self-start rounded-md px-3 py-1 text-xs font-medium disabled:opacity-50",
                    squad.joined
                      ? "border border-border hover:bg-accent"
                      : "bg-primary text-primary-foreground hover:opacity-90",
                  )}
                >
                  {squad.joined ? "Leave squad" : full ? "Full" : "Join squad"}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <form onSubmit={create} className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          placeholder="Squad name"
          aria-label="Squad name"
          className="h-9 rounded-md border border-border bg-background px-3 text-sm sm:w-48"
        />
        <input
          value={about}
          onChange={(e) => setAbout(e.target.value)}
          maxLength={280}
          placeholder="What you'll research (optional)"
          aria-label="What the squad will research"
          className="h-9 flex-1 rounded-md border border-border bg-background px-3 text-sm"
        />
        <button
          type="submit"
          disabled={busy || !name.trim() || board.viewer.isGuest}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          Start a squad
        </button>
      </form>
    </Block>
  )
}

function NotesBlock({
  board,
  busy,
  onAct,
}: {
  board: TopicBoardResponse
  busy: boolean
  onAct: (action: TopicAction) => Promise<boolean>
}) {
  const [kind, setKind] = useState<TopicNoteKind>("evidence")
  const [title, setTitle] = useState("")
  const [url, setUrl] = useState("")
  const [body, setBody] = useState("")

  const add = async (event: FormEvent) => {
    event.preventDefault()
    if (await onAct({ action: "add-note", kind, title, url: url || null, body })) {
      setTitle("")
      setUrl("")
      setBody("")
    }
  }

  return (
    <Block
      title="Research on this topic"
      icon={<BookOpen className="h-4 w-4" />}
      description="Add new information for this resolution — evidence, arguments, links or open questions — for everyone debating it."
    >
      <form onSubmit={add} className="flex flex-col gap-2">
        <fieldset className="flex flex-wrap gap-2" aria-label="Kind">
          {TOPIC_NOTE_KINDS.map((value) => (
            <Choice key={value} active={kind === value} onClick={() => setKind(value)}>
              {TOPIC_NOTE_KIND_LABELS[value]}
            </Choice>
          ))}
        </fieldset>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={140}
            placeholder="Title or tagline"
            aria-label="Title"
            className="h-9 flex-1 rounded-md border border-border bg-background px-3 text-sm"
          />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            type="url"
            placeholder="https://… (optional)"
            aria-label="Link"
            className="h-9 flex-1 rounded-md border border-border bg-background px-3 text-sm"
          />
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={MAX_NOTE_LENGTH}
          rows={3}
          placeholder="The evidence, argument or question"
          aria-label="Details"
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={busy || board.viewer.isGuest || (!title.trim() && !url.trim() && !body.trim())}
          className="inline-flex items-center gap-1.5 self-start rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          <MessageSquarePlus className="h-4 w-4" /> Add to this topic
        </button>
      </form>

      {board.notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing added yet.</p>
      ) : (
        <ul className="flex flex-col gap-2 border-t border-border pt-3">
          {board.notes.map((note) => (
            <li key={note.id} className="flex flex-col gap-1 rounded-lg border border-border p-3 text-sm">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded-full bg-muted px-2 py-0.5 font-medium">{TOPIC_NOTE_KIND_LABELS[note.kind]}</span>
                <span>{note.person.name}</span>
                {note.mine ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void onAct({ action: "delete-note", noteId: note.id })}
                    className="ml-auto rounded p-1 hover:bg-accent disabled:opacity-50"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
              {note.title ? <span className="font-medium text-foreground">{note.title}</span> : null}
              {note.body ? <p className="whitespace-pre-line text-muted-foreground">{note.body}</p> : null}
              {note.url ? (
                <a
                  href={note.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow ugc"
                  className="self-start break-all text-xs text-primary hover:underline"
                >
                  {note.url}
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Block>
  )
}

function ActiveTopicsList() {
  const [topics, setTopics] = useState<ActiveTopic[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [text, setText] = useState("")

  useEffect(() => {
    fetchActiveTopics()
      .then((response) => setTopics(response.topics))
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Couldn't load active topics."))
  }, [])

  const open = (event: FormEvent) => {
    event.preventDefault()
    if (text.trim()) window.location.assign(topicSignupHref({ text }))
  }

  return (
    <div className="flex flex-col gap-4">
      <Block
        title="Sign up to debate a topic"
        icon={<UserPlus className="h-4 w-4" />}
        description="Pick any past resolution for Policy, LD, PF or College, or any of the 700 philosophical resolutions, to sign up, find partners and start a research squad."
      >
        <a
          href={TOPIC_LISTS_HREF}
          className="self-start rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Browse every topic
        </a>
        <form onSubmit={open} className="flex flex-col gap-2 sm:flex-row">
          <label className="relative flex-1">
            <span className="sr-only">Any resolution</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Or type any resolution…"
              className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={!text.trim()}
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
          >
            Open
          </button>
        </form>
      </Block>

      <Block title="Active topics" icon={<Users className="h-4 w-4" />}>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : topics === null ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : topics.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sign-ups yet. Pick a topic to be the first.</p>
        ) : (
          <ul className="divide-y divide-border">
            {topics.map((t) => (
              <li key={t.topic.key} className="py-2">
                <a
                  href={topicSignupHref({
                    text: t.topic.text,
                    format: t.topic.format ?? undefined,
                    source: t.topic.source ?? undefined,
                  })}
                  className="text-sm font-medium text-foreground hover:underline"
                >
                  {t.topic.text}
                </a>
                <p className="text-xs text-muted-foreground">
                  {[t.topic.format, `${t.signups} signed up`, `${t.squads} squads`, `${t.notes} research notes`]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Block>
    </div>
  )
}

function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-accent",
      )}
    >
      {children}
    </button>
  )
}

function Block({
  title,
  icon,
  description,
  children,
}: {
  title: string
  icon: ReactNode
  description?: string
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
      <header className="flex items-start gap-2">
        <span className="mt-0.5 text-muted-foreground" aria-hidden="true">
          {icon}
        </span>
        <div>
          <h2 className="text-base font-semibold leading-none">{title}</h2>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
      </header>
      {children}
    </section>
  )
}
