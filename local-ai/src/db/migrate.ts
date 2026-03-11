import { db } from './index';
import { sql } from 'drizzle-orm';

export async function runMigrations() {
  db.run(sql`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY NOT NULL,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);
}
