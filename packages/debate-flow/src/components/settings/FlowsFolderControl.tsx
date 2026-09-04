"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "../ui/button";
import { errorMessage } from "../../lib/errorMessage";
import { getFlowFs } from "../../lib/persistence/flowFs";
import { displayPath } from "../../lib/persistence/flowPaths";
import { useFlowStore } from "../../lib/store/useFlowStore";

/**
 * Picks the folder new flows are filed in.
 *
 * The resolved path is always shown, default or not, because "where do my
 * rounds go" should never require guessing. Reset clears the override rather
 * than writing the current default in, so a flow folder that follows the
 * platform keeps following it.
 */
export default function FlowsFolderControl() {
    const flowsDir = useFlowStore((s) => s.flowsDir);
    const setFlowsDir = useFlowStore((s) => s.setFlowsDir);
    const [resolved, setResolved] = useState("");
    const [home, setHome] = useState("");

    useEffect(() => {
        let mounted = true;
        void getFlowFs()
            .then((fs) => fs.locations())
            .then(({ flowsDir: fallback, home: h }) => {
                if (!mounted) return;
                setResolved(fallback);
                setHome(h);
            });
        return () => {
            mounted = false;
        };
    }, []);

    async function choose() {
        try {
            const fs = await getFlowFs();
            const dir = await fs.pickDirectory();
            if (dir) setFlowsDir(dir);
        } catch (err) {
            toast.error(errorMessage(err, "Could not choose that folder"));
        }
    }

    const shown = flowsDir ?? resolved;

    return (
        <div className="flex min-w-0 items-center justify-end gap-2">
            <code
                data-testid="flows-folder-path"
                title={shown}
                className="text-muted-foreground max-w-[16rem] truncate font-mono text-xs"
            >
                {shown ? displayPath(shown, home) : "..."}
            </code>
            <Button
                variant="outline"
                size="sm"
                onClick={() => void choose()}
                data-testid="flows-folder-choose"
            >
                Change
            </Button>
            {flowsDir && (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFlowsDir(null)}
                    data-testid="flows-folder-reset"
                >
                    Reset
                </Button>
            )}
        </div>
    );
}
