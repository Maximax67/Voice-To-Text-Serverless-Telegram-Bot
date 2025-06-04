import { Readable } from 'stream';

import { ADMIN_CHAT_ID, ADMIN_MESSAGE_THREAD_ID } from '../config';
import { getClient } from '../core';
import { isGlobalAdmin } from './is_admin';
import { getChatIdFromCommand } from './get_chat_id_from_command';
import { formatDateTime } from './format_datetime';
import { getChatInfo, getChatName } from './get_chat_info';
import { LANGUAGE_CODES, MAX_TELEGRAM_MESSAGE_LENGTH } from '../constants';
import { escapeHTML } from './escape_html';
import { formatBytesToString } from './format_bytes_to_string';

import type { Client, QueryResult } from 'pg';
import type { Context } from 'telegraf';
import type { Message, MessageId } from 'telegraf/typings/core/types/typegram';
import type { ChatInfo, RequestInfo } from '../types';

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
    error,
    language,
    media_download_time,
    api_request_time,
    total_request_time
  ) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
  );
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
    requestInfo.error,
    requestInfo.language,
    requestInfo.media_download_time,
    requestInfo.api_request_time,
    requestInfo.total_request_time,
  ]);
}

function formatMessage(
  ctx: Context,
  message: string,
  isError: boolean = false,
  chatName: string | null = null,
): string {
  const userId = ctx.from?.id;
  const chatId = ctx.message?.chat.id;
  const username = ctx.from?.username;
  const isPrivateChat = ctx.message?.chat.type === 'private';

  const firstName = ctx.from?.first_name;
  const lastName = ctx.from?.last_name;
  const fullName = firstName + (lastName ? ' ' + lastName : '');
  const fullNameEscaped = escapeHTML(fullName);

  const icon = isError ? '🚨' : 'ℹ️';
  const chatNameLabel = chatName
    ? `<code>${escapeHTML(chatName)}</code>${isPrivateChat ? ' | ' : '\n'}`
    : '';
  const chatInfoLabel = isPrivateChat
    ? `<code>${chatId}</code>`
    : `<code>${chatId}</code> | <code>${userId}</code>`;

  const messageEscaped = escapeHTML(message);
  const fullNameLabel = `<code>${isPrivateChat || (username && chatName) ? fullNameEscaped : ''}</code>`;
  const usernameLabel = `${username && !(isPrivateChat && chatName?.startsWith('@')) ? ' @' + username : ''}`;

  return `${icon} ${chatNameLabel}${chatInfoLabel}\n${fullNameLabel}${usernameLabel}\n\n${messageEscaped}`;
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
  const chatName = await getChatName(ctx, ctx.chat!.id);
  const messageFormatted = formatMessage(ctx, message, isError, chatName);

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

export async function logUnknownError(e: unknown, ctx: Context): Promise<void> {
  console.error(e);
  if (ADMIN_CHAT_ID) {
    let message: string;

    if (e instanceof Error) {
      const title = `<code>${escapeHTML(e.name)} ${escapeHTML(e.message)}</code>`;
      const stack = e.stack ? `\n\n<pre>${escapeHTML(e.stack)}</pre>` : '';

      message = title + stack;
    } else {
      message = escapeHTML(String(e));
    }

    await ctx.telegram.sendMessage(ADMIN_CHAT_ID, `🚨 ${message}`, {
      message_thread_id: ADMIN_MESSAGE_THREAD_ID,
      parse_mode: 'HTML',
    });
  }
}

export async function enableLogging(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId || !isGlobalAdmin(userId)) return;

  const chatId = getChatIdFromCommand(ctx);
  if (!chatId) {
    await ctx.reply('Usage: /enable_logging {chatId}');
    return;
  }

  const client = await getClient();
  const res = await client.query(
    'UPDATE chats SET logging_enabled = TRUE WHERE chat_id = $1 RETURNING chat_id;',
    [chatId],
  );

  if (res.rowCount === 0) {
    await ctx.reply(`Chat <code>${chatId}</code> not found in database.`, {
      parse_mode: 'HTML',
    });
    return;
  }

  await ctx.reply(`Logging enabled for chat <code>${chatId}</code>.`, {
    parse_mode: 'HTML',
  });
}

export async function disableLogging(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId || !isGlobalAdmin(userId)) return;

  const chatId = getChatIdFromCommand(ctx);
  if (!chatId) {
    await ctx.reply('Usage: /disable_logging {chatId}');
    return;
  }

  const client = await getClient();
  const res = await client.query(
    'UPDATE chats SET logging_enabled = FALSE WHERE chat_id = $1 RETURNING chat_id;',
    [chatId],
  );

  if (res.rowCount === 0) {
    await ctx.reply(`Chat <code>${chatId}</code> not found in database.`, {
      parse_mode: 'HTML',
    });
    return;
  }

  await ctx.reply(`Logging disabled for chat <code>${chatId}</code>.`, {
    parse_mode: 'HTML',
  });
}

export async function chatList(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId || !isGlobalAdmin(userId)) return;

  const client = await getClient();
  const res = await client.query(`
    SELECT
      c.chat_id,
      c.banned_timestamp,
      c.logging_enabled,
      c.created_at,
      MAX(r.timestamp) AS last_usage,
      COUNT(r.id) AS usage_count
    FROM chats c
    LEFT JOIN media_requests r ON c.chat_id = r.chat_id
    GROUP BY c.chat_id, c.banned_timestamp, c.logging_enabled, c.created_at
    ORDER BY last_usage DESC NULLS LAST, c.created_at DESC;
  `);

  if (res.rowCount === 0) {
    await ctx.reply('No chats found!');
    return;
  }

  const lines = await Promise.all(
    res.rows.map(async (row) => {
      const loggingIcon = row.logging_enabled ? '📝' : '🔏';
      const lastUsage = row.last_usage
        ? formatDateTime(row.last_usage)
        : 'never';
      const createdAt = formatDateTime(row.created_at);
      const bannedIcon = row.banned_timestamp ? '🚫' : '✔️';
      const chatName = await getChatName(ctx, row.chat_id);

      let result = `${bannedIcon} ${loggingIcon} <code>`;
      if (chatName) {
        result += `${escapeHTML(chatName)}</code>\nId: <code>${row.chat_id}</code>\n`;
      } else {
        result += `${row.chat_id}</code>\n`;
      }

      return (
        result +
        `Requests: ${row.usage_count}\n` +
        `Last usage: ${lastUsage}\n` +
        `Joined on: ${createdAt}\n`
      );
    }),
  );

  const messages: string[] = [];
  let currentMessage = '';

  for (const line of lines) {
    const joinedMessage = currentMessage + '\n' + line;
    if (joinedMessage.length > MAX_TELEGRAM_MESSAGE_LENGTH) {
      messages.push(currentMessage);
      currentMessage = line;
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

export async function getLogs(ctx: Context, isCsv: boolean): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId || !isGlobalAdmin(userId)) return;

  const chatId = getChatIdFromCommand(ctx);
  if (!chatId) {
    if ((ctx.message as Message.TextMessage).text.indexOf(' ') !== -1) {
      await ctx.reply(`Usage: /logs${isCsv ? '' : '_json'} {chatId}`);
      return;
    }
  }

  let logs: RequestInfo[];
  let filenamePart: string;
  let captionPart: string;

  const client = await getClient();
  if (chatId) {
    const chatRes = await client.query<ChatInfo>(
      'SELECT chat_id FROM chats WHERE chat_id = $1;',
      [chatId],
    );

    if (chatRes.rowCount === 0) {
      await ctx.reply('Chat not found.');
      return;
    }

    const reqRes = await client.query<RequestInfo>(
      'SELECT * FROM media_requests WHERE chat_id = $1 ORDER BY id;',
      [chatId],
    );
    logs = reqRes.rows;

    const chatName = await getChatName(ctx, chatId);

    filenamePart = chatName
      ? `${chatId}_${chatName.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_')}`
      : chatId.toString();
    captionPart = chatName
      ? `<code>${escapeHTML(chatName)}</code> (<code>${chatId}</code>)`
      : `<code>${chatId}</code>`;
  } else {
    const reqRes = await client.query<RequestInfo>(
      'SELECT * FROM media_requests ORDER BY id;',
    );
    logs = reqRes.rows;
    filenamePart = 'all';
    captionPart = 'all chats';
  }

  if (!logs.length) {
    await ctx.reply(chatId ? 'No logs found for this chat!' : 'No logs found!');
    return;
  }

  const now = new Date();
  const dateString = now.toLocaleDateString('en-GB').replace(/\//g, '-');
  const timeString = now.toTimeString().split(' ')[0].replace(/:/g, '-');

  const baseFilename = `chatlog_${filenamePart}_${dateString}_${timeString}`;

  if (isCsv) {
    function escapeCSV(val: any): string {
      if (val === null || val === undefined) return '';
      if (val instanceof Date) {
        return `"${val.toISOString()}"`;
      }

      let str = String(val);
      str = str.replace(/"/g, '""');
      return `"${str}"`;
    }

    const csvHeaders = Object.keys(logs[0]);
    const csvRows = [
      csvHeaders.map(escapeCSV).join(','),
      ...logs.map((row) =>
        csvHeaders.map((h) => escapeCSV(row[h as keyof RequestInfo])).join(','),
      ),
    ];

    const csvContent = csvRows.join('\r\n');
    const csvStream = Readable.from([csvContent]);

    await ctx.replyWithDocument(
      { source: csvStream, filename: `${baseFilename}.csv` },
      {
        caption: `CSV logs for ${captionPart}`,
        parse_mode: 'HTML',
      },
    );

    return;
  }

  const json = JSON.stringify(logs);
  const stream = Readable.from([json]);

  await ctx.replyWithDocument(
    { source: stream, filename: `${baseFilename}.json` },
    {
      caption: `JSON logs for ${captionPart}`,
      parse_mode: 'HTML',
    },
  );
}
