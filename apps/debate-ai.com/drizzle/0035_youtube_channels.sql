--> statement-breakpoint
CREATE TABLE `youtube_channels` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `channel_id` text,
  `name` text NOT NULL,
  `enabled` integer DEFAULT (true) NOT NULL,
  `added_by` text,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_youtube_channels_name` ON `youtube_channels` (`name`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_youtube_channels_channel_id` ON `youtube_channels` (`channel_id`);
--> statement-breakpoint
--> statement-breakpoint
INSERT INTO `youtube_channels` (`name`, `enabled`) VALUES
  ('KansasDebate-wd4vf', 1),
  ('spencerandersonmcelligott', 1),
  ('Adi_Arora_PF', 1),
  ('DebateArchive2', 1),
  ('Debatedrills', 1),
  ('championbriefs1508', 1),
  ('su.debate', 1),
  ('ResolvedDebate', 1),
  ('PolicyDebateCentral', 1),
  ('pfvideos9234', 1),
  ('ddidebate4071', 1),
  ('DebateStreamDB8', 1),
  ('LynbrookDebate', 1),
  ('thatdebatekid5313', 1),
  ('NSD_DebateCamp', 1),
  ('lasadebate', 1),
  ('CEDADebate', 1),
  ('KentuckyDebate', 1),
  ('sailorferrets', 1),
  ('wakedebate8636', 1),
  ('exodusfiles3478', 1),
  ('SolvencyAdvocate', 1),
  ('northbrowardmr4523', 1),
  ('TexasDebate', 1),
  ('jacob_wilkus', 1),
  ('arvindshankar2481', 1),
  ('NDT-jl6oi', 1),
  ('atrujillo9', 1),
  ('UNTDebate', 1),
  ('vintagedebatevids', 1),
  ('georgetowndebateseminar1234', 1),
  ('barkleyforumvideos3220', 1),
  ('BillBatterman', 1),
  ('msudebate6544', 1),
  ('ProfessorGraham', 1),
  ('michigandebate7440', 1),
  ('jettsmith7', 1),
  ('artemisway-g2x', 1);