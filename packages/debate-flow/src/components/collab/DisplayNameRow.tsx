"use client";

import { useEffect, useState } from "react";

import SettingRow from "../settings/SettingRow";
import { Input } from "../ui/input";
import { machineName } from "../../lib/collab/machineName";
import { useFlowStore } from "../../lib/store/useFlowStore";

/**
 * The name a shared round carries. Left empty, the machine's own name is
 * broadcast, which is why the field shows it as a placeholder rather than
 * filling it in: a hostname written here would be saved to the config file and
 * follow this laptop's name onto every machine that file syncs to.
 */
export default function DisplayNameRow() {
    const collabName = useFlowStore((s) => s.collabName);
    const setCollabName = useFlowStore((s) => s.setCollabName);
    const [host, setHost] = useState("");

    useEffect(() => {
        let live = true;
        void machineName().then((name) => {
            if (live) setHost(name);
        });
        return () => {
            live = false;
        };
    }, []);

    return (
        <SettingRow
            title="Your name"
            description="What a partner sees when you share a round with them. They can rename you on their side."
            control={
                <Input
                    value={collabName}
                    onChange={(e) => setCollabName(e.target.value)}
                    placeholder={host || "This machine"}
                    aria-label="Your name"
                    data-testid="collab-name"
                    className="h-8 w-52"
                />
            }
        />
    );
}
