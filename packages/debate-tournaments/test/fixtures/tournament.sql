-- A small public tournament (1) with one event, one published round with a
-- ballot, and a published result set, plus a hidden tournament (2).
INSERT INTO tourn (id, name, city, state, country, tz, webname, hidden, start, end, reg_start, reg_end)
VALUES
  (1, 'Golden Gate Invitational', 'San Francisco', 'CA', 'US', 'America/Los_Angeles', 'goldengate', 0,
   '2030-02-01 16:00:00', '2030-02-03 02:00:00', '2029-12-01 08:00:00', '2030-01-25 08:00:00'),
  (2, 'Secret Scrimmage', 'Oakland', 'CA', 'US', 'America/Los_Angeles', 'secret', 1,
   '2030-03-01 16:00:00', '2030-03-02 02:00:00', NULL, NULL);
INSERT INTO category (id, name, abbr, tourn) VALUES (10, 'Debate Judges', 'DJ', 1);
INSERT INTO event (id, name, abbr, type, level, tourn, category, fee) VALUES
  (100, 'Lincoln Douglas', 'LD', 'debate', 'open', 1, 10, 25);
INSERT INTO school (id, name, code, tourn) VALUES (200, 'Lowell High', 'LO', 1);
INSERT INTO entry (id, code, name, event, school, active, waitlist, tourn) VALUES
  (300, 'LO AB', 'Alex Brown', 100, 200, 1, 0, 1),
  (301, 'LO CD', 'Casey Diaz', 100, 200, 1, 0, 1);
INSERT INTO timeslot (id, name, start, end, tourn) VALUES
  (400, 'Round 1', '2030-02-01 17:00:00', '2030-02-01 18:30:00', 1);
INSERT INTO round (id, type, name, label, event, timeslot, published, post_primary) VALUES
  (500, 'prelim', 1, 'Round 1', 100, 400, 1, 3);
INSERT INTO panel (id, letter, round, flight, bye) VALUES (600, '1', 500, 1, 0);
INSERT INTO ballot (id, side, entry, panel) VALUES (700, 1, 300, 600), (701, 2, 301, 600);
INSERT INTO result_set (id, label, tourn, event, published, generated) VALUES
  (800, 'Final Places', 1, 100, 1, '2030-02-03 01:00:00');
INSERT INTO webpage (id, title, slug, content, published, sitewide, tourn) VALUES
  (900, 'About Tabroom', 'about', '<p>Hello</p>', 1, 1, NULL);
