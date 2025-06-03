import { Markup } from 'telegraf';

import { LANGUAGE_CODES } from '../constants';
import { Mode } from '../enums';
import { getClient } from '../core';
import { formatDateTime } from './formate_datetime';
import { getChatInfo } from './get_chat_info';

import type { Context } from 'telegraf';

export async function showSettingsMenu(ctx: Context, isEdit: boolean = false) {
  const chatId = ctx.chat!.id;
  const client = await getClient();
  const chatInfo = await getChatInfo(client, chatId);

  const language = chatInfo.language
    ? LANGUAGE_CODES[chatInfo.language]
    : 'Multilingual';
  const formatStyle = chatInfo.format_style;

  let mode: string;
  if (chatInfo.default_mode === null) {
    mode = 'Disabled';
  } else if (chatInfo.default_mode === Mode.TRANSCRIBE) {
    mode = 'Transcribe';
  } else {
    mode = 'Translate';
  }

  const createdAtFormatted = formatDateTime(chatInfo.created_at);
  const editedAtFormatted = formatDateTime(chatInfo.edited_at);
  const createdAtLabel =
    ctx.chat!.type === 'private' ? 'First started' : 'First added to group';

  const text =
    `<b>Chat id:</b> <code>${chatId}</code>${chatInfo.banned_timestamp ? '\n<b>Banned:</b> ' + formatDateTime(chatInfo.banned_timestamp) : ''}\n\n` +
    `<b>Chat language:</b> ${language}\n` +
    `<b>Format style:</b> ${formatStyle[0].toUpperCase() + formatStyle.slice(1).replace('_', ' ')}\n` +
    `<b>Mode:</b> ${mode}\n\n` +
    `<b>${createdAtLabel}:</b> ${createdAtFormatted}\n` +
    `<b>Last settings edit:</b> ${editedAtFormatted}`;

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('Change chat language', 'change_lang')],
    [Markup.button.callback('Change format style', 'change_format_style')],
    [Markup.button.callback('Change default mode', 'change_mode')],
    [Markup.button.callback('Close', 'close_menu')],
  ]);

  if (isEdit) {
    try {
      await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        ...keyboard,
      });
      return;
    } catch {
      await ctx.deleteMessage();
    }
  }

  await ctx.reply(text, {
    parse_mode: 'HTML',
    ...keyboard,
  });
}
