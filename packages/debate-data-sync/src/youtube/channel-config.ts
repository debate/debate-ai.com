/**
 * Configuration for YouTube channels to sync.
 *
 * `channels` is also seeded into the `youtube_channels` SQL table — the list
 * the weekly resync actually scans — by
 * `packages/debate-data-sync/migrations/0001_youtube_channels.sql`. Add a
 * channel to both; `apps/debate-ai.com/lib/youtube/__tests__/youtube-channels-seed.test.ts`
 * fails when they drift.
 */

export const publishedAfter = "2023-05-01";

export const channelsToUpdate = []

export const channels = [
  "jettsmith7", 
  "artemisway-g2x",
  "ajapdebate",
  "KansasDebate-wd4vf",
  "spencerandersonmcelligott",
  "Adi_Arora_PF",
  "barkleyforumvideos3220",
  "DebateArchive2",
  "Debatedrills",
  "championbriefs1508",
  "su.debate",
  "ResolvedDebate",
  "PolicyDebateCentral",
  "pfvideos9234",
  "ddidebate4071",
  "DebateStreamDB8",
  "LynbrookDebate",
  "thatdebatekid5313",
  "NSD_DebateCamp",
  "lasadebate",
  "CEDADebate",
  "KentuckyDebate",
  "sailorferrets",
  "wakedebate8636",
  "exodusfiles3478",
  "SolvencyAdvocate",
  "northbrowardmr4523",
  "TexasDebate",
  "jacob_wilkus",
  "arvindshankar2481",
  "NDT-jl6oi",
  "atrujillo9",
  "UNTDebate",
  "vintagedebatevids",
  "georgetowndebateseminar1234",
  "BillBatterman",
  "msudebate6544",
  "ProfessorGraham",
  "michigandebate7440",
  // Channels uploading the rounds in test/video_metadata*.json, by @handle
  // (resolved from each video via YouTube oEmbed, not the `ab_channel` URL
  // param, which is a display name and often not the handle).
  "ArrmanKapoor",
  "BreakDebate",
  "DebateMatters",
  "ElmerYangDebateVideos",
  "IndianaSpeechandDebate",
  "IvyLivestream1",
  "IvyLivestream2",
  "IvyLivestream3",
  "IvyLivestream4",
  "IvyLivestream6",
  "NIHDVideoChannel",
  "OHSPEECHDEBATE",
  "PeterTulloch",
  "VictoryBriefs",
  "VikrantDebate",
  "aaronlangerman4525",
  "aayush-appan-1",
  "ansonfung182",
  "arjunnayagadurai1808",
  "beyondresolved9910",
  "classicdebatecamp9738",
  "danielgarepisholland",
  "davidherrera8285",
  "flexdebate8737",
  "fluxnfiction5559",
  "goldenstate6086",
  "greenhilldebate9898",
  "hannahowenspierre",
  "hopezerafa1111",
  "ibrahimarain6382",
  "idpdebates",
  "ishaanbanerjee13",
  "itachi_cloud9255",
  "jmdebatevideos",
  "ldben4258",
  "legacydebatevideos6944",
  "lynbrookld",
  "nsdaspeechanddebate",
  "outreachdebate",
  "peanutbuttercrackers9106",
  "ryanpanjwani2557",
  "sreyaashdas4869",
  "strakejesuitdebate2958",
  "vishvakbandi9909",
  "ziondixon7141",
];

export const ROUNDS_FILES: Record<number, string> = {
  1: "rounds-policy.json",
  2: "rounds-pf.json",
  3: "rounds-ld.json",
  4: "rounds-college.json",
};
