"use client";

import { useEffect, useRef, useState } from "react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import type { Contacts } from "../../lib/collab/contacts";
import type { Role } from "../../lib/collab/types";
import { useContactPicker } from "../../lib/store/useContactPicker";
import { cn } from "../../lib/utils";

/**
 * Who to invite, asked once by the invite commands. Nothing is dialed until a
 * partner is chosen here, and backing out with Escape dials nobody.
 *
 * The grant is not asked here and not remembered anywhere: the menu entry the
 * debater clicked already said edit or view, for this round and no other, so
 * all that is left is which partner. The title carries the grant so the answer
 * to "what am I about to hand over" is on screen at the moment of the click.
 */
export default function ContactPickerDialog() {
    const contacts = useContactPicker((s) => s.contacts);
    const role = useContactPicker((s) => s.role);
    const pick = useContactPicker((s) => s.pick);
    const cancel = useContactPicker((s) => s.cancel);
    const list = useRef<HTMLDivElement>(null);

    // A caller waiting on a picker that goes away with the tree would wait
    // forever, so leaving settles the request as a cancel.
    useEffect(() => cancel, [cancel]);

    return (
        <Dialog
            open={contacts !== null}
            onOpenChange={(open) => {
                if (!open) cancel();
            }}
        >
            {/* The cursor lives in the content, which unmounts with the dialog,
                so each opening starts with no cursor at all and needs no effect
                to reset one. */}
            <DialogContent className="max-w-sm" data-testid="contact-picker" initialFocus={list}>
                <DialogHeader>
                    <DialogTitle>
                        {role === "viewer"
                            ? "Invite a partner to view"
                            : "Invite a partner to edit"}
                    </DialogTitle>
                </DialogHeader>
                {contacts && <Choices ref={list} contacts={contacts} onPick={pick} role={role} />}
            </DialogContent>
        </Dialog>
    );
}

/**
 * The saved partners, one row each.
 *
 * The container takes focus itself so that opening the dialog has somewhere to
 * land that is not a partner: the first tabbable child is otherwise the first
 * row, and whoever is at the top becomes whatever an Enter commits before the
 * debater has chosen anything. The arrow handler sits on that same container
 * because a keydown aimed at the popup never reaches a child's handler, so the
 * element holding focus has to be the element listening. A Tab still walks the
 * rows themselves, which keep their place in the tab order.
 */
function Choices({
    contacts,
    onPick,
    role,
    ref,
}: {
    contacts: Contacts;
    onPick: (endpointId: string) => void;
    role: Role;
    ref: React.Ref<HTMLDivElement>;
}) {
    const entries = Object.entries(contacts);
    /**
     * Which row the keyboard is on, and null until the debater has moved.
     *
     * Nobody is preselected: opening the picker onto a focused row would make
     * whoever happens to be first the peer an Enter admits to the round.
     * Nothing holds focus, so an Enter that arrives before a choice commits
     * nothing and leaves the picker open.
     */
    const [cursor, setCursor] = useState<number | null>(null);
    const stops = useRef<(HTMLButtonElement | null)[]>([]);

    // The arrow keys move focus itself rather than a drawn marker, so Enter and
    // Space activate the row the cursor is on the same way a Tab to it would.
    useEffect(() => {
        if (cursor !== null) stops.current[cursor]?.focus();
    }, [cursor]);

    function onKeyDown(e: React.KeyboardEvent) {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        const count = entries.length;
        if (e.key === "ArrowDown") {
            e.preventDefault();
            // From nowhere, down lands on the first row, which is where a list
            // with no cursor starts rather than where it resumes.
            setCursor((c) => (c === null ? 0 : (c + 1) % count));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setCursor((c) => (c === null ? count - 1 : (c - 1 + count) % count));
        }
    }

    return (
        <div
            ref={ref}
            tabIndex={-1}
            role="group"
            aria-label="Saved partners"
            className="flex flex-col outline-none"
            onKeyDown={onKeyDown}
        >
            {entries.map(([endpointId, contact], row) => (
                <button
                    key={endpointId}
                    ref={(el) => {
                        stops.current[row] = el;
                    }}
                    type="button"
                    data-testid={`contact-pick-${endpointId}`}
                    aria-label={
                        role === "viewer"
                            ? `Invite ${contact.name} to view`
                            : `Invite ${contact.name} to edit`
                    }
                    onMouseEnter={() => setCursor(row)}
                    onFocus={() => setCursor(row)}
                    onClick={() => onPick(endpointId)}
                    className={cn(
                        "flex w-full items-center rounded px-2 py-1.5 text-left text-sm font-medium outline-none",
                        row === cursor ? "bg-accent text-accent-foreground" : "",
                    )}
                >
                    <span className="min-w-0 flex-1 truncate">{contact.name}</span>
                </button>
            ))}
        </div>
    );
}
