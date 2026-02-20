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

    // Look for links that contain tournament names (typically in <a> tags with tourn_id)
    const linkMatches =
      html.match(/<a[^>]*href="[^"]*tourn_id=[^"]*"[^>]*>([^<]+)<\/a>/gi) || [];

    const names = linkMatches
      .map((link) => {
        // Extract the text between <a> tags
        const match = link.match(/>([^<]+)<\/a>/i);
        if (!match) return "";
        const text = match[1].trim();
        // Filter out obvious non-tournament text
        return text;
      })
      .filter((n) => {
        // Filter out dates (contains numbers like 2024, 01/15), navigation links, and short text
        return (
          n.length > 5 &&
          !n.match(/^\d{1,2}\/\d{1,2}/) && // No dates like 01/15
          !n.match(/^\d{4}/) && // No years like 2024
          !n.match(/\d{4}$/) && // No years at end
          !n.includes("http") &&
          !n.match(/^(Home|Login|Help|About|Contact)$/i) // No nav links
        );
      });

    // Remove duplicates
    const uniqueNames = Array.from(new Set(names));
    return uniqueNames.slice(0, 100); // Limit results
  } catch (error) {
    return [];
  }
}
