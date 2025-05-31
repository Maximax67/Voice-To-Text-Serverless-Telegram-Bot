import { GLOBAL_ADMINS } from '../config';

import type { Context } from 'telegraf';

export function isGlobalAdmin(userId: number): boolean {
  return GLOBAL_ADMINS.has(userId);
}

export async function isAdmin(ctx: Context): Promise<boolean> {
  if (ctx.chat?.type === 'private') return true;
  if (ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup') {
    const userId = ctx.from!.id;

    if (isGlobalAdmin(userId)) {
      return true;
    }

    const member = await ctx.getChatMember(userId);
    return member.status === 'administrator' || member.status === 'creator';
  }

  return false;
}
