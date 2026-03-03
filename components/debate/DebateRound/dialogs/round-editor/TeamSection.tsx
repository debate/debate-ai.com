"use client"

/**
 * @fileoverview Team information section of the Round Editor dialog.
 *
 * Renders side-by-side columns for the Affirmative and Negative teams,
 * each with school name and debater email inputs.
 *
 * @module components/debate/dialogs/round-editor/TeamSection
 */

import { useState } from "react"
import Image from "next/image"
import { Settings2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { debateStyles, debateStyleMap } from "@/components/debate/DebateRound/DebateTimer/debate-format-times"
import { IconAffBubble, IconNegBubble } from "@/components/icons"
import { getMyTeamProfile, saveMyTeamProfile, type MyTeamProfile } from "@/lib/state/myTeamProfile"

/** Props for {@link TeamSection}. */
interface TeamSectionProps {
  affDebater1: string
  setAffDebater1: (v: string) => void
  affDebater2: string
  setAffDebater2: (v: string) => void
  negDebater1: string
  setNegDebater1: (v: string) => void
  negDebater2: string
  setNegDebater2: (v: string) => void
  affSchool: string
  setAffSchool: (v: string) => void
  negSchool: string
  setNegSchool: (v: string) => void
  debateStyleIndex: number
}

interface MyTeamCheckboxProps {
  id: string
  checked: boolean
  onChange: (checked: boolean) => void
  onConfigure: () => void
}

function MyTeamCheckbox({ id, checked, onChange, onConfigure }: MyTeamCheckboxProps) {
  return (
    <div className="flex items-center gap-1.5 mt-1">
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 rounded border-border accent-primary cursor-pointer"
      />
      <label htmlFor={id} className="text-xs text-muted-foreground cursor-pointer select-none">
        My Team
      </label>
      <button
        type="button"
        onClick={onConfigure}
        className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
        title="Configure My Team profile"
      >
        <Settings2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

interface ConfigPanelProps {
  profile: MyTeamProfile
  onSave: (p: MyTeamProfile) => void
  onClose: () => void
  isOnePerson: boolean
}

function ConfigPanel({ profile, onSave, onClose, isOnePerson }: ConfigPanelProps) {
  const [school, setSchool] = useState(profile.school)
  const [email1, setEmail1] = useState(profile.email1)
  const [email2, setEmail2] = useState(profile.email2)

  function handleSave() {
    const updated = { school, email1, email2 }
    saveMyTeamProfile(updated)
    onSave(updated)
    onClose()
  }

  return (
    <div className="mt-2 p-2.5 rounded-md border border-border/60 bg-muted/40 space-y-2">
      <p className="text-xs font-medium text-muted-foreground">My Team Profile</p>
      <Input
        type="text"
        placeholder="School"
        value={school}
        onChange={(e) => setSchool(e.target.value)}
        className="h-7 text-xs"
      />
      <Input
        type="email"
        placeholder="My email"
        value={email1}
        onChange={(e) => setEmail1(e.target.value)}
        className="h-7 text-xs"
      />
      {!isOnePerson && (
        <Input
          type="email"
          placeholder="Partner email (optional)"
          value={email2}
          onChange={(e) => setEmail2(e.target.value)}
          className="h-7 text-xs"
        />
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          className="flex-1 h-7 text-xs rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
        >
          Save Profile
        </button>
        <button
          type="button"
          onClick={onClose}
          className="h-7 px-3 text-xs rounded-md border border-border hover:bg-muted transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

/**
 * Two-column grid showing Affirmative and Negative team inputs.
 *
 * @param props - {@link TeamSectionProps}
 * @returns The rendered section
 */
export function TeamSection({
  affDebater1,
  setAffDebater1,
  affDebater2,
  setAffDebater2,
  negDebater1,
  setNegDebater1,
  negDebater2,
  setNegDebater2,
  affSchool,
  setAffSchool,
  negSchool,
  setNegSchool,
  debateStyleIndex,
}: TeamSectionProps) {
  const styleKey = debateStyleMap[debateStyleIndex]
  const styleConfig = debateStyles[styleKey]
  const affNameRaw = styleConfig.primary.name
  const negNameRaw = styleConfig.secondary?.name || "neg"
  const isOnePerson = styleKey === "lincolnDouglas" || styleKey === "nofSpar"

  const [affMyTeam, setAffMyTeam] = useState(false)
  const [negMyTeam, setNegMyTeam] = useState(false)
  const [showAffConfig, setShowAffConfig] = useState(false)
  const [showNegConfig, setShowNegConfig] = useState(false)
  const [profile, setProfile] = useState<MyTeamProfile>(() => getMyTeamProfile())

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

  const getTeamName = (rawName: string) => {
    if (rawName === "aff") return "Affirmative"
    if (rawName === "neg") return "Negative"
    if (rawName === "prop") return "Proposition"
    if (rawName === "opp") return "Opposition"
    if (rawName === "pro") return "Pro"
    if (rawName === "con") return "Con"
    if (rawName === "bill") return "Bill Sponsor"
    return capitalize(rawName)
  }

  const affName = getTeamName(affNameRaw)
  const negName = getTeamName(negNameRaw)

  function applyProfile(
    setSchool: (v: string) => void,
    setEmail1: (v: string) => void,
    setEmail2: (v: string) => void,
    checked: boolean,
    p: MyTeamProfile,
  ) {
    if (checked) {
      setSchool(p.school)
      setEmail1(p.email1)
      if (!isOnePerson) setEmail2(p.email2)
    }
  }

  function handleAffMyTeam(checked: boolean) {
    setAffMyTeam(checked)
    applyProfile(setAffSchool, setAffDebater1, setAffDebater2, checked, profile)
  }

  function handleNegMyTeam(checked: boolean) {
    setNegMyTeam(checked)
    applyProfile(setNegSchool, setNegDebater1, setNegDebater2, checked, profile)
  }

  function handleProfileSaved(updated: MyTeamProfile) {
    setProfile(updated)
    if (affMyTeam) applyProfile(setAffSchool, setAffDebater1, setAffDebater2, true, updated)
    if (negMyTeam) applyProfile(setNegSchool, setNegDebater1, setNegDebater2, true, updated)
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Affirmative Team */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-blue-500 flex items-center gap-1.5">
          <Image src={IconAffBubble} alt="" width={20} height={20} />
          {affName}
        </h3>
        <MyTeamCheckbox
          id="my-team-aff"
          checked={affMyTeam}
          onChange={handleAffMyTeam}
          onConfigure={() => { setShowAffConfig((v) => !v); setShowNegConfig(false) }}
        />
        {showAffConfig && (
          <ConfigPanel
            profile={profile}
            onSave={handleProfileSaved}
            onClose={() => setShowAffConfig(false)}
            isOnePerson={isOnePerson}
          />
        )}
        <div className="space-y-2">
          <Input
            id="aff-school"
            type="text"
            placeholder="School (Optional)"
            value={affSchool}
            onChange={(e) => setAffSchool(e.target.value)}
          />
          <Input
            id="aff-debater-1"
            type="email"
            placeholder="1A Email"
            value={affDebater1}
            onChange={(e) => setAffDebater1(e.target.value)}
          />
          {!isOnePerson && (
            <Input
              id="aff-debater-2"
              type="email"
              placeholder="2A Email (Optional)"
              value={affDebater2}
              onChange={(e) => setAffDebater2(e.target.value)}
            />
          )}
        </div>
      </div>

      {/* Negative Team */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-red-500 flex items-center gap-1.5">
          <Image src={IconNegBubble} alt="" width={20} height={20} />
          {negName}
        </h3>
        <MyTeamCheckbox
          id="my-team-neg"
          checked={negMyTeam}
          onChange={handleNegMyTeam}
          onConfigure={() => { setShowNegConfig((v) => !v); setShowAffConfig(false) }}
        />
        {showNegConfig && (
          <ConfigPanel
            profile={profile}
            onSave={handleProfileSaved}
            onClose={() => setShowNegConfig(false)}
            isOnePerson={isOnePerson}
          />
        )}
        <div className="space-y-2">
          <Input
            id="neg-school"
            type="text"
            placeholder="School (Optional)"
            value={negSchool}
            onChange={(e) => setNegSchool(e.target.value)}
          />
          <Input
            id="neg-debater-1"
            type="email"
            placeholder="1N Email"
            value={negDebater1}
            onChange={(e) => setNegDebater1(e.target.value)}
          />
          {!isOnePerson && (
            <Input
              id="neg-debater-2"
              type="email"
              placeholder="2N Email (Optional)"
              value={negDebater2}
              onChange={(e) => setNegDebater2(e.target.value)}
            />
          )}
        </div>
      </div>
    </div>
  )
}
