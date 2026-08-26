/**
 * The two column spaces a padded pane holds at once.
 *
 * A model column indexes a sheet's stored data, and is what the file holds,
 * what an op carries on the wire, what a peer's cursor names, what cell search
 * returns and what the exporter reads. A grid column indexes the Handsontable
 * instance, which on an aligned pane leads with one inert column per speech
 * the sheet does not show.
 *
 * They are branded so the two cannot be mixed without a conversion the
 * compiler demands: a boundary added later is a type error rather than
 * something a reviewer has to notice. The brands erase at runtime, so nothing
 * on the wire or on disk changes shape.
 */

export type ModelCol = number & { readonly __modelCol: unique symbol };
export type GridCol = number & { readonly __gridCol: unique symbol };

/**
 * A number carrying neither brand. The seams take this rather than `number`,
 * so a column already named in one space cannot be relabelled into the other:
 * that relabelling drops the spacer shift, and it is the one way around the
 * conversion the branding exists to force.
 */
type Unbranded = number & {
    readonly __modelCol?: undefined;
    readonly __gridCol?: undefined;
};

/**
 * Names a bare number as a model column. The seam for values that arrive
 * already validated: off the wire, out of a file, or out of a store field.
 */
export function modelCol(n: Unbranded): ModelCol {
    return n as unknown as ModelCol;
}

/**
 * Names a bare number as a grid column. The seam for values Handsontable
 * hands back, whose API is untyped; this is the only place a bare number
 * becomes a grid column, so the casts are greppable.
 */
export function gridCol(n: Unbranded): GridCol {
    return n as unknown as GridCol;
}

/**
 * The cell a grid column points at, or null for a column inside the pad,
 * which stands for a speech the sheet does not hold and so points at no cell
 * of it.
 *
 * Null rather than a clamp: clamping returns 0, which is a real addressable
 * cell, so a caller that forgot to exclude the pad would act on the sheet's
 * first column instead of failing. The one that would have - a spacer's own
 * render asking who is on this cell - would have painted a partner's cursor
 * on the pad and on the first column at once.
 */
export function toModelCol(col: GridCol, spacers: number): ModelCol | null {
    return col < spacers ? null : ((col - spacers) as ModelCol);
}

/** Where a cell sits on a pane carrying `spacers` inert columns. */
export function toGridCol(col: ModelCol, spacers: number): GridCol {
    return (col + spacers) as GridCol;
}
