import { afterEach, describe, expect, it, vi } from "vitest"
import { MEDIA_UNAVAILABLE, captureMedia, listCameras, videoConstraints } from "../src/webcam/useWebcamRoom"

describe("videoConstraints", () => {
  it("asks for the browser's default camera when none is chosen", () => {
    expect(videoConstraints(null)).toEqual({ width: 640, height: 360 })
  })

  it("pins the chosen camera by device id, at the same size", () => {
    expect(videoConstraints("cam-2")).toEqual({ width: 640, height: 360, deviceId: { exact: "cam-2" } })
  })
})

describe("listCameras", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("keeps only video inputs the browser named by id", async () => {
    const devices = [
      { kind: "videoinput", deviceId: "front", label: "Front" },
      { kind: "audioinput", deviceId: "mic", label: "Mic" },
      { kind: "videoinput", deviceId: "", label: "" },
      { kind: "videoinput", deviceId: "usb", label: "USB" },
    ]
    vi.stubGlobal("navigator", { mediaDevices: { enumerateDevices: async () => devices } })
    expect((await listCameras()).map((d) => d.deviceId)).toEqual(["front", "usb"])
  })

  it("is empty where the browser can't list devices", async () => {
    vi.stubGlobal("navigator", {})
    expect(await listCameras()).toEqual([])
    vi.stubGlobal("navigator", { mediaDevices: { enumerateDevices: async () => Promise.reject(new Error("denied")) } })
    expect(await listCameras()).toEqual([])
  })
})

describe("captureMedia", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("rejects with a readable message where the page has no mediaDevices", async () => {
    vi.stubGlobal("navigator", {})
    await expect(captureMedia({ video: true })).rejects.toThrow(MEDIA_UNAVAILABLE)
  })

  it("passes the constraints through to getUserMedia", async () => {
    const stream = {} as MediaStream
    const getUserMedia = vi.fn(async () => stream)
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } })
    expect(await captureMedia({ audio: true })).toBe(stream)
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true })
  })
})
