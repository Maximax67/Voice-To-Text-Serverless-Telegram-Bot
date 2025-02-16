import {
  MAX_DURATION,
  MAX_FILE_SIZE,
  MAX_FILE_SIZE_FORMATTED,
} from '../config';
import { processVoiceMessage } from './process_voice_message';
import type { Context } from 'telegraf';

export async function handleVoiceMessage(ctx: Context, voice: any) {
  if (MAX_FILE_SIZE && voice.file_size > MAX_FILE_SIZE) {
    await ctx.reply(`Audio file too large. Limit: ${MAX_FILE_SIZE_FORMATTED}`);
    return;
  }

  if (MAX_DURATION && voice.duration > MAX_DURATION) {
    await ctx.reply(`Audio too long. Limit: ${MAX_DURATION} seconds`);
    return;
  }

  try {
    const fileLink = await ctx.telegram.getFileLink(voice.file_id);
    const filename = voice.filename ?? fileLink.pathname.split(/[\\/]/).pop();

    await processVoiceMessage(fileLink.href, filename, ctx);
  } catch (error) {
    console.error(error);
    await ctx.reply('Error processing audio');
  }
}
