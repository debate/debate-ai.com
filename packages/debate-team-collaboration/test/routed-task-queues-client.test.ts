import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deleteSavedRoutedTaskQueueFromAccount,
  listSavedRoutedTaskQueues,
  saveRoutedTaskQueueToAccount,
} from "../src/lib/routed-task-queues-client";
import type { RoutedTaskQueueRecord } from "../src/state/routedTaskQueues";

const RECORD: RoutedTaskQueueRecord = {
  topicId: "topic-ai",
  result: {
    assignments: [
      { task: { argBlock: "Solvency", level: "missing", requiredSkill: "intermediate" }, contributorId: "alice" },
    ],
    unassignedTasks: [],
  },
  updatedAt: 1700000000000,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("listSavedRoutedTaskQueues", () => {
  it("GETs the endpoint and returns the parsed record list", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => [RECORD],
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const result = await listSavedRoutedTaskQueues();

    expect(result).toEqual([RECORD]);
    expect(fetchMock).toHaveBeenCalledWith("/api/routed-task-queues");
  });

  it("returns null on a 401 rather than throwing", async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 401 })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    expect(await listSavedRoutedTaskQueues()).toBeNull();
  });

  it("throws the server's error message on another failure", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: "Something broke." }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(listSavedRoutedTaskQueues()).rejects.toThrow("Something broke.");
  });
});

describe("saveRoutedTaskQueueToAccount", () => {
  it("PUTs to the record's topicId-keyed endpoint", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await saveRoutedTaskQueueToAccount(RECORD);

    const [endpoint, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(endpoint).toBe("/api/routed-task-queues/topic-ai");
    expect((init as RequestInit).method).toBe("PUT");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ record: RECORD });
  });

  it("throws the server's error message on failure", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: "Invalid record." }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(saveRoutedTaskQueueToAccount(RECORD)).rejects.toThrow("Invalid record.");
  });
});

describe("deleteSavedRoutedTaskQueueFromAccount", () => {
  it("DELETEs the topicId-keyed endpoint, URI-encoded", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await deleteSavedRoutedTaskQueueFromAccount("topic with spaces");

    const [endpoint, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(endpoint).toBe("/api/routed-task-queues/topic%20with%20spaces");
    expect((init as RequestInit).method).toBe("DELETE");
  });

  it("throws the server's error message on failure", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: "Delete failed." }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(deleteSavedRoutedTaskQueueFromAccount("topic-ai")).rejects.toThrow("Delete failed.");
  });
});
