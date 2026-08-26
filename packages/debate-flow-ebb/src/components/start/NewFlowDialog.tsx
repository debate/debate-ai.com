"use client";

import { useState } from "react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Kbd } from "../ui/kbd";
import type { EventId } from "../../lib/format/events";
import type { Side } from "../../lib/model/types";
import { useFlowStore } from "../../lib/store/useFlowStore";
import { cn } from "../../lib/utils";

import { useCreateFlow } from "./useCreateFlow";

interface Choice {
    key: string;
    label: string;
    event: EventId;
    firstSide?: Side;
}

/**
 * Everything a round needs before it exists. Speaking order is only a question
 * for Public Forum, where the flip decides it; Policy, LD, and Parliamentary
 * fix the first speaker, so asking would be a step with one answer. Every
 * other detail - schools, debaters, tournament - is filled in later from
 * inside the round.
 *
 * Keys are matched against the whole list, so j and k stay free for cursor
 * movement.
 */
const CHOICES: Choice[] = [
    { key: "p", label: "Policy", event: "policy" },
    { key: "l", label: "Lincoln-Douglas", event: "ld" },
    { key: "a", label: "Public Forum, aff first", event: "pf", firstSide: "aff" },
    { key: "n", label: "Public Forum, neg first", event: "pf", firstSide: "neg" },
    { key: "r", label: "Parliamentary", event: "parli" },
];

export default function NewFlowDialog() {
    const open = useFlowStore((s) => s.newFlowOpen);
    const setOpen = useFlowStore((s) => s.setNewFlowOpen);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {/* The cursor lives in the content, which unmounts with the dialog,
                so each opening starts at the top without an effect to reset it. */}
            <DialogContent className="max-w-sm" data-testid="new-flow-dialog">
                <DialogHeader>
                    <DialogTitle>New flow</DialogTitle>
                </DialogHeader>
                <Choices onPick={() => setOpen(false)} />
            </DialogContent>
        </Dialog>
    );
}

function Choices({ onPick }: { onPick: () => void }) {
    const create = useCreateFlow();
    const [cursor, setCursor] = useState(0);

    function choose(choice: Choice) {
        onPick();
        create(choice.event, choice.firstSide);
    }

    function onKeyDown(e: React.KeyboardEvent) {
        if (e.metaKey || e.ctrlKey || e.altKey) return;

        const direct = CHOICES.findIndex((c) => c.key === e.key.toLowerCase());
        if (direct !== -1) {
            e.preventDefault();
            choose(CHOICES[direct]);
            return;
        }
        if (e.key === "ArrowDown" || e.key === "j") {
            e.preventDefault();
            setCursor((c) => (c + 1) % CHOICES.length);
        } else if (e.key === "ArrowUp" || e.key === "k") {
            e.preventDefault();
            setCursor((c) => (c - 1 + CHOICES.length) % CHOICES.length);
        } else if (e.key === "Enter") {
            e.preventDefault();
            choose(CHOICES[cursor]);
        }
    }

    return (
        <div className="font-mono text-sm" onKeyDown={onKeyDown}>
            {CHOICES.map((choice, i) => (
                <button
                    key={choice.key + choice.event}
                    type="button"
                    data-testid={`new-flow-${choice.event}${choice.firstSide ? `-${choice.firstSide}` : ""}`}
                    onMouseEnter={() => setCursor(i)}
                    onFocus={() => setCursor(i)}
                    onClick={() => choose(choice)}
                    className={cn(
                        "flex w-full items-center gap-3 rounded px-2 py-1.5 text-left outline-none",
                        i === cursor ? "bg-accent text-accent-foreground" : "",
                    )}
                >
                    <Kbd>{choice.key}</Kbd>
                    <span>{choice.label}</span>
                </button>
            ))}
        </div>
    );
}
