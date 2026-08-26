/** Filename + download helpers shared by the exporters. */

/** Human date for spreadsheet cells: YYYY-MM-DD (UTC). */
export function isoDate(ts: number): string {
    return new Date(ts).toISOString().slice(0, 10);
}

/** e.g. debate-flow-20260602.xlsx */
export function exportFilename(ts: number, ext: string): string {
    return `debate-flow-${isoDate(ts).replaceAll("-", "")}.${ext}`;
}

export const MIME_BY_EXT: Record<string, string> = {
    ".json": "application/json",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".csv": "text/csv",
};

/** File-picker `types` filter derived from the suggested name's extension. */
function acceptFor(filename: string) {
    const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
    const mime = MIME_BY_EXT[ext];
    return mime ? [{ accept: { [mime]: [ext] } }] : undefined;
}

type SaveFilePicker = (opts: {
    suggestedName?: string;
    types?: { accept: Record<string, string[]> }[];
}) => Promise<FileSystemFileHandle>;

/**
 * Save a Blob to disk. Where the browser supports the File System Access API
 * (Chromium), opens a native "Save As" picker so the user chooses the location;
 * elsewhere falls back to an anchor download into the browser's downloads
 * directory. A cancelled picker is a silent no-op. Must be called from a user
 * gesture so the picker counts as user-activated.
 */
export async function saveBlob(blob: Blob, filename: string): Promise<void> {
    const picker = (window as unknown as { showSaveFilePicker?: SaveFilePicker })
        .showSaveFilePicker;
    if (picker) {
        let handle: FileSystemFileHandle;
        try {
            handle = await picker({ suggestedName: filename, types: acceptFor(filename) });
        } catch (err) {
            if (err instanceof DOMException && err.name === "AbortError") return;
            throw err;
        }
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
