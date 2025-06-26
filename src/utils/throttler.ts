import Bottleneck from 'bottleneck';
import type { Telegraf } from 'telegraf';

const limiter = new Bottleneck({
  maxConcurrent: 1,
  minTime: 200, // ~5 requests per second
});

export function throttleTelegramApi(bot: Telegraf<any>) {
  const telegram = bot.telegram;
  const originalCallApi = telegram.callApi.bind(telegram);

  telegram.callApi = function (...args) {
    return limiter.schedule(() => originalCallApi(...args));
  };
}
