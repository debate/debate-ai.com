"use client"

import { useState, type ChangeEvent } from "react"
import { Calendar, Video, Users, BookOpen, Trophy, Plus, Settings, Play, MessageSquare, CheckSquare, Clock, ArrowRight } from "lucide-react"
import { Button } from "../../ui/primitives/button"
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/primitives/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/primitives/tabs"
import { Input } from "../../ui/primitives/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/primitives/select"
import { Badge } from "../../ui/primitives/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../../ui/primitives/dialog"
import { Label } from "../../ui/primitives/label"

interface Squad {
  id: string
  name: string
  members: string[]
  color: string
}

interface VideoLesson {
  id: string
  title: string
  description: string
  duration: string
  videoUrl: string
  day: number
  squad?: string
  completedBy: string[]
}

interface ResearchAssignment {
  id: string
  title: string
  description: string
  dueDate: string
  squad: string
  status: "pending" | "in-progress" | "completed"
  assignedTo: string[]
}

interface LiveSession {
  id: string
  title: string
  description: string
  scheduledAt: string
  duration: number
  squad: string
  host: string
  meetingUrl: string
}

interface Tournament {
  id: string
  name: string
  format: string
  date: string
  squads: string[]
  status: "upcoming" | "live" | "completed"
}

const SQUAD_COLORS = ["bg-blue-500", "bg-green-500", "bg-purple-500", "bg-orange-500", "bg-pink-500", "bg-cyan-500"]

const mockSquads: Squad[] = [
  { id: "1", name: "Team Alpha", members: ["Alex", "Jordan", "Taylor"], color: "bg-blue-500" },
  { id: "2", name: "Team Bravo", members: ["Casey", "Morgan", "Riley"], color: "bg-green-500" },
  { id: "3", name: "Team Charlie", members: ["Drew", "Quinn", "Avery"], color: "bg-purple-500" },
]

const mockLessons: VideoLesson[] = [
  { id: "1", title: "Introduction to Policy Debate", description: "Fundamentals of policy debate structure and strategy", duration: "45 min", videoUrl: "", day: 1, completedBy: ["Alex", "Jordan"] },
  { id: "2", title: "Research Methods for Debate", description: "Effective card cutting and evidence organization", duration: "60 min", videoUrl: "", day: 1, completedBy: ["Alex"] },
  { id: "3", title: "Affirmative Case Construction", description: "Building a winning affirmative case from scratch", duration: "50 min", videoUrl: "", day: 2, squad: "Team Alpha", completedBy: [] },
  { id: "4", title: "Negative Strategy: Disads & CPs", description: "Mastering disadvantage and counterplan debates", duration: "55 min", videoUrl: "", day: 2, squad: "Team Bravo", completedBy: [] },
  { id: "5", title: "Cross-Examination Techniques", description: "Controlling CX and setting up your speeches", duration: "40 min", videoUrl: "", day: 3, completedBy: ["Taylor"] },
  { id: "6", title: "Rebuttal Mastery", description: "Writing and delivering winning rebuttals", duration: "65 min", videoUrl: "", day: 3, squad: "Team Charlie", completedBy: [] },
]

const mockAssignments: ResearchAssignment[] = [
  { id: "1", title: "Climate Change Aff Research", description: "Find 15 cards on renewable energy incentives", dueDate: "2026-01-15", squad: "Team Alpha", status: "in-progress", assignedTo: ["Alex", "Jordan"] },
  { id: "2", title: "Economics DA Updates", description: "Update the spending DA with latest evidence", dueDate: "2026-01-16", squad: "Team Bravo", status: "pending", assignedTo: ["Casey", "Morgan"] },
  { id: "3", title: "K Answers File", description: "Compile answers to common kritiks", dueDate: "2026-01-18", squad: "Team Charlie", status: "completed", assignedTo: ["Drew", "Quinn"] },
  { id: "4", title: "T-Substantial Prep", description: "Prepare T-substantial blocks for the topic", dueDate: "2026-01-20", squad: "Team Alpha", status: "pending", assignedTo: ["Taylor"] },
]

const mockSessions: LiveSession[] = [
  { id: "1", title: "Daily Lab Meeting - Team Alpha", description: "Review day 1 lessons, Q&A, practice drills", scheduledAt: "2026-01-14T10:00:00", duration: 90, squad: "Team Alpha", host: "Coach", meetingUrl: "https://meet.example.com/alpha" },
  { id: "2", title: "Daily Lab Meeting - Team Bravo", description: "Review day 1 lessons, Q&A, practice drills", scheduledAt: "2026-01-14T11:30:00", duration: 90, squad: "Team Bravo", host: "Coach", meetingUrl: "https://meet.example.com/bravo" },
  { id: "3", title: "All-Camp Lecture: Framework Debates", description: "Deep dive into framework vs K affs", scheduledAt: "2026-01-14T14:00:00", duration: 60, squad: "All", host: "Guest Lecturer", meetingUrl: "https://meet.example.com/all-framework" },
  { id: "4", title: "Practice Round: Alpha vs Bravo", description: "Full practice round with feedback", scheduledAt: "2026-01-15T10:00:00", duration: 120, squad: "Team Alpha, Team Bravo", host: "Coach", meetingUrl: "https://meet.example.com/practice-ab" },
]

const mockTournaments: Tournament[] = [
  { id: "1", name: "Institute Mini-Tournament #1", format: "Policy (4 rounds)", date: "2026-01-17", squads: ["Team Alpha", "Team Bravo", "Team Charlie"], status: "upcoming" },
  { id: "2", name: "Institute Mini-Tournament #2", format: "LD (5 rounds)", date: "2026-01-24", squads: ["Team Alpha", "Team Bravo"], status: "upcoming" },
  { id: "3", name: "Camp Championship", format: "Policy (6 rounds + elims)", date: "2026-01-31", squads: ["Team Alpha", "Team Bravo", "Team Charlie"], status: "upcoming" },
]

function SquadCard({ squad, onClick }: { squad: Squad; onClick: () => void }) {
  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={onClick}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-full ${squad.color} flex items-center justify-center text-white font-semibold`}>
            {squad.name.split(" ")[1]?.[0] || squad.name[0]}
          </div>
          <div>
            <p className="font-medium">{squad.name}</p>
            <p className="text-sm text-muted-foreground">{squad.members.length} members</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1">
          {squad.members.map((member) => (
            <Badge key={member} variant="secondary" className="text-xs">{member}</Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function LessonCard({ lesson, currentUser = "Coach" }: { lesson: VideoLesson; currentUser?: string }) {
  const isCompleted = lesson.completedBy.includes(currentUser)
  return (
    <Card className={isCompleted ? "border-green-200 bg-green-50" : ""}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="relative h-20 w-36 rounded-lg bg-muted flex-shrink-0">
            <Play className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground/50" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">Day {lesson.day}</Badge>
              {lesson.squad && <Badge variant="secondary" className="text-xs">{lesson.squad}</Badge>}
              {isCompleted && <Badge variant="default" className="text-xs"><CheckSquare className="h-2.5 w-2.5 mr-1" /> Completed</Badge>}
            </div>
            <h4 className="mt-2 font-medium truncate">{lesson.title}</h4>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{lesson.description}</p>
            <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
              <span>{lesson.duration}</span>
              <span>{lesson.completedBy.length} completed</span>
            </div>
          </div>
          <Button size="sm" variant="outline">Watch</Button>
        </div>
      </CardContent>
    </Card>
  )
}

function AssignmentCard({ assignment }: { assignment: ResearchAssignment }) {
  const statusColors = {
    pending: "bg-gray-100 text-gray-700",
    "in-progress": "bg-blue-100 text-blue-700",
    completed: "bg-green-100 text-green-700",
  }
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">{assignment.squad}</Badge>
              <Badge className={`text-xs ${statusColors[assignment.status]}`}>{assignment.status.replace("-", " ")}</Badge>
            </div>
            <h4 className="mt-2 font-medium">{assignment.title}</h4>
            <p className="text-sm text-muted-foreground mt-1">{assignment.description}</p>
            <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
              <span><Calendar className="h-3 w-3 inline mr-1" /> Due: {assignment.dueDate}</span>
              <span>{assignment.assignedTo.length} assigned</span>
            </div>
          </div>
          <Button size="sm" variant="outline">View</Button>
        </div>
      </CardContent>
    </Card>
  )
}

function SessionCard({ session }: { session: LiveSession }) {
  const date = new Date(session.scheduledAt)
  const isUpcoming = date > new Date()
  return (
    <Card className={!isUpcoming ? "opacity-60" : ""}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">{session.squad}</Badge>
              {isUpcoming && <Badge variant="default" className="text-xs"><Video className="h-2.5 w-2.5 mr-1" /> Live</Badge>}
            </div>
            <h4 className="mt-2 font-medium">{session.title}</h4>
            <p className="text-sm text-muted-foreground mt-1">{session.description}</p>
            <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
              <span><Calendar className="h-3 w-3 inline mr-1" /> {date.toLocaleDateString()}</span>
              <span><Clock className="h-3 w-3 inline mr-1" /> {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              <span><Users className="h-3 w-3 inline mr-1" /> {session.duration} min</span>
              <span>Host: {session.host}</span>
            </div>
          </div>
          <Button size="sm" variant={isUpcoming ? "default" : "outline"} asChild>
            <a href={session.meetingUrl} target="_blank" rel="noopener noreferrer">
              {isUpcoming ? "Join" : "View Recording"}
              <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function TournamentCard({ tournament }: { tournament: Tournament }) {
  const statusColors = {
    upcoming: "bg-blue-100 text-blue-700",
    live: "bg-red-100 text-red-700",
    completed: "bg-green-100 text-green-700",
  }
  const statusIcons = {
    upcoming: Calendar,
    live: Video,
    completed: Trophy,
  }
  const StatusIcon = statusIcons[tournament.status]
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">{tournament.format}</Badge>
              <Badge className={`text-xs ${statusColors[tournament.status]}`}>
                <StatusIcon className="h-2.5 w-2.5 mr-1" />
                {tournament.status}
              </Badge>
            </div>
            <h4 className="mt-2 font-medium">{tournament.name}</h4>
            <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
              <span><Calendar className="h-3 w-3 inline mr-1" /> {tournament.date}</span>
              <span>{tournament.squads.length} squads</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {tournament.squads.map((squad) => (
                <Badge key={squad} variant="secondary" className="text-xs">{squad}</Badge>
              ))}
            </div>
          </div>
          <Button size="sm" variant="outline">Details</Button>
        </div>
      </CardContent>
    </Card>
  )
}

function CreateSquadDialog({ onCreate }: { onCreate: (name: string) => void }) {
  const [name, setName] = useState("")
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Plus className="h-3.5 w-3.5 mr-1" /> New Squad</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Squad</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="squad-name">Squad Name</Label>
            <Input id="squad-name" value={name} onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)} placeholder="e.g., Team Delta" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => { onCreate(name); setOpen(false); setName(""); }} disabled={!name.trim()}>Create</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function CreateLessonDialog({ onCreate }: { onCreate: (lesson: Partial<VideoLesson>) => void }) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [duration, setDuration] = useState("45 min")
  const [day, setDay] = useState(1)
  const [squad, setSquad] = useState("")
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Plus className="h-3.5 w-3.5 mr-1" /> Add Lesson</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Video Lesson</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="lesson-title">Title</Label>
            <Input id="lesson-title" value={title} onChange={(e: ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)} placeholder="Lesson title" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lesson-description">Description</Label>
            <textarea
              id="lesson-description"
              value={description}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
              placeholder="What this lesson covers"
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lesson-duration">Duration</Label>
              <Input id="lesson-duration" value={duration} onChange={(e: ChangeEvent<HTMLInputElement>) => setDuration(e.target.value)} placeholder="e.g., 45 min" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lesson-day">Day</Label>
              <Input id="lesson-day" type="number" value={day} onChange={(e: ChangeEvent<HTMLInputElement>) => setDay(Number(e.target.value))} min={1} max={30} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="lesson-squad">Squad (optional)</Label>
            <Select value={squad} onValueChange={setSquad}>
              <SelectTrigger id="lesson-squad">
                <SelectValue placeholder="All squads" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All squads</SelectItem>
                <SelectItem value="Team Alpha">Team Alpha</SelectItem>
                <SelectItem value="Team Bravo">Team Bravo</SelectItem>
                <SelectItem value="Team Charlie">Team Charlie</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => { onCreate({ title, description, duration, day, squad: squad || undefined }); setOpen(false); setTitle(""); setDescription(""); setDay(1); setSquad(""); }} disabled={!title.trim()}>Add Lesson</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function CreateAssignmentDialog({ onCreate }: { onCreate: (assignment: Partial<ResearchAssignment>) => void }) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [squad, setSquad] = useState("")
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Plus className="h-3.5 w-3.5 mr-1" /> Add Assignment</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Research Assignment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="assignment-title">Title</Label>
            <Input id="assignment-title" value={title} onChange={(e: ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)} placeholder="Assignment title" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="assignment-description">Description</Label>
            <textarea
              id="assignment-description"
              value={description}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
              placeholder="What to research"
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="assignment-due">Due Date</Label>
              <Input id="assignment-due" type="date" value={dueDate} onChange={(e: ChangeEvent<HTMLInputElement>) => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="assignment-squad">Squad</Label>
              <Select value={squad} onValueChange={setSquad}>
                <SelectTrigger id="assignment-squad">
                  <SelectValue placeholder="Select squad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Team Alpha">Team Alpha</SelectItem>
                  <SelectItem value="Team Bravo">Team Bravo</SelectItem>
                  <SelectItem value="Team Charlie">Team Charlie</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => { onCreate({ title, description, dueDate, squad, status: "pending", assignedTo: [] }); setOpen(false); setTitle(""); setDescription(""); setDueDate(""); setSquad(""); }} disabled={!title.trim() || !squad}>Add Assignment</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function CreateSessionDialog({ onCreate }: { onCreate: (session: Partial<LiveSession>) => void }) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [scheduledAt, setScheduledAt] = useState("")
  const [duration, setDuration] = useState(60)
  const [squad, setSquad] = useState("")
  const [host, setHost] = useState("Coach")
  const [meetingUrl, setMeetingUrl] = useState("")
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Plus className="h-3.5 w-3.5 mr-1" /> Schedule Session</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule Live Session</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="session-title">Title</Label>
            <Input id="session-title" value={title} onChange={(e: ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)} placeholder="Session title" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="session-description">Description</Label>
            <textarea
              id="session-description"
              value={description}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
              placeholder="What will be covered"
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="session-date">Date & Time</Label>
              <Input id="session-date" type="datetime-local" value={scheduledAt} onChange={(e: ChangeEvent<HTMLInputElement>) => setScheduledAt(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="session-duration">Duration (min)</Label>
              <Input id="session-duration" type="number" value={duration} onChange={(e: ChangeEvent<HTMLInputElement>) => setDuration(Number(e.target.value))} min={15} max={240} step={15} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="session-squad">Squad</Label>
              <Select value={squad} onValueChange={setSquad}>
                <SelectTrigger id="session-squad">
                  <SelectValue placeholder="Select squad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Squads</SelectItem>
                  <SelectItem value="Team Alpha">Team Alpha</SelectItem>
                  <SelectItem value="Team Bravo">Team Bravo</SelectItem>
                  <SelectItem value="Team Charlie">Team Charlie</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="session-host">Host</Label>
              <Input id="session-host" value={host} onChange={(e: ChangeEvent<HTMLInputElement>) => setHost(e.target.value)} placeholder="Host name" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="session-url">Meeting URL</Label>
            <Input id="session-url" value={meetingUrl} onChange={(e: ChangeEvent<HTMLInputElement>) => setMeetingUrl(e.target.value)} placeholder="https://meet.example.com/..." />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => { onCreate({ title, description, scheduledAt, duration, squad, host, meetingUrl }); setOpen(false); setTitle(""); setDescription(""); setScheduledAt(""); setDuration(60); setSquad(""); setHost("Coach"); setMeetingUrl(""); }} disabled={!title.trim() || !scheduledAt || !meetingUrl}>Schedule</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function CreateTournamentDialog({ onCreate }: { onCreate: (tournament: Partial<Tournament>) => void }) {
  const [name, setName] = useState("")
  const [format, setFormat] = useState("Policy (4 rounds)")
  const [date, setDate] = useState("")
  const [squads, setSquads] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Plus className="h-3.5 w-3.5 mr-1" /> New Tournament</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Tournament</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="tournament-name">Tournament Name</Label>
            <Input id="tournament-name" value={name} onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)} placeholder="e.g., Institute Mini-Tournament #1" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tournament-format">Format</Label>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger id="tournament-format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Policy (4 rounds)">Policy (4 rounds)</SelectItem>
                  <SelectItem value="Policy (6 rounds + elims)">Policy (6 rounds + elims)</SelectItem>
                  <SelectItem value="LD (5 rounds)">LD (5 rounds)</SelectItem>
                  <SelectItem value="LD (6 rounds + elims)">LD (6 rounds + elims)</SelectItem>
                  <SelectItem value="PF (4 rounds)">PF (4 rounds)</SelectItem>
                  <SelectItem value="Custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tournament-date">Date</Label>
              <Input id="tournament-date" type="date" value={date} onChange={(e: ChangeEvent<HTMLInputElement>) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Participating Squads</Label>
            <div className="flex flex-wrap gap-2">
              {["Team Alpha", "Team Bravo", "Team Charlie"].map((squad) => (
                <Button
                  key={squad}
                  variant={squads.includes(squad) ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSquads(squads.includes(squad) ? squads.filter((s) => s !== squad) : [...squads, squad])}
                >
                  {squad}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => { onCreate({ name, format, date, squads, status: "upcoming" }); setOpen(false); setName(""); setFormat("Policy (4 rounds)"); setDate(""); setSquads([]); }} disabled={!name.trim() || !date || squads.length === 0}>Create Tournament</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function DebateInstitutePanel() {
  const [activeTab, setActiveTab] = useState("overview")
  const [squads, setSquads] = useState<Squad[]>(mockSquads)
  const [lessons, setLessons] = useState<VideoLesson[]>(mockLessons)
  const [assignments, setAssignments] = useState<ResearchAssignment[]>(mockAssignments)
  const [sessions, setSessions] = useState<LiveSession[]>(mockSessions)
  const [tournaments, setTournaments] = useState<Tournament[]>(mockTournaments)

  const handleCreateSquad = (name: string) => {
    const newSquad: Squad = {
      id: String(Date.now()),
      name,
      members: [],
      color: SQUAD_COLORS[squads.length % SQUAD_COLORS.length],
    }
    setSquads([...squads, newSquad])
  }

  const handleCreateLesson = (lesson: Partial<VideoLesson>) => {
    const newLesson: VideoLesson = {
      id: String(Date.now()),
      title: lesson.title || "",
      description: lesson.description || "",
      duration: lesson.duration || "45 min",
      videoUrl: "",
      day: lesson.day || 1,
      squad: lesson.squad,
      completedBy: [],
    }
    setLessons([...lessons, newLesson])
  }

  const handleCreateAssignment = (assignment: Partial<ResearchAssignment>) => {
    const newAssignment: ResearchAssignment = {
      id: String(Date.now()),
      title: assignment.title || "",
      description: assignment.description || "",
      dueDate: assignment.dueDate || "",
      squad: assignment.squad || "",
      status: "pending",
      assignedTo: [],
    }
    setAssignments([...assignments, newAssignment])
  }

  const handleCreateSession = (session: Partial<LiveSession>) => {
    const newSession: LiveSession = {
      id: String(Date.now()),
      title: session.title || "",
      description: session.description || "",
      scheduledAt: session.scheduledAt || new Date().toISOString(),
      duration: session.duration || 60,
      squad: session.squad || "All",
      host: session.host || "Coach",
      meetingUrl: session.meetingUrl || "",
    }
    setSessions([...sessions, newSession])
  }

  const handleCreateTournament = (tournament: Partial<Tournament>) => {
    const newTournament: Tournament = {
      id: String(Date.now()),
      name: tournament.name || "",
      format: tournament.format || "Policy (4 rounds)",
      date: tournament.date || "",
      squads: tournament.squads || [],
      status: "upcoming",
    }
    setTournaments([...tournaments, newTournament])
  }

  const totalStudents = squads.reduce((sum, s) => sum + s.members.length, 0)
  const upcomingSessions = sessions.filter((s) => new Date(s.scheduledAt) > new Date()).length
  const pendingAssignments = assignments.filter((a) => a.status === "pending").length
  const upcomingTournaments = tournaments.filter((t) => t.status === "upcoming").length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Debate Institute</h2>
          <p className="text-muted-foreground">Run your own debate camp: videos, live sessions, squads, assignments, and tournaments.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm"><Settings className="h-3.5 w-3.5 mr-1" /> Institute Settings</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Students</p>
                <p className="text-2xl font-bold">{totalStudents}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                <Video className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Upcoming Live Sessions</p>
                <p className="text-2xl font-bold">{upcomingSessions}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-yellow-100 flex items-center justify-center">
                <CheckSquare className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending Assignments</p>
                <p className="text-2xl font-bold">{pendingAssignments}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Trophy className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Upcoming Tournaments</p>
                <p className="text-2xl font-bold">{upcomingTournaments}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="squads">Squads</TabsTrigger>
          <TabsTrigger value="lessons">Video Lessons</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
          <TabsTrigger value="sessions">Live Sessions</TabsTrigger>
          <TabsTrigger value="tournaments">Tournaments</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Video className="h-4 w-4" /> Next Live Sessions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {sessions
                    .filter((s) => new Date(s.scheduledAt) > new Date())
                    .slice(0, 3)
                    .map((session) => (
                      <SessionCard key={session.id} session={session} />
                    ))}
                  {sessions.filter((s) => new Date(s.scheduledAt) > new Date()).length === 0 && (
                    <p className="text-muted-foreground text-center py-4">No upcoming sessions</p>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><CheckSquare className="h-4 w-4" /> Due Soon</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {assignments
                    .filter((a) => a.status !== "completed")
                    .slice(0, 3)
                    .map((assignment) => (
                      <AssignmentCard key={assignment.id} assignment={assignment} />
                    ))}
                  {assignments.filter((a) => a.status !== "completed").length === 0 && (
                    <p className="text-muted-foreground text-center py-4">No pending assignments</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Trophy className="h-4 w-4" /> Upcoming Tournaments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {tournaments
                  .filter((t) => t.status === "upcoming")
                  .slice(0, 3)
                  .map((tournament) => (
                    <TournamentCard key={tournament.id} tournament={tournament} />
                  ))}
                {tournaments.filter((t) => t.status === "upcoming").length === 0 && (
                  <p className="text-muted-foreground text-center py-4">No upcoming tournaments</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="squads" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Squads</h3>
            <CreateSquadDialog onCreate={handleCreateSquad} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {squads.map((squad) => (
              <SquadCard key={squad.id} squad={squad} onClick={() => {}} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="lessons" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Video Lessons</h3>
            <CreateLessonDialog onCreate={handleCreateLesson} />
          </div>
          <div className="space-y-3">
            {lessons
              .sort((a, b) => a.day - b.day)
              .map((lesson) => (
                <LessonCard key={lesson.id} lesson={lesson} />
              ))}
          </div>
        </TabsContent>

        <TabsContent value="assignments" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Research Assignments</h3>
            <CreateAssignmentDialog onCreate={handleCreateAssignment} />
          </div>
          <div className="space-y-3">
            {assignments.map((assignment) => (
              <AssignmentCard key={assignment.id} assignment={assignment} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="sessions" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Live Sessions</h3>
            <CreateSessionDialog onCreate={handleCreateSession} />
          </div>
          <div className="space-y-3">
            {sessions
              .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
              .map((session) => (
                <SessionCard key={session.id} session={session} />
              ))}
          </div>
        </TabsContent>

        <TabsContent value="tournaments" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Tournaments</h3>
            <CreateTournamentDialog onCreate={handleCreateTournament} />
          </div>
          <div className="space-y-3">
            {tournaments.map((tournament) => (
              <TournamentCard key={tournament.id} tournament={tournament} />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default DebateInstitutePanel