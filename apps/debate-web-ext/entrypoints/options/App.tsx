/**
 * Options page — lets a contributor point the extension at a different
 * debate-ai.com deployment (e.g. a staging environment) instead of the
 * production default.
 */
import { useEffect, useState } from "react";

import { getApiBase, setApiBase } from "@/utils/api";

export default function App() {
  const [apiBase, setApiBaseValue] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getApiBase().then(setApiBaseValue);
  }, []);

  async function handleSave() {
    await setApiBase(apiBase);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div>
      <h1>Debate AI — Card Reuse Check</h1>
      <label htmlFor="api-base">API base URL</label>
      <input
        id="api-base"
        placeholder="https://debate-ai.com"
        value={apiBase}
        onChange={(event) => setApiBaseValue(event.target.value)}
      />
      <p className="hint">
        The debate-ai.com deployment this extension checks against. Only the production domain and
        localhost:3000 are pre-authorized in the extension's manifest — pointing this at another host
        will show a permissions error until the extension is re-installed with that host added.
      </p>
      <button onClick={handleSave}>Save</button>
      {saved ? <p className="saved">Saved.</p> : null}
    </div>
  );
}
