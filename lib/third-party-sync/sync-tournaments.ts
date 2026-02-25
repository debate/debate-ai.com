/**
 * Fetches the list of tournament names from Tabroom
 * @returns Array of unique tournament names
 */
export async function getTournamentNames(): Promise<string[]> {
  try {
    const res = await fetch("https://www.tabroom.com/index/index.mhtml", {
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`Failed to  fetch tabroom: ${res.status}`);
    }

    const html = await res.text();

    const linkMatches =
      html.match(/<a[^>]*href="[^"]*tourn_id=[^"]*"[^>]*>[\s\S]*?<\/a>/gi) || [];

    const names = linkMatches
      .map((link) => {
        const match = link.match(/>([^<]*(?:<[^a/][^<]*)*)<\/a>/i);
        if (!match) return "";
        return match[1].replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
      })
      .filter((n) => {
        return (
          n.length > 3 &&
          !n.includes("http") &&
          !n.match(/^(Home|Login|Help|About|Contact|Sign Up|Register)$/i)
        );
      });

    // Remove duplicates
    const uniqueNames = Array.from(new Set(names));
    return uniqueNames.slice(0, 100); // Limit results
  } catch (error) {
    return [];
  }
}
