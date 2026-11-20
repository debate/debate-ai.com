/**
 * @fileoverview The ten curated Rebuttal Playlists.
 *
 * Each playlist is ten rounds from the video library (`videos` table), picked
 * as the most-watched available rounds that fit its format, level and style:
 * finals and famous elims by format, a college set, three style sets (kritik,
 * theory/topicality, traditional LD) and a prelim set for newer debaters.
 * Ids are YouTube ids, so every entry opens at `/videos/<id>` and embeds.
 *
 * The lists are static on purpose: progress is stored against `videoId`, so a
 * playlist that reshuffled whenever view counts moved would quietly change
 * what "7 of 10 done" means. Refresh them by hand, at the start of a season.
 *
 * @module debate-practice-rounds/rebuttal-playlists/playlists
 */

import type { DrillFormat, PlaylistVideo, RebuttalPlaylist } from "./types";

function v(
  videoId: string,
  format: DrillFormat,
  tournament: string,
  round: string,
  season: number,
  affTeam: string,
  negTeam: string,
  lastRebuttal?: string,
): PlaylistVideo {
  const year = season > 0 ? `${season} ` : "";
  return {
    videoId,
    title: `${year}${tournament} ${round} — ${affTeam} vs ${negTeam}`,
    format,
    tournament,
    round,
    season,
    affTeam,
    negTeam,
    ...(lastRebuttal ? { lastRebuttal } : {}),
  };
}

export const REBUTTAL_PLAYLISTS: readonly RebuttalPlaylist[] = [
  {
    id: "policy-finals",
    title: "GOAT High School Policy Finals",
    description: "The most-watched TOC and Barkley Forum policy finals. Redo the 2AR or the 2NR that decided a national title.",
    formatLabel: "Policy",
    level: "varsity",
    style: "Finals",
    emoji: "🏆",
    videos: [
      v("HXGNNhOxrBw", "policy", "Barkley Forum", "Finals", 2018, "Greenhill EG", "MBA BJ"),
      v("_XU92LHHk2Y", "policy", "TOC", "Finals", 2019, "North Broward MR", "MBA BH"),
      v("c-1lEVGXgpM", "policy", "TOC", "Finals", 2013, "CK McClatchy", "GBN KS"),
      v("HGyFBRu5F8o", "policy", "TOC", "Finals", 2014, "Polytechnic AA", "Centennial KK"),
      v("_oQlFJI23JA", "policy", "TOC", "Finals", 2023, "MBA CM", "LASA CH"),
      v("HsAdCYnCjTY", "policy", "TOC", "Finals", 2024, "MBA MT", "Westwood ST"),
      v("MBPbP4xXKiQ", "policy", "TOC", "Finals", 2025, "Greenhill CL", "Northview CT"),
      v("a-YOBMcf8Vw", "policy", "TOC", "Finals", 2026, "GBN CR", "Montgomery Bell HL"),
      v("Fc9fHnW1-ao", "policy", "TOC", "Finals", 2018, "BVSW KL", "Monta Vista PS"),
      v("g46renctj54", "policy", "Barkley Forum", "Finals", 2024, "Taipei American LY", "LASA BD"),
    ],
  },
  {
    id: "pf-finals",
    title: "Public Forum Finals",
    description: "Nationals, TOC and major-invitational PF finals. Redo the Final Focus that won — or would have.",
    formatLabel: "Public Forum",
    level: "varsity",
    style: "Finals",
    emoji: "🎤",
    videos: [
      v("OB3bJ_RN0RY", "pf", "Yale", "Finals", 2018, "Newton South GS", "Millburn CZ"),
      v("t7fKEsZohYY", "pf", "NSDA Nationals", "Finals", 2024, "Durham BH", "Plano West LK"),
      v("L1Jx28Elszw", "pf", "NSDA Nationals", "Finals", 2025, "Monta Vista TG", "Archbishop Mitty AD"),
      v("BRyse9mvMO4", "pf", "Blake", "Finals", 2020, "Blake JS", "University KK"),
      v("gE9i55ukAno", "pf", "NSDA Nationals", "Finals", 2026, "Brentwood CM", "Theodore Roosevelt MM"),
      v("RP_81CItgcE", "pf", "TOC", "Finals", 2018, "Santa Monica RE", "Greenhill BZ"),
      v("llNpyCq0L8Q", "pf", "TOC", "Finals", 2020, "Blake JS", "Westlake DL"),
      v("VxMkLzgNjm0", "pf", "TOC", "Finals", 2022, "Brentwood HM", "Strake Jesuit DG"),
      v("E6zoqh9GA-k", "pf", "UPenn", "Finals", 2020, "Acton NH", "Ridge RS"),
      v("9tREemyPwyg", "pf", "Harvard", "Finals", 2020, "Plano West NY", "Thomas Wootton TZ"),
    ],
  },
  {
    id: "ld-finals",
    title: "Lincoln-Douglas Finals",
    description: "NSDA, TOC and Glenbrooks LD finals, from traditional value debates to Kant and topicality. Redo the 2AR or the NR.",
    formatLabel: "Lincoln-Douglas",
    level: "varsity",
    style: "Finals",
    emoji: "⚖️",
    videos: [
      v("Dw6Nvv8UMbU", "ld", "NSDA Nationals", "Finals", 2019, "L277", "L262", "Trad"),
      v("-LZBMnxU16A", "ld", "NSDA Nationals", "Finals", 2026, "Hawken BG", "Cupertino NS"),
      v("1snKajTZGE4", "ld", "TOC", "Finals", 2023, "Harker MK", "Strake Jesuit KS", "Kant NC"),
      v("1kTtxtDutL8", "ld", "NSDA Nationals", "Finals", 2022, "Edina HP", "Olathe East EL", "Trad"),
      v("OJflYpRtyhU", "ld", "TOC", "Finals", 2025, "Lynbrook OM", "OCSA IL", "Policy"),
      v("Iuikf330ZjE", "ld", "Classic Debate Camp", "Finals", 2025, "Joyce Xiao", "Amelia Butler", "Trad"),
      v("o_eLsrbL2sY", "ld", "Glenbrooks", "Finals", 2019, "Santa Monica RE", "West Des Moines Valley AJ"),
      v("I4b5N_M6U4M", "ld", "TOC", "Finals", 2026, "Head-Royce AJ", "Lynbrook BZ", "Topicality"),
      v("H44zbJN9nRo", "ld", "Loyola", "Finals", 2025, "Lynbrook BZ", "Coppell KT", "Pessimism K"),
      v("H_xzLwJ3m8c", "ld", "Classic Debate Camp", "Finals", 2024, "Anshul Sharma", "Neil Heckman", "Trad"),
    ],
  },
  {
    id: "ndt-finals",
    title: "NDT Finals",
    description: "Two decades of National Debate Tournament finals, the top of college policy. Redo the last rebuttal of a college national title.",
    formatLabel: "College Policy",
    level: "college",
    style: "Finals",
    emoji: "🎓",
    videos: [
      v("Zos_pjbewtU", "ndt", "NDT", "Finals", 2016, "Harvard HS", "Kansas BR"),
      v("NBzGKSQwldk", "ndt", "NDT", "Finals", 2023, "Michigan PP", "Wake Forest RT"),
      v("qx7Xx_6exzk", "ndt", "NDT", "Finals", 2022, "Dartmouth SV", "Michigan PR"),
      v("nus-tro3ngE", "ndt", "NDT", "Finals", 2021, "Dartmouth TV", "Michigan PR"),
      v("BoHPiHiWagg", "ndt", "NDT", "Finals", 2009, "Kansas BJ", "Wake GL"),
      v("zoKowWVQ1wE", "ndt", "NDT", "Finals", 2015, "Northwestern MV", "Michigan AP", "Federal Congress CP"),
      v("T77G1CdZx9E", "ndt", "NDT", "Finals", 2026, "CSU Long Beach OM", "Emory GS"),
      v("SLsU8RbunG4", "ndt", "NDT", "Finals", 2024, "Kansas RS", "Michigan PD"),
      v("a9Al3DPy8Lw", "ndt", "NDT", "Finals", 2019, "Georgia RS", "Kentucky BT"),
      v("Ya0nuyUOkZ0", "ndt", "NDT", "Finals", 2008, "Wake GL", "Dartmouth KO"),
    ],
  },
  {
    id: "ndt-elims",
    title: "NDT Elim Classics",
    description: "The most-watched NDT semifinals and quarterfinals. College rebuttals under elimination pressure.",
    formatLabel: "College Policy",
    level: "college",
    style: "Elims",
    emoji: "🔥",
    videos: [
      v("mkahaj93Xuo", "ndt", "NDT", "Semis", 2018, "Kansas KR", "Harvard MS"),
      v("G2GKX4Y0hNA", "ndt", "NDT", "Semis", 2018, "Michigan GW", "Georgetown BK"),
      v("0SUKWKdR0ww", "ndt", "NDT", "Quarters", 2014, "Northwestern MV", "Harvard BS"),
      v("GCCmzykZcZI", "ndt", "NDT", "Semis", 2022, "Southern California KS", "Dartmouth SV"),
      v("naydbVyiCM8", "ndt", "NDT", "Quarters", 2018, "Georgetown BK", "OU PS"),
      v("2M52TF8jRK0", "ndt", "NDT", "Semis", 2024, "Michigan PD", "Emory KR"),
      v("cl4fkdfJ2sI", "ndt", "NDT", "Quarters", 2017, "Georgetown KL", "Harvard MS"),
      v("WLqOLlP3tdw", "ndt", "NDT", "Semis", 2017, "Georgetown KL", "Berkeley GW"),
      v("G7UcvL7R3gE", "ndt", "NDT", "Quarters", 2015, "Cal SW", "Northwestern MV"),
      v("sVEkHJLOFjk", "ndt", "NDT", "Semis", 2025, "Binghamton CT", "CSU Long Beach OM"),
    ],
  },
  {
    id: "pf-elims",
    title: "Public Forum Elim Thrillers",
    description: "The most-watched PF semifinals and quarterfinals from TOC, Glenbrooks, ASU, Berkeley and Emory.",
    formatLabel: "Public Forum",
    level: "varsity",
    style: "Elims",
    emoji: "⚡",
    videos: [
      v("dcsj64PANE0", "pf", "ASU", "Semis", 2018, "La Salle CN", "Mission San Jose KM"),
      v("v5R3ogcNRFA", "pf", "Glenbrooks", "Quarters", 2017, "Mission San Jose KW", "Ardrey Kell KW"),
      v("k37C_B5-q6s", "pf", "Berkeley", "Quarters", 2023, "Flower Mound BS", "Edina JS"),
      v("0U4eK4ucXfU", "pf", "ASU", "Quarters", 2018, "Altamont CZ", "Corona Del Sol FJ"),
      v("g9DQQZYNX3I", "pf", "TOC", "Semis", 2018, "Millburn CZ", "Walt Whitman MM"),
      v("4-2GWjap-8w", "pf", "TOC", "Semis", 2017, "Trinity Prep PT", "Nueva MS"),
      v("CNKKYA5KiO4", "pf", "Bronx", "Semis", 2019, "VIP BL", "University KK"),
      v("cCyao3kHxVM", "pf", "Emory", "Semis", 2020, "Cinco Ranch RT", "North Broward KP"),
      v("qOVF08Nm9Iw", "pf", "TOC", "Semis", 2025, "Iowa City West EA", "Strake Jesuit GZ"),
      v("v_jgKRFco6c", "pf", "TOC", "Quarters", 2023, "Southlake Carroll PS", "Strake DY"),
    ],
  },
  {
    id: "kritik",
    title: "Kritik Rounds",
    description: "Elite rounds that came down to a kritik: antiblackness, settler colonialism, pessimism. Redo the 1AR/2AR against the K, or the NR going for it.",
    formatLabel: "Lincoln-Douglas",
    level: "varsity",
    style: "Kritik",
    emoji: "🧠",
    videos: [
      v("fcykmUXcy9I", "ld", "TFA State", "Finals", 2022, "Strake Jesuit JX", "Garland LY", "Antiblackness"),
      v("5_qKT6mYuVI", "ld", "Glenbrooks", "Semis", 2024, "Lynbrook OM", "Harker SD", "K"),
      v("YFc6aTGZm4Q", "ld", "Glenbrooks", "Quarters", 2023, "American Heritage SS", "Harker AS", "Setcol"),
      v("ssRGjc6rrew", "ld", "TOC", "Round 6", 2024, "Lake Highland Prep PS", "Harker AS", "K"),
      v("llnmta2Hq-o", "ld", "Lake Highland Round Robin", "Semis", 2020, "West Des Moines Valley AJ", "Success TR", "Pessimism"),
      v("SKc7ho5v_2Y", "ld", "Glenbrooks", "Round 3", 2025, "Lynbrook OM", "Horace Greeley SG", "Settler Colonialism K"),
      v("VWd_qPoDPf8", "ld", "Barkley Forum", "Quarters", 2024, "Lake Highland Prep PS", "American Heritage Broward MC", "K"),
      v("o9p7tp63Qeg", "ld", "Florida Blue Key", "Quarters", 2024, "Lake Highland Prep HL", "Jordan KV", "K"),
      v("yrqa63S75co", "ld", "TOC", "Round 6", 2023, "Dulles VN", "Strath Haven AM", "Setcol"),
      v("OxsB7UP5fZo", "ld", "Peninsula", "Semis", 2026, "Sharks WL", "Harker NB", "Settler Colonialism K"),
    ],
  },
  {
    id: "theory",
    title: "Theory & Topicality",
    description: "Rounds decided on T-Subsets, T-Framework and theory. Practice the rebuttal where the procedural is the whole round.",
    formatLabel: "Lincoln-Douglas",
    level: "varsity",
    style: "Theory",
    emoji: "📐",
    videos: [
      v("1e-6ZQOUrDA", "ld", "TOC", "Quarters", 2024, "Harker KB", "American Heritage Broward SS", "T-Subsets"),
      v("yPKozM0Zw_k", "pf", "TOC", "Quarters", 2023, "Blake TP", "Southlake Carroll SR", "Theory"),
      v("wl8cI9TUIuw", "ld", "TOC", "Doubles", 2023, "Strath Haven AM", "Strake Jesuit NW", "T-Subsets"),
      v("vJxTco4vs6s", "ld", "TFA State", "Doubles", 2020, "Southlake Carroll TR", "Strake Jesuit DL", "T-Subsets"),
      v("ZqcgyG-shzg", "ld", "CPS", "Round 4", 2025, "Lynbrook ST", "Monta Vista EY", "Topicality"),
      v("R83GIxHnpAY", "ld", "Stanford", "Doubles", 2020, "Santa Monica RE", "Strake Jesuit JG", "T-Subsets"),
      v("JkY9rNLcLQk", "ld", "TOC", "Doubles", 2023, "Iowa City West NW", "Dulles VN", "Theory"),
      v("RPxfM833BjE", "ld", "Cal Invitational", "Quarters", 2023, "Lynbrook SY", "Marlborough WR", "T-Framework"),
      v("QrEEcrHK2DE", "ld", "Cougar Classic", "Round 5", 2024, "Bryan EC", "Carnegie Vanguard LH", "T-Framework"),
      v("I4b5N_M6U4M", "ld", "TOC", "Finals", 2026, "Head-Royce AJ", "Lynbrook BZ", "Topicality"),
    ],
  },
  {
    id: "traditional-ld",
    title: "Traditional LD",
    description: "Value-and-criterion debate for lay judges, from NSDA Nationals and camp finals. A great first playlist.",
    formatLabel: "Lincoln-Douglas",
    level: "novice",
    style: "Traditional",
    emoji: "📜",
    videos: [
      v("Dw6Nvv8UMbU", "ld", "NSDA Nationals", "Finals", 2019, "L277", "L262", "Trad"),
      v("pyZG7OraYPA", "ld", "NITOC", "Quarters", 2016, "Thomas Keith", "Austin Janik", "Trad"),
      v("1kTtxtDutL8", "ld", "NSDA Nationals", "Finals", 2022, "Edina HP", "Olathe East EL", "Trad"),
      v("Iuikf330ZjE", "ld", "Classic Debate Camp", "Finals", 2025, "Joyce Xiao", "Amelia Butler", "Trad"),
      v("fs7AazvF21k", "ld", "NSDA Nationals", "Round 15", 2020, "L148", "L203", "Trad"),
      v("H_xzLwJ3m8c", "ld", "Classic Debate Camp", "Finals", 2024, "Anshul Sharma", "Neil Heckman", "Trad"),
      v("VZ7g_O8Wit8", "ld", "Classic Debate Camp", "Finals", 2023, "Robert Einhorn", "Tristan Williams", "Trad"),
      v("FlBlGnxLZQU", "ld", "NSDA Nationals", "Round 14", 2021, "L515", "L830", "Trad"),
      v("iQ3EZUMCUj0", "ld", "NSDA Nationals", "Round 14", 2020, "L203", "L260", "Trad"),
      v("mvI3NlAruEY", "ld", "NSDA Nationals", "Round 14", 2020, "L335", "L148", "Trad"),
    ],
  },
  {
    id: "prelim-fundamentals",
    title: "Prelim Fundamentals",
    description: "Popular prelim rounds across policy, PF and LD. Clean, teachable rebuttals for novices and JV debaters.",
    formatLabel: "Mixed",
    level: "novice",
    style: "Prelims",
    emoji: "🌱",
    videos: [
      v("3dQJsOlRqXE", "policy", "BOD vs Claremont", "Round 3", 2015, "BOD JZ", "Claremont MS"),
      v("OnDL_bIDEqg", "pf", "NSD", "Round 5", 2023, "Epsilon DMG AC", "Epsilon BMD GZ"),
      v("idVYtj01tkc", "policy", "St. Mark's", "Round 5", 2019, "Washburn Rural KP", "LASA EU"),
      v("Dfv3GMLtsAI", "policy", "Greenhill", "Round 4", 2019, "LASA IJ", "MBA BM"),
      v("SlEnilpQGZU", "pf", "NSDA Nationals", "Round 7", 2018, "Plano West LY", "Mission San Jose KM"),
      v("Xom98ka9adU", "pf", "Glenbrooks", "Round 6", 2018, "Lincoln Sudbury CS", "Ardrey Kell HB"),
      v("qz_8APsKULk", "policy", "TOC", "Round 7", 2013, "Stratford JS", "GBN KS"),
      v("8HO5_O_0igM", "ld", "TOC", "Round 6", 2023, "Harker KB", "Saratoga AG"),
      v("h_WQjslF6N4", "pf", "Durham", "Round 4", 2023, "Strake Jesuit DY", "Lake Highland Prep AY"),
      v("ZIkIu8HzdrY", "pf", "TOC", "Round 2", 2018, "Quarry Lane AS", "Corona del Sol FJ"),
    ],
  },
];

/** The playlist with this id, or `undefined`. */
export function findPlaylist(id: string): RebuttalPlaylist | undefined {
  return REBUTTAL_PLAYLISTS.find((playlist) => playlist.id === id);
}

/** The video `videoId` in playlist `playlistId`, or `undefined` when it is not on that list. */
export function findPlaylistVideo(playlistId: string, videoId: string): PlaylistVideo | undefined {
  return findPlaylist(playlistId)?.videos.find((video) => video.videoId === videoId);
}

/** Display labels for the level tags. */
export const PLAYLIST_LEVEL_LABELS: Record<RebuttalPlaylist["level"], string> = {
  novice: "Novice / JV",
  varsity: "Varsity",
  college: "College",
};
