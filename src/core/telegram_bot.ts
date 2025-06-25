import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import { useNewReplies } from 'telegraf/future';

import { BOT_TOKEN } from '../config';
import {
  INVALID_MESSAGE_TYPE_ERROR,
  INVALID_USAGE_ERROR,
  NON_ADMINS_ACCESS_SETTINGS_ERROR,
  START_MESSAGE,
} from '../constants';
import { MediaType, Mode } from '../enums';
import {
  ban,
  banList,
  chatList,
  disableLogging,
  enableLogging,
  getLogs,
  getReplyContent,
  handleChangeFormatStyle,
  handleChangeLanguage,
  handleChangeMode,
  handleCloseMenu,
  handleMediaRequest,
  handleSetFormatStyle,
  handleSetLanguage,
  handleSetMode,
  handleSettingsBack,
  isAdmin,
  joinChat,
  logUnknownError,
  migrateChatMiddleware,
  deleteAllLogs,
  deleteLogs,
  showSettingsMenu,
  throttleTelegramApi,
  unban,
  showChatStatistics,
  showGlobalStatistics,
  searchLogs,
  getFileById,
  who,
  logNonTranscribableMediaRequest,
  isMediaContent,
} from '../utils';

const telegramBot = new Telegraf(BOT_TOKEN);

throttleTelegramApi(telegramBot);

telegramBot.use(useNewReplies());
telegramBot.catch(logUnknownError);

telegramBot.command('start', async (ctx) =>
  ctx.reply(START_MESSAGE, { parse_mode: 'HTML' }),
);

telegramBot.command('transcribe', async (ctx) => {
  const replyContent = getReplyContent(ctx);
  if (!replyContent) {
    await ctx.reply(INVALID_USAGE_ERROR);
    return;
  }

  if (!isMediaContent(replyContent)) {
    await logNonTranscribableMediaRequest(
      ctx,
      replyContent.content,
      replyContent.type,
      true,
    );
    await ctx.reply(INVALID_USAGE_ERROR);
    return;
  }

  await handleMediaRequest(
    ctx,
    replyContent.content,
    replyContent.type,
    true,
    Mode.TRANSCRIBE,
  );
});

telegramBot.command('translate', async (ctx) => {
  const replyContent = getReplyContent(ctx);
  if (!replyContent) {
    await ctx.reply(INVALID_USAGE_ERROR);
    return;
  }

  if (!isMediaContent(replyContent)) {
    await logNonTranscribableMediaRequest(
      ctx,
      replyContent.content,
      replyContent.type,
      true,
    );
    await ctx.reply(INVALID_USAGE_ERROR);
    return;
  }

  await handleMediaRequest(
    ctx,
    replyContent.content,
    replyContent.type,
    true,
    Mode.TRANSLATE,
  );
});

telegramBot.command('settings', async (ctx) => {
  if (await isAdmin(ctx)) {
    await showSettingsMenu(ctx);
  } else {
    await ctx.reply(NON_ADMINS_ACCESS_SETTINGS_ERROR);
  }
});

telegramBot.command('ban', ban);
telegramBot.command('unban', unban);
telegramBot.command('ban_list', banList);

telegramBot.command('disable_logging', disableLogging);
telegramBot.command('enable_logging', enableLogging);
telegramBot.command('logs', getLogs);

telegramBot.command('chat_list', async (ctx) => chatList(ctx, false));
telegramBot.command('chat_list_by_requests', async (ctx) =>
  chatList(ctx, true),
);

telegramBot.command('stats', showChatStatistics);
telegramBot.command('global_stats', showGlobalStatistics);

telegramBot.command('delete_logs', deleteLogs);
telegramBot.command('delete_all_logs', deleteAllLogs);

telegramBot.command('search', searchLogs);
telegramBot.command('file', getFileById);
telegramBot.command('who', who);

telegramBot.on(message('audio'), async (ctx) =>
  handleMediaRequest(ctx, ctx.message.audio, MediaType.AUDIO),
);

telegramBot.on(message('voice'), async (ctx) =>
  handleMediaRequest(ctx, ctx.message.voice, MediaType.VOICE),
);

telegramBot.on(message('video_note'), async (ctx) =>
  handleMediaRequest(ctx, ctx.message.video_note, MediaType.VIDEO_NOTE),
);

telegramBot.on(message('video'), async (ctx) =>
  handleMediaRequest(ctx, ctx.message.video, MediaType.VIDEO),
);

telegramBot.on(message('photo'), async (ctx, next: () => Promise<void>) => {
  const photoSizeArray = ctx.message.photo;
  const largestPhoto = photoSizeArray[photoSizeArray.length - 1];
  await logNonTranscribableMediaRequest(ctx, largestPhoto, MediaType.PHOTO);
  await next();
});

telegramBot.on(message('document'), async (ctx, next: () => Promise<void>) => {
  await logNonTranscribableMediaRequest(
    ctx,
    ctx.message.document,
    MediaType.DOCUMENT,
  );
  await next();
});

telegramBot.on('my_chat_member', joinChat);
telegramBot.on('message', migrateChatMiddleware);
telegramBot.on('message', async (ctx) => {
  if (ctx.chat?.type === 'private') {
    await ctx.reply(INVALID_MESSAGE_TYPE_ERROR);
  }
});

telegramBot.action('change_lang', handleChangeLanguage);
telegramBot.action('change_format_style', handleChangeFormatStyle);
telegramBot.action('change_mode', handleChangeMode);

telegramBot.action(/^set_lang:(.+)$/, async (ctx) =>
  handleSetLanguage(ctx, ctx.match[1]),
);

telegramBot.action(/^set_fs:(.+)$/, async (ctx) =>
  handleSetFormatStyle(ctx, ctx.match[1]),
);

telegramBot.action(/^set_mode:(\d+)$/, async (ctx) =>
  handleSetMode(ctx, +ctx.match[1] as Mode),
);

telegramBot.action('settings_back', handleSettingsBack);
telegramBot.action('close_menu', handleCloseMenu);

export { telegramBot };
