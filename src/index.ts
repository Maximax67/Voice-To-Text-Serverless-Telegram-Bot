import { development, launchServer, production, telegramBot } from './core';
import { ENVIRONMENT, IS_VERCEL, PORT } from './config';

import type { VercelRequest, VercelResponse } from '@vercel/node';

export const startVercel = async (req: VercelRequest, res: VercelResponse) => {
  await production(req, res, telegramBot);
};

if (ENVIRONMENT !== 'production') {
  development(telegramBot);
} else if (!IS_VERCEL) {
  launchServer(PORT, telegramBot);
}
