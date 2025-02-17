import {
  MAX_DURATION,
  MAX_FILE_SIZE,
  MAX_FILE_SIZE_FORMATTED,
} from '../config';
import {
  logFileWithTranscription,
  sendMediaToAdmins,
  sendMessageToAdmins,
} from './logging';
import { checkRateLimits } from './check_rate_limits';
import { transcribeFile } from './transcribe_file';
import { sendTranscription } from './send_transcription';
import { SUPPORTED_FILE_EXTENSIONS } from '../constants';

import type { Context } from 'telegraf';
import type {
  Audio,
  Video,
  VideoNote,
  Voice,
} from 'telegraf/typings/core/types/typegram';

export async function handleTranscribeRequest(
  ctx: Context,
  media: Voice | Audio | VideoNote | Video,
  isReply: boolean = false,
) {
  if (!(await checkRateLimits(ctx))) return;

  const fileSize = media.file_size;
  if (MAX_FILE_SIZE && fileSize && fileSize > MAX_FILE_SIZE) {
    await ctx.reply(`Audio file too large. Limit: ${MAX_FILE_SIZE_FORMATTED}`);
    await sendMessageToAdmins(
      ctx,
      `Audio file too large. Limit: ${MAX_FILE_SIZE_FORMATTED}`,
    );
    await sendMediaToAdmins(ctx, isReply);
    return;
  }

  const duration = media.duration;
  if (MAX_DURATION && duration && duration > MAX_DURATION) {
    await ctx.reply(`Audio too long. Limit: ${MAX_DURATION} seconds`);
    await sendMessageToAdmins(
      ctx,
      `Audio too long. Limit: ${MAX_DURATION} seconds`,
    );
    await sendMediaToAdmins(ctx, isReply);
    return;
  }

  try {
    const fileLink = await ctx.telegram.getFileLink(media.file_id);
    let filename =
      'file_name' in media && media.file_name
        ? media.file_name
        : fileLink.pathname.split(/[\\/]/).pop()!;

    const fileExtension = filename.split('.').pop()!.toLowerCase();
    if (!SUPPORTED_FILE_EXTENSIONS.has(fileExtension)) {
      await ctx.reply(`Media format not supported: ${fileExtension}`);
      await sendMessageToAdmins(
        ctx,
        `Media format not supported: ${fileExtension}`,
      );
      await sendMediaToAdmins(ctx, isReply);
      return;
    }

    const response = await fetch(fileLink);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch file from Telegram. File id: ${media.file_id}`,
      );
    }

    const blob = await response.blob();

    if (filename.endsWith('.oga')) {
      filename = filename.replace(/\.oga$/, '.ogg');
    }

    const mediaFile = new File([blob], filename);
    const transcription = await transcribeFile(mediaFile);

    if (!transcription || transcription.trim() === '') {
      await ctx.reply('Speech not detected');
      await sendMessageToAdmins(ctx, 'Speech not detected');
      await sendMediaToAdmins(ctx, isReply);
      return;
    }

    const messageIds = await sendTranscription(ctx, transcription);

    if (isReply) {
      messageIds[0] = (ctx.message as any).reply_to_message.message_id;
    }

    try {
      await logFileWithTranscription(ctx, messageIds);
    } catch (error) {
      console.error(error);
    }
  } catch (error) {
    console.error(error);
    await ctx.reply('Error processing media');
    await sendMessageToAdmins(
      ctx,
      `Error processing media: <code>${error}</code>`,
      true,
    );
    await sendMediaToAdmins(ctx, isReply);
  }
}
