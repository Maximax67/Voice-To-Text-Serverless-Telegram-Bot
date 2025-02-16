import {
  MAX_DURATION,
  MAX_FILE_SIZE,
  MAX_FILE_SIZE_FORMATTED,
} from '../config';
import { checkRateLimits } from './check_rate_limits';
import { checkFileExtension } from './check_file_extension';
import { transcribeFile } from './transcribe_file';
import { sendTranscription } from './send_transcription';

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
) {
  if (!(await checkRateLimits(ctx))) return;

  const fileSize = media.file_size;
  if (MAX_FILE_SIZE && fileSize && fileSize > MAX_FILE_SIZE) {
    await ctx.reply(`Audio file too large. Limit: ${MAX_FILE_SIZE_FORMATTED}`);
    return;
  }

  const duration = media.duration;
  if (MAX_DURATION && duration && duration > MAX_DURATION) {
    await ctx.reply(`Audio too long. Limit: ${MAX_DURATION} seconds`);
    return;
  }

  try {
    const fileLink = await ctx.telegram.getFileLink(media.file_id);
    let filename =
      'file_name' in media && media.file_name
        ? media.file_name
        : fileLink.pathname.split(/[\\/]/).pop()!;

    if (!checkFileExtension(filename)) {
      await ctx.reply('Media format not supported');
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
      return;
    }

    await sendTranscription(transcription, ctx);
  } catch (error) {
    console.error(error);
    await ctx.reply('Error processing media');
  }
}
