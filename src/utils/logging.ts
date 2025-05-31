import { ADMIN_CHAT_ID, ADMIN_MESSAGE_THREAD_ID } from '../config';
import { getClient } from '../core';
import { isGlobalAdmin } from './is_admin';
import { getChatIdFromCommand } from './get_chat_id_from_command';
import { formatDate } from './formate_date';

import type { Client, QueryResult } from 'pg';
import type { Context } from 'telegraf';
import type { Message, MessageId } from 'telegraf/typings/core/types/typegram';
import type { RequestInfo } from '../types';

const query = `
  INSERT INTO media_requests (
    user_id,
    forward_chat_id,
    is_forward,
    chat_id,
    mode,
    message_id,
    media_type,
    logged_message_id,
    file_id,
    file_type,
    file_size,
    duration,
    response,
    language,
    is_error
  ) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
  )
`;

export async function logRequest(
  client: Client,
  requestInfo: RequestInfo,
): Promise<QueryResult> {
  return client.query(query, [
    requestInfo.user_id,
    requestInfo.forward_chat_id,
    requestInfo.is_forward,
    requestInfo.chat_id,
    requestInfo.mode,
    requestInfo.message_id,
    requestInfo.media_type,
    requestInfo.logged_message_id,
    requestInfo.file_id,
    requestInfo.file_type,
    requestInfo.file_size,
    requestInfo.duration,
    requestInfo.response,
    requestInfo.language,
    requestInfo.is_error,
  ]);
}

function formatMessage(
  ctx: Context,
  message: string,
  isError: boolean,
): string {
  const userId = ctx.from?.id;
  const chatId = ctx.message?.chat.id;
  const username = ctx.from?.username;

  const firstName = ctx.from?.first_name;
  const lastName = ctx.from?.last_name;
  const fullName = firstName + (lastName ? ' ' + lastName : '');

  const icon = isError ? '🚨' : 'ℹ️';

  return `${icon} <code>${chatId}</code> | <code>${userId}</code> <code>${fullName}</code>${username ? ' @' + username : ''}:\n\n${message}`;
}

export async function sendMediaToAdmins(
  ctx: Context,
  isReply: boolean,
): Promise<Message> {
  const message = ctx.message!;
  const messageId = isReply
    ? (message as any).reply_to_message.message_id
    : message.message_id;

  return ctx.telegram.forwardMessage(
    ADMIN_CHAT_ID,
    message.chat.id,
    messageId,
    {
      message_thread_id: ADMIN_MESSAGE_THREAD_ID,
    },
  );
}

export async function sendMessageToAdmins(
  ctx: Context,
  message: string,
  isError: boolean = false,
): Promise<Message.TextMessage> {
  const messageFormatted = formatMessage(ctx, message, isError);
  return ctx.telegram.sendMessage(ADMIN_CHAT_ID, messageFormatted, {
    message_thread_id: ADMIN_MESSAGE_THREAD_ID,
    parse_mode: 'HTML',
  });
}

export async function logFileWithTranscription(
  ctx: Context,
  messageIds: number[],
): Promise<MessageId[]> {
  await sendMessageToAdmins(ctx, 'Transcibe file', false);
  return ctx.telegram.copyMessages(
    ADMIN_CHAT_ID,
    ctx.message?.chat.id!,
    messageIds,
    { message_thread_id: ADMIN_MESSAGE_THREAD_ID },
  );
}

export async function logUnknownError(ctx: Context, e: unknown): Promise<void> {
  console.error(e);
  if (ADMIN_CHAT_ID) {
    const errorMessage =
      e instanceof Error
        ? `<code>${e.name} ${e.message}</code>\n\n<pre>${e.stack}</pre>`
        : `<code>${e}</code>`;

    await ctx.telegram.sendMessage(ADMIN_CHAT_ID, `🚨 ${errorMessage}`, {
      message_thread_id: ADMIN_MESSAGE_THREAD_ID,
      parse_mode: 'HTML',
    });
  }
}

export async function enableLogging(ctx: Context) {
  const userId = ctx.from?.id;
  if (!userId || !isGlobalAdmin(userId)) return;

  const chatId = getChatIdFromCommand(ctx);
  if (!chatId) {
    await ctx.reply('Usage: /enable_logging {chatId}');
    return;
  }

  const client = await getClient();
  const res = await client.query(
    'UPDATE tg_chats SET logging_enabled = TRUE WHERE chat_id = $1 RETURNING chat_id',
    [chatId],
  );

  if (res.rowCount === 0) {
    await ctx.reply(`Chat ${chatId} not found in database.`);
    return;
  }

  await ctx.reply(`Logging enabled for chat ${chatId}.`);
}

export async function disableLogging(ctx: Context) {
  const userId = ctx.from?.id;
  if (!userId || !isGlobalAdmin(userId)) return;

  const chatId = getChatIdFromCommand(ctx);
  if (!chatId) {
    await ctx.reply('Usage: /disable_logging {chatId}');
    return;
  }

  const client = await getClient();
  const res = await client.query(
    'UPDATE tg_chats SET logging_enabled = FALSE WHERE chat_id = $1 RETURNING chat_id',
    [chatId],
  );

  if (res.rowCount === 0) {
    await ctx.reply(`Chat ${chatId} not found in database.`);
    return;
  }

  await ctx.reply(`Logging disabled for chat ${chatId}.`);
}

export async function chatList(ctx: Context) {
  const userId = ctx.from?.id;
  if (!userId || !isGlobalAdmin(userId)) return;

  const client = await getClient();
  const res = await client.query(`
    SELECT
      c.chat_id,
      c.banned_timestamp,
      c.logging_enabled,
      c.created_at,
      MAX(r.timestamp) AS last_usage
    FROM tg_chats c
    LEFT JOIN media_requests r ON c.chat_id = r.chat_id
    GROUP BY c.chat_id, c.banned_timestamp, c.logging_enabled, c.created_at
    ORDER BY last_usage DESC NULLS LAST, c.created_at DESC
  `);

  if (res.rowCount === 0) {
    await ctx.reply('No chats found!');
    return;
  }

  const lines = res.rows.map((row) => {
    const logging = row.logging_enabled ? '📝' : '🔏';
    const lastUsage = row.last_usage ? formatDate(row.last_usage) : 'never';
    const createdAt = formatDate(row.created_at);
    const banned = row.banned_timestamp ? '🚫' : '✔️';

    return `${banned}${logging} <code>${row.chat_id}</code> - ${lastUsage} - ${createdAt}`;
  });

  await ctx.reply(`<b>Chats list:</b>\n${lines.join('\n')}`, {
    parse_mode: 'HTML',
  });
}
