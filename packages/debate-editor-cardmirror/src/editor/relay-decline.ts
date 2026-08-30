/**
 * The ONE fix-path sentence for every relay credential-decline
 * surface (mailbox sends, the push stream, session start/join,
 * mid-session rejection). The toast audit found five independently
 * authored ~25-word phrasings of the same 401 — copy edits now
 * happen here once. Deliberately names BOTH paths (account link and
 * self-hosted relay) and never says "subscription": self-hosting is
 * the documented escape from relay gating, and a 401 can't tell a
 * missing membership from a wrong self-host token.
 */
export const RELAY_FIX_PATH =
  'In Settings → Collaboration, connect your Debate Decoded account or set up your own relay.';
