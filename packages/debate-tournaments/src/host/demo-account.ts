/**
 * The demo tournament anyone can browse as its admin, and the mock account
 * they browse as. Kept apart from `./demo` (which carries the seed SQL) so the
 * UI can import the ids without bundling the seed.
 */

/** The Bay Area Invitational in `seed/demo.sql`: running now, with pairings and results. */
export const DEMO_TOURN_ID = 90001;

/** The mock admin: seeded as Tabroom person 90010, owner of {@link DEMO_TOURN_ID}. */
export const DEMO_ADMIN = {
  personId: 90010,
  username: "demo.admin",
  email: "demo.admin@debate-ai.com",
  name: "Demo Admin",
} as const;
