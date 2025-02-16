import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import { BOT_TOKEN } from '../config';
import { checkRateLimits, handleVoiceMessage } from '../utils';
import { START_MESSAGE } from '../constants';

const telegramBot = new Telegraf(BOT_TOKEN);

telegramBot.command('start', async (ctx) =>
  ctx.reply(START_MESSAGE, { parse_mode: 'HTML' }),
);

telegramBot.command('transcribe', async (ctx) => {
  const replyMsg = (ctx.message as any).reply_to_message;
  if (!replyMsg || !(replyMsg.voice || replyMsg.audio)) {
    await ctx.reply('Please reply to voice or audio message!');
    return;
  }

  if (!(await checkRateLimits(ctx))) return;

  await handleVoiceMessage(ctx, replyMsg.voice || replyMsg.audio);
});

telegramBot.on(message('audio'), async (ctx: any) => {
  if (!(await checkRateLimits(ctx))) return;
  await handleVoiceMessage(ctx, ctx.message.audio);
});

telegramBot.on(message('voice'), async (ctx: any) => {
  if (!(await checkRateLimits(ctx))) return;
  await handleVoiceMessage(ctx, ctx.message.voice);
});

export { telegramBot };
