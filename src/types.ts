import type {
  Audio,
  Video,
  VideoNote,
  Voice,
} from 'telegraf/typings/core/types/typegram';
import type { FormatStyle, MediaType, Mode } from './enums';

export type MediaContent = Audio | Video | VideoNote | Voice;

export interface ChatInfo {
  chat_id: number;
  language: string | null;
  format_style: FormatStyle;
  default_mode: Mode | null;
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
  file_type: string;
  file_size: number;
  duration: number;
  response: string | null;
  error: string | null;
  language: string | null;
  media_download_time: number | null;
  api_request_time: number | null;
  total_request_time: number;
}
