import { formatDate } from './formate_date';
import { isGlobalAdmin } from './is_admin';
import { getClient, redis } from '../core';
import { getChatIdFromCommand } from './get_chat_id_from_command';
import { MAX_TELEGRAM_MESSAGE_LENGTH } from '../constants';

import type { Context } from 'telegraf';

export async function ban(ctx: Context) {
  const userId = ctx.from?.id;
  if (!userId || !isGlobalAdmin(userId)) return;

  const chatId = getChatIdFromCommand(ctx);
  if (!chatId) {
    await ctx.reply('Usage: /ban {chatId}');
    return;
  }

  const client = await getClient();
  const res = await client.query(
    `
    UPDATE tg_chats
    SET banned_timestamp = CASE
      WHEN banned_timestamp IS NULL THEN NOW()
      ELSE banned_timestamp
    END
    WHERE chat_id = $1
    RETURNING banned_timestamp
    `,
    [chatId],
  );

  if (res.rowCount === 0) {
    await ctx.reply(`Chat ${chatId} not found in database.`);
    return;
  }

  const { banned_timestamp } = res.rows[0];

  if (banned_timestamp) {
    await ctx.reply(
      `Chat ${chatId} has been banned at ${formatDate(banned_timestamp)}.`,
    );
    try {
      await ctx.telegram.sendMessage(chatId, 'This chat was banned!');
    } catch {}
  } else {
    await ctx.reply(`Chat ${chatId} is already banned.`);
  }
}

export async function unban(ctx: Context) {
  const userId = ctx.from?.id;
  if (!userId || !isGlobalAdmin(userId)) return;

  const chatId = getChatIdFromCommand(ctx);
  if (!chatId) {
    await ctx.reply('Usage: /unban {chatId}');
    return;
  }

  const client = await getClient();
  const res = await client.query(
    `
    UPDATE tg_chats
    SET banned_timestamp = CASE
      WHEN banned_timestamp IS NOT NULL THEN NULL
      ELSE banned_timestamp
    END
    WHERE chat_id = $1
    RETURNING banned_timestamp
    `,
    [chatId],
  );

  if (res.rowCount === 0) {
    await ctx.reply(`Chat ${chatId} not found in database.`);
    return;
  }

  const { banned_timestamp } = res.rows[0];

  await redis.del(`chat:${chatId}`);

  if (banned_timestamp === null) {
    await ctx.reply(`Chat ${chatId} has been unbanned.`);
    try {
      await ctx.telegram.sendMessage(chatId, 'This chat was unbanned!');
    } catch {}
  } else {
    await ctx.reply(`Chat ${chatId} is not banned.`);
  }
}

export async function banList(ctx: Context) {
  const userId = ctx.from?.id;
  if (!userId || !isGlobalAdmin(userId)) return;

  const client = await getClient();
  const res = await client.query(
    'SELECT chat_id, banned_timestamp FROM tg_chats WHERE banned_timestamp IS NOT NULL ORDER BY banned_timestamp',
  );

  if (res.rowCount === 0) {
    await ctx.reply('No banned chats!');
    return;
  }

  const header = '<b>Banned chats:</b>';
  const records = res.rows.map(
    (row) =>
      `<code>${row.chat_id}</code> - ${formatDate(row.banned_timestamp)}`,
  );

  const messages: string[] = [];
  let currentMessage = header;

  for (const record of records) {
    const joinedMessage = currentMessage + '\n' + record;
    if (joinedMessage.length > MAX_TELEGRAM_MESSAGE_LENGTH) {
      messages.push(currentMessage.trim());
      currentMessage = record;
    } else {
      currentMessage = joinedMessage;
    }
  }

  if (currentMessage) {
    messages.push(currentMessage);
  }

  for (const message of messages) {
    await ctx.reply(message, { parse_mode: 'HTML' });
  }
}
