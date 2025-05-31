import { Context } from 'telegraf';
import { MediaType } from '../enums';
import type { MediaContent } from '../types';

const mediaMap: Record<string, MediaType> = {
  voice: MediaType.VOICE,
  audio: MediaType.AUDIO,
  video_note: MediaType.VIDEO_NOTE,
  video: MediaType.VIDEO,
};

export function getReplyContent(
  ctx: Context,
): { content: MediaContent; type: MediaType } | undefined {
  const replyMsg = (ctx.message as any).reply_to_message;
  if (!replyMsg) return;

  for (const key of Object.keys(mediaMap)) {
    const content = replyMsg[key];
    if (content) {
      return {
        content,
        type: mediaMap[key],
      };
    }
  }
}
