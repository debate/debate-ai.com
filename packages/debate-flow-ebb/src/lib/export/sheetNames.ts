/**
 * Coerce a flow-sheet title into a legal, unique Excel tab name. Excel rejects
 * the characters : \ / ? * [ ], caps names at 31 chars, and requires names to
 * be unique case-insensitively across the workbook - any violation triggers the
 * "Worksheet properties" repair dialog. `used` holds the lowercased names already
 * taken; the chosen name is added to it so callers stay collision-free.
 */
export function safeSheetName(title: string, used: Set<string>): string {
    let base = (title ?? "")
        .replace(/[:\\/?*\[\]]/g, " ")
        .replace(/\s+/g, " ")
        .replace(/^'+|'+$/g, "")
        .trim();
    if (!base) base = "Sheet";
    if (base.length > 31) base = base.slice(0, 31).trim();

    let name = base;
    let n = 2;
    while (used.has(name.toLowerCase())) {
        const suffix = ` (${n})`;
        name = base.slice(0, 31 - suffix.length).trim() + suffix;
        n++;
    }
    used.add(name.toLowerCase());
    return name;
}
