/**
 * @fileoverview Safe access to `navigator.mediaDevices`.
 *
 * Browsers only expose `navigator.mediaDevices` in secure contexts (HTTPS or
 * localhost), and some embedded WebViews omit it entirely. Everything in the
 * recorder goes through these helpers so a missing API surfaces as a rejected
 * promise instead of a synchronous TypeError that crashes the React tree.
 */

export function getMediaDevices(): MediaDevices | undefined {
    if (typeof navigator === "undefined") return undefined
    return navigator.mediaDevices ?? undefined
}

export function getUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream> {
    const md = getMediaDevices()
    if (!md?.getUserMedia) {
        return Promise.reject(
            new Error("Microphone access is unavailable. Open the site over HTTPS (or localhost) in a supported browser."),
        )
    }
    return md.getUserMedia(constraints)
}
