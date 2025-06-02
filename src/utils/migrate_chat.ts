import { getClient } from '../core';
import type { Context, NarrowedContext } from 'telegraf';
import type { Message, Update } from 'telegraf/typings/core/types/typegram';

const query = `
  WITH update_chats AS (
    UPDATE chats
    SET chat_id = $1
    WHERE chat_id = $2
  )
  UPDATE media_requests
  SET chat_id = $1
  WHERE chat_id = $2;
`;

export async function migrateChatMiddleware(
  ctx: NarrowedContext<Context<Update>, Update.MessageUpdate<Message>>,
  next: () => Promise<void>,
) {
  const migrateToChatId = (ctx.message as any).migrate_to_chat_id;

  if (migrateToChatId) {
    const migrateFromChatId = ctx.message.chat.id;
    const client = await getClient();
    await client.query(query, [migrateToChatId, migrateFromChatId]);

    return;
  }

  await next();
}
