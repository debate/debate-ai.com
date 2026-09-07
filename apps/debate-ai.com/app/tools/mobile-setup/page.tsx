import type { Metadata } from "next"
import type { ReactNode } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Bluetooth,
  ExternalLink,
  FileText,
  Keyboard,
  Mic,
  Send,
  Smartphone,
  Timer,
  Type,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../lib/ui/primitives/card"

export const metadata: Metadata = {
  title: "Mobile Tools Setup — Laptop-less Debating",
  description:
    "Debate from just your phone: recommended gear plus a step-by-step guide to prepping, flowing, and speaking off a mobile phone with no laptop.",
}

/** The recommended laptop-less gear. Amazon affiliate short links — images
 *  are the products' own Amazon catalog images (m.media-amazon.com). */
const GEAR: {
  name: string
  role: string
  href: string
  image: string
  blurb: string
}[] = [
  {
    name: "LenTok Magnetic Neck Phone Holder",
    role: "Hands-free phone mount",
    href: "https://amzn.to/4gTPozg",
    image: "https://m.media-amazon.com/images/I/71IfCIjQxtL._AC_SL500_.jpg",
    blurb:
      "A MagSafe-compatible gooseneck mount that hangs around your neck and holds the phone at eye level. Speak off your speech doc with both hands free for gestures and pen-and-paper flowing, or turn it around to record practice speeches from your own point of view.",
  },
  {
    name: "Arteck Wireless Touch Keyboard with Built-in Touchpad",
    role: "Full-size keyboard + touchpad",
    href: "https://amzn.to/4dmMB0l",
    image: "https://m.media-amazon.com/images/I/61HN+x6X+XL._AC_SL500_.jpg",
    blurb:
      "A solid stainless, ultra-compact full-size keyboard with a built-in touchpad mouse. It connects through its 2.4G USB receiver, so on a phone pair it via a small USB-C OTG adapter — great as the sturdy desk setup for longer prep sessions.",
  },
  {
    name: "Bnnwa Multi-Device Bluetooth Keyboard with Touchpad",
    role: "Bluetooth keyboard for the phone",
    href: "https://amzn.to/4hgaLLt",
    image: "https://m.media-amazon.com/images/I/61hkDb6ZWPL._AC_SL500_.jpg",
    blurb:
      "Pairs over Bluetooth with up to three devices at once and hot-switches between them, with a big multi-touch trackpad. This is the piece that turns a phone into a real laptop replacement: type speeches and flow at full speed, no dongle needed.",
  },
]

const STEPS: { icon: typeof Smartphone; title: string; body: ReactNode }[] = [
  {
    icon: Smartphone,
    title: "Put the whole workspace on your phone",
    body: (
      <>
        Every tool on this site runs in a phone browser — the round flow, editors, timers, and practice tools all
        have mobile layouts. Open debate-ai.com in your phone&apos;s browser and sign in; your rounds, speech
        documents, and prep notes sync to the same account you use anywhere else.
      </>
    ),
  },
  {
    icon: Bluetooth,
    title: "Pair a keyboard",
    body: (
      <>
        Typing speed is the only thing a phone actually lacks. A Bluetooth keyboard with a trackpad (like the Bnnwa
        below) pairs straight to the phone from Settings → Bluetooth; a 2.4G-receiver keyboard (like the Arteck)
        plugs in through a USB-C OTG adapter. Prop the phone up, and you have a laptop that fits in a pencil pouch.
      </>
    ),
  },
  {
    icon: FileText,
    title: "Prep your speeches in the app",
    body: (
      <>
        Cut cards and draft speeches in the{" "}
        <Link href="/reason-editor" className="text-foreground underline underline-offset-2">
          Reason Editor
        </Link>
        , then send evidence to a designated speech doc and read it back from{" "}
        <Link href="/speech-documents" className="text-foreground underline underline-offset-2">
          Speech Documents
        </Link>
        . Do it on hotel or tournament Wi-Fi before the round so everything is loaded when you walk in.
      </>
    ),
  },
  {
    icon: Timer,
    title: "Flow and time the round from the same screen",
    body: (
      <>
        The round workspace&apos;s mobile layout keeps the speech timer and flow in reach while a speech is up.
        For timed solo reps, the{" "}
        <Link href="/practice-round" className="text-foreground underline underline-offset-2">
          Practice Round Simulator
        </Link>{" "}
        and{" "}
        <Link href="/versus-ai" className="text-foreground underline underline-offset-2">
          Practice vs AI
        </Link>{" "}
        run fully timed rounds on the phone.
      </>
    ),
  },
  {
    icon: Send,
    title: "Speak off the phone",
    body: (
      <>
        Mount the phone at eye level (a neck or gooseneck holder beats holding it — no more staring at the table),
        bump the text size, turn on Do Not Disturb, and scroll with one thumb. Off a mounted phone you keep eye
        contact with the judge in a way a laptop screen never allows.
      </>
    ),
  },
  {
    icon: Mic,
    title: "Practice and review anywhere",
    body: (
      <>
        Phone-only debating&apos;s biggest win is that practice stops needing a desk:{" "}
        <Link href="/word-count" className="text-foreground underline underline-offset-2">
          Word-Count Speeches
        </Link>{" "}
        for redos on the bus, the mic Record button in the round workspace for transcribing speeches, and{" "}
        <Link href="/drills" className="text-foreground underline underline-offset-2">
          Practice Drills
        </Link>{" "}
        between rounds.
      </>
    ),
  },
]

export default function MobileSetupPage() {
  return (
    <div className="min-h-screen bg-background p-3 sm:p-6 pb-24">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4">
          <Link
            href="/tools"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-background hover:bg-accent text-sm font-medium text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            All tools
          </Link>
        </div>

        <div className="mb-8">
          <div className="flex items-center gap-2">
            <Smartphone className="h-6 w-6 text-foreground" />
            <h1 className="text-2xl font-semibold text-foreground">Mobile Tools Setup</h1>
          </div>
          <p className="mt-2 text-base text-muted-foreground">
            Go laptop-less: everything you need to prep, flow, and speak in a debate round with nothing but a
            phone. Lighter bag, longer battery, nothing to boot up — and with a keyboard and a mount, you give up
            almost nothing over a laptop.
          </p>
        </div>

        <section className="mb-10">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Recommended gear
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {GEAR.map((item) => (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="sponsored noopener noreferrer"
                className="block h-full"
              >
                <Card className="h-full py-4 transition-colors hover:bg-accent hover:border-accent-foreground/20">
                  <CardHeader className="px-4">
                    <div className="mb-2 flex h-36 items-center justify-center overflow-hidden rounded-md bg-white">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.image}
                        alt={item.name}
                        loading="lazy"
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.role}</p>
                    <CardTitle className="text-base leading-snug">{item.name}</CardTitle>
                    <CardDescription>{item.blurb}</CardDescription>
                  </CardHeader>
                  <CardContent className="px-4 pt-2">
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
                      View on Amazon
                      <ExternalLink className="h-3.5 w-3.5" />
                    </span>
                  </CardContent>
                </Card>
              </a>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            As an Amazon Associate, this site earns from qualifying purchases made through these links.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Laptop-less debating, step by step
          </h2>
          <ol className="flex flex-col gap-4">
            {STEPS.map((step, i) => (
              <li key={step.title}>
                <Card className="py-4">
                  <CardHeader className="px-4">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border text-xs font-semibold text-foreground">
                        {i + 1}
                      </span>
                      <step.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <CardTitle className="text-base">{step.title}</CardTitle>
                    </div>
                    <CardDescription className="mt-1">{step.body}</CardDescription>
                  </CardHeader>
                </Card>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Speaking-off-your-phone checklist
          </h2>
          <Card className="py-4">
            <CardContent className="px-4">
              <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <Type className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Bump the font size before the round — readable at arm&apos;s length beats scrolling less.
                  </span>
                </li>
                <li className="flex gap-2">
                  <Smartphone className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Do Not Disturb on, auto-lock off, brightness up. A notification banner mid-1AR is a dropped
                    argument.
                  </span>
                </li>
                <li className="flex gap-2">
                  <Bluetooth className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Landscape + keyboard for prep and flowing; portrait on the mount for speaking. Switch takes two
                    seconds.
                  </span>
                </li>
                <li className="flex gap-2">
                  <Timer className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Charge overnight and carry a cable — a phone that debates all day still ends the day with more
                    battery than most tournament laptops.
                  </span>
                </li>
                <li className="flex gap-2">
                  <FileText className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Load your speech docs and evidence while you still have Wi-Fi; don&apos;t bet a round on the
                    tournament network.
                  </span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  )
}
