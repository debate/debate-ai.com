import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowLeft, Bluetooth, ExternalLink, FileText, Mic, Send, Smartphone, Timer, Type } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../lib/ui/primitives/card"

/** The recommended laptop-less gear. Links are affiliate/referral links
 *  (Amazon, Visible, eBay); product images come from each store's catalog or
 *  a supplied image URL. */
const GEAR: {
  name: string
  role: string
  href: string
  image: string
  /** Optional looping video shown in place of `image`. */
  video?: string
  blurb: string
  usedHref?: string
  buyLabel?: string
  /** Extra links listed under the card's main buy link. */
  extras?: { label: string; href: string }[]
}[] = [
  {
    name: "LenTok Magnetic Neck Phone Holder",
    role: "Hands-free phone mount",
    href: "https://amzn.to/4gTPozg",
    image: "https://m.media-amazon.com/images/I/71IfCIjQxtL._AC_SL500_.jpg",
    blurb:
      "A MagSafe-compatible gooseneck mount that hangs around your neck and holds the phone at eye level. It leaves both hands free for gestures or flowing on paper, and you can turn it around to record practice speeches.",
  },
  {
    name: "Arteck Universal Backlit Bluetooth Keyboard with Touchpad",
    role: "Bluetooth keyboard for the phone",
    href: "https://amzn.to/4z1Isay",
    image: "https://i.imgur.com/EKNFuEf.jpeg",
    blurb:
      "A backlit Bluetooth keyboard with a built-in trackpad and USB-C charging. It pairs directly with your phone, no dongle needed, and the trackpad lets you move around the round workspace without touching the screen.",
  },
  {
    name: "LISEN 60W USB-C to USB-C Cable (5-Pack)",
    role: "Fast-charging cables for phone & keyboard",
    href: "https://amzn.to/4d4CMEu",
    image: "https://i.imgur.com/NloJILx.jpeg",
    blurb:
      "A five-pack of 60W USB-C cables in lengths from 3.3 ft to 10 ft, enough to charge a phone and keyboard and still reach an outlet while the phone is mounted. The braided design holds up to being packed and unpacked.",
  },
  {
    name: "Anker 20,000mAh Power Bank",
    role: "Keep the phone alive all day",
    href: "https://amzn.to/4ryVFW3",
    image: "https://i.imgur.com/0H58u2z.jpeg",
    blurb:
      "A 20,000 mAh USB-C power bank that can recharge a phone two or three times and still fits in a bag pocket. It can charge both the phone and the keyboard, which helps on long tournament days.",
  },
  {
    name: "Anker Nano Charging Station, 100W 7-in-1 Power Strip, Retractable Charger",
    role: "One outlet, every device charged",
    href: "https://amzn.to/4zeWEgy",
    image: "https://m.media-amazon.com/images/I/51vONxxXduL._AC_SL500_.jpg",
    blurb:
      "A compact 100W GaN charging station with three AC outlets, three USB-C ports, and one USB-A port. Two built-in retractable USB-C cables extend up to 2.3 ft, and the LCD shows real-time charging status. Plug it into one hotel or tournament outlet and charge the phone, keyboard, power bank, and a watch at once.",
  },
  {
    name: "Desk Clamp Power Strip with USB-C",
    role: "Outlets right at the table edge",
    href: "https://amzn.to/4zCDu4H",
    image: "https://i.imgur.com/2jnfQjH.jpeg",
    blurb:
      "A power strip that clamps onto the edge of a desk or table, with three AC outlets, two USB-A ports, and two USB-C ports. Clamp it to your table in the prep room or at home and the phone, keyboard, and power bank can charge within reach instead of from a wall outlet across the room.",
  },
  {
    name: "Spinning Pens (2-Pack, Black & White)",
    role: "Paper flowing & fidget pen",
    href: "https://amzn.to/4ytQZTP",
    image: "https://i.imgur.com/7Vi3oaR.jpeg",
    blurb:
      "A pair of weighted pens that write normally and are balanced for pen spinning. Use one to flow on paper while the phone handles evidence and the timer, and spin it between speeches to burn off nerves without tapping on the table.",
  },
  {
    name: "VITURE Beast XR/AR Glasses (174\" Virtual Display)",
    role: "Giant floating screen, no laptop",
    href: "https://amzn.to/4rA4rmp",
    image: "https://i.imgur.com/I4h4WFC.jpeg",
    blurb:
      "An optional upgrade: AR glasses that show a large virtual screen driven by your phone over USB-C. They weigh 88 g and have a bright 120 Hz display, so you can flow or review evidence on a bigger screen and still pocket the phone between rounds.",
    extras: [
      {
        label: "Browse all XR glasses on Amazon",
        href: "https://www.amazon.com/s?k=Video+Display+Glasses&i=electronics&rh=n%3A3213034011&s=exact-aware-popularity-rank&c=ts&qid=1790735819&ts_id=3213034011&ref=sr_st_exact-aware-popularity-rank&ds=v1%3AlCFOPezF1nWO4bmdtubKjczvznu3kKHMKuAK7dduffg",
      },
    ],
  },
  {
    name: "Samsung Galaxy phone",
    role: "A phone to run it on",
    href: "https://amzn.to/4xLQhQA",
    usedHref:
      "https://www.ebay.com/sch/i.html?_oaa=1&_dcat=9355&_udlo=70&_fsrp=1&rt=nc&_from=R40&_nkw=Samsung+s20&_sacat=0&Model=Samsung%2520Galaxy%2520S20%252B%7CSamsung%2520Galaxy%2520S20%252B%25205G%7CSamsung%2520Galaxy%2520S21%252B%7CSamsung%2520Galaxy%2520S21%2520FE%25205G%7CSamsung%2520Galaxy%2520S21%2520Ultra&_udhi=130",
    image: "https://i.imgur.com/lHC64M8.jpeg",
    blurb:
      "Everything on this page runs in a phone browser, so any recent phone will work. A Samsung Galaxy is one option; used or refurbished models are often much cheaper and are available on Amazon and eBay.",
  },
  {
    name: "Visible Unlimited Phone Plan",
    role: "Phone service & data",
    href: "https://www.visible.com/get/?69PFJG2",
    buyLabel: "View on Visible",
    image: "https://s7d1.scene7.com/is/content/tracfone/New-Save6-Desktop-672x448",
    video: "https://i.imgur.com/xNqdj3r.mp4",
    blurb:
      "Unlimited data, talk, and text on Verizon's network, starting at $25/month with taxes included. If you're setting up a phone just for debate, this is one option for service. Our referral code 69PFJG2 takes $20 off a service payment.",
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
        Typing speed is the only thing a phone actually lacks. A Bluetooth keyboard with a trackpad (like the Arteck
        below) pairs straight to the phone from Settings → Bluetooth; a 2.4G-receiver keyboard (like the Jelly Comb)
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
        <Link href="/practice" className="text-foreground underline underline-offset-2">
          Practice Round Simulator
        </Link>{" "}
        and{" "}
        <Link href="/practice/versus-ai" className="text-foreground underline underline-offset-2">
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
        <Link href="/practice/drills" className="text-foreground underline underline-offset-2">
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
            href="/debate"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-background hover:bg-accent text-sm font-medium text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
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
              <div
                key={item.href}
                className="relative block h-full"
              >
                <Card className="relative h-full py-4 transition-colors hover:bg-accent hover:border-accent-foreground/20">
                  <a
                    href={item.href}
                    target="_blank"
                    rel="sponsored noopener noreferrer"
                    className="absolute inset-0 z-10 rounded-[inherit]"
                    aria-label={`${item.name} — ${item.buyLabel ?? "View on Amazon"}`}
                  />
                  <CardHeader className="px-4">
                    <div className="mb-2 flex h-36 items-center justify-center overflow-hidden rounded-md bg-white">
                      {item.video ? (
                        <video
                          src={item.video}
                          poster={item.image}
                          aria-label={item.name}
                          autoPlay
                          muted
                          loop
                          playsInline
                          preload="metadata"
                          className="pointer-events-none max-h-full max-w-full object-contain"
                        />
                      ) : (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={item.image}
                            alt={item.name}
                            loading="lazy"
                            className="pointer-events-none max-h-full max-w-full object-contain"
                          />
                        </>
                      )}
                    </div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.role}</p>
                    <CardTitle className="text-base leading-snug">{item.name}</CardTitle>
                    <CardDescription>{item.blurb}</CardDescription>
                  </CardHeader>
                  <CardContent className="relative z-20 px-4 pt-2 space-y-1">
                    <a
                      href={item.href}
                      target="_blank"
                      rel="sponsored noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:underline underline-offset-2"
                    >
                      {item.buyLabel ?? "View on Amazon"}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    {item.extras?.map((extra) => (
                      <a
                        key={extra.href}
                        href={extra.href}
                        target="_blank"
                        rel="sponsored noopener noreferrer"
                        className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:underline underline-offset-2"
                      >
                        {extra.label}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ))}
                    {item.usedHref && (
                      <a
                        href={item.usedHref}
                        target="_blank"
                        rel="sponsored noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
                      >
                        View used on eBay
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
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
