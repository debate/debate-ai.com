/**
 * @fileoverview The lecture classifier files a video on a shelf from its
 * title, description and channel. The order of its rules matters (format
 * collections beat skill shelves, skills beat the catch-all), so each shelf is
 * pinned with a title that lands there and not on an earlier one.
 */

import { describe, expect, it } from "vitest"
import {
  LECTURE_CATEGORIES,
  NSDA_LECTURE_CATEGORY,
  classifyLecture,
  classifyRoundCollection,
  isLectureCategory,
  isNsdaChannel,
  lectureCategoryForChannel,
} from "../src/data/lecture-classifier"

describe("isLectureCategory", () => {
  it("accepts every classifier category and nothing else", () => {
    for (const category of LECTURE_CATEGORIES) expect(isLectureCategory(category)).toBe(true)
    expect(isLectureCategory("Made Up Shelf")).toBe(false)
    expect(isLectureCategory(7)).toBe(false)
    expect(isLectureCategory(null)).toBe(false)
  })
})

describe("classifyRoundCollection", () => {
  it("files the ACC tournament, congress and parli rounds on their shelves", () => {
    expect(classifyRoundCollection("Final - ACC Debate Tournament 2025")).toBe("ACC")
    expect(classifyRoundCollection("Student Congress finals")).toBe("Congress")
    expect(classifyRoundCollection("NPTE semifinal")).toBe("Parli")
    expect(classifyRoundCollection("Parliamentary round 3")).toBe("Parli")
  })

  it("leaves other rounds unfiled and does not match parliament", () => {
    expect(classifyRoundCollection("Kansas vs Long Beach NDT")).toBeNull()
    expect(classifyRoundCollection("British Parliament debate")).toBeNull()
  })
})

describe("NSDA channel detection", () => {
  it("recognises the NSDA's display name and handle", () => {
    expect(isNsdaChannel("National Speech & Debate Association")).toBe(true)
    expect(isNsdaChannel("National Speech and Debate Association")).toBe(true)
    expect(isNsdaChannel("  @nsdaspeechanddebate ")).toBe(true)
    expect(isNsdaChannel("Debate Drills")).toBe(false)
    expect(isNsdaChannel("")).toBe(false)
    expect(isNsdaChannel(null)).toBe(false)
    expect(isNsdaChannel(undefined)).toBe(false)
  })

  it("forces the NSDA shelf only for the NSDA channel", () => {
    expect(lectureCategoryForChannel("nsdaspeechanddebate")).toBe(NSDA_LECTURE_CATEGORY)
    expect(lectureCategoryForChannel("Somebody Else")).toBeNull()
    expect(lectureCategoryForChannel(undefined)).toBeNull()
  })
})

describe("classifyLecture", () => {
  const cases: Array<[title: string, description: string, shelf: string]> = [
    ["WSD Rebuttals made easy", "", "WSD"],
    ["How world schools debate works", "", "WSD"],
    ["American Congressional Debate rules", "", "ACC"],
    ["Congress speech tips", "", "Congress"],
    ["Parli basics", "", "Parli"],
    ["2024 topic analysis", "", "Topic Lectures"],
    ["Topic prep for the new resolution", "", "Topic Lectures"],
    ["Intro to policy debate", "", "Novice & Introductory"],
    ["Writing a 2AC block", "", "Affirmative Strategy"],
    ["Case writing for PF", "", "Affirmative Strategy"],
    ["The 2NR on the politics disad", "", "Negative Strategy"],
    ["Cap K walkthrough", "", "Critique / Critical Theory"],
    ["Counterplan competition", "", "Counterplans & Theory"],
    ["Topicality against the plan", "", "Topicality & Framework"],
    ["Elections DA explained", "", "Disadvantages"],
    ["Weighing magnitude and timeframe", "", "Impact Calculus & Evidence"],
    ["Vocal delivery drills", "", "Speaking & Delivery"],
    ["How to take a flow", "", "Research & Flowing"],
    ["Final focus mistakes", "", "Public Forum"],
    ["A sample debate", "", "Demo Debates"],
    ["Judge adaptation", "", "Judge & Tournament Skills"],
    ["Kant for debaters", "", "Philosophy & IR Theory"],
    ["Summer workshop recap", "", "Camp & Coaching Advice"],
    ["A debate documentary", "", "Documentaries & Culture"],
    ["DebateDrills Academy session one", "", "Affirmative Strategy"],
    ["Debate technique roundup", "", "Affirmative Strategy"],
    ["Random upload", "", "Novice & Introductory"],
  ]

  it.each(cases)("files %j on %s", (title, description, shelf) => {
    expect(classifyLecture(title, description)).toBe(shelf)
  })

  it("lets the description decide when the title is silent", () => {
    expect(classifyLecture("Lesson 4", "all about the negative block")).toBe("Negative Strategy")
    expect(classifyLecture("Lesson 5", undefined as unknown as string)).toBe("Novice & Introductory")
  })

  it("puts format collections ahead of skill shelves", () => {
    expect(classifyLecture("WSD speaking and delivery", "")).toBe("WSD")
  })

  it("files every NSDA channel video on the NSDA shelf whatever its title", () => {
    expect(classifyLecture("Cap K walkthrough", "", "National Speech & Debate Association")).toBe("NSDA Speech")
    expect(classifyLecture("Cap K walkthrough", "", "Someone Else")).toBe("Critique / Critical Theory")
  })

  it("only ever returns a known category", () => {
    for (const [title, description] of cases) {
      expect(isLectureCategory(classifyLecture(title, description))).toBe(true)
    }
  })
})
