import { Context } from 'telegraf';
import { LANGUAGE_CODES, NON_ADMINS_ACCESS_SETTINGS_ERROR } from '../constants';
import { isAdmin, showSettingsMenu } from './index';
import { getClient } from '../core';
import { FormatStyle, Mode } from '../enums';

export async function handleChangeLanguage(ctx: Context): Promise<void> {
  if (!(await isAdmin(ctx))) {
    await ctx.answerCbQuery(NON_ADMINS_ACCESS_SETTINGS_ERROR);
    return;
  }

  const langEntries = Object.entries(LANGUAGE_CODES);
  const keyboardRows = [];

  for (let i = 0; i < langEntries.length; i += 2) {
    const row = [
      {
        text: langEntries[i][1],
        callback_data: `set_lang:${langEntries[i][0]}`,
      },
    ];
    if (langEntries[i + 1]) {
      row.push({
        text: langEntries[i + 1][1],
        callback_data: `set_lang:${langEntries[i + 1][0]}`,
      });
    }
    keyboardRows.push(row);
  }

  keyboardRows.push([{ text: 'Multilingual', callback_data: 'set_lang:all' }]);
  keyboardRows.push([{ text: '⬅️ Back', callback_data: 'settings_back' }]);

  await ctx.editMessageText('Select language:', {
    reply_markup: { inline_keyboard: keyboardRows },
  });

  await ctx.answerCbQuery();
}

export async function handleSetLanguage(
  ctx: Context,
  lang: string,
): Promise<void> {
  if (!(await isAdmin(ctx))) {
    await ctx.answerCbQuery(NON_ADMINS_ACCESS_SETTINGS_ERROR);
    return;
  }

  const chatId = ctx.chat!.id;
  const client = await getClient();
  await client.query(
    'UPDATE chats SET language = $1, edited_at = CURRENT_TIMESTAMP WHERE chat_id = $2;',
    [lang === 'all' ? null : lang, chatId],
  );

  await showSettingsMenu(ctx, true);
  await ctx.answerCbQuery('Language updated!');
}

export async function handleChangeFormatStyle(ctx: Context): Promise<void> {
  if (!(await isAdmin(ctx))) {
    await ctx.answerCbQuery(NON_ADMINS_ACCESS_SETTINGS_ERROR);
    return;
  }

  const keyboardRows = Object.values(FormatStyle).map((style) => [
    {
      text: style.charAt(0).toUpperCase() + style.slice(1).replace('_', ' '),
      callback_data: `set_fs:${style}`,
    },
  ]);

  keyboardRows.push([{ text: '⬅️ Back', callback_data: 'settings_back' }]);

  await ctx.editMessageText('Select format style:', {
    reply_markup: { inline_keyboard: keyboardRows },
  });

  await ctx.answerCbQuery();
}

export async function handleChangeMode(ctx: Context): Promise<void> {
  if (!(await isAdmin(ctx))) {
    await ctx.answerCbQuery(NON_ADMINS_ACCESS_SETTINGS_ERROR);
    return;
  }

  const keyboardRows = [
    [{ text: 'Transcribe', callback_data: `set_mode:${Mode.TRANSCRIBE}` }],
    [{ text: 'Translate', callback_data: `set_mode:${Mode.TRANSLATE}` }],
    [{ text: 'Disable', callback_data: `set_mode:${Mode.IGNORE}` }],
    [{ text: '⬅️ Back', callback_data: 'settings_back' }],
  ];

  await ctx.editMessageText('Select mode:', {
    reply_markup: { inline_keyboard: keyboardRows },
  });

  await ctx.answerCbQuery();
}

export async function handleSetFormatStyle(
  ctx: Context,
  style: string,
): Promise<void> {
  if (!(await isAdmin(ctx))) {
    await ctx.answerCbQuery(NON_ADMINS_ACCESS_SETTINGS_ERROR);
    return;
  }

  const chatId = ctx.chat!.id;
  const client = await getClient();
  await client.query(
    'UPDATE chats SET format_style = $1, edited_at = CURRENT_TIMESTAMP WHERE chat_id = $2;',
    [style, chatId],
  );

  await showSettingsMenu(ctx, true);
  await ctx.answerCbQuery('Format style updated!');
}

export async function handleSetMode(ctx: Context, mode: Mode): Promise<void> {
  if (!(await isAdmin(ctx))) {
    await ctx.answerCbQuery(NON_ADMINS_ACCESS_SETTINGS_ERROR);
    return;
  }

  const chatId = ctx.chat!.id;
  const client = await getClient();
  await client.query(
    'UPDATE chats SET default_mode = $1, edited_at = CURRENT_TIMESTAMP WHERE chat_id = $2;',
    [mode, chatId],
  );

  await showSettingsMenu(ctx, true);
  await ctx.answerCbQuery('Mode updated!');
}

export async function handleSettingsBack(ctx: Context): Promise<void> {
  if (!(await isAdmin(ctx))) {
    await ctx.answerCbQuery(NON_ADMINS_ACCESS_SETTINGS_ERROR);
    return;
  }

  await showSettingsMenu(ctx, true);
  await ctx.answerCbQuery();
}

export async function handleCloseMenu(ctx: Context): Promise<void> {
  if (!(await isAdmin(ctx))) {
    await ctx.answerCbQuery(NON_ADMINS_ACCESS_SETTINGS_ERROR);
    return;
  }

  try {
    await ctx.editMessageReplyMarkup(undefined);
  } catch {}

  await ctx.answerCbQuery();
}
