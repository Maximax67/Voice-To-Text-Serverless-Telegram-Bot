import { VERCEL_URL } from '../config';
import type { Context, Telegraf } from 'telegraf';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Update } from 'telegraf/typings/core/types/typegram';

const production = async (
  req: VercelRequest,
  res: VercelResponse,
  bot: Telegraf<Context<Update>>,
) => {
  if (!VERCEL_URL) {
    throw new Error('VERCEL_URL is not set.');
  }

  const getWebhookInfo = await bot.telegram.getWebhookInfo();
  if (getWebhookInfo.url !== VERCEL_URL + '/api') {
    await bot.telegram.deleteWebhook();
    await bot.telegram.setWebhook(`${VERCEL_URL}/api`);
  }

  if (req.method === 'POST') {
    await bot.handleUpdate(req.body as Update, res);
  } else {
    res.status(200).json('Listening to bot events...');
  }
};

export { production };
