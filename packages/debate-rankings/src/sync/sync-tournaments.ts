import grab from "grab-url";
import { getTabroomCookie } from "./sync-rankings-ndca";

/**
 * Fetches the list of tournament names from Tabroom
 * @returns Array of unique tournament names
 */
export async function getTournamentNames(): Promise<string[]> {
  try {
    const cookie = getTabroomCookie();
    const result = await grab("https://www.tabroom.com/index/index.mhtml", {
      cache: false,
      ...(cookie ? { headers: { Cookie: cookie } } : {}),
    });

    const html = result.data || "";

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
