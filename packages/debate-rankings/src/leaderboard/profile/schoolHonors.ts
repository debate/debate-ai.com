/**
 * @fileoverview National honors a school page totals in its headline cards:
 * championships, finalists (second place) and top speakers, summed across
 * every national tournament on file. High schools count the Tournament of
 * Champions and the NDCA (every event) and the Cal Invitational at UC
 * Berkeley ("the Cal", Lincoln-Douglas and Public Forum); colleges count the NDT, CEDA
 * nationals and the Shirley. Each total carries its per-tournament split so
 * the card can show where the number comes from.
 * @module leaderboard/profile/schoolHonors
 */

import { findCalSchoolResults } from "../../sync/berkeley-champions"
import { findCedaSchoolTitles } from "../../sync/ceda-champions"
import { findNdcaSchoolRecord } from "../../sync/ndca-champions"
import type { NdtSchoolHistory } from "../../sync/ndt-school-history"
import { findListedShirleyResults } from "../../sync/shirley-results"
import { findTocSchoolRecord } from "../../sync/toc-champions"

/** One tournament's share of a total. */
export interface HonorPart {
  label: string
  count: number
}

/** A headline total and the tournaments behind it. */
export interface HonorTotal {
  total: number
  parts: HonorPart[]
}

export interface SchoolHonors {
  championships: HonorTotal
  /** Second-place finishes: runner-up, finalist, Shirley second place. */
  finalists: HonorTotal
  topSpeakers: HonorTotal
}

function total(parts: HonorPart[]): HonorTotal {
  return { total: parts.reduce((sum, part) => sum + part.count, 0), parts }
}

/** `"3 TOC · 1 NDCA"`, leaving out tournaments with none; `undefined` when every part is zero. */
export function honorHint({ parts }: HonorTotal): string | undefined {
  const shown = parts.filter((part) => part.count > 0)
  return shown.length ? shown.map((part) => `${part.count} ${part.label}`).join(" · ") : undefined
}

/**
 * A high school's TOC and NDCA honors in every event, plus its Cal
 * Invitational (UC Berkeley) LD and PF finals. A TOC runner-up, an NDCA
 * finalist and a Cal finalist are all second place.
 *
 * @param school - School name as the rankings spell it.
 */
export function highSchoolHonors(school: string): SchoolHonors {
  const toc = findTocSchoolRecord(school)
  const ndca = findNdcaSchoolRecord(school)
  const ndcaFinalists = ndca?.results.filter((r) => r.place === "Finalist").length ?? 0
  const cal = findCalSchoolResults(school)
  const calCount = (place: string) => cal.filter((r) => r.place === place).length
  return {
    championships: total([
      { label: "TOC", count: toc?.titles ?? 0 },
      { label: "NDCA", count: ndca?.titles ?? 0 },
      { label: "Cal", count: calCount("Champion") },
    ]),
    finalists: total([
      { label: "TOC", count: toc?.runnerUps ?? 0 },
      { label: "NDCA", count: ndcaFinalists },
      { label: "Cal", count: calCount("Finalist") },
    ]),
    topSpeakers: total([
      { label: "TOC", count: toc?.topSpeakers ?? 0 },
      { label: "NDCA", count: ndca?.topSpeakers ?? 0 },
      { label: "Cal", count: calCount("Top speaker") },
    ]),
  }
}

/**
 * A college's NDT, CEDA and Shirley honors. NDT second place is a team that
 * lost the final ("Finals"); its top speakers are first-place speaker awards.
 * CEDA's history lists champions only, so it adds no finalists.
 *
 * @param school - School name as the rankings spell it.
 * @param ndt - The school's NDT history, when it has one.
 */
export function collegeHonors(school: string, ndt: NdtSchoolHistory | null): SchoolHonors {
  const ceda = findCedaSchoolTitles(school)
  // Shirley finals before 2000 still score points but are not counted as titles here.
  const shirley = findListedShirleyResults(school)
  return {
    championships: total([
      { label: "NDT", count: ndt?.championships.length ?? 0 },
      { label: "CEDA", count: ceda?.titles.length ?? 0 },
      { label: "Shirley", count: shirley?.championships ?? 0 },
    ]),
    finalists: total([
      { label: "NDT", count: ndt?.elims.filter((elim) => elim.round === "Finals").length ?? 0 },
      { label: "Shirley", count: shirley?.secondPlaces ?? 0 },
    ]),
    topSpeakers: total([{ label: "NDT", count: ndt?.speakerAwards.filter((award) => award.rank === 1).length ?? 0 }]),
  }
}
