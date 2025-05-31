import {
  GLOBAL_RATE_LIMIT,
  GLOBAL_REQUESTS_WINDOW,
  USER_RATE_LIMIT,
  USER_REQUESTS_WINDOW,
} from '../config';
import { redis } from '../core';
import { ChatState } from '../enums';
import { sendMessageToAdmins } from './logging';
import type { Context } from 'telegraf';

const luaScript = `
  local userKey = KEYS[1]
  local globalKey = KEYS[2]
  local chatKey = KEYS[3]

  local userLimit = tonumber(ARGV[1])
  local globalLimit = tonumber(ARGV[2])
  local userWindow = tonumber(ARGV[3])
  local globalWindow = tonumber(ARGV[4])

  local userCount = 0
  local globalCount = 0
  local chatState = redis.call("GET", chatKey)

  if chatState == ${ChatState.DISABLED} or chatState == ${ChatState.BANNED} then
    return {userCount, globalCount, chatState}
  end

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

  return {userCount, globalCount, chatState}
`;

export async function checkRateLimits(ctx: Context): Promise<boolean> {
  const userId = ctx.from?.id;
  if (!userId) {
    return false;
  }

  const chatId = ctx.chat?.id;
  if (!chatId) {
    return false;
  }

  if (
    (!USER_RATE_LIMIT || !USER_REQUESTS_WINDOW) &&
    (!GLOBAL_RATE_LIMIT || !GLOBAL_REQUESTS_WINDOW)
  ) {
    const chatState = await redis.get<number>(`chat:${chatId}`);
    if (chatState === ChatState.BANNED || chatState === ChatState.DISABLED) {
      return false;
    }

    return true;
  }

  const userKey = `rate:user:${userId}`;
  const globalKey = 'rate:global';
  const chatKey = `chat:${chatId}`;

  const [userCount, globalCount, chatState]: [number, number, number | null] =
    await redis.eval(
      luaScript,
      [userKey, globalKey, chatKey],
      [
        USER_RATE_LIMIT,
        GLOBAL_RATE_LIMIT,
        USER_REQUESTS_WINDOW,
        GLOBAL_REQUESTS_WINDOW,
      ],
    );

  if (chatState === ChatState.BANNED || chatState === ChatState.DISABLED) {
    return false;
  }

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
}
