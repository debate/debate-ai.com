import mixpanel from "mixpanel-browser"

const MIXPANEL_TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN || ""

let isInitialized = false

export function initMixpanel() {
  if (typeof window === "undefined") return
  if (isInitialized) return
  if (!MIXPANEL_TOKEN) return

  try {
    mixpanel.init(MIXPANEL_TOKEN, {
      track_pageview: false,
      persistence: "localStorage",
      autotrack: false,
    })
    isInitialized = true
  } catch (err) {
    console.error("[mixpanel] init failed:", err)
  }
}

export function identifyUser(userId: string, traits?: Record<string, any>) {
  if (typeof window === "undefined") return
  initMixpanel()
  if (!MIXPANEL_TOKEN || !isInitialized) return
  try {
    mixpanel.identify(userId)
    if (traits) {
      mixpanel.people.set(traits)
    }
  } catch (err) {
    console.error("[mixpanel] identify failed:", err)
  }
}

export function resetUser() {
  if (typeof window === "undefined") return
  if (!MIXPANEL_TOKEN || !isInitialized) return
  try {
    mixpanel.reset()
  } catch (err) {
    console.error("[mixpanel] reset failed:", err)
  }
}

export function trackEvent(eventName: string, props?: Record<string, any>) {
  if (typeof window === "undefined") return
  initMixpanel()
  if (!MIXPANEL_TOKEN || !isInitialized) return
  try {
    mixpanel.track(eventName, props)
  } catch (err) {
    console.error("[mixpanel] track failed:", err)
  }
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
