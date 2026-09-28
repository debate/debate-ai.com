-- Records how a REASON document's `content` column is encoded, matching the
-- column `topic_starter_items` already carries. Uploads store CardMirror's
-- native `.cmir` (base64); documents already in the table are the editor's
-- HTML, which the default names.
ALTER TABLE `documents` ADD `format` text DEFAULT 'html' NOT NULL;
