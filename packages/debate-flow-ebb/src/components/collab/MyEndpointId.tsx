"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

import SettingRow from "../settings/SettingRow";
import { Button } from "../ui/button";
import { copyText, selectNode } from "../../lib/clipboard";
import { myEndpointId } from "../../lib/collab/machineName";
import { useCollabStore } from "../../lib/store/useCollabStore";

/**
 * This machine's own EndpointId, so a partner can save it before either of you
 * has a round to share. It is the public half of the identity file, read off
 * the disk rather than off a bound endpoint, so showing it puts nothing on the
 * network.
 */
export default function MyEndpointId() {
    const endpointId = useCollabStore((s) => s.endpointId);
    const text = useRef<HTMLParagraphElement>(null);

    useEffect(() => {
        void myEndpointId().then((id) => {
            if (id) useCollabStore.getState().setEndpointId(id);
        });
    }, []);

    async function copy() {
        if (!endpointId) return;
        if (await copyText(endpointId)) {
            toast.success("Your ID is copied.");
            return;
        }
        selectNode(text.current);
        toast.error("Could not reach the clipboard. Press Cmd+C to copy your ID.");
    }

    return (
        <SettingRow
            title="Your ID"
            description="Send this to a partner and they can add you as a contact to easily share flows. Flows still need to be shared manually."
            control={
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!endpointId}
                    onClick={copy}
                    data-testid="my-id-copy"
                >
                    Copy
                </Button>
            }
        >
            <p
                ref={text}
                data-testid="my-id"
                className="border-border bg-muted/40 text-muted-foreground rounded-md border p-2 font-mono text-[12px] break-all select-all"
            >
                {endpointId ?? "Reading your identity..."}
            </p>
        </SettingRow>
    );
}
