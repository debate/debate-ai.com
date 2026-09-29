/**
 * Mixpanel is ~400 kB and runs on every page, but nothing it does is needed
 * to paint one, so the SDK is fetched with `import()` the first time an event
 * is sent (and never, when no token is configured). Calls made before it
 * arrives queue on the same promise, so they still run in the order made.
 */
type Mixpanel = (typeof import("mixpanel-browser"))["default"]

const MIXPANEL_TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN || ""

let client: Promise<Mixpanel | null> | null = null

function loadMixpanel(): Promise<Mixpanel | null> {
  client ??= import("mixpanel-browser")
    .then(({ default: mixpanel }) => {
      mixpanel.init(MIXPANEL_TOKEN, {
        track_pageview: false,
        persistence: "localStorage",
        autotrack: false,
      })
      return mixpanel
    })
    .catch((err) => {
      console.error("[mixpanel] init failed:", err)
      return null
    })
  return client
}

/** Runs `fn` against the SDK once it has loaded; a no-op without a token. */
function withMixpanel(action: string, fn: (mixpanel: Mixpanel) => void) {
  if (typeof window === "undefined") return
  if (!MIXPANEL_TOKEN) return
  void loadMixpanel().then((mixpanel) => {
    if (!mixpanel) return
    try {
      fn(mixpanel)
    } catch (err) {
      console.error(`[mixpanel] ${action} failed:`, err)
    }
  })
}

export function initMixpanel() {
  if (typeof window === "undefined") return
  if (!MIXPANEL_TOKEN) return
  void loadMixpanel()
}

export function identifyUser(userId: string, traits?: Record<string, any>) {
  withMixpanel("identify", (mixpanel) => {
    mixpanel.identify(userId)
    if (traits) {
      mixpanel.people.set(traits)
    }
  })
}

export function resetUser() {
  // Nothing to reset if the SDK was never started this session.
  if (!client) return
  withMixpanel("reset", (mixpanel) => mixpanel.reset())
}

export function trackEvent(eventName: string, props?: Record<string, any>) {
  withMixpanel("track", (mixpanel) => mixpanel.track(eventName, props))
}

export interface SignUpCompletedProps {
  sign_up_method: string
  [key: string]: any
}

export function trackSignUpCompleted(props: SignUpCompletedProps) {
  trackEvent("Sign Up Completed", props)
}

export function trackPageView(pathname: string) {
  trackEvent("Page Viewed", { path: pathname })
}
