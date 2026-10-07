/**
 * @fileoverview Team Calendar panel — a coach's month calendar of tasks,
 * assignments and group-only virtual tournaments for one coaching group.
 *
 * Groups are the coach's `CoachingProgramConfig`s (`state/coachingPrograms.ts`);
 * a group can also be created inline here so the calendar works without a
 * trip to Coaching Programs first. The left column is the month grid (prev /
 * next month, Sunday-first, a dot per kind of entry on each day, the
 * selected day filled); under it the selected day's agenda in three tabs —
 * Tasks, Assignments, Tournaments — as cards with per-member completion
 * checkboxes (tasks/assignments) or the round-robin pairings (tournaments).
 * The right column is the "Schedule" form, the group's upcoming deadlines
 * with overdue entries flagged, and a per-member workload table.
 *
 * Pure logic lives in `lib/team-calendar.ts`; storage in
 * `state/teamCalendar.ts`. Cross-tab changes arrive through a `storage`
 * listener, and everything else is a plain reload — nothing needs a live
 * connection.
 *
 * @module panels/TeamCalendarPanel
 */

"use client"

import { useEffect, useMemo, useState } from "react"
import { BookOpen, CalendarDays, ChevronLeft, ChevronRight, ClipboardList, Trophy } from "lucide-react"
import { Badge } from "@debate/round/src/ui/primitives/badge"
import { Button } from "@debate/round/src/ui/primitives/button"
import { Input } from "@debate/round/src/ui/primitives/input"
import { Label } from "@debate/round/src/ui/primitives/label"
import { EmptyState, PanelSection, PanelShell } from "@debate/round/src/ui/panels/panel-shell"
import type { CoachingProgramConfig } from "../round/coaching-program"
import { buildCoachingProgramsPanelView, saveCoachingProgram } from "../state/coachingPrograms"
import {
  deleteTeamCalendarItem,
  isTeamCalendarLiveUpdateStorageEvent,
  listTeamCalendarItems,
  saveTeamCalendarItem,
} from "../state/teamCalendar"
import {
  MAX_TEAM_TOURNAMENT_ROUNDS,
  TEAM_CALENDAR_TOURNAMENT_FORMATS,
  buildDayAgenda,
  buildMemberLoad,
  buildMonthGrid,
  buildTeamCalendarItem,
  buildTournamentPairings,
  countItemsByDate,
  formatMonthLabel,
  isTeamCalendarItemComplete,
  isTeamCalendarItemOverdue,
  itemsForGroup,
  parseIsoDate,
  shiftMonth,
  toIsoDate,
  toggleTeamCalendarCompletion,
  upcomingDeadlines,
  type TeamCalendarItem,
  type TeamCalendarItemKind,
  type TeamCalendarTournamentFormat,
} from "../lib/team-calendar"

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

const KIND_META: Record<TeamCalendarItemKind, { label: string; plural: string; dot: string; Icon: typeof ClipboardList }> = {
  task: { label: "Task", plural: "Tasks", dot: "bg-sky-500", Icon: ClipboardList },
  assignment: { label: "Assignment", plural: "Assignments", dot: "bg-amber-500", Icon: BookOpen },
  tournament: { label: "Tournament", plural: "Tournaments", dot: "bg-violet-500", Icon: Trophy },
}

type Draft = {
  kind: TeamCalendarItemKind
  title: string
  notes: string
  time: string
  assigneeIds: string[]
  format: TeamCalendarTournamentFormat
  rounds: string
}

const EMPTY_DRAFT: Draft = { kind: "task", title: "", notes: "", time: "", assigneeIds: [], format: "PF", rounds: "4" }

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `cal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function formatDayLabel(iso: string): string {
  const date = parseIsoDate(iso)
  return date ? date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }) : iso
}

function formatTime(time?: string): string | null {
  if (!time) return null
  const [h, m] = time.split(":").map(Number)
  return new Date(2000, 0, 1, h, m).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
}

/**
 * Renders the Team Calendar. Reads localStorage on mount only, so it shows a
 * loading state during SSR/hydration rather than throwing.
 */
export function TeamCalendarPanel() {
  const [groups, setGroups] = useState<CoachingProgramConfig[] | null>(null)
  const [items, setItems] = useState<TeamCalendarItem[]>([])
  const [groupId, setGroupId] = useState<string | null>(null)
  const [today, setToday] = useState<string>("")
  const [view, setView] = useState<{ year: number; month: number }>({ year: 2026, month: 0 })
  const [selected, setSelected] = useState<string>("")
  const [tab, setTab] = useState<TeamCalendarItemKind>("task")
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [error, setError] = useState<string | null>(null)
  const [groupDraft, setGroupDraft] = useState({ name: "", memberIds: "" })
  const [groupError, setGroupError] = useState<string | null>(null)

  const refresh = () => {
    const nextGroups = buildCoachingProgramsPanelView()
    setGroups(nextGroups)
    setItems(listTeamCalendarItems())
    setGroupId((prev) => (prev && nextGroups.some((g) => g.id === prev) ? prev : nextGroups[0]?.id ?? null))
  }

  useEffect(() => {
    const now = new Date()
    const iso = toIsoDate(now)
    setToday(iso)
    setSelected(iso)
    setView({ year: now.getFullYear(), month: now.getMonth() })
    refresh()
  }, [])

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (isTeamCalendarLiveUpdateStorageEvent(event)) refresh()
    }
    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [])

  const group = groups?.find((g) => g.id === groupId) ?? null
  const groupItems = useMemo(() => (group ? itemsForGroup(items, group.id) : []), [items, group])
  const counts = useMemo(() => countItemsByDate(groupItems), [groupItems])
  const agenda = useMemo(() => buildDayAgenda(groupItems, selected), [groupItems, selected])
  const deadlines = useMemo(() => upcomingDeadlines(groupItems, 8), [groupItems])
  const memberLoad = useMemo(
    () => (group ? buildMemberLoad(groupItems, group.memberIds, today) : []),
    [groupItems, group, today],
  )
  const weeks = useMemo(() => buildMonthGrid(view.year, view.month), [view])

  if (groups === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading team calendar…</div>
  }

  const persist = (item: TeamCalendarItem) => {
    saveTeamCalendarItem(item)
    setItems(listTeamCalendarItems())
  }

  const handleCreateGroup = () => {
    const name = groupDraft.name.trim()
    const memberIds = groupDraft.memberIds.split(",").map((id) => id.trim()).filter(Boolean)
    if (!name || memberIds.length === 0) {
      setGroupError("A group name and at least one researcher are required.")
      return
    }
    const id = newId()
    saveCoachingProgram({ id, name, memberIds: [...new Set(memberIds)] })
    setGroupDraft({ name: "", memberIds: "" })
    setGroupError(null)
    refresh()
    setGroupId(id)
  }

  const handleSchedule = () => {
    if (!group) return
    const result = buildTeamCalendarItem(
      {
        kind: draft.kind,
        title: draft.title,
        notes: draft.notes,
        date: selected,
        time: draft.time,
        assigneeIds: draft.assigneeIds,
        format: draft.format,
        rounds: Number(draft.rounds),
      },
      group,
      { id: newId(), now: Date.now() },
    )
    if (!result.ok) {
      setError(result.error)
      return
    }
    persist(result.item)
    setError(null)
    setDraft((prev) => ({ ...EMPTY_DRAFT, kind: prev.kind }))
    setTab(result.item.kind)
  }

  const toggleAssignee = (memberId: string) =>
    setDraft((prev) => ({
      ...prev,
      assigneeIds: prev.assigneeIds.includes(memberId)
        ? prev.assigneeIds.filter((id) => id !== memberId)
        : [...prev.assigneeIds, memberId],
    }))

  const jumpTo = (iso: string) => {
    const date = parseIsoDate(iso)
    if (!date) return
    setSelected(iso)
    setView({ year: date.getFullYear(), month: date.getMonth() })
  }

  return (
    <PanelShell
      title="Team Calendar"
      description="Schedule research tasks, assignments and group-only virtual tournaments for each group you coach, with deadlines on a shared calendar."
      icon={<CalendarDays className="size-5" />}
    >
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-4">
        <div className="min-w-48 flex-1 space-y-1.5">
          <Label htmlFor="team-calendar-group">Group</Label>
          <select
            id="team-calendar-group"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={groupId ?? ""}
            onChange={(e) => setGroupId(e.target.value || null)}
            disabled={groups.length === 0}
          >
            {groups.length === 0 && <option value="">No groups yet</option>}
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} ({g.memberIds.length})
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-40 flex-1 space-y-1.5">
          <Label htmlFor="team-calendar-new-group">New group</Label>
          <Input
            id="team-calendar-new-group"
            value={groupDraft.name}
            onChange={(e) => setGroupDraft((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Novice researchers"
          />
        </div>
        <div className="min-w-40 flex-1 space-y-1.5">
          <Label htmlFor="team-calendar-new-group-members">Researchers (comma-separated)</Label>
          <Input
            id="team-calendar-new-group-members"
            value={groupDraft.memberIds}
            onChange={(e) => setGroupDraft((prev) => ({ ...prev, memberIds: e.target.value }))}
            placeholder="alice, bob, carol"
          />
        </div>
        <Button variant="outline" onClick={handleCreateGroup}>
          Add group
        </Button>
        {groupError && <p className="w-full text-sm text-destructive">{groupError}</p>}
      </div>

      {!group ? (
        <EmptyState
          title="No coaching groups yet."
          message="Add a group of researchers above to start scheduling their tasks, deadlines and tournaments."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
          <div className="min-w-0 space-y-4">
            <div className="rounded-2xl border border-border p-3 sm:p-4">
              <div className="mb-3 flex items-center justify-between rounded-xl bg-muted/50 px-2 py-2">
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Previous month"
                  onClick={() => setView((v) => shiftMonth(v.year, v.month, -1))}
                >
                  <ChevronLeft />
                </Button>
                <h3 className="text-base font-medium sm:text-lg">{formatMonthLabel(view.year, view.month)}</h3>
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Next month"
                  onClick={() => setView((v) => shiftMonth(v.year, v.month, 1))}
                >
                  <ChevronRight />
                </Button>
              </div>
              <div role="grid" aria-label={formatMonthLabel(view.year, view.month)} className="grid grid-cols-7 gap-y-1 text-center">
                {WEEKDAYS.map((day) => (
                  <div key={day} role="columnheader" className="pb-2 text-xs font-medium text-muted-foreground sm:text-sm">
                    {day}
                  </div>
                ))}
                {weeks.flat().map((cell) => {
                  const isSelected = cell.iso === selected
                  const isToday = cell.iso === today
                  const dayCounts = counts.get(cell.iso)
                  return (
                    <button
                      key={cell.iso}
                      type="button"
                      role="gridcell"
                      aria-selected={isSelected}
                      aria-label={`${formatDayLabel(cell.iso)}${dayCounts ? `, ${dayCounts.task + dayCounts.assignment + dayCounts.tournament} scheduled` : ""}`}
                      onClick={() => jumpTo(cell.iso)}
                      className={[
                        "mx-auto flex aspect-square w-full max-w-14 flex-col items-center justify-center rounded-xl text-sm transition-colors sm:text-base",
                        isSelected
                          ? "bg-foreground text-background"
                          : cell.inMonth
                            ? "hover:bg-muted"
                            : "text-muted-foreground/50 hover:bg-muted",
                        isToday && !isSelected ? "ring-1 ring-border font-semibold" : "",
                      ].join(" ")}
                    >
                      <span>{cell.day}</span>
                      <span className="mt-0.5 flex h-1.5 gap-0.5">
                        {dayCounts &&
                          (Object.keys(KIND_META) as TeamCalendarItemKind[])
                            .filter((kind) => dayCounts[kind] > 0)
                            .map((kind) => <span key={kind} className={`size-1.5 rounded-full ${KIND_META[kind].dot}`} />)}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">{formatDayLabel(selected)}</p>
              <div role="tablist" className="mb-3 flex gap-1 overflow-x-auto rounded-xl bg-muted/50 p-1">
                {(Object.keys(KIND_META) as TeamCalendarItemKind[]).map((kind) => {
                  const { plural, Icon } = KIND_META[kind]
                  return (
                    <button
                      key={kind}
                      type="button"
                      role="tab"
                      aria-selected={tab === kind}
                      onClick={() => setTab(kind)}
                      className={[
                        "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm",
                        tab === kind ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground",
                      ].join(" ")}
                    >
                      <Icon className="size-4" />
                      {plural}
                      {agenda[kind].length > 0 && <span className="text-xs text-muted-foreground">{agenda[kind].length}</span>}
                    </button>
                  )
                })}
              </div>
              {agenda[tab].length === 0 ? (
                <EmptyState
                  title={`No ${KIND_META[tab].plural.toLowerCase()} on this day.`}
                  message="Use Schedule to add one for the selected date."
                />
              ) : (
                <ul className="space-y-3">
                  {agenda[tab].map((item) => (
                    <AgendaCard
                      key={item.id}
                      item={item}
                      today={today}
                      onToggle={(memberId) => persist(toggleTeamCalendarCompletion(item, memberId))}
                      onDelete={() => {
                        deleteTeamCalendarItem(item.id)
                        setItems(listTeamCalendarItems())
                      }}
                    />
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="min-w-0 space-y-6">
            <PanelSection title="Schedule" description={`For ${formatDayLabel(selected)}`}>
              <div className="space-y-3 rounded-lg border border-border p-4">
                <div className="flex gap-1 rounded-lg bg-muted/50 p-1">
                  {(Object.keys(KIND_META) as TeamCalendarItemKind[]).map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      aria-pressed={draft.kind === kind}
                      onClick={() => setDraft((prev) => ({ ...prev, kind }))}
                      className={[
                        "flex-1 rounded-md px-2 py-1 text-sm",
                        draft.kind === kind ? "bg-background font-medium shadow-sm" : "text-muted-foreground",
                      ].join(" ")}
                    >
                      {KIND_META[kind].label}
                    </button>
                  ))}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="team-calendar-title">Title</Label>
                  <Input
                    id="team-calendar-title"
                    value={draft.title}
                    onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder={
                      draft.kind === "tournament"
                        ? "Squad scrimmage"
                        : draft.kind === "assignment"
                          ? "Cut 5 aff cards on AI regulation"
                          : "Update the neg block file"
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="team-calendar-time">Time (optional)</Label>
                    <Input
                      id="team-calendar-time"
                      type="time"
                      value={draft.time}
                      onChange={(e) => setDraft((prev) => ({ ...prev, time: e.target.value }))}
                    />
                  </div>
                  {draft.kind === "tournament" && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="team-calendar-format">Format</Label>
                        <select
                          id="team-calendar-format"
                          className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                          value={draft.format}
                          onChange={(e) =>
                            setDraft((prev) => ({ ...prev, format: e.target.value as TeamCalendarTournamentFormat }))
                          }
                        >
                          {TEAM_CALENDAR_TOURNAMENT_FORMATS.map((format) => (
                            <option key={format}>{format}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="team-calendar-rounds">Rounds</Label>
                        <Input
                          id="team-calendar-rounds"
                          type="number"
                          min={1}
                          max={MAX_TEAM_TOURNAMENT_ROUNDS}
                          value={draft.rounds}
                          onChange={(e) => setDraft((prev) => ({ ...prev, rounds: e.target.value }))}
                        />
                      </div>
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="team-calendar-notes">Notes (optional)</Label>
                  <Input
                    id="team-calendar-notes"
                    value={draft.notes}
                    onChange={(e) => setDraft((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder="Links, expectations, judging instructions…"
                  />
                </div>
                <fieldset className="space-y-1.5">
                  <legend className="text-sm font-medium">
                    {draft.kind === "tournament" ? "Entrants (blank = whole group)" : "Assign to"}
                  </legend>
                  <div className="flex flex-wrap gap-1.5">
                    {group.memberIds.map((memberId) => {
                      const on = draft.assigneeIds.includes(memberId)
                      return (
                        <button
                          key={memberId}
                          type="button"
                          aria-pressed={on}
                          onClick={() => toggleAssignee(memberId)}
                          className={[
                            "rounded-full border px-2.5 py-0.5 text-xs",
                            on ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted",
                          ].join(" ")}
                        >
                          {memberId}
                        </button>
                      )
                    })}
                    <button
                      type="button"
                      onClick={() => setDraft((prev) => ({ ...prev, assigneeIds: [...group.memberIds] }))}
                      className="rounded-full px-2 py-0.5 text-xs text-muted-foreground underline-offset-2 hover:underline"
                    >
                      Everyone
                    </button>
                  </div>
                </fieldset>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button className="w-full" onClick={handleSchedule}>
                  Schedule {KIND_META[draft.kind].label.toLowerCase()}
                </Button>
              </div>
            </PanelSection>

            <PanelSection title="Upcoming deadlines">
              {deadlines.length === 0 ? (
                <EmptyState title="Nothing due." message="Every task and assignment in this group is done." />
              ) : (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {deadlines.map((item) => {
                    const overdue = isTeamCalendarItemOverdue(item, today)
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => {
                            jumpTo(item.date)
                            setTab(item.kind)
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50"
                        >
                          <span className={`size-2 shrink-0 rounded-full ${KIND_META[item.kind].dot}`} />
                          <span className="min-w-0 flex-1 truncate">{item.title}</span>
                          <span className={overdue ? "text-xs text-rose-600 dark:text-rose-400" : "text-xs text-muted-foreground"}>
                            {overdue ? "Overdue · " : ""}
                            {parseIsoDate(item.date)?.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </PanelSection>

            <PanelSection title="Researcher workload">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="py-1 font-normal">Researcher</th>
                    <th className="py-1 text-right font-normal">Open</th>
                    <th className="py-1 text-right font-normal">Overdue</th>
                    <th className="py-1 text-right font-normal">Done</th>
                  </tr>
                </thead>
                <tbody>
                  {memberLoad.map((load) => (
                    <tr key={load.memberId} className="border-t border-border">
                      <td className="py-1.5">{load.memberId}</td>
                      <td className="py-1.5 text-right tabular-nums">{load.open}</td>
                      <td className={`py-1.5 text-right tabular-nums ${load.overdue ? "text-rose-600 dark:text-rose-400" : ""}`}>
                        {load.overdue}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">{load.done}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </PanelSection>
          </div>
        </div>
      )}
    </PanelShell>
  )
}

function AgendaCard({
  item,
  today,
  onToggle,
  onDelete,
}: {
  item: TeamCalendarItem
  today: string
  onToggle: (memberId: string) => void
  onDelete: () => void
}) {
  const time = formatTime(item.time)
  const overdue = isTeamCalendarItemOverdue(item, today)
  const complete = isTeamCalendarItemComplete(item)
  const pairings = item.tournament ? buildTournamentPairings(item.assigneeIds, item.tournament.rounds) : []

  return (
    <li className="rounded-2xl border border-border p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">{item.title}</p>
          <p className="text-sm text-muted-foreground">
            {time ? `${time} · ` : ""}
            {item.tournament
              ? `${item.tournament.format} · ${item.tournament.rounds} round${item.tournament.rounds === 1 ? "" : "s"} · ${item.assigneeIds.length} entrants`
              : `${item.completedBy.length}/${item.assigneeIds.length} done`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {overdue && <Badge variant="destructive">Overdue</Badge>}
          {complete && <Badge variant="secondary">Done</Badge>}
          <Button variant="ghost" size="sm" onClick={onDelete} aria-label={`Remove ${item.title}`}>
            Remove
          </Button>
        </div>
      </div>
      {item.notes && <p className="mt-2 text-sm">{item.notes}</p>}
      {item.tournament ? (
        <ol className="mt-3 space-y-1 text-sm">
          {pairings.map((round, index) => (
            <li key={index}>
              <span className="text-muted-foreground">Round {index + 1}: </span>
              {round.map(([a, b]) => (b ? `${a} vs ${b}` : `${a} (bye)`)).join(", ")}
            </li>
          ))}
        </ol>
      ) : (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {item.assigneeIds.map((memberId) => {
            const done = item.completedBy.includes(memberId)
            return (
              <label
                key={memberId}
                className="flex cursor-pointer items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 text-xs"
              >
                <input type="checkbox" checked={done} onChange={() => onToggle(memberId)} />
                <span className={done ? "line-through text-muted-foreground" : ""}>{memberId}</span>
              </label>
            )
          })}
        </div>
      )}
    </li>
  )
}
