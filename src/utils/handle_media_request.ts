import {
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
import { processFile } from './transcribe_file';
import { sendText } from './send_text';
import { getChatInfo } from './get_chat_info';
import { getClient, redis } from '../core';
import { ChatState, MediaType, Mode } from '../enums';
import { SUPPORTED_FILE_EXTENSIONS } from '../constants';

import type { Context } from 'telegraf';
import type { Message } from 'telegraf/typings/core/types/typegram';
import type { MediaContent, RequestInfo } from '../types';

export async function handleMediaRequest(
  ctx: Context,
  media: MediaContent,
  mediaType: MediaType,
  isReply: boolean = false,
  mode?: Mode,
) {
  const startTime = Date.now();

  if (!(await checkRateLimits(ctx))) return;

  const chatId = ctx.chat!.id;
  const client = await getClient();
  const chatInfo = await getChatInfo(client, chatId);

  if (chatInfo.banned_timestamp) {
    await redis.set(`chat:${chatId}`, ChatState.BANNED, {
      ex: 24 * 60 * 60,
    });
    return;
  }

  if (typeof mode === 'undefined') {
    if (chatInfo.default_mode === null) {
      await redis.set(`chat:${chatId}`, ChatState.DISABLED, {
        ex: 24 * 60 * 60,
      });
      return;
    }

    mode = chatInfo.default_mode;
  }

  const fileId = media.file_id;
  const fileSize = media.file_size!;
  const duration = media.duration;

  const fileLink = await ctx.telegram.getFileLink(fileId);

  let filename =
    'file_name' in media && media.file_name
      ? media.file_name
      : fileLink.pathname.split(/[\\/]/).pop()!;

  const fileExtension = filename.split('.').pop()!.toLowerCase();

  const message = isReply
    ? ((ctx.message as any).reply_to_message as Message)
    : ctx.message!;
  const userId = message.from!.id;

  const requestInfo: RequestInfo = {
    chat_id: chatId,
    mode,
    forward_chat_id: null,
    is_forward: false,
    file_id: fileId,
    file_size: fileSize,
    duration,
    media_type: mediaType,
    message_id: message.message_id,
    user_id: userId,
    file_type: fileExtension,
    language: mode === Mode.TRANSLATE ? 'en' : chatInfo.language,
    response: null,
    error: null,
    logged_message_id: null,
    api_request_time: null,
    media_download_time: null,
    total_request_time: 0,
  };

  if ('forward_origin' in message && message.forward_origin) {
    requestInfo.is_forward = true;

    const origin = message.forward_origin;
    if (origin.type === 'user') {
      requestInfo.forward_chat_id = origin.sender_user.id;
    } else if (origin.type === 'chat') {
      requestInfo.forward_chat_id = origin.sender_chat.id;
    } else if (origin.type === 'channel') {
      requestInfo.forward_chat_id = origin.chat.id;
    }
  }

  const errors: string[] = [];
  if (MAX_FILE_SIZE && fileSize && fileSize > MAX_FILE_SIZE) {
    errors.push(`File is too large. Limit: ${MAX_FILE_SIZE_FORMATTED}!`);
  }

  if (MAX_DURATION && duration && duration > MAX_DURATION) {
    errors.push(`Audio too long. Limit: ${MAX_DURATION} seconds!`);
  }

  if (!SUPPORTED_FILE_EXTENSIONS.has(fileExtension)) {
    errors.push(`Media format not supported: ${fileExtension}!`);
  }

  if (errors.length) {
    const errorMessage = errors.join(' ');

    await ctx.reply(errorMessage);

    if (chatInfo.logging_enabled) {
      requestInfo.error = errorMessage;

      try {
        await sendMessageToAdmins(ctx, errorMessage);
        const loggedMessage = await sendMediaToAdmins(ctx, isReply);
        requestInfo.logged_message_id = loggedMessage.message_id;
      } finally {
        requestInfo.error += ' Can not send media to admins!';
        requestInfo.total_request_time = Date.now() - startTime;
        await logRequest(client, requestInfo);
      }
    }

    return;
  }

  let isTranscriptionSent = false;

  try {
    const mediaDownloadStart = Date.now();
    const fileResponse = await fetch(fileLink);
    if (!fileResponse.ok) {
      throw new Error('Failed to fetch file from Telegram!');
    }

    const blob = await fileResponse.blob();
    requestInfo.media_download_time = Date.now() - mediaDownloadStart;

    if (filename.endsWith('.oga')) {
      filename = filename.replace(/a$/, 'g');
    }

    const mediaFile = new File([blob], filename);

    const apiStart = Date.now();
    const textResponse = await processFile(mediaFile, mode, chatInfo.language);
    requestInfo.api_request_time = Date.now() - apiStart;

    if (
      !textResponse ||
      textResponse === '.' ||
      textResponse === 'you' ||
      textResponse === 'Thank you.'
    ) {
      await ctx.reply('Speech not detected');
      isTranscriptionSent = true;

      if (chatInfo.logging_enabled) {
        await sendMessageToAdmins(ctx, 'Speech not detected');
        const loggedMessage = await sendMediaToAdmins(ctx, isReply);
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
  } catch (error: unknown) {
    console.error(error);

    const errorMessage = `${error}`;
    const formatAdminMessage = (message: string) =>
      `Error processing media: <code>${errorMessage}</code>. ${message}`;

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

    try {
      const loggedMessage = await sendMediaToAdmins(ctx, isReply);
      requestInfo.logged_message_id = loggedMessage.message_id;
    } catch {
      requestInfo.error += '. Unable to send media to admins!';
    }
  } finally {
    requestInfo.total_request_time = Date.now() - startTime;
    if (chatInfo.logging_enabled) {
      await logRequest(client, requestInfo);
    }
  }
}
