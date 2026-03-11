import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const conversations = sqliteTable('conversations', {
  id:        text('id').primaryKey(),
  title:     text('title').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const messages = sqliteTable('messages', {
  id:             text('id').primaryKey(),
  conversationId: text('conversation_id')
                    .notNull()
                    .references(() => conversations.id, { onDelete: 'cascade' }),
  role:           text('role', { enum: ['user', 'assistant'] }).notNull(),
  content:        text('content').notNull(),
  createdAt:      integer('created_at', { mode: 'timestamp' }).notNull(),
});
