import type { Context, Telegraf } from 'telegraf';
import type { Update } from 'telegraf/typings/core/types/typegram';

const development = async (bot: Telegraf<Context<Update>>) => {
  await bot.telegram.deleteWebhook();
  await bot.launch();

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
};

export { development };
