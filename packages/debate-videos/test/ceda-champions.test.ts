import { describe, expect, it } from "vitest";
import {
  CEDA_CHAMPIONS,
  cedaTitlesBySchool,
  findCedaSchoolTitles,
} from "@debate-ai/rankings-adapter/src/sync/ceda-champions";

describe("CEDA national champions", () => {
  it("lists one champion per year from 1986, with 2020 canceled", () => {
    const years = CEDA_CHAMPIONS.map((c) => c.year);
    expect(new Set(years).size).toBe(years.length);
    expect(years).not.toContain(2020);
    expect(Math.min(...years)).toBe(1986);
  });

  it("groups titles by school, oldest first", () => {
    const oklahoma = cedaTitlesBySchool().find((s) => s.school === "University of Oklahoma");
    expect(oklahoma?.titles.map((t) => t.year)).toEqual([2007, 2009, 2010, 2012, 2019]);
  });

  it("matches ranking and NDT spellings of a school", () => {
    expect(findCedaSchoolTitles("Oklahoma")?.titles).toHaveLength(5);
    expect(findCedaSchoolTitles("Towson University (MD)")?.school).toBe("Towson University");
    expect(findCedaSchoolTitles("State University of New York - Binghamton")?.titles[0].team).toBe(
      "Eli T. Louis & Akif Choudhury",
    );
    expect(findCedaSchoolTitles("University of Texas - Austin")?.school).toBe("University of Texas");
    expect(findCedaSchoolTitles("Kansas")?.titles[0].year).toBe(2026);
  });

  it("never credits a different school that shares words", () => {
    expect(findCedaSchoolTitles("Texas State")).toBeNull();
    expect(findCedaSchoolTitles("Oklahoma State")).toBeNull();
    expect(findCedaSchoolTitles("Michigan")).toBeNull();
    expect(findCedaSchoolTitles("University of Texas - Dallas")).toBeNull();
    expect(findCedaSchoolTitles("University of Northwestern (MN)")).toBeNull();
    expect(findCedaSchoolTitles("Kansas City Kansas Community College")).toBeNull();
  });
});
