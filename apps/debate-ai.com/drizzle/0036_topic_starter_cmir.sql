-- Records how a Topic Starter row's `content` is encoded. Imports now store
-- CardMirror's native `.cmir` (base64); rows already in the table are the
-- card HTML the previous importer wrote, which the default names.
ALTER TABLE `topic_starter_items` ADD `format` text DEFAULT 'html' NOT NULL;
