import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import {
  EmptyState,
  MeterBar,
  PanelRow,
  PanelSection,
  PanelShell,
  Pill,
  StatGrid,
  StatTile,
  SummaryText,
  toneSurfaceClass,
  toneTextClass,
} from "../src/panels/panel-shell";

describe("PanelShell", () => {
  it("renders the title, description and children", () => {
    const html = renderToStaticMarkup(
      <PanelShell title="Topic Coverage" description="Evidence per argument">
        <p>body</p>
      </PanelShell>,
    );
    expect(html).toContain("Topic Coverage");
    expect(html).toContain("Evidence per argument");
    expect(html).toContain("body");
  });

  it("renders header actions and the test id", () => {
    const html = renderToStaticMarkup(
      <PanelShell title="T" actions={<button type="button">Act</button>} data-testid="panel-x" />,
    );
    expect(html).toContain("Act");
    expect(html).toContain('data-testid="panel-x"');
  });
});

describe("StatTile", () => {
  it("renders label, value and hint", () => {
    const html = renderToStaticMarkup(
      <StatGrid columns={2}>
        <StatTile label="Covered" value={3} hint="of 5" tone="positive" />
      </StatGrid>,
    );
    expect(html).toContain("Covered");
    expect(html).toContain(">3<");
    expect(html).toContain("of 5");
  });
});

describe("MeterBar", () => {
  it("fills proportionally and exposes progressbar semantics", () => {
    const html = renderToStaticMarkup(<MeterBar value={1} max={4} label="Cards" />);
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="1"');
    expect(html).toContain('aria-valuemax="4"');
    expect(html).toContain("width:25%");
  });

  it("clamps a value above the max to a full bar", () => {
    const html = renderToStaticMarkup(<MeterBar value={9} max={4} />);
    expect(html).toContain("width:100%");
  });

  it("renders an empty bar when the max is zero", () => {
    const html = renderToStaticMarkup(<MeterBar value={3} max={0} />);
    expect(html).toContain("width:0%");
  });

  it("renders an empty bar for a negative value", () => {
    const html = renderToStaticMarkup(<MeterBar value={-2} max={4} />);
    expect(html).toContain("width:0%");
  });
});

describe("EmptyState / SummaryText / Pill / PanelRow / PanelSection", () => {
  it("renders the empty state title and message", () => {
    const html = renderToStaticMarkup(<EmptyState title="Nothing yet" message="Add one" />);
    expect(html).toContain("Nothing yet");
    expect(html).toContain("Add one");
  });

  it("renders a leading icon and left-aligns the text when one is given", () => {
    const html = renderToStaticMarkup(
      <EmptyState title="Nothing sent yet" icon={<svg data-testid="empty-icon" />} />,
    );
    expect(html).toContain("Nothing sent yet");
    expect(html).toContain('data-testid="empty-icon"');
    expect(html).toContain("text-left");
  });

  it("omits the icon wrapper and centers the text when no icon is given", () => {
    const html = renderToStaticMarkup(<EmptyState title="Nothing yet" />);
    expect(html).toContain("text-center");
    expect(html).not.toContain("text-left");
  });

  it("preserves the summary text verbatim", () => {
    const html = renderToStaticMarkup(<SummaryText label="Summary" text={"line 1\nline 2"} />);
    expect(html).toContain("Summary");
    expect(html).toContain("line 1\nline 2");
  });

  it("renders a pill, a row and a section", () => {
    const html = renderToStaticMarkup(
      <PanelSection title="Standings" description="Ranked">
        <PanelRow leading="#1" title="alice" subtitle="5 cards" trailing={<Pill tone="positive">top</Pill>}>
          <span>extra</span>
        </PanelRow>
      </PanelSection>,
    );
    expect(html).toContain("Standings");
    expect(html).toContain("Ranked");
    expect(html).toContain("#1");
    expect(html).toContain("alice");
    expect(html).toContain("5 cards");
    expect(html).toContain("top");
    expect(html).toContain("extra");
  });
});

describe("tone helpers", () => {
  it("maps every tone to a class", () => {
    for (const tone of ["neutral", "info", "positive", "warning", "critical"] as const) {
      expect(toneTextClass(tone)).toBeTruthy();
      expect(toneSurfaceClass(tone)).toBeTruthy();
    }
  });

  it("defaults to the neutral tone", () => {
    expect(toneTextClass()).toBe(toneTextClass("neutral"));
    expect(toneSurfaceClass()).toBe(toneSurfaceClass("neutral"));
  });
});
