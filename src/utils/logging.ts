import { Readable } from 'stream';

import { ADMIN_CHAT_ID, ADMIN_MESSAGE_THREAD_ID, BOT_TOKEN } from '../config';
import { getClient } from '../core';
import { isGlobalAdmin } from './is_admin';
import { getChatIdFromCommand } from './get_chat_id_from_command';
import { getChatName } from './get_chat_info';
import { escapeCSV, escapeHTML } from './escape';
import { MediaType } from '../enums';

import type { Client, QueryResult } from 'pg';
import type { Context } from 'telegraf';
import type {
  ChatFromGetChat,
  Message,
  MessageId,
  User,
} from 'telegraf/typings/core/types/typegram';
import type {
  ChatInfo,
  RequestInfo,
  MediaContent,
  MediaContentToSilentLog,
  InputFileByBuffer,
} from '../types';
import { retryOnException } from './retry_on_exception';

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
  media?: MediaContent | MediaContentToSilentLog,
  mediaType?: MediaType,
  downloadedContent?: Blob,
  filename?: string,
): Promise<Message> {
  const message = ctx.message!;
  const messageId = isReply
    ? (message as any).reply_to_message.message_id
    : message.message_id;

  try {
    return await ctx.telegram.forwardMessage(
      ADMIN_CHAT_ID,
      message.chat.id,
      messageId,
      {
        message_thread_id: ADMIN_MESSAGE_THREAD_ID,
      },
    );
  } catch (e) {
    if (typeof media === 'undefined' || typeof mediaType === 'undefined') {
      throw e;
    }

    const mediaSendFunctions: Record<
      MediaType,
      (chatId: number | string, content: any, extra: any) => Promise<any>
    > = {
      [MediaType.VOICE]: ctx.telegram.sendVoice.bind(ctx.telegram),
      [MediaType.VIDEO_NOTE]: ctx.telegram.sendVideoNote.bind(ctx.telegram),
      [MediaType.AUDIO]: ctx.telegram.sendAudio.bind(ctx.telegram),
      [MediaType.VIDEO]: ctx.telegram.sendVideo.bind(ctx.telegram),
      [MediaType.DOCUMENT]: ctx.telegram.sendDocument.bind(ctx.telegram),
      [MediaType.PHOTO]: ctx.telegram.sendPhoto.bind(ctx.telegram),
    };

    const sendFunction = mediaSendFunctions[mediaType];

    try {
      return await sendFunction(ADMIN_CHAT_ID, media.file_id, {
        message_thread_id: ADMIN_MESSAGE_THREAD_ID,
      });
    } catch {}

    let fileToSend: InputFileByBuffer;
    if (typeof downloadedContent !== 'undefined') {
      const arrayBuffer = await downloadedContent.arrayBuffer();
      const source = Buffer.from(arrayBuffer);

      fileToSend = { source, filename };
    } else {
      const fileId = media.file_id;
      const file = await ctx.telegram.getFile(fileId);
      const filePath = file.file_path;

      if (!filePath) {
        throw e;
      }

      const downloadUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;
      const filename =
        'file_name' in media && media.file_name
          ? media.file_name
          : filePath?.split(/[\\/]/).pop();

      const fileResponse = await retryOnException(() => fetch(downloadUrl!));
      if (!fileResponse.ok) {
        throw new Error('Failed to fetch file from Telegram!');
      }

      const arrayBuffer = await fileResponse.arrayBuffer();
      const source = Buffer.from(arrayBuffer);

      fileToSend = { source, filename };
    }

    return sendFunction(ADMIN_CHAT_ID, fileToSend, {
      message_thread_id: ADMIN_MESSAGE_THREAD_ID,
    });
  }
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

export async function getLogs(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId || !isGlobalAdmin(userId)) return;

  const chatId = getChatIdFromCommand(ctx);
  if (!chatId) {
    if ((ctx.message as Message.TextMessage).text.indexOf(' ') !== -1) {
      await ctx.reply(`Usage: /logs {chatId}`);
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
      caption: `Logs for ${captionPart}`,
      parse_mode: 'HTML',
    },
  );
}

export async function deleteLogs(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId || !isGlobalAdmin(userId)) return;

  const chatId = getChatIdFromCommand(ctx);
  if (!chatId) {
    await ctx.reply('Usage: /delete_logs {chatId}');
    return;
  }

  const client = await getClient();
  const chatRes = await client.query<ChatInfo>(
    'SELECT chat_id FROM chats WHERE chat_id = $1;',
    [chatId],
  );

  if (chatRes.rowCount === 0) {
    await ctx.reply('Chat not found.');
    return;
  }

  const delRes = await client.query(
    'DELETE FROM media_requests WHERE chat_id = $1;',
    [chatId],
  );

  if (delRes.rowCount === 0) {
    await ctx.reply(`No logs found for chat <code>${chatId}</code>.`, {
      parse_mode: 'HTML',
    });
  } else {
    const plural = delRes.rowCount === 1 ? '' : 's';
    await ctx.reply(
      `Deleted ${delRes.rowCount} log${plural} for chat <code>${chatId}</code>.`,
      { parse_mode: 'HTML' },
    );
  }
}

export async function deleteAllLogs(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId || !isGlobalAdmin(userId)) return;

  const client = await getClient();
  const delRes = await client.query('DELETE FROM media_requests;');

  if (delRes.rowCount === 0) {
    await ctx.reply('No logs found for any chats.');
  } else {
    const plural = delRes.rowCount === 1 ? '' : 's';
    await ctx.reply(`Deleted ${delRes.rowCount} log${plural} for all chats!`);
  }
}

export async function searchLogs(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId || !isGlobalAdmin(userId)) return;

  const text = (ctx.message as Message.TextMessage).text;
  const parts = text.split(' ');
  if (parts.length < 2) {
    await ctx.reply(`Usage: /search {phrase or /regex/}`);
    return;
  }
  const phrase = parts.slice(1).join(' ').trim();
  if (!phrase) {
    await ctx.reply('Please provide a phrase or regex to search for.');
    return;
  }

  const client = await getClient();
  const fields = [
    'CAST(user_id AS TEXT)',
    'CAST(forward_chat_id AS TEXT)',
    'CAST(chat_id AS TEXT)',
    'file_id',
    'response',
    'error',
  ];

  let logs: RequestInfo[] = [];
  let isRegex = false;
  let searchValue = phrase;
  let regexFlags = '';
  let query: string;
  let params: any[];

  const regexMatch = phrase.match(/^\/(.+)\/([a-z]*)$/i);
  if (regexMatch) {
    isRegex = true;
    searchValue = regexMatch[1];
    regexFlags = regexMatch[2] || '';
    const pgOperator = regexFlags.includes('i') ? '~*' : '~';
    query = `
      SELECT * FROM media_requests
      WHERE ${fields.map((f) => `${f} ${pgOperator} $1`).join(' OR ')}
      ORDER BY id;
    `;
    params = [searchValue];
  } else {
    query = `
      SELECT * FROM media_requests
      WHERE ${fields.map((f) => `${f} ILIKE $1`).join(' OR ')}
      ORDER BY id;
    `;
    params = [`%${searchValue}%`];
  }

  try {
    const reqRes = await client.query<RequestInfo>(query, params);
    logs = reqRes.rows;
  } catch (err: any) {
    if (
      isRegex &&
      (err.code === '2201B' ||
        (err.message &&
          err.message.toLowerCase().includes('regular expression')))
    ) {
      await ctx.reply('Invalid regular expression for database search.');
      return;
    }
    throw err;
  }

  if (!logs.length) {
    await ctx.reply('No logs found for this search!');
    return;
  }

  let occurrences = 0;
  const chatIds = new Set<number>();
  let regex: RegExp;
  try {
    const jsRegexFlags = isRegex
      ? regexFlags.includes('g')
        ? regexFlags
        : regexFlags + 'g'
      : 'gi';
    regex = isRegex
      ? new RegExp(searchValue, jsRegexFlags)
      : new RegExp(searchValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  } catch (err: any) {
    if (isRegex) {
      await ctx.reply('Invalid regular expression for JS search.');
      return;
    }
    throw err;
  }

  for (const row of logs) {
    chatIds.add(row.chat_id);
    for (const key of Object.keys(row)) {
      const val = (row as any)[key];
      if (typeof val === 'string' || typeof val === 'number') {
        const str = String(val);
        let match;
        if (isRegex) regex.lastIndex = 0;
        while ((match = regex.exec(str)) !== null) {
          occurrences++;
          if (isRegex && match.index === regex.lastIndex) regex.lastIndex++;
        }
      }
    }
  }

  const now = new Date();
  const dateString = now.toLocaleDateString('en-GB').replace(/\//g, '-');
  const timeString = now.toTimeString().split(' ')[0].replace(/:/g, '-');
  const baseFilename = `searchlog_${phrase.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_')}_${dateString}_${timeString}`;

  const caption = `Found <b>${occurrences}</b> occurrence${occurrences === 1 ? '' : 's'} in <b>${chatIds.size}</b> chat${chatIds.size === 1 ? '' : 's'}.\nLog records in file: <b>${logs.length}</b>.`;

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
      caption,
      parse_mode: 'HTML',
    },
  );
}

export async function getFileById(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId || !isGlobalAdmin(userId)) return;

  const text = (ctx.message as Message.TextMessage).text;
  const parts = text.trim().split(' ');

  if (parts.length < 2 || isNaN(Number(parts[1]))) {
    await ctx.reply('Usage: /file {id}');
    return;
  }

  const id = Number(parts[1]);
  const client = await getClient();
  const res = await client.query<RequestInfo>(
    'SELECT * FROM media_requests WHERE id = $1;',
    [id],
  );

  if (res.rowCount === 0) {
    await ctx.reply('Log record not found.');
    return;
  }

  const log = res.rows[0];

  try {
    await ctx.telegram.forwardMessage(
      ctx.chat!.id,
      log.chat_id,
      log.message_id,
    );
    return;
  } catch (e) {
    // Could not forward original message, try admin chat
  }

  // Try to forward from admin chat using logged_message_id
  if (log.logged_message_id) {
    try {
      await ctx.telegram.forwardMessage(
        ctx.chat!.id,
        ADMIN_CHAT_ID,
        log.logged_message_id,
      );
      return;
    } catch (e) {
      // Could not forward from admin chat, try file
    }
  }

  // Try to send file directly
  if (log.file_id && log.media_type) {
    try {
      switch (log.media_type) {
        case MediaType.AUDIO:
          await ctx.replyWithAudio(log.file_id);
          return;
        case MediaType.VOICE:
          await ctx.replyWithVoice(log.file_id);
          return;
        case MediaType.VIDEO:
          await ctx.replyWithVideo(log.file_id);
          return;
        case MediaType.VIDEO_NOTE:
          await ctx.replyWithVideoNote(log.file_id);
          return;
        default:
          await ctx.replyWithDocument(log.file_id);
          return;
      }
    } catch (e) {
      // Could not send file
    }
  }

  await ctx.reply(
    'Unable to retrieve or forward the file for this log record.',
  );
}

async function getUserChatListWithStatuses(
  ctx: Context,
  userId: number,
): Promise<{
  chatStatuses: { chatId: number; status: string }[];
  userInfo: User | null;
}> {
  const client = await getClient();
  const res = await client.query(
    'SELECT DISTINCT chat_id FROM media_requests WHERE user_id = $1 AND chat_id != $1 ORDER BY chat_id;',
    [userId],
  );

  if (res.rowCount === 0) {
    return { chatStatuses: [], userInfo: null };
  }

  const chatIds: number[] = res.rows.map((row) => row.chat_id);

  let userInfo: User | null = null;
  const chatStatuses: { chatId: number; status: string }[] = [];

  for (const chatId of chatIds) {
    const userChatInfo = await ctx.telegram.getChatMember(chatId, userId);
    const status = userChatInfo.status;

    if (!userInfo) {
      userInfo = userChatInfo.user;
    }

    chatStatuses.push({
      chatId,
      status,
    });
  }

  return {
    chatStatuses,
    userInfo,
  };
}

export async function who(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId || !isGlobalAdmin(userId)) return;

  const chatId = getChatIdFromCommand(ctx);
  if (!chatId) {
    await ctx.reply('Usage: /who {user_id|chat_id}');
    return;
  }

  let chatInfo: ChatFromGetChat | null = null;
  try {
    chatInfo = await ctx.telegram.getChat(chatId);
  } catch (e) {
    // Not found as chat/user, will try DB fallback
  }

  if (chatInfo) {
    let msg = '';
    if (chatInfo.type === 'private') {
      const label =
        chatInfo.username && chatInfo.username.endsWith('bot') ? `Bot` : `User`;

      msg += `<b>${label}</b>\n`;
      msg += `<b>ID:</b> <code>${chatInfo.id}</code>\n`;
      if (chatInfo.first_name)
        msg += `<b>First name:</b> <code>${escapeHTML(chatInfo.first_name)}</code>\n`;
      if (chatInfo.last_name)
        msg += `<b>Last name:</b> <code>${escapeHTML(chatInfo.last_name)}</code>\n`;
      if (chatInfo.username)
        msg += `<b>Username:</b> @${escapeHTML(chatInfo.username)}\n`;

      const chatList = await getUserChatListWithStatuses(ctx, chatInfo.id);
      if (chatList.chatStatuses.length > 0) {
        msg += `\n<b>Used bot in chats:</b>\n`;
        msg += (
          await Promise.all(
            chatList.chatStatuses.map(async (cs) => {
              const chatName = await getChatName(ctx, cs.chatId);
              return `<code>${cs.chatId}</code> — ${cs.status} — ${
                chatName ? `<code>${escapeHTML(chatName)}</code>` : ''
              }`;
            }),
          )
        ).join('\n');
      }

      try {
        const photos = await ctx.telegram.getUserProfilePhotos(
          chatInfo.id,
          0,
          1,
        );
        if (photos.total_count > 0 && photos.photos[0][0]) {
          await ctx.replyWithPhoto(photos.photos[0][0].file_id, {
            caption: msg,
            parse_mode: 'HTML',
          });
          return;
        }
      } catch (e) {
        // ignore photo error
      }
      await ctx.reply(msg, { parse_mode: 'HTML' });
      return;
    } else {
      msg += `<b>${chatInfo.type.charAt(0).toUpperCase() + chatInfo.type.slice(1)}</b>\n`;
      msg += `<b>ID:</b> <code>${chatInfo.id}</code>\n`;
      if (chatInfo.title)
        msg += `<b>Title:</b> <code>${escapeHTML(chatInfo.title)}</code>\n`;
      if (
        (chatInfo.type === 'channel' || chatInfo.type === 'supergroup') &&
        chatInfo.username
      )
        msg += `<b>Username:</b> @${escapeHTML(chatInfo.username)}\n`;
      if (chatInfo.description)
        msg += `<b>Description:</b> <code>${escapeHTML(chatInfo.description)}</code>\n`;

      if (chatInfo.photo && chatInfo.photo.small_file_id) {
        await ctx.replyWithPhoto(chatInfo.photo.small_file_id, {
          caption: msg,
          parse_mode: 'HTML',
        });
        return;
      }

      await ctx.reply(msg, { parse_mode: 'HTML' });

      return;
    }
  }

  const chatList = await getUserChatListWithStatuses(ctx, userId);
  const userInfo = chatList.userInfo;

  if (chatList.chatStatuses.length > 0 && userInfo) {
    const label = userInfo.is_bot ? `Bot` : `User`;
    let msg = `<b>${label}</b>\n`;

    msg += `<b>ID:</b> <code>${userInfo.id}</code>\n`;
    if (userInfo.first_name)
      msg += `<b>First name:</b> <code>${escapeHTML(userInfo.first_name)}</code>\n`;
    if (userInfo.last_name)
      msg += `<b>Last name:</b> <code>${escapeHTML(userInfo.last_name)}</code>\n`;
    if (userInfo.username)
      msg += `<b>Username:</b> @${escapeHTML(userInfo.username)}\n`;

    msg += `\n<b>Used bot in chats:</b>\n`;
    msg += (
      await Promise.all(
        chatList.chatStatuses.map(async (cs) => {
          const chatName = await getChatName(ctx, cs.chatId);
          return `<code>${cs.chatId}</code> — ${cs.status} — ${
            chatName ? `<code>${escapeHTML(chatName)}</code>` : ''
          }`;
        }),
      )
    ).join('\n');

    await ctx.reply(msg, { parse_mode: 'HTML' });
    return;
  }

  await ctx.reply('No information found for this ID.');
}
