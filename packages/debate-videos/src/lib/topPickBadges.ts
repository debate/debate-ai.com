/**
 * @fileoverview Top Pick Badge Registry and Greatest of All Time (GOAT) metadata.
 *
 * Maps top pick video IDs to chronological Hall of Fame badge numbers (#001 onwards),
 * starting from the earliest curated debate rounds.
 * @module lib/topPickBadges
 */

export interface TopPickBadgeInfo {
  /** 3-digit badge number starting from #001 (e.g. "#001"). */
  badgeNumber: string;
  /** Numerical index of the badge (1-based). */
  badgeIndex: number;
  /** Affirmative team name if recorded. */
  affTeam?: string | null;
  /** Negative team name if recorded. */
  negTeam?: string | null;
  /** Title of the video. */
  title?: string | null;
  /** Tournament name if recorded. */
  tournament?: string | null;
  /** Round level (e.g. "Finals") if recorded. */
  roundLevel?: string | null;
  /** Publication date string. */
  date?: string | null;
  /** Publication or tournament year. */
  year?: number | null;
}

/** Precomputed chronological map of all known Top Pick videos (#001 earliest). */
export const TOP_PICK_BADGES: Record<string, TopPickBadgeInfo> = {
  "m5x5KhnWbx4": {
    "badgeNumber": "#001",
    "badgeIndex": 1,
    "affTeam": "Iowa LR",
    "negTeam": "Kansas EM",
    "title": "Shirley Finals Iowa LR vs Kansas EM",
    "tournament": "Shirley",
    "roundLevel": "Finals",
    "date": "1999-11-15",
    "year": 1999
  },
  "V9MaoDDhLjs": {
    "badgeNumber": "#002",
    "badgeIndex": 2,
    "affTeam": "Fort Hays RR",
    "negTeam": "Michigan State CM",
    "title": "CEDA 2002 Finals - Fort Hays RR vs. Michigan State CM",
    "tournament": "CEDA 2002",
    "roundLevel": "Finals",
    "date": "2002-04-06",
    "year": 2002
  },
  "Rp3ewv7Axxk": {
    "badgeNumber": "#003",
    "badgeIndex": 3,
    "affTeam": "Fort Hays RS",
    "negTeam": "Northwestern GM",
    "title": "Shirley 2002 Finals: Fort Hays RS vs Northwestern GM",
    "tournament": "Shirley 2002",
    "roundLevel": "Finals",
    "date": "2002-11-15",
    "year": 2002
  },
  "sgwKzYh7SqI": {
    "badgeNumber": "#004",
    "badgeIndex": 4,
    "affTeam": "Greenhill AH",
    "negTeam": "CPS AB",
    "title": "2003 TOC Finals -- Greenhill AH v CPS AB",
    "tournament": "2003 TOC",
    "roundLevel": "Finals",
    "date": "2003-01-18",
    "year": 2003
  },
  "3SAri8OoWbw": {
    "badgeNumber": "#005",
    "badgeIndex": 5,
    "affTeam": "Emory BL",
    "negTeam": "North Texas PP",
    "title": "CEDA 2004 Finals  - Emory BL vs. North Texas PP",
    "tournament": "CEDA 2004",
    "roundLevel": "Finals",
    "date": "2004-04-06",
    "year": 2004
  },
  "CctANzFyT1A": {
    "badgeNumber": "#006",
    "badgeIndex": 6,
    "affTeam": "Louisville GJ",
    "negTeam": "Cal-Berkley SS",
    "title": "2004 NDT Quarters - Louisville GJ v. Cal-Berkley SS",
    "tournament": "2004 NDT",
    "roundLevel": "Quarters",
    "date": "2004-04-23",
    "year": 2004
  },
  "OqzHkXsnsPg": {
    "badgeNumber": "#007",
    "badgeIndex": 7,
    "affTeam": "Oklahoma CJ",
    "negTeam": "Georgia CR",
    "title": "Shirley 2006 Finals: Oklahoma CJ vs Georgia CR",
    "tournament": "Shirley 2006",
    "roundLevel": "Finals",
    "date": "2006-11-15",
    "year": 2006
  },
  "0QTUc-eQJL4": {
    "badgeNumber": "#008",
    "badgeIndex": 8,
    "affTeam": "Towson CL",
    "negTeam": "Fort Hays HS",
    "title": "CEDA 2008 Quarters - Towson CL vs. Fort Hays HS",
    "tournament": "CEDA 2008",
    "roundLevel": "Quarters",
    "date": "2008-04-06",
    "year": 2008
  },
  "Ya0nuyUOkZ0": {
    "badgeNumber": "#009",
    "badgeIndex": 9,
    "affTeam": "Wake GL",
    "negTeam": "Dartmouth KO",
    "title": "NDT 2008 Finals - Wake GL vs  Dartmouth KO",
    "tournament": "NDT 2008",
    "roundLevel": "Finals",
    "date": "2008-04-08",
    "year": 2008
  },
  "CGkdfjAw1xw": {
    "badgeNumber": "#010",
    "badgeIndex": 10,
    "affTeam": "UTD BR",
    "negTeam": "Emory IW",
    "title": "2009 GSU Finals -- UTD BR v Emory IW",
    "tournament": "2009 GSU",
    "roundLevel": "Finals",
    "date": "2009-01-26",
    "year": 2009
  },
  "BoHPiHiWagg": {
    "badgeNumber": "#011",
    "badgeIndex": 11,
    "affTeam": "Kansas NJ",
    "negTeam": "Wake GL",
    "title": "NDT09 Finals Kansas BJ v Wake GL",
    "tournament": "NDT",
    "roundLevel": "Finals",
    "date": "2009-04-01",
    "year": 2009
  },
  "XCMAriNkZnI": {
    "badgeNumber": "#012",
    "badgeIndex": 12,
    "affTeam": "Emory MS",
    "negTeam": "West GA BS",
    "title": "Northwestern 2009 Finals: Emory MS vs West GA BS",
    "tournament": "Northwestern 2009",
    "roundLevel": "Finals",
    "date": "2009-10-01",
    "year": 2009
  },
  "KqacRju7CHk": {
    "badgeNumber": "#013",
    "badgeIndex": 13,
    "affTeam": "Oklahoma GW",
    "negTeam": "Whitman CS",
    "title": "CEDA 2010 Finals - Oklahoma GW vs. Whitman CS",
    "tournament": "CEDA 2010",
    "roundLevel": "Finals",
    "date": "2010-04-06",
    "year": 2010
  },
  "lIc_7EXJgSI": {
    "badgeNumber": "#014",
    "badgeIndex": 14,
    "affTeam": "Lexington EV",
    "negTeam": "Westminster AT",
    "title": "2011 TOC Finals -- Lexington EV v Westminster AT",
    "tournament": "2011 TOC",
    "roundLevel": "Finals",
    "date": "2011-02-17",
    "year": 2011
  },
  "Ox_ahmC161g": {
    "badgeNumber": "#015",
    "badgeIndex": 15,
    "affTeam": "Towson CK",
    "negTeam": "Kansas St MZ",
    "title": "CEDA 2011 Finals: Towson CK vs Kansas St MZ",
    "tournament": "CEDA 2011",
    "roundLevel": "Finals",
    "date": "2011-02-22",
    "year": 2011
  },
  "34OERMh0aqI": {
    "badgeNumber": "#016",
    "badgeIndex": 16,
    "affTeam": "Northwestern BK",
    "negTeam": "Georgetown AM",
    "title": "2012 NDT Finals -- Northwestern BK v Georgetown AM",
    "tournament": "2012 NDT",
    "roundLevel": "Finals",
    "date": "2012-03-11",
    "year": 2012
  },
  "tBq_UFu7KTI": {
    "badgeNumber": "#017",
    "badgeIndex": 17,
    "affTeam": "Emporia SW",
    "negTeam": "Northwestern LV",
    "title": "NDT 2013 Finals: Emporia SW vs Northwestern LV",
    "tournament": "NDT 2013",
    "roundLevel": "Finals",
    "date": "2013-04-01",
    "year": 2013
  },
  "axWsN4iqPR8": {
    "badgeNumber": "#018",
    "badgeIndex": 18,
    "affTeam": "Northwestern LV",
    "negTeam": "Georgetown AM",
    "title": "NDT 2013 Semis - Northwestern LV vs Georgetown AM",
    "tournament": "NDT 2013",
    "roundLevel": "Semis",
    "date": "2013-04-03",
    "year": 2013
  },
  "c-1lEVGXgpM": {
    "badgeNumber": "#019",
    "badgeIndex": 19,
    "affTeam": "CK McClatchy",
    "negTeam": "GBN KS",
    "title": "2013 TOC - Finals - CK McClatchy vs GBN KS",
    "tournament": "2013 TOC",
    "roundLevel": "Finals",
    "date": "2013-07-09",
    "year": 2013
  },
  "QEuBoAijMhw": {
    "badgeNumber": "#020",
    "badgeIndex": 20,
    "affTeam": "Northwestern MV",
    "negTeam": "Harvard BS",
    "title": "GSU Finals   Northwestern MV vs Harvard BS",
    "tournament": "GSU",
    "roundLevel": "Finals",
    "date": "2013-09-25",
    "year": 2013
  },
  "_c-Rt4QvRcQ": {
    "badgeNumber": "#021",
    "badgeIndex": 21,
    "affTeam": "Harvard BS",
    "negTeam": "Northwestern MV",
    "title": "Shirley Finals   Harvard BS vs Northwestern MV",
    "tournament": "Shirley",
    "roundLevel": "Finals",
    "date": "2013-11-21",
    "year": 2013
  },
  "mbNed3XMQJ8": {
    "badgeNumber": "#022",
    "badgeIndex": 22,
    "affTeam": "Stratford OS",
    "negTeam": "Bishop Guertin DI",
    "title": "Barkley Forum for High Schools Final Round 2014",
    "tournament": "Barkley",
    "roundLevel": "Finals",
    "date": "2014-01-27",
    "year": 2014
  },
  "WIC2kG3kZMQ": {
    "badgeNumber": "#023",
    "badgeIndex": 23,
    "affTeam": "Georgetown AM",
    "negTeam": "Michigan AP",
    "title": "2014 NDT Finals - Georgetown AM vs Michigan AP",
    "tournament": "2014 NDT",
    "roundLevel": "Finals",
    "date": "2014-04-01",
    "year": 2014
  },
  "HGyFBRu5F8o": {
    "badgeNumber": "#024",
    "badgeIndex": 24,
    "affTeam": "Polytechnic AA",
    "negTeam": "Centennial KK",
    "title": "2014 TOC Finals - Polytechnic AA vs Centennial KK",
    "tournament": "2014 TOC",
    "roundLevel": "Finals",
    "date": "2014-04-29",
    "year": 2014
  },
  "zoKowWVQ1wE": {
    "badgeNumber": "#025",
    "badgeIndex": 25,
    "affTeam": "Northwestern MV",
    "negTeam": "Michigan AP",
    "title": "2015 NDT Finals - Northwestern MV vs Michigan AP",
    "tournament": "2015 NDT",
    "roundLevel": "Finals",
    "date": "2015-04-07",
    "year": 2015
  },
  "YEJLgUoCpnU": {
    "badgeNumber": "#026",
    "badgeIndex": 26,
    "affTeam": "Mission San Jose WK",
    "negTeam": "Nueva AT",
    "title": "Mission San Jose WK vs Nueva AT University of the Pacific Invitational 2015",
    "tournament": "University of the Pacific",
    "roundLevel": "Finals",
    "date": "2015-11-02",
    "year": 2015
  },
  "6PuhVYq6ntc": {
    "badgeNumber": "#027",
    "badgeIndex": 27,
    "affTeam": "Poly Prep EH",
    "negTeam": "Ardrey Kell BW",
    "title": "Poly Prep EH vs Ardrey Kell BW Blake Round Robin Finals",
    "tournament": "Blake Round Robin",
    "roundLevel": "Finals",
    "date": "2016-02-13",
    "year": 2016
  },
  "i6Jz2dCjmGo": {
    "badgeNumber": "#028",
    "badgeIndex": 28,
    "affTeam": "College Prep WW",
    "negTeam": "Harker HL",
    "title": "College Prep WW vs Harker HL ASU Finals",
    "tournament": "ASU",
    "roundLevel": "Finals",
    "date": "2016-02-22",
    "year": 2016
  },
  "s8-FrT6k0CU": {
    "badgeNumber": "#029",
    "badgeIndex": 29,
    "affTeam": "Nueva MS",
    "negTeam": "Walt Whitman AA",
    "title": "Nueva MS vs Walt Whitman AA Bronx Finals",
    "tournament": "Bronx",
    "roundLevel": "Finals",
    "date": "2016-02-23",
    "year": 2016
  },
  "33IGGq4FJHM": {
    "badgeNumber": "#030",
    "badgeIndex": 30,
    "affTeam": "Oakwood BG",
    "negTeam": "Harker JR",
    "title": "Oakwood BG vs Harker JR Golden Desert Finals",
    "tournament": "Golden Desert",
    "roundLevel": "Finals",
    "date": "2016-03-07",
    "year": 2016
  },
  "ZShUHf0jLEA": {
    "badgeNumber": "#031",
    "badgeIndex": 31,
    "affTeam": "Liberty BC",
    "negTeam": "Vermont BL",
    "title": "2016 CEDA Finals - Liberty BC vs Vermont BL",
    "tournament": "2016 CEDA",
    "roundLevel": "Finals",
    "date": "2016-03-30",
    "year": 2016
  },
  "npEtCApMh0k": {
    "badgeNumber": "#032",
    "badgeIndex": 32,
    "affTeam": "Michigan KM",
    "negTeam": "Michigan State ST",
    "title": "2016 NDT - Michigan KM vs Michigan State ST",
    "tournament": "2016 NDT",
    "roundLevel": null,
    "date": "2016-04-02",
    "year": 2016
  },
  "Zos_pjbewtU": {
    "badgeNumber": "#033",
    "badgeIndex": 33,
    "affTeam": "Harvard HS",
    "negTeam": "Kansas BR",
    "title": "2016 NDT Finals - Harvard HS vs Kansas BR",
    "tournament": "2016 NDT",
    "roundLevel": "Finals",
    "date": "2016-04-05",
    "year": 2016
  },
  "wYptPKcCa_Q": {
    "badgeNumber": "#034",
    "badgeIndex": 34,
    "affTeam": "Walt Whitman WW",
    "negTeam": "Poly Prep EH",
    "title": "Walt Whitman WW vs Poly Prep EH Harvard Finals",
    "tournament": "Harvard",
    "roundLevel": "Finals",
    "date": "2016-04-09",
    "year": 2016
  },
  "_0pSv0Bj6z4": {
    "badgeNumber": "#035",
    "badgeIndex": 35,
    "affTeam": "Pine View BS",
    "negTeam": "Mission San Jose KW",
    "title": "Pine View BS vs Mission San Jose KW TOC 2016 Finals",
    "tournament": "TOC 2016",
    "roundLevel": "Finals",
    "date": "2016-05-11",
    "year": 2016
  },
  "JYbqkeeJUmU": {
    "badgeNumber": "#036",
    "badgeIndex": 36,
    "affTeam": "Ft. Lauderdale GB",
    "negTeam": "Trinity Prep FL",
    "title": "Ft. Lauderdale GB vs Trinity Prep FL Emory 2011 Finals",
    "tournament": "Emory 2011",
    "roundLevel": "Finals",
    "date": "2016-06-27",
    "year": 2016
  },
  "QVijCuyirKw": {
    "badgeNumber": "#037",
    "badgeIndex": 37,
    "affTeam": "Harvard HS",
    "negTeam": "Michigan KM",
    "title": "2016 NDT R5 - Harvard HS vs Michigan KM",
    "tournament": "NDT 2016",
    "roundLevel": "Round 5",
    "date": "2016-09-07",
    "year": 2016
  },
  "igMl9DRxEmQ": {
    "badgeNumber": "#038",
    "badgeIndex": 38,
    "affTeam": "Fort Lauderdale HS",
    "negTeam": "Ardrey Kell KW ",
    "title": "Fort Lauderdale HS vs Ardrey Kell KW Wake Forest 2016 Finals",
    "tournament": "Wake Forest 2016",
    "roundLevel": " Finals",
    "date": "2016-11-15",
    "year": 2016
  },
  "2lLoqMMZ76g": {
    "badgeNumber": "#039",
    "badgeIndex": 39,
    "affTeam": "Michigan DM",
    "negTeam": "Berkeley GW",
    "title": "Michigan DM vs Berkeley GW, Open Round 6 , Fullerton 2017   The Debate",
    "tournament": "Fullerton",
    "roundLevel": "6",
    "date": "2017-01-08",
    "year": 2017
  },
  "3I8kdjFDgME": {
    "badgeNumber": "#040",
    "badgeIndex": 40,
    "affTeam": "Georgetown KL",
    "negTeam": "Berkeley MS",
    "title": "Georgetown KL vs Berkeley MS, Semis, Fullerton 2017",
    "tournament": "Fullerton",
    "roundLevel": "Semis",
    "date": "2017-01-10",
    "year": 2017
  },
  "ShWZ5_LuEA8": {
    "badgeNumber": "#041",
    "badgeIndex": 41,
    "affTeam": "Rutgers NM",
    "negTeam": "Berkeley WG",
    "title": "Rutgers NM vs Berkeley WG, Open Round 5, Northwestern 2017",
    "tournament": "Northwestern",
    "roundLevel": "Round 5",
    "date": "2017-02-05",
    "year": 2017
  },
  "lSB-byH8VTI": {
    "badgeNumber": "#042",
    "badgeIndex": 42,
    "affTeam": "Rutgers MN",
    "negTeam": "UMKC AT",
    "title": "2017 CEDA Nats Finals - Rutgers MN (Aff) vs. UMKC AT (Neg)",
    "tournament": "2017 CEDA Nats",
    "roundLevel": "Finals",
    "date": "2017-03-21",
    "year": 2017
  },
  "AVM-Y9Np3SM": {
    "badgeNumber": "#043",
    "badgeIndex": 43,
    "affTeam": "Oklahoma WJ",
    "negTeam": "Georgetown KL",
    "title": "Oklahoma WJ vs Georgetown KL, Round the Sixth, NDT 2017",
    "tournament": "NDT 2017",
    "roundLevel": "Round Sixth",
    "date": "2017-03-26",
    "year": 2017
  },
  "WlatopR63e0": {
    "badgeNumber": "#044",
    "badgeIndex": 44,
    "affTeam": "Rutgers MN",
    "negTeam": "Georgetown KL",
    "title": "2017 NDT - Round 8 - Rutgers MN (Aff) vs. Georgetown KL",
    "tournament": "NDT 2017",
    "roundLevel": "Round 8",
    "date": "2017-03-26",
    "year": 2017
  },
  "cl4fkdfJ2sI": {
    "badgeNumber": "#045",
    "badgeIndex": 45,
    "affTeam": "Georgetown KL",
    "negTeam": "Harvard MS",
    "title": "2017 NDT - Quarters - Georgetown KL (Aff) vs. Harvard MS",
    "tournament": "NDT 2017",
    "roundLevel": "Quarters",
    "date": "2017-03-27",
    "year": 2017
  },
  "WLqOLlP3tdw": {
    "badgeNumber": "#046",
    "badgeIndex": 46,
    "affTeam": "Georgetown KL",
    "negTeam": "Berkeley GW",
    "title": "2017 NDT - Semis - Georgetown KL (Aff) vs. Berkeley GW",
    "tournament": "NDT 2017",
    "roundLevel": "Semis",
    "date": "2017-03-28",
    "year": 2017
  },
  "t5FEHpSxWvE": {
    "badgeNumber": "#047",
    "badgeIndex": 47,
    "affTeam": "Nueva MS",
    "negTeam": "Green Valley BP",
    "title": "Nueva MS vs Green Valley BP ASU 2017 Finals",
    "tournament": "ASU 2017",
    "roundLevel": "Finals",
    "date": "2017-04-19",
    "year": 2017
  },
  "-MJyPy89b24": {
    "badgeNumber": "#048",
    "badgeIndex": 48,
    "affTeam": "Desoto Central NN",
    "negTeam": "Ardrey Kell KW",
    "title": "Desoto Central NN vs Ardrey Kell KW NCFL Finals",
    "tournament": "NCFL",
    "roundLevel": "Finals",
    "date": "2017-06-07",
    "year": 2017
  },
  "xWBbAEuMlLU": {
    "badgeNumber": "#049",
    "badgeIndex": 49,
    "affTeam": "Woodward",
    "negTeam": "MBA",
    "title": "Barkley Forum Finals 2017 - Woodward v MBA - Part 1",
    "tournament": "Barkley Forum 2017",
    "roundLevel": "Finals",
    "date": "2017-08-09",
    "year": 2017
  },
  "OB3bJ_RN0RY": {
    "badgeNumber": "#050",
    "badgeIndex": 50,
    "affTeam": "Newton South GS",
    "negTeam": "Millburn CZ",
    "title": "Newton South GS vs Millburn CZ Yale Finals",
    "tournament": "Yale",
    "roundLevel": "Finals",
    "date": "2017-11-10",
    "year": 2017
  },
  "HXGNNhOxrBw": {
    "badgeNumber": "#051",
    "badgeIndex": 51,
    "affTeam": "Greenhill EG",
    "negTeam": "MBA BJ",
    "title": "2018 Policy Debate Finals at the Barkley Forum High School Debate Tournament",
    "tournament": "Barkley Forum",
    "roundLevel": "Finals",
    "date": "2018-02-04",
    "year": 2018
  },
  "oYfCvuekHeY": {
    "badgeNumber": "#052",
    "badgeIndex": 52,
    "affTeam": "Kentucky BT",
    "negTeam": "Northwestern CE",
    "title": "Kentucky BT vs Northwestern CE - NDT - RD 3 - 2018 - Part 1",
    "tournament": "NDT",
    "roundLevel": "3",
    "date": "2018-03-24",
    "year": 2018
  },
  "US-pxWceS0E": {
    "badgeNumber": "#053",
    "badgeIndex": 53,
    "affTeam": "Kentucky BT",
    "negTeam": "Northwestern CE",
    "title": "Kentucky BT vs Northwestern CE -  - RD 3 - 2018 - Part 2",
    "tournament": "NDT",
    "roundLevel": "3",
    "date": "2018-03-24",
    "year": 2018
  },
  "0hUZLdmkji0": {
    "badgeNumber": "#054",
    "badgeIndex": 54,
    "affTeam": "Kentucky BT",
    "negTeam": "OU JS",
    "title": "NDT 2018 Round 6 Aff: Kentucky BT vs Neg: OU JS",
    "tournament": "NDT 2018",
    "roundLevel": "Round 6",
    "date": "2018-03-25",
    "year": 2018
  },
  "naydbVyiCM8": {
    "badgeNumber": "#055",
    "badgeIndex": 55,
    "affTeam": "Georgetown BK",
    "negTeam": "OU PS",
    "title": "NDT 2018 Round Quarters Aff: Georgetown BK vs Neg: OU PS",
    "tournament": "NDT 2018 Round",
    "roundLevel": "Quarters",
    "date": "2018-03-26",
    "year": 2018
  },
  "HUuMbUHv_9g": {
    "badgeNumber": "#056",
    "badgeIndex": 56,
    "affTeam": "Georgetown BK",
    "negTeam": "Kansas KR",
    "title": "NDT 2018 Round Finals Aff: Georgetown BK vs Neg: Kansas KR",
    "tournament": "NDT 2018 Round",
    "roundLevel": "Finals",
    "date": "2018-03-27",
    "year": 2018
  },
  "WCr0-br9woQ": {
    "badgeNumber": "#057",
    "badgeIndex": 57,
    "affTeam": "Georgetown BK",
    "negTeam": "Kansas KR",
    "title": "NDT 2018 Round Finals Aff: Georgetown BK vs Neg: Kansas KR",
    "tournament": "NDT 2018 Round",
    "roundLevel": "Finals",
    "date": "2018-03-27",
    "year": 2018
  },
  "31AFA6HJThc": {
    "badgeNumber": "#058",
    "badgeIndex": 58,
    "affTeam": "BVSW KL",
    "negTeam": "Monta Vista PS",
    "title": "2018 TOC Finals - BVSW KL vs Monta Vista PS",
    "tournament": "TOC",
    "roundLevel": "Finals",
    "date": "2018-05-02",
    "year": 2018
  },
  "q-XCGvKrbS4": {
    "badgeNumber": "#059",
    "badgeIndex": 59,
    "affTeam": "Quarry Lane AS",
    "negTeam": "Presentation VM ",
    "title": "Quarry Lane AS vs Presentation VM Alta Finals",
    "tournament": "Alta",
    "roundLevel": "Finals",
    "date": "2018-05-15",
    "year": 2018
  },
  "RP_81CItgcE": {
    "badgeNumber": "#060",
    "badgeIndex": 60,
    "affTeam": " Santa Monica RE",
    "negTeam": "Greenhill BZ",
    "title": "2018 Tournament of Champions Finals Santa Monica RE (Aff) vs Greenhill BZ (Neg)",
    "tournament": "2018 TOC",
    "roundLevel": "Finals",
    "date": "2018-07-22",
    "year": 2018
  },
  "jZApiw1vhWg": {
    "badgeNumber": "#061",
    "badgeIndex": 61,
    "affTeam": "Michigan PP",
    "negTeam": "Wake EF",
    "title": "Michigan PP vs Wake EF, University of KY, Open Round 8",
    "tournament": "University of KY",
    "roundLevel": "Open Round 8",
    "date": "2018-10-01",
    "year": 2018
  },
  "VtNFoexHpI0": {
    "badgeNumber": "#062",
    "badgeIndex": 62,
    "affTeam": "Emory GS",
    "negTeam": "Kentucky BT",
    "title": "Gonzaga 2018 Finals: Emory GS vs Kentucky BT",
    "tournament": "Gonzaga 2018",
    "roundLevel": "Finals",
    "date": "2018-11-07",
    "year": 2018
  },
  "QGtthmCOQTE": {
    "badgeNumber": "#063",
    "badgeIndex": 63,
    "affTeam": "Ames AM",
    "negTeam": "Acton Boxborough GL",
    "title": "Ames AM vs Acton Boxborough GL University of Kentucky 2018 Finals",
    "tournament": "University of Kentucky 2018",
    "roundLevel": "Finals",
    "date": "2019-02-13",
    "year": 2019
  },
  "wMRhPz2PZ3M": {
    "badgeNumber": "#064",
    "badgeIndex": 64,
    "affTeam": "Wichita State WL",
    "negTeam": "Emory GS",
    "title": "Wichita State WL vs Emory GS, NDT 2019, Round the First",
    "tournament": "NDT 2019",
    "roundLevel": "Round the First",
    "date": "2019-03-22",
    "year": 2019
  },
  "Mfjij74hsMU": {
    "badgeNumber": "#065",
    "badgeIndex": 65,
    "affTeam": "Michigan GW",
    "negTeam": "Wake EF",
    "title": "Michigan GW vs Wake EF, 2019 NDT, Round the Fourth",
    "tournament": "NDT 2019",
    "roundLevel": "Round Fourth",
    "date": "2019-03-23",
    "year": 2019
  },
  "MO0b3_qPEA8": {
    "badgeNumber": "#066",
    "badgeIndex": 66,
    "affTeam": "Michigan JR",
    "negTeam": "Oklahoma PW",
    "title": "Michigan JR vs Oklahoma PW, 2019 NDT, Round the Fifth",
    "tournament": "NDT 2019",
    "roundLevel": "Round Fifth",
    "date": "2019-03-23",
    "year": 2019
  },
  "Vwez3WK4LgY": {
    "badgeNumber": "#067",
    "badgeIndex": 67,
    "affTeam": "Michigan GW",
    "negTeam": "Kentucky BT",
    "title": "Michigan GW vs Kentucky BT, 2019 NDT, Round the Eighth",
    "tournament": "NDT 2019",
    "roundLevel": "Round Eighth",
    "date": "2019-03-24",
    "year": 2019
  },
  "X35P3AWDU8I": {
    "badgeNumber": "#068",
    "badgeIndex": 68,
    "affTeam": "Northwestern JW",
    "negTeam": "Kentucky BT",
    "title": "Northwestern JW vs Kentucky BT, 2019 NDT, Round the Sixth",
    "tournament": "NDT 2019",
    "roundLevel": "Round Sixth",
    "date": "2019-03-24",
    "year": 2019
  },
  "QTkvbgOKrdY": {
    "badgeNumber": "#069",
    "badgeIndex": 69,
    "affTeam": "Georgia RS",
    "negTeam": "Kentucky BT",
    "title": "NDT 2019 Finals: Georgia RS vs Kentucky BT",
    "tournament": "NDT 2019",
    "roundLevel": "Finals",
    "date": "2019-04-01",
    "year": 2019
  },
  "MxGXYljDoog": {
    "badgeNumber": "#070",
    "badgeIndex": 70,
    "affTeam": "Oklahoma PW",
    "negTeam": "Kansas BD",
    "title": "2019 CEDA National Finals - Oklahoma PW (Aff) vs Kansas BD (Neg)",
    "tournament": "2019 CEDA",
    "roundLevel": "Finals",
    "date": "2019-04-08",
    "year": 2019
  },
  "_XU92LHHk2Y": {
    "badgeNumber": "#071",
    "badgeIndex": 71,
    "affTeam": "North Broward MR",
    "negTeam": "MBA BH",
    "title": "2019 TOC Finals - North Broward MR vs MBA BH",
    "tournament": "2019 TOC",
    "roundLevel": "Finals",
    "date": "2019-05-06",
    "year": 2019
  },
  "2LOULtgTX6I": {
    "badgeNumber": "#072",
    "badgeIndex": 72,
    "affTeam": "Corona Del Sol PJ",
    "negTeam": "Poly Prep FK",
    "title": "Corona Del Sol PJ vs. Poly Prep FK Emory Finals 2019",
    "tournament": "Emory 2019",
    "roundLevel": "Finals",
    "date": "2019-05-22",
    "year": 2019
  },
  "CBf2B5l-z2c": {
    "badgeNumber": "#073",
    "badgeIndex": 73,
    "affTeam": "Poly Prep FK",
    "negTeam": "Bronx OS",
    "title": "Poly Prep FK vs. Bronx OS Harvard Finals 2019",
    "tournament": "Harvard 2019",
    "roundLevel": "Finals",
    "date": "2019-05-22",
    "year": 2019
  },
  "GNsjygSkWMI": {
    "badgeNumber": "#074",
    "badgeIndex": 74,
    "affTeam": "Corona Del Sol PJ",
    "negTeam": "Mission San Joe KM",
    "title": "Corona Del Sol PJ vs. Mission San Joe KM ASU Finals 2019",
    "tournament": "ASU 2019",
    "roundLevel": "Finals",
    "date": "2019-05-22",
    "year": 2019
  },
  "LF6LCxS7NMI": {
    "badgeNumber": "#075",
    "badgeIndex": 75,
    "affTeam": "Blake GJ",
    "negTeam": "Lincoln-Sudbury",
    "title": "Blake GJ vs. Lincoln-Sudbury ToC Finals 2019",
    "tournament": "ToC",
    "roundLevel": "Finals",
    "date": "2019-05-22",
    "year": 2019
  },
  "PPqXsD1vrng": {
    "badgeNumber": "#076",
    "badgeIndex": 76,
    "affTeam": "Bronx OS",
    "negTeam": "Lake Highland KO",
    "title": "Bronx OS vs. Lake Highland KO Glenbrooks Finals",
    "tournament": "Glenbrooks",
    "roundLevel": "Finals",
    "date": "2019-05-22",
    "year": 2019
  },
  "IHXm5XWN0v8": {
    "badgeNumber": "#077",
    "badgeIndex": 77,
    "affTeam": "Cypress Bay BG",
    "negTeam": "Lake Mary Prep HM",
    "title": "Cypress Bay BG vs. Lake Mary Prep HM Sunvitational Finals",
    "tournament": "Sunvitational",
    "roundLevel": "Finals",
    "date": "2019-06-04",
    "year": 2019
  },
  "wwBWNFRX0rM": {
    "badgeNumber": "#078",
    "badgeIndex": 78,
    "affTeam": "Campbell Hall DL",
    "negTeam": "Hunter XB",
    "title": "Campbell Hall DL vs. Hunter XB Yale Finals 2019",
    "tournament": "Yale 2019",
    "roundLevel": "Finals",
    "date": "2019-11-05",
    "year": 2019
  },
  "RadFikr5sSM": {
    "badgeNumber": "#079",
    "badgeIndex": 79,
    "affTeam": "Cinco Ranch RT",
    "negTeam": "VIP BL",
    "title": "Cinco Ranch RT vs. VIP BL Bronx Finals",
    "tournament": "Bronx",
    "roundLevel": "Finals",
    "date": "2019-11-11",
    "year": 2019
  },
  "uMuVID0ESTo": {
    "badgeNumber": "#080",
    "badgeIndex": 80,
    "affTeam": "Dartmouth ET",
    "negTeam": "UC Berkeley FG",
    "title": "Shirley 2019 Rd 6 - Dartmouth ET (Aff) vs. UC Berkeley FG (Neg)",
    "tournament": "Shirley 2019 Rd 6",
    "roundLevel": null,
    "date": "2019-11-24",
    "year": 2019
  },
  "gAy3XvS5GMk": {
    "badgeNumber": "#081",
    "badgeIndex": 81,
    "affTeam": "Dartmouth ET",
    "negTeam": "Michigan PR",
    "title": "Shirley 2019 Quarters - Dartmouth ET (aff) vs Michigan PR (neg)",
    "tournament": "Shirley 2019",
    "roundLevel": "Quarters",
    "date": "2019-11-25",
    "year": 2019
  },
  "roGMqV2y3Ug": {
    "badgeNumber": "#082",
    "badgeIndex": 82,
    "affTeam": "Lake Highland SK",
    "negTeam": "North Broward KP",
    "title": "Lake Highland SK vs. North Broward KP Blue Key Finals 2019",
    "tournament": "Blue Key 2019",
    "roundLevel": "Finals",
    "date": "2019-12-24",
    "year": 2019
  },
  "Jq9r1bLsN7Q": {
    "badgeNumber": "#083",
    "badgeIndex": 83,
    "affTeam": "Bronx OS",
    "negTeam": "Acton LM",
    "title": "Bronx OS vs. Acton LM Princeton Finals 2019",
    "tournament": "Princeton 2019",
    "roundLevel": "Finals",
    "date": "2019-12-26",
    "year": 2019
  },
  "tZqwy1EhBI0": {
    "badgeNumber": "#084",
    "badgeIndex": 84,
    "affTeam": "Blake PS",
    "negTeam": "Edina MZ",
    "title": "Blake PS vs. Edina MZ Apple Valley Finals 2019",
    "tournament": "Apple Valley 2019",
    "roundLevel": "Finals",
    "date": "2019-12-26",
    "year": 2019
  },
  "Z8GiPKNUmSQ": {
    "badgeNumber": "#085",
    "badgeIndex": 85,
    "affTeam": "Cinco Ranch RT",
    "negTeam": "Strake AJ",
    "title": "Cinco Ranch RT vs Strake AJ Emory Finals 2020",
    "tournament": "Emory 2020",
    "roundLevel": "Finals",
    "date": "2020-01-31",
    "year": 2020
  },
  "BRyse9mvMO4": {
    "badgeNumber": "#086",
    "badgeIndex": 86,
    "affTeam": "Blake JS",
    "negTeam": "University KK",
    "title": "Blake JS vs University KK Blake Finals 2020",
    "tournament": "Blake 2020",
    "roundLevel": "Finals",
    "date": "2020-02-03",
    "year": 2020
  },
  "zOG7G_yg7Qo": {
    "badgeNumber": "#087",
    "badgeIndex": 87,
    "affTeam": "Blake JS",
    "negTeam": "Fairmont Prep GJ",
    "title": "Blake JS vs Fairmont Prep GJ Glenbrooks Finals 2019",
    "tournament": "Glenbrooks 2019",
    "roundLevel": "Finals",
    "date": "2020-03-01",
    "year": 2020
  },
  "E6zoqh9GA-k": {
    "badgeNumber": "#088",
    "badgeIndex": 88,
    "affTeam": "Acton NH",
    "negTeam": "Ridge RS",
    "title": "Acton NH vs Ridge RS UPenn Finals 2020",
    "tournament": "UPenn 2020",
    "roundLevel": "Finals",
    "date": "2020-03-16",
    "year": 2020
  },
  "9tREemyPwyg": {
    "badgeNumber": "#089",
    "badgeIndex": 89,
    "affTeam": "Plano West NY",
    "negTeam": "Thomas Wootton TZ",
    "title": "Plano West NY vs Thomas Wootton TZ Harvard Finals 2020",
    "tournament": "Harvard 2020",
    "roundLevel": "Finals",
    "date": "2020-03-23",
    "year": 2020
  },
  "IcQGl6R0WbI": {
    "badgeNumber": "#090",
    "badgeIndex": 90,
    "affTeam": "Blake JS",
    "negTeam": "Hawken EG",
    "title": "Blake JS vs Hawken EG TOC Semis 2020",
    "tournament": "TOC 2020",
    "roundLevel": "Semis",
    "date": "2020-06-26",
    "year": 2020
  },
  "llNpyCq0L8Q": {
    "badgeNumber": "#091",
    "badgeIndex": 91,
    "affTeam": "Blake JS",
    "negTeam": "Westlake DL",
    "title": "Blake JS vs Westlake DL TOC Finals 2020",
    "tournament": "TOC 2020",
    "roundLevel": "Finals",
    "date": "2020-06-26",
    "year": 2020
  },
  "Ku_RjjQnfOA": {
    "badgeNumber": "#092",
    "badgeIndex": 92,
    "affTeam": "Montgomery Blair JQ",
    "negTeam": "Thomas Wootton TZ",
    "title": "Montgomery Blair JQ vs Thomas Wootton TZ  Finals",
    "tournament": "Capitol",
    "roundLevel": "Finals",
    "date": "2020-08-08",
    "year": 2020
  },
  "NFz7_0eNs6s": {
    "badgeNumber": "#093",
    "badgeIndex": 93,
    "affTeam": "Kansas MR",
    "negTeam": "Michigan State AM",
    "title": "NDT Round 2, Kansas MR (AFF) vs. Michigan State AM (NEG)",
    "tournament": "NDT 2021",
    "roundLevel": "Round 2",
    "date": "2021-03-27",
    "year": 2021
  },
  "HDsERK_Lg0A": {
    "badgeNumber": "#094",
    "badgeIndex": 94,
    "affTeam": "Dartmouth TV",
    "negTeam": "UC Berkeley BW",
    "title": "NDT 2021 Round 4: Dartmouth TV (Aff) v. UC Berkeley BW (Neg)",
    "tournament": "NDT 2021",
    "roundLevel": "Round 4",
    "date": "2021-03-28",
    "year": 2021
  },
  "MncTOs0XitY": {
    "badgeNumber": "#095",
    "badgeIndex": 95,
    "affTeam": "Michigan PR",
    "negTeam": "UC Berkeley BW",
    "title": "NDT 2021 Round 6: Michigan PR (Aff) v. UC Berkeley BW (Neg)",
    "tournament": "NDT 2021",
    "roundLevel": "Round 6",
    "date": "2021-03-28",
    "year": 2021
  },
  "BBE96h4KEWc": {
    "badgeNumber": "#096",
    "badgeIndex": 96,
    "affTeam": "Cal Berkeley BW",
    "negTeam": "Northwestern FW",
    "title": "NDT Octos: Cal Berkeley BW (Aff) v. Northwestern FW (Neg)",
    "tournament": "NDT 2021",
    "roundLevel": "Octos",
    "date": "2021-03-29",
    "year": 2021
  },
  "rDqM4Ov-Q-I": {
    "badgeNumber": "#097",
    "badgeIndex": 97,
    "affTeam": "Dartmouth TV",
    "negTeam": "Emory GK",
    "title": "Round 8: Dartmouth TV (aff) vs Emory GK (neg)",
    "tournament": "NDT 2021",
    "roundLevel": "Round 8",
    "date": "2021-03-29",
    "year": 2021
  },
  "HyQVxF-Yge8": {
    "badgeNumber": "#098",
    "badgeIndex": 98,
    "affTeam": "Kansas MR",
    "negTeam": "UC Berkeley EE",
    "title": "2021 NDT - Octas - Kansas MR (Aff) vs. UC Berkeley EE (Neg)",
    "tournament": "NDT 2021",
    "roundLevel": "Octos",
    "date": "2021-03-30",
    "year": 2021
  },
  "ODG_2FjfIB0": {
    "badgeNumber": "#099",
    "badgeIndex": 99,
    "affTeam": "Michigan PS",
    "negTeam": "Kentucky DG",
    "title": "NDT 2021 - Doubles - Michigan PS (Aff) vs Kentucky DG (Neg)",
    "tournament": "NDT 2021",
    "roundLevel": "Doubles",
    "date": "2021-03-30",
    "year": 2021
  },
  "pHjLAQQxuvI": {
    "badgeNumber": "#100",
    "badgeIndex": 100,
    "affTeam": "Michigan",
    "negTeam": "Wake",
    "title": "NDT 2021 - Octos - Michigan vs Wake",
    "tournament": "NDT 2021",
    "roundLevel": "Octos",
    "date": "2021-03-30",
    "year": 2021
  },
  "nus-tro3ngE": {
    "badgeNumber": "#101",
    "badgeIndex": 101,
    "affTeam": "Dartmouth TV",
    "negTeam": "Michigan PR",
    "title": "NDT Finals: Dartmouth TV (Aff) v. Michigan PR (Neg)",
    "tournament": "NDT 2021",
    "roundLevel": "Finals",
    "date": "2021-03-31",
    "year": 2021
  },
  "_JJidh7JFbc": {
    "badgeNumber": "#102",
    "badgeIndex": 102,
    "affTeam": "Round - Notre Dame (A)",
    "negTeam": "Wake Forest (N)",
    "title": "2021 ACC Debate Tournament - Final Round - Notre Dame (A) vs Wake Forest (N)",
    "tournament": "2021 ACC Debate Tournament",
    "roundLevel": "Final",
    "date": "2021-04-10",
    "year": 2021
  },
  "Tuj2lGTpizk": {
    "badgeNumber": "#103",
    "badgeIndex": 103,
    "affTeam": "Northwestern DF",
    "negTeam": "Michigan PR",
    "title": "2022 Texas Open Semis - Northwestern DF vs Michigan PR",
    "tournament": "2022 Texas Open",
    "roundLevel": "Semis",
    "date": "2022-02-07",
    "year": 2022
  },
  "ETwUQkylUzM": {
    "badgeNumber": "#104",
    "badgeIndex": 104,
    "affTeam": "GMU BG",
    "negTeam": "Harvard BH",
    "title": "NDT 2022 - Round the Fifth - GMU BG (Aff) v. Harvard BH (Neg)",
    "tournament": "NDT 2022",
    "roundLevel": "Round Fifth",
    "date": "2022-04-03",
    "year": 2022
  },
  "o-5gKeAT4yE": {
    "badgeNumber": "#105",
    "badgeIndex": 105,
    "affTeam": "Kansas MS",
    "negTeam": "Dartmouth BC",
    "title": "NDT 2022 - Round the Sixth - Kansas MS (Aff) v. Dartmouth BC (Neg)",
    "tournament": "NDT 2022",
    "roundLevel": "Round Sixth",
    "date": "2022-04-03",
    "year": 2022
  },
  "9BDL0HnPKow": {
    "badgeNumber": "#106",
    "badgeIndex": 106,
    "affTeam": "UC Berkeley EE",
    "negTeam": "Dartmouth SV",
    "title": "NDT 2022 - Round the Seventh - UC Berkeley EE (Aff) v. Dartmouth SV (Neg)",
    "tournament": "NDT 2022",
    "roundLevel": "Round Seventh",
    "date": "2022-04-04",
    "year": 2022
  },
  "Cih82t0t-Go": {
    "badgeNumber": "#107",
    "badgeIndex": 107,
    "affTeam": "Wichita State HP",
    "negTeam": "GMU BG",
    "title": "NDT 2022 - Doubles - Wichita State HP (Aff) v. GMU BG (Neg)",
    "tournament": "NDT 2022",
    "roundLevel": "Doubles",
    "date": "2022-04-04",
    "year": 2022
  },
  "GCCmzykZcZI": {
    "badgeNumber": "#108",
    "badgeIndex": 108,
    "affTeam": "Southern California KS",
    "negTeam": "Dartmouth SV",
    "title": "NDT 2022 - Semis - Southern California KS (Aff) v. Dartmouth SV (Neg)",
    "tournament": "NDT 2022",
    "roundLevel": "Semis",
    "date": "2022-04-05",
    "year": 2022
  },
  "l-fZ8ZIzDPw": {
    "badgeNumber": "#109",
    "badgeIndex": 109,
    "affTeam": "Northwestern DF",
    "negTeam": "Southern California KS",
    "title": "NDT 2022 - Quarters - Northwestern DF (Aff) v. Southern California KS (Neg)",
    "tournament": "NDT 2022",
    "roundLevel": "Quarters",
    "date": "2022-04-05",
    "year": 2022
  },
  "qx7Xx_6exzk": {
    "badgeNumber": "#110",
    "badgeIndex": 110,
    "affTeam": "Dartmouth SV",
    "negTeam": "Michigan PR",
    "title": "NDT 2022 - Finals - Dartmouth SV (Aff) vs Michigan PR (Neg)",
    "tournament": "NDT 2022",
    "roundLevel": "Finals",
    "date": "2022-04-05",
    "year": 2022
  },
  "vB9XKP5YfHc": {
    "badgeNumber": "#111",
    "badgeIndex": 111,
    "affTeam": "Round - Wake Forest(A)",
    "negTeam": "Miami (N)",
    "title": "2022 ACC Debate Tournament - Final Round - Wake Forest(A) vs Miami (N)",
    "tournament": "2022 ACC Debate Tournament",
    "roundLevel": "Final",
    "date": "2022-05-01",
    "year": 2022
  },
  "VxMkLzgNjm0": {
    "badgeNumber": "#112",
    "badgeIndex": 112,
    "affTeam": "Brentwood HM",
    "negTeam": "Strake Jesuit DG",
    "title": "Brentwood HM vs Strake Jesuit DG TOC Finals 2022 With RFDs",
    "tournament": "TOC 2022",
    "roundLevel": "Finals",
    "date": "2022-09-05",
    "year": 2022
  },
  "iRT2sewcemg": {
    "badgeNumber": "#113",
    "badgeIndex": 113,
    "affTeam": "Seven Lakes ML",
    "negTeam": "Delbarton CE",
    "title": "Seven Lakes ML vs Delbarton CE Blake Finals 2022",
    "tournament": "Blake 2022",
    "roundLevel": "Finals",
    "date": "2022-12-28",
    "year": 2022
  },
  "IHx8bmT8GeY": {
    "badgeNumber": "#114",
    "badgeIndex": 114,
    "affTeam": "Emory HL",
    "negTeam": "Dartmouth SV",
    "title": "Georgetown 2023 Round 7: Emory HL (Aff) v Dartmouth SV (Neg)",
    "tournament": "Georgetown 2023",
    "roundLevel": "Round 7",
    "date": "2023-01-09",
    "year": 2023
  },
  "6oOJPAtgF0A": {
    "badgeNumber": "#115",
    "badgeIndex": 115,
    "affTeam": "LC Anderson BC",
    "negTeam": "Strake Jesuit DY",
    "title": "Barkley Forum Finals 2023 | LC Anderson BC (Aff) vs Strake Jesuit DY | Public Forum Debate",
    "tournament": "Barkley Forum",
    "roundLevel": "Finals",
    "date": "2023-02-09",
    "year": 2023
  },
  "Cv9lQsA7rvQ": {
    "badgeNumber": "#116",
    "badgeIndex": 116,
    "affTeam": "Hamilton NT",
    "negTeam": "Mission San Jose VP",
    "title": "ASU Finals 2023 | Hamilton NT (Aff) vs Mission San Jose VP   | Public Forum Debate",
    "tournament": "ASU",
    "roundLevel": "Finals",
    "date": "2023-02-09",
    "year": 2023
  },
  "AKrK-ONaO0g": {
    "badgeNumber": "#117",
    "badgeIndex": 117,
    "affTeam": "Michigan PP",
    "negTeam": "Amherst JM",
    "title": "NDT 2023 - Round the Second - Michigan PP (AFF) v. Amherst JM (NEG)",
    "tournament": "NDT 2023",
    "roundLevel": "Round Second",
    "date": "2023-03-31",
    "year": 2023
  },
  "Kc-QrcxrkCw": {
    "badgeNumber": "#118",
    "badgeIndex": 118,
    "affTeam": "Michigan PP",
    "negTeam": "Emory GK",
    "title": "NDT 2023 - Semis - Michigan PP (AFF) v. Emory GK (NEG)",
    "tournament": "NDT 2023",
    "roundLevel": "Semis",
    "date": "2023-04-04",
    "year": 2023
  },
  "NBzGKSQwldk": {
    "badgeNumber": "#119",
    "badgeIndex": 119,
    "affTeam": "Michigan PP",
    "negTeam": "Wake Forest RT",
    "title": "NDT 2023 - Finals - Michigan PP (AFF) vs. Wake Forest RT (NEG)",
    "tournament": "NDT 2023",
    "roundLevel": "Finals",
    "date": "2023-04-04",
    "year": 2023
  },
  "LZzzQ33tg8M": {
    "badgeNumber": "#120",
    "badgeIndex": 120,
    "affTeam": "Wake BD",
    "negTeam": "Emporia SR",
    "title": "CEDA 2023 Semis-Wake BD (AFF) v Emporia SR (NEG)",
    "tournament": "CEDA 2023",
    "roundLevel": "Semis",
    "date": "2023-04-12",
    "year": 2023
  },
  "_oQlFJI23JA": {
    "badgeNumber": "#121",
    "badgeIndex": 121,
    "affTeam": "MBA CM",
    "negTeam": "LASA CH",
    "title": "2023 TOC Finals - MBA CM vs LASA CH",
    "tournament": "2023 TOC",
    "roundLevel": "Finals",
    "date": "2023-04-18",
    "year": 2023
  },
  "1snKajTZGE4": {
    "badgeNumber": "#122",
    "badgeIndex": 122,
    "affTeam": "Harker MK",
    "negTeam": "Strake Jesuit KS",
    "title": "2023 Tournament of Champions LD Finals: Harker MK vs Strake Jesuit KS",
    "tournament": "2023 TOC",
    "roundLevel": "Finals",
    "date": "2023-04-25",
    "year": 2023
  },
  "fR72n4mkX9U": {
    "badgeNumber": "#123",
    "badgeIndex": 123,
    "affTeam": "Harker MK",
    "negTeam": "Greenhill AK",
    "title": "2023 Tournament of Champions LD Semis: Harker MK vs Greenhill AK",
    "tournament": "2023 TOC",
    "roundLevel": "Semifinals",
    "date": "2023-05-01",
    "year": 2023
  },
  "uzOY_7aPsKI": {
    "badgeNumber": "#124",
    "badgeIndex": 124,
    "affTeam": "Westwood ST",
    "negTeam": "MBA MT",
    "title": "2023 Greenhill RR - Finals - Westwood ST vs MBA MT",
    "tournament": "2023 Greenhill RR",
    "roundLevel": "Finals",
    "date": "2023-09-16",
    "year": 2023
  },
  "Om8tsuZdLPA": {
    "badgeNumber": "#125",
    "badgeIndex": 125,
    "affTeam": "New Trier LS",
    "negTeam": "LASA BD",
    "title": "2023 Texas Finals - New Trier LS vs LASA BD",
    "tournament": "2023 Texas",
    "roundLevel": "Finals",
    "date": "2023-12-06",
    "year": 2023
  },
  "wdYcaFJ5tLM": {
    "badgeNumber": "#126",
    "badgeIndex": 126,
    "affTeam": "Peninsula LL",
    "negTeam": "St. Mark’s BG",
    "title": "2024 Southern Bell Forum - Finals - Peninsula LL vs St. Mark’s BG",
    "tournament": "2024 Southern Bell Forum",
    "roundLevel": "Finals",
    "date": "2024-01-08",
    "year": 2024
  },
  "gAifhxuK8jE": {
    "badgeNumber": "#127",
    "badgeIndex": 127,
    "affTeam": "Texas DK",
    "negTeam": "Michigan PD",
    "title": "Dartmouth RR 2024 - Round 5 - Texas DK vs Michigan PD",
    "tournament": "Dartmouth RR 2024",
    "roundLevel": "Round 5",
    "date": "2024-01-24",
    "year": 2024
  },
  "ISuVoH5Nlx8": {
    "badgeNumber": "#128",
    "badgeIndex": 128,
    "affTeam": "Harvard CC",
    "negTeam": "Texas DK",
    "title": "Dartmouth RR 2024 - Round 7 - Harvard CC vs Texas DK",
    "tournament": "Dartmouth RR 2024",
    "roundLevel": "Round 7",
    "date": "2024-01-24",
    "year": 2024
  },
  "usaFaMR9t64": {
    "badgeNumber": "#129",
    "badgeIndex": 129,
    "affTeam": "Michigan PD",
    "negTeam": "Long Beach OF",
    "title": "Dartmouth RR 2024 - Round 1 - Michigan PD vs Long Beach OF",
    "tournament": "Dartmouth RR 2024",
    "roundLevel": "Round 1",
    "date": "2024-01-24",
    "year": 2024
  },
  "g46renctj54": {
    "badgeNumber": "#130",
    "badgeIndex": 130,
    "affTeam": "Taipei American LY",
    "negTeam": "LASA BD",
    "title": "2024 Thomas Glenn Pelham Silver Key Debate",
    "tournament": "Barkley Forum",
    "roundLevel": "Finals",
    "date": "2024-01-29",
    "year": 2024
  },
  "J2o94bF6O-U": {
    "badgeNumber": "#131",
    "badgeIndex": 131,
    "affTeam": "Emory KR",
    "negTeam": "CSU Long Beach OF",
    "title": "2024 Texas Finals - Emory KR vs CSU Long Beach OF",
    "tournament": "2024 Texas",
    "roundLevel": "Finals",
    "date": "2024-02-06",
    "year": 2024
  },
  "Htg6arI2J90": {
    "badgeNumber": "#132",
    "badgeIndex": 132,
    "affTeam": "Chapin IW",
    "negTeam": "Basis Peoria VG",
    "title": "2024 ASU Finals | Chapin IW vs Basis Peoria VG (Aff) | Public Forum Debate",
    "tournament": "2024 ASU",
    "roundLevel": "Finals",
    "date": "2024-02-15",
    "year": 2024
  },
  "2b9ju4iRiR4": {
    "badgeNumber": "#133",
    "badgeIndex": 133,
    "affTeam": "North Broward AS",
    "negTeam": "Strake GZ",
    "title": "Sunvite 2024 Finals | NSD Closeout: North Broward AS  Vs Strake GZ (Aff)| Public Forum Debate",
    "tournament": "Sunvite 2024",
    "roundLevel": "Finals",
    "date": "2024-02-23",
    "year": 2024
  },
  "xmm_9lWqB7w": {
    "badgeNumber": "#134",
    "badgeIndex": 134,
    "affTeam": "MBA MT",
    "negTeam": "Peninsula LL",
    "title": "2024 Berkeley Finals - MBA MT vs Peninsula LL",
    "tournament": "2024 Berkeley",
    "roundLevel": "Finals",
    "date": "2024-02-23",
    "year": 2024
  },
  "dpGXCqVlbcQ": {
    "badgeNumber": "#135",
    "badgeIndex": 135,
    "affTeam": "Emory KR",
    "negTeam": "Northwestern AR",
    "title": "NDT 2024 Emory KR vs. Northwestern AR",
    "tournament": "NDT 2024",
    "roundLevel": null,
    "date": "2024-04-05",
    "year": 2024
  },
  "upz43wcTOC0": {
    "badgeNumber": "#136",
    "badgeIndex": 136,
    "affTeam": "MSU GM",
    "negTeam": "Michigan PD",
    "title": "NDT 2024 Doubles MSU GM v Michigan PD",
    "tournament": "NDT 2024",
    "roundLevel": "Doubles",
    "date": "2024-04-08",
    "year": 2024
  },
  "2M52TF8jRK0": {
    "badgeNumber": "#137",
    "badgeIndex": 137,
    "affTeam": "Michigan PD",
    "negTeam": "Emory KR",
    "title": "NDT 24 — Semis — Michigan PD (AFF) vs. Emory KR (NEG)",
    "tournament": "NDT 24",
    "roundLevel": "Semis",
    "date": "2024-04-09",
    "year": 2024
  },
  "SLsU8RbunG4": {
    "badgeNumber": "#138",
    "badgeIndex": 138,
    "affTeam": "Kansas RS",
    "negTeam": "Michigan PD",
    "title": "NDT 24 — Finals — Kansas RS (AFF) vs. Michigan PD (NEG)",
    "tournament": "NDT 24",
    "roundLevel": "Finals",
    "date": "2024-04-09",
    "year": 2024
  },
  "E3O_atzOEDI": {
    "badgeNumber": "#139",
    "badgeIndex": 139,
    "affTeam": "Georgetown ZZ",
    "negTeam": "Texas DK",
    "title": "ADA 2024 — Semis — Georgetown ZZ [AFF] vs. Texas DK [NEG]",
    "tournament": "ADA 2024",
    "roundLevel": "Semis",
    "date": "2024-04-11",
    "year": 2024
  },
  "rPWyYEEtP34": {
    "badgeNumber": "#140",
    "badgeIndex": 140,
    "affTeam": "Kentucky DG",
    "negTeam": "Dartmouth VW",
    "title": "NDT 2024 Round 1: Kentucky DG (Aff) v Dartmouth VW (Neg)",
    "tournament": "NDT 2024",
    "roundLevel": "Round 1",
    "date": "2024-04-11",
    "year": 2024
  },
  "e478K-QyfXM": {
    "badgeNumber": "#141",
    "badgeIndex": 141,
    "affTeam": "Notre Dame",
    "negTeam": "Georgia Tech",
    "title": "2024 ACC Debate Tournament - Notre Dame vs Georgia Tech",
    "tournament": "2024 ACC Debate Tournament",
    "roundLevel": null,
    "date": "2024-04-21",
    "year": 2024
  },
  "HsAdCYnCjTY": {
    "badgeNumber": "#142",
    "badgeIndex": 142,
    "affTeam": "MBA MT",
    "negTeam": "Westwood ST",
    "title": "2024 TOC - Finals - MBA MT vs Westwood ST",
    "tournament": "2024 TOC",
    "roundLevel": "Finals",
    "date": "2024-04-24",
    "year": 2024
  },
  "Ce939oCHxLM": {
    "badgeNumber": "#143",
    "badgeIndex": 143,
    "affTeam": "Emory GH",
    "negTeam": "Kansas RM",
    "title": "Northwestern OLC 2024 Finals - Emory GH [Aff] vs Kansas RM [Neg] - Griffith, Vazquez Torres, Shankar",
    "tournament": "Northwestern",
    "roundLevel": "Finals",
    "date": "2024-09-17",
    "year": 2024
  },
  "kmVZtnwF724": {
    "badgeNumber": "#144",
    "badgeIndex": 144,
    "affTeam": "MBA HM",
    "negTeam": "Greenhill CL",
    "title": "2024 Greenhill RR - Finals - MBA HM vs Greenhill CL",
    "tournament": "2024 Greenhill RR",
    "roundLevel": "Finals",
    "date": "2024-09-21",
    "year": 2024
  },
  "D8CigCmzW7w": {
    "badgeNumber": "#145",
    "badgeIndex": 145,
    "affTeam": "Emory GH",
    "negTeam": "Kansas MR",
    "title": "Northwestern 2024 Finals: Emory GH vs Kansas MR",
    "tournament": "Northwestern 2024",
    "roundLevel": "Finals",
    "date": "2024-10-01",
    "year": 2024
  },
  "oQG6J7_cHyA": {
    "badgeNumber": "#146",
    "badgeIndex": 146,
    "affTeam": "Dartmouth BC",
    "negTeam": "Northwestern DR",
    "title": "Harvard 2024 Finals: Dartmouth BC vs Northwestern DR",
    "tournament": "Harvard 2024",
    "roundLevel": "Finals",
    "date": "2024-10-19",
    "year": 2024
  },
  "saai3Z8p3q4": {
    "badgeNumber": "#147",
    "badgeIndex": 147,
    "affTeam": "Michigan BP",
    "negTeam": "Kentucky AM",
    "title": "Shirley 2024 Semis: Michigan BP vs Kentucky AM",
    "tournament": "Shirley 2024",
    "roundLevel": "Semis",
    "date": "2024-11-15",
    "year": 2024
  },
  "B4mnEOBsSOg": {
    "badgeNumber": "#148",
    "badgeIndex": 148,
    "affTeam": "Wake Forest BM",
    "negTeam": "Kansas RM",
    "title": "Texas Open 2025 Finals — Wake Forest BM (AFF) vs. Kansas RM (NEG)",
    "tournament": "2025 Texas",
    "roundLevel": "Finals",
    "date": "2025-02-03",
    "year": 2025
  },
  "pGqZP12p47w": {
    "badgeNumber": "#149",
    "badgeIndex": 149,
    "affTeam": "Dartmouth BC",
    "negTeam": "Kansas MR",
    "title": "NDT 2025 Semis: Dartmouth BC vs Kansas MR",
    "tournament": "NDT 2025",
    "roundLevel": "Semis",
    "date": "2025-04-01",
    "year": 2025
  },
  "GfmlpAJyxl4": {
    "badgeNumber": "#150",
    "badgeIndex": 150,
    "affTeam": "Dartmouth BC",
    "negTeam": "Kansas MR",
    "title": "2025 NDT Semis - Dartmouth BC vs Kansas MR",
    "tournament": "2025 NDT",
    "roundLevel": "Semis",
    "date": "2025-04-08",
    "year": 2025
  },
  "sVEkHJLOFjk": {
    "badgeNumber": "#151",
    "badgeIndex": 151,
    "affTeam": "Binghamton CT",
    "negTeam": "CSU Long Beach OM",
    "title": "2025 NDT Semis - Binghamton CT vs CSU Long Beach OM",
    "tournament": "2025 NDT",
    "roundLevel": "Semis",
    "date": "2025-04-09",
    "year": 2025
  },
  "VON0TlT9oik": {
    "badgeNumber": "#152",
    "badgeIndex": 152,
    "affTeam": "Greenhill CL",
    "negTeam": "Northview CT",
    "title": "2025 TOC Finals - Greenhill CL vs Northview CT",
    "tournament": "2025 TOC",
    "roundLevel": "Finals",
    "date": "2025-04-29",
    "year": 2025
  },
  "zi8y1sl2gBk": {
    "badgeNumber": "#153",
    "badgeIndex": 153,
    "affTeam": "Harker LL",
    "negTeam": "Nueva AH",
    "title": "Harker LL vs Nueva AH TOC Runoffs 2025",
    "tournament": "TOC 2025",
    "roundLevel": "Runoffs",
    "date": "2025-04-30",
    "year": 2025
  },
  "nR8JGMeIOKE": {
    "badgeNumber": "#154",
    "badgeIndex": 154,
    "affTeam": "Plano West KL",
    "negTeam": "Strake Jesuit GZ",
    "title": "Plano West KL vs Strake Jesuit GZ TOC Finals 2025",
    "tournament": "TOC 2025",
    "roundLevel": "Finals",
    "date": "2025-05-01",
    "year": 2025
  },
  "L1Jx28Elszw": {
    "badgeNumber": "#155",
    "badgeIndex": 155,
    "affTeam": "Monta Vista TG",
    "negTeam": "Archbishop Mitty AD",
    "title": "NSDA Nationals 2025 - Public Forum Final Round - Monta Vista TG vs Archbishop Mitty AD",
    "tournament": "NSDA Nationals",
    "roundLevel": "Final",
    "date": "2025-09-23",
    "year": 2025
  },
  "LvmBAHcPB-I": {
    "badgeNumber": "#156",
    "badgeIndex": 156,
    "affTeam": "Emory GS",
    "negTeam": "Kansas LS",
    "title": "2025 Shirley - Finals - Emory GS vs Kansas LS - Part 2",
    "tournament": "2025 Shirley",
    "roundLevel": "Finals",
    "date": "2025-11-18",
    "year": 2025
  },
  "uCGzRdrvFbY": {
    "badgeNumber": "#157",
    "badgeIndex": 157,
    "affTeam": "Emory GS",
    "negTeam": "Kansas LS",
    "title": "2025 Shirley - Finals - Emory GS vs Kansas LS - Part 1",
    "tournament": "2025 Shirley",
    "roundLevel": "Finals",
    "date": "2025-11-18",
    "year": 2025
  },
  "GC4VLXhgTX4": {
    "badgeNumber": "#158",
    "badgeIndex": 158,
    "affTeam": "Mission San Jose KM",
    "negTeam": "Lincoln Sudbury CS",
    "title": "[PF REWIND] Mission San Jose KM vs Lincoln Sudbury CS Bronx Finals",
    "tournament": "Bronx",
    "roundLevel": "Finals",
    "date": "2025-12-31",
    "year": 2025
  },
  "RY5Uzc_cxKc": {
    "badgeNumber": "#159",
    "badgeIndex": 159,
    "affTeam": "Lynbrook VV",
    "negTeam": "Harker SD",
    "title": "2026 Cal - Finals - Aff Lynbrook VV vs Neg Harker SD",
    "tournament": "Cal",
    "roundLevel": "Finals",
    "date": "2026-02-18",
    "year": 2026
  },
  "d7IBpoMgURQ": {
    "badgeNumber": "#160",
    "badgeIndex": 160,
    "affTeam": "Peninsula SU",
    "negTeam": "Lynbrook OM",
    "title": "[2026] NDCA Finals - Peninsula SU vs Lynbrook OM",
    "tournament": "NDCA",
    "roundLevel": "Finals",
    "date": "2026-03-23",
    "year": 2026
  },
  "BARblqHEpKA": {
    "badgeNumber": "#161",
    "badgeIndex": 161,
    "affTeam": "CSU Long Beach OM",
    "negTeam": "Georgetown AC",
    "title": "2026 NDT Semis - CSU Long Beach OM vs Georgetown AC",
    "tournament": "NDT 2026",
    "roundLevel": "Semifinals",
    "date": "2026-03-30",
    "year": 2026
  },
  "7hrN33jdYxk": {
    "badgeNumber": "#162",
    "badgeIndex": 162,
    "affTeam": "Emory GS",
    "negTeam": "Michigan SS",
    "title": "NDT 2026 Semis - Emory GS (AFF) vs. Michigan SS (NEG)",
    "tournament": "NDT 2026",
    "roundLevel": "Semifinals",
    "date": "2026-03-31",
    "year": 2026
  },
  "T77G1CdZx9E": {
    "badgeNumber": "#163",
    "badgeIndex": 163,
    "affTeam": "CSU Long Beach OM",
    "negTeam": "Emory GS",
    "title": "NDT 2026 Finals - CSU Long Beach OM (AFF) vs. Emory GS (NEG)",
    "tournament": "NDT 2026",
    "roundLevel": "Finals",
    "date": "2026-03-31",
    "year": 2026
  },
  "o6zZobvjBH8": {
    "badgeNumber": "#164",
    "badgeIndex": 164,
    "affTeam": "Harker LL",
    "negTeam": "Nueva AG",
    "title": "TOC Finals 2026 - Harker LL vs Nueva AG",
    "tournament": "TOC",
    "roundLevel": "Finals",
    "date": "2026-04-13",
    "year": 2026
  },
  "a-YOBMcf8Vw": {
    "badgeNumber": "#165",
    "badgeIndex": 165,
    "affTeam": "GBN CR",
    "negTeam": "MBA HL",
    "title": "TOC FINALS - GBN CR vs MBA HL",
    "tournament": "2026 TOC",
    "roundLevel": "Finals",
    "date": "2026-04-14",
    "year": 2026
  },
  "I4b5N_M6U4M": {
    "badgeNumber": "#166",
    "badgeIndex": 166,
    "affTeam": "Head-Royce AJ",
    "negTeam": "Lynbrook BZ",
    "title": "2026 TOC - Finals - Aff Head Royce AJ vs Neg Lynbrook BZ",
    "tournament": "TOC",
    "roundLevel": "Finals",
    "date": "2026-04-14",
    "year": 2026
  },
  "2YtkrtFnByQ": {
    "badgeNumber": "#167",
    "badgeIndex": 167,
    "affTeam": "SMU",
    "negTeam": "Boston College",
    "title": "2026 ACC Debate Tournament Final - SMU vs Boston College",
    "tournament": "ACC Debate Tournament 2026",
    "roundLevel": "Finals",
    "date": "2026-04-19",
    "year": 2026
  }
};

/**
 * Returns Top Pick badge information for a given video ID, falling back to
 * supplied metadata if the video ID is not in the static precomputed registry.
 *
 * @param videoId - YouTube video ID.
 * @param fallback - Optional contextual metadata for fallback formatting.
 * @returns Complete {@link TopPickBadgeInfo} with badge number and debater teams.
 */
export function getTopPickBadgeInfo(
  videoId: string,
  fallback?: Partial<TopPickBadgeInfo>,
): TopPickBadgeInfo {
  const existing = TOP_PICK_BADGES[videoId];
  if (existing) {
    return {
      ...existing,
      affTeam: fallback?.affTeam ?? existing.affTeam,
      negTeam: fallback?.negTeam ?? existing.negTeam,
      title: fallback?.title ?? existing.title,
      tournament: fallback?.tournament ?? existing.tournament,
      roundLevel: fallback?.roundLevel ?? existing.roundLevel,
      year: fallback?.year ?? existing.year,
    };
  }

  // Fallback for dynamic/newly added top pick videos
  return {
    badgeNumber: fallback?.badgeNumber ?? "#GOAT",
    badgeIndex: fallback?.badgeIndex ?? 0,
    affTeam: fallback?.affTeam ?? null,
    negTeam: fallback?.negTeam ?? null,
    title: fallback?.title ?? null,
    tournament: fallback?.tournament ?? null,
    roundLevel: fallback?.roundLevel ?? null,
    year: fallback?.year ?? null,
    date: fallback?.date ?? null,
  };
}
