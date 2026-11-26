/** @vitest-environment jsdom */
/**
 * @fileoverview The chart primitives: per-theme colour variables, the tooltip's
 * label, indicator and value rendering, and the legend, driven through the
 * context `ChartContainer` provides.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { mount, type Mounted } from "./helpers/mount";

vi.mock("recharts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("recharts")>()),
  ResponsiveContainer: ({ children }: { children: unknown }) => <>{children as never}</>,
}));

import {
  ChartContainer,
  ChartLegendContent,
  ChartTooltipContent,
  type ChartConfig,
} from "../src/ui/charts/chart";

let mounted: Mounted | undefined;

afterEach(async () => {
  await mounted?.unmount();
  mounted = undefined;
});

async function render(config: ChartConfig, child: React.ReactElement, id?: string) {
  mounted = await mount(
    <ChartContainer config={config} id={id} className="custom">
      {child}
    </ChartContainer>,
  );
  return mounted.container;
}

const config: ChartConfig = {
  views: { label: "Views", color: "#111111" },
  likes: { label: "Likes", theme: { light: "#aaaaaa", dark: "#bbbbbb" } },
  plain: { label: "Plain" },
};

type TooltipProps = React.ComponentProps<typeof ChartTooltipContent>;
const payloadItem = (overrides: Record<string, unknown> = {}) => ({
  name: "views",
  dataKey: "views",
  value: 1234,
  color: "#123456",
  payload: { fill: "#654321" },
  ...overrides,
});

describe("ChartContainer", () => {
  it("wraps the chart in a slot with a stable id and the caller's class", async () => {
    const container = await render(config, <span>chart</span>, "abc");
    const slot = container.querySelector('[data-slot="chart"]')!;
    expect(slot.getAttribute("data-chart")).toBe("chart-abc");
    expect(slot.className).toContain("custom");
    expect(slot.textContent).toContain("chart");
  });

  it("derives an id when none is given", async () => {
    const container = await render(config, <span />);
    expect(container.querySelector('[data-slot="chart"]')!.getAttribute("data-chart")).toMatch(/^chart-[^:]+$/);
  });

  it("writes each series' colour for the light and dark themes, skipping uncoloured ones", async () => {
    const container = await render(config, <span />, "abc");
    const css = container.querySelector("style")!.innerHTML;
    expect(css).toContain("[data-chart=chart-abc]");
    expect(css).toContain("--color-views: #111111;");
    expect(css).toContain("--color-likes: #aaaaaa;");
    expect(css).toContain(".dark [data-chart=chart-abc]");
    expect(css).toContain("--color-likes: #bbbbbb;");
    expect(css).not.toContain("--color-plain");
  });

  it("emits no style element when no series has a colour", async () => {
    const container = await render({ plain: { label: "Plain" } }, <span />);
    expect(container.querySelector("style")).toBeNull();
  });
});

describe("ChartTooltipContent", () => {
  const tooltip = (props: Partial<TooltipProps>) => <ChartTooltipContent {...(props as TooltipProps)} />;

  it("renders nothing while inactive or without a payload", async () => {
    let container = await render(config, tooltip({ active: false, payload: [payloadItem()] as never }));
    expect(container.querySelector(".shadow-xl")).toBeNull();
    await mounted!.unmount();
    container = await render(config, tooltip({ active: true, payload: [] }));
    expect(container.querySelector(".shadow-xl")).toBeNull();
  });

  it("labels each series from the config and formats numeric values", async () => {
    const container = await render(
      config,
      tooltip({ active: true, payload: [payloadItem(), payloadItem({ name: "likes", dataKey: "likes", value: 5000 })] as never }),
    );
    const text = container.querySelector(".shadow-xl")!.textContent!;
    expect(text).toContain("Views");
    expect(text).toContain("Likes");
    expect(text).toContain("1.2k");
  });

  it("shows the indicator in the item's fill colour, or a forced colour", async () => {
    let container = await render(config, tooltip({ active: true, payload: [payloadItem()] as never }));
    expect((container.querySelector(".shrink-0") as HTMLElement).style.getPropertyValue("--color-bg")).toBe("#654321");
    await mounted!.unmount();
    container = await render(config, tooltip({ active: true, color: "#ff0000", payload: [payloadItem()] as never }));
    expect((container.querySelector(".shrink-0") as HTMLElement).style.getPropertyValue("--color-bg")).toBe("#ff0000");
  });

  it("can hide the indicator and the label", async () => {
    const container = await render(
      config,
      tooltip({
        active: true,
        hideIndicator: true,
        hideLabel: true,
        label: "views",
        payload: [payloadItem()] as never,
      }),
    );
    expect(container.querySelector(".shrink-0")).toBeNull();
    expect(container.querySelector(".font-medium:not(.font-mono)")).toBeNull();
  });

  it("uses the config label for a string label, else the label itself", async () => {
    let container = await render(config, tooltip({ active: true, label: "likes", payload: [payloadItem()] as never }));
    expect(container.querySelector(".font-medium")!.textContent).toBe("Likes");
    await mounted!.unmount();
    container = await render(config, tooltip({ active: true, label: "Round 1", payload: [payloadItem()] as never }));
    expect(container.querySelector(".font-medium")!.textContent).toBe("Round 1");
  });

  it("hands the value and payload to a label formatter", async () => {
    const labelFormatter = vi.fn(() => "Formatted label");
    const payload = [payloadItem()] as never;
    const container = await render(config, tooltip({ active: true, label: "views", labelFormatter, payload }));
    expect(container.textContent).toContain("Formatted label");
    expect(labelFormatter).toHaveBeenCalledWith("Views", payload);
  });

  it("omits the label when there is nothing to call it", async () => {
    const container = await render(
      config,
      tooltip({ active: true, payload: [payloadItem({ name: "other", dataKey: "other" })] as never }),
    );
    expect(container.querySelector(".grid.min-w-\\[8rem\\] > .font-medium")).toBeNull();
  });

  it("nests the label inside the row for a single line or dashed indicator", async () => {
    const container = await render(
      config,
      tooltip({ active: true, indicator: "line", label: "likes", payload: [payloadItem()] as never }),
    );
    expect(container.querySelector(".grid.min-w-\\[8rem\\] > .font-medium")).toBeNull();
    expect(container.querySelector(".items-end .font-medium")!.textContent).toBe("Likes");
    expect(container.querySelector(".shrink-0")!.className).toContain("w-1");
  });

  it("styles the dashed indicator", async () => {
    const container = await render(
      config,
      tooltip({ active: true, indicator: "dashed", payload: [payloadItem()] as never }),
    );
    expect(container.querySelector(".shrink-0")!.className).toContain("border-dashed");
  });

  it("prefers a custom formatter for items with a name and value", async () => {
    const formatter = vi.fn((value: unknown) => <span data-testid="custom">custom {String(value)}</span>);
    const container = await render(
      config,
      tooltip({ active: true, formatter: formatter as never, payload: [payloadItem()] as never }),
    );
    expect(container.querySelector('[data-testid="custom"]')!.textContent).toBe("custom 1234");
    expect(formatter).toHaveBeenCalledWith(1234, "views", expect.anything(), 0, { fill: "#654321" });
  });

  it("renders a series icon from the config instead of an indicator", async () => {
    const Icon = () => <svg data-testid="icon" />;
    const container = await render(
      { views: { label: "Views", icon: Icon } },
      tooltip({ active: true, payload: [payloadItem()] as never }),
    );
    expect(container.querySelector('[data-testid="icon"]')).not.toBeNull();
    expect(container.querySelector(".shrink-0")).toBeNull();
  });

  it("skips items marked as not shown, and prints string values as-is", async () => {
    const container = await render(
      config,
      tooltip({
        active: true,
        payload: [
          payloadItem({ name: "hidden", dataKey: "hidden", type: "none" }),
          payloadItem({ name: "plain", dataKey: "plain", value: "n/a" }),
        ] as never,
      }),
    );
    expect(container.textContent).not.toContain("hidden");
    expect(container.textContent).toContain("Plain");
    expect(container.textContent).toContain("n/a");
  });

  it("resolves the label through nameKey and labelKey", async () => {
    const container = await render(
      config,
      tooltip({
        active: true,
        nameKey: "series",
        labelKey: "series",
        payload: [payloadItem({ name: "x", series: "likes", payload: { series: "likes", fill: "#000" } })] as never,
      }),
    );
    expect(container.textContent).toContain("Likes");
  });

  it("reads a series name from the nested payload", async () => {
    const container = await render(
      config,
      tooltip({
        active: true,
        nameKey: "series",
        payload: [payloadItem({ name: "x", payload: { series: "likes", fill: "#000" } })] as never,
      }),
    );
    expect(container.textContent).toContain("Likes");
  });
});

describe("ChartLegendContent", () => {
  const legend = (props: Record<string, unknown>) => <ChartLegendContent {...(props as React.ComponentProps<typeof ChartLegendContent>)} />;
  const items = [
    { value: "views", dataKey: "views", color: "#111111", type: "line" },
    { value: "likes", dataKey: "likes", color: "#222222", type: "line" },
    { value: "hidden", dataKey: "hidden", color: "#333333", type: "none" },
  ];

  it("renders nothing without items", async () => {
    const container = await render(config, legend({ payload: [] }));
    expect(container.querySelector(".justify-center.gap-4")).toBeNull();
  });

  it("lists each shown series with its colour swatch and configured label", async () => {
    const container = await render(config, legend({ payload: items }));
    const text = container.querySelector(".justify-center.gap-4")!.textContent;
    expect(text).toBe("ViewsLikes");
    const swatches = container.querySelectorAll<HTMLElement>(".h-2.w-2");
    expect(swatches).toHaveLength(2);
    expect(swatches[0].style.backgroundColor).toBe("rgb(17, 17, 17)");
  });

  it("pads below or above depending on where the legend sits", async () => {
    let container = await render(config, legend({ payload: items }));
    expect(container.querySelector(".justify-center.gap-4")!.className).toContain("pt-3");
    await mounted!.unmount();
    container = await render(config, legend({ payload: items, verticalAlign: "top" }));
    expect(container.querySelector(".justify-center.gap-4")!.className).toContain("pb-3");
  });

  it("shows a configured icon unless icons are hidden", async () => {
    const Icon = () => <svg data-testid="icon" />;
    const iconConfig: ChartConfig = { views: { label: "Views", icon: Icon }, likes: { label: "Likes" } };
    let container = await render(iconConfig, legend({ payload: items }));
    expect(container.querySelectorAll('[data-testid="icon"]')).toHaveLength(1);
    await mounted!.unmount();
    container = await render(iconConfig, legend({ payload: items, hideIcon: true }));
    expect(container.querySelectorAll('[data-testid="icon"]')).toHaveLength(0);
    expect(container.querySelectorAll(".h-2.w-2")).toHaveLength(2);
  });

  it("looks series up by nameKey when given", async () => {
    const container = await render(
      config,
      legend({ nameKey: "series", payload: [{ value: "a", dataKey: "series", color: "#000", series: "likes" }] }),
    );
    expect(container.querySelector(".justify-center.gap-4")!.textContent).toBe("Likes");
  });
});

describe("ChartTooltipContent outside a container", () => {
  it("refuses to render without the chart context", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      mount(<ChartTooltipContent {...({ active: true, payload: [] } as unknown as TooltipProps)} />),
    ).rejects.toThrow("useChart must be used within a <ChartContainer />");
    error.mockRestore();
  });
});
