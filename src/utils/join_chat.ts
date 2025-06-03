import { START_MESSAGE } from '../constants';
import { getClient } from '../core';
import { ensureChatRecord } from './get_chat_info';

import type { Context, NarrowedContext } from 'telegraf';
import type { Update } from 'telegraf/typings/core/types/typegram';

export async function joinChat(
  ctx: NarrowedContext<Context<Update>, Update.MyChatMemberUpdate>,
) {
  const chat = ctx.chat;
  const myChatMember = ctx.update.my_chat_member;
  if (
    myChatMember.new_chat_member.user.id === ctx.botInfo.id &&
    (myChatMember.new_chat_member.status === 'member' ||
      myChatMember.new_chat_member.status === 'administrator')
  ) {
    const client = await getClient();
    await ensureChatRecord(client, chat.id);

    if (ctx.chat.type !== 'private') {
      await ctx.reply(START_MESSAGE, { parse_mode: 'HTML' });
    }
  }
}
