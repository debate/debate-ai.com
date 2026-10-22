/** @fileoverview Lookups for panel render tests, by the text a user sees. */

/** The first `tag` element whose trimmed text is exactly `text`. */
export function byText<T extends HTMLElement = HTMLElement>(root: ParentNode, tag: string, text: string): T | null {
  return (Array.from(root.querySelectorAll(tag)).find((el) => el.textContent?.trim() === text) as T | undefined) ?? null;
}

/** Every button whose trimmed text is exactly `text`. */
export function buttons(root: ParentNode, text: string): HTMLButtonElement[] {
  return Array.from(root.querySelectorAll("button")).filter((el) => el.textContent?.trim() === text);
}

/** The one button with this text; throws when there's none, so a test fails at the lookup. */
export function button(root: ParentNode, text: string): HTMLButtonElement {
  const found = byText<HTMLButtonElement>(root, "button", text);
  if (!found) throw new Error(`No button "${text}" in: ${root.textContent?.slice(0, 300)}`);
  return found;
}

/** Stubs the Blob + anchor download every export button uses; returns the downloaded file names. */
export function captureDownloads(): string[] {
  const names: string[] = [];
  URL.createObjectURL = () => "blob:test";
  URL.revokeObjectURL = () => {};
  HTMLAnchorElement.prototype.click = function click(this: HTMLAnchorElement) {
    names.push(this.download);
  };
  return names;
}
