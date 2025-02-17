import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import { useNewReplies } from 'telegraf/future';

import { BOT_TOKEN } from '../config';
import { START_MESSAGE } from '../constants';
import { handleTranscribeRequest, logUnknownError } from '../utils';

const telegramBot = new Telegraf(BOT_TOKEN);

telegramBot.use(useNewReplies());

telegramBot.catch((e, ctx) => logUnknownError(ctx, e));

telegramBot.command('start', (ctx) =>
  ctx.reply(START_MESSAGE, { parse_mode: 'HTML' }),
);

telegramBot.command('transcribe', async (ctx) => {
  const replyMsg = (ctx.message as any).reply_to_message;
  if (!replyMsg) {
    await ctx.reply('Please reply to voice, audio or video message!');
    return;
  }

  const replyContent =
    replyMsg.voice || replyMsg.audio || replyMsg.video_note || replyMsg.video;

  if (!replyContent) {
    await ctx.reply('Please reply to voice, audio or video message!');
    return;
  }

  await handleTranscribeRequest(ctx, replyContent, true);
});

telegramBot.on(message('audio'), async (ctx) =>
  handleTranscribeRequest(ctx, ctx.message.audio),
);

telegramBot.on(message('voice'), async (ctx) =>
  handleTranscribeRequest(ctx, ctx.message.voice),
);

telegramBot.on(message('video_note'), async (ctx) =>
  handleTranscribeRequest(ctx, ctx.message.video_note),
);

telegramBot.on(message('video'), async (ctx) =>
  handleTranscribeRequest(ctx, ctx.message.video),
);

export { telegramBot };
