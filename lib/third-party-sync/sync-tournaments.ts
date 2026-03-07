import grab from "grab-url";

/**
 * Fetches the list of tournament names from Tabroom
 * @returns Array of unique tournament names
 */
export async function getTournamentNames(): Promise<string[]> {
  try {
    const data = await grab("https://www.tabroom.com/index/index.mhtml", {
      cache: false,
    });

    const html = await data.text();

    const linkMatches =
      html.match(/<a[^>]*href="[^"]*tourn_id=[^"]*"[^>]*>[\s\S]*?<\/a>/gi) ||
      [];

    const names = linkMatches
      .map((link: string) => {
        const match = link.match(/>([^<]*(?:<[^a/][^<]*)*)<\/a>/i);
        if (!match) return "";
        return match[1]
          .replace(/<[^>]*>/g, "")
          .replace(/\s+/g, " ")
          .trim();
      })
      .filter((n: string) => {
        return (
          n.length > 3 &&
          !n.includes("http") &&
          !n.match(/^(Home|Login|Help|About|Contact|Sign Up|Register)$/i)
        );
      });

    // Remove duplicates
    const uniqueNames = Array.from(new Set(names)) as string[];
    return uniqueNames.slice(0, 100); // Limit results
  } catch (error) {
    return [];
  }
}
