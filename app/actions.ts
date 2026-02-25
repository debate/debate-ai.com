"use server"


export async function shareSpeech(emails: string[], speechName: string, content: string) {
  // In a real app, this would use an email service like Resend, SendGrid, etc.
  console.log(`[Mock Email Service] Sharing speech "${speechName}" with:`, emails)
  console.log(`[Mock Email Service] Content preview: ${content.substring(0, 50)}...`)

  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 500))

  return { success: true, message: `Shared with ${emails.length} participants` }
}


export async function fetchTournamentNames(): Promise<string[]> {
  try {
    const res = await fetch("https://www.tabroom.com/index/index.mhtml", {
      cache: "no-store",
    })

    if (!res.ok) return []

    const html = await res.text()

    const linkMatches = html.match(/<a[^>]*href="[^"]*tourn_id=[^"]*"[^>]*>[\s\S]*?<\/a>/gi) || []

    const names = linkMatches
      .map((link) => {
        const match = link.match(/>([^<]*(?:<[^a/][^<]*)*)<\/a>/i)
        if (!match) return ""
        return match[1].replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim()
      })
      .filter((n) => {
        return (
          n.length > 3 &&
          !n.includes("http") &&
          !n.match(/^(Home|Login|Help|About|Contact|Sign Up|Register)$/i)
        )
      })

    return Array.from(new Set(names)).slice(0, 100)
  } catch (error) {
    console.error("Error fetching tournament names:", error)
    return []
  }
}
