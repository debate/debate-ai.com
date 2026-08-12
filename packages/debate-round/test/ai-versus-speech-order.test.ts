import { describe, expect, it } from "vitest";
import {
  buildAiResponseRequest,
  buildAiVersusSpeechOrder,
  getNextSpeechSlot,
  isUsersTurn,
  validateSpeechSubmission,
} from "../src/round/ai-versus-speech-order";

// Lincoln Douglas has a short, easy-to-reason-about speech order:
// AC, CX, NC, CX, 1AR, NR, 2AR (7 slots, secondary = true only for NC/NR).
const STYLE_KEY = "lincolnDouglas";

describe("buildAiVersusSpeechOrder", () => {
  it("assigns the user every primary-side slot when userSide is primary", () => {
    const order = buildAiVersusSpeechOrder(STYLE_KEY, "primary");
    expect(order.map((slot) => slot.name)).toEqual(["AC", "CX", "NC", "CX", "1AR", "NR", "2AR"]);
    expect(order.map((slot) => slot.speaker)).toEqual([
      "user",
      "user",
      "ai",
      "user",
      "user",
      "ai",
      "user",
    ]);
  });

  it("flips every slot to the AI when userSide is secondary", () => {
    const order = buildAiVersusSpeechOrder(STYLE_KEY, "secondary");
    expect(order.map((slot) => slot.speaker)).toEqual(["ai", "ai", "user", "ai", "ai", "user", "ai"]);
  });

  it("defaults to the primary side when userSide is omitted", () => {
    const order = buildAiVersusSpeechOrder(STYLE_KEY);
    expect(order[0].speaker).toBe("user");
  });

  it("numbers slots by their position in the order", () => {
    const order = buildAiVersusSpeechOrder(STYLE_KEY);
    expect(order.map((slot) => slot.index)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("carries cxRoles through only for cross-examination slots", () => {
    const order = buildAiVersusSpeechOrder(STYLE_KEY);
    expect(order[1].cxRoles).toEqual({ questioner: "N", answerer: "A" });
    expect(order[0].cxRoles).toBeUndefined();
  });
});

describe("getNextSpeechSlot", () => {
  const order = buildAiVersusSpeechOrder(STYLE_KEY);

  it("returns the slot at the submitted count", () => {
    expect(getNextSpeechSlot(order, 0)?.name).toBe("AC");
    expect(getNextSpeechSlot(order, 2)?.name).toBe("NC");
  });

  it("returns null once every slot has been delivered", () => {
    expect(getNextSpeechSlot(order, order.length)).toBeNull();
  });
});

describe("isUsersTurn", () => {
  const order = buildAiVersusSpeechOrder(STYLE_KEY);

  it("is true when the next slot belongs to the user", () => {
    expect(isUsersTurn(order, 0)).toBe(true);
  });

  it("is false when the next slot belongs to the AI", () => {
    expect(isUsersTurn(order, 2)).toBe(false);
  });

  it("is false once the round is complete", () => {
    expect(isUsersTurn(order, order.length)).toBe(false);
  });
});

describe("validateSpeechSubmission", () => {
  const order = buildAiVersusSpeechOrder(STYLE_KEY);

  it("accepts the expected speech name on the user's turn", () => {
    expect(validateSpeechSubmission(order, 0, "AC")).toEqual({ valid: true });
  });

  it("rejects a name that doesn't match the expected next speech", () => {
    const result = validateSpeechSubmission(order, 0, "NC");
    expect(result.valid).toBe(false);
    expect(result).toMatchObject({ reason: expect.stringContaining('Expected "AC"') });
  });

  it("rejects a submission when it's the AI's turn", () => {
    const result = validateSpeechSubmission(order, 2, "NC");
    expect(result.valid).toBe(false);
    expect(result).toMatchObject({ reason: expect.stringContaining("AI's turn") });
  });

  it("rejects a submission once the round is complete", () => {
    const result = validateSpeechSubmission(order, order.length, "2AR");
    expect(result.valid).toBe(false);
    expect(result).toMatchObject({ reason: expect.stringContaining("already complete") });
  });
});

describe("buildAiResponseRequest", () => {
  const order = buildAiVersusSpeechOrder(STYLE_KEY);

  it("returns null when it's the user's turn", () => {
    expect(buildAiResponseRequest(order, 0, [])).toBeNull();
  });

  it("returns null once the round is complete", () => {
    expect(buildAiResponseRequest(order, order.length, [])).toBeNull();
  });

  it("builds a request for the AI's next slot, carrying prior speeches through", () => {
    const priorSpeeches = [{ name: "AC", speaker: "user" as const, text: "The affirmative argues..." }];
    const request = buildAiResponseRequest(order, 2, priorSpeeches);
    expect(request?.slot.name).toBe("NC");
    expect(request?.priorSpeeches).toBe(priorSpeeches);
    expect(request?.isCrossExamination).toBe(false);
  });

  it("flags a cross-examination slot", () => {
    const secondaryOrder = buildAiVersusSpeechOrder(STYLE_KEY, "secondary");
    const request = buildAiResponseRequest(secondaryOrder, 1, []);
    expect(request?.slot.name).toBe("CX");
    expect(request?.isCrossExamination).toBe(true);
  });
});
