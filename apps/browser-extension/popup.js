/**
 * Popup script for the "On Page Card Reuse Search" extension (see
 * TODO.md idea #7, follow-up (a)). Reads the active tab's URL, checks it
 * against the shared reuse index (`api.js`), and renders whether the team
 * has already cut a card from this page.
 */

document.getElementById("options-link").addEventListener("click", (event) => {
  event.preventDefault();
  chrome.runtime.openOptionsPage();
});

function setStatus(className, text) {
  const el = document.getElementById("status");
  el.className = `status ${className}`;
  el.textContent = text;
}

function renderMatches(matches) {
  const container = document.getElementById("matches");
  container.innerHTML = "";
  for (const match of matches) {
    const div = document.createElement("div");
    div.className = "match";
    const title = document.createElement("div");
    title.className = "argBlock";
    title.textContent = match.argBlock || "(untitled)";
    div.appendChild(title);
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = [match.cite, match.topic].filter(Boolean).join(" — ");
    div.appendChild(meta);
    container.appendChild(div);
  }
}

async function run() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const pageUrl = tab?.url ?? "";
  document.getElementById("url").textContent = pageUrl || "(no active tab URL)";

  if (!pageUrl || !/^https?:\/\//.test(pageUrl)) {
    setStatus("error", "Open a web page to check it for existing cards.");
    return;
  }

  try {
    const apiBase = await getApiBase();
    const result = await checkPageForExistingCards(pageUrl, apiBase);
    if (result.alreadyCut) {
      setStatus("cut", `Already cut: ${result.matches.length} existing ${result.matches.length === 1 ? "entry" : "entries"}.`);
      renderMatches(result.matches);
    } else {
      setStatus("safe", "No existing cards found for this page — safe to cut.");
    }
  } catch (err) {
    setStatus("error", err instanceof Error ? err.message : "Reuse check failed.");
  }
}

run();
