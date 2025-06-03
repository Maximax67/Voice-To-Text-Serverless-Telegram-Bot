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

export async function showChatStatistics(ctx: Context): Promise<void> {
  const chatId = ctx.chat!.id;
  const client = await getClient();
  const chatInfo = await getChatInfo(client, chatId);

  const reqRes = await client.query<{
    usage_count: number;
    first_usage: Date | null;
    last_usage: Date | null;
    users_count: number;
    error_count: number;
    avg_duration: string | null;
    avg_file_size: string | null;
    mode_transcribe: number;
    mode_translate: number;
    media_audio: number;
    media_voice: number;
    media_video: number;
    media_video_note: number;
    forwarded_count: number;
    avg_response_length: string | null;
    avg_total_request_time: string | null;
  }>(
    `
    SELECT
      COUNT(*) AS usage_count,
      MIN(timestamp) AS first_usage,
      MAX(timestamp) AS last_usage,
      COUNT(DISTINCT user_id) AS users_count,
      COUNT(*) FILTER (WHERE error IS NOT NULL AND error <> '') AS error_count,
      AVG(duration) AS avg_duration,
      AVG(file_size) AS avg_file_size,
      COUNT(*) FILTER (WHERE mode = 0) AS mode_transcribe,
      COUNT(*) FILTER (WHERE mode = 1) AS mode_translate,
      COUNT(*) FILTER (WHERE media_type = 'audio') AS media_audio,
      COUNT(*) FILTER (WHERE media_type = 'voice') AS media_voice,
      COUNT(*) FILTER (WHERE media_type = 'video') AS media_video,
      COUNT(*) FILTER (WHERE media_type = 'video_note') AS media_video_note,
      COUNT(*) FILTER (WHERE is_forward = TRUE) AS forwarded_count,
      AVG(LENGTH(response)) AS avg_response_length,
      AVG(total_request_time) AS avg_total_request_time
    FROM media_requests
    WHERE chat_id = $1
  `,
    [chatId],
  );
  const stats = reqRes.rows[0];

  let avgPerDay = 'n/a';
  if (stats.first_usage && stats.last_usage && stats.usage_count > 0) {
    const first = new Date(stats.first_usage);
    const last = new Date(stats.last_usage);
    const days = Math.max(
      1,
      Math.ceil((last.getTime() - first.getTime()) / (1000 * 60 * 60 * 24)) + 1,
    );
    avgPerDay = (stats.usage_count / days).toFixed(2);
  }

  const chatName = await getChatName(ctx, chatId);

  const lines = [
    '📊 <b>Statistics for chat:</b> ' +
      (chatName
        ? `<code>${escapeHTML(chatName)}</code> (<code>${chatId}</code>)`
        : `<code>${chatId}</code>`),
    '',
    `<b>Total requests:</b> ${stats.usage_count}`,
    `<b>Unique users:</b> ${stats.users_count}`,
    `<b>First usage:</b> ${stats.first_usage ? formatDateTime(stats.first_usage) : 'never'}`,
    `<b>Last usage:</b> ${stats.last_usage ? formatDateTime(stats.last_usage) : 'never'}`,
    `<b>Average requests per day:</b> ${avgPerDay}`,
    `<b>Errors:</b> ${stats.error_count}`,
    `<b>Forwarded messages:</b> ${stats.forwarded_count}`,
    '',
    `<b>By mode:</b>`,
    `- Transcribe: ${stats.mode_transcribe}`,
    `- Translate: ${stats.mode_translate}`,
    '',
    `<b>By media type:</b>`,
    `- Audio: ${stats.media_audio}`,
    `- Voice: ${stats.media_voice}`,
    `- Video: ${stats.media_video}`,
    `- Video Note: ${stats.media_video_note}`,
    '',
    `<b>Average duration:</b> ${stats.avg_duration ? Number(stats.avg_duration).toFixed(2) + ' sec' : 'n/a'}`,
    `<b>Average file size:</b> ${stats.avg_file_size ? formatBytesToString(Number(stats.avg_file_size)) : 'n/a'}`,
    `<b>Average response length:</b> ${stats.avg_response_length ? Number(stats.avg_response_length).toFixed(1) + ' chars' : 'n/a'}`,
    `<b>Average request time:</b> ${stats.avg_total_request_time ? Number(stats.avg_total_request_time).toFixed(1) + ' ms' : 'n/a'}`,
    '',
    `<b>Chat settings:</b>`,
    `- Language: ${chatInfo.language ? LANGUAGE_CODES[chatInfo.language] : 'not set'}`,
    `- Format style: ${chatInfo.format_style}`,
    `- Default mode: ${chatInfo.default_mode === null ? 'not set' : chatInfo.default_mode === 0 ? 'Transcribe' : 'Translate'}`,
    `- Banned: ${chatInfo.banned_timestamp ? `<b>yes</b>, ${formatDateTime(chatInfo.banned_timestamp)}` : 'no'}`,
    `- Created: ${formatDateTime(chatInfo.created_at)}`,
    `- Last edited: ${formatDateTime(chatInfo.edited_at)}`,
  ];

  await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
}
