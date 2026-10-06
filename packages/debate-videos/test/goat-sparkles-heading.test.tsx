/**
 * @fileoverview The Greatest of All-Time banner renders its title on the
 * server, before the particle engine has loaded on the client.
 */

import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  GOAT_HEADING_TITLE,
  GoatSparklesHeading,
} from "../src/components/category-gallery/GoatSparklesHeading";

describe("GoatSparklesHeading", () => {
  it("renders the All Time Greatest Legends title as the page heading", () => {
    const html = renderToStaticMarkup(<GoatSparklesHeading />);
    expect(GOAT_HEADING_TITLE).toBe("All Time Greatest Legends");
    expect(html).toMatch(/<h1[^>]*>All Time Greatest Legends<\/h1>/);
  });

  it("shows the trophy-goat icon in the header", () => {
    const html = renderToStaticMarkup(<GoatSparklesHeading />);
    expect(html).toMatch(/<img[^>]*alt="Greatest of All-Time trophy"[^>]*src="data:image\/svg/);
  });
});
