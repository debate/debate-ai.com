/** @fileoverview Small DOM lookups for the panel render tests. */

/** Every `tag` element under `root` whose trimmed text is exactly `text`. */
export function allByText<T extends Element = HTMLElement>(root: ParentNode, tag: string, text: string): T[] {
  return Array.from(root.querySelectorAll<T>(tag)).filter((el) => el.textContent?.trim() === text);
}

/** The `nth` button labelled `text`; throws (with the panel's text) when missing. */
export function button(root: ParentNode, text: string, nth = 0): HTMLButtonElement {
  const found = allByText<HTMLButtonElement>(root, "button", text)[nth];
  if (!found) throw new Error(`No button "${text}" in: ${(root as Element).textContent}`);
  return found;
}

/** Stubs object URLs and anchor clicks, returning the names of files "downloaded". */
export function captureDownloads(): string[] {
  const names: string[] = [];
  URL.createObjectURL = () => "blob:test";
  URL.revokeObjectURL = () => {};
  HTMLAnchorElement.prototype.click = function click(this: HTMLAnchorElement) {
    names.push(this.download);
  };
  return names;
}

/** Picks `value` in a native `<select>` the way React's change tracking expects. */
export function choose(select: HTMLSelectElement, value: string): void {
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set?.call(select, value);
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

/** A `YYYY-MM-DD` date input value `days` from today. */
export function dateInput(days: number): string {
  const at = new Date(Date.now() + days * 86_400_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}
