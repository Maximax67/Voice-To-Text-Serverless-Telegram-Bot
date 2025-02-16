import { MAX_TELEGRAM_MESSAGE_LENGTH } from '../constants';
import type { Context } from 'telegraf';

export async function sendTranscription(transcription: string, ctx: Context) {
  if (transcription.length > MAX_TELEGRAM_MESSAGE_LENGTH) {
    const parts = transcription.match(
      new RegExp(`.{1,${MAX_TELEGRAM_MESSAGE_LENGTH}}`, 'g'),
    );
    if (parts) {
      for (const part of parts) {
        await ctx.reply(part);
      }
    }
  } else {
    await ctx.reply(transcription);
  }
}
