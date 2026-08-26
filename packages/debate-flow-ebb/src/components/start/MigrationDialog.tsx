"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { errorMessage } from "../../lib/errorMessage";
import { getFlowFs } from "../../lib/persistence/flowFs";
import { resolveFlowsDir } from "../../lib/persistence/flowsDir";
import {
    countLegacyFlows,
    markMigrationSettled,
    migrateFromIndexedDb,
} from "../../lib/persistence/migrateIdb";
import { useFlowStore } from "../../lib/store/useFlowStore";

interface Props {
    /** Called after a successful move so the recents list picks the flows up. */
    onMigrated: () => void;
}

/**
 * Asks before moving rounds out of the old browser database.
 *
 * The move is never automatic. Where a user's rounds live is now something they
 * can see and change, so writing a folder full of files on their behalf - into
 * a location they were never shown - is not a decision to make for them. The
 * prompt returns each launch until they either move the rounds or nothing is
 * left to move, because the alternative is data quietly stranded in storage the
 * app no longer reads.
 */
export default function MigrationDialog({ onMigrated }: Props) {
    const flowsDir = useFlowStore((s) => s.flowsDir);
    const setFlowsDir = useFlowStore((s) => s.setFlowsDir);
    const [count, setCount] = useState(0);
    const [defaultDir, setDefaultDir] = useState("");
    const [busy, setBusy] = useState(false);

    // The configured folder wins, including one picked from this prompt, which
    // writes the setting rather than a copy of it.
    const target = flowsDir ?? defaultDir;

    useEffect(() => {
        let mounted = true;
        void (async () => {
            const found = await countLegacyFlows();
            if (!found) {
                // Nothing to move: settle it so no later launch even looks.
                markMigrationSettled();
                return;
            }
            const dir = await resolveFlowsDir(await getFlowFs());
            if (mounted) {
                setCount(found);
                setDefaultDir(dir);
            }
        })();
        return () => {
            mounted = false;
        };
    }, []);

    async function chooseFolder() {
        try {
            const fs = await getFlowFs();
            const dir = await fs.pickDirectory();
            if (dir) setFlowsDir(dir);
        } catch (err) {
            toast.error(errorMessage(err, "Could not choose that folder"));
        }
    }

    async function move() {
        setBusy(true);
        try {
            const report = await migrateFromIndexedDb(target, await getFlowFs());
            if (report) {
                const noun = report.moved === 1 ? "flow" : "flows";
                toast.success(`Moved ${report.moved} ${noun} to ${report.flowsDir}`);
            }
            setCount(0);
            onMigrated();
        } catch (err) {
            toast.error(errorMessage(err, "Could not move your flows"));
        } finally {
            setBusy(false);
        }
    }

    const noun = count === 1 ? "flow" : "flows";

    return (
        <Dialog open={count > 0} onOpenChange={(next) => !next && setCount(0)}>
            <DialogContent className="max-w-md" data-testid="migration-dialog">
                <DialogHeader>
                    <DialogTitle>
                        Move {count} {noun} into files?
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 text-sm">
                    <p className="text-muted-foreground">
                        Ebb now keeps each flow as a <code>.ebb</code> file you own. Your {count}{" "}
                        existing {noun} can be moved out of the old browser storage into a folder of
                        your choosing. Nothing is deleted until every file has been written and read
                        back.
                    </p>
                    <div className="flex items-center gap-2">
                        <code
                            data-testid="migration-target"
                            className="bg-muted min-w-0 flex-1 truncate rounded px-2 py-1.5 font-mono text-xs"
                        >
                            {target}
                        </code>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void chooseFolder()}
                            data-testid="migration-choose-folder"
                        >
                            Change
                        </Button>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setCount(0)}
                            data-testid="migration-later"
                        >
                            Not now
                        </Button>
                        <Button
                            size="sm"
                            disabled={busy || !target}
                            onClick={() => void move()}
                            data-testid="migration-move"
                        >
                            {busy ? "Moving..." : `Move ${noun}`}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
