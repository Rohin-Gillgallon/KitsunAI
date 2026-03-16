import { initTRPC } from '@trpc/server';
import { z } from 'zod';
import { db } from '../db';
import { messages, conversations } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { generateReply } from '../model/inference';
import { Settings } from '../store/settings';
import uuid from 'react-native-uuid';

const t = initTRPC.create();

export const appRouter = t.router({

  getConversations: t.procedure.query(() =>
    db.select().from(conversations)
      .orderBy(desc(conversations.createdAt))
      .all()
  ),

  createConversation: t.procedure
    .input(z.object({ title: z.string() }))
    .mutation(async ({ input }) => {
      const id = uuid.v4() as string;
      await db.insert(conversations).values({
        id, title: input.title, createdAt: new Date()
      });
      return { id };
    }),

  getMessages: t.procedure
    .input(z.object({ conversationId: z.string() }))
    .query(({ input }) =>
      db.select().from(messages)
        .where(eq(messages.conversationId, input.conversationId))
        .orderBy(messages.createdAt)
        .all()
    ),

  sendMessage: t.procedure
    .input(z.object({
      conversationId: z.string(),
      content: z.string(),
    }))
    .mutation(async ({ input }) => {
      // Save user message
      await db.insert(messages).values({
        id: uuid.v4() as string,
        conversationId: input.conversationId,
        role: 'user',
        content: input.content,
        createdAt: new Date(),
      });

      // Fetch full history for context
      const history = await db.select().from(messages)
        .where(eq(messages.conversationId, input.conversationId))
        .orderBy(messages.createdAt)
        .all();

      // Run inference
      const reply = await generateReply(
        history,
        Settings.getSystemPrompt()
      );

      // Save assistant reply
      await db.insert(messages).values({
        id: uuid.v4() as string,
        conversationId: input.conversationId,
        role: 'assistant',
        content: reply,
        createdAt: new Date(),
      });

      return { reply };
    }),

  deleteConversation: t.procedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await db.delete(conversations)
        .where(eq(conversations.id, input.id));
    }),

});

export type AppRouter = typeof appRouter;

