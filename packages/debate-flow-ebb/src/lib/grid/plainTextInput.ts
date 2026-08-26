/** Keep debate shorthand exactly as the debater typed it. */
export function disableTextAssistance(input: HTMLTextAreaElement): void {
    input.setAttribute("autocorrect", "off");
    input.setAttribute("autocapitalize", "off");
    input.setAttribute("autocomplete", "off");
    input.spellcheck = false;
}

/**
 * Seeds a freshly opened cell editor with the text already in the cell and
 * leaves the caret past its end, so the keystroke that opened the editor lands
 * after that text instead of over it. Handsontable opens a fast edit with an
 * empty box and inserts the character itself through the browser's default
 * action, which is why the caret and not the value is what decides where it
 * goes.
 */
export function seedAppend(input: HTMLTextAreaElement, existing: string): void {
    input.value = existing;
    input.setSelectionRange(existing.length, existing.length);
}
