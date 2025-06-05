import { TELEGRAM_SECRET_TOKEN } from '../config';

import type { Context, Telegraf } from 'telegraf';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Update } from 'telegraf/typings/core/types/typegram';

const production = async (
  req: VercelRequest,
  res: VercelResponse,
  bot: Telegraf<Context<Update>>,
) => {
  if (req.method !== 'POST') {
    res.status(200).json({ status: 'Listening to bot events...' });
    return;
  }

  const receivedSecret = req.headers['x-telegram-bot-api-secret-token'];
  if (TELEGRAM_SECRET_TOKEN && receivedSecret !== TELEGRAM_SECRET_TOKEN) {
    res.status(403).json({ error: 'Forbidden: Invalid secret token' });
    return;
  }

  await bot.handleUpdate(req.body as Update, res);
};

export { production };
