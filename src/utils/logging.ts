import {
  ADMIN_CHAT_ID,
  ADMIN_MESSAGE_THREAD_ID,
  CHATS_WITH_DISABLED_LOGS,
  USERS_WITH_DISABLED_LOGS,
} from '../config';
import type { Context } from 'telegraf';

function formatMessage(
  ctx: Context,
  message: string,
  isError: boolean,
): string {
  const userId = ctx.from?.id;
  const chatId = ctx.message?.chat.id;
  const username = ctx.from?.username;

  const firstName = ctx.from?.first_name;
  const lastName = ctx.from?.last_name;
  const fullName = firstName + (lastName ? ' ' + lastName : '');

  const icon = isError ? '🚨' : 'ℹ️';

  return `${icon} <code>${chatId}</code> | <code>${userId}</code> <code>${fullName}</code>${username ? ' @' + username : ''}:\n\n${message}`;
}

function skipLogging(ctx: Context): boolean {
  return (
    !ADMIN_CHAT_ID ||
    CHATS_WITH_DISABLED_LOGS.has(ctx.message?.chat.id!) ||
    USERS_WITH_DISABLED_LOGS.has(ctx.from?.id!)
  );
}

export async function sendMediaToAdmins(ctx: Context, isReply: boolean) {
  if (skipLogging(ctx)) {
    return;
  }

  const message = ctx.message!;
  const messageId = isReply
    ? (message as any).reply_to_message.message_id
    : message.message_id;

  await ctx.telegram.forwardMessage(ADMIN_CHAT_ID, message.chat.id, messageId, {
    message_thread_id: ADMIN_MESSAGE_THREAD_ID,
  });
}

export async function sendMessageToAdmins(
  ctx: Context,
  message: string,
  isError: boolean = false,
) {
  if (skipLogging(ctx)) {
    return;
  }

  const messageFormatted = formatMessage(ctx, message, isError);
  return ctx.telegram.sendMessage(ADMIN_CHAT_ID, messageFormatted, {
    message_thread_id: ADMIN_MESSAGE_THREAD_ID,
    parse_mode: 'HTML',
  });
}

export async function logFileWithTranscription(
  ctx: Context,
  messageIds: number[],
) {
  if (skipLogging(ctx)) {
    return;
  }

  await sendMessageToAdmins(ctx, 'Transcibe file', false);
  await ctx.telegram.copyMessages(
    ADMIN_CHAT_ID,
    ctx.message?.chat.id!,
    messageIds,
    { message_thread_id: ADMIN_MESSAGE_THREAD_ID },
  );
}

export async function logUnknownError(ctx: Context, e: unknown) {
  console.error(e);
  if (ADMIN_CHAT_ID) {
    const errorMessage =
      e instanceof Error
        ? `<code>${e.name} ${e.message}</code>\n\n<pre>${e.stack}</pre>`
        : `<code>${e}</code>`;

    await ctx.telegram.sendMessage(ADMIN_CHAT_ID, `🚨 ${errorMessage}`, {
      message_thread_id: ADMIN_MESSAGE_THREAD_ID,
      parse_mode: 'HTML',
    });
  }
}
