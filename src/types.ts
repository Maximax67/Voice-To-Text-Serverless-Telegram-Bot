import type {
  Audio,
  Video,
  VideoNote,
  Voice,
  Document,
  PhotoSize,
} from 'telegraf/typings/core/types/typegram';
import type { FormatStyle, MediaType, Mode } from './enums';

export type MediaContent = Audio | Video | VideoNote | Voice;
export type MediaContentToSilentLog = Document | PhotoSize;
export type ReplyContent =
  | {
      type: MediaType.PHOTO | MediaType.DOCUMENT;
      content: MediaContentToSilentLog;
    }
  | {
      type: Exclude<MediaType, MediaType.PHOTO | MediaType.DOCUMENT>;
      content: MediaContent;
    };

export interface ChatInfo {
  chat_id: number;
  language: string | null;
  format_style: FormatStyle;
  default_mode: Mode;
  logging_enabled: boolean;
  banned_timestamp: Date;
  created_at: Date;
  edited_at: Date;
}

export interface RequestInfo {
  user_id: number;
  forward_chat_id: number | null;
  is_forward: boolean;
  chat_id: number;
  mode: Mode;
  message_id: number;
  media_type: MediaType;
  logged_message_id: number | null;
  file_id: string;
  file_type: string | null;
  file_size: number;
  duration: number | null;
  response: string | null;
  error: string | null;
  language: string | null;
  media_download_time: number | null;
  api_request_time: number | null;
  total_request_time: number;
}

export interface InputFileByBuffer {
  source: Buffer;
  filename?: string;
}
