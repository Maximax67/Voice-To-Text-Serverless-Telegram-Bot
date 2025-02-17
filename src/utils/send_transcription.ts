import { MAX_TELEGRAM_MESSAGE_LENGTH } from '../constants';
import type { Context } from 'telegraf';

export async function sendTranscription(
  ctx: Context,
  transcription: string,
): Promise<number[]> {
  const contextMessageId = ctx.message?.message_id!;
  if (transcription.length <= MAX_TELEGRAM_MESSAGE_LENGTH) {
    const message = await ctx.reply(transcription);
    return [contextMessageId, message.message_id];
  }

  const parts = transcription.match(
    new RegExp(`.{1,${MAX_TELEGRAM_MESSAGE_LENGTH}}`, 'g'),
  );

  if (!parts) {
    throw new Error('Error splitting transcription by parts');
  }

  const messageIds = new Array(parts.length);
  messageIds[0] = contextMessageId;

  let i = 0;
  const threadId = ctx.message?.message_thread_id;
  for (const part of parts) {
    const message = await ctx.telegram.sendMessage(
      ctx.message?.chat.id!,
      part,
      {
        reply_parameters: { message_id: messageIds[i] },
        message_thread_id: threadId,
      },
    );

    messageIds[++i] = message.message_id;
  }

  return messageIds;
}
