import { MediaType } from '../enums';

import type { Context } from 'telegraf';
import type { MediaContent, ReplyContent } from '../types';

const mediaMap: Record<string, MediaType> = {
  voice: MediaType.VOICE,
  audio: MediaType.AUDIO,
  video_note: MediaType.VIDEO_NOTE,
  video: MediaType.VIDEO,
  photo: MediaType.PHOTO,
  document: MediaType.DOCUMENT,
};

export function getReplyContent(ctx: Context): ReplyContent | undefined {
  const replyMsg = (ctx.message as any).reply_to_message;
  if (!replyMsg) return;

  for (const key of Object.keys(mediaMap)) {
    let content = replyMsg[key];
    if (content) {
      const type = mediaMap[key];
      if (type === MediaType.PHOTO) {
        content = content[content.length - 1];
      }

      return { content, type };
    }
  }
}

export function isMediaContent(
  reply: ReplyContent,
): reply is Extract<ReplyContent, { content: MediaContent }> {
  return reply.type !== MediaType.DOCUMENT && reply.type !== MediaType.PHOTO;
}
