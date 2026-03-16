import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("grab-url", () => {
  return {
    default: vi.fn(),
  };
});

import grab from "grab-url";
import {
  getDatasets,
  scrapeDivision,
} from "../lib/sync-debate-rankings/sync-rankings-debateland";

const grabMock = vi.mocked(grab);

describe("sync-rankings-debateland", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("builds expected dataset URLs", () => {
    const datasets = getDatasets("2024");
    expect(datasets).toHaveLength(2);
    expect(datasets[0].division).toBe("VPF");
    expect(datasets[0].url).toContain("2024-national-varsity-public-forum");
  });

  it("extracts rows and cleans trailing tags", async () => {
    const html = `
      <table>
        <tbody>
          <tr class="group">
            <td>#2 Sample High School TOC Bid</td>
            <td>96</td>
            <td>84%</td>
          </tr>
        </tbody>
      </table>
    `;
    grabMock.mockResolvedValue({ data: html });

    const result = await scrapeDivision({
      division: "VPF",
      url: "https://example",
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      division: "VPF",
      rank: 2,
      teamSchool: "Sample High School",
      values: [96, "84%"],
    });
  });
});
