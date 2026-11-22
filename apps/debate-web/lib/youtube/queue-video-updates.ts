/**
 * @fileoverview Turns the admin queue's "Edit" dialog PATCH body into
 * `youtube_round_videos` column updates, for `PATCH /api/admin/youtube/videos/[id]`.
 * @module lib/youtube/queue-video-updates
 */

/** Picks the first of `keys` the body actually carries. */
function pick(body: Record<string, unknown>, keys: string[]): { present: boolean; value: unknown } {
  for (const key of keys) if (Object.hasOwn(body, key)) return { present: true, value: body[key] };
  return { present: false, value: undefined };
}

/**
 * Turns the edit dialog's PATCH body into queue-row column updates. Only keys
 * the body carries are written, so a partial body never blanks other fields.
 * Accepts the dialog's names (`aff`, `neg`, `winner`, numeric `style`) and the
 * library form's (`affTeam`, `negTeam`, `affWin`, string `style`).
 */
export function queueVideoUpdates(body: Record<string, unknown>): Record<string, unknown> {
  const updates: Record<string, unknown> = {};
  const setText = (keys: string[], column: string, required = false) => {
    const { present, value } = pick(body, keys);
    if (!present) return;
    const trimmed = typeof value === "string" ? value.trim() : "";
    if (trimmed) updates[column] = trimmed;
    else if (!required && (value === null || typeof value === "string")) updates[column] = null;
  };
  const setBool = (keys: string[], column: string) => {
    const { present, value } = pick(body, keys);
    if (!present) return;
    if (value === true || value === "true") updates[column] = true;
    else if (value === false || value === "false") updates[column] = false;
    else if (value === null || value === "" || value === "unknown") updates[column] = null;
  };
  const style = pick(body, ["style"]);
  if (style.present) {
    const value = style.value;
    if (value === null || value === "none" || value === "") updates.style = null;
    else {
      const parsed = typeof value === "number" ? value : Number(value);
      if (Number.isInteger(parsed)) updates.style = parsed;
    }
  }

  setText(["title"], "title", true);
  setText(["channel"], "channel", true);
  setText(["publishedAt"], "publishedAt", true);
  const description = pick(body, ["description"]);
  if (description.present && (typeof description.value === "string" || description.value === null)) {
    updates.description = typeof description.value === "string" ? description.value.trim() : "";
  }
  setText(["category"], "category");
  if (updates.category === "none") updates.category = null;
  setText(["tournament"], "tournament");
  setText(["roundLevel"], "roundLevel");
  setText(["aff", "affTeam"], "aff");
  setText(["neg", "negTeam"], "neg");
  setText(["judgeDecision"], "judgeDecision");
  setBool(["winner", "affWin"], "winner");
  return updates;
}
