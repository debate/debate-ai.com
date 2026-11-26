import { describe, expect, it, vi } from "vitest";
import { sendInBatches, tally, type BatchResponse, type SendResult } from "../../../src/lib/admin/email-campaign";

const result = (email: string, status: SendResult["status"] = "sent"): SendResult => ({ email, status });

/** A fake server holding `emails`, answering in batches of `size`. */
function server(emails: string[], size: number, fail: (offset: number) => boolean = () => false) {
  return vi.fn(async (offset: number): Promise<BatchResponse> => {
    if (fail(offset)) throw new Error("Resend is down");
    const slice = emails.slice(offset, offset + size);
    const next = offset + slice.length;
    return {
      results: slice.map((email) => result(email)),
      totals: { sent: slice.length, failed: 0, skipped: 0 },
      total: emails.length,
      nextOffset: next < emails.length ? next : null,
    };
  });
}

describe("sendInBatches", () => {
  const emails = Array.from({ length: 7 }, (_, i) => `u${i}@x.com`);

  it("walks the list batch by batch, reporting progress, until there is no next offset", async () => {
    const send = server(emails, 3);
    const seen: number[] = [];
    const run = await sendInBatches(send, { onBatch: (_, all) => seen.push(all.length) });
    expect(send.mock.calls.map(([offset]) => offset)).toEqual([0, 3, 6]);
    expect(seen).toEqual([3, 6, 7]);
    expect(run).toMatchObject({ completed: true, error: null, nextOffset: null });
    expect(run.results.map((r) => r.email)).toEqual(emails);
  });

  it("keeps what was sent and says where to resume when a batch fails", async () => {
    const send = server(emails, 3, (offset) => offset === 3);
    const run = await sendInBatches(send);
    expect(run.completed).toBe(false);
    expect(run.error).toBe("Resend is down");
    expect(run.nextOffset).toBe(3);
    expect(run.results).toHaveLength(3);

    const resumed = await sendInBatches(server(emails, 3), { startOffset: run.nextOffset! });
    expect(resumed.completed).toBe(true);
    expect([...run.results, ...resumed.results].map((r) => r.email)).toEqual(emails);
  });

  it("stops between batches when asked", async () => {
    let stop = false;
    const send = server(emails, 3);
    const run = await sendInBatches(send, { shouldStop: () => stop, onBatch: () => (stop = true) });
    expect(send).toHaveBeenCalledTimes(1);
    expect(run).toMatchObject({ completed: false, nextOffset: 3 });
  });
});

describe("tally", () => {
  it("counts each status", () => {
    expect(tally([result("a@x.com"), result("b@x.com", "failed"), result("c@x.com", "skipped"), result("d@x.com")])).toEqual({
      sent: 2,
      failed: 1,
      skipped: 1,
    });
  });
});
