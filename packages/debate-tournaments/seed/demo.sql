-- Demo tournaments for debate-ai.com — dummy data, not a migration.
--
-- Loaded by `bun run db:seed:tournaments` (local D1) or
-- `bun run db:seed:tournaments:d1` (remote) from apps/debate-ai.com, after the
-- Tabroom schema (migrations/0001_tabroom_schema.sql) has been applied.
--
-- Every row uses an id at or above 90000 and `INSERT OR REPLACE`, so the file
-- can be re-run to refresh it and never collides with real Tabroom data.
-- Dates are relative to the moment it is loaded (SQLite `datetime('now', …)`),
-- so the upcoming list and "this weekend" views always have something in them:
--
--   90001 Bay Area Invitational      — running now: published LD/PF pairings and results
--   90002 Golden State Classic       — two weeks out: invite, events, registration open
--   90003 Pacific Northwest Open     — a month out: invite only
--   90004 Staff Scrimmage            — hidden; must never appear publicly
--
-- Signing in to debate-ai.com as demo.judge@debate-ai.com maps the better-auth
-- user onto Tabroom person 90001 (matched by email in src/api/actor.ts).

-- Circuit ----------------------------------------------------------------------
INSERT OR REPLACE INTO circuit (id, name, abbr, tz, active, state, country, webname) VALUES
  (90001, 'Demo Speech & Debate Circuit', 'DEMO', 'America/Los_Angeles', 1, 'CA', 'US', 'demo');

-- Tournaments ------------------------------------------------------------------
INSERT OR REPLACE INTO tourn (id, name, city, state, country, tz, webname, hidden, start, end, reg_start, reg_end) VALUES
  (90001, 'Bay Area Invitational', 'San Francisco', 'CA', 'US', 'America/Los_Angeles', 'demobayarea', 0,
   datetime('now', '-1 day', 'start of day', '+16 hours'), datetime('now', '+1 day', 'start of day', '+23 hours'),
   datetime('now', '-45 days'), datetime('now', '-7 days')),
  (90002, 'Golden State Classic', 'Los Angeles', 'CA', 'US', 'America/Los_Angeles', 'demogoldenstate', 0,
   datetime('now', '+14 days', 'start of day', '+16 hours'), datetime('now', '+15 days', 'start of day', '+23 hours'),
   datetime('now', '-10 days'), datetime('now', '+10 days')),
  (90003, 'Pacific Northwest Open', 'Seattle', 'WA', 'US', 'America/Los_Angeles', 'demopnw', 0,
   datetime('now', '+30 days', 'start of day', '+16 hours'), datetime('now', '+31 days', 'start of day', '+23 hours'),
   datetime('now', '+1 day'), datetime('now', '+25 days')),
  (90004, 'Staff Scrimmage', 'Oakland', 'CA', 'US', 'America/Los_Angeles', 'demoscrimmage', 1,
   datetime('now', '+7 days'), datetime('now', '+8 days'), NULL, NULL);

INSERT OR REPLACE INTO tourn_circuit (id, approved, tourn, circuit) VALUES
  (90001, 1, 90001, 90001), (90002, 1, 90002, 90001), (90003, 1, 90003, 90001);

-- Judge categories and events ------------------------------------------------
INSERT OR REPLACE INTO category (id, name, abbr, tourn) VALUES
  (90001, 'Debate Judges', 'DJ', 90001),
  (90002, 'Debate Judges', 'DJ', 90002),
  (90003, 'Debate Judges', 'DJ', 90003),
  (90004, 'Debate Judges', 'DJ', 90004);

INSERT OR REPLACE INTO event (id, name, abbr, type, level, fee, tourn, category) VALUES
  (90001, 'Varsity Lincoln-Douglas', 'VLD', 'debate', 'open', 30, 90001, 90001),
  (90002, 'Varsity Public Forum',    'VPF', 'debate', 'open', 50, 90001, 90001),
  (90003, 'Varsity Lincoln-Douglas', 'VLD', 'debate', 'open', 30, 90002, 90002),
  (90004, 'Varsity Public Forum',    'VPF', 'debate', 'open', 50, 90002, 90002),
  (90005, 'Varsity Policy',          'VCX', 'debate', 'open', 60, 90002, 90002),
  (90006, 'Novice Lincoln-Douglas',  'NLD', 'debate', 'novice', 25, 90003, 90003),
  (90007, 'Varsity Public Forum',    'VPF', 'debate', 'open', 50, 90003, 90003),
  (90008, 'Varsity Lincoln-Douglas', 'VLD', 'debate', 'open', 30, 90004, 90004);

INSERT OR REPLACE INTO event_setting (id, tag, value, value_text, event) VALUES
  (90001, 'description', 'text', 'Resolved: The United States ought to adopt a universal basic income.', 90001),
  (90002, 'description', 'text', 'Resolved: The United States federal government should substantially expand its surveillance of domestic AI development.', 90002),
  (90003, 'description', 'text', 'One-on-one value debate on the current NSDA LD topic.', 90003),
  (90004, 'description', 'text', 'Two-on-two debate on the current NSDA PF topic.', 90004),
  (90005, 'description', 'text', 'Two-on-two policy debate on the current NSDA policy topic.', 90005),
  (90006, 'description', 'text', 'Open to first-year debaters only.', 90006),
  (90007, 'description', 'text', 'Two-on-two debate on the current NSDA PF topic.', 90007),
  (90008, 'cap', '32', NULL, 90003);

-- Schools and debaters (Bay Area Invitational) ------------------------------
INSERT OR REPLACE INTO chapter (id, name, city, state, country, level) VALUES
  (90001, 'Lowell High School', 'San Francisco', 'CA', 'US', 'highschool'),
  (90002, 'Palo Alto High School', 'Palo Alto', 'CA', 'US', 'highschool'),
  (90003, 'Monta Vista High School', 'Cupertino', 'CA', 'US', 'highschool'),
  (90004, 'College Prep', 'Oakland', 'CA', 'US', 'highschool');

INSERT OR REPLACE INTO school (id, name, code, tourn, chapter, state) VALUES
  (90001, 'Lowell High School', 'LO', 90001, 90001, 'CA'),
  (90002, 'Palo Alto High School', 'PA', 90001, 90002, 'CA'),
  (90003, 'Monta Vista High School', 'MV', 90001, 90003, 'CA'),
  (90004, 'College Prep', 'CP', 90001, 90004, 'CA'),
  (90005, 'Lowell High School', 'LO', 90002, 90001, 'CA'),
  (90006, 'Palo Alto High School', 'PA', 90002, 90002, 'CA');

INSERT OR REPLACE INTO student (id, first, last, grad_year, novice, chapter) VALUES
  (90001, 'Maya', 'Chen', 2027, 0, 90001),
  (90002, 'Jordan', 'Patel', 2027, 0, 90002),
  (90003, 'Sam', 'Okafor', 2028, 0, 90003),
  (90004, 'Riley', 'Nguyen', 2026, 0, 90004),
  (90005, 'Avery', 'Brooks', 2027, 0, 90001),
  (90006, 'Theo', 'Ramirez', 2027, 0, 90001),
  (90007, 'Priya', 'Shah', 2026, 0, 90002),
  (90008, 'Eli', 'Goldberg', 2026, 0, 90002),
  (90009, 'Nora', 'Kim', 2028, 0, 90003),
  (90010, 'Leo', 'Martins', 2028, 0, 90003),
  (90011, 'Zoe', 'Adeyemi', 2027, 0, 90004),
  (90012, 'Ian', 'Walsh', 2027, 0, 90004);

INSERT OR REPLACE INTO entry (id, code, name, active, dropped, waitlist, unconfirmed, tourn, school, event) VALUES
  -- VLD
  (90001, 'LO MC', 'Maya Chen',       1, 0, 0, 0, 90001, 90001, 90001),
  (90002, 'PA JP', 'Jordan Patel',    1, 0, 0, 0, 90001, 90002, 90001),
  (90003, 'MV SO', 'Sam Okafor',      1, 0, 0, 0, 90001, 90003, 90001),
  (90004, 'CP RN', 'Riley Nguyen',    1, 0, 0, 0, 90001, 90004, 90001),
  -- VPF
  (90005, 'LO BR', 'Brooks & Ramirez',  1, 0, 0, 0, 90001, 90001, 90002),
  (90006, 'PA SG', 'Shah & Goldberg',   1, 0, 0, 0, 90001, 90002, 90002),
  (90007, 'MV KM', 'Kim & Martins',     1, 0, 0, 0, 90001, 90003, 90002),
  (90008, 'CP AW', 'Adeyemi & Walsh',   1, 0, 0, 0, 90001, 90004, 90002),
  -- Golden State Classic registrations
  (90009, 'LO MC', 'Maya Chen',       1, 0, 0, 0, 90002, 90005, 90003),
  (90010, 'PA JP', 'Jordan Patel',    1, 0, 0, 0, 90002, 90006, 90003);

INSERT OR REPLACE INTO entry_student (id, entry, student) VALUES
  (90001, 90001, 90001), (90002, 90002, 90002), (90003, 90003, 90003), (90004, 90004, 90004),
  (90005, 90005, 90005), (90006, 90005, 90006), (90007, 90006, 90007), (90008, 90006, 90008),
  (90009, 90007, 90009), (90010, 90007, 90010), (90011, 90008, 90011), (90012, 90008, 90012),
  (90013, 90009, 90001), (90014, 90010, 90002);

-- Judges (with paradigms) ----------------------------------------------------
INSERT OR REPLACE INTO person (id, email, first, last, country, tz, site_admin, no_email) VALUES
  (90001, 'demo.judge@debate-ai.com', 'Dana', 'Whitfield', 'US', 'America/Los_Angeles', 0, 1),
  (90002, 'demo.judge2@debate-ai.com', 'Marcus', 'Lee', 'US', 'America/Los_Angeles', 0, 1),
  (90003, 'demo.judge3@debate-ai.com', 'Elena', 'Vasquez', 'US', 'America/Los_Angeles', 0, 1),
  (90004, 'demo.judge4@debate-ai.com', 'Chris', 'Thompson', 'US', 'America/Los_Angeles', 0, 1);

INSERT OR REPLACE INTO person_setting (id, tag, value, value_text, person) VALUES
  (90001, 'paradigm', 'text', '<p>Tech over truth, but warrants matter. Extend your impacts through the final speech. I flow on paper.</p>', 90001),
  (90002, 'paradigm', 'text', '<p>Lay judge. Speak clearly, explain your evidence and weigh at the end.</p>', 90002),
  (90003, 'paradigm', 'text', '<p>Former LD debater. Frameworks are fine; tell me how the value and criterion filter the round.</p>', 90003),
  (90004, 'paradigm', 'text', '<p>Policy background. Comfortable with speed; clash beats blippy extensions.</p>', 90004);

INSERT OR REPLACE INTO judge (id, code, first, last, active, obligation, hired, school, category, person) VALUES
  (90001, 'A1', 'Dana', 'Whitfield', 1, 6, 0, 90001, 90001, 90001),
  (90002, 'A2', 'Marcus', 'Lee', 1, 6, 0, 90002, 90001, 90002),
  (90003, 'A3', 'Elena', 'Vasquez', 1, 6, 0, 90003, 90001, 90003),
  (90004, 'A4', 'Chris', 'Thompson', 1, 6, 0, 90004, 90001, 90004);

-- Rooms and the schedule -------------------------------------------------------
INSERT OR REPLACE INTO site (id, name, online, circuit) VALUES (90001, 'Lowell High School', 0, 90001);
INSERT OR REPLACE INTO tourn_site (id, tourn, site) VALUES (90001, 90001, 90001);
INSERT OR REPLACE INTO room (id, building, name, quality, capacity, inactive, deleted, ada, site) VALUES
  (90001, 'Main', 'Room 101', 1, 30, 0, 0, 1, 90001),
  (90002, 'Main', 'Room 102', 1, 30, 0, 0, 1, 90001),
  (90003, 'Main', 'Room 201', 1, 30, 0, 0, 0, 90001),
  (90004, 'Main', 'Room 202', 1, 30, 0, 0, 0, 90001);

INSERT OR REPLACE INTO timeslot (id, name, start, end, tourn) VALUES
  (90001, 'Round 1', datetime('now', '-1 day', 'start of day', '+17 hours'), datetime('now', '-1 day', 'start of day', '+18 hours', '+30 minutes'), 90001),
  (90002, 'Round 2', datetime('now', '-1 day', 'start of day', '+19 hours'), datetime('now', '-1 day', 'start of day', '+20 hours', '+30 minutes'), 90001),
  (90003, 'Round 3', datetime('now', '+1 day', 'start of day', '+17 hours'), datetime('now', '+1 day', 'start of day', '+18 hours', '+30 minutes'), 90001),
  (90004, 'Round 1', datetime('now', '+14 days', 'start of day', '+17 hours'), datetime('now', '+14 days', 'start of day', '+18 hours', '+30 minutes'), 90002),
  (90005, 'Round 1', datetime('now', '+30 days', 'start of day', '+17 hours'), datetime('now', '+30 days', 'start of day', '+18 hours', '+30 minutes'), 90003),
  (90006, 'Round 1', datetime('now', '+7 days'), datetime('now', '+7 days', '+90 minutes'), 90004);

-- Rounds: published = 1 (full pairings), post_primary = 3 (results public).
INSERT OR REPLACE INTO round (id, type, name, label, flighted, published, post_primary, event, timeslot, site) VALUES
  (90001, 'prelim', 1, 'Round 1', 1, 1, 3, 90001, 90001, 90001),
  (90002, 'prelim', 2, 'Round 2', 1, 1, 3, 90001, 90002, 90001),
  (90003, 'prelim', 1, 'Round 1', 1, 1, 3, 90002, 90001, 90001),
  (90004, 'prelim', 3, 'Round 3', 1, 0, 0, 90001, 90003, 90001);

-- Sections: two per round; each has an Aff (side 1) and Neg (side 2) ballot
-- from one judge. Winners carry a 'winloss' score of 1.
INSERT OR REPLACE INTO panel (id, letter, flight, bye, bracket, publish, room, round) VALUES
  (90001, '1', 1, 0, 0, 1, 90001, 90001),
  (90002, '2', 1, 0, 0, 1, 90002, 90001),
  (90003, '1', 1, 0, 1, 1, 90001, 90002),
  (90004, '2', 1, 0, 0, 1, 90002, 90002),
  (90005, '1', 1, 0, 0, 1, 90003, 90003),
  (90006, '2', 1, 0, 0, 1, 90004, 90003);

INSERT OR REPLACE INTO ballot (id, side, speakerorder, chair, bye, forfeit, audit, judge, panel, entry) VALUES
  -- VLD R1: Chen v Patel (Whitfield), Okafor v Nguyen (Lee)
  (90001, 1, 1, 0, 0, 0, 1, 90001, 90001, 90001),
  (90002, 2, 2, 0, 0, 0, 1, 90001, 90001, 90002),
  (90003, 1, 1, 0, 0, 0, 1, 90002, 90002, 90003),
  (90004, 2, 2, 0, 0, 0, 1, 90002, 90002, 90004),
  -- VLD R2: Chen v Okafor (Vasquez), Nguyen v Patel (Thompson)
  (90005, 1, 1, 0, 0, 0, 1, 90003, 90003, 90001),
  (90006, 2, 2, 0, 0, 0, 1, 90003, 90003, 90003),
  (90007, 1, 1, 0, 0, 0, 1, 90004, 90004, 90004),
  (90008, 2, 2, 0, 0, 0, 1, 90004, 90004, 90002),
  -- VPF R1: Brooks & Ramirez v Shah & Goldberg (Thompson), Kim & Martins v Adeyemi & Walsh (Vasquez)
  (90009, 1, 1, 0, 0, 0, 1, 90004, 90005, 90005),
  (90010, 2, 2, 0, 0, 0, 1, 90004, 90005, 90006),
  (90011, 1, 1, 0, 0, 0, 1, 90003, 90006, 90007),
  (90012, 2, 2, 0, 0, 0, 1, 90003, 90006, 90008);

INSERT OR REPLACE INTO score (id, tag, value, ballot, student) VALUES
  (90001, 'winloss', 1, 90001, NULL), (90002, 'winloss', 0, 90002, NULL),
  (90003, 'winloss', 0, 90003, NULL), (90004, 'winloss', 1, 90004, NULL),
  (90005, 'winloss', 1, 90005, NULL), (90006, 'winloss', 0, 90006, NULL),
  (90007, 'winloss', 1, 90007, NULL), (90008, 'winloss', 0, 90008, NULL),
  (90009, 'winloss', 0, 90009, NULL), (90010, 'winloss', 1, 90010, NULL),
  (90011, 'winloss', 1, 90011, NULL), (90012, 'winloss', 0, 90012, NULL),
  (90013, 'point', 29.1, 90001, 90001), (90014, 'point', 28.4, 90002, 90002),
  (90015, 'point', 28.2, 90003, 90003), (90016, 'point', 28.9, 90004, 90004),
  (90017, 'point', 29.4, 90005, 90001), (90018, 'point', 28.0, 90006, 90003),
  (90019, 'point', 28.7, 90007, 90004), (90020, 'point', 28.3, 90008, 90002);

-- Results ----------------------------------------------------------------------
INSERT OR REPLACE INTO result_set (id, tag, entity, label, bracket, published, coach, generated, tourn, event) VALUES
  (90001, 'entry', 'entry', 'Prelim Seeds', 0, 1, 0, datetime('now', '-1 day', 'start of day', '+21 hours'), 90001, 90001),
  (90002, 'entry', 'entry', 'Prelim Seeds', 0, 1, 0, datetime('now', '-1 day', 'start of day', '+21 hours'), 90001, 90002);

INSERT OR REPLACE INTO result_key (id, tag, description, no_sort, sort_desc, result_set) VALUES
  (90001, 'W', 'Wins', 0, 1, 90001),
  (90002, 'Pts', 'Speaker points', 0, 1, 90001),
  (90003, 'W', 'Wins', 0, 1, 90002);

INSERT OR REPLACE INTO result (id, rank, place, result_set, entry, school) VALUES
  (90001, 1, '1st', 90001, 90001, 90001),
  (90002, 2, '2nd', 90001, 90004, 90004),
  (90003, 3, '3rd', 90001, 90002, 90002),
  (90004, 4, '4th', 90001, 90003, 90003),
  (90005, 1, '1st', 90002, 90006, 90002),
  (90006, 2, '2nd', 90002, 90007, 90003),
  (90007, 3, '3rd', 90002, 90005, 90001),
  (90008, 4, '4th', 90002, 90008, 90004);

INSERT OR REPLACE INTO result_value (id, value, priority, result, result_key) VALUES
  (90001, '2', 1, 90001, 90001), (90002, '58.5', 2, 90001, 90002),
  (90003, '2', 1, 90002, 90001), (90004, '57.6', 2, 90002, 90002),
  (90005, '0', 1, 90003, 90001), (90006, '56.7', 2, 90003, 90002),
  (90007, '0', 1, 90004, 90001), (90008, '56.2', 2, 90004, 90002),
  (90009, '1', 1, 90005, 90003), (90010, '1', 1, 90006, 90003),
  (90011, '0', 1, 90007, 90003), (90012, '0', 1, 90008, 90003);

-- Invite pages -----------------------------------------------------------------
INSERT OR REPLACE INTO webpage (id, title, slug, content, published, sitewide, special, page_order, tourn) VALUES
  (90001, 'Welcome', 'main', '<p>Welcome to the Bay Area Invitational — two days of LD and PF at Lowell High School. Pairings and results post here as rounds are released.</p>', 1, 0, 'main', 1, 90001),
  (90002, 'Welcome', 'main', '<p>The Golden State Classic returns to Los Angeles. Registration is open; entries are capped at 32 per event.</p>', 1, 0, 'main', 1, 90002),
  (90003, 'Hotels', 'hotels', '<p>A hotel block is held at the Downtown Marriott until one week before the tournament.</p>', 1, 0, NULL, 2, 90002),
  (90004, 'Welcome', 'main', '<p>The Pacific Northwest Open is a novice-friendly tournament hosted in Seattle.</p>', 1, 0, 'main', 1, 90003);
