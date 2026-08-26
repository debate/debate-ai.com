/**
 * Desktop adapter: the narrow Rust commands in `src-tauri/src/flowfile.rs`,
 * plus the dialog and opener plugins for anything that needs a native window.
 *
 * Imports here are static because this module is only ever reached through the
 * runtime-selected adapter import in `flowFs.ts`, so it never loads in a
 * browser and never drags Tauri's JS API into that bundle.
 */

import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";

import type { FlowFs, FlowLocations, FlowSnapshot } from "./flowFs";
import { EBB_EXT } from "./flowPaths";

/** Picker filters. JSON is offered too so legacy exports stay openable. */
const EBB_FILTER = { name: "ebb flow", extensions: ["ebb"] };
const OPEN_FILTERS = [EBB_FILTER, { name: "Flow export", extensions: ["json"] }];

export function createFlowFs(): FlowFs {
    return {
        locations: () => invoke<FlowLocations>("flow_paths"),

        async pickOpenPath() {
            const picked = await open({
                multiple: false,
                directory: false,
                filters: OPEN_FILTERS,
            });
            return typeof picked === "string" ? picked : null;
        },

        async pickDirectory() {
            const picked = await open({ multiple: false, directory: true });
            return typeof picked === "string" ? picked : null;
        },

        async pickSavePath(suggested) {
            const picked = await save({ defaultPath: suggested, filters: [EBB_FILTER] });
            if (!picked) return null;
            // A picker hands back exactly what the user typed, which may have
            // dropped the extension; the file still has to be a .ebb.
            return picked.toLowerCase().endsWith(EBB_EXT) ? picked : picked + EBB_EXT;
        },

        createFlow: (dir, name, text) =>
            invoke<string>("create_flow_file", { dir, name, contents: text }),

        readFlow: (path) => invoke<FlowSnapshot | null>("read_flow_file", { path }),

        writeFlow: (path, text, expectedMtimeMs = null) =>
            invoke<number>("write_flow_file", { path, contents: text, expectedMtimeMs }),

        readRecents: () => invoke<string | null>("read_recents"),

        writeRecents: async (text) => {
            await invoke("write_recents", { contents: text });
        },

        reveal: (path) => revealItemInDir(path),
    };
}
