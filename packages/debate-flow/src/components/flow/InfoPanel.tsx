"use client";

import { X } from "@phosphor-icons/react";
import { useState } from "react";

import { Dialog, DialogClose, DialogContent, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Tip } from "../ui/tooltip";
import { sideLabels } from "../../lib/format/events";
import { parsePairing, type PairingPatch } from "../../lib/model/parsePairing";
import { teamCode } from "../../lib/model/teamCode";
import type { Scouting } from "../../lib/model/types";
import { useFlowStore } from "../../lib/store/useFlowStore";
import { cn } from "../../lib/utils";

/** Deep-merges a parsed pairing into scouting so a parsed aff never wipes an existing neg debater. */
function applyPairing(sc: Scouting, patch: PairingPatch): Partial<Scouting> {
    const out: Partial<Scouting> = {};
    if (patch.round !== undefined) out.round = patch.round;
    if (patch.affSchool !== undefined) out.affSchool = patch.affSchool;
    if (patch.negSchool !== undefined) out.negSchool = patch.negSchool;
    if (patch.judge !== undefined) out.judge = patch.judge;
    if (patch.aff) out.aff = { ...sc.aff, ...patch.aff };
    if (patch.neg) out.neg = { ...sc.neg, ...patch.neg };
    return out;
}

/** True when the sheet already holds details a pasted pairing would overwrite. */
function hasScoutingInfo(sc: Scouting): boolean {
    const named = [sc.aff.first, sc.aff.second, sc.neg.first, sc.neg.second].some(
        (d) => d.first.trim() || d.last.trim(),
    );
    const filled = [sc.affSchool, sc.negSchool, sc.tournament, sc.round, sc.date, sc.judge].some(
        (f) => (f ?? "").trim().length > 0,
    );
    return named || filled || Boolean(sc.decision?.vote || sc.decision?.rfd?.trim());
}

export default function InfoPanel() {
    const open = useFlowStore((s) => s.infoOpen);
    if (!open) return null;
    return <InfoPanelInner />;
}

function InfoPanelInner() {
    const open = useFlowStore((s) => s.infoOpen);
    const round = useFlowStore((s) => s.round);
    const setInfoOpen = useFlowStore((s) => s.setInfoOpen);
    const setScouting = useFlowStore((s) => s.setScouting);
    // A parsed pairing awaiting confirmation before it overwrites existing details.
    const [pending, setPending] = useState<PairingPatch | null>(null);

    if (!round) return null;
    const sc = round.scouting;
    const sides = sideLabels(round.event);

    const affCode = teamCode(sc.affSchool ?? "", sc.aff.first, sc.aff.second);
    const negCode = teamCode(sc.negSchool ?? "", sc.neg.first, sc.neg.second);

    return (
        <Dialog
            open={open}
            onOpenChange={(o) => {
                if (!o) setInfoOpen(false);
            }}
        >
            <DialogContent
                showCloseButton={false}
                aria-label="Round info"
                data-testid="info-panel"
                className="gap-0 overflow-hidden p-0 sm:max-w-[640px]"
            >
                <div className="border-border flex items-center justify-between border-b px-3.5 py-3">
                    <DialogTitle className="text-foreground text-[13px] font-semibold tracking-wide">
                        Round Info
                    </DialogTitle>
                    <Tip label="Close" hoverOnly>
                        <DialogClose
                            aria-label="Close info"
                            data-testid="info-close"
                            className="text-muted-foreground hover:text-foreground rounded transition-colors focus-visible:outline-2"
                        >
                            <X className="size-4" />
                        </DialogClose>
                    </Tip>
                </div>

                <div className="max-h-[78vh] overflow-y-auto">
                    <div className="border-border border-b p-4">
                        <textarea
                            data-testid="scout-paste"
                            placeholder="Paste a Tabroom pairing to autofill"
                            rows={2}
                            className="border-input placeholder:text-muted-foreground focus-visible:border-ring w-full resize-y rounded-md border bg-transparent px-3 py-2 text-[13px] transition-[color,box-shadow] outline-none"
                            onPaste={(e) => {
                                const patch = parsePairing(e.clipboardData.getData("text"));
                                if (Object.keys(patch).length === 0) return;
                                // Confirm before overwriting details already on the sheet.
                                if (hasScoutingInfo(sc)) setPending(patch);
                                else setScouting(applyPairing(sc, patch));
                            }}
                        />
                        {pending && (
                            <div className="border-border bg-accent/40 mt-2 flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-[12px]">
                                <span className="text-muted-foreground">
                                    Replace the current round info with this pairing?
                                </span>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        data-testid="scout-paste-cancel"
                                        onClick={() => setPending(null)}
                                        className="text-muted-foreground hover:text-foreground rounded px-2 py-1"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        data-testid="scout-paste-confirm"
                                        onClick={() => {
                                            setScouting(applyPairing(sc, pending));
                                            setPending(null);
                                        }}
                                        className="border-input hover:bg-accent rounded-md border px-2 py-1 font-medium"
                                    >
                                        Replace
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 p-4">
                        <div className="flex flex-col gap-2">
                            <div className="text-aff font-mono text-[9px] font-bold tracking-widest uppercase">
                                {sides.aff.label} — {affCode || "—"}
                            </div>
                            <Input
                                data-testid="scout-affSchool"
                                placeholder={`${sides.aff.label} school`}
                                value={sc.affSchool ?? ""}
                                onChange={(e) => setScouting({ affSchool: e.target.value })}
                            />
                            <DebaterRow
                                label={sides.aff.speakers[0]}
                                value={sc.aff.first}
                                onChange={(d) =>
                                    setScouting({
                                        aff: { ...sc.aff, first: d },
                                    })
                                }
                                testid="scout-aff-1a"
                            />
                            <DebaterRow
                                label={sides.aff.speakers[1]}
                                value={sc.aff.second}
                                onChange={(d) =>
                                    setScouting({
                                        aff: { ...sc.aff, second: d },
                                    })
                                }
                                testid="scout-aff-2a"
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <div className="text-neg font-mono text-[9px] font-bold tracking-widest uppercase">
                                {sides.neg.label} — {negCode || "—"}
                            </div>
                            <Input
                                data-testid="scout-negSchool"
                                placeholder={`${sides.neg.label} school`}
                                value={sc.negSchool ?? ""}
                                onChange={(e) => setScouting({ negSchool: e.target.value })}
                            />
                            <DebaterRow
                                label={sides.neg.speakers[0]}
                                value={sc.neg.first}
                                onChange={(d) =>
                                    setScouting({
                                        neg: { ...sc.neg, first: d },
                                    })
                                }
                                testid="scout-neg-1n"
                            />
                            <DebaterRow
                                label={sides.neg.speakers[1]}
                                value={sc.neg.second}
                                onChange={(d) =>
                                    setScouting({
                                        neg: { ...sc.neg, second: d },
                                    })
                                }
                                testid="scout-neg-2n"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 px-4 pb-3">
                        <Input
                            data-testid="scout-tournament"
                            placeholder="Tournament"
                            value={sc.tournament ?? ""}
                            onChange={(e) => setScouting({ tournament: e.target.value })}
                        />
                        <div className="flex gap-3">
                            <Input
                                data-testid="scout-round"
                                placeholder="Round"
                                value={sc.round ?? ""}
                                onChange={(e) => setScouting({ round: e.target.value })}
                            />
                            <Input
                                data-testid="scout-flight"
                                placeholder="Flight"
                                value={sc.flight ?? ""}
                                onChange={(e) => setScouting({ flight: e.target.value })}
                            />
                        </div>
                        <Input
                            type="date"
                            aria-label="Date"
                            data-testid="scout-date"
                            value={sc.date ?? ""}
                            onChange={(e) => setScouting({ date: e.target.value || undefined })}
                        />
                        <Input
                            data-testid="scout-judge"
                            placeholder="Judge"
                            value={sc.judge ?? ""}
                            onChange={(e) => setScouting({ judge: e.target.value })}
                        />
                    </div>

                    <div className="flex flex-col gap-2 px-4 pb-4">
                        <div className="text-muted-foreground font-mono text-[9px] font-bold tracking-widest uppercase">
                            Decision
                        </div>
                        <div className="flex gap-2 text-[13px]" role="group" aria-label="Vote">
                            {(["aff", "neg"] as const).map((side) => {
                                const selected = sc.decision?.vote === side;
                                return (
                                    <button
                                        key={side}
                                        type="button"
                                        data-testid={`scout-vote-${side}`}
                                        aria-pressed={selected}
                                        onClick={() =>
                                            setScouting({
                                                decision: {
                                                    ...sc.decision,
                                                    // Click the selected side again to clear back to undecided.
                                                    vote: selected ? undefined : side,
                                                },
                                            })
                                        }
                                        className={cn(
                                            "rounded-md border px-3 py-1 font-medium transition-colors",
                                            selected && side === "aff"
                                                ? "border-aff bg-aff/10 text-aff"
                                                : selected && side === "neg"
                                                  ? "border-neg bg-neg/10 text-neg"
                                                  : "border-input text-muted-foreground hover:bg-accent/50",
                                        )}
                                    >
                                        {sides[side].label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function DebaterRow({
    label,
    value,
    onChange,
    testid,
}: {
    label: string;
    value: { first: string; last: string };
    onChange: (d: { first: string; last: string }) => void;
    testid: string;
}) {
    return (
        <div className="flex items-center gap-2">
            <span className="text-muted-foreground w-7 text-[11px]">{label}</span>
            <Input
                data-testid={`${testid}-first`}
                placeholder="First"
                value={value.first}
                onChange={(e) => onChange({ ...value, first: e.target.value })}
            />
            <Input
                data-testid={`${testid}-last`}
                placeholder="Last"
                value={value.last}
                onChange={(e) => onChange({ ...value, last: e.target.value })}
            />
        </div>
    );
}
