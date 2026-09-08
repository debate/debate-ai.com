/**
 * @fileoverview The Learn scheduler: a binary interval ladder with no ease
 * factor, on local-day date strings and an injected clock, so every case here
 * is deterministic.
 *
 * The properties worth pinning are the ones a debater feels: a card they
 * remembered comes back later than last time and never past the ceiling, a
 * card they forgot comes back tomorrow and again this session, and a card
 * sitting in several copies of one file is reviewed once rather than once per
 * copy.
 */

import { describe, expect, it } from "vitest";
import {
  FIRST_INTERVAL,
  GROWTH,
  MAX_INTERVAL,
  RELEARN_INTERVAL,
  addDays,
  buildQueue,
  dueCount,
  gradeCard,
  isDue,
  newSchedule,
  type ScheduleEntry,
} from "../src/editor/learn-scheduler";

const TODAY = "2026-03-14";
const NOW = "2026-03-14T12:00:00.000Z";
/** No fuzz: the midpoint of the spread leaves the interval as computed. */
const noFuzz = () => 0.5;

const entry = (over: Partial<ScheduleEntry> = {}): ScheduleEntry => ({
  ...newSchedule("card-1", TODAY),
  ...over,
});

describe("addDays", () => {
  it("moves a date forward", () => {
    expect(addDays("2026-03-14", 1)).toBe("2026-03-15");
    expect(addDays("2026-03-14", 10)).toBe("2026-03-24");
  });

  it("moves a date backward", () => {
    expect(addDays("2026-03-14", -1)).toBe("2026-03-13");
  });

  it("adds nothing for zero", () => {
    expect(addDays("2026-03-14", 0)).toBe("2026-03-14");
  });

  it("rolls over a month and a year boundary", () => {
    expect(addDays("2026-03-31", 1)).toBe("2026-04-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("knows a leap day", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
  });

  it("is free of timezone and daylight-saving effects, being date-only", () => {
    // Across the northern spring-forward boundary, a day is still a day.
    expect(addDays("2026-03-07", 1)).toBe("2026-03-08");
    expect(addDays("2026-03-08", 1)).toBe("2026-03-09");
  });
});

describe("newSchedule", () => {
  it("makes a card due today, with no history", () => {
    const s = newSchedule("card-1", TODAY);
    expect(s).toEqual({
      cardId: "card-1",
      state: "new",
      dueOn: TODAY,
      intervalDays: 0,
      reps: 0,
      lapses: 0,
      lastReviewed: null,
    });
  });
});

describe("gradeCard on remembered", () => {
  const grade = (e: ScheduleEntry) => gradeCard(e, "remembered", TODAY, NOW, noFuzz);

  it("moves a new card into review at the first interval", () => {
    const { entry: next } = grade(entry());
    expect(next.state).toBe("review");
    expect(next.intervalDays).toBe(FIRST_INTERVAL);
    expect(next.dueOn).toBe(addDays(TODAY, FIRST_INTERVAL));
  });

  it("grows a review card's interval", () => {
    const { entry: next } = grade(entry({ state: "review", intervalDays: 10 }));
    expect(next.intervalDays).toBe(Math.round(10 * GROWTH));
  });

  it("never grows past the ceiling", () => {
    const { entry: next } = grade(entry({ state: "review", intervalDays: MAX_INTERVAL }));
    expect(next.intervalDays).toBe(MAX_INTERVAL);
  });

  it("puts a lapsed card on the relearn interval rather than growing it", () => {
    const { entry: next } = grade(entry({ state: "learning", lapses: 1, intervalDays: 40 }));
    expect(next.intervalDays).toBe(RELEARN_INTERVAL);
  });

  it("counts the repetition and records when it happened", () => {
    const { entry: next } = grade(entry({ reps: 3 }));
    expect(next.reps).toBe(4);
    expect(next.lastReviewed).toBe(NOW);
  });

  it("leaves the lapse count alone", () => {
    expect(grade(entry({ lapses: 2 })).entry.lapses).toBe(2);
  });

  it("does not ask for the card again this session", () => {
    expect(grade(entry()).retryInSession).toBe(false);
  });

  it("spreads due dates so a day's reviews do not pile up", () => {
    const base = entry({ state: "review", intervalDays: 100 });
    const early = gradeCard(base, "remembered", TODAY, NOW, () => 0).entry.dueOn;
    const late = gradeCard(base, "remembered", TODAY, NOW, () => 1).entry.dueOn;
    expect(early).not.toBe(late);
    expect(early < late).toBe(true);
  });

  it("keeps the spread inside a tenth of the interval", () => {
    const base = entry({ state: "review", intervalDays: 100 });
    for (const rng of [() => 0, () => 0.5, () => 1]) {
      const { entry: next } = gradeCard(base, "remembered", TODAY, NOW, rng);
      const days = Math.round(
        (Date.parse(next.dueOn) - Date.parse(TODAY)) / 86_400_000,
      );
      expect(days).toBeGreaterThanOrEqual(207);
      expect(days).toBeLessThanOrEqual(253);
    }
  });

  it("does not spread an interval of a day or less, which has nothing to spread", () => {
    for (const rng of [() => 0, () => 1]) {
      expect(gradeCard(entry(), "remembered", TODAY, NOW, rng).entry.dueOn).toBe(
        addDays(TODAY, 1),
      );
    }
  });

  it("never schedules a card for today or earlier", () => {
    for (const intervalDays of [1, 2, 10, 100, MAX_INTERVAL]) {
      const { entry: next } = gradeCard(
        entry({ state: "review", intervalDays }),
        "remembered",
        TODAY,
        NOW,
        () => 0,
      );
      expect(next.dueOn > TODAY).toBe(true);
    }
  });

  it("never mutates the entry it was given", () => {
    const original = entry();
    const snapshot = { ...original };
    grade(original);
    expect(original).toEqual(snapshot);
  });
});

describe("gradeCard on forgot", () => {
  const grade = (e: ScheduleEntry) => gradeCard(e, "forgot", TODAY, NOW, noFuzz);

  it("puts the card back into learning tomorrow", () => {
    const { entry: next } = grade(entry({ state: "review", intervalDays: 90 }));
    expect(next.state).toBe("learning");
    expect(next.dueOn).toBe(addDays(TODAY, 1));
    expect(next.intervalDays).toBe(0);
  });

  it("asks for the card again before the session ends", () => {
    expect(grade(entry()).retryInSession).toBe(true);
  });

  it("counts the lapse and resets the repetitions", () => {
    const { entry: next } = grade(entry({ reps: 6, lapses: 1 }));
    expect(next.lapses).toBe(2);
    expect(next.reps).toBe(0);
  });

  it("records when it happened", () => {
    expect(grade(entry()).entry.lastReviewed).toBe(NOW);
  });

  it("takes a long-established card back to the start", () => {
    const { entry: next } = grade(entry({ state: "review", intervalDays: MAX_INTERVAL, reps: 20 }));
    expect(next.intervalDays).toBe(0);
    expect(next.dueOn).toBe(addDays(TODAY, 1));
  });
});

describe("isDue", () => {
  it("is due on its day and after", () => {
    expect(isDue(entry({ dueOn: TODAY }), TODAY)).toBe(true);
    expect(isDue(entry({ dueOn: "2026-03-01" }), TODAY)).toBe(true);
  });

  it("is not due before its day", () => {
    expect(isDue(entry({ dueOn: "2026-03-15" }), TODAY)).toBe(false);
  });

  it("is never due while suspended, however overdue", () => {
    expect(isDue(entry({ state: "suspended", dueOn: "2020-01-01" }), TODAY)).toBe(false);
  });
});

describe("buildQueue", () => {
  it("takes only the due cards", () => {
    const queue = buildQueue(
      [
        entry({ cardId: "due", dueOn: TODAY }),
        entry({ cardId: "later", dueOn: "2026-04-01" }),
      ],
      TODAY,
    );
    expect(queue.map((e) => e.cardId)).toEqual(["due"]);
  });

  it("leaves out a suspended card", () => {
    const queue = buildQueue([entry({ cardId: "off", state: "suspended" })], TODAY);
    expect(queue).toEqual([]);
  });

  it("puts new and learning cards before reviews", () => {
    const queue = buildQueue(
      [
        entry({ cardId: "r", state: "review", dueOn: "2026-03-01" }),
        entry({ cardId: "n", state: "new", dueOn: TODAY }),
        entry({ cardId: "l", state: "learning", dueOn: TODAY }),
      ],
      TODAY,
    );
    expect(queue.map((e) => e.cardId).slice(-1)).toEqual(["r"]);
  });

  it("orders within a rank by how long the card has been waiting", () => {
    const queue = buildQueue(
      [
        entry({ cardId: "recent", state: "review", dueOn: TODAY }),
        entry({ cardId: "overdue", state: "review", dueOn: "2026-01-01" }),
      ],
      TODAY,
    );
    expect(queue.map((e) => e.cardId)).toEqual(["overdue", "recent"]);
  });

  it("reviews a card once however many file-copies hold it", () => {
    const queue = buildQueue(
      [
        entry({ cardId: "shared", dueOn: TODAY }),
        entry({ cardId: "shared", dueOn: "2026-03-01" }),
      ],
      TODAY,
    );
    expect(queue).toHaveLength(1);
  });

  it("keeps the most-progressed copy of a shared card", () => {
    const queue = buildQueue(
      [
        entry({ cardId: "shared", dueOn: TODAY, reps: 1 }),
        entry({ cardId: "shared", dueOn: "2026-03-01", reps: 9 }),
      ],
      TODAY,
    );
    expect(queue[0]!.reps).toBe(9);
  });

  it("is empty when nothing is due", () => {
    expect(buildQueue([entry({ dueOn: "2026-04-01" })], TODAY)).toEqual([]);
    expect(buildQueue([], TODAY)).toEqual([]);
  });
});

describe("dueCount", () => {
  it("counts the distinct cards due", () => {
    expect(
      dueCount(
        [
          entry({ cardId: "a", dueOn: TODAY }),
          entry({ cardId: "b", dueOn: "2026-03-01" }),
          entry({ cardId: "c", dueOn: "2026-04-01" }),
        ],
        TODAY,
      ),
    ).toBe(2);
  });

  it("counts a card in several file-copies once", () => {
    expect(
      dueCount([entry({ cardId: "a" }), entry({ cardId: "a", dueOn: "2026-03-01" })], TODAY),
    ).toBe(1);
  });

  it("counts nothing when nothing is due", () => {
    expect(dueCount([], TODAY)).toBe(0);
    expect(dueCount([entry({ state: "suspended" })], TODAY)).toBe(0);
  });

  it("agrees with the queue it would build", () => {
    const entries = [
      entry({ cardId: "a", dueOn: TODAY }),
      entry({ cardId: "a", dueOn: "2026-03-01" }),
      entry({ cardId: "b", state: "new" }),
      entry({ cardId: "c", dueOn: "2026-04-01" }),
    ];
    expect(dueCount(entries, TODAY)).toBe(buildQueue(entries, TODAY).length);
  });
});

describe("a card's life over several sessions", () => {
  it("stretches out as it keeps being remembered", () => {
    let e = newSchedule("card-1", TODAY);
    let day = TODAY;
    const intervals: number[] = [];
    for (let i = 0; i < 6; i++) {
      const { entry: next } = gradeCard(e, "remembered", day, NOW, noFuzz);
      e = next;
      day = next.dueOn;
      intervals.push(next.intervalDays);
    }
    expect(intervals).toEqual([...intervals].sort((a, b) => a - b));
    expect(intervals[intervals.length - 1]).toBeGreaterThan(intervals[0]!);
  });

  it("collapses back to a day on a lapse, then relearns from there", () => {
    let e = newSchedule("card-1", TODAY);
    for (let i = 0; i < 4; i++) e = gradeCard(e, "remembered", TODAY, NOW, noFuzz).entry;
    expect(e.intervalDays).toBeGreaterThan(1);

    e = gradeCard(e, "forgot", TODAY, NOW, noFuzz).entry;
    expect(e.intervalDays).toBe(0);
    expect(e.lapses).toBe(1);

    e = gradeCard(e, "remembered", TODAY, NOW, noFuzz).entry;
    expect(e.intervalDays).toBe(RELEARN_INTERVAL);
    expect(e.state).toBe("review");
  });
});
