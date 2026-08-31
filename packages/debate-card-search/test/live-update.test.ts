import { describe, expect, it } from "vitest";
import {
  CARD_SCORING_LIVE_UPDATE_STORAGE_KEYS,
  CONTRIBUTION_LEADERBOARD_LIVE_UPDATE_STORAGE_KEYS,
  CONTRIBUTOR_AWARDS_LIVE_UPDATE_STORAGE_KEYS,
  DAILY_BEST_CARD_LIVE_UPDATE_STORAGE_KEYS,
  DAILY_QUESTS_LIVE_UPDATE_STORAGE_KEYS,
  NEWS_STREAM_LIVE_UPDATE_STORAGE_KEYS,
  PROGRESS_UNLOCKS_LIVE_UPDATE_STORAGE_KEYS,
  QUEST_STREAKS_LIVE_UPDATE_STORAGE_KEYS,
  RESEARCH_PROGRESS_LIVE_UPDATE_STORAGE_KEYS,
  REVISION_INCENTIVES_LIVE_UPDATE_STORAGE_KEYS,
  TASK_INBOX_LIVE_UPDATE_STORAGE_KEYS,
  isCardScoringLiveUpdateStorageEvent,
  isContributionLeaderboardLiveUpdateStorageEvent,
  isContributorAwardsLiveUpdateStorageEvent,
  isDailyBestCardLiveUpdateStorageEvent,
  isDailyQuestsLiveUpdateStorageEvent,
  isNewsStreamLiveUpdateStorageEvent,
  isProgressUnlocksLiveUpdateStorageEvent,
  isQuestStreaksLiveUpdateStorageEvent,
  isResearchProgressLiveUpdateStorageEvent,
  isRevisionIncentivesLiveUpdateStorageEvent,
  isTaskInboxLiveUpdateStorageEvent,
} from "../src/state/live-update";

describe("isDailyBestCardLiveUpdateStorageEvent", () => {
  it("is true for every store key the panel reads", () => {
    for (const key of DAILY_BEST_CARD_LIVE_UPDATE_STORAGE_KEYS) {
      expect(isDailyBestCardLiveUpdateStorageEvent({ key })).toBe(true);
    }
  });

  it("is true for a null key (localStorage.clear())", () => {
    expect(isDailyBestCardLiveUpdateStorageEvent({ key: null })).toBe(true);
  });

  it("is false for an unrelated store's key", () => {
    expect(isDailyBestCardLiveUpdateStorageEvent({ key: "practiceRounds" })).toBe(false);
    expect(isDailyBestCardLiveUpdateStorageEvent({ key: "flowAnnotations" })).toBe(false);
  });

  it("is false for a key that merely contains a tracked store name as a substring", () => {
    expect(isDailyBestCardLiveUpdateStorageEvent({ key: "contributionsBackup" })).toBe(false);
    expect(isDailyBestCardLiveUpdateStorageEvent({ key: "old_dailyBestCardAnnouncements" })).toBe(false);
  });
});

describe("isContributionLeaderboardLiveUpdateStorageEvent", () => {
  it("is true for every store key the panel reads", () => {
    for (const key of CONTRIBUTION_LEADERBOARD_LIVE_UPDATE_STORAGE_KEYS) {
      expect(isContributionLeaderboardLiveUpdateStorageEvent({ key })).toBe(true);
    }
  });

  it("is true for a null key (localStorage.clear())", () => {
    expect(isContributionLeaderboardLiveUpdateStorageEvent({ key: null })).toBe(true);
  });

  it("is false for an unrelated store's key", () => {
    expect(isContributionLeaderboardLiveUpdateStorageEvent({ key: "practiceRounds" })).toBe(false);
    expect(isContributionLeaderboardLiveUpdateStorageEvent({ key: "flowAnnotations" })).toBe(false);
  });

  it("is false for a key that merely contains a tracked store name as a substring", () => {
    expect(isContributionLeaderboardLiveUpdateStorageEvent({ key: "contributionsBackup" })).toBe(false);
    expect(isContributionLeaderboardLiveUpdateStorageEvent({ key: "old_dailyMissionResults" })).toBe(false);
  });
});

describe("isTaskInboxLiveUpdateStorageEvent", () => {
  it("is true for every store key the panel reads", () => {
    for (const key of TASK_INBOX_LIVE_UPDATE_STORAGE_KEYS) {
      expect(isTaskInboxLiveUpdateStorageEvent({ key })).toBe(true);
    }
  });

  it("is true for a null key (localStorage.clear())", () => {
    expect(isTaskInboxLiveUpdateStorageEvent({ key: null })).toBe(true);
  });

  it("is false for an unrelated store's key", () => {
    expect(isTaskInboxLiveUpdateStorageEvent({ key: "practiceRounds" })).toBe(false);
    expect(isTaskInboxLiveUpdateStorageEvent({ key: "contributions" })).toBe(false);
  });

  it("is false for a key that merely contains a tracked store name as a substring", () => {
    expect(isTaskInboxLiveUpdateStorageEvent({ key: "routedTaskQueuesBackup" })).toBe(false);
    expect(isTaskInboxLiveUpdateStorageEvent({ key: "old_trackedArguments" })).toBe(false);
  });
});

describe("isProgressUnlocksLiveUpdateStorageEvent", () => {
  it("is true for every store key the panel reads", () => {
    for (const key of PROGRESS_UNLOCKS_LIVE_UPDATE_STORAGE_KEYS) {
      expect(isProgressUnlocksLiveUpdateStorageEvent({ key })).toBe(true);
    }
  });

  it("is true for a null key (localStorage.clear())", () => {
    expect(isProgressUnlocksLiveUpdateStorageEvent({ key: null })).toBe(true);
  });

  it("is false for an unrelated store's key", () => {
    expect(isProgressUnlocksLiveUpdateStorageEvent({ key: "practiceRounds" })).toBe(false);
    expect(isProgressUnlocksLiveUpdateStorageEvent({ key: "routedTaskQueues" })).toBe(false);
  });

  it("is false for a key that merely contains a tracked store name as a substring", () => {
    expect(isProgressUnlocksLiveUpdateStorageEvent({ key: "contributionsBackup" })).toBe(false);
    expect(isProgressUnlocksLiveUpdateStorageEvent({ key: "old_dailyMissionResults" })).toBe(false);
  });
});

describe("isResearchProgressLiveUpdateStorageEvent", () => {
  it("is true for every store key the panel reads", () => {
    for (const key of RESEARCH_PROGRESS_LIVE_UPDATE_STORAGE_KEYS) {
      expect(isResearchProgressLiveUpdateStorageEvent({ key })).toBe(true);
    }
  });

  it("is true for a null key (localStorage.clear())", () => {
    expect(isResearchProgressLiveUpdateStorageEvent({ key: null })).toBe(true);
  });

  it("is false for an unrelated store's key", () => {
    expect(isResearchProgressLiveUpdateStorageEvent({ key: "practiceRounds" })).toBe(false);
    expect(isResearchProgressLiveUpdateStorageEvent({ key: "dailyMissionResults" })).toBe(false);
  });

  it("is false for a key that merely contains a tracked store name as a substring", () => {
    expect(isResearchProgressLiveUpdateStorageEvent({ key: "contributionsBackup" })).toBe(false);
    expect(isResearchProgressLiveUpdateStorageEvent({ key: "old_routedTaskQueues" })).toBe(false);
  });
});

describe("isQuestStreaksLiveUpdateStorageEvent", () => {
  it("is true for every store key the panel reads", () => {
    for (const key of QUEST_STREAKS_LIVE_UPDATE_STORAGE_KEYS) {
      expect(isQuestStreaksLiveUpdateStorageEvent({ key })).toBe(true);
    }
  });

  it("is true for a null key (localStorage.clear())", () => {
    expect(isQuestStreaksLiveUpdateStorageEvent({ key: null })).toBe(true);
  });

  it("is false for an unrelated store's key", () => {
    expect(isQuestStreaksLiveUpdateStorageEvent({ key: "practiceRounds" })).toBe(false);
    expect(isQuestStreaksLiveUpdateStorageEvent({ key: "contributions" })).toBe(false);
  });

  it("is false for a key that merely contains a tracked store name as a substring", () => {
    expect(isQuestStreaksLiveUpdateStorageEvent({ key: "dailyMissionResultsBackup" })).toBe(false);
    expect(isQuestStreaksLiveUpdateStorageEvent({ key: "old_dailyMissionResults" })).toBe(false);
  });
});

describe("isNewsStreamLiveUpdateStorageEvent", () => {
  it("is true for every store key the panel reads", () => {
    for (const key of NEWS_STREAM_LIVE_UPDATE_STORAGE_KEYS) {
      expect(isNewsStreamLiveUpdateStorageEvent({ key })).toBe(true);
    }
  });

  it("is true for a null key (localStorage.clear())", () => {
    expect(isNewsStreamLiveUpdateStorageEvent({ key: null })).toBe(true);
  });

  it("is false for an unrelated store's key", () => {
    expect(isNewsStreamLiveUpdateStorageEvent({ key: "practiceRounds" })).toBe(false);
    expect(isNewsStreamLiveUpdateStorageEvent({ key: "routedTaskQueues" })).toBe(false);
  });

  it("is false for a key that merely contains a tracked store name as a substring", () => {
    expect(isNewsStreamLiveUpdateStorageEvent({ key: "newsStreamViewerStateBackup" })).toBe(false);
    expect(isNewsStreamLiveUpdateStorageEvent({ key: "old_dailyBestCardAnnouncements" })).toBe(false);
  });
});

describe("isContributorAwardsLiveUpdateStorageEvent", () => {
  it("is true for every store key the panel reads", () => {
    for (const key of CONTRIBUTOR_AWARDS_LIVE_UPDATE_STORAGE_KEYS) {
      expect(isContributorAwardsLiveUpdateStorageEvent({ key })).toBe(true);
    }
  });

  it("is true for a null key (localStorage.clear())", () => {
    expect(isContributorAwardsLiveUpdateStorageEvent({ key: null })).toBe(true);
  });

  it("is false for an unrelated store's key", () => {
    expect(isContributorAwardsLiveUpdateStorageEvent({ key: "practiceRounds" })).toBe(false);
    expect(isContributorAwardsLiveUpdateStorageEvent({ key: "dailyBestCardAnnouncements" })).toBe(false);
  });

  it("is false for a key that merely contains a tracked store name as a substring", () => {
    expect(isContributorAwardsLiveUpdateStorageEvent({ key: "contributionsBackup" })).toBe(false);
    expect(isContributorAwardsLiveUpdateStorageEvent({ key: "old_contributorAwardAnnouncements" })).toBe(false);
  });
});

describe("isDailyQuestsLiveUpdateStorageEvent", () => {
  it("is true for every store key the panel reads", () => {
    for (const key of DAILY_QUESTS_LIVE_UPDATE_STORAGE_KEYS) {
      expect(isDailyQuestsLiveUpdateStorageEvent({ key })).toBe(true);
    }
  });

  it("is true for a null key (localStorage.clear())", () => {
    expect(isDailyQuestsLiveUpdateStorageEvent({ key: null })).toBe(true);
  });

  it("is false for an unrelated store's key", () => {
    expect(isDailyQuestsLiveUpdateStorageEvent({ key: "practiceRounds" })).toBe(false);
    expect(isDailyQuestsLiveUpdateStorageEvent({ key: "routedTaskQueues" })).toBe(false);
  });

  it("is false for a key that merely contains a tracked store name as a substring", () => {
    expect(isDailyQuestsLiveUpdateStorageEvent({ key: "dailyQuestTemplatesBackup" })).toBe(false);
    expect(isDailyQuestsLiveUpdateStorageEvent({ key: "old_dailyMissionResults" })).toBe(false);
  });
});

describe("isRevisionIncentivesLiveUpdateStorageEvent", () => {
  it("is true for every store key the panel reads", () => {
    for (const key of REVISION_INCENTIVES_LIVE_UPDATE_STORAGE_KEYS) {
      expect(isRevisionIncentivesLiveUpdateStorageEvent({ key })).toBe(true);
    }
  });

  it("is true for a null key (localStorage.clear())", () => {
    expect(isRevisionIncentivesLiveUpdateStorageEvent({ key: null })).toBe(true);
  });

  it("is false for an unrelated store's key", () => {
    expect(isRevisionIncentivesLiveUpdateStorageEvent({ key: "practiceRounds" })).toBe(false);
    expect(isRevisionIncentivesLiveUpdateStorageEvent({ key: "contributions" })).toBe(false);
  });

  it("is false for a key that merely contains a tracked store name as a substring", () => {
    expect(isRevisionIncentivesLiveUpdateStorageEvent({ key: "revisionHistoryBackup" })).toBe(false);
    expect(isRevisionIncentivesLiveUpdateStorageEvent({ key: "old_revisionHistory" })).toBe(false);
  });
});

describe("isCardScoringLiveUpdateStorageEvent", () => {
  it("is true for every store key the panel reads", () => {
    for (const key of CARD_SCORING_LIVE_UPDATE_STORAGE_KEYS) {
      expect(isCardScoringLiveUpdateStorageEvent({ key })).toBe(true);
    }
  });

  it("is true for a null key (localStorage.clear())", () => {
    expect(isCardScoringLiveUpdateStorageEvent({ key: null })).toBe(true);
  });

  it("is false for an unrelated store's key", () => {
    expect(isCardScoringLiveUpdateStorageEvent({ key: "practiceRounds" })).toBe(false);
    expect(isCardScoringLiveUpdateStorageEvent({ key: "contributions" })).toBe(false);
  });

  it("is false for a key that merely contains a tracked store name as a substring", () => {
    expect(isCardScoringLiveUpdateStorageEvent({ key: "cardScoresBackup" })).toBe(false);
    expect(isCardScoringLiveUpdateStorageEvent({ key: "old_aiCardAssessments" })).toBe(false);
  });
});
