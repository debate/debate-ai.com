/**
 * @fileoverview The next-season poll panel: names the coming season and asks
 * the ranked-choice question, before any of that season's resolutions exist.
 */

import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { NextSeasonPanel, TopicAreasExplorer } from "../src/components/topic-explorer/TopicAreasExplorer";

describe("NextSeasonPanel", () => {
  it("names the season and asks the poll question", () => {
    const html = renderToStaticMarkup(createElement(NextSeasonPanel, { season: 2028 }));
    expect(html).toContain("Next season · 2027–28");
    expect(html).toContain("Resolutions not announced yet");
    expect(html).toContain("Which topic area would you most like to debate next season?");
  });

  it("is not repeated in the topic-areas explorer (it lives on the topics-by-year timeline)", () => {
    expect(renderToStaticMarkup(createElement(TopicAreasExplorer))).not.toContain("Next season ·");
  });
});
