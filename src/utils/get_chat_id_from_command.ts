import type { Context } from 'telegraf';
import type { Message } from 'telegraf/typings/core/types/typegram';

export function getChatIdFromCommand(ctx: Context): number | null {
  const message = ctx.message as Message.TextMessage;
  const text = message.text;

  const spaceChar = text.indexOf(' ');
  if (spaceChar === -1) {
    return null;
  }

  const chatIdPart = text.slice(spaceChar + 1).trim();

  return chatIdPart && /^-?\d+$/.test(chatIdPart) ? Number(chatIdPart) : null;
}
