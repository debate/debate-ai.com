"use client"

/**
 * @fileoverview Spectators management section of the Round Editor dialog.
 * 
 * Allows adding and removing spectator email inputs dynamically.
 * Unlike judges, spectators are optional (none by default).
 *
 * @module components/debate/dialogs/round-editor/SpectatorsSection
 */

import { Plus, Minus, Users } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

/** Props for {@link SpectatorsSection}. */
interface SpectatorsSectionProps {
    /** Current list of spectator email values */
    spectatorEmails: string[]
    /** Replace the entire spectator emails list */
    setSpectatorEmails: (v: string[]) => void
}

/**
 * Dynamic list of spectator email inputs with add/remove controls.
 *
 * @param props - {@link SpectatorsSectionProps}
 * @returns The rendered section
 */
export function SpectatorsSection({ spectatorEmails, setSpectatorEmails }: SpectatorsSectionProps) {
    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                    <Users className="h-4 w-4" />
                    Spectators
                </h3>
                <div className="flex gap-1">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setSpectatorEmails([...spectatorEmails, ""])}
                        title="Add Spectator"
                    >
                        <Plus className="h-4 w-4" />
                    </Button>
                    {spectatorEmails.length > 0 && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() => {
                                setSpectatorEmails(spectatorEmails.slice(0, -1))
                            }}
                            title="Remove Spectator"
                        >
                            <Minus className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>
            {spectatorEmails.length > 0 && (
                <div className="space-y-2">
                    {spectatorEmails.map((email, index) => (
                        <div key={index}>
                            <Label htmlFor={`spectator-${index}`}>Spectator {index + 1} Email</Label>
                            <Input
                                id={`spectator-${index}`}
                                type="email"
                                placeholder={`spectator${index + 1}@example.com`}
                                value={email}
                                onChange={(e) => {
                                    const newEmails = [...spectatorEmails]
                                    newEmails[index] = e.target.value
                                    setSpectatorEmails(newEmails)
                                }}
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
