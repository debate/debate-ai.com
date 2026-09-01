/**
 * Popup UI for the "On Page Card Reuse Search" extension (see TODO.md idea
 * #7, follow-up (a)). Reads the active tab's URL, checks it against the
 * shared reuse index (`utils/api.ts`), and renders whether the team has
 * already cut a card from this page.
 */
import { useEffect, useState } from "react";
import { browser } from "wxt/browser";

import { checkPageForExistingCards, getActiveTabUrl, getApiBase, type ReuseMatch } from "@/utils/api";

type Status = "loading" | "safe" | "cut" | "error";

export default function App() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("Checking…");
  const [matches, setMatches] = useState<ReuseMatch[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const pageUrl = await getActiveTabUrl();
      if (cancelled) return;
      setUrl(pageUrl);

      if (!pageUrl || !/^https?:\/\//.test(pageUrl)) {
        setStatus("error");
        setMessage("Open a web page to check it for existing cards.");
        return;
      }

      try {
        const apiBase = await getApiBase();
        const result = await checkPageForExistingCards(pageUrl, apiBase);
        if (cancelled) return;
        if (result.alreadyCut) {
          setStatus("cut");
          setMessage(
            `Already cut: ${result.matches.length} existing ${result.matches.length === 1 ? "entry" : "entries"}.`,
          );
          setMatches(result.matches);
        } else {
          setStatus("safe");
          setMessage("No existing cards found for this page — safe to cut.");
        }
      } catch (err) {
        if (cancelled) return;
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "Reuse check failed.");
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <h1>On-Page Card Reuse Check</h1>
      <div className="url">{url || "(no active tab URL)"}</div>
      <div className={`status ${status}`}>{message}</div>
      <div>
        {matches.map((match, i) => (
          <div className="match" key={`${match.cite ?? match.argBlock ?? ""}-${i}`}>
            <div className="argBlock">{match.argBlock || "(untitled)"}</div>
            <div className="meta">{[match.cite, match.topic].filter(Boolean).join(" — ")}</div>
          </div>
        ))}
      </div>
      <footer>
        <a
          href="#"
          onClick={(event) => {
            event.preventDefault();
            browser.runtime.openOptionsPage();
          }}
        >
          Settings
        </a>
      </footer>
    </div>
  );
}
