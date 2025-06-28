import {
  BOT_TOKEN,
  MAX_DURATION,
  MAX_FILE_SIZE,
  MAX_FILE_SIZE_FORMATTED,
} from '../config';
import {
  logRequest,
  logFileWithTranscription,
  sendMediaToAdmins,
  sendMessageToAdmins,
} from './logging';
import { checkRateLimits } from './check_rate_limits';
import { retryOnException } from './retry_on_exception';
import { processFile } from './transcribe_file';
import { sendText } from './send_text';
import { getChatInfo } from './get_chat_info';
import { getClient, redis } from '../core';
import { ChatState, MediaType, Mode } from '../enums';
import {
  SPEECH_NOT_DETECTED_PHRASES,
  SUPPORTED_FILE_EXTENSIONS,
} from '../constants';

import type { Client } from 'pg';
import type { Context } from 'telegraf';
import type { Message } from 'telegraf/typings/core/types/typegram';
import type {
  MediaContent,
  MediaContentToSilentLog,
  RequestInfo,
} from '../types';

async function logRequestEarlyExit(
  ctx: Context,
  requestInfo: RequestInfo,
  client: Client,
  startTime: number,
  isReply: boolean,
  media: MediaContent | MediaContentToSilentLog,
  mediaType: MediaType,
): Promise<void> {
  try {
    if (requestInfo.error) {
      await sendMessageToAdmins(ctx, requestInfo.error);
    }

    const loggedMessage = await sendMediaToAdmins(
      ctx,
      isReply,
      media,
      mediaType,
    );

    requestInfo.logged_message_id = loggedMessage.message_id;
  } catch (e) {
    if (requestInfo.error) {
      requestInfo.error += ` Can not send media to admins: ${e}`;
    } else {
      requestInfo.error = `Can not send media to admins: ${e}`;
    }
  } finally {
    requestInfo.total_request_time = Date.now() - startTime;
    await logRequest(client, requestInfo);
  }
}

function getForwardOrigin(message: Message): number | null {
  if ('forward_origin' in message && message.forward_origin) {
    const origin = message.forward_origin;

    if (origin.type === 'user') {
      return origin.sender_user.id;
    }

    if (origin.type === 'chat') {
      return origin.sender_chat.id;
    }

    if (origin.type === 'channel') {
      return origin.chat.id;
    }

    return 0;
  }

  return null;
}

function setForwardOrigin(message: Message, requestInfo: RequestInfo): void {
  const origin = getForwardOrigin(message);

  if (origin === null) {
    return;
  }

  requestInfo.is_forward = true;

  if (origin) {
    requestInfo.forward_chat_id = origin;
  }
}

export async function logNonTranscribableMediaRequest(
  ctx: Context,
  media: MediaContentToSilentLog,
  mediaType: MediaType,
  isReply: boolean = false,
): Promise<void> {
  const startTime = Date.now();

  const chatId = ctx.chat!.id;
  const client = await getClient();
  const chatInfo = await getChatInfo(client, chatId);

  if (!chatInfo.logging_enabled) {
    return;
  }

  const fileId = media.file_id;
  const fileSize = media.file_size!;

  const filename =
    'file_name' in media && media.file_name ? media.file_name : '';
  const fileExtension = filename.split('.').pop()!.toLowerCase() || null;

  const message = isReply
    ? ((ctx.message as any).reply_to_message as Message)
    : ctx.message!;
  const userId = message.from!.id;

  const requestInfo: RequestInfo = {
    chat_id: chatId,
    mode: Mode.IGNORE,
    forward_chat_id: null,
    is_forward: false,
    file_id: fileId,
    file_size: fileSize,
    duration: null,
    media_type: mediaType,
    message_id: message.message_id,
    user_id: userId,
    file_type: fileExtension,
    language: chatInfo.language,
    response: null,
    error: null,
    logged_message_id: null,
    api_request_time: null,
    media_download_time: null,
    total_request_time: 0,
  };

  setForwardOrigin(message, requestInfo);

  try {
    await sendMessageToAdmins(ctx, 'Logged media');
  } catch {}

  await logRequestEarlyExit(
    ctx,
    requestInfo,
    client,
    startTime,
    isReply,
    media,
    mediaType,
  );
}

export async function handleMediaRequest(
  ctx: Context,
  media: MediaContent,
  mediaType: MediaType,
  isReply: boolean = false,
  mode?: Mode,
): Promise<void> {
  const startTime = Date.now();

  const chatId = ctx.chat!.id;
  const client = await getClient();
  const chatInfo = await getChatInfo(client, chatId);

  let filename: string = '';
  if ('file_name' in media && media.file_name) {
    filename = media.file_name;
  }

  const fileId = media.file_id;
  const fileSize = media.file_size!;
  const duration = media.duration;

  const message = isReply
    ? ((ctx.message as any).reply_to_message as Message)
    : ctx.message!;
  const userId = message.from!.id;

  let usedMode: Mode;
  if (typeof mode === 'undefined') {
    usedMode = chatInfo.default_mode ?? Mode.IGNORE;
  } else {
    usedMode = mode;
  }

  const requestInfo: RequestInfo = {
    chat_id: chatId,
    mode: usedMode,
    forward_chat_id: null,
    is_forward: false,
    file_id: fileId,
    file_size: fileSize,
    duration,
    media_type: mediaType,
    message_id: message.message_id,
    user_id: userId,
    file_type: filename.split('.').pop()!.toLowerCase() || null,
    language: usedMode === Mode.TRANSLATE ? 'en' : chatInfo.language,
    response: null,
    error: null,
    logged_message_id: null,
    api_request_time: null,
    media_download_time: null,
    total_request_time: 0,
  };

  setForwardOrigin(message, requestInfo);

  if (!(await checkRateLimits(ctx))) {
    if (chatInfo.logging_enabled) {
      requestInfo.mode = Mode.IGNORE;
      await logRequestEarlyExit(
        ctx,
        requestInfo,
        client,
        startTime,
        isReply,
        media,
        mediaType,
      );
    }

    return;
  }

  if (chatInfo.banned_timestamp) {
    await redis.set(`chat:${chatId}`, ChatState.BANNED, {
      ex: 24 * 60 * 60,
    });

    if (chatInfo.logging_enabled) {
      requestInfo.mode = Mode.IGNORE;
      await logRequestEarlyExit(
        ctx,
        requestInfo,
        client,
        startTime,
        isReply,
        media,
        mediaType,
      );
    }

    return;
  }

  if (chatInfo.default_mode === Mode.IGNORE && typeof mode === 'undefined') {
    await redis.set(`chat:${chatId}`, ChatState.DISABLED, {
      ex: 24 * 60 * 60,
    });

    if (chatInfo.logging_enabled) {
      await logRequestEarlyExit(
        ctx,
        requestInfo,
        client,
        startTime,
        isReply,
        media,
        mediaType,
      );
    }

    return;
  }

  const errors: string[] = [];
  if (MAX_FILE_SIZE && fileSize && fileSize > MAX_FILE_SIZE) {
    errors.push(`File is too big. Limit: ${MAX_FILE_SIZE_FORMATTED}!`);
  }

  let downloadUrl: string | null = null;
  if (!errors.length) {
    try {
      const file = await ctx.telegram.getFile(fileId);
      const filePath = file.file_path;
      const fileSize = file.file_size;

      downloadUrl = filePath
        ? `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`
        : null;

      filename =
        'file_name' in media && media.file_name
          ? media.file_name
          : filePath?.split(/[\\/]/).pop() || '';

      if (MAX_FILE_SIZE && fileSize && fileSize > MAX_FILE_SIZE) {
        errors.push(`File is too big. Limit: ${MAX_FILE_SIZE_FORMATTED}!`);
      }
    } catch {}
  }

  const fileExtension = filename.split('.').pop()!.toLowerCase() || null;
  requestInfo.file_type = fileExtension;

  if (MAX_DURATION && duration && duration > MAX_DURATION) {
    errors.push(`Audio too long. Limit: ${MAX_DURATION} seconds!`);
  }

  if (!fileExtension || !SUPPORTED_FILE_EXTENSIONS.has(fileExtension)) {
    errors.push(`Media format not supported: ${fileExtension}!`);
  }

  if (!downloadUrl && !errors.length) {
    errors.push('Can not download the requested file!');
  }

  if (errors.length) {
    const errorMessage = errors.join(' ');
    requestInfo.error = errorMessage;

    try {
      await ctx.reply(errorMessage);
    } catch (e) {
      requestInfo.error += ` Can not send error reply: ${e}`;
    }

    if (chatInfo.logging_enabled) {
      await logRequestEarlyExit(
        ctx,
        requestInfo,
        client,
        startTime,
        isReply,
        media,
        mediaType,
      );
    }

    return;
  }

  let isTranscriptionSent = false;
  let blob: Blob | undefined = undefined;

  try {
    const mediaDownloadStart = Date.now();
    const fileResponse = await retryOnException(() => fetch(downloadUrl!));
    if (!fileResponse.ok) {
      throw new Error('Failed to fetch file from Telegram!');
    }

    blob = await fileResponse.blob();
    requestInfo.media_download_time = Date.now() - mediaDownloadStart;

    if (filename.endsWith('.oga')) {
      filename = filename.replace(/a$/, 'g');
    }

    const mediaFile = new File([blob], filename);

    const apiStart = Date.now();
    const textResponse = await processFile(
      mediaFile,
      usedMode,
      chatInfo.language,
    );
    requestInfo.api_request_time = Date.now() - apiStart;

    if (
      !textResponse ||
      (textResponse.length < 30 &&
        SPEECH_NOT_DETECTED_PHRASES.has(textResponse.replace(/[.,:!?]/g, '')))
    ) {
      await ctx.reply('Speech not detected');
      isTranscriptionSent = true;

      if (chatInfo.logging_enabled) {
        await sendMessageToAdmins(ctx, 'Speech not detected');
        const loggedMessage = await sendMediaToAdmins(
          ctx,
          isReply,
          media,
          mediaType,
          blob,
          filename,
        );
        requestInfo.logged_message_id = loggedMessage.message_id;
        requestInfo.total_request_time = Date.now() - startTime;
      }

      return;
    }

    requestInfo.response = textResponse;
    const messageIds = await sendText(ctx, textResponse, chatInfo.format_style);
    isTranscriptionSent = true;

    if (chatInfo.logging_enabled) {
      if (isReply) {
        messageIds[0] = (ctx.message as any).reply_to_message.message_id;
      }

      const loggedMessageIds = await logFileWithTranscription(ctx, messageIds);
      requestInfo.logged_message_id = loggedMessageIds[0].message_id;
    }
  } catch (error) {
    try {
      const errorMessage = String(error);
      const formatAdminMessage = (message: string) =>
        `Error processing media: ${errorMessage}. ${message}`;

      if (isTranscriptionSent) {
        if (requestInfo.response) {
          requestInfo.error = errorMessage;
          await sendMessageToAdmins(
            ctx,
            formatAdminMessage(
              `Transcription was sent successfully: ${requestInfo.response}`,
            ),
            true,
          );
        } else {
          requestInfo.error = `${errorMessage}. Speech not detected!`;
          await sendMessageToAdmins(
            ctx,
            formatAdminMessage('Speech not detected!'),
            true,
          );
        }
      } else {
        requestInfo.error = errorMessage;
        await ctx.reply('Error processing media');
        await sendMessageToAdmins(ctx, formatAdminMessage(''), true);
      }
    } catch (e) {
      requestInfo.error += `. Can not send message with error: ${e}`;
    }

    try {
      const loggedMessage = await sendMediaToAdmins(
        ctx,
        isReply,
        media,
        mediaType,
        blob,
        filename,
      );
      requestInfo.logged_message_id = loggedMessage.message_id;
    } catch (e) {
      requestInfo.error += `. Can not to send media to admins: ${e}`;
    }
  } finally {
    if (chatInfo.logging_enabled) {
      requestInfo.total_request_time = Date.now() - startTime;
      await logRequest(client, requestInfo);
    }
  }
}
