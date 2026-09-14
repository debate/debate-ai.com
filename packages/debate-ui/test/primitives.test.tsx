/**
 * @fileoverview Renders each shared primitive once and pins the contract the
 * apps around them depend on: the `data-slot` hook their styles and tests
 * select on, the variant classes, and the fact that a caller's own className
 * survives the merge rather than being replaced by the variant's.
 *
 * These are thin wrappers, so what breaks in them is a wiring mistake - a
 * dropped `data-slot`, a variant that stops emitting its class, a className
 * that no longer reaches the element - and every one of those renders
 * perfectly fine at the call site while looking wrong on screen.
 */

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { Badge, badgeVariants } from "../src/primitives/badge";
import { Button, buttonVariants } from "../src/primitives/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../src/primitives/card";
import { Input } from "../src/primitives/input";
import { Label } from "../src/primitives/label";
import { Skeleton } from "../src/primitives/skeleton";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "../src/primitives/table";
import { Textarea } from "../src/primitives/textarea";

describe("Button", () => {
  it("renders a button carrying its slot hook", () => {
    const html = renderToStaticMarkup(<Button>Save</Button>);
    expect(html).toContain("<button");
    expect(html).toContain('data-slot="button"');
    expect(html).toContain("Save");
  });

  it("renders a distinct class list per variant", () => {
    const rendered = (["default", "destructive", "outline", "secondary", "ghost", "link"] as const).map(
      (variant) => renderToStaticMarkup(<Button variant={variant}>x</Button>),
    );
    expect(new Set(rendered).size).toBe(rendered.length);
  });

  it("renders the link variant as underlined rather than filled", () => {
    expect(renderToStaticMarkup(<Button variant="link">x</Button>)).toContain("underline-offset-4");
  });

  it("gives every variant and size a distinct class list", () => {
    const variants = ["default", "destructive", "outline", "secondary", "ghost", "link"] as const;
    const sizes = ["default", "sm", "lg", "icon", "icon-sm", "icon-lg"] as const;
    expect(new Set(variants.map((variant) => buttonVariants({ variant }))).size).toBe(
      variants.length,
    );
    expect(new Set(sizes.map((size) => buttonVariants({ size }))).size).toBe(sizes.length);
  });

  it("falls back to the default variant and size", () => {
    expect(buttonVariants({})).toBe(buttonVariants({ variant: "default", size: "default" }));
  });

  it("keeps the caller's own className alongside the variant's", () => {
    expect(renderToStaticMarkup(<Button className="w-full">x</Button>)).toContain("w-full");
  });

  it("forwards the native button attributes", () => {
    const html = renderToStaticMarkup(
      <Button type="submit" disabled aria-label="Save flow">
        x
      </Button>,
    );
    expect(html).toContain('type="submit"');
    expect(html).toContain("disabled");
    expect(html).toContain('aria-label="Save flow"');
  });

  it("renders as the child element when asked, so a link can be a button", () => {
    const html = renderToStaticMarkup(
      <Button asChild>
        <a href="/flows">Flows</a>
      </Button>,
    );
    expect(html).toContain("<a");
    expect(html).not.toContain("<button");
    expect(html).toContain('href="/flows"');
    expect(html).toContain('data-slot="button"');
  });
});

describe("Badge", () => {
  it("renders a span carrying its slot hook", () => {
    const html = renderToStaticMarkup(<Badge>New</Badge>);
    expect(html).toContain("<span");
    expect(html).toContain('data-slot="badge"');
    expect(html).toContain("New");
  });

  it("gives every variant a distinct class list", () => {
    const variants = ["default", "secondary", "destructive", "outline"] as const;
    expect(new Set(variants.map((variant) => badgeVariants({ variant }))).size).toBe(
      variants.length,
    );
  });

  it("falls back to the default variant", () => {
    expect(badgeVariants({})).toBe(badgeVariants({ variant: "default" }));
  });

  it("keeps the caller's own className", () => {
    expect(renderToStaticMarkup(<Badge className="ml-2">x</Badge>)).toContain("ml-2");
  });

  it("renders as the child element when asked", () => {
    const html = renderToStaticMarkup(
      <Badge asChild>
        <a href="/tags/warming">warming</a>
      </Badge>,
    );
    expect(html).toContain("<a");
    expect(html).toContain('data-slot="badge"');
  });
});

describe("Card", () => {
  it("renders the whole set, each part carrying its own slot hook", () => {
    const html = renderToStaticMarkup(
      <Card>
        <CardHeader>
          <CardTitle>Round 3</CardTitle>
          <CardDescription>Westside vs Eastside</CardDescription>
          <CardAction>
            <Button size="sm">Open</Button>
          </CardAction>
        </CardHeader>
        <CardContent>body</CardContent>
        <CardFooter>footer</CardFooter>
      </Card>,
    );
    for (const slot of [
      "card",
      "card-header",
      "card-title",
      "card-description",
      "card-action",
      "card-content",
      "card-footer",
    ]) {
      expect(html).toContain(`data-slot="${slot}"`);
    }
    expect(html).toContain("Round 3");
    expect(html).toContain("Westside vs Eastside");
  });

  it("keeps the caller's className on each part", () => {
    const html = renderToStaticMarkup(
      <Card className="ring-1">
        <CardContent className="p-0">body</CardContent>
      </Card>,
    );
    expect(html).toContain("ring-1");
    expect(html).toContain("p-0");
  });
});

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

describe("Input, Textarea, Label and Skeleton", () => {
  it("renders an input carrying its slot hook and type", () => {
    const html = renderToStaticMarkup(<Input type="email" placeholder="you@example.com" />);
    expect(html).toContain('data-slot="input"');
    expect(html).toContain('type="email"');
    expect(html).toContain('placeholder="you@example.com"');
  });

  it("renders a textarea carrying its slot hook", () => {
    const html = renderToStaticMarkup(<Textarea rows={4} defaultValue="notes" />);
    expect(html).toContain('data-slot="textarea"');
    expect(html).toContain('rows="4"');
    expect(html).toContain("notes");
  });

  it("renders a label bound to its field", () => {
    const html = renderToStaticMarkup(<Label htmlFor="tournament">Tournament</Label>);
    expect(html).toContain('data-slot="label"');
    expect(html).toContain('for="tournament"');
    expect(html).toContain("Tournament");
  });

  it("renders a pulsing skeleton at the caller's own size", () => {
    const html = renderToStaticMarkup(<Skeleton className="h-4 w-32" />);
    expect(html).toContain("animate-pulse");
    expect(html).toContain("h-4");
    expect(html).toContain("w-32");
  });

  it("keeps each caller's className alongside the base one", () => {
    expect(renderToStaticMarkup(<Input className="border-red-500" />)).toContain("border-red-500");
    expect(renderToStaticMarkup(<Textarea className="min-h-40" />)).toContain("min-h-40");
    expect(renderToStaticMarkup(<Label className="sr-only">x</Label>)).toContain("sr-only");
  });
});
