"use client";

import { useState } from "react";

import SettingRow from "../settings/SettingRow";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { addContact, type Contacts, isEndpointId, removeContact } from "../../lib/collab/contacts";
import { useFlowStore } from "../../lib/store/useFlowStore";

/** An EndpointId is a long key; a row shows the first eight characters. */
const SHORT_ID = 8;

/**
 * The saved peers, edited in place, and the form that adds one.
 *
 * Two partners on the way to a tournament have no round to share yet, so a
 * contact is not only something a finished session leaves behind: each of them
 * sends the other the ID above and types it in here. The pair is then dialable
 * with no ticket for every round after.
 *
 * A row is a name and a key and nothing else. What a partner may do belongs to
 * the round they are invited to and is chosen at the invitation, so there is
 * nothing to grade here.
 */
export default function ContactList() {
    const contacts = useFlowStore((s) => s.contacts);
    const setContacts = useFlowStore((s) => s.setContacts);

    // Insertion order, so a rename never moves the row out from under the
    // cursor typing it.
    const entries = Object.entries(contacts);

    return (
        <SettingRow
            title="Contacts"
            description="Peers you have shared with. Inviting one adds them by name."
        >
            {entries.length === 0 ? (
                <p className="text-muted-foreground text-[12px]" data-testid="contact-list-empty">
                    No partners saved yet. Add one below, or save one after a shared flow session.
                </p>
            ) : (
                <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                    {entries.map(([endpointId, contact]) => {
                        const short = endpointId.slice(0, SHORT_ID);
                        const shown = contact.name.trim() === "" ? short : contact.name;
                        return (
                            <li
                                key={endpointId}
                                data-testid={`contact-row-${endpointId}`}
                                className="flex items-center gap-2"
                            >
                                <Input
                                    value={contact.name}
                                    onChange={(e) =>
                                        setContacts(
                                            addContact(contacts, endpointId, {
                                                ...contact,
                                                name: e.target.value,
                                            }),
                                        )
                                    }
                                    // A nameless entry is unreadable to the config
                                    // parser, so an emptied field falls back to the
                                    // short id rather than losing the peer.
                                    onBlur={() => {
                                        if (contact.name.trim() !== "") return;
                                        setContacts(
                                            addContact(contacts, endpointId, {
                                                ...contact,
                                                name: short,
                                            }),
                                        );
                                    }}
                                    aria-label={`Name for ${shown}`}
                                    data-testid={`contact-name-${endpointId}`}
                                    className="h-8 min-w-0 flex-1"
                                />
                                <span
                                    title={endpointId}
                                    className="text-muted-foreground shrink-0 font-mono text-[11px]"
                                >
                                    {short}
                                </span>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="xs"
                                    aria-label={`Remove ${shown}`}
                                    data-testid={`contact-remove-${endpointId}`}
                                    onClick={() => setContacts(removeContact(contacts, endpointId))}
                                >
                                    Remove
                                </Button>
                            </li>
                        );
                    })}
                </ul>
            )}
            <AddContact contacts={contacts} onAdd={setContacts} />
        </SettingRow>
    );
}

/**
 * Adds a partner from the ID they sent. The shape is checked here so a typo is
 * caught at the form rather than at a dial that fails with nothing to point
 * at; whether the key is real is still the transport's answer.
 */
function AddContact({
    contacts,
    onAdd,
}: {
    contacts: Contacts;
    onAdd: (contacts: Contacts) => void;
}) {
    const [endpointId, setEndpointId] = useState("");
    const [name, setName] = useState("");
    const id = endpointId.trim();
    const known = id in contacts;
    const shaped = isEndpointId(id);
    const ready = shaped && !known && name.trim() !== "";

    function add() {
        if (!ready) return;
        onAdd(addContact(contacts, id, { name: name.trim() }));
        setEndpointId("");
        setName("");
    }

    return (
        <div className="mt-3 flex flex-col gap-1.5" data-testid="add-contact">
            <div className="flex items-center gap-2">
                <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") add();
                    }}
                    placeholder="Name"
                    aria-label="Partner name"
                    data-testid="add-contact-name"
                    className="h-8 w-32 shrink-0"
                />
                <Input
                    value={endpointId}
                    onChange={(e) => setEndpointId(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") add();
                    }}
                    placeholder="Their ID"
                    aria-label="Partner ID"
                    data-testid="add-contact-id"
                    className="h-8 min-w-0 flex-1 font-mono text-[12px]"
                />
                <Button
                    type="button"
                    size="xs"
                    disabled={!ready}
                    onClick={add}
                    data-testid="add-contact-save"
                >
                    Add
                </Button>
            </div>
            {id !== "" && !shaped && (
                <p className="text-destructive text-[11px]" data-testid="add-contact-error">
                    That is not an ID. Ask them for the one under Your ID in their settings.
                </p>
            )}
            {known && (
                <p className="text-muted-foreground text-[11px]" data-testid="add-contact-known">
                    {contacts[id]?.name} is already saved under that ID.
                </p>
            )}
        </div>
    );
}
