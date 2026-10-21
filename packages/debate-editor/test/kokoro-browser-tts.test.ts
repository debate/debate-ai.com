import { afterEach, describe, expect, it, vi } from "vitest";
import {
  KOKORO_MODEL_ID,
  downloadKokoro,
  kokoroModelStatus,
  kokoroWorkerModel,
  loadKokoro,
  removeKokoroModel,
  speechChunks,
  streamKokoroSpeech,
} from "../src/editor/kokoro-browser-tts";

describe("speechChunks", () => {
  it("keeps short text whole and packs sentences up to the limit", () => {
    expect(speechChunks("  Warming   causes extinction. ")).toEqual(["Warming causes extinction."]);
    expect(speechChunks("One two. Three four. Five six.", 20)).toEqual(["One two. Three four.", "Five six."]);
  });

  it("cuts unpunctuated highlighted text at words, never over the limit", () => {
    const text = Array.from({ length: 200 }, (_, i) => `word${i}`).join(" ");
    const chunks = speechChunks(text, 100);
    expect(chunks.length).toBeGreaterThan(5);
    expect(chunks.every((c) => c.length <= 100)).toBe(true);
    expect(chunks.join(" ")).toBe(text);
  });

  it("prefers commas inside a long sentence", () => {
    expect(speechChunks("alpha beta gamma, delta epsilon zeta, eta theta", 20)).toEqual([
      "alpha beta gamma,",
      "delta epsilon zeta,",
      "eta theta",
    ]);
  });

  it("gives nothing for empty text", () => {
    expect(speechChunks("   ")).toEqual([]);
  });
});

describe("streamKokoroSpeech", () => {
  it("generates one clip per chunk in the chosen voice and stops on abort", async () => {
    const generate = vi.fn(async (text: string) => ({ toBlob: () => new Blob([text]) }));
    const load = vi.fn(async () => ({ generate }));
    const abort = new AbortController();
    const seen: string[] = [];
    const text = Array.from({ length: 120 }, (_, i) => `w${i}`).join(" ");
    for await (const blob of streamKokoroSpeech(text, "af_bella", abort.signal, load)) {
      seen.push(await blob.text());
      abort.abort();
    }
    expect(seen).toHaveLength(1);
    expect(generate).toHaveBeenCalledWith(expect.any(String), { voice: "af_bella" });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("does not load the model for empty text", async () => {
    const load = vi.fn();
    for await (const _ of streamKokoroSpeech("", "af_heart", undefined, load)) void _;
    expect(load).not.toHaveBeenCalled();
  });
});

/** A stand-in Worker that answers each message through `reply`. */
class FakeWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  terminated = false;
  sent: Array<Record<string, unknown>> = [];
  constructor(private reply: (msg: Record<string, unknown>) => Record<string, unknown> | null) {}
  postMessage(msg: Record<string, unknown>) {
    this.sent.push(msg);
    const res = this.reply(msg);
    if (res) queueMicrotask(() => this.onmessage?.({ data: { id: msg["id"], ...res } } as MessageEvent));
  }
  terminate() {
    this.terminated = true;
  }
  crash(message: string) {
    this.onerror?.({ message, preventDefault() {} } as ErrorEvent);
  }
}

describe("kokoroWorkerModel", () => {
  it("loads the model in the worker, then generates clips there", async () => {
    const worker = new FakeWorker((msg) =>
      msg["type"] === "load" ? { ok: true } : { ok: true, audio: new Blob([`wav:${msg["text"]}:${msg["voice"]}`]) },
    );
    const model = await kokoroWorkerModel(() => worker as unknown as Worker);
    const clip = await model.generate("Warming causes extinction.", { voice: "af_bella" });
    expect(await clip.toBlob().text()).toBe("wav:Warming causes extinction.:af_bella");
    expect(worker.sent.map((m) => m["type"])).toEqual(["load", "generate"]);
  });

  it("rejects and ends the worker when the model fails to load", async () => {
    const worker = new FakeWorker(() => ({ ok: false, error: "no network" }));
    const onDead = vi.fn();
    await expect(kokoroWorkerModel(() => worker as unknown as Worker, onDead)).rejects.toThrow("no network");
    expect(worker.terminated).toBe(true);
    expect(onDead).toHaveBeenCalledTimes(1);
  });

  it("rejects when the browser can't start the worker", async () => {
    await expect(
      kokoroWorkerModel(() => {
        throw new Error("blocked");
      }),
    ).rejects.toThrow("blocked");
  });

  it("fails a waiting clip when the worker crashes", async () => {
    const worker = new FakeWorker((msg) => (msg["type"] === "load" ? { ok: true } : null));
    const onDead = vi.fn();
    const model = await kokoroWorkerModel(() => worker as unknown as Worker, onDead);
    const clip = model.generate("text", {});
    worker.crash("out of memory");
    await expect(clip).rejects.toThrow("out of memory");
    expect(onDead).toHaveBeenCalledTimes(1);
    await expect(model.generate("again", {})).rejects.toThrow("stopped");
  });
});

describe("loadKokoro", () => {
  it("shares one worker, and starts a new one after a failed load", async () => {
    let ok = false;
    const create = vi.fn(() => new FakeWorker(() => (ok ? { ok: true } : { ok: false, error: "offline" })) as unknown as Worker);
    await expect(loadKokoro(create)).rejects.toThrow("offline");
    ok = true;
    const first = loadKokoro(create);
    expect(loadKokoro(create)).toBe(first);
    await first;
    expect(create).toHaveBeenCalledTimes(2);
  });
});

describe("Settings download / status / remove", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports load progress, then the cached files, and removing deletes them and ends the worker", async () => {
    const base = `https://huggingface.co/${KOKORO_MODEL_ID}/resolve/main`;
    const store = new Map<string, Response>();
    vi.stubGlobal("caches", {
      has: async (name: string) => name === "transformers-cache",
      open: async () => ({
        keys: async () => [...store.keys()].map((url) => new Request(url)),
        match: async (req: Request) => store.get(req.url)?.clone(),
        delete: async (req: Request) => store.delete(req.url),
      }),
    });

    const worker = new FakeWorker((msg) => (msg["type"] === "load" ? { ok: true } : null));
    const realPost = worker.postMessage.bind(worker);
    worker.postMessage = (msg) => {
      if (msg["type"] === "load") worker.onmessage?.({ data: { progress: 0.5 } } as MessageEvent);
      realPost(msg);
    };
    const progress: number[] = [];
    await removeKokoroModel(); // drop the model an earlier test shared
    store.set(`${base}/onnx/model_quantized.onnx`, new Response("x".repeat(90), { headers: { "content-length": "90" } }));
    store.set(`${base}/config.json`, new Response("{}", { headers: { "content-length": "2" } }));
    store.set("https://huggingface.co/other/model/resolve/main/onnx/model.onnx", new Response("y"));
    await downloadKokoro((f) => progress.push(f), () => worker as unknown as Worker);
    expect(progress).toEqual([0.5, 1]);

    expect(await kokoroModelStatus()).toEqual({ downloaded: true, bytes: 92 });
    await removeKokoroModel();
    expect(await kokoroModelStatus()).toEqual({ downloaded: false, bytes: 0 });
    expect(store.size).toBe(1);
    await vi.waitFor(() => expect(worker.terminated).toBe(true));
  });

  it("reports nothing when the browser has no cache yet", async () => {
    vi.stubGlobal("caches", { has: async () => false, open: vi.fn() });
    expect(await kokoroModelStatus()).toEqual({ downloaded: false, bytes: 0 });
  });
});
