import { FormatStyle } from '../enums';
import { MAX_TELEGRAM_MESSAGE_LENGTH } from '../constants';
import type { Context } from 'telegraf';

function splitText(text: string): string[] {
  const maxLen = MAX_TELEGRAM_MESSAGE_LENGTH;
  const result: string[] = [];
  let i = 0;
  while (i < text.length) {
    let end = i + maxLen;

    // If end is in the middle of a surrogate pair, move back by 1
    if (
      end < text.length &&
      // high surrogate (0xD800-0xDBFF)
      text.charCodeAt(end - 1) >= 0xd800 &&
      text.charCodeAt(end - 1) <= 0xdbff
    ) {
      end--;
    }
    result.push(text.slice(i, end));
    i = end;
  }
  return result;
}

async function sendTextParts(
  ctx: Context,
  parts: string[],
  entityType: string | null,
  threadId: number | undefined,
): Promise<number[]> {
  const messageIds: number[] = new Array(parts.length);
  messageIds[0] = ctx.message!.message_id;

  let i = 0;
  for (const part of parts) {
    const options: any = {
      reply_parameters: { message_id: messageIds[i] },
      message_thread_id: threadId,
    };

    if (entityType) {
      options.entities = [
        {
          type: entityType as any,
          offset: 0,
          length: part.length,
        },
      ];
    }

    const message = await ctx.telegram.sendMessage(
      ctx.message!.chat.id,
      part,
      options,
    );

    messageIds[++i] = message.message_id;
  }

  return messageIds;
}

export async function sendText(
  ctx: Context,
  text: string,
  formatStyle: FormatStyle = FormatStyle.PLAIN,
): Promise<number[]> {
  const contextMessageId = ctx.message!.message_id;
  const threadId = ctx.message!.message_thread_id;

  if (formatStyle === FormatStyle.FILE) {
    const buffer = Buffer.from(text, 'utf-8');
    const textFile = {
      source: buffer,
      filename: `${ctx.message!.from.id}-${contextMessageId}.txt`,
    };

    const message = await ctx.replyWithDocument(textFile);
    return [contextMessageId, message.message_id];
  }

  const entityType =
    formatStyle === FormatStyle.PLAIN
      ? null
      : formatStyle === FormatStyle.QUOTE
        ? 'blockquote'
        : 'expandable_blockquote';

  if (text.length <= MAX_TELEGRAM_MESSAGE_LENGTH) {
    const options: any = {};
    if (entityType) {
      options.entities = [
        {
          type: entityType as any,
          offset: 0,
          length: text.length,
        },
      ];
    }

    const message = await ctx.reply(text, options);
    return [contextMessageId, message.message_id];
  }

  const parts = splitText(text);
  return await sendTextParts(ctx, parts, entityType, threadId);
}
