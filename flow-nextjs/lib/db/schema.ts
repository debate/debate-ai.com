import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";
import { relations, sql } from "drizzle-orm";

// Helper for UUID generation in SQLite
const uuid = () => sql`(lower(hex(randomblob(16))))`;
const timestamp = () => sql`(datetime('now'))`;

// Users table (integrated with better-auth)
export const users = sqliteTable("users", {
  id: text("id").primaryKey().$default(() => crypto.randomUUID()),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).default(false),
  name: text("name"),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey().$default(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey().$default(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  expiresAt: integer("expires_at", { mode: "timestamp" }),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

export const verifications = sqliteTable("verifications", {
  id: text("id").primaryKey().$default(() => crypto.randomUUID()),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

// Authors table
export const authors = sqliteTable("authors", {
  id: text("id").primaryKey().$default(() => crypto.randomUUID()),
  name: text("name").notNull(),
  isPerson: integer("is_person", { mode: "boolean" }).default(true),
  description: text("description"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

// Cards table (citation cards)
export const cards = sqliteTable("cards", {
  id: text("id").primaryKey().$default(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tag: text("tag").notNull(), // One-sentence summary
  title: text("title").notNull(),
  url: text("url").notNull(),
  siteName: text("site_name"),
  date: text("date", { mode: "json" }).$type<{ month: string; day: string; year: string }>(),
  accessDate: text("access_date", { mode: "json" }).$type<{ month: string; day: string; year: string }>().notNull(),
  paras: text("paras", { mode: "json" }).$type<Array<Array<{ text: string; underline: boolean; highlight: boolean }>>>().notNull(),
  isPrivate: integer("is_private", { mode: "boolean" }).default(false),
  cardHtml: text("card_html"), // For export/backup
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

// Card Authors junction table (many-to-many)
export const cardAuthors = sqliteTable("card_authors", {
  cardId: text("card_id").notNull().references(() => cards.id, { onDelete: "cascade" }),
  authorId: text("author_id").notNull().references(() => authors.id, { onDelete: "cascade" }),
  order: integer("order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.cardId, table.authorId] }),
}));

// Collections table
export const collections = sqliteTable("collections", {
  id: text("id").primaryKey().$default(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  isPublic: integer("is_public", { mode: "boolean" }).default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

// Card Collections junction table (many-to-many)
export const cardCollections = sqliteTable("card_collections", {
  cardId: text("card_id").notNull().references(() => cards.id, { onDelete: "cascade" }),
  collectionId: text("collection_id").notNull().references(() => collections.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.cardId, table.collectionId] }),
}));

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  cards: many(cards),
  collections: many(collections),
  sessions: many(sessions),
  accounts: many(accounts),
}));

export const cardsRelations = relations(cards, ({ one, many }) => ({
  user: one(users, {
    fields: [cards.userId],
    references: [users.id],
  }),
  cardAuthors: many(cardAuthors),
  cardCollections: many(cardCollections),
}));

export const authorsRelations = relations(authors, ({ many }) => ({
  cardAuthors: many(cardAuthors),
}));

export const cardAuthorsRelations = relations(cardAuthors, ({ one }) => ({
  card: one(cards, {
    fields: [cardAuthors.cardId],
    references: [cards.id],
  }),
  author: one(authors, {
    fields: [cardAuthors.authorId],
    references: [authors.id],
  }),
}));

export const collectionsRelations = relations(collections, ({ one, many }) => ({
  user: one(users, {
    fields: [collections.userId],
    references: [users.id],
  }),
  cardCollections: many(cardCollections),
}));

export const cardCollectionsRelations = relations(cardCollections, ({ one }) => ({
  card: one(cards, {
    fields: [cardCollections.cardId],
    references: [cards.id],
  }),
  collection: one(collections, {
    fields: [cardCollections.collectionId],
    references: [collections.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

// Types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Card = typeof cards.$inferSelect;
export type NewCard = typeof cards.$inferInsert;
export type Author = typeof authors.$inferSelect;
export type NewAuthor = typeof authors.$inferInsert;
export type Collection = typeof collections.$inferSelect;
export type NewCollection = typeof collections.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Verification = typeof verifications.$inferSelect;
