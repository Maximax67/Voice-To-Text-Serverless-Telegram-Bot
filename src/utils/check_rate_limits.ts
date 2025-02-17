import {
  GLOBAL_RATE_LIMIT,
  GLOBAL_REQUESTS_WINDOW,
  USER_RATE_LIMIT,
  USER_REQUESTS_WINDOW,
} from '../config';
import { redis } from '../core';
import { sendMessageToAdmins } from './logging';
import type { Context } from 'telegraf';

const luaScript = `
  local userKey = KEYS[1]
  local globalKey = KEYS[2]
  local userLimit = tonumber(ARGV[1])
  local globalLimit = tonumber(ARGV[2])
  local userWindow = tonumber(ARGV[3])
  local globalWindow = tonumber(ARGV[4])

  local userCount = 0
  local globalCount = 0

  if userLimit > 0 and userWindow > 0 then
    userCount = redis.call("INCR", userKey)
    if userCount == 1 then
      redis.call("EXPIRE", userKey, userWindow)
    end
  end

  if globalLimit > 0 and globalWindow > 0 then
    globalCount = redis.call("INCR", globalKey)
    if globalCount == 1 then
      redis.call("EXPIRE", globalKey, globalWindow)
    end
  end

  return {userCount, globalCount}
`;

export async function checkRateLimits(ctx: Context): Promise<boolean> {
  const userId = ctx.from?.id;
  if (!userId) {
    return false;
  }

  if (
    (!USER_RATE_LIMIT || !USER_REQUESTS_WINDOW) &&
    (!GLOBAL_RATE_LIMIT || !GLOBAL_REQUESTS_WINDOW)
  ) {
    return true;
  }

  const userKey = `rate:user:${userId}`;
  const globalKey = 'rate:global';

  try {
    const [userCount, globalCount]: number[] = await redis.eval(
      luaScript,
      [userKey, globalKey],
      [
        USER_RATE_LIMIT,
        GLOBAL_RATE_LIMIT,
        USER_REQUESTS_WINDOW,
        GLOBAL_REQUESTS_WINDOW,
      ],
    );

    if (USER_RATE_LIMIT > 0 && userCount > USER_RATE_LIMIT) {
      await ctx.reply('You exceeded requests limit');
      await sendMessageToAdmins(ctx, 'User rate limit exceeded');
      return false;
    }

    if (GLOBAL_RATE_LIMIT > 0 && globalCount > GLOBAL_RATE_LIMIT) {
      await ctx.reply('Global requests limit exceeded');
      await sendMessageToAdmins(ctx, 'Global requests limit exceeded', true);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Redis error:', error);
    return true;
  }
}
