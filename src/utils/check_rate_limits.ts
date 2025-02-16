import {
  GLOBAL_RATE_LIMIT,
  GLOBAL_REQUEST_WINDOW,
  USER_RATE_LIMIT,
  USER_REQUEST_WINDOW,
} from '../config';
import { redis } from '../core';
import type { Context } from 'telegraf';

async function enforceRateLimit(
  key: string,
  limit: number,
  windowInSeconds: number,
): Promise<boolean> {
  if (!limit || !windowInSeconds) return true;
  try {
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, windowInSeconds);
    }

    if (current > limit) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('Redis error:', error);
    return true;
  }
}

export async function checkRateLimits(ctx: Context): Promise<boolean> {
  const userId = ctx.from?.id;
  if (!userId) return false;

  const userKey = `rate:user:${userId}`;
  const userAllowed = await enforceRateLimit(
    userKey,
    USER_RATE_LIMIT,
    USER_REQUEST_WINDOW,
  );

  if (!userAllowed) {
    await ctx.reply('You exceeded requests limit');
    return false;
  }

  const globalKey = 'rate:global';
  const globalAllowed = await enforceRateLimit(
    globalKey,
    GLOBAL_RATE_LIMIT,
    GLOBAL_REQUEST_WINDOW,
  );

  if (!globalAllowed) {
    await ctx.reply('Global requests limit exceeded');
    return false;
  }

  return true;
}
