"use client"

import { useCallback, useEffect, useState } from "react"
import { Users } from "lucide-react"

interface Assignment {
  id: number
  kind: "lesson-plan" | "practice-drill"
  title: string
  body: string
  studentEmails: string[] | null
  dueAt: string | null
  createdAt: string
  coachName?: string | null
}

interface Roster {
  students: string[]
  max: number
}

const KIND_LABEL: Record<Assignment["kind"], string> = {
  "lesson-plan": "Lesson plan",
  "practice-drill": "Practice drill",
}

const boxStyle = {
  marginBottom: 16,
  padding: 14,
  borderRadius: 10,
  border: "1px solid var(--pmd-border, rgba(127, 127, 127, 0.25))",
} as const
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
const linkButtonStyle = {
  border: "none",
  background: "none",
  color: "inherit",
  opacity: 0.6,
  fontSize: 12,
  cursor: "pointer",
  textDecoration: "underline",
} as const

async function readError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null
  return body?.error ?? `Request failed (${res.status})`
}

function AssignmentItem({ assignment, onDelete }: { assignment: Assignment; onDelete?: () => void }) {
  const due = assignment.dueAt ? new Date(assignment.dueAt).toLocaleDateString() : null
  const who = assignment.studentEmails ? assignment.studentEmails.join(", ") : "All students"
  return (
    <li style={{ padding: "8px 0", borderTop: "1px solid rgba(127, 127, 127, 0.15)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <strong style={{ fontSize: 13 }}>
          {KIND_LABEL[assignment.kind]}: {assignment.title}
        </strong>
        {onDelete && (
          <button type="button" style={linkButtonStyle} onClick={onDelete}>
            Delete
          </button>
        )}
      </div>
      <div style={{ fontSize: 12, opacity: 0.6 }}>
        {assignment.coachName !== undefined ? `From ${assignment.coachName ?? "your coach"}` : who}
        {due ? ` · due ${due}` : ""}
      </div>
      {assignment.body && (
        <p style={{ margin: "4px 0 0", fontSize: 13, whiteSpace: "pre-wrap", opacity: 0.85 }}>{assignment.body}</p>
      )}
    </li>
  )
}

/**
 * The Research Team plan's coaching tools in Preferences: a roster of up to
 * 10 students and the lesson plans / practice drills the coach assigns to all
 * of them (or a chosen few), via `/api/team/*`. Any signed-in user also sees
 * what their coaches have assigned to them. Renders nothing when neither
 * applies.
 */
export function TeamCoachingSection() {
  const [roster, setRoster] = useState<Roster | null>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [assignmentLimits, setAssignmentLimits] = useState<{ lessonPlans: number; practiceDrills: number } | null>(null)
  const [mine, setMine] = useState<Assignment[]>([])
  const [error, setError] = useState<string | null>(null)

  const [email, setEmail] = useState("")
  const [kind, setKind] = useState<Assignment["kind"]>("lesson-plan")
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [dueAt, setDueAt] = useState("")
  const [targets, setTargets] = useState<string[]>([])

  const load = useCallback(async () => {
    const [rosterRes, assignmentsRes, mineRes] = await Promise.all([
      fetch("/api/team/students").catch(() => null),
      fetch("/api/team/assignments").catch(() => null),
      fetch("/api/team/my-assignments").catch(() => null),
    ])
    setRoster(rosterRes?.ok ? ((await rosterRes.json()) as Roster) : null)
    if (assignmentsRes?.ok) {
      const data = (await assignmentsRes.json()) as {
        assignments: Assignment[]
        limits: { lessonPlans: number; practiceDrills: number }
      }
      setAssignments(data.assignments)
      setAssignmentLimits(data.limits)
    }
    if (mineRes?.ok) setMine(((await mineRes.json()) as { assignments: Assignment[] }).assignments)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const run = async (request: Promise<Response>, after?: () => void) => {
    setError(null)
    const res = await request.catch(() => null)
    if (!res) return setError("Network error.")
    if (!res.ok) return setError(await readError(res))
    after?.()
    await load()
  }

  const addStudent = () =>
    run(
      fetch("/api/team/students", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      }),
      () => setEmail(""),
    )

  const removeStudent = (student: string) =>
    run(fetch(`/api/team/students?email=${encodeURIComponent(student)}`, { method: "DELETE" }), () =>
      setTargets((current) => current.filter((t) => t !== student)),
    )

  const assign = () =>
    run(
      fetch("/api/team/assignments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind,
          title,
          body,
          dueAt: dueAt || null,
          studentEmails: targets.length > 0 ? targets : null,
        }),
      }),
      () => {
        setTitle("")
        setBody("")
        setDueAt("")
        setTargets([])
      },
    )

  const deleteAssignment = (id: number) => run(fetch(`/api/team/assignments?id=${id}`, { method: "DELETE" }))

  if (!roster && mine.length === 0) return null

  const count = (k: Assignment["kind"]) => assignments.filter((a) => a.kind === k).length

  return (
    <section aria-label="Team" style={boxStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <Users size={16} />
        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Team</h4>
      </div>
      {error && <p style={{ margin: "0 0 8px", fontSize: 13, color: "#d9534f" }}>{error}</p>}

      {roster && (
        <>
          <p style={{ margin: "0 0 8px", fontSize: 13, opacity: 0.6 }}>
            Students ({roster.students.length} / {roster.max})
          </p>
          <ul style={{ listStyle: "none", margin: "0 0 8px", padding: 0, fontSize: 13 }}>
            {roster.students.map((student) => (
              <li key={student} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
                {student}
                <button type="button" style={linkButtonStyle} onClick={() => removeStudent(student)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
          {roster.students.length < roster.max && (
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <input
                type="email"
                placeholder="student@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ ...inputStyle, flex: 1 }}
              />
              <button type="button" style={buttonStyle} onClick={addStudent} disabled={!email}>
                Add student
              </button>
            </div>
          )}

          <p style={{ margin: "0 0 8px", fontSize: 13, opacity: 0.6 }}>
            Assign a lesson plan or practice drill
            {assignmentLimits &&
              ` (${count("lesson-plan")} / ${assignmentLimits.lessonPlans} lesson plans, ${count("practice-drill")} / ${assignmentLimits.practiceDrills} drills)`}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 8 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <select value={kind} onChange={(e) => setKind(e.target.value as Assignment["kind"])} style={inputStyle}>
                <option value="lesson-plan">Lesson plan</option>
                <option value="practice-drill">Practice drill</option>
              </select>
              <input
                placeholder="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{ ...inputStyle, flex: 1, minWidth: 140 }}
              />
              <input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} style={inputStyle} />
            </div>
            <textarea
              placeholder="Instructions, readings, drill steps…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
            />
            {roster.students.length > 0 && (
              <div style={{ fontSize: 12, display: "flex", flexWrap: "wrap", gap: 10 }}>
                <span style={{ opacity: 0.6 }}>For: {targets.length === 0 ? "all students" : ""}</span>
                {roster.students.map((student) => (
                  <label key={student} style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={targets.includes(student)}
                      onChange={(e) =>
                        setTargets((current) =>
                          e.target.checked ? [...current, student] : current.filter((t) => t !== student),
                        )
                      }
                    />
                    {student}
                  </label>
                ))}
              </div>
            )}
            <button
              type="button"
              style={{ ...buttonStyle, alignSelf: "flex-start" }}
              onClick={assign}
              disabled={!title.trim() || roster.students.length === 0}
            >
              Assign
            </button>
          </div>
          {assignments.length > 0 && (
            <ul style={{ listStyle: "none", margin: "0 0 12px", padding: 0 }}>
              {assignments.map((assignment) => (
                <AssignmentItem
                  key={assignment.id}
                  assignment={assignment}
                  onDelete={() => deleteAssignment(assignment.id)}
                />
              ))}
            </ul>
          )}
        </>
      )}

      {mine.length > 0 && (
        <>
          <p style={{ margin: "8px 0 4px", fontSize: 13, opacity: 0.6 }}>Assigned to you</p>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {mine.map((assignment) => (
              <AssignmentItem key={`${assignment.coachName}-${assignment.id}`} assignment={assignment} />
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
