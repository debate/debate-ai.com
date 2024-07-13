// src/lib/db/schema.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const files = sqliteTable('files', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  users: text('users').notNull(),
  lastUpdated: integer('last_updated', { mode: 'timestamp' }).notNull()
});

export const userSettings = sqliteTable('user_settings', {
  userId: text('user_id').primaryKey(),
  settings: text('settings').notNull()
});

export const userFileIndex = sqliteTable('user_file_index', {
  userId: text('user_id').notNull(),
  fileId: text('file_id').notNull(),
}, (table) => ({
  pk: { type: "primary", columns: [table.userId, table.fileId] }
}));

// ... (rest of the implementation remains the same)