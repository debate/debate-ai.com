/**
 * @fileoverview Pins the contract of the `Table` and `Textarea` primitives in
 * this package's own `src/ui/primitives`, the two the evidence tables and the
 * card editor render.
 *
 * These are thin wrappers, so what breaks in them is a wiring mistake — a
 * dropped `data-slot`, a lost scroll container, a className that no longer
 * reaches the element — and every one of those renders perfectly fine at the
 * call site while looking wrong on screen.
 */

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "../src/ui/primitives/table";
import { Textarea } from "../src/ui/primitives/textarea";

describe("Table", () => {
  it("renders a full table, each part carrying its own slot hook", () => {
    const html = renderToStaticMarkup(
      <Table>
        <TableCaption>Speaker points</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Debater</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Lovelace</TableCell>
          </TableRow>
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>Total</TableCell>
          </TableRow>
        </TableFooter>
      </Table>,
    );
    for (const slot of [
      "table",
      "table-caption",
      "table-header",
      "table-body",
      "table-footer",
      "table-row",
      "table-head",
      "table-cell",
    ]) {
      expect(html).toContain(`data-slot="${slot}"`);
    }
    expect(html).toContain("<table");
    expect(html).toContain("<thead");
    expect(html).toContain("<tbody");
    expect(html).toContain("Lovelace");
  });

  it("wraps the table so a wide one scrolls inside its own container", () => {
    const html = renderToStaticMarkup(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>x</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(html).toContain("overflow-x-auto");
  });
});

describe("Textarea", () => {
  it("renders a textarea carrying its slot hook", () => {
    const html = renderToStaticMarkup(<Textarea rows={4} defaultValue="notes" />);
    expect(html).toContain('data-slot="textarea"');
    expect(html).toContain('rows="4"');
    expect(html).toContain("notes");
  });

  it("keeps the caller's className alongside the base one", () => {
    expect(renderToStaticMarkup(<Textarea className="min-h-40" />)).toContain("min-h-40");
  });
});
