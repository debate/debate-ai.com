/**
 * @fileoverview Configuration and metadata for various debate styles.
 * Defines timing, column structures, and roles for formats like Policy,
 * Public Forum, Lincoln Douglas, and others.
 */

import type { DebateStyle, TimerSpeech } from "@/components/debate/DebateTimer/types";


export const debateStyleMap = [
  "publicForum",
  "lincolnDouglas",
  "policy",
  "collegePolicy",
  "collegeLD",
  "congress",
  "worldSchools",
  "bigQuestions",
  "nofSpar",
  "parlimentary",
] as const;

export const debateStyleNames = [
  "Public Forum",
  "Lincoln Douglas", //1
  "Policy",
  "College Policy",
  "College LD",
  "Congress",
  "World Schools", //3
  "Big Questions",
  "NOF SPAR", //1
  "Parlimentary",
];

export type DebateStyleKey = (typeof debateStyleMap)[number];

export const debateStyles: {
  [key in DebateStyleKey]: DebateStyle;
} = {
  policy: {
    primary: {
      name: "aff",
      columns: ["1AC", "1NC", "2AC", "2NC", "1NR", "1AR", "2NR", "2AR"],
      invert: false,
    },
    secondary: {
      name: "neg",
      columns: ["1NC", "2AC", "2NC", "1NR", "1AR", "2NR", "2AR"],
      invert: true,
    },
    timerSpeeches: [
      { name: "1AC", time: 8, secondary: false, speaker: "1A" },
      {
        name: "CX",
        time: 3,
        secondary: false,
        speaker: "1A",
        cxRoles: { questioner: "2N", answerer: "1A" },
      },
      { name: "1NC", time: 8, secondary: true, speaker: "1N" },
      {
        name: "CX",
        time: 3,
        secondary: true,
        speaker: "1N",
        cxRoles: { questioner: "1A", answerer: "1N" },
      },
      { name: "2AC", time: 8, secondary: false, speaker: "2A" },
      {
        name: "CX",
        time: 3,
        secondary: false,
        speaker: "2A",
        cxRoles: { questioner: "1N", answerer: "2A" },
      },
      { name: "2NC", time: 8, secondary: true, speaker: "2N" },
      {
        name: "CX",
        time: 3,
        secondary: true,
        speaker: "2N",
        cxRoles: { questioner: "2A", answerer: "2N" },
      },
      { name: "1NR", time: 5, secondary: true, speaker: "1N" },
      { name: "1AR", time: 5, secondary: false, speaker: "1A" },
      { name: "2NR", time: 5, secondary: true, speaker: "2N" },
      { name: "2AR", time: 5, secondary: false, speaker: "2A" },
    ],
    prepTime: 8,
  },
  publicForum: {
    primary: {
      name: "aff",
      columns: ["AC", "NC", "AR", "NR", "AS", "NS", "AFF", "NFF"],
      columnsSwitch: ["AC", "NR", "AR", "NS", "AS", "NFF", "AFF"],
      invert: false,
    },
    secondary: {
      name: "neg",
      columns: ["NC", "AR", "NR", "AS", "NS", "AFF", "NFF"],
      columnsSwitch: ["NC", "AC", "NR", "AR", "NS", "AS", "NFF", "AFF"],
      invert: true,
    },
    timerSpeeches: [
      { name: "AC", time: 4, secondary: false, speaker: "A1" },
      {
        name: "CX",
        time: 3,
        secondary: false,
        speaker: "A1",
        cxRoles: { questioner: "N1", answerer: "A1" },
      },
      { name: "NC", time: 4, secondary: true, speaker: "N1" },
      {
        name: "CX",
        time: 3,
        secondary: false,
        speaker: "A1",
        cxRoles: { questioner: "A1", answerer: "N1" },
      },
      { name: "AR", time: 4, secondary: false, speaker: "A1" },
      { name: "NR", time: 4, secondary: true, speaker: "N1" },
      { name: "CX", time: 3, secondary: false, speaker: "A1" },
      { name: "AS", time: 3, secondary: false, speaker: "A2" },
      { name: "NS", time: 3, secondary: true, speaker: "N2" },
      { name: "GCX", time: 3, secondary: false, speaker: "A1" },
      { name: "AFF", time: 2, secondary: false, speaker: "A1" },
      { name: "NFF", time: 2, secondary: true, speaker: "N1" },
    ],
    prepTime: 4,
  },
  lincolnDouglas: {
    primary: {
      name: "aff",
      columns: ["AC", "NC", "1AR", "NR", "2AR"],
      starterBoxes: ["value", "criterion"],
      invert: false,
    },
    secondary: {
      name: "neg",
      columns: ["NC", "1AR", "NR", "2AR"],
      starterBoxes: ["value", "criterion"],
      invert: true,
    },
    timerSpeeches: [
      { name: "AC", time: 6, secondary: false, speaker: "A" },
      {
        name: "CX",
        time: 3,
        secondary: false,
        speaker: "A",
        cxRoles: { questioner: "N", answerer: "A" },
      },
      { name: "NC", time: 7, secondary: true, speaker: "N" },
      {
        name: "CX",
        time: 3,
        secondary: false,
        speaker: "N",
        cxRoles: { questioner: "A", answerer: "N" },
      },
      { name: "1AR", time: 4, secondary: false, speaker: "A" },
      { name: "NR", time: 6, secondary: true, speaker: "N" },
      { name: "2AR", time: 3, secondary: false, speaker: "A" },
    ],
    prepTime: 4,
  },
  collegeLD: {
    primary: {
      name: "aff",
      columns: ["AC", "NC", "1AR", "NR", "2AR"],
      starterBoxes: ["value", "criterion"],
      invert: false,
    },
    secondary: {
      name: "neg",
      columns: ["NC", "1AR", "NR", "2AR"],
      starterBoxes: ["value", "criterion"],
      invert: true,
    },
    timerSpeeches: [
      { name: "AC", time: 6, secondary: false, speaker: "A" },
      {
        name: "CX",
        time: 3,
        secondary: false,
        speaker: "A",
        cxRoles: { questioner: "N", answerer: "A" },
      },
      { name: "NC", time: 7, secondary: true, speaker: "N" },
      {
        name: "CX",
        time: 3,
        secondary: false,
        speaker: "N",
        cxRoles: { questioner: "A", answerer: "N" },
      },
      { name: "1AR", time: 6, secondary: false, speaker: "A" },
      { name: "NR", time: 6, secondary: true, speaker: "N" },
      { name: "2AR", time: 3, secondary: false, speaker: "A" },
    ],
    prepTime: 4,
  },
  congress: {
    primary: {
      name: "bill",
      columns: [
        "1A",
        "Q/1N",
        "Q/2A",
        "Q/2N",
        "Q/3A",
        "Q/3N",
        "Q/4A",
        "Q/4N",
        "Q/5A",
        "Q/5N",
      ],
      invert: false,
    },
    timerSpeeches: [
      { name: "speech", time: 3, secondary: false, speaker: "1A" },
    ],
  },
  worldSchools: {
    primary: {
      name: "prop",
      columns: ["P1", "O1", "P2", "O2", "PW", "OW", "OR", "PR"],
      invert: false,
    },
    secondary: {
      name: "opp",
      columns: ["O1", "P2", "O2", "PW", "OW", "OR", "PR"],
      invert: true,
    },
    timerSpeeches: [
      { name: "P1", time: 8, secondary: false, speaker: "P1" },
      { name: "O1", time: 8, secondary: true, speaker: "O1" },
      { name: "P2", time: 8, secondary: false, speaker: "P2" },
      { name: "O2", time: 8, secondary: true, speaker: "O2" },
      { name: "PW", time: 8, secondary: false, speaker: "PW" },
      { name: "OW", time: 8, secondary: true, speaker: "OW" },
      { name: "OR", time: 4, secondary: true, speaker: "OW" },
      { name: "PR", time: 4, secondary: false, speaker: "PW" },
    ],
  },
  bigQuestions: {
    primary: {
      name: "aff",
      columns: ["AC", "NC", "ARb", "NRb", "A3", "N3", "ARt", "NRt"],
      invert: false,
    },
    secondary: {
      name: "neg",
      columns: ["NC", "ARb", "NRb", "A3", "N3", "ARt", "NRt"],
      invert: true,
    },
    timerSpeeches: [
      { name: "AC", time: 5, secondary: false, speaker: "A1" },
      { name: "NC", time: 5, secondary: true, speaker: "N1" },
      {
        name: "QS",
        time: 3,
        secondary: false,
        speaker: "A1",
        cxRoles: { questioner: "N1", answerer: "A1" },
      },
      { name: "ARb", time: 4, secondary: false, speaker: "A2" },
      { name: "NRb", time: 4, secondary: true, speaker: "N2" },
      {
        name: "QS",
        time: 3,
        secondary: false,
        speaker: "A2",
        cxRoles: { questioner: "N2", answerer: "A2" },
      },
      { name: "A3", time: 3, secondary: false, speaker: "A3" },
      { name: "N3", time: 3, secondary: true, speaker: "N3" },
      { name: "ARt", time: 3, secondary: false, speaker: "A3" },
      { name: "NRt", time: 3, secondary: true, speaker: "N3" },
    ],
    prepTime: 3,
  },
  nofSpar: {
    primary: {
      name: "pro",
      columns: ["PC", "CC", "PR", "CR"],
      invert: false,
    },
    secondary: {
      name: "con",
      columns: ["CC", "PR", "CR"],
      invert: true,
    },
    timerSpeeches: [
      { name: "PREP", time: 2, secondary: false, speaker: "P" },
      { name: "PC", time: 2, secondary: false, speaker: "P" },
      { name: "CC", time: 2, secondary: true, speaker: "C" },
      {
        name: "CX",
        time: 4,
        secondary: false,
        speaker: "P",
        cxRoles: { questioner: "C", answerer: "P" },
      },
      { name: "PR", time: 2, secondary: false, speaker: "P" },
      { name: "CR", time: 2, secondary: true, speaker: "C" },
    ],
  },
  parlimentary: {
    primary: {
      name: "pro",
      columns: ["1PC", "1OC", "2PC", "2OC/OR", "PR"],
      invert: false,
    },
    secondary: {
      name: "opp",
      columns: ["1OC", "2PC", "2OC/OR", "PR"],
      invert: true,
    },
    timerSpeeches: [
      { name: "1PC", time: 7, secondary: false, speaker: "P1" },
      { name: "1OC", time: 8, secondary: true, speaker: "O1" },
      { name: "2PC", time: 8, secondary: false, speaker: "P2" },
      { name: "2OC", time: 8, secondary: true, speaker: "O2" },
      { name: "OR", time: 4, secondary: true, speaker: "O2" },
      { name: "PR", time: 5, secondary: false, speaker: "P1" },
    ],
  },
  collegePolicy: {
    primary: {
      name: "aff",
      columns: ["1AC", "1NC", "2AC", "2NC", "1NR", "1AR", "2NR", "2AR"],
      invert: false,
    },
    secondary: {
      name: "neg",
      columns: ["1NC", "2AC", "2NC", "1NR", "1AR", "2NR", "2AR"],
      invert: true,
    },
    timerSpeeches: [
      { name: "1AC", time: 9, secondary: false, speaker: "1A" },
      {
        name: "CX",
        time: 3,
        secondary: false,
        speaker: "1A",
        cxRoles: { questioner: "1N", answerer: "1A" },
      },
      { name: "1NC", time: 9, secondary: true, speaker: "1N" },
      {
        name: "CX",
        time: 3,
        secondary: true,
        speaker: "1N",
        cxRoles: { questioner: "1A", answerer: "1N" },
      },
      { name: "2AC", time: 9, secondary: false, speaker: "2A" },
      {
        name: "CX",
        time: 3,
        secondary: false,
        speaker: "2A",
        cxRoles: { questioner: "2N", answerer: "2A" },
      },
      { name: "2NC", time: 9, secondary: true, speaker: "2N" },
      {
        name: "CX",
        time: 3,
        secondary: true,
        speaker: "2N",
        cxRoles: { questioner: "2A", answerer: "2N" },
      },
      { name: "1NR", time: 6, secondary: true, speaker: "1N" },
      { name: "1AR", time: 6, secondary: false, speaker: "1A" },
      {
        name: "CX",
        time: 3,
        secondary: false,
        speaker: "1A",
        cxRoles: { questioner: "1N", answerer: "1A" },
      },
      { name: "2NR", time: 6, secondary: true, speaker: "2N" },
      {
        name: "CX",
        time: 3,
        secondary: true,
        speaker: "2N",
        cxRoles: { questioner: "2A", answerer: "2N" },
      },
      { name: "2AR", time: 6, secondary: false, speaker: "2A" },
    ],
    prepTime: 10,
  },
};
