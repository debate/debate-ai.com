import { debateStyles } from "../src/formats/debate-format-times";
import { speechSegmentKeys, type SpeechSegment } from "../src/recorder/youtube-speech-segments";

const pfSpeeches = debateStyles.publicForum.timerSpeeches;
const keys = speechSegmentKeys(pfSpeeches);

export const customPFSpeechSegments: SpeechSegment[] = [
  { key: keys[0], name: "AC", start: 0, end: 246, expectedSeconds: 240 },
  { key: keys[1], name: "CX", start: 246, end: 494, expectedSeconds: 180 },
  { key: keys[2], name: "NC", start: 494, end: 676, expectedSeconds: 240 },
  { key: keys[3], name: "CX", start: 676, end: 921, expectedSeconds: 180 },
  { key: keys[4], name: "AR", start: 921, end: 1165, expectedSeconds: 240 },
  { key: keys[5], name: "NR", start: 1165, end: 1359, expectedSeconds: 240 },
  { key: keys[6], name: "CX", start: 1359, end: 1545, expectedSeconds: 180 },
  { key: keys[7], name: "AS", start: 1545, end: 1738, expectedSeconds: 180 },
  { key: keys[8], name: "NS", start: 1738, end: 1915, expectedSeconds: 180 },
  { key: keys[9], name: "GCX", start: 1915, end: 2045, expectedSeconds: 180 },
  { key: keys[10], name: "AFF", start: 2045, end: 2165, expectedSeconds: 120 },
  { key: keys[11], name: "NFF", start: 2165, end: 2285, expectedSeconds: 120 },
];

export const pfSpeechTimestamps = {
  AC: 0,
  "CX (1st)": 246,
  NC: 494,
  "CX (2nd)": 676,
  AR: 921,
  NR: 1165,
  "CX (3rd)": 1359,
  AS: 1545,
  NS: 1738,
  GCX: 1915,
  AFF: 2045,
  NFF: 2165,
};